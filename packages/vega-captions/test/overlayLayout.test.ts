import { test } from "node:test";
import assert from "node:assert/strict";
import { cuePitch, cueLoud, cueHeightPct, tokenLines, spokenAt, sideLaneBottom, popDurationMs, isMusicCaption, isSoundCaption } from "../src/detailed/layout.ts";
import type { ResolvedCaption, ResolvedWord } from "@sightline-wip/core";

const w = (i: number, s: number, e: number, extra: Partial<ResolvedWord> = {}): ResolvedWord => ({ i, startMs: s, endMs: e, loud: 0, pitch: 0, display: `w${i}`, ...extra });
const cue = (text: string, words?: ResolvedWord[], extra: Partial<ResolvedCaption> = {}): ResolvedCaption => ({ cueId: "c1", text, lane: "bottom_center", appliedFeatures: [], fallbackReasons: [], words, ...extra });

test("tokenLines indexes tokens across line breaks like the core's visibleTokens", () => {
  assert.deepEqual(tokenLines("Did you\nbring   it?"), [["Did", "you"], ["bring", "it?"]]);
  assert.deepEqual(tokenLines("Tom &amp; Jerry"), [["Tom", "&", "Jerry"]]);
  assert.deepEqual(tokenLines(""), [[]]);
});

test("spokenAt: timed words by their start; untimed words follow neighbours and never lead them", () => {
  const words = [w(0, 1000, 1200), w(2, 1500, 1700), w(3, 1700, 2000)]; // token 1 untimed
  assert.equal(spokenAt(0, words, 999), false);
  assert.equal(spokenAt(0, words, 1000), true);
  assert.equal(spokenAt(1, words, 1100), false, "untimed token 1: neighbour 0 not finished, 2 not started");
  assert.equal(spokenAt(1, words, 1200), true, "previous timed word ended");
  assert.equal(spokenAt(1, words, 1500), true);
  assert.equal(spokenAt(3, words, 1699), false);
  assert.equal(spokenAt(4, words, 2100), true, "trailing untimed token after the last timed word ended");
  assert.equal(spokenAt(0, undefined, 5000), false, "no timings: nothing is 'spoken' (plain rendering)");
});

test("size and weight rules: loudest level or measurement, median pitch, music at baseline", () => {
  assert.equal(cueLoud(cue("Hi", [w(0, 0, 1, { loud: 2 })])), 2);
  assert.equal(cuePitch([w(0, 0, 1, { pitch: 1 }), w(1, 0, 1, { pitch: 1 }), w(2, 0, 1, { pitch: -1 })]), 1);
  assert.ok(Math.abs(cueHeightPct(cue("Hi", [w(0, 0, 1, { loud: 2 })])) - 0.13) < 1e-9);
  assert.ok(Math.abs(cueHeightPct(cue("Hi", [w(0, 0, 1, { loud: 0, loudDb: 7 })])) - 0.10) < 1e-9, "measured dB wins over the level");
  assert.ok(Math.abs(cueHeightPct(cue("[dramatic music]", undefined, { cueId: "sfx:1", delivery: { loud: 2, pace: 0 } })) - 0.07) < 1e-9, "music does not scale");
  assert.ok(isSoundCaption(cue("[glass shatters]")) && !isMusicCaption(cue("[glass shatters]")));
});

test("side lanes clear one bottom caption without moving, and lift for a taller stack", () => {
  assert.equal(sideLaneBottom(1080, 0, false), 1080 * 0.19);
  assert.equal(sideLaneBottom(1080, 60, true), 1080 * 0.19, "one short bottom line: no move");
  assert.ok(sideLaneBottom(1080, 200, true) > 1080 * 0.19, "a tall stack lifts the side lanes");
});

test("pop duration is the word's own length within 120–300 ms", () => {
  assert.equal(popDurationMs(w(0, 0, 50)), 120);
  assert.equal(popDurationMs(w(0, 0, 250)), 250);
  assert.equal(popDurationMs(w(0, 0, 900)), 300);
  assert.equal(popDurationMs(undefined), 200);
});

test("familyFor combines weight (pitch) and width (harmonics) into the shipped static instances", async () => {
  const { familyFor, cueWidth } = await import("../src/detailed/layout.ts");
  assert.equal(familyFor(0, 0), "Roboto Flex");
  assert.equal(familyFor(-1, 0), "Roboto Flex Bold");
  assert.equal(familyFor(1, 1), "Roboto Flex Light Wide");
  assert.equal(familyFor(0, -1), "Roboto Flex Regular Narrow");
  assert.equal(cueWidth(cue("Hi", [w(0, 0, 1, { width: 1 }), w(1, 0, 1, { width: 1 }), w(2, 0, 1, { width: -1 })])), 1);
  assert.equal(cueWidth(cue("Hi", undefined, { delivery: { loud: 0, pace: 0, width: -1 } })), -1);
});

test("syllableChunks divides a word's span across its vowel groups; single-syllable words stay whole", async () => {
  const { syllableChunks, breaksOut } = await import("../src/detailed/layout.ts");
  const ch = syllableChunks("robotics", 1000, 1800);
  assert.deepEqual(ch.map((c) => c.text), ["ro", "bo", "tics"]);
  assert.equal(ch[0].startMs, 1000); assert.ok(ch[1].startMs > 1000 && ch[2].startMs > ch[1].startMs && ch[2].startMs < 1800);
  assert.deepEqual(syllableChunks("No", 0, 500), [{ text: "No", startMs: 0 }]);
  assert.deepEqual(syllableChunks("...alright!", 0, 500).map((c) => c.text).join(""), "...alright!");
  assert.equal(breaksOut(w(0, 0, 1, { loud: 2 })), true); assert.equal(breaksOut(w(0, 0, 1, { loud: 1 })), false); assert.equal(breaksOut(undefined), false);
});
