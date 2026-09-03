import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVtt, parseTimestamp, activeCuesAt, stripTags } from "../src/vtt.ts";

const SAMPLE = `WEBVTT

NOTE prototype track

c001
00:00:01.200 --> 00:00:03.600
<v Maya>Did you bring it?

c002
00:00:04.000 --> 00:00:06.800 line:85% position:92% align:end
<v Daniel>It's in the envelope.

c003
00:00:07.100 --> 00:00:10.200
<v Maya>Don't let him <b>see</b> it.

c004
00:00:18.600 --> 00:00:20.000
[glass shatters off-screen]
`;

test("parses ids, times, settings, voices, and plain text", () => {
  const { cues, warnings } = parseVtt(SAMPLE);
  assert.equal(warnings.length, 0);
  assert.equal(cues.length, 4);
  assert.equal(cues[0].id, "c001");
  assert.equal(cues[0].startMs, 1200);
  assert.equal(cues[0].endMs, 3600);
  assert.equal(cues[0].voice, "Maya");
  assert.equal(cues[0].plainText, "Did you bring it?");
  assert.equal(cues[0].rawText, "<v Maya>Did you bring it?");
  assert.deepEqual(cues[1].settings, { line: "85%", position: "92%", align: "end" });
  assert.equal(cues[2].plainText, "Don't let him see it.");
  assert.equal(cues[3].voice, undefined);
  assert.equal(cues[3].plainText, "[glass shatters off-screen]");
});

test("raw text is never rewritten", () => {
  const { cues } = parseVtt(SAMPLE);
  assert.equal(cues[2].rawText, "<v Maya>Don't let him <b>see</b> it.");
});

test("cues without ids are skipped by default with a warning", () => {
  const { cues, warnings } = parseVtt(`WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nno id\n`);
  assert.equal(cues.length, 0);
  assert.match(warnings[0], /without identifier/);
});

test("duplicate ids keep the first cue", () => {
  const { cues, warnings } = parseVtt(`WEBVTT\n\nx\n00:00:00.000 --> 00:00:01.000\nA\n\nx\n00:00:02.000 --> 00:00:03.000\nB\n`);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].plainText, "A");
  assert.match(warnings[0], /Duplicate/);
});

test("timestamps: hours optional, minutes and seconds bounded", () => {
  assert.equal(parseTimestamp("00:00:01.200"), 1200);
  assert.equal(parseTimestamp("01:02.003"), 62003);
  assert.equal(parseTimestamp("00:61:00.000"), null);
  assert.equal(parseTimestamp("bogus"), null);
});

test("active cues use [start, end) and support overlap", () => {
  const { cues } = parseVtt(`WEBVTT\n\na\n00:00:01.000 --> 00:00:03.000\nA\n\nb\n00:00:02.000 --> 00:00:04.000\nB\n`);
  assert.deepEqual(activeCuesAt(cues, 999).map((c) => c.id), []);
  assert.deepEqual(activeCuesAt(cues, 1000).map((c) => c.id), ["a"]);
  assert.deepEqual(activeCuesAt(cues, 2500).map((c) => c.id), ["a", "b"]);
  assert.deepEqual(activeCuesAt(cues, 3000).map((c) => c.id), ["b"]);
});

test("stripTags handles voice with class and entities", () => {
  const r = stripTags("<v.loud Amara>Wait &amp; see</v>");
  assert.equal(r.voice, "Amara");
  assert.equal(r.plainText, "Wait & see");
});

test("rejects files without a WEBVTT header", () => {
  assert.throws(() => parseVtt("hello"), /missing WEBVTT header/);
});
