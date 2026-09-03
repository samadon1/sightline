/**
 * Caption controller: owns the canonical cues, the companion profile, the pass-1 eligibility
 * cache, the native text track, and the Detailed overlay state. Framework-free except for the
 * injected native factories, so it can be unit-tested in Node.
 *
 * Runtime initialization (spec §11.3):
 *   parse canonical VTT → load/validate companion → read CaptioningProps → pass 1 →
 *   create native track → render selected mode.
 *
 * Levels:
 *   Standard      native track, canonical text, no settings (bottom)
 *   Speaker-aware native track, label line + lane settings
 *   Detailed      native track hidden; overlay renders the resolved active set on cuechange
 */

import {
  parseVtt, validateProfile, resolveTrack, resolveAlone, layoutActiveSet, activeAt, fontScaleFor, activeSoundEvents, nativeWordSegments,
  laneToCueSettings, NATIVE_VEGA_CAPABILITIES, OVERLAY_CAPABILITIES, describe,
  type CanonicalCue, type CompanionProfile, type EligibleCue, type ResolvedCaption, type Mode,
  type ViewerPreferences, type SystemCaptionPreferences, type Lane, type ValidationResult,
} from "@sightline-wip/core";
import { devLog, syncLog } from "../log.ts";

export type NativeCue = {
  id?: string; startTime: number; endTime: number; text: string;
  line?: number; snapToLines?: boolean; position?: number; positionAlign?: string; align?: string; size?: number;
};
export type NativeTrack = {
  mode: "disabled" | "hidden" | "showing";
  addCue(cue: NativeCue): void;
  removeCue(cue: NativeCue): void;
  activeCues?: ArrayLike<NativeCue> | null;
  oncuechange?: (() => void) | null;
};

/**
 * Measured with a single 120 ms lead: a cue's first segment still lands +56 ms late at the median while
 * later word segments land 21 ms early (docs/sync-report.md), so a new cue costs the renderer more than a
 * text swap. Two leads: cue entries and cue exits use NATIVE_LEAD_START_MS, later word segments use
 * NATIVE_LEAD_WORD_MS. Three runs put the raw entry lag at 176, 81 and 56 ms and the raw word-swap lag at
 * 99, 95 and 114 ms (the last run with the event-anchored clock), so both leads sit at 100 ms until hardware
 * measurements settle the entry figure. Measured against the event-anchored MediaClock (FL-027).
 */
export const NATIVE_LEAD_START_MS = 100;
export const NATIVE_LEAD_WORD_MS = 100;

export type ControllerDeps = {
  makeCue: (start: number, end: number, text: string) => NativeCue;
  track: NativeTrack;
  /** Media time in ms, read at cue changes. */
  now: () => number;
  /** Fixture only: give the native track the raw cue payload (markup included) in Standard mode. */
  nativeMarkup?: boolean;
  /** Override for the native leads (tests and measurement runs). */
  nativeLeadMs?: number;
};

export type CaptionState = {
  mode: Mode;
  /** What the overlay should draw right now (Detailed only). */
  overlay: ResolvedCaption[];
  /** Companion validation result, for the About/diagnostics screens. */
  validation: ValidationResult | null;
  companionPresent: boolean;
  cueCount: number;
  lastActiveIds: string[];
  /** Media time the overlay was laid out for (word colouring compares word starts with it). */
  nowMs: number;
  /** Start time of each active sound event (overlay "pop" at onset). */
  sfxStart: Map<string, number>;
};

/** WebVTT standard colour classes for the native renderer; CI Main Orange has no class and stays white. */
export function nativeColorClass(token?: string): string | undefined {
  switch (token) {
    case "speaker-1": return "yellow";
    case "speaker-2": return "cyan";
    case "speaker-3": return "red";
    case "speaker-5": return "lime";
    case "speaker-6": return "magenta";
    default: return undefined;
  }
}

export class CaptionController {
  readonly cues: CanonicalCue[];
  readonly profile: CompanionProfile | null;
  readonly validation: ValidationResult | null;
  private eligible: EligibleCue[] = [];
  private nativeCues: NativeCue[] = [];
  private viewer: ViewerPreferences;
  private system: SystemCaptionPreferences = {};
  private previousLaneBySpeaker = new Map<string, Lane>();
  private lastShotId: string | null = null;
  private listeners = new Set<(s: CaptionState) => void>();
  private state: CaptionState;

  private deps: ControllerDeps;

  constructor(deps: ControllerDeps, vttText: string, companion: unknown | null, viewer: ViewerPreferences, system?: SystemCaptionPreferences) {
    this.deps = deps;
    const parsed = parseVtt(vttText);
    parsed.warnings.forEach((w) => devLog(`[vtt] ${w}`));
    this.cues = parsed.cues;
    this.viewer = viewer;
    if (system) this.system = system;
    // A companion file that fails validation is ignored wholesale: Standard still works, and
    // per-cue problems (hash mismatch, unknown speaker) are also caught per cue in the resolver.
    if (companion) {
      const v = validateProfile(companion, this.cues);
      this.validation = v;
      v.errors.forEach((e) => devLog(`[companion] error ${e.path}: ${e.message}`));
      // Per-entry errors reject only that entry: a bad cue is caught per cue in the resolver, a bad sound event or
      // shot is dropped here. Only structural errors (schema version, speakers, cues not an object) reject the file.
      // Array-level shot/sound complaints (overlaps, duplicate ids) are also per-entry: the resolver tolerates them.
      const perEntry = /^(\$\.cues\.|\$\.sounds(\[(\d+)\]|$)|\$\.shots(\[(\d+)\]|$)|vtt#)/;
      const structural = v.errors.filter((e) => !perEntry.test(e.path));
      if (v.ok || structural.length === 0) {
        const badSounds = new Set(v.errors.map((e) => /^\$\.sounds\[(\d+)\]/.exec(e.path)?.[1]).filter((x): x is string => !!x).map(Number));
        const badShots = new Set(v.errors.map((e) => /^\$\.shots\[(\d+)\]/.exec(e.path)?.[1]).filter((x): x is string => !!x).map(Number));
        const prof = companion as CompanionProfile;
        this.profile = badSounds.size || badShots.size ? {
          ...prof,
          sounds: (prof.sounds ?? []).filter((_, i) => !badSounds.has(i)),
          shots: (prof.shots ?? []).filter((_, i) => !badShots.has(i)),
        } : prof;
        if (badSounds.size || badShots.size) devLog(`[companion] dropped ${badSounds.size} sound event(s) and ${badShots.size} shot(s) with errors; the rest applies`);
      } else this.profile = null;
      if (!this.profile) devLog("[companion] rejected: structural errors; playing with Standard captions only");
    } else { this.profile = null; this.validation = null; }
    this.state = { mode: viewer.mode, overlay: [], validation: this.validation, companionPresent: !!this.profile, cueCount: this.cues.length, lastActiveIds: [], nowMs: 0, sfxStart: new Map() };
    deps.track.oncuechange = () => this.onCueChange();
    try { this.rebuild(); }
    catch (e) {
      // Leave nothing behind on the shared track, then surface the failure to the caller.
      for (const c of this.nativeCues) { try { deps.track.removeCue(c); } catch { /* gone */ } }
      this.nativeCues = []; deps.track.oncuechange = null;
      throw e;
    }
  }

  subscribe(l: (s: CaptionState) => void): () => void { this.listeners.add(l); l(this.state); return () => { this.listeners.delete(l); }; }
  private emit(patch: Partial<CaptionState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((l) => l(this.state)); }

  get fontScale(): number { return fontScaleFor(this.system); }

  setViewer(viewer: ViewerPreferences): void {
    const pick = (v: ViewerPreferences) => JSON.stringify([v.mode, v.reducedMotion, v.wordHighlight !== false, v.deliveryTypography !== false]);
    if (pick(viewer) === pick(this.viewer)) return;
    this.viewer = viewer; this.rebuild();
  }
  setSystem(system: SystemCaptionPreferences): void {
    if (JSON.stringify(system) === JSON.stringify(this.system)) return;
    this.system = system; this.rebuild();
  }

  /** Pass 1 for the current mode, then rebuild the native track. */
  private rebuild(): void {
    const mode = this.viewer.mode;
    const caps = mode === "detailed" ? OVERLAY_CAPABILITIES : NATIVE_VEGA_CAPABILITIES;
    this.eligible = resolveTrack(this.cues, this.profile, {
      viewer: this.viewer, system: this.system, capabilities: caps,
      onError: (id, e) => devLog(`[resolver] cue ${id} failed: ${String(e)}`),
    });
    // Native cue set: Standard and Speaker-aware are rendered by the platform, so lanes are decided
    // once per cue at the current system caption size (simultaneous cues are laid out together).
    // Protected regions for the native path come from each cue's own shot.
    const laid = mode === "standard" ? [] : resolveAlone(this.eligible, { fontScale: this.fontScale }, (e) => this.protectedAt(e.startMs));
    const next: NativeCue[] = this.eligible.flatMap((e) => {
      const r = laid.find((x) => x.cueId === e.cueId);
      const raw = this.deps.nativeMarkup && mode === "standard" ? this.cues.find((c) => c.id === e.cueId)?.rawText : undefined;
      // Speaker-aware on the platform renderer: colour attribution through the WebVTT colour classes the
      // renderer honours (FL-022), only while the viewer has left text colour at the default so their
      // own setting always wins. Class names follow the standard set; CI mains map onto five of them.
      const cls = mode === "speaker-aware" && (!this.system.textColor || this.system.textColor === "default") ? nativeColorClass(this.speakerTokenFor(e.cueId)) : undefined;
      const label = mode === "standard" ? undefined : r?.speakerLabel;
      const plain = label ? `${label}\n${e.text}` : e.text;
      const settings = mode !== "standard" && r ? laneToCueSettings(r.lane) : undefined;
      const leadStart = this.deps.nativeLeadMs ?? NATIVE_LEAD_START_MS;
      const leadWord = this.deps.nativeLeadMs ?? NATIVE_LEAD_WORD_MS;
      // A segment that begins at the cue start is a cue entry; later segments are word changes. Ends: a
      // segment ending at the cue end is the cue exit (start lead); an internal boundary uses the word lead.
      const make = (start: number, end: number, text: string, idSuffix = "") => {
        // Standard is the untouched track: no lead. The lead compensates the platform's event lag for the enhanced modes only.
        const ls = mode === "standard" ? 0 : start === e.startMs ? leadStart : leadWord;
        const le = mode === "standard" ? 0 : end === e.endMs ? leadStart : leadWord;
        const c = this.deps.makeCue(Math.max(0, start - ls) / 1000, Math.max(0, end - le) / 1000, text);
        c.id = e.cueId + idSuffix;
        if (settings) { c.line = settings.line; c.snapToLines = settings.snapToLines; c.position = settings.position; c.positionAlign = settings.positionAlign; c.align = settings.align; c.size = settings.size; }
        return c;
      };
      if (raw) return [make(e.startMs, e.endMs, raw)];
      if (!cls) return [make(e.startMs, e.endMs, plain)];
      // Word colouring on the native path: one native cue per word boundary (FL-022). Without verified
      // words this is a single cue with the whole text (label included, FL-023) in the colour span.
      const segs = nativeWordSegments(e.text, this.viewer.wordHighlight === false ? undefined : e.words, e.startMs, e.endMs, cls, label);
      return segs.map((sg, k) => make(sg.startMs, sg.endMs, sg.text, segs.length > 1 ? `#${k}` : ""));
    });
    for (const c of this.nativeCues) { try { this.deps.track.removeCue(c); } catch { /* gone */ } }
    this.nativeCues = [];
    for (const c of next) {
      try { this.deps.track.addCue(c); this.nativeCues.push(c); }
      catch (e) { devLog(`[track] addCue failed for ${c.id ?? "?"}: ${String(e)}`); }
    }
    this.deps.track.mode = mode === "detailed" ? "hidden" : "showing";
    if (mode === "speaker-aware") {
      const noClass = this.eligible.filter((e) => e.speakerToken && !nativeColorClass(e.speakerToken)).map((e) => `${e.cueId}:${e.speakerToken}`);
      if (noClass.length) devLog(`[mode] native colour unavailable for ${noClass.length} cue(s) (no WebVTT class for the token): ${noClass.slice(0, 6).join(" ")}`);
    }
    devLog(`[mode] ${mode} scale=${this.fontScale} ${laid.map(describe).join(" ") || "(canonical only)"}`);
    this.renderKey = "";
    this.emitOverlay({ mode, overlay: mode === "detailed" ? this.layoutNow() : [], nowMs: this.deps.now() });
  }

  private renderKey = "";

  /**
   * Word-level clock (Detailed only): called on animation frames with the anchored media-time
   * estimate. Re-lays out the overlay only when something visible changes: the active cue set,
   * the number of words spoken so far in an active cue, or an active sound event. Between those
   * boundaries nothing re-renders, so this costs a few string compares per frame.
   */
  tickAt(estMs: number): void {
    if (this.viewer.mode !== "detailed") return;
    const active = activeAt(this.eligible, estMs);
    // Syllable colouring (CI 2.2.2) needs ticks inside a word: while a longer timed word is being spoken, the key
    // advances every 80 ms so its syllable chunks colour on time rather than at the next word boundary.
    const inWord = active.some((c) => (c.words ?? []).some((w) => w.startMs <= estMs && estMs < w.endMs && w.endMs - w.startMs >= 350 && w.display.length >= 6));
    const key = active.map((c) => `${c.cueId}:${c.words ? c.words.filter((w) => w.startMs <= estMs).length : "-"}`).join("|")
      + (inWord ? `~${Math.floor(estMs / 80)}` : "")
      + "#" + activeSoundEvents(this.profile, estMs).map((e) => e.id).join(",");
    if (key === this.renderKey) return;
    const wordBoundary = this.renderKey.split("#")[0].split("|").map((k) => k.split(":")[0]).join("|") === active.map((c) => c.cueId).join("|");
    this.renderKey = key;
    if (wordBoundary) devLog(`[wordclock] est=${estMs.toFixed(0)} wall=${Date.now()} ${key}`);
    this.emitOverlay({ overlay: this.layoutNow(estMs), nowMs: estMs });
  }

  private speakerTokenFor(cueId: string) { return this.eligible.find((c) => c.cueId === cueId)?.speakerToken; }

  private laneCtxFor = (): { fontScale: number; protectedRegions: { x: number; y: number; w: number; h: number }[] } =>
    ({ fontScale: this.fontScale, protectedRegions: this.protectedAt(this.deps.now()) });

  private protectedAt(timeMs: number) {
    const shot = this.profile?.shots?.find((s) => s.startMs <= timeMs && timeMs < s.endMs);
    return shot?.protected ?? [];
  }

  /** Pass 2 for the cues active at `t` (Detailed overlay), plus verified sound events (schema 0.2). */
  private layoutNow(t: number = this.deps.now()): ResolvedCaption[] {
    const { laid, sfxStart } = this.layoutAt(t);
    this.pendingSfx = sfxStart;
    return laid;
  }
  private pendingSfx = new Map<string, number>();
  private emitOverlay(patch: Partial<CaptionState>): void { this.emit({ ...patch, sfxStart: this.pendingSfx }); }

  /** Pass 2 at `t` plus verified sound events; pure apart from lane continuity. */
  private layoutAt(t: number): { laid: ResolvedCaption[]; sfxStart: Map<string, number> } {
    const active = activeAt(this.eligible, t);
    // Lane continuity is scoped to the shot: a cut resets which side a speaker last held.
    const shotId = (this.profile?.shots ?? []).find((sh) => sh.startMs <= t && t < sh.endMs)?.id ?? null;
    if (shotId !== this.lastShotId) { this.previousLaneBySpeaker.clear(); this.lastShotId = shotId; }
    const laid = layoutActiveSet(active, { fontScale: this.fontScale, protectedRegions: this.protectedAt(t), previousLaneBySpeaker: this.previousLaneBySpeaker });
    for (const r of laid) { const src = active.find((a) => a.cueId === r.cueId); if (src?.speakerId && r.lane !== "bottom_center") this.previousLaneBySpeaker.set(src.speakerId, r.lane); }
    const sfxStart = new Map<string, number>();
    for (const ev of activeSoundEvents(this.profile, t)) {
      // A continuous score does not need a permanent label: music shows for four seconds after its onset and then
      // gives the bottom lane back to dialogue (UX review M4). Other sounds show for their whole duration.
      if (/\b(music|song|score|theme)\b/i.test(ev.label) && t - ev.startMs > 4000) continue;
      // Sound effects size with their measured level (CI 2.4.4) when the event carries one.
      const loud = typeof ev.loudDb === "number" ? (ev.loudDb >= 8 ? 2 : ev.loudDb >= 3 ? 1 : ev.loudDb <= -4 ? -1 : 0) : 0;
      laid.push({ cueId: `sfx:${ev.id}`, text: `[${ev.label}]`, lane: "bottom_center", stackIndex: 99, soundDirection: ev.direction, appliedFeatures: ["sound_direction"], fallbackReasons: [],
        ...(typeof ev.loudDb === "number" ? { delivery: { loud: loud as -1 | 0 | 1 | 2, loudDb: ev.loudDb, status: "verified" as const } as unknown as ResolvedCaption["delivery"] } : {}) });
      sfxStart.set(`sfx:${ev.id}`, ev.startMs);
    }
    return { laid, sfxStart };
  }

  /** Native cue change (also fires while the track is hidden). */
  private onCueChange(): void {
    const t = this.deps.now();
    // Rendered ids keep their "#k" segment suffix (native word colouring) so the sync report can score
    // word boundaries; the UI state gets the plain cue ids.
    const rawIds = Array.from(this.deps.track.activeCues ?? []).map((c) => c.id ?? "?");
    const ids = Array.from(new Set(rawIds.map((id) => id.split("#")[0])));
    syncLog({ event: "cuechange", mediaMs: t, expected: activeAt(this.eligible, t).map((c) => c.cueId).join(",") || "-", rendered: rawIds.join(",") || "-", mode: this.viewer.mode, lead: this.deps.nativeLeadMs ?? NATIVE_LEAD_START_MS });
    const overlay = this.viewer.mode === "detailed" ? this.layoutNow(t) : [];
    this.renderKey = "";
    this.emitOverlay({ overlay, lastActiveIds: ids, nowMs: t });
  }

  /** Called on play, pause, seeked, and mode change so the overlay never shows a stale cue. */
  recompute(reason: string): void {
    const t = this.deps.now();
    syncLog({ event: reason, mediaMs: t, expected: activeAt(this.eligible, t).map((c) => c.cueId).join(",") || "-", mode: this.viewer.mode });
    this.renderKey = "";
    this.emitOverlay({ overlay: this.viewer.mode === "detailed" ? this.layoutNow(t) : [], nowMs: t });
  }

  /** Expected active cue ids at a time (Measurement B uses this on animation frames). */
  expectedAt(timeMs: number): string[] { return activeAt(this.eligible, timeMs).map((c) => c.cueId); }

  dispose(): void {
    this.deps.track.oncuechange = null; this.listeners.clear();
    for (const c of this.nativeCues) { try { this.deps.track.removeCue(c); } catch { /* gone */ } }
    this.nativeCues = [];
  }
}
