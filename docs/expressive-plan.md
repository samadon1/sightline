# Plan: from "safe enhancements" to expressive captions on real footage

Status: v2, September 2, 2026 (v1 written before reading the Caption with Intention design system; see docs/prior-art.md for what changed and why). Written in response to Samuel's direction that the current build is a strong foundation but is not yet what we want: real videos, and captions in the spirit of *Caption with Intention* and Google's *Expressive Captions*. This plan replaces the "do not reintroduce word-level timing" and "no emotion recognition" rules of spec v0.3 with a narrower, defensible version, and keeps everything else (native-first, hash-locked canonical text, verified gating, per-cue fallback, no runtime AI, no accounts).

## 1. What the two references actually do

**Caption with Intention** (Chicago Hearing Society, Academy RAISE partner; free design system, PDF + After Effects project + Roboto Flex): a manual design system, not software. Four devices: a colour per character; words turn from white to the character's colour as they are spoken (word-level timing); font size follows volume (small for quiet, large for loud); font weight follows pitch (heavier for low voices, lighter for high), all on one variable typeface. Sources: [captionwithintention.org](https://www.captionwithintention.org/), [LBB](https://lbbonline.com/news/behind-the-oscar-winning-caption-revolution), [Ads of the World case study](https://www.adsoftheworld.com/campaigns/caption-with-intention-case-study).

**Expressive Captions** (Android 14+, Live Caption, US English): on-device AI over live audio. Three devices: capitalisation for intensity ("HAPPY BIRTHDAY!"), lengthened words ("Noooooo"), and sound labels (laughter, applause, music; later clears throat, whistling, whispering). Each is a user toggle. Sources: [Google blog](https://blog.google/products-and-platforms/platforms/android/google-android-expressive-captions/), [android.com](https://www.android.com/accessibility/expressive-captions/), [Android Help](https://support.google.com/accessibility/android/answer/9350862?hl=en).

Neither runs on a TV against pre-authored, hash-locked caption files, and neither has a fallback story. That gap is still ours.

## 2. What we have (September 2)

- A Fire TV runtime with three levels; Standard and Speaker-aware drawn by the platform renderer, Detailed by an overlay driven by the same native cue clock. Verified on the VVD: labels, lanes, dual-speaker cues, concealed-voice reveal, proposed-cue gating, stale-hash fallback, protected regions, size fallback (simulated), zero lost cues, ~250 ms p95 event lag, 6 ms p95 on the JS clock.
- A companion profile (schema 0.1) with speakers, shots, per-cue speaker/lanes/emphasis/sound direction, hash and status.
- Synthesized stand-in footage only. No word timings. No loudness, pitch or pace. No sound-event labels beyond what the caption author typed. Viewer settings are not persisted.

## 3. Target (what "there" means)

A viewer on Fire TV watches a real film excerpt with real actors. In **Detailed** mode:

1. Each character has a colour (already); words turn from neutral to the speaker's colour as they are spoken.
2. Loud lines are larger, quiet lines smaller; shouted words may be capitalised; low voices heavier, high voices lighter.
3. Stretched deliveries render stretched ("Noooo"), with the canonical word still what the file says.
4. Important non-speech sounds get labels with a direction, including ones the caption author did not type, when an editor verified them.
5. Everything above is per-word or per-cue metadata that a person verified. Any feature that is missing, unverified or unsafe disappears for that word or cue and the approved caption remains. One action returns to Standard.

Speaker-aware stays as it is (the platform renderer cannot animate words). Standard stays untouched.

## 4. Principles that survive, and the two rules we change

Keep: canonical text is hash-locked and never rewritten; enhancements are metadata beside the WebVTT file; each enhancement has a status and only `verified` reaches the viewer; the viewer's system caption settings win; reduced motion on by default; no runtime AI; no accounts; per-feature fallback.

Change:
- **Word-level timing is back**, as `proposed` output of an offline forced-alignment step against the approved text, reviewed by a person. It never changes the words; it only times them.
- **"No emotion recognition" becomes "no emotion classification."** We measure delivery (loudness, pitch, pace, elongation) from the audio, which is what Caption with Intention maps to type. We do not label feelings. Any manner label ("[whispers]", "[sarcastic]") is human-authored.

Presentation variants (capitals, stretched words) are allowed only in Detailed, only when verified, and the hash still covers the canonical text; the variant is stored beside it.

## 5. Real footage now, our own shoot later

Waiting for a shoot blocks everything. Use openly licensed live-action film immediately:

- **Tears of Steel** (Blender Foundation, 2012, CC BY 3.0, 12 min, English dialogue, shouting, off-screen lines, robots, glass, explosions). Real actors, real room tone, real overlaps. Pick two 60–90 s excerpts (the opening argument on the bridge; the lab scene).
- Attribution card in the app's About screen and in the repo. Package as fMP4 HLS with the existing `tools/hls/make-hls.sh`.
- The Envelope and the micro-scenes remain the pilot instruments; they are re-conformed when shot. Tears of Steel becomes the demo and the development bench.

Decision needed from Samuel: confirm Tears of Steel under CC BY as demo footage (licence decisions are his).

## 6. Authoring pipeline (offline, on the Mac, output is always `proposed`)

`tools/author/` (Python, one command per stage, all writing into `assets/<scene>/`):

1. `extract-audio` — ffmpeg, mono 16 kHz WAV.
2. `align` — WhisperX forced alignment of the **existing** `captions.en.vtt` text to the audio: word start/end per cue. The transcript is not taken from ASR; ASR is used only when there is no caption file yet, and then the text goes through a human before it becomes canonical.
3. `delivery` — per word and per cue: RMS loudness (dBFS, relative to the scene's speech median), fundamental frequency (pyin) relative to that speaker's median, speech rate, and elongation (vowel duration versus the word's expected duration). Quantised: `loud` −1..+2, `pitch` −1..+1, `pace` −1..+1, `stretch` factor.
4. `sounds` — sound-event detection with an AudioSet-class model (YAMNet or PANNs, offline) producing `sounds[]` with start/end/label/confidence; direction left empty for a human.
5. `propose` — writes `companion.en.json` schema **0.2** with every new field `status: proposed`.
6. `review` — a local, single-page HTML in the browser: play the excerpt, see the words light up, adjust timings and levels, tick verified, save. Not part of the product; no server, no accounts. (The v0.3 "no creator studio" rule stays: this is a reviewer's page, not a product surface.)
7. `validate` and `bundle-assets` extended for 0.2.

AWS path (September 18 checkpoint, unchanged): Transcribe with word timestamps can replace stage 2 for the Builder mini-challenge; the rest is identical.

## 7. Schema 0.2 additions (sketch)

```
cues.c012: {
  ...0.1 fields...,
  words: [ { i: 0, startMs, endMs, loud: 1, pitch: 0, caps: false, stretch: "Nooo", status: "verified" }, ... ],
  delivery: { loud: 1, pace: 0, manner: "shouts", status: "verified" }
}
sounds: [ { id: "s1", startMs, endMs, label: "glass shatters", direction: "right", offScreen: true, status: "verified", provenance: "yamnet+human" } ]
```
`words[].i` indexes the canonical visible tokens (same tokeniser as emphasis). Word timings must lie inside the cue; loud/pitch/pace are small integers; `stretch` must reduce to the canonical token when repeated letters collapse. The validator enforces all of this.

## 7b. Rulebook: Caption with Intention, implemented to the letter

Detailed mode follows the CI Design System V1.0 (docs/prior-art.md, section 1): CI palette, Roboto Flex, 5% baseline with a 3%–12% volume range, weight from the speaker's pitch band (160–200 Hz regular), read-ahead in white at 90% opacity with colour at word onset, 90% black box, lower-20% work area, sound effects white in brackets and sized by loudness, ♫ for music, italic for off-camera voices. Our additions on top of CI: lanes, speaker labels, fallback, and viewer toggles (Caption Royale found every styled caption harder to read than plain, so each device stays optional).

## 8. Runtime (Detailed mode)

- Word colour reveal: the overlay renders the cue as spans; the anchored rAF clock (Measurement B, already there) flips each span from neutral to the speaker colour at its `startMs`. State updates happen at word boundaries only, never per frame.
- Size and weight: font size = system size × {0.85, 1, 1.15, 1.3}[loud]; weight by pitch. If a variable font can be bundled in the Vega app, use Roboto Flex; if not, three static weights. Size never exceeds the lane budget; the lane estimator takes the largest word level into account, and a cue that does not fit at its loud size falls back to normal size before it falls back to the bottom.
- Capitals and stretch: text transforms on verified words only.
- Sound labels: `sounds[]` become bracketed cues with direction markers in Detailed; in Speaker-aware and Standard they are ignored unless the caption file already carries them.
- Reduced motion: colour change is not motion; it stays on. A separate "Word highlighting" toggle lets a viewer turn it off.
- Fallback per word: any invalid or unverified word entry renders that word plainly; the cue keeps its colour and lane.
- Diagnostics panel shows per-word timing error against the clock so we can measure the reveal, not just the cue.

## 9. Build order (smallest vertical slice first)

| Week | Slice | Proof |
|---|---|---|
| Sep 2–8 | Tears of Steel excerpt packaged and playing on the VVD with a fair Standard track; settings persistence; `align` producing word timings; schema 0.2 words; word colour reveal in Detailed on device | capture of a real face with words lighting up; timing error table |
| Sep 9–15 | `delivery` (loud/pitch/pace/stretch) and size/weight/caps/stretch rendering; `sounds` and sound labels; review page; validator and fallback tests for every new field | side-by-side stills at quiet/normal/loud; fixture scene with corrupt word data |
| Sep 16–22 | Sep 18 AWS checkpoint; Fire TV Stick tests (URL mode, real size change, HDMI capture, Measurement C at word level); pilot sessions with the DHH participants on the real excerpt | sync report v2; pilot notes |
| Sep 23–Oct 6 | Own shoot if actors are available, re-conform; second excerpt; demo video | demo cut |
| Oct 7–15 | Freeze, Devpost, open-source packaging | submission |

## 10. Risks, stated

- **Overlay-only.** Every expressive device lives in Detailed, which is the overlay; the platform renderer cannot do any of it. The overlay's visual latency is unmeasured (Measurement C). If the Stick shows visible word lag, the reveal degrades to cue-level colour.
- **Fonts on Vega.** Custom or variable fonts in a Vega RN app are untested. Fallback: static weights.
- **Alignment quality** on real audio with overlaps and effects. Every timing is reviewed; bad words fall back.
- **Legibility.** Size and weight modulation can hurt readability for the very people it is for; the pilot decides the ranges, and the viewer can turn each device off.
- **Time.** Six weeks, one developer, an unshot film. The Tears of Steel route keeps the demo independent of the shoot.

## 11. Decisions for Samuel

1. Tears of Steel (CC BY 3.0) as demo footage: yes/no.
2. Accept the two rule changes in section 4 (word timing back as verified metadata; delivery measurement instead of emotion classification).
3. The local review page is allowed as a tooling surface (not a product surface).
4. Product name (Cuelith) and code/media licences, still pending from last night.
