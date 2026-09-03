/**
 * Minimal WebVTT parser for the caption runtime.
 *
 * Scope (deliberately small):
 *  - WEBVTT header, optional NOTE blocks (skipped), REGION/STYLE blocks (skipped)
 *  - cue identifiers (required by the runtime; enforced by `requireIds`)
 *  - timestamps in HH:MM:SS.mmm or MM:SS.mmm
 *  - cue settings on the timing line (kept as a string map, not interpreted here)
 *  - <v Name> voice spans: the speaker name is extracted, tags are stripped from plainText
 *  - other inline tags (<b>, <i>, <c.x>, <00:00:01.000>) are stripped from plainText
 *
 * The parser never rewrites cue text. `rawText` is preserved byte-for-byte.
 */

export type CanonicalCue = {
  id: string;
  startMs: number;
  endMs: number;
  /** Cue payload exactly as authored, including any tags. */
  rawText: string;
  /** Payload with all inline tags removed. Lines joined with "\n". */
  plainText: string;
  /** Speaker name from a leading <v Name> span, if present. */
  voice?: string;
  /** Cue settings from the timing line, e.g. { line: "90%", position: "20%" }. */
  settings: Record<string, string>;
};

export type ParseResult = {
  cues: CanonicalCue[];
  warnings: string[];
};

const TIMESTAMP = /^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/;

export function parseTimestamp(s: string): number | null {
  const m = TIMESTAMP.exec(s.trim());
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  const ms = Number(m[4]);
  if (min > 59 || sec > 59) return null;
  return ((h * 60 + min) * 60 + sec) * 1000 + ms;
}

export function formatTimestamp(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(r, 3)}`;
}

const VOICE_OPEN = /^<v(?:\.[^\s>]+)?\s+([^>]+)>/;

/** Strip all inline WebVTT tags. Extract a leading voice name if present. */
export function stripTags(payload: string): { plainText: string; voice?: string } {
  let voice: string | undefined;
  const vm = VOICE_OPEN.exec(payload);
  if (vm) voice = vm[1].trim();
  const plainText = payload
    .replace(/<\/?[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return { plainText, voice };
}

export type ParseOptions = {
  /** Reject cues that have no identifier (the runtime keys metadata by id). Default true. */
  requireIds?: boolean;
};

export function parseVtt(input: string, opts: ParseOptions = {}): ParseResult {
  const requireIds = opts.requireIds ?? true;
  const warnings: string[] = [];
  const text = input.replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  const lines = text.split("\n");

  if (!/^WEBVTT(\s|$)/.test(lines[0] ?? "")) {
    throw new Error("Not a WebVTT file: missing WEBVTT header");
  }

  // Split into blocks on blank lines (header block first).
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const line of lines.slice(1)) {
    if (line.trim() === "") {
      if (cur.length) blocks.push(cur);
      cur = [];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur);

  const cues: CanonicalCue[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const first = block[0] ?? "";
    if (/^(NOTE|STYLE|REGION)(\s|$)/.test(first)) continue;

    let idx = 0;
    let id: string | undefined;
    if (!block[0].includes("-->")) {
      id = block[0].trim();
      idx = 1;
    }
    const timing = block[idx];
    if (!timing || !timing.includes("-->")) {
      warnings.push(`Skipped block without timing line: "${first.slice(0, 40)}"`);
      continue;
    }
    const [lhs, rhsAll] = timing.split("-->");
    const rhsParts = rhsAll.trim().split(/\s+/);
    const startMs = parseTimestamp(lhs);
    const endMs = parseTimestamp(rhsParts[0] ?? "");
    if (startMs === null || endMs === null) {
      warnings.push(`Skipped cue with invalid timestamp: "${timing}"`);
      continue;
    }
    if (endMs <= startMs) {
      warnings.push(`Skipped cue with end <= start: "${timing}"`);
      continue;
    }
    const settings: Record<string, string> = {};
    for (const s of rhsParts.slice(1)) {
      const [k, v] = s.split(":");
      if (k && v !== undefined) settings[k] = v;
    }

    if (!id) {
      if (requireIds) {
        warnings.push(`Skipped cue without identifier at ${formatTimestamp(startMs)}`);
        continue;
      }
      id = `auto_${cues.length + 1}`;
    }
    if (seen.has(id)) {
      warnings.push(`Duplicate cue identifier "${id}"; later cue skipped`);
      continue;
    }
    seen.add(id);

    const rawText = block.slice(idx + 1).join("\n");
    const { plainText, voice } = stripTags(rawText);
    cues.push({ id, startMs, endMs, rawText, plainText, voice, settings });
  }

  cues.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  return { cues, warnings };
}

/** Cues active at a given media time (start inclusive, end exclusive), per WebVTT. */
export function activeCuesAt(cues: CanonicalCue[], timeMs: number): CanonicalCue[] {
  return cues.filter((c) => c.startMs <= timeMs && timeMs < c.endMs);
}
