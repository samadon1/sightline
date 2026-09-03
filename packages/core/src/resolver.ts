/**
 * Deterministic two-pass resolver (spec §11.4).
 *
 * Pass 1 (`resolveTrack`): for every canonical cue, decide which enhancements it is eligible
 * for given the companion profile, viewer mode, system preferences, runtime capabilities,
 * the reveal policy, the label-frequency rule, and the shot it falls in. Pass 1 is computed
 * once per (track, mode, prefs) and cached by the host.
 *
 * Pass 2 (`layoutActiveSet`): for the set of cues active at one media time, assign final lanes
 * against protected regions, estimated caption boxes at the current caption size, and each
 * other. Pass 2 runs at every cue change.
 *
 * Invariant: the canonical text is always emitted. An enhancement may disappear; the text may not.
 */

import type { CanonicalCue } from "./vtt.ts";
import { type Lane, type Rect, type LaneBox, estimateLaneBox, rectsOverlap, withinTitleSafe } from "./lanes.ts";
import { hashMatches } from "./hashes.ts";
import { visibleTokens, collapseRuns } from "./normalize.ts";
import { DEFAULT_LABEL_RULES, shouldShowLabel, speakerLabelAt, type LabelRuleConfig } from "./labels.ts";
import type {
  AppliedFeature,
  CompanionProfile,
  CueMeta,
  EligibleCue,
  FallbackReason,
  Mode,
  ResolvedCaption,
  RuntimeCapabilities,
  ShotDef,
  SpeakerDef,
  SystemCaptionPreferences,
  ViewerPreferences, ResolvedWord, LoudLevel, PaceLevel, SoundEvent,
} from "./types.ts";

export type ResolveOptions = {
  viewer: ViewerPreferences;
  system?: SystemCaptionPreferences;
  capabilities: RuntimeCapabilities;
  labelRules?: LabelRuleConfig;
  /** Voice-span speaker names → lane hint when no companion profile is present (compat rung). */
  voiceLaneHints?: Record<string, Lane>;
  /** Called when resolving one cue throws; the cue is emitted as Standard and later cues continue. */
  onError?: (cueId: string, error: unknown) => void;
};

/** The platform renderer honours WebVTT colour classes (FL-022), so speaker colour is available natively. */
export const NATIVE_VEGA_CAPABILITIES: RuntimeCapabilities = { positionedCues: true, speakerColor: true, staticEmphasis: false, wordTiming: true, deliveryTypography: false };
export const OVERLAY_CAPABILITIES: RuntimeCapabilities = { positionedCues: true, speakerColor: true, staticEmphasis: true, wordTiming: true, deliveryTypography: true };

const SOUND_RE = /^\s*[\[(].*[\])]\s*$/;

/** A cue whose whole visible text is bracketed is a sound/non-speech caption. */
export function isSoundCue(cue: CanonicalCue): boolean {
  return SOUND_RE.test(cue.plainText);
}

export function shotAt(shots: ShotDef[] | undefined, timeMs: number): ShotDef | undefined {
  if (!shots) return undefined;
  return shots.find((s) => s.startMs <= timeMs && timeMs < s.endMs);
}

/** Map system text size to the estimator's font scale. Values mirror Vega CaptionTextSize. */
export function fontScaleFor(system?: SystemCaptionPreferences): number {
  switch ((system?.textSize ?? "normal").toLowerCase()) {
    case "very_small": return 0.6;
    case "small": return 0.8;
    case "large": return 1.5;
    case "very_large": return 2.0;
    default: return 1.0;
  }
}

function overlapsDialogue(cues: CanonicalCue[], i: number, soundFlags: boolean[]): boolean {
  const c = cues[i];
  for (let j = 0; j < cues.length; j++) {
    if (j === i || soundFlags[j]) continue;
    const o = cues[j];
    if (o.startMs < c.endMs && c.startMs < o.endMs) return true;
  }
  return false;
}

/**
 * Pass 1: eligibility per cue, in track order (label decisions depend on the previous cue).
 * Never throws: a cue whose resolution fails is emitted as plain canonical text.
 */
export function resolveTrack(cues: CanonicalCue[], profile: CompanionProfile | null | undefined, opts: ResolveOptions): EligibleCue[] {
  const rules = opts.labelRules ?? DEFAULT_LABEL_RULES;
  const mode = opts.viewer.mode;
  const out: EligibleCue[] = [];
  const soundFlags = cues.map(isSoundCue);
  let prev: { speakerId?: string; endMs: number; shotId?: string; labelShown: boolean; fellBack: boolean; label?: string } | undefined;

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const base: EligibleCue = {
      cueId: cue.id, startMs: cue.startMs, endMs: cue.endMs, text: cue.plainText,
      candidateLanes: ["bottom_center"], isSound: soundFlags[i], appliedFeatures: [], fallbackReasons: [],
    };
    try {
      if (mode === "standard") { base.fallbackReasons.push("mode_standard"); out.push(base); continue; }

      const shot = shotAt(profile?.shots, cue.startMs);
      base.shotId = shot?.id;
      const meta: CueMeta | undefined = profile?.cues?.[cue.id];
      let speakerDef: SpeakerDef | undefined;
      let speakerId: string | undefined;
      let verified = false;

      if (!profile) base.fallbackReasons.push("metadata_missing");
      else if (!meta) base.fallbackReasons.push("metadata_missing");
      else if (meta.status !== "verified") base.fallbackReasons.push("metadata_unverified");
      // A cue's status is a person's call: a rule may verify words, measurements and sound events, never the cue itself.
      else if (typeof meta.verifiedBy === "string" && meta.verifiedBy.startsWith("auto:")) base.fallbackReasons.push("metadata_unverified");
      else if (!hashMatches(meta.textHash, cue.rawText)) base.fallbackReasons.push("canonical_mismatch");
      else verified = true;

      if (verified && meta?.speakers?.length === 2) {
        const defs = meta.speakers.map((id) => profile?.speakers?.[id]);
        if (defs.every(Boolean)) {
          const labels = defs.map((d, k) => speakerLabelAt(d!, cue.startMs)).map((x) => x.label);
          speakerDef = { label: `${labels[0]}, then ${labels[1]}`, color: defs[0]!.color };
          speakerId = `pair:${meta.speakers.join("+")}`;
        } else base.fallbackReasons.push("speaker_unknown");
      } else if (verified && meta?.speaker) {
        const def = profile?.speakers?.[meta.speaker];
        if (def) { speakerDef = def; speakerId = meta.speaker; }
        else base.fallbackReasons.push("speaker_unknown");
      }
      // Compatibility rung: a <v Name> span is a canonical claim of the speaker's name.
      if (!speakerDef && cue.voice && !base.isSound) {
        speakerId = `voice:${cue.voice}`;
        speakerDef = { label: cue.voice.toUpperCase() };
        // The companion could not supply the speaker (missing, unverified or unknown id); the <v> span did.
        if (profile && meta && !base.fallbackReasons.includes("speaker_unknown")) base.fallbackReasons.push("speaker_unavailable");
      }
      base.speakerId = speakerId;

      // Label with reveal policy and frequency rule.
      let labelText: string | undefined;
      let offScreen = false;
      if (speakerDef) {
        const at = speakerLabelAt(speakerDef, cue.startMs);
        labelText = at.label;
        if (!at.revealed) base.fallbackReasons.push("reveal_pending");
        // Off camera comes from flags (speaker or verified cue) or an unrevealed generic label. The wording test applies
        // only to the compatibility rung, where a <v> span such as "Unknown voice" is the sole information; a companion
        // character named "Voice" is not italic for their name.
        const compat = (speakerId ?? "").startsWith("voice:");
        offScreen = (compat && /UNKNOWN|VOICE|PHONE|RADIO|OUTSIDE|OFF[- ]SCREEN/i.test(labelText)) || !at.revealed || speakerDef.offScreen === true || (verified && meta?.offScreen === true);
        base.offScreen = offScreen;
        const decision = shouldShowLabel({
          speakerId, isSound: base.isSound, startMs: cue.startMs, shotId: shot?.id,
          overlaps: overlapsDialogue(cues, i, soundFlags), offScreen,
          labelChanged: prev?.speakerId === speakerId && prev?.label !== undefined && prev.label !== labelText,
          prev,
        }, rules);
        // A professionally authored track may already carry a bracketed id in the text ("[unknown voice] ...").
        // Never double-label: the canonical text wins and the enhancement label is suppressed.
        const canonicalId = /^\s*\[([^\]]+)\]/.exec(cue.plainText)?.[1]?.trim().toLowerCase();
        if (canonicalId && canonicalId === labelText.toLowerCase()) base.fallbackReasons.push("canonical_id_present");
        else if (decision.show) { base.speakerLabel = labelText; base.appliedFeatures.push("speaker_label"); }
        else { base.fallbackReasons.push("label_suppressed_by_rule"); base.suppressedLabel = labelText; }
        if (speakerDef.color) {
          if (opts.capabilities.speakerColor) { base.speakerToken = speakerDef.color; base.appliedFeatures.push("speaker_color"); }
          else base.fallbackReasons.push("color_unsupported");
        }
      }

      // Candidate lanes: verified companion lanes, else voice-span hint, else bottom.
      let lanes: Lane[] = [];
      // Placement is an enhancement too: a cue whose speaker id is unknown keeps only the bottom lane (UX review M6).
      if (verified && meta?.lanes?.length && !base.fallbackReasons.includes("speaker_unknown")) lanes = [...meta.lanes];
      else if (cue.voice && opts.voiceLaneHints?.[cue.voice]) lanes = [opts.voiceLaneHints[cue.voice]];
      if (!opts.capabilities.positionedCues) { lanes = []; base.fallbackReasons.push("lane_unavailable"); }
      if (!lanes.includes("bottom_center")) lanes.push("bottom_center");
      base.candidateLanes = lanes;

      // Static emphasis (Detailed only, verified only, capability required).
      if (verified && meta?.emphasis?.length) {
        if (mode !== "detailed" || !opts.capabilities.staticEmphasis) base.fallbackReasons.push("emphasis_unsupported");
        else {
          const n = visibleTokens(cue.rawText).length;
          const valid = meta.emphasis.filter((e) => Number.isInteger(e.tokenIndex) && e.tokenIndex >= 0 && e.tokenIndex < n);
          if (valid.length !== meta.emphasis.length) base.fallbackReasons.push("emphasis_invalid");
          if (valid.length) { base.staticEmphasis = valid; base.appliedFeatures.push("static_emphasis"); }
        }
      }

      // Word timing and per-word delivery (schema 0.2; Detailed only, verified only, capability + viewer toggle).
      if (meta?.words?.length) {
        if (!verified) base.fallbackReasons.push("words_unverified");
        else if (mode === "standard" || !opts.capabilities.wordTiming) base.fallbackReasons.push("word_timing_unsupported");
        else if (opts.viewer.wordHighlight === false) base.fallbackReasons.push("word_timing_off");
        else {
          const tokens = visibleTokens(cue.rawText);
          const typo = opts.viewer.deliveryTypography !== false && !!opts.capabilities.deliveryTypography;
          const words: ResolvedWord[] = [];
          let invalid = false;
          let unverified = false;
          for (const w of meta.words) {
            if (w.status !== "verified") { unverified = true; continue; } // absent status is not verified
            const ok = Number.isInteger(w.i) && w.i >= 0 && w.i < tokens.length && Number.isInteger(w.startMs) && Number.isInteger(w.endMs) && w.startMs <= w.endMs
              && w.startMs >= cue.startMs - 50 && w.endMs <= cue.endMs + 50;
            if (!ok) { invalid = true; continue; }
            const stretchOk = typeof w.stretch === "string" && collapseRuns(w.stretch) === collapseRuns(tokens[w.i]);
            let display = stretchOk && typo ? w.stretch! : tokens[w.i];
            if (w.caps && typo) display = display.toUpperCase();
            const rw: ResolvedWord = { i: w.i, startMs: w.startMs, endMs: w.endMs, loud: typo ? (w.loud ?? 0) : 0, pitch: typo ? (w.pitch ?? 0) : 0, display };
            if (typo && typeof w.loudDb === "number") rw.loudDb = w.loudDb;
            if (typo && (w.width === -1 || w.width === 0 || w.width === 1)) rw.width = w.width;
            words.push(rw);
            if (stretchOk && typo && !base.appliedFeatures.includes("word_stretch")) base.appliedFeatures.push("word_stretch");
            if (w.caps && typo && !base.appliedFeatures.includes("word_caps")) base.appliedFeatures.push("word_caps");
          }
          if (invalid) base.fallbackReasons.push("words_invalid");
          if (unverified) base.fallbackReasons.push("words_unverified");
          if (words.length) { base.words = words; base.appliedFeatures.push("word_timing"); }
        }
      }
      if (meta?.delivery) {
        const d = meta.delivery;
        if (!verified || d.status !== "verified") base.fallbackReasons.push("delivery_unverified"); // absent status is not verified
        else if (mode !== "detailed" || !opts.capabilities.deliveryTypography) base.fallbackReasons.push("delivery_unsupported");
        else if (opts.viewer.deliveryTypography === false) base.fallbackReasons.push("delivery_off");
        else {
          const loud = ([-1, 0, 1, 2] as number[]).includes(d.loud ?? 0) ? (d.loud ?? 0) : 0;
          const pace = ([-1, 0, 1] as number[]).includes(d.pace ?? 0) ? (d.pace ?? 0) : 0;
          base.delivery = { loud: loud as LoudLevel, pace: pace as PaceLevel, manner: typeof d.manner === "string" && d.manner.trim() ? d.manner.trim() : undefined };
          if (typeof d.loudDb === "number") base.delivery.loudDb = d.loudDb;
          if (d.width === -1 || d.width === 0 || d.width === 1) base.delivery.width = d.width;
          base.appliedFeatures.push("delivery");
        }
      }

      // Directional sound (Detailed only; the sound text itself is canonical and always shown).
      if (meta?.sound) {
        if (verified && mode === "detailed") { base.soundDirection = meta.sound.direction; base.appliedFeatures.push("sound_direction"); }
        else base.fallbackReasons.push("sound_direction_unverified");
      }

      out.push(base);
      if (!base.isSound) prev = { speakerId, endMs: cue.endMs, shotId: shot?.id, labelShown: !!base.speakerLabel, fellBack: base.fallbackReasons.some((r) => r === "canonical_mismatch" || r === "metadata_unverified"), label: labelText };
    } catch (e) {
      opts.onError?.(cue.id, e);
      out.push({ ...base, candidateLanes: ["bottom_center"], appliedFeatures: [], fallbackReasons: [...base.fallbackReasons, "resolver_exception"] });
      // The failed cue lost its speaker context, so the next cue must re-establish its label.
      if (!base.isSound) prev = { speakerId: undefined, endMs: cue.endMs, shotId: undefined, labelShown: false, fellBack: true };
    }
  }
  return out;
}

export type LayoutContext = {
  /** Estimator scale at the current system caption size. */
  fontScale: number;
  protectedRegions?: Rect[];
  /** Previous lane per speaker id within the current shot, for continuity. */
  previousLaneBySpeaker?: Map<string, Lane>;
};

/** Font scale applied for a loudness level (schema 0.2): quiet 0.85, normal 1, loud 1.15, shouted 1.3. */
export function deliveryFontScale(loud: LoudLevel | undefined): number {
  switch (loud) { case -1: return 0.85; case 1: return 1.15; case 2: return 1.3; default: return 1; }
}

/**
 * Caption with Intention 2.3.5/2.3.6 as a continuous mapping: type height as a fraction of the screen,
 * 5% at the scene's speech median, 3% at -8 dB and below, 12% at +14 dB and above, linear between.
 * Falls back to the quantised level when no measurement is present.
 */
export function heightPctForLoudness(loud: LoudLevel | undefined, loudDb: number | undefined): number {
  if (typeof loudDb === "number" && Number.isFinite(loudDb)) {
    // Baseline 7% of the height rather than Caption with Intention's 5%: the design system assumes a cinema
    // seat, and Fire TV's own "normal" caption line is about 9.5%, so 5% left Detailed smaller than the TV's
    // captions (UX review H3). The range keeps the same shape: whisper 4.5%, shout 13%.
    if (loudDb <= 0) return Math.max(0.045, 0.07 + (loudDb / 8) * 0.025);
    return Math.min(0.13, 0.07 + (loudDb / 14) * 0.06);
  }
  switch (loud) { case -1: return 0.045; case 1: return 0.10; case 2: return 0.13; default: return 0.07; }
}

/** The largest loudness a cue renders at (cue level or any word), for the lane budget. */
export function maxLoud(c: { delivery?: { loud: LoudLevel }; words?: ResolvedWord[] }): LoudLevel {
  let m: LoudLevel = c.delivery?.loud ?? 0;
  for (const w of c.words ?? []) if (w.loud > m) m = w.loud;
  return m;
}

function estimate(c: EligibleCue, lane: Lane, fontScale: number): LaneBox {
  const lines = c.text.split("\n");
  const labelLines = c.speakerLabel ? 1 : 0;
  // Stretched words make lines longer; size follows the loudest level in the cue.
  const extra = (c.words ?? []).reduce((n, w) => n + Math.max(0, w.display.length - (c.text.split(/\s+/)[w.i]?.length ?? 0)), 0);
  const maxChars = Math.max(...lines.map((l) => l.length)) + extra;
  return estimateLaneBox(lane, lines.length + labelLines, maxChars, fontScale * deliveryFontScale(maxLoud(c)), labelLines);
}

/** Verified sound events active at `timeMs` (Detailed only). Never throws. */
export function activeSoundEvents(profile: CompanionProfile | null | undefined, timeMs: number): SoundEvent[] {
  try {
    return (profile?.sounds ?? []).filter((ev) => ev && ev.status === "verified" && typeof ev.label === "string" && ev.startMs <= timeMs && timeMs < ev.endMs);
  } catch { return []; }
}

/**
 * Pass 2: assign final lanes to the set of cues active right now.
 * Deterministic: cues are processed in start-time order; the first cue claims its preferred lane,
 * later cues avoid it. Two dialogue cues that cannot both hold side lanes are bottom-stacked
 * with labels forced on (spec §9.5).
 */
export function layoutActiveSet(active: EligibleCue[], ctx: LayoutContext): ResolvedCaption[] {
  const ordered = [...active].sort((a, b) => a.startMs - b.startMs || a.cueId.localeCompare(b.cueId));
  // Occupancy is time-aware: a box only blocks cues that are on screen at the same time, so a chain of
  // overlaps (A–B, B–C, A and C disjoint) does not make A and C avoid each other.
  const occupied: Array<{ box: Rect; startMs: number; endMs: number }> = [];
  const overlapsInTime = (a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }) => a.startMs < b.endMs && b.startMs < a.endMs;
  const results: ResolvedCaption[] = [];
  const dialogue = ordered.filter((c) => !c.isSound);
  // Bottom-stack rule (spec §9.5) applies when more than two dialogue cues are on screen at once, not
  // when a chain of overlaps happens to be laid out together.
  // True concurrency: the most dialogue cues active at any one instant (checked at every cue start).
  const maxConcurrentDialogue = dialogue.reduce((m, c) => Math.max(m, dialogue.filter((o) => o.startMs <= c.startMs && c.startMs < o.endMs).length), 0);
  const forceBottomStack = maxConcurrentDialogue > 2;

  for (const c of ordered) {
    const applied = [...c.appliedFeatures];
    const reasons = [...c.fallbackReasons];
    let lane: Lane = "bottom_center";
    let chosen = false;

    if (!forceBottomStack) {
      // Continuity first: keep the speaker's previous lane in this shot if it is still a candidate.
      const prevLane = c.speakerId ? ctx.previousLaneBySpeaker?.get(c.speakerId) : undefined;
      const order = prevLane && c.candidateLanes.includes(prevLane) ? [prevLane, ...c.candidateLanes.filter((l) => l !== prevLane)] : c.candidateLanes;
      for (const cand of order) {
        if (cand === "bottom_center") break;
        const box = estimate(c, cand, ctx.fontScale);
        // Side lanes hold a label plus up to two dialogue lines, and never more than 35% of the height.
        if (box.wrappedLines > (c.speakerLabel ? 3 : 2) || box.h > 0.35) { reasons.push("size_rejected"); continue; }
        if (!withinTitleSafe(box)) { reasons.push("size_rejected"); continue; }
        if (ctx.protectedRegions?.some((p) => rectsOverlap(box, p))) { reasons.push("protected_region"); continue; }
        if (occupied.some((o) => overlapsInTime(o, c) && rectsOverlap(box, o.box))) { reasons.push("collision"); continue; }
        lane = cand; chosen = true; occupied.push({ box, startMs: c.startMs, endMs: c.endMs }); break;
      }
    }
    if (!chosen) {
      if (c.candidateLanes.some((l) => l !== "bottom_center")) reasons.push("no_safe_lane");
    } else applied.push("lane");

    // Colour never carries identification alone (docs/accessibility-decisions.md): a coloured cue that lost
    // its label to the frequency rule and has no side lane gets the label back.
    let speakerLabel = c.speakerLabel;
    if (c.speakerToken && !speakerLabel && lane === "bottom_center" && c.suppressedLabel) {
      speakerLabel = c.suppressedLabel;
      if (!applied.includes("speaker_label")) applied.push("speaker_label");
      const k = reasons.indexOf("label_suppressed_by_rule"); if (k >= 0) reasons.splice(k, 1);
    }
    results.push({
      cueId: c.cueId, text: c.text, speakerLabel, speakerToken: c.speakerToken, lane,
      staticEmphasis: c.staticEmphasis, soundDirection: chosen ? c.soundDirection : undefined,
      offScreen: c.offScreen, words: c.words, delivery: c.delivery,
      appliedFeatures: applied, fallbackReasons: Array.from(new Set(reasons)),
    });
    if (c.soundDirection && !chosen && !results[results.length - 1].fallbackReasons.includes("no_safe_lane")) results[results.length - 1].fallbackReasons.push("no_safe_lane");
  }

  // Bottom stacking: everything that landed in bottom_center is stacked in reading order, and
  // when two dialogue cues share the bottom their labels are forced on so attribution survives.
  const bottom = results.filter((r) => r.lane === "bottom_center");
  if (bottom.length > 1) {
    bottom.forEach((r, i) => { r.stackIndex = i; });
    const bottomDialogue = bottom.filter((r) => !active.find((a) => a.cueId === r.cueId)?.isSound);
    if (bottomDialogue.length > 1) {
      for (const r of bottomDialogue) {
        const src = active.find((a) => a.cueId === r.cueId)!;
        if (!r.speakerLabel && src.speakerId) {
          r.speakerLabel = labelFallbackFor(src);
          if (r.speakerLabel && !r.appliedFeatures.includes("speaker_label")) r.appliedFeatures.push("speaker_label");
        }
      }
    }
  }
  return results;
}

/** When a label was suppressed by the frequency rule but stacking needs it, recover a label from the speaker id. */
function labelFallbackFor(c: EligibleCue): string | undefined {
  if (c.speakerLabel) return c.speakerLabel;
  if (c.speakerId?.startsWith("voice:")) return c.speakerId.slice(6).toUpperCase();
  return undefined;
}

/** Convenience: cues active at `timeMs` from a pass-1 list (start inclusive, end exclusive). */
export function activeAt(eligible: EligibleCue[], timeMs: number): EligibleCue[] {
  return eligible.filter((c) => c.startMs <= timeMs && timeMs < c.endMs);
}

/** Convenience for hosts that pre-resolve the whole track as if every cue were alone (native cue creation). */
export function resolveAlone(
  eligible: EligibleCue[],
  ctx: LayoutContext,
  /** Protected regions in force when a cue starts (its shot). Overrides ctx.protectedRegions per group. */
  protectedFor?: (cue: EligibleCue) => Rect[],
): ResolvedCaption[] {
  // Group by overlapping time so simultaneous cues are laid out together, then flatten.
  // Groups are connected components of the overlap graph (A–B and B–C overlapping puts A, B and C in one
  // group even when A and C are disjoint), so occupancy is shared across the whole chain.
  const sorted = [...eligible].sort((a, b) => a.startMs - b.startMs || a.cueId.localeCompare(b.cueId));
  const groups: EligibleCue[][] = [];
  let cur: EligibleCue[] = []; let curEnd = -1;
  for (const c of sorted) {
    if (cur.length && c.startMs < curEnd) { cur.push(c); curEnd = Math.max(curEnd, c.endMs); }
    else { if (cur.length) groups.push(cur); cur = [c]; curEnd = c.endMs; }
  }
  if (cur.length) groups.push(cur);
  const results: ResolvedCaption[] = [];
  for (const group of groups) {
    const groupCtx = protectedFor ? { ...ctx, protectedRegions: protectedFor(group[0]) } : ctx;
    results.push(...layoutActiveSet(group, groupCtx));
  }
  return results;
}

/** Feature list helper for logs and diagnostics. */
export function describe(r: ResolvedCaption): string {
  return `${r.cueId}:${r.lane}${r.speakerLabel ? `[${r.speakerLabel}]` : ""}${r.fallbackReasons.length ? `!${r.fallbackReasons.join("|")}` : ""}`;
}

export type { AppliedFeature, FallbackReason, Mode };

/**
 * Native word colouring (FL-022): split one cue into consecutive native cues, one per word boundary,
 * each carrying the text with the words spoken so far wrapped in a colour-class span. Untimed tokens
 * follow their neighbours. Whitespace and line breaks of `text` are preserved.
 */
export function nativeWordSegments(text: string, words: ResolvedWord[] | undefined, startMs: number, endMs: number, cls: string, label?: string): Array<{ startMs: number; endMs: number; text: string }> {
  const parts = text.split(/(\s+)/); // tokens at even indexes, separators at odd
  const tokenCount = parts.filter((_, k) => k % 2 === 0 && parts[k].length > 0).length;
  const timed = (words ?? []).filter((w) => w.startMs >= startMs && w.startMs < endMs).sort((a, b) => a.startMs - b.startMs);
  // After the last timed word has ended, any remaining untimed tokens count as spoken: the line finishes
  // coloured instead of stopping at the last word the aligner could place.
  const lastEnd = timed.length ? Math.max(...timed.map((w) => w.endMs)) : -1;
  const untimedTail = timed.length > 0 && Math.max(...timed.map((w) => w.i)) < tokenCount - 1;
  const tailStart = untimedTail && lastEnd > startMs && lastEnd < endMs ? [lastEnd] : [];
  const bounds = [...new Set([startMs, ...timed.map((w) => w.startMs).filter((t) => t > startMs), ...tailStart, endMs])].sort((a, b) => a - b);
  const render = (spokenUpTo: number) => {
    let ti = 0; let out = "";
    let open = false;
    const head = label ? `${label}\n` : "";
    // Before the first word (read-ahead), the label alone carries the colour: attribution is immediate, the words are not.
    // The label span closes before the line break, so no span starts after it (FL-023).
    if (spokenUpTo >= 0) { out += `<c.${cls}>` + head; open = true; } else out += label ? `<c.${cls}>${label}</c>\n` : "";
    for (let k = 0; k < parts.length; k++) {
      if (k % 2 === 1) {
        // Close the span before the whitespace that precedes the first unspoken token.
        if (open && ti > spokenUpTo) { out += "</c>"; open = false; }
        out += parts[k]; continue;
      }
      if (!parts[k]) continue;
      if (open && ti > spokenUpTo) { out += "</c>"; open = false; }
      out += parts[k]; ti++;
    }
    if (open) out += "</c>";
    return out;
  };
  const segs: Array<{ startMs: number; endMs: number; text: string }> = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    const t = bounds[k];
    // Highest token index whose verified timing has started, then untimed tokens before it are spoken too.
    let spokenUpTo = timed.length ? -1 : tokenCount - 1; // no timings: colour the whole cue (attribution only)
    for (const w of timed) if (w.startMs <= t && w.i > spokenUpTo) spokenUpTo = w.i;
    if (timed.length && t >= lastEnd) spokenUpTo = tokenCount - 1;
    if (spokenUpTo >= tokenCount) spokenUpTo = tokenCount - 1;
    segs.push({ startMs: t, endMs: bounds[k + 1], text: render(spokenUpTo) });
  }
  return segs;
}
