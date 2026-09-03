import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  parseVtt, normalizeVisibleText, visibleTokens, sha256Hex, cueTextHash, hashMatches,
  validateProfile, formatValidation, speakerLabelAt, shouldShowLabel, DEFAULT_LABEL_RULES,
  resolveTrack, layoutActiveSet, activeAt, resolveAlone, isSoundCue, fontScaleFor, deliveryFontScale, maxLoud, activeSoundEvents, nativeWordSegments, heightPctForLoudness,
  NATIVE_VEGA_CAPABILITIES, OVERLAY_CAPABILITIES,
  type CompanionProfile,
} from "../src/index.ts";

const VTT = `WEBVTT

c001
00:00:01.200 --> 00:00:03.600
<v Maya>Did you bring it?

c002
00:00:04.000 --> 00:00:06.800
<v Daniel>It's in the envelope.

c003
00:00:07.100 --> 00:00:10.200
<v Maya>Don't let him <b>see</b> it.

c004
00:00:11.000 --> 00:00:12.600
[glass shatters off-screen]

c005
00:00:13.000 --> 00:00:15.000
<v Unknown>Too late.

c006
00:00:14.000 --> 00:00:16.000
<v Daniel>Who is that?
`;
const { cues } = parseVtt(VTT);
const h = (id: string) => cueTextHash(cues.find((c) => c.id === id)!.rawText);

function profile(overrides: Partial<CompanionProfile> = {}): CompanionProfile {
  return {
    schemaVersion: "0.1",
    canonicalTrack: "captions.en.vtt",
    speakers: {
      maya: { label: "MAYA", genericLabel: "WOMAN", color: "speaker-1", revealAtMs: 0 },
      daniel: { label: "DANIEL", genericLabel: "MAN", color: "speaker-2", revealAtMs: 0 },
      unknown: { label: "AMARA", genericLabel: "UNKNOWN VOICE", color: "neutral", revealAtMs: 60000 },
    },
    shots: [
      { id: "s1", startMs: 0, endMs: 10500 },
      { id: "s2", startMs: 10500, endMs: 20000, protected: [{ x: 0.0, y: 0.5, w: 0.5, h: 0.5, reason: "face" }] },
    ],
    cues: {
      c001: { textHash: h("c001"), status: "verified", speaker: "maya", lanes: ["lower_left", "bottom_center"], provenance: "human_editor" },
      c002: { textHash: h("c002"), status: "verified", speaker: "daniel", lanes: ["lower_right", "bottom_center"] },
      c003: { textHash: h("c003"), status: "verified", speaker: "maya", lanes: ["lower_left", "bottom_center"], emphasis: [{ tokenIndex: 3, kind: "weight" }] },
      c004: { textHash: h("c004"), status: "verified", sound: { direction: "right" }, lanes: ["lower_right", "bottom_center"] },
      c005: { textHash: h("c005"), status: "verified", speaker: "unknown", lanes: ["bottom_center"] },
      c006: { textHash: h("c006"), status: "proposed", speaker: "daniel", lanes: ["lower_right", "bottom_center"], provenance: "automated_suggestion" },
    },
    ...overrides,
  };
}

// ---------- normalization + hashing ----------

test("visible text normalization strips tags, decodes entities, collapses whitespace, keeps case", () => {
  assert.equal(normalizeVisibleText("<v Maya>Don't let him <b>see</b> it."), "Don't let him see it.");
  assert.equal(normalizeVisibleText("  A &amp; B\n\tC  "), "A & B C");
  assert.equal(normalizeVisibleText("café"), "café");
  assert.deepEqual(visibleTokens("<v X>one  two\nthree"), ["one", "two", "three"]);
});

test("sha256 matches node crypto on ascii and unicode", () => {
  for (const s of ["", "abc", "Don't let him see it.", "café ☕ 𝄞"]) {
    assert.equal(sha256Hex(s), createHash("sha256").update(s, "utf8").digest("hex"));
  }
});

test("cue hash is stable across markup differences and detects text changes", () => {
  assert.equal(cueTextHash("<v Maya>Hi <b>there</b>"), cueTextHash("Hi there"));
  assert.ok(hashMatches(cueTextHash("Hi there"), "<i>Hi</i> there"));
  assert.ok(!hashMatches(cueTextHash("Hi there"), "Hi there!"));
  assert.ok(!hashMatches(undefined, "x"));
});

// ---------- schema validation ----------

test("valid profile passes with a warning for the proposed cue", () => {
  const r = validateProfile(profile(), cues);
  assert.ok(r.ok, formatValidation(r));
  assert.ok(r.warnings.some((w) => w.path === "$.cues.c006.status"));
});

test("validator reports actionable errors", () => {
  const bad: any = profile();
  bad.cues.c001.textHash = "sha256:" + "0".repeat(64);      // stale
  bad.cues.c002.speaker = "ghost";                            // unknown speaker
  bad.cues.c003.lanes = ["upper_left"];                       // invalid lane
  bad.cues.c003.emphasis = [{ tokenIndex: 99, kind: "weight" }];
  bad.cues.c004.sound = { direction: "up" };
  bad.cues.c999 = { textHash: h("c001"), status: "verified" }; // missing canonical cue
  bad.cues.c005.status = "approved";
  bad.speakers.maya.color = "pink";
  bad.speakers.daniel.revealAtMs = -5;
  bad.shots.push({ id: "s3", startMs: 5000, endMs: 9000 });    // overlaps s1
  bad.shots[1].protected.push({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 });
  const r = validateProfile(bad, cues);
  assert.ok(!r.ok);
  const paths = r.errors.map((e) => e.path);
  for (const p of ["$.cues.c001.textHash", "$.cues.c002.speaker", "$.cues.c003.lanes[0]", "$.cues.c003.emphasis[0].tokenIndex", "$.cues.c004.sound.direction", "$.cues.c999", "$.cues.c005.status", "$.speakers.maya.color", "$.speakers.daniel.revealAtMs", "$.shots", "$.shots[1].protected[1]"]) {
    assert.ok(paths.includes(p), `expected error at ${p}; got ${paths.join(", ")}`);
  }
  assert.ok(r.errors.find((e) => e.path === "$.cues.c001.textHash")!.hint!.includes("expected sha256:"));
});

test("unsupported schema version and non-object profiles fail closed", () => {
  assert.ok(!validateProfile({ schemaVersion: "9.9" }, cues).ok);
  assert.ok(!validateProfile("nope", cues).ok);
  assert.ok(!validateProfile(null, cues).ok);
});

// ---------- labels ----------

test("reveal policy uses the generic label before revealAtMs", () => {
  const def = { label: "AMARA", genericLabel: "UNKNOWN VOICE", revealAtMs: 60000 };
  assert.deepEqual(speakerLabelAt(def, 13000), { label: "UNKNOWN VOICE", revealed: false });
  assert.deepEqual(speakerLabelAt(def, 60000), { label: "AMARA", revealed: true });
});

test("label frequency rule: change, gap, overlap, shot, off-screen, reveal, fallback", () => {
  const base = { isSound: false, startMs: 5000, overlaps: false, offScreen: false, labelChanged: false } as const;
  const prev = { speakerId: "a", endMs: 4000, shotId: "s1", labelShown: true, fellBack: false };
  assert.equal(shouldShowLabel({ ...base, speakerId: "a" }).reason, "first_cue");
  assert.equal(shouldShowLabel({ ...base, speakerId: "b", prev }).reason, "speaker_change");
  assert.equal(shouldShowLabel({ ...base, speakerId: "a", prev, shotId: "s1" }).reason, "same_speaker_run");
  assert.equal(shouldShowLabel({ ...base, speakerId: "a", prev, shotId: "s2" }).reason, "shot_change");
  assert.equal(shouldShowLabel({ ...base, speakerId: "a", prev, startMs: 8000 }).reason, "return_after_gap");
  assert.equal(shouldShowLabel({ ...base, speakerId: "a", prev, overlaps: true }).reason, "overlap");
  assert.equal(shouldShowLabel({ ...base, speakerId: "a", prev, offScreen: true }).reason, "off_screen");
  assert.equal(shouldShowLabel({ ...base, speakerId: "a", prev, labelChanged: true }).reason, "reveal");
  assert.equal(shouldShowLabel({ ...base, speakerId: "a", prev: { ...prev, fellBack: true } }).reason, "prior_fallback");
  assert.equal(shouldShowLabel({ ...base, speakerId: undefined, isSound: true }).show, false);
  assert.equal(shouldShowLabel({ ...base, speakerId: "a", prev }, { ...DEFAULT_LABEL_RULES, labelEveryCue: true }).reason, "every_cue");
});

// ---------- resolver pass 1 ----------

const NATIVE = { viewer: { mode: "speaker-aware" as const, reducedMotion: true }, capabilities: NATIVE_VEGA_CAPABILITIES };
const OVERLAY = { viewer: { mode: "detailed" as const, reducedMotion: true }, capabilities: OVERLAY_CAPABILITIES };

test("standard mode emits canonical text only", () => {
  const r = resolveTrack(cues, profile(), { ...NATIVE, viewer: { mode: "standard", reducedMotion: true } });
  assert.equal(r.length, 6);
  assert.ok(r.every((c) => c.appliedFeatures.length === 0 && c.candidateLanes.join() === "bottom_center"));
  assert.equal(r[2].text, "Don't let him see it.");
});

test("speaker-aware: verified labels, lanes, reveal, proposed ignored, canonical text intact", () => {
  const r = resolveTrack(cues, profile(), NATIVE);
  assert.equal(r[0].speakerLabel, "MAYA");
  assert.deepEqual(r[0].candidateLanes, ["lower_left", "bottom_center"]);
  assert.equal(r[1].speakerLabel, "DANIEL");
  assert.equal(r[2].speakerLabel, "MAYA", "speaker changed back so the label shows");
  assert.equal(r[3].isSound, true);
  assert.equal(r[3].speakerLabel, undefined);
  assert.equal(r[4].speakerLabel, "UNKNOWN VOICE", "reveal at 60 s has not passed");
  assert.ok(r[4].fallbackReasons.includes("reveal_pending"));
  // c006 is proposed: companion metadata ignored, but the <v Daniel> span still gives a label (compat rung) and no lane.
  assert.ok(r[5].fallbackReasons.includes("metadata_unverified"));
  assert.deepEqual(r[5].candidateLanes, ["bottom_center"]);
  assert.equal(r[5].speakerLabel, "DANIEL");
  assert.ok(r.every((c, i) => c.text === cues[i].plainText));
  // Native path cannot colour or emphasise.
  // The platform renderer honours WebVTT colour classes (FL-022), so the token is available natively too.
  assert.equal(r[0].speakerToken, "speaker-1");
  assert.ok(!r[0].fallbackReasons.includes("color_unsupported"));
  assert.equal(r[2].staticEmphasis, undefined);
});

test("detailed mode with overlay capabilities adds colour, emphasis, and sound direction", () => {
  const r = resolveTrack(cues, profile(), OVERLAY);
  assert.equal(r[0].speakerToken, "speaker-1");
  assert.deepEqual(r[2].staticEmphasis, [{ tokenIndex: 3, kind: "weight" }]);
  assert.equal(r[3].soundDirection, "right");
  assert.equal(r[3].text, "[glass shatters off-screen]", "sound text is canonical and always present");
});

test("stale hash removes the enhancement, never the text", () => {
  const p = profile(); (p.cues as any).c001.textHash = "sha256:" + "f".repeat(64);
  const r = resolveTrack(cues, p, NATIVE);
  assert.ok(r[0].fallbackReasons.includes("canonical_mismatch"));
  assert.deepEqual(r[0].candidateLanes, ["bottom_center"]);
  assert.equal(r[0].text, "Did you bring it?");
  assert.equal(r[0].speakerLabel, "MAYA", "the <v> span still supplies a canonical label");
});

test("missing profile: voice spans give labels and optional lane hints (compat rung)", () => {
  const r = resolveTrack(cues, null, { ...NATIVE, voiceLaneHints: { Maya: "lower_left", Daniel: "lower_right" } });
  assert.equal(r[0].speakerLabel, "MAYA");
  assert.deepEqual(r[0].candidateLanes, ["lower_left", "bottom_center"]);
  assert.ok(r[0].fallbackReasons.includes("metadata_missing"));
  const r2 = resolveTrack(cues, null, NATIVE);
  assert.deepEqual(r2[0].candidateLanes, ["bottom_center"]);
});

test("unknown speaker id falls back to the voice span or nothing", () => {
  const p = profile(); (p.cues as any).c001.speaker = "ghost";
  const r = resolveTrack(cues, p, NATIVE);
  assert.ok(r[0].fallbackReasons.includes("speaker_unknown"));
  assert.equal(r[0].speakerLabel, "MAYA");
});

test("a throwing cue is isolated as Standard and later cues continue", () => {
  const p = profile();
  Object.defineProperty(p.cues!, "c002", { get() { throw new Error("boom"); }, enumerable: true });
  const errors: string[] = [];
  const r = resolveTrack(cues, p, { ...NATIVE, onError: (id) => errors.push(id) });
  assert.deepEqual(errors, ["c002"]);
  assert.ok(r[1].fallbackReasons.includes("resolver_exception"));
  assert.equal(r[1].text, "It's in the envelope.");
  assert.equal(r[2].speakerLabel, "MAYA");
});

// ---------- resolver pass 2 ----------

test("layout: side lanes at normal size, bottom at very_large, protected region rejects", () => {
  const e = resolveTrack(cues, profile(), NATIVE);
  const c1 = activeAt(e, 2000);
  assert.equal(layoutActiveSet(c1, { fontScale: fontScaleFor({ textSize: "normal" }) })[0].lane, "lower_left");
  const big = layoutActiveSet(c1, { fontScale: fontScaleFor({ textSize: "very_large" }) })[0];
  assert.equal(big.lane, "bottom_center");
  assert.ok(big.fallbackReasons.includes("size_rejected") && big.fallbackReasons.includes("no_safe_lane"));
  assert.equal(big.speakerLabel, "MAYA", "feature-level fallback keeps the label");
  const prot = layoutActiveSet(c1, { fontScale: 1, protectedRegions: [{ x: 0, y: 0.5, w: 0.5, h: 0.5 }] })[0];
  assert.equal(prot.lane, "bottom_center");
  assert.ok(prot.fallbackReasons.includes("protected_region"));
});

test("layout: two overlapping speakers take separate lanes; forced to bottom they stack with labels", () => {
  const e = resolveTrack(cues, profile(), NATIVE);
  const both = activeAt(e, 14500); // c005 (unknown, bottom only) + c006 (proposed -> bottom)
  const laid = layoutActiveSet(both, { fontScale: 1 });
  assert.deepEqual(laid.map((r) => r.lane), ["bottom_center", "bottom_center"]);
  assert.deepEqual(laid.map((r) => r.stackIndex), [0, 1]);
  assert.ok(laid.every((r) => r.speakerLabel), "bottom stacking forces labels on");
  // Two verified speakers with side lanes: separate lanes.
  const p = profile(); (p.cues as any).c006.status = "verified";
  const e2 = resolveTrack(cues, p, NATIVE);
  const pair = layoutActiveSet(activeAt(e2, 14500), { fontScale: 1 });
  assert.deepEqual(pair.map((r) => r.lane).sort(), ["bottom_center", "lower_right"]);
});

test("layout: lane continuity within a shot and collision avoidance", () => {
  const e = resolveTrack(cues, profile(), NATIVE);
  const prevLanes = new Map([["maya", "lower_left" as const]]);
  const r = layoutActiveSet(activeAt(e, 8000), { fontScale: 1, previousLaneBySpeaker: prevLanes });
  assert.equal(r[0].lane, "lower_left");
  const pre = layoutActiveSet(activeAt(e, 8000), { fontScale: 1, protectedRegions: [{ x: 0.05, y: 0.55, w: 0.4, h: 0.4 }] });
  assert.equal(pre[0].lane, "bottom_center");
});

test("resolveAlone lays out the whole track deterministically", () => {
  const e = resolveTrack(cues, profile(), NATIVE);
  const all = resolveAlone(e, { fontScale: 1 });
  assert.equal(all.length, 6);
  // c004 "[glass shatters off-screen]" fits the right lane at normal size (two lines, no label).
  assert.deepEqual(all.map((r) => r.lane), ["lower_left", "lower_right", "lower_left", "lower_right", "bottom_center", "bottom_center"]);
  const large = resolveAlone(e, { fontScale: 1.5 });
  // At "large" every labelled dialogue cue drops to the bottom; the short unlabelled sound cue still fits its lane.
  assert.deepEqual(large.map((r) => r.lane), ["bottom_center", "bottom_center", "bottom_center", "lower_right", "bottom_center", "bottom_center"]);
  assert.ok(isSoundCue(cues[3]) && !isSoundCue(cues[0]));
});

test("resolveAlone applies each cue's own shot protection (native path)", () => {
  const e = resolveTrack(cues, profile(), NATIVE);
  const face = [{ x: 0, y: 0.45, w: 0.5, h: 0.55 }];
  // Protect the lower left only while c003 is on screen: c001 (same speaker, same lane) is untouched.
  const laid = resolveAlone(e, { fontScale: 1 }, (c) => (c.startMs >= 7000 && c.startMs < 10500 ? face : []));
  const byId = Object.fromEntries(laid.map((r) => [r.cueId, r]));
  assert.equal(byId.c001.lane, "lower_left");
  assert.equal(byId.c003.lane, "bottom_center");
  assert.ok(byId.c003.fallbackReasons.includes("protected_region"));
  assert.equal(byId.c003.speakerLabel, "MAYA", "placement fallback keeps the verified label");
  assert.equal(byId.c003.text, "Don't let him see it.");
});


test("dual-speaker cue gets a combined label and bottom lane; bracketed canonical id suppresses the label", () => {
  const vtt = `WEBVTT\n\nd1\n00:00:01.000 --> 00:00:03.000\n-Know what?\n-Whose it is. Obviously.\n\nd2\n00:00:04.000 --> 00:00:06.000\n[unknown voice] Don't open that.\n`;
  const { cues: cs } = parseVtt(vtt);
  const prof: CompanionProfile = {
    schemaVersion: "0.1",
    speakers: { maya: { label: "MAYA" }, daniel: { label: "DANIEL" }, amara: { label: "AMARA", genericLabel: "UNKNOWN VOICE", revealAtMs: 30000 } },
    cues: {
      d1: { textHash: cueTextHash(cs[0].rawText), status: "verified", speakers: ["daniel", "maya"], lanes: ["bottom_center"] },
      d2: { textHash: cueTextHash(cs[1].rawText), status: "verified", speaker: "amara", lanes: ["bottom_center"] },
    },
  };
  assert.ok(validateProfile(prof, cs).ok, formatValidation(validateProfile(prof, cs)));
  const r = resolveTrack(cs, prof, NATIVE);
  assert.equal(r[0].speakerLabel, "DANIEL, then MAYA");
  assert.equal(r[0].text, "-Know what?\n-Whose it is. Obviously.");
  assert.equal(r[1].speakerLabel, undefined, "text already carries [unknown voice]");
  assert.ok(r[1].fallbackReasons.includes("canonical_id_present"));
  const bad: any = JSON.parse(JSON.stringify(prof)); bad.cues.d1.speakers = ["daniel"];
  assert.ok(!validateProfile(bad, cs).ok);
});

// ---------- schema 0.2: words, delivery, sounds ----------

const DETAILED_02 = { ...OVERLAY, capabilities: { ...OVERLAY.capabilities, wordTiming: true, deliveryTypography: true } };

function profile02(): CompanionProfile {
  const p = profile();
  p.schemaVersion = "0.2";
  // c001 "Did you bring it?" 1200-3600
  p.cues!.c001.words = [
    { i: 0, startMs: 1200, endMs: 1500, loud: 0, status: "verified" },
    { i: 1, startMs: 1500, endMs: 1700, status: "verified" },
    { i: 2, startMs: 1700, endMs: 2100, loud: 2, caps: true, status: "verified" },
    { i: 3, startMs: 2100, endMs: 2600, stretch: "iiit?", status: "verified" },
  ];
  p.cues!.c001.delivery = { loud: 1, pace: 0, manner: "whispers", status: "verified", width: 1 };
  p.sounds = [{ id: "sfx1", startMs: 5000, endMs: 6000, label: "door slams", direction: "left", status: "verified" }];
  return p;
}

test("0.2 validator: words must index real tokens, stay inside the cue, and stretch must collapse to the token", () => {
  const p = profile02();
  assert.ok(validateProfile(p, cues).ok, formatValidation(validateProfile(p, cues)));
  const bad = profile02();
  bad.cues!.c001.words!.push({ i: 9, startMs: 1200, endMs: 1300 });
  bad.cues!.c001.words![0].startMs = 100;
  bad.cues!.c001.words![3].stretch = "itty";
  bad.cues!.c001.delivery!.loud = 5 as never;
  bad.sounds![0].label = "[door]";
  const r = validateProfile(bad, cues);
  const paths = r.errors.map((e) => e.path);
  for (const want of ["$.cues.c001.words[4].i", "$.cues.c001.words[0]", "$.cues.c001.words[3].stretch", "$.cues.c001.delivery.loud", "$.sounds[0].label"]) assert.ok(paths.includes(want), `missing ${want} in ${paths.join(", ")}`);
});

test("0.2 resolver: verified words reach Detailed with caps and stretch applied; invalid words are dropped, the rest kept", () => {
  const e = resolveTrack(cues, profile02(), DETAILED_02);
  const c1 = e[0];
  assert.equal(c1.words?.length, 4);
  assert.deepEqual(c1.words!.map((w) => w.display), ["Did", "you", "BRING", "iiit?"]);
  assert.ok(c1.appliedFeatures.includes("word_timing") && c1.appliedFeatures.includes("word_caps") && c1.appliedFeatures.includes("word_stretch"));
  assert.deepEqual(c1.delivery, { loud: 1, pace: 0, manner: "whispers", width: 1 });
  // One bad word entry: it is dropped, the others survive, and the reason is recorded.
  const p = profile02(); p.cues!.c001.words![1].endMs = 99999;
  const c1b = resolveTrack(cues, p, DETAILED_02)[0];
  assert.equal(c1b.words?.length, 3);
  assert.ok(c1b.fallbackReasons.includes("words_invalid"));
  // Speaker-aware gets timings too (native colour classes, FL-022) but no typography: plain display text.
  const spk = resolveTrack(cues, profile02(), NATIVE)[0];
  assert.equal(spk.words?.length, 4);
  assert.deepEqual(spk.words!.map((w) => w.display), ["Did", "you", "bring", "it?"]);
  assert.ok(!spk.appliedFeatures.includes("word_caps"));
  // Viewer toggles off word highlighting and typography: plain words, plain sizes.
  const off = resolveTrack(cues, profile02(), { ...DETAILED_02, viewer: { mode: "detailed", reducedMotion: true, wordHighlight: false, deliveryTypography: false } })[0];
  assert.equal(off.words, undefined);
  assert.ok(off.fallbackReasons.includes("word_timing_off") && off.fallbackReasons.includes("delivery_off"));
});

test("0.2 layout: a shouted cue is budgeted at its larger size; sound events are active only while verified", () => {
  const e = resolveTrack(cues, profile02(), DETAILED_02);
  const laid = layoutActiveSet(activeAt(e, 2000), { fontScale: 1 });
  assert.equal(laid[0].words?.length, 4, "words pass through layout");
  assert.equal(deliveryFontScale(2), 1.3);
  assert.equal(maxLoud(e[0]), 2);
  // A long shouted cue no longer fits a side lane at normal system size.
  const p = profile02(); p.cues!.c003.words = [{ i: 0, startMs: 7100, endMs: 7400, loud: 2 }]; p.cues!.c003.delivery = { loud: 2 };
  const e3 = resolveTrack(cues, p, DETAILED_02);
  const l3 = layoutActiveSet(activeAt(e3, 8000), { fontScale: 1.5 })[0];
  assert.equal(l3.lane, "bottom_center");
  assert.ok(l3.fallbackReasons.includes("size_rejected"));
  assert.equal(activeSoundEvents(profile02(), 5500).length, 1);
  assert.equal(activeSoundEvents(profile02(), 6500).length, 0);
  const unv = profile02(); unv.sounds![0].status = "proposed";
  assert.equal(activeSoundEvents(unv, 5500).length, 0);
  assert.equal(activeSoundEvents(null, 5500).length, 0);
});

test("nativeWordSegments: one native cue per word boundary, spoken prefix in a colour span, whitespace kept", () => {
  const words = [
    { i: 0, startMs: 1200, endMs: 1500, loud: 0 as const, pitch: 0 as const, display: "Did" },
    { i: 2, startMs: 1700, endMs: 2100, loud: 0 as const, pitch: 0 as const, display: "bring" },
    { i: 3, startMs: 2100, endMs: 2600, loud: 0 as const, pitch: 0 as const, display: "it?" },
  ];
  const segs = nativeWordSegments("Did you\nbring it?", words, 1200, 3600, "yellow", "MAYA");
  assert.deepEqual(segs.map((x) => [x.startMs, x.endMs]), [[1200, 1700], [1700, 2100], [2100, 3600]]);
  assert.equal(segs[0].text, "<c.yellow>MAYA\nDid</c> you\nbring it?");
  assert.equal(segs[1].text, "<c.yellow>MAYA\nDid you\nbring</c> it?", "the untimed word follows the next spoken one");
  assert.equal(segs[2].text, "<c.yellow>MAYA\nDid you\nbring it?</c>");
  // No timings: a single segment, whole cue coloured (attribution only).
  const one = nativeWordSegments("Hello there", undefined, 0, 1000, "cyan");
  assert.equal(one.length, 1); assert.equal(one[0].text, "<c.cyan>Hello there</c>");
});

test("continuous loudness: 7% at the median, 4.5% floor, 13% ceiling, levels when unmeasured", () => {
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(heightPctForLoudness(0, 0), 0.07);
  near(heightPctForLoudness(0, -8), 0.045);
  near(heightPctForLoudness(0, -20), 0.045);
  near(heightPctForLoudness(0, 7), 0.10);
  near(heightPctForLoudness(0, 14), 0.13);
  near(heightPctForLoudness(0, 30), 0.13);
  assert.equal(heightPctForLoudness(2, undefined), 0.13);
  assert.equal(heightPctForLoudness(-1, undefined), 0.045);
});

test("validator warns about reading rate above 180 wpm", () => {
  const fast = parseVtt("WEBVTT\n\nf1\n00:00:01.000 --> 00:00:02.000\none two three four five six seven\n").cues;
  const r = validateProfile({ schemaVersion: "0.2" }, fast);
  assert.ok(r.ok);
  assert.ok(r.warnings.some((w) => w.path === "vtt#f1" && /wpm/.test(w.message)));
});

test("fail closed: a word or delivery entry without a status is not verified, and machine-verified data is reported", () => {
  const p = profile02();
  delete p.cues!.c001.words![1].status;
  delete p.cues!.c001.delivery!.status;
  const e = resolveTrack(cues, p, DETAILED_02)[0];
  assert.equal(e.words?.length, 3);
  assert.ok(e.fallbackReasons.includes("words_unverified"));
  assert.equal(e.delivery, undefined);
  assert.ok(e.fallbackReasons.includes("delivery_unverified"));
  const q = profile02(); q.cues!.c001.words![0].verifiedBy = "score>=0.5";
  const r = validateProfile(q, cues);
  assert.ok(r.warnings.some((w) => w.path === "$" && /MACHINE-VERIFIED/.test(w.message)));
});

test("colour never stands alone: a coloured cue that lost its label to the frequency rule and sits at the bottom gets the label back", () => {
  // c003 is Maya again after c002 (Daniel), so its label shows; make c002 Maya too so c003's label is suppressed.
  const p = profile(); p.cues!.c002.speaker = "maya"; p.cues!.c002.lanes = ["lower_left", "bottom_center"];
  const e = resolveTrack(cues, p, OVERLAY);
  const c3 = e[2];
  assert.equal(c3.speakerLabel, undefined, "pass 1 suppressed the repeat label");
  assert.equal(c3.suppressedLabel, "MAYA");
  // Forced to the bottom (a very large size rejects the side lane): the label comes back with the colour.
  const laid = layoutActiveSet([c3], { fontScale: 2 })[0];
  assert.equal(laid.lane, "bottom_center");
  assert.equal(laid.speakerLabel, "MAYA");
  assert.ok(!laid.fallbackReasons.includes("label_suppressed_by_rule"));
});

test("resolveAlone: chained overlaps follow the pair rule; occupancy is time-aware", () => {
  const vtt = "WEBVTT\n\na1\n00:00:01.000 --> 00:00:03.000\n<v Maya>One\n\nb1\n00:00:02.000 --> 00:00:05.000\n<v Daniel>Two\n\nc1\n00:00:04.000 --> 00:00:06.000\n<v Amara>Three\n";
  const cs = parseVtt(vtt).cues;
  const prof: CompanionProfile = { schemaVersion: "0.1", speakers: { maya: { label: "MAYA" }, daniel: { label: "DANIEL" }, amara: { label: "AMARA" } },
    cues: { a1: { textHash: cueTextHash(cs[0].rawText), status: "verified", speaker: "maya", lanes: ["lower_left"] }, b1: { textHash: cueTextHash(cs[1].rawText), status: "verified", speaker: "daniel", lanes: ["lower_left"] }, c1: { textHash: cueTextHash(cs[2].rawText), status: "verified", speaker: "amara", lanes: ["lower_left"] } } };
  const e = resolveTrack(cs, prof, NATIVE);
  const laid = resolveAlone(e, { fontScale: 1 });
  // A chain of overlaps is laid out together with time-aware occupancy: b1 collides with a1 (both on screen
  // 2–3 s) and drops to the bottom; a1 keeps its lane; c1 (4–6 s) never shares the screen with a1, so it takes
  // the left lane. No instant has more than two dialogue cues, so the three-cue bottom-stack rule stays off.
  const lanes = Object.fromEntries(laid.map((r) => [r.cueId, r.lane]));
  assert.deepEqual(lanes, { a1: "lower_left", b1: "bottom_center", c1: "lower_left" });
  // With a gap between b1 and c1 the result is the same: c1 is alone on screen and takes the left lane.
  const vtt2 = "WEBVTT\n\na1\n00:00:01.000 --> 00:00:03.000\n<v Maya>One\n\nb1\n00:00:02.000 --> 00:00:03.500\n<v Daniel>Two\n\nc1\n00:00:03.600 --> 00:00:06.000\n<v Amara>Three\n";
  const cs2 = parseVtt(vtt2).cues;
  const prof2: CompanionProfile = { ...prof, cues: { a1: { ...prof.cues!.a1, textHash: cueTextHash(cs2[0].rawText) }, b1: { ...prof.cues!.b1, textHash: cueTextHash(cs2[1].rawText) }, c1: { ...prof.cues!.c1, textHash: cueTextHash(cs2[2].rawText) } } };
  const lanes2 = Object.fromEntries(resolveAlone(resolveTrack(cs2, prof2, NATIVE), { fontScale: 1 }).map((r) => [r.cueId, r.lane]));
  assert.deepEqual(lanes2, { a1: "lower_left", b1: "bottom_center", c1: "lower_left" });
  // A sound cue's box is time-aware too: a sound in the right lane at 1–2 s does not block dialogue at 5–6 s.
  const vtt3 = "WEBVTT\n\ns1\n00:00:01.000 --> 00:00:02.000\n[door slams]\n\nd1\n00:00:05.000 --> 00:00:06.000\n<v Daniel>Later\n";
  const cs3 = parseVtt(vtt3).cues;
  const prof3: CompanionProfile = { schemaVersion: "0.1", speakers: { daniel: { label: "DANIEL" } }, cues: { s1: { textHash: cueTextHash(cs3[0].rawText), status: "verified", lanes: ["lower_right"] }, d1: { textHash: cueTextHash(cs3[1].rawText), status: "verified", speaker: "daniel", lanes: ["lower_right"] } } };
  const lanes3 = Object.fromEntries(resolveAlone(resolveTrack(cs3, prof3, NATIVE), { fontScale: 1 }).map((r) => [r.cueId, r.lane]));
  assert.deepEqual(lanes3, { s1: "lower_right", d1: "lower_right" });
});

test("speaker_unavailable is reported when the companion could not supply the speaker and the <v> span did", () => {
  const p = profile(); p.cues!.c001.status = "proposed";
  const e = resolveTrack(cues, p, NATIVE)[0];
  assert.equal(e.speakerLabel, "MAYA");
  assert.ok(e.fallbackReasons.includes("metadata_unverified") && e.fallbackReasons.includes("speaker_unavailable"));
});

test("nativeWordSegments: before the first word the label alone carries the colour (read-ahead)", () => {
  const words = [
    { i: 0, startMs: 1500, endMs: 1700, loud: 0 as const, pitch: 0 as const, display: "Did" },
    { i: 1, startMs: 1700, endMs: 2000, loud: 0 as const, pitch: 0 as const, display: "you" },
  ];
  const segs = nativeWordSegments("Did you", words, 1200, 3600, "yellow", "MAYA");
  assert.deepEqual(segs.map((x) => [x.startMs, x.endMs]), [[1200, 1500], [1500, 1700], [1700, 3600]]);
  assert.equal(segs[0].text, "<c.yellow>MAYA</c>\nDid you", "label coloured, words white, no span after the line break (FL-023)");
  assert.equal(segs[1].text, "<c.yellow>MAYA\nDid</c> you");
  const noLabel = nativeWordSegments("Did you", words, 1200, 3600, "yellow");
  assert.equal(noLabel[0].text, "Did you", "no label: plain read-ahead text");
});

test("a cue can be off camera on its own (line over a cutaway): italic flag set, character otherwise on screen", () => {
  const base = profile();
  const prof = profile({ cues: { ...base.cues, c002: { ...base.cues.c002, offScreen: true, lanes: ["bottom_center"] } } });
  const r = resolveTrack(cues, prof, OVERLAY);
  assert.equal(r[1].offScreen, true, "cue-level flag honoured");
  assert.equal(r[0].offScreen, false, "other cues of on-screen speakers unaffected");
  assert.deepEqual(r[1].candidateLanes, ["bottom_center"]);
});

test("fail-closed: cue-level offScreen is ignored on an unverified cue, and a rule cannot verify a cue", () => {
  const base = profile();
  const prof = profile({ cues: { ...base.cues,
    c002: { ...base.cues.c002, status: "proposed", offScreen: true },
    c003: { ...base.cues.c003, verifiedBy: "auto:diarization>=0.6+track" },
  } });
  const r = resolveTrack(cues, prof, OVERLAY);
  assert.equal(r[1].offScreen, false, "unverified cue: the flag does not apply");
  assert.ok(r[1].fallbackReasons.includes("metadata_unverified"));
  assert.ok(r[2].fallbackReasons.includes("metadata_unverified"), "a rule-verified cue is treated as unverified");
  assert.equal(r[2].speakerToken, undefined);
});

test("validator: cue offScreen must be a boolean", () => {
  const base = profile();
  const v = validateProfile(profile({ cues: { ...base.cues, c001: { ...base.cues.c001, offScreen: "yes" as unknown as boolean } } }), cues);
  assert.ok(v.errors.some((e) => e.path.endsWith("c001.offScreen")));
});

test("nativeWordSegments: after the last timed word ends, the rest of the line colours (no half-coloured tail)", () => {
  const words = [
    { i: 0, startMs: 1200, endMs: 1500, loud: 0 as const, pitch: 0 as const, display: "Did" },
    { i: 1, startMs: 1500, endMs: 1900, loud: 0 as const, pitch: 0 as const, display: "you" },
  ];
  const segs = nativeWordSegments("Did you bring it?", words, 1200, 3600, "yellow");
  assert.deepEqual(segs.map((x) => [x.startMs, x.endMs]), [[1200, 1500], [1500, 1900], [1900, 3600]]);
  assert.equal(segs[1].text, "<c.yellow>Did you</c> bring it?");
  assert.equal(segs[2].text, "<c.yellow>Did you bring it?</c>", "untimed tail counts as spoken once the last timed word has ended");
});

test("the published JSON Schema accepts every shipped companion file (ajv)", async () => {
  const { readFileSync, readdirSync, existsSync } = await import("node:fs");
  const AjvMod = await import("ajv");
  const Ajv = (AjvMod as unknown as { default: new (o: object) => { compile: (s: object) => ((d: unknown) => boolean) & { errors?: unknown[] } } }).default;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(JSON.parse(readFileSync(new URL("../../../schema/companion-profile-0.2.schema.json", import.meta.url), "utf8")));
  const root = new URL("../../../assets/", import.meta.url).pathname;
  let n = 0;
  for (const d of readdirSync(root)) {
    const p = `${root}${d}/companion.en.json`;
    if (!existsSync(p)) continue;
    const ok = validate(JSON.parse(readFileSync(p, "utf8")));
    assert.ok(ok, `${d}: ${JSON.stringify((validate.errors ?? []).slice(0, 3))}`);
    n++;
  }
  assert.ok(n >= 5, `validated ${n} files`);
});
