/**
 * Caption runtime bridge for the Vega player.
 *
 * Turns canonical cues (from @sightline-wip/core) into native VTTCue objects for the
 * current mode, and rebuilds the text track when the mode or the system caption size
 * changes. Pure logic: the VTTCue/TextTrack constructors are injected so this file can
 * be unit-tested in Node and run unchanged inside React Native for Vega.
 *
 * Level 1 Standard      → cues with no position settings (native bottom placement)
 * Level 2 Speaker-aware → label line + lane position settings (still native)
 * Level 3 Detailed      → native track hidden; overlay reads `resolved` (not in this file)
 */

import {
  type CanonicalCue,
  type Lane,
  type CueSettings,
  laneToCueSettings,
  estimateLaneBox,
  chooseLane,
} from "@sightline-wip/core";

export type Mode = "standard" | "speaker-aware" | "detailed";

/** Minimal shape of the W3C VTTCue we set. Matches Vega's documented fields. */
export type NativeCue = {
  id?: string;
  startTime: number;
  endTime: number;
  text: string;
  line?: number;
  snapToLines?: boolean;
  position?: number;
  positionAlign?: CueSettings["positionAlign"];
  align?: CueSettings["align"];
  size?: number;
};

export type NativeTrack = {
  mode: "disabled" | "hidden" | "showing";
  addCue(cue: NativeCue): void;
  removeCue(cue: NativeCue): void;
  cues?: ArrayLike<NativeCue> | null;
};

export type SpeakerLaneMap = Record<string, Lane>;

export type ResolvedCue = {
  cue: CanonicalCue;
  lane: Lane;
  label?: string;
  text: string;
  fallbackReason?: string;
};

export type RuntimeOptions = {
  /** Voice name → lane, e.g. { Maya: "lower_left", Daniel: "lower_right" }. */
  speakerLanes: SpeakerLaneMap;
  /** Multiplier derived from the system CaptionTextSize; 1 = default. */
  fontScale: number;
  /** Label the first cue of a speaker run only (BBC/Netflix convention). Default true. */
  labelOnChangeOnly?: boolean;
};

/** Resolve every cue for a mode. Deterministic; no I/O. */
export function resolveAll(cues: CanonicalCue[], mode: Mode, opts: RuntimeOptions): ResolvedCue[] {
  const labelOnChange = opts.labelOnChangeOnly ?? true;
  const out: ResolvedCue[] = [];
  let lastVoice: string | undefined;

  for (const cue of cues) {
    if (mode === "standard") {
      out.push({ cue, lane: "bottom_center", text: cue.plainText });
      continue;
    }

    const voice = cue.voice;
    const wantLabel = !!voice && (!labelOnChange || voice !== lastVoice);
    const label = wantLabel ? voice!.toUpperCase() : undefined;
    lastVoice = voice ?? lastVoice;

    const lines = cue.plainText.split("\n");
    const labelLines = label ? 1 : 0;
    const lineCount = lines.length + labelLines;
    const maxChars = Math.max(...lines.map((l) => l.length));

    const preferred: Lane[] = voice && opts.speakerLanes[voice]
      ? [opts.speakerLanes[voice], "bottom_center"]
      : ["bottom_center"];

    // Simultaneous cues already placed in this pass occupy their boxes.
    const occupied = out
      .filter((r) => r.cue.startMs < cue.endMs && cue.startMs < r.cue.endMs && r.lane !== "bottom_center")
      .map((r) => estimateLaneBox(r.lane, 2, 24, opts.fontScale, 1));

    const pick = chooseLane(
      preferred,
      (lane) => estimateLaneBox(lane, lineCount, maxChars, opts.fontScale, labelLines),
      [],
      occupied,
    );

    out.push({
      cue,
      lane: pick.lane,
      label,
      text: label ? `${label}\n${cue.plainText}` : cue.plainText,
      fallbackReason: pick.reason,
    });
  }
  return out;
}

/** Build the native cue objects for a mode. `make` is the VTTCue constructor. */
export function toNativeCues(
  resolved: ResolvedCue[],
  mode: Mode,
  make: (start: number, end: number, text: string) => NativeCue,
): NativeCue[] {
  return resolved.map((r) => {
    const c = make(r.cue.startMs / 1000, r.cue.endMs / 1000, r.text);
    c.id = r.cue.id;
    if (mode !== "standard") {
      const s = laneToCueSettings(r.lane);
      c.line = s.line;
      c.snapToLines = s.snapToLines;
      c.position = s.position;
      c.positionAlign = s.positionAlign;
      c.align = s.align;
      c.size = s.size;
    }
    return c;
  });
}

/** Replace every cue on a track. Keeps the track's mode as-is. */
export function replaceTrackCues(track: NativeTrack, next: NativeCue[], previous: NativeCue[]): void {
  for (const c of previous) {
    try { track.removeCue(c); } catch { /* already gone */ }
  }
  for (const c of next) track.addCue(c);
}

/** Map Vega CaptionTextSize enum values to a font scale. Calibrate in Gate 1. */
export function fontScaleFromTextSize(textSize: string | undefined): number {
  switch ((textSize ?? "").toLowerCase()) {
    case "very_small": case "verysmall": return 0.6;
    case "small": return 0.8;
    case "large": return 1.5;
    case "very_large": case "verylarge": case "largest": return 2.0;
    default: return 1.0;
  }
}
