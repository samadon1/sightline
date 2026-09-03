#!/usr/bin/env node --experimental-strip-types
/**
 * Summarise caption synchronization from a device log (Measurement A and B, spec §11.6).
 *
 *   npm run sync-report -- <device-log.txt> assets/the-envelope/captions.en.vtt
 *
 * Measurement A: every `[sync] ... event=cuechange` line carries the media time sampled in the
 * native cue-change handler and the expected/rendered cue ids. For each boundary crossing
 * (a cue entering or leaving the active set) the error is media time minus the nearest cue
 * boundary. Seek recomputes are excluded (events within 350 ms after a seek/play/mode line).
 *
 * Measurement B: `[clockB] frame-change est=<ms>` lines are the first animation frame on which
 * the resolver's expected set changed, with the media time estimated from a performance.now()
 * anchor. Their error against the boundary is reported separately.
 *
 * Output is markdown so it can be pasted into docs/sync-report.md.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parseVtt, nativeWordSegments } from "../packages/core/src/index.ts";

const argvAll = process.argv.slice(2);
const modeFlagIdx = argvAll.indexOf("--mode");
const onlyMode = modeFlagIdx >= 0 ? argvAll[modeFlagIdx + 1] : undefined;
const [logPath, vttPath, companionPath] = modeFlagIdx >= 0 ? argvAll.filter((_, i) => i !== modeFlagIdx && i !== modeFlagIdx + 1) : argvAll;
if (!logPath || !vttPath) { console.error("usage: sync-report <device-log> <captions.vtt> [companion.json] [--mode speaker-aware|detailed|standard]  (a log holding several scenes must be scoped to the mode/scene it is scored against)"); process.exit(2); }

const cues = parseVtt(readFileSync(vttPath, "utf8")).cues;
const byId = new Map(cues.map((c) => [c.id, c]));
// Word boundaries on the native path: "c002#3" is the segment that starts at the 3rd verified word
// boundary. Rebuild the same segments the app built, from the companion's verified words.
const segStart = new Map<string, number>();
if (companionPath) {
  const comp = JSON.parse(readFileSync(companionPath, "utf8")) as { cues?: Record<string, { status?: string; words?: Array<{ i: number; startMs: number; endMs: number; status?: string }> }> };
  for (const c of cues) {
    const meta = comp.cues?.[c.id];
    if (!meta || meta.status !== "verified" || !meta.words?.length) continue;
    const words = meta.words.filter((w) => (w.status ?? "verified") === "verified").map((w) => ({ i: w.i, startMs: w.startMs, endMs: w.endMs, loud: 0 as const, pitch: 0 as const, display: "" }));
    const segs = nativeWordSegments(c.plainText, words, c.startMs, c.endMs, "x");
    if (segs.length > 1) segs.forEach((sg, k) => segStart.set(`${c.id}#${k}`, sg.startMs));
  }
}
let wordBoundaries = 0;
let leadSeen: number | undefined;
const lines = readFileSync(logPath, "utf8").split("\n").map((l) => l.replace(/.*\[KeplerScript-JavaScript\] /, ""));

type Sample = { mode: string; t: number; err: number; kind: "A" | "B" };
const samples: Sample[] = [];
let mode = "?";
let prevActive = new Set<string>();
let suppressUntil = -1;
let lost = 0, boundaries = 0;
const seen = new Set<string>();

for (const l of lines) {
  const m = /^\[mode\] (\S+)/.exec(l);
  if (m) { mode = m.group ? m.group(1) : m[1]; suppressUntil = Number.MAX_SAFE_INTEGER; continue; }
  const s = /^\[sync\] wall=(\d+) media=(-?\d+) event=(\S+) expected=(\S+) rendered=(\S+)/.exec(l);
  if (s) {
    const lm = / lead=(\d+)/.exec(l); if (lm) leadSeen = Number(lm[1]);
    const t = Number(s[2]); const ev = s[3];
    if (ev !== "cuechange") { suppressUntil = t + 350; prevActive = new Set(s[4] === "-" ? [] : s[4].split(",")); continue; }
    const active = new Set(s[5] === "-" ? [] : s[5].split(","));
    if (suppressUntil === Number.MAX_SAFE_INTEGER) suppressUntil = t + 350; // first event after a rebuild
    const entered = [...active].filter((x) => !prevActive.has(x));
    const exited = [...prevActive].filter((x) => !active.has(x));
    prevActive = active;
    const isWordSeg = (id: string) => id.includes("#") && segStart.has(id);
    const cueOf = (id: string) => id.split("#")[0];
    const cands = [
      ...entered.map((id) => (isWordSeg(id) ? segStart.get(id) : byId.get(cueOf(id))?.startMs)),
      ...exited.map((id) => (id.includes("#") ? undefined : byId.get(id)?.endMs)),
    ].filter((x): x is number => typeof x === "number");
    // A cue's last segment leaving is the cue's end.
    for (const id of exited) if (id.includes("#") && !entered.some((e) => cueOf(e) === cueOf(id))) { const end = byId.get(cueOf(id))?.endMs; if (end !== undefined) cands.push(end); }
    if (!cands.length) continue;
    const b = cands.reduce((best, x) => (Math.abs(t - x) < Math.abs(t - best) ? x : best), cands[0]);
    entered.forEach((id) => seen.add(cueOf(id)));
    if (t < suppressUntil) continue;
    const wordOnly = entered.length > 0 && entered.every((id) => isWordSeg(id) && !id.endsWith("#0")) && exited.every((id) => id.includes("#") && cueOf(id) === cueOf(entered[0]));
    if (wordOnly) wordBoundaries++; else boundaries++;
    samples.push({ mode: wordOnly ? `${mode} (word)` : mode, t, err: t - b, kind: "A" });
    continue;
  }
  const c = /^\[clockB\] frame-change est=(-?\d+)/.exec(l);
  if (c) {
    const est = Number(c[1]);
    const bnds = cues.flatMap((q) => [q.startMs, q.endMs]);
    const b = bnds.reduce((best, x) => (Math.abs(est - x) < Math.abs(est - best) ? x : best), bnds[0]);
    if (Math.abs(est - b) < 2000) samples.push({ mode, t: est, err: est - b, kind: "B" });
  }
}
lost = cues.filter((q) => !seen.has(q.id)).length;
// Per-sample rows for plotting (docs/architecture-figures): SYNC_ROWS=<path> writes them as JSON.
if (process.env.SYNC_ROWS) writeFileSync(process.env.SYNC_ROWS, JSON.stringify(samples));

function stats(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.round(p * s.length) - 1))];
  return { n: s.length, p50: q(0.5), p95: q(0.95), max: Math.max(...s), min: Math.min(...s) };
}
const groups = new Map<string, number[]>();
const scoped = onlyMode ? samples.filter((x) => x.mode === onlyMode || x.mode === `${onlyMode} (word)`) : samples;
for (const x of scoped) { const k = `${x.kind} ${x.mode}`; groups.set(k, [...(groups.get(k) ?? []), x.err]); }

console.log(`# Sync report\n\nLog: \`${logPath}\`  Track: \`${vttPath}\` (${cues.length} cues)\n`);
console.log("| Method | Mode | n | p50 (ms) | p95 (ms) | max (ms) | min (ms) |\n|---|---|---:|---:|---:|---:|---:|");
for (const [k, v] of [...groups.entries()].sort()) { const st = stats(v); console.log(`| ${k.split(" ")[0]} | ${k.split(" ").slice(1).join(" ")} | ${st.n} | ${st.p50 >= 0 ? "+" : ""}${st.p50} | ${st.p95 >= 0 ? "+" : ""}${st.p95} | ${st.max >= 0 ? "+" : ""}${st.max} | ${st.min >= 0 ? "+" : ""}${st.min} |`); }
const allA = scoped.filter((x) => x.kind === "A").map((x) => x.err);
const sg = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
if (allA.length) { const st = stats(allA); console.log(`| A | all | ${st.n} | ${sg(st.p50)} | ${sg(st.p95)} | ${sg(st.max)} | ${sg(st.min)} |`); }
if (leadSeen !== undefined) console.log(`\nNative cues were scheduled ${leadSeen} ms early (NATIVE_LEAD_START_MS / NATIVE_LEAD_WORD_MS; Standard mode is not shifted); Method A errors above are against the true boundaries, so they include that compensation.`);
console.log(`\nBoundary crossings counted: ${boundaries}${wordBoundaries ? ` cue-level plus ${wordBoundaries} word boundaries on the native path` : ""}. Cues never observed active (lost): ${lost} of ${cues.length}${lost ? " (" + cues.filter((q) => !seen.has(q.id)).map((q) => q.id).join(", ") + ")" : ""}.`);
console.log("\nMethod A samples the media clock inside the native cue-change handler; positive means late. Seek/play/mode recomputes within 350 ms are excluded. Method B is the first animation frame on which the resolver's expected set changed, timed from a performance.now() anchor; it is an independent estimate, not a render measurement.");
