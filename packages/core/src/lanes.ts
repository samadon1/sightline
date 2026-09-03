/**
 * Stable caption lanes and their mapping onto WebVTT cue settings.
 *
 * The native Vega renderer (KeplerCaptionsView) honors VTTCue position settings and
 * places cues at the bottom when none are given. Lanes are therefore expressed as
 * cue settings so that Level 2 (Speaker-aware) can render natively with no custom
 * synchronization code. The custom overlay (Level 3) uses the same lane names and
 * maps them to normalized rectangles instead.
 *
 * Coordinates follow WebVTT: `line` and `position` are percentages of the viewport;
 * `position` is the horizontal anchor, `align` sets which edge anchors to it.
 * Exact numbers are a starting point for Gate 1 and are expected to be tuned on
 * the virtual device and a real Fire TV.
 */

export type Lane = "bottom_center" | "lower_left" | "lower_right";

export const LANES: readonly Lane[] = ["bottom_center", "lower_left", "lower_right"] as const;

export function isLane(x: unknown): x is Lane {
  return typeof x === "string" && (LANES as readonly string[]).includes(x);
}

/** Subset of VTTCue fields the runtime sets. Mirrors the W3C VTTCue interface. */
export type CueSettings = {
  line: number;          // percentage when snapToLines is false
  snapToLines: false;
  position: number;      // percentage
  positionAlign: "line-left" | "center" | "line-right";
  align: "start" | "center" | "end";
  size: number;          // percentage of viewport width
};

/** Title-safe insets as a fraction of the viewport (TV convention: ~5% each side). */
export const TITLE_SAFE = { x: 0.05, y: 0.05 } as const;

const LANE_SETTINGS: Record<Lane, CueSettings> = {
  bottom_center: { line: 90, snapToLines: false, position: 50, positionAlign: "center",     align: "center", size: 80 },
  lower_left:    { line: 85, snapToLines: false, position: 8,  positionAlign: "line-left",  align: "start",  size: 42 },
  lower_right:   { line: 85, snapToLines: false, position: 92, positionAlign: "line-right", align: "end",    size: 42 },
};

export function laneToCueSettings(lane: Lane): CueSettings {
  return { ...LANE_SETTINGS[lane] };
}

/** Normalized rect (0..1) of a lane's box, for the custom overlay and collision checks. */
export type Rect = { x: number; y: number; w: number; h: number };

export type LaneBox = Rect & {
  /** Rendered line count after wrapping into the lane width. */
  wrappedLines: number;
};

/**
 * Approximate the box a caption will occupy in a lane. The native renderer does not
 * expose measured bounds, so this is an estimate from character count, line count,
 * and a font scale. When the text needs more width than the lane allows, it is
 * assumed to wrap, which grows the box vertically. Conservative by design.
 *
 * @param lineCount  authored lines (label line included when present)
 * @param maxChars   longest authored dialogue line length in characters
 * @param fontScale  1.0 = default TV caption size; larger for bigger system sizes
 * @param labelLines how many of lineCount are speaker-label lines (do not wrap)
 */
export function estimateLaneBox(lane: Lane, lineCount: number, maxChars: number, fontScale = 1, labelLines = 0): LaneBox {
  // Calibrated on the Vega Virtual Device (SDK 0.24, CaptionTextSize "normal"), September 1, 2026:
  // a native caption line is ~9.5% of viewport height and ~1.74% of viewport width per character.
  const charW = 0.0174 * fontScale;
  const lineH = 0.095 * fontScale;
  const pad = 0.01;
  const s = LANE_SETTINGS[lane];
  const laneW = s.size / 100;
  const needed = maxChars * charW + pad * 2;
  const wrapFactor = Math.max(1, Math.ceil(needed / laneW));
  // Only dialogue lines wrap; a speaker label is short and stays on one line.
  const wrappedLines = labelLines + (lineCount - labelLines) * wrapFactor;
  const w = Math.min(laneW, needed);
  const h = wrappedLines * lineH + pad * 2;
  const bottom = s.line / 100;         // line% anchors the box bottom in this model
  const y = bottom - h;
  let x: number;
  if (s.positionAlign === "line-left") x = s.position / 100;
  else if (s.positionAlign === "line-right") x = s.position / 100 - w;
  else x = s.position / 100 - w / 2;
  return { x, y, w, h, wrappedLines };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function withinTitleSafe(r: Rect): boolean {
  return (
    r.x >= TITLE_SAFE.x &&
    r.y >= TITLE_SAFE.y &&
    r.x + r.w <= 1 - TITLE_SAFE.x &&
    r.y + r.h <= 1 - TITLE_SAFE.y
  );
}

/**
 * Pick the first lane in `preferred` whose estimated box is inside title-safe margins,
 * would not wrap a side lane past `maxSideLaneLines` lines (default 3: a label plus two dialogue lines) or past `maxSideLaneHeight` of the viewport (default 0.35); longer or taller text goes to the bottom lane, and does not overlap
 * any `protected` region or `occupied` box. Falls back to
 * bottom_center, which is always allowed (it is the conventional caption position).
 */
export function chooseLane(
  preferred: Lane[],
  box: (lane: Lane) => LaneBox,
  protectedRegions: Rect[] = [],
  occupied: Rect[] = [],
  opts: { maxSideLaneLines?: number; maxSideLaneHeight?: number } = {},
): { lane: Lane; reason?: "no_safe_lane"; rejected?: string[] } {
  const maxSide = opts.maxSideLaneLines ?? 3;
  const maxH = opts.maxSideLaneHeight ?? 0.35;
  const rejected: string[] = [];
  for (const lane of preferred) {
    const r = box(lane);
    if (lane !== "bottom_center" && r.wrappedLines > maxSide) { rejected.push(`${lane}:wraps`); continue; }
    if (lane !== "bottom_center" && r.h > maxH) { rejected.push(`${lane}:height`); continue; }
    if (!withinTitleSafe(r)) { rejected.push(`${lane}:title_safe`); continue; }
    if (protectedRegions.some((p) => rectsOverlap(r, p))) { rejected.push(`${lane}:protected`); continue; }
    if (occupied.some((o) => rectsOverlap(r, o))) { rejected.push(`${lane}:occupied`); continue; }
    return rejected.length ? { lane, reason: "no_safe_lane", rejected } : { lane };
  }
  return { lane: "bottom_center", reason: "no_safe_lane", rejected };
}
