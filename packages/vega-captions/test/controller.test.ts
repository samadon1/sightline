import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cueTextHash } from "../../core/src/index.ts";
import { CaptionController, nativeColorClass, NATIVE_LEAD_START_MS, NATIVE_LEAD_WORD_MS, type NativeCue, type NativeTrack } from "../src/controller/CaptionController.ts";

const vtt = readFileSync(new URL("../../../assets/prototype/captions.en.vtt", import.meta.url), "utf8");
const companion = JSON.parse(readFileSync(new URL("../../../assets/prototype/companion.en.json", import.meta.url), "utf8"));
// Schema 0.2 additions for the test: verified words on c001 and one verified sound event.
companion.schemaVersion = "0.2";
companion.cues.c001.words = [
  { i: 0, startMs: 1200, endMs: 1500, status: "verified" }, { i: 1, startMs: 1500, endMs: 1700, status: "verified" }, { i: 2, startMs: 1700, endMs: 2100, status: "verified" }, { i: 3, startMs: 2100, endMs: 2600, status: "verified" },
];
companion.sounds = [{ id: "sfx1", startMs: 5000, endMs: 6000, label: "door slams", direction: "left", status: "verified" }];

function fakeTrack() {
  const cues: NativeCue[] = [];
  const track: NativeTrack & { cues: NativeCue[] } = {
    cues, mode: "disabled",
    addCue: (c) => { cues.push(c); }, removeCue: (c) => { const i = cues.indexOf(c); if (i >= 0) cues.splice(i, 1); },
    activeCues: null, oncuechange: null,
  };
  return track;
}
const make = (s: number, e: number, t: string): NativeCue => ({ startTime: s, endTime: e, text: t });
let now = 0;
// Timing assertions below use lead 0; the default lead is checked separately.
const deps = (track: NativeTrack) => ({ makeCue: make, track, now: () => now, nativeLeadMs: 0 });

test("speaker-aware: verified words split c001 into one native cue per word boundary with the spoken prefix in a colour class", () => {
  const track = fakeTrack();
  new CaptionController(deps(track), vtt, companion, { mode: "speaker-aware", reducedMotion: true }, { textColor: "default" });
  const c001 = track.cues.filter((c) => (c.id ?? "").startsWith("c001"));
  assert.equal(c001.length, 4, "four boundaries: cue start plus three later word starts");
  assert.equal(c001[0].text, "<c.yellow>MAYA\nDid</c> you bring it?");
  assert.equal(c001[3].text, "<c.yellow>MAYA\nDid you bring it?</c>");
  assert.deepEqual(c001.map((c) => c.startTime), [1.2, 1.5, 1.7, 2.1]);
  assert.equal(c001[3].endTime, 3.6);
  assert.equal(c001[0].positionAlign, "line-left", "lane settings apply to every segment");
  // c002 (Daniel, speaker-2 → cyan) has no word timings: a single coloured cue.
  const c002 = track.cues.filter((c) => (c.id ?? "").startsWith("c002"));
  assert.equal(c002.length, 1);
  assert.equal(c002[0].text, "<c.cyan>DANIEL\nIt's in the envelope.</c>");
  assert.equal(track.mode, "showing");
});

test("viewer colour wins: with a custom text colour the native path sends plain text, no classes", () => {
  const track = fakeTrack();
  new CaptionController(deps(track), vtt, companion, { mode: "speaker-aware", reducedMotion: true }, { textColor: "white" });
  assert.ok(track.cues.every((c) => !c.text.includes("<c.")));
  assert.equal(track.cues.filter((c) => (c.id ?? "").startsWith("c001")).length, 1);
});

test("word highlighting off keeps one cue per cue on the native path", () => {
  const track = fakeTrack();
  new CaptionController(deps(track), vtt, companion, { mode: "speaker-aware", reducedMotion: true, wordHighlight: false }, {});
  assert.equal(track.cues.filter((c) => (c.id ?? "").startsWith("c001")).length, 1);
});

test("detailed: native track hidden; the word clock lays out words and sound events; overlay only re-renders at boundaries", () => {
  const track = fakeTrack();
  const ctl = new CaptionController(deps(track), vtt, companion, { mode: "detailed", reducedMotion: true }, {});
  assert.equal(track.mode, "hidden");
  const states: Array<{ overlay: string[]; nowMs: number }> = [];
  ctl.subscribe((s) => states.push({ overlay: s.overlay.map((r) => r.cueId), nowMs: s.nowMs }));
  const n0 = states.length;
  ctl.tickAt(1300); ctl.tickAt(1400); ctl.tickAt(1450); // same word: one render
  assert.equal(states.length, n0 + 1);
  assert.deepEqual(states.at(-1)!.overlay, ["c001"]);
  ctl.tickAt(1520); // second word starts: a new render
  assert.equal(states.length, n0 + 2);
  ctl.tickAt(5500); // c002 (4.0–6.8 s) plus the sound event
  assert.deepEqual(states.at(-1)!.overlay, ["c002", "sfx:sfx1"]);
  ctl.tickAt(6500); // sound event over, c002 still on
  assert.deepEqual(states.at(-1)!.overlay, ["c002"]);
  ctl.tickAt(7000);
  assert.deepEqual(states.at(-1)!.overlay, []);
});

test("nativeColorClass maps the CI mains that have WebVTT classes and leaves the rest white", () => {
  assert.equal(nativeColorClass("speaker-1"), "yellow");
  assert.equal(nativeColorClass("speaker-4"), undefined);
  assert.equal(nativeColorClass(undefined), undefined);
});

test("native cues are scheduled early: cue entries and exits by the start lead, word segments by the word lead", () => {
  const track = fakeTrack();
  // Speaker-aware without word timing (viewer toggle off) keeps one native cue per caption, so the entry and exit leads show directly.
  new CaptionController({ makeCue: make, track, now: () => now }, vtt, companion, { mode: "speaker-aware", reducedMotion: true, wordHighlight: false }, { textColor: "default" });
  const c001 = track.cues.find((c) => c.id === "c001")!;
  assert.equal(NATIVE_LEAD_START_MS, 100); assert.equal(NATIVE_LEAD_WORD_MS, 100);
  assert.ok(Math.abs(c001.startTime - (1.2 - 0.1)) < 1e-9);
  assert.ok(Math.abs(c001.endTime - (3.6 - 0.1)) < 1e-9);
  const t2 = fakeTrack();
  new CaptionController({ makeCue: make, track: t2, now: () => now }, vtt, companion, { mode: "speaker-aware", reducedMotion: true }, { textColor: "default" });
  const segs = t2.cues.filter((c) => (c.id ?? "").startsWith("c001"));
  assert.ok(Math.abs(segs[0].startTime - (1.2 - 0.1)) < 1e-9, "cue entry uses the start lead");
  assert.ok(Math.abs(segs[0].endTime - (1.5 - 0.1)) < 1e-9, "internal boundary uses the word lead");
  assert.ok(Math.abs(segs[1].startTime - (1.5 - 0.1)) < 1e-9);
  assert.ok(Math.abs(segs[3].endTime - (3.6 - 0.1)) < 1e-9, "cue exit uses the start lead");
});

test("Standard mode is the untouched track: no lead is applied", () => {
  const track = fakeTrack();
  const plainVtt = "WEBVTT\n\nc001\n00:00:01.000 --> 00:00:03.000\n<v Maya>Hello there\n";
  // Default leads (100/100 ms) apply to the enhanced modes; Standard must not be shifted.
  new CaptionController({ makeCue: make, track, now: () => now }, plainVtt, null, { mode: "standard", reducedMotion: true }, undefined);
  const c = track.cues[0];
  assert.equal(c.startTime, 1.0); assert.equal(c.endTime, 3.0);
  const track2 = fakeTrack();
  new CaptionController({ makeCue: make, track: track2, now: () => now }, vtt, companion, { mode: "speaker-aware", reducedMotion: true }, { textColor: "default" });
  const first = track2.cues.filter((c) => (c.id ?? "").startsWith("c001"))[0];
  assert.ok(first.startTime < 1.2, "the enhanced mode is scheduled early");
});

test("a bad sound event or shot is dropped, the rest of the companion still applies", () => {
  const track = fakeTrack();
  const plainVtt = "WEBVTT\n\nc001\n00:00:01.000 --> 00:00:03.000\n<v Maya>Hello there\n";
  const hash = cueTextHash("<v Maya>Hello there");
  const companion = {
    schemaVersion: "0.2", canonicalTrack: "captions.en.vtt",
    speakers: { maya: { label: "MAYA", color: "speaker-1" } },
    shots: [{ id: "s1", startMs: 0, endMs: 10000 }, { id: "bad", startMs: 5000, endMs: 4000 }],
    cues: { c001: { textHash: hash, status: "verified", verifiedBy: "human", speaker: "maya", lanes: ["lower_left", "bottom_center"] } },
    sounds: [{ id: "x", startMs: 100, endMs: 200, label: "[door]", status: "verified" }],
  };
  const ctl = new CaptionController(deps(track), plainVtt, companion as unknown as Parameters<typeof CaptionController.prototype.constructor>[2], { mode: "speaker-aware", reducedMotion: true }, undefined);
  assert.ok(ctl.state.companionPresent, "the file is kept");
  assert.ok(track.cues[0].text.includes("MAYA"), "the verified cue still gets its label");
});
