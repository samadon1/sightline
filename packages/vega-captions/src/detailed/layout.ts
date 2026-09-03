/**
 * Pure layout rules for the Detailed overlay, kept free of React Native so they can be tested in Node.
 * The overlay component applies these; nothing here touches the platform.
 */
import { heightPctForLoudness, normalizeVisibleText, type LoudLevel, type ResolvedCaption, type ResolvedWord } from "@sightline-wip/core";

export const MUSIC_RE = /\b(music|song|singing|sings|humming|hums|melody|tune|theme|orchestra|jazz|piano|guitar)\b/i;
export const SOUND_RE = /^\s*[\[(].*[\])]\s*$/;
/** Caption with Intention 2.2.1: read-ahead text in white at 90% opacity. */
export const READ_AHEAD = "rgba(255,255,255,0.9)";
/**
 * Caption with Intention 2.3.8: weight by pitch band (160–200 Hz regular; lower heavier, higher lighter).
 * The platform ignores variable fonts (FL-024), so weight is chosen by static family. Width (2.3.9,
 * driven by harmonics) is not measured yet and is not applied; the Wide and Narrow instances stay
 * packaged for when it is.
 */
export const WEIGHT_BY_PITCH: Record<number, "300" | "400" | "700"> = { [-1]: "700", 0: "400", 1: "300" };
export const FAMILY_BY_PITCH: Record<number, string> = { [-1]: "Roboto Flex Bold", 0: "Roboto Flex", 1: "Roboto Flex Light" };
/** Static Roboto Flex instance for a weight step (pitch) and a width step (harmonics, CI 2.3.9). Nine families ship. */
export function familyFor(pitch: number, width: number, italic = false): string {
  const w = pitch === -1 ? "Bold" : pitch === 1 ? "Light" : "Regular";
  // Off-camera voices are italic (CI 2.1.5). The platform ignores fontStyle (FL-024), so italic is a family of its
  // own: three slanted instances ship (Regular, Bold, Light); width steps fall back to the upright width family.
  if (italic) return w === "Regular" ? "Roboto Flex Italic" : `Roboto Flex ${w} Italic`;
  const d = width === -1 ? "Narrow" : width === 1 ? "Wide" : "";
  if (!d) return w === "Regular" ? "Roboto Flex" : `Roboto Flex ${w}`;
  return `Roboto Flex ${w} ${d}`;
}
/** Median width level of the timed words, else the cue level, else regular. */
export function cueWidth(c: ResolvedCaption): number {
  const ws = (c.words ?? []).map((w) => w.width).filter((v): v is -1 | 0 | 1 => v === -1 || v === 0 || v === 1);
  if (ws.length) { const v = ws.slice().sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; }
  return c.delivery?.width ?? 0;
}
/** Caption with Intention 2.3.5: size follows volume per word; a line's box follows its largest word. */
export function wordHeightPct(w: ResolvedWord | undefined, cueFallback: number): number {
  if (!w) return cueFallback;
  // A word takes its own size only when it clearly differs from the line (1.5% of the height or more);
  // smaller measured differences read as a ragged baseline, not as emphasis (UX review M5).
  const own = heightPctForLoudness(w.loud, w.loudDb);
  return Math.abs(own - cueFallback) >= 0.015 ? own : cueFallback;
}
/**
 * Overflow clamp: a cue may not exceed two lines and 35% of the screen height (CI 2.4.3 work area and the
 * lane budget). Returns the scale (≤ 1) to apply to every line size in the cue.
 */
export function overflowScale(lineHeightsPct: number[], maxPct = 0.35): number {
  const total = lineHeightsPct.reduce((a, b) => a + b * 1.3, 0); // 1.3 line height
  return total > maxPct ? maxPct / total : 1;
}

export function isSoundCaption(c: ResolvedCaption): boolean { return SOUND_RE.test(c.text) || c.cueId.startsWith("sfx:"); }
export function isMusicCaption(c: ResolvedCaption): boolean { return isSoundCaption(c) && MUSIC_RE.test(c.text); }

/** Median pitch level of the timed words, 0 when untimed. */
export function cuePitch(words: ResolvedWord[] | undefined): number {
  if (!words?.length) return 0;
  const v = words.map((w) => w.pitch).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}
/** Loudest quantised level in the cue (cue-level delivery or any word). */
export function cueLoud(c: ResolvedCaption): LoudLevel {
  let m: LoudLevel = c.delivery?.loud ?? 0;
  for (const w of c.words ?? []) if (w.loud > m) m = w.loud;
  return m;
}
/** Loudest measured dB in the cue when the data carries measurements. */
export function cueLoudDb(c: ResolvedCaption): number | undefined {
  const vals = [c.delivery?.loudDb, ...(c.words ?? []).map((w) => w.loudDb)].filter((v): v is number => typeof v === "number");
  return vals.length ? Math.max(...vals) : undefined;
}
/** Type height as a fraction of the screen for this cue; music descriptors stay at the baseline (CI 2.4.5). */
export function cueHeightPct(c: ResolvedCaption): number {
  if (isMusicCaption(c)) return heightPctForLoudness(0, undefined);
  return heightPctForLoudness(cueLoud(c), cueLoudDb(c));
}

/**
 * Lines of tokens indexed exactly as the core's visibleTokens(rawText): plainText per line through the
 * same normaliser (entities decoded, NFC, whitespace collapsed), split on single spaces.
 */
export function tokenLines(text: string): string[][] {
  return text.split("\n").map((l) => { const n = normalizeVisibleText(l); return n ? n.split(" ") : []; });
}

/**
 * Whether token `i` counts as spoken at `nowMs`. Timed words use their own start; an untimed token is
 * spoken once a later timed word has started or the nearest earlier timed word has ended, never before.
 */
export function spokenAt(i: number, words: ResolvedWord[] | undefined, nowMs: number): boolean {
  if (!words?.length) return false;
  const w = words.find((x) => x.i === i);
  if (w) return w.startMs <= nowMs;
  const timed = words.slice().sort((a, b) => a.i - b.i);
  if (timed.some((x) => x.i > i && x.startMs <= nowMs)) return true;
  const before = timed.filter((x) => x.i < i).pop();
  return !!before && before.endMs <= nowMs;
}

/**
 * Bottom offset of the side lanes: a fixed clearance (19% of the height) that already clears one bottom
 * caption, so a sound label appearing does not move a side-lane cue; a taller measured bottom stack lifts
 * them further. Reduced motion: nothing moves while a caption shows, so the default must be generous.
 */
export function sideLaneBottom(screenHeight: number, bottomStackHeight: number, bottomHasContent: boolean): number {
  return Math.max(screenHeight * 0.19, bottomHasContent ? bottomStackHeight + screenHeight * 0.085 : 0);
}

/** Pop duration for a word: its own length clamped to 120–300 ms (CI's pop is short). */
export function popDurationMs(w: ResolvedWord | undefined): number {
  return w ? Math.min(300, Math.max(120, w.endMs - w.startMs)) : 200;
}

/**
 * Caption with Intention 2.2.2 (optional): syllable-level colouring. A word's span is divided across its
 * vowel groups in proportion to their letters, so each syllable takes the colour when its share of the
 * word's time has begun. Approximate by construction: aligners give word boundaries, not syllable ones.
 */
export function syllableChunks(display: string, startMs: number, endMs: number): Array<{ text: string; startMs: number }> {
  // Onset-maximising split: consonants go with the vowel group that follows them; a trailing coda joins the last chunk.
  const m = Array.from(display.matchAll(/[^aeiouyAEIOUY]*[aeiouyAEIOUY]+/g)).map((x) => x[0]);
  const used = m.join("").length;
  if (used < display.length && m.length) m[m.length - 1] += display.slice(used);
  if (m.length < 2 || m.join("") !== display) return [{ text: display, startMs }];
  const total = m.reduce((n, c) => n + c.length, 0);
  let acc = 0;
  return m.map((c) => { const t = startMs + ((endMs - startMs) * acc) / total; acc += c.length; return { text: c, startMs: Math.round(t) }; });
}

/** Caption with Intention 2.4.1: a shouted word (level 2) may break out of the box; the box is not enlarged for it. */
export function breaksOut(w: ResolvedWord | undefined): boolean { return !!w && w.loud === 2; }
