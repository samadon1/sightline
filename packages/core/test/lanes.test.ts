import { test } from "node:test";
import assert from "node:assert/strict";
import { laneToCueSettings, estimateLaneBox, chooseLane, withinTitleSafe, rectsOverlap } from "../src/lanes.ts";

test("lane settings map to WebVTT cue settings", () => {
  const s = laneToCueSettings("lower_left");
  assert.equal(s.snapToLines, false);
  assert.equal(s.positionAlign, "line-left");
  assert.equal(s.align, "start");
  const b = laneToCueSettings("bottom_center");
  assert.equal(b.position, 50);
});

test("estimated boxes stay title-safe at default scale", () => {
  for (const lane of ["bottom_center", "lower_left", "lower_right"] as const) {
    const r = estimateLaneBox(lane, 2, 20, 1, 1);
    assert.ok(withinTitleSafe(r), `${lane} should be inside title-safe: ${JSON.stringify(r)}`);
  }
});

test("a large font scale pushes a side lane out of its width budget and triggers fallback", () => {
  const box = (lane: Parameters<typeof estimateLaneBox>[0]) => estimateLaneBox(lane, 2, 21, 1.5, 1);
  const r = chooseLane(["lower_left", "bottom_center"], box);
  // At 2.2x, a 40-char, 3-line caption in the left lane collides with the title-safe bottom
  // or exceeds the lane width; the resolver must drop to bottom_center.
  assert.equal(r.lane, "bottom_center");
});

test("protected regions reject a lane", () => {
  const face = { x: 0.05, y: 0.55, w: 0.3, h: 0.35 };
  const box = (lane: Parameters<typeof estimateLaneBox>[0]) => estimateLaneBox(lane, 2, 20, 1, 1);
  const r = chooseLane(["lower_left", "lower_right", "bottom_center"], box, [face]);
  assert.equal(r.lane, "lower_right");
});

test("occupied boxes force stacking away from a simultaneous cue", () => {
  const box = (lane: Parameters<typeof estimateLaneBox>[0]) => estimateLaneBox(lane, 2, 20, 1, 1);
  const left = box("lower_left");
  const r = chooseLane(["lower_left", "lower_right"], box, [], [left]);
  assert.equal(r.lane, "lower_right");
});

test("rectsOverlap is strict on touching edges", () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }), false);
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 1, h: 1 }, { x: 0.5, y: 0.5, w: 1, h: 1 }), true);
});
