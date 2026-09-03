import { test } from "node:test";
import assert from "node:assert/strict";
import { MediaClock, type ClockSource } from "../src/media/MediaClock.ts";

function fakeSource() {
  const listeners = new Map<string, Set<() => void>>();
  const src = {
    currentTime: 0, paused: true,
    addEventListener: (t: string, f: () => void) => { (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(f); },
    removeEventListener: (t: string, f: () => void) => { listeners.get(t)?.delete(f); },
    fire: (t: string) => { listeners.get(t)?.forEach((f) => f()); },
  };
  return src as ClockSource & { currentTime: number; paused: boolean; fire: (t: string) => void };
}

test("projects from fresh events while playing, holds while paused, ignores stale polls", () => {
  let wall = 1000;
  const clock = new MediaClock(() => wall);
  const src = fakeSource();
  clock.attach(src);
  assert.equal(clock.now(), 0);
  src.paused = false; src.currentTime = 2.0; src.fire("play");
  wall += 500;
  assert.equal(clock.now(), 2500, "projected from the play anchor");
  // A stale poll (currentTime still 2.0) must not pull the clock back: nothing reads it until an event.
  wall += 500;
  assert.equal(clock.now(), 3000);
  src.currentTime = 3.02; src.fire("timeupdate"); // fresh value at the event, 20 ms ahead of the projection
  assert.ok(Math.abs(clock.now() - 3020) < 1e-9);
  assert.equal(clock.driftStats().n, 1, "play anchors do not count as drift"); assert.ok(Math.abs(clock.driftStats().mean - 20) < 1e-9);
  src.currentTime = 3.5; src.fire("pause"); src.paused = true;
  wall += 10000;
  assert.equal(clock.now(), 3500, "paused: holds the anchored value");
  src.currentTime = 9.0; src.fire("seeked");
  assert.equal(clock.now(), 9000);
  clock.detach();
  src.currentTime = 20; src.fire("timeupdate");
  assert.equal(clock.now(), 9000, "detached: no longer listening");
});

test("a stall holds media time until playing resumes; playback rate scales the projection", () => {
  let wall = 0;
  const clock = new MediaClock(() => wall);
  const src = fakeSource();
  clock.attach(src);
  src.paused = false; src.currentTime = 10; src.fire("play");
  wall += 1000; assert.equal(clock.now(), 11000);
  src.currentTime = 11; src.fire("waiting"); // buffering: the clock stops
  wall += 3000; assert.equal(clock.now(), 11000, "held through the stall");
  src.currentTime = 11; src.fire("playing");
  wall += 500; assert.equal(clock.now(), 11500);
  (src as unknown as { playbackRate: number }).playbackRate = 2; src.currentTime = 11.5; src.fire("ratechange");
  wall += 500; assert.equal(clock.now(), 12500, "2x rate projects twice as fast");
});
