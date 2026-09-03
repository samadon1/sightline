import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseVtt } from "@sightline-wip/core";
import { resolveAll, toNativeCues, replaceTrackCues, fontScaleFromTextSize, type NativeCue, type NativeTrack } from "../src/captionRuntime.ts";

const vtt = readFileSync(new URL("../../../assets/prototype/captions.en.vtt", import.meta.url), "utf8");
const { cues } = parseVtt(vtt);
const lanes = { Maya: "lower_left", Daniel: "lower_right" } as const;
const make = (s: number, e: number, t: string): NativeCue => ({ startTime: s, endTime: e, text: t });

test("prototype track parses to four cues", () => {
  assert.equal(cues.length, 4);
});

test("standard mode: plain text, no settings, bottom lane", () => {
  const r = resolveAll(cues, "standard", { speakerLanes: lanes, fontScale: 1 });
  assert.ok(r.every((x) => x.lane === "bottom_center" && !x.label));
  const n = toNativeCues(r, "standard", make);
  assert.equal(n[0].line, undefined);
  assert.equal(n[0].text, "Did you bring it?");
  assert.equal(n[0].startTime, 1.2);
});

test("speaker-aware: label on speaker change only, lanes from voice, sound at bottom", () => {
  const r = resolveAll(cues, "speaker-aware", { speakerLanes: lanes, fontScale: 1 });
  assert.equal(r[0].label, "MAYA");   assert.equal(r[0].lane, "lower_left");
  assert.equal(r[1].label, "DANIEL"); assert.equal(r[1].lane, "lower_right");
  assert.equal(r[2].label, "MAYA");   // speaker changed back
  assert.equal(r[3].label, undefined); assert.equal(r[3].lane, "bottom_center");
  const n = toNativeCues(r, "speaker-aware", make);
  assert.equal(n[0].text, "MAYA\nDid you bring it?");
  assert.equal(n[0].positionAlign, "line-left");
  assert.equal(n[1].positionAlign, "line-right");
  assert.equal(n[0].snapToLines, false);
});

test("largest system text size: a longer cue wraps past the side-lane budget and falls back; a short one may stay", () => {
  const r = resolveAll(cues, "speaker-aware", { speakerLanes: lanes, fontScale: fontScaleFromTextSize("largest") });
  // c003 "Don't let him see it." (21 chars) wraps to 4 lines in a 42%-wide lane at 2x: rejected.
  assert.equal(r[2].lane, "bottom_center");
  assert.equal(r[2].fallbackReason, "no_safe_lane");
  assert.equal(r[2].label, "MAYA", "label survives the lane fallback");
  // At 2.0x even the 17-character cue wraps in a 42%-wide lane (calibrated 1.74% per char): bottom too.
  assert.equal(r[0].lane, "bottom_center");
});

test("replaceTrackCues removes old cues then adds new ones", () => {
  const log: string[] = [];
  const track: NativeTrack = { mode: "showing", addCue: (c) => log.push("add:" + c.text), removeCue: (c) => log.push("rm:" + c.text) };
  replaceTrackCues(track, [make(0, 1, "B")], [make(0, 1, "A")]);
  assert.deepEqual(log, ["rm:A", "add:B"]);
});
