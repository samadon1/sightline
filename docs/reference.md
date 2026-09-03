# Sightline technical reference

The long-form description of the runtime, the caption profile, the fallback rules, the environment and the measurements. The short introduction is the repository README.

## Problem

Captions can keep every word and still make a fast conversation hard to follow. Ordinary captions sit at the bottom of the screen in one style, and the professional style guides only add a speaker's name when that speaker cannot be seen. So in a quick exchange, an overlap, or a line spoken from off screen, a viewer who depends on captions can lose track of who said what. The usual fixes are a name on every line, a colour per character, or captions that follow faces, but each of those adds reading load, motion, or guesswork, and none of them respect the caption settings a viewer has already chosen on their TV.

## Product definition

Sightline is a Fire TV caption runtime. It takes an approved WebVTT track (the standard text file that holds a video's captions and their timings) and draws it at the richest level that the viewer, the TV's caption settings, and verified extra data allow. Whenever an enhancement is unavailable, unsafe, unverified, or unwanted, it falls back, one cue at a time, to ordinary captions. A cue is one timed caption in the track.

The line we use with viewers: captions that let you choose how much context you get, and never put the approved words at risk.

## Demo

Video link: TBD.

All footage so far comes from the Vega Virtual Device, the simulator that ships with Amazon's developer tools, and is labelled as simulator footage. We have not used a physical Fire TV device yet. Stills from the working prototype are in `docs/captures/` (`run22a.png` Standard, `run22c.png` and `run25-spk-a.png` Speaker-aware lanes, `run25-det.png` Detailed overlay).

## Why Fire TV

- The television is where people watch captioned drama, from across a living room, with a remote.
- Vega's own caption renderer (`KeplerCaptionsView`) honours the position settings on each `VTTCue` and applies the viewer's system caption style. That means speaker lanes and labels work with no custom drawing and no custom sync code.
- Vega 0.24 lets apps read the viewer's caption preferences (`kepler-a11y-settings-interface-turbo`), so even our custom Detailed overlay can follow the size, colour, and background the viewer already chose.
- The whole product works from the remote and needs nothing installed beyond the app.

## Caption modes

| Mode | Renderer | What the viewer gets |
|---|---|---|
| Standard | Native `KeplerCaptionsView` | Ordinary bottom captions, exactly as authored, in the TV's caption style. Always available, one press away from any other mode. |
| Speaker-aware | Native `KeplerCaptionsView`, app-created positioned `VTTCue` objects | A verified speaker name when the speaker changes (and at other rule-defined points), placed on the speaker's side of the screen when the line fits there at the viewer's caption size, otherwise at the bottom. Still the TV's renderer and caption style. |
| Detailed | Native track hidden; React Native overlay driven by native cue events | Everything in Speaker-aware plus a restrained colour per speaker, an emphasised word where the editor marked one, and a hint for where an important sound comes from. Reduced motion is on by default, so nothing moves while a caption is showing. |

The default mode is Speaker-aware. The settings are the caption mode, reduced motion, and two toggles that only affect Detailed (word highlighting; size and weight follow the voice). They are saved on the device.

## Canonical WebVTT and companion profile

The WebVTT file is the source of truth. It is written to a professional style guide (Netflix English TTSG and DCMP Captioning Key; see `docs/content/captioning-style-notes.md`) with no voice tags, no position settings, and a speaker's name only where the speaker cannot be seen. Every cue has a stable id.

```vtt
WEBVTT

c010
00:00:14.200 --> 00:00:16.200
-Know what?
-Whose it is. Obviously.

c011
00:00:16.600 --> 00:00:18.400
[unknown voice] Don't open that.

c016
00:00:26.100 --> 00:00:27.300
[glass shatters]
```

The companion file sits beside the caption track and adds what WebVTT cannot hold. It is an experimental WebVTT companion metadata profile, schema version 0.2, and it is not a new caption standard. It carries only these things: a verification status, a per-cue hash of the visible text (a fingerprint that changes if the words change), an ordered list of preferred lanes (screen positions), the speaker's identity with a reveal time that avoids spoilers, the direction of a sound, static emphasis, and protected regions for each shot. Trimmed from `assets/the-envelope/companion.en.json`:

```json
{
  "schemaVersion": "0.1",
  "canonicalTrack": "captions.en.vtt",
  "speakers": {
    "maya":   { "label": "MAYA",   "color": "speaker-1", "revealAtMs": 0 },
    "daniel": { "label": "DANIEL", "color": "speaker-2", "revealAtMs": 0 },
    "amara":  { "label": "AMARA",  "genericLabel": "UNKNOWN VOICE", "color": "speaker-3", "revealAtMs": 30000 }
  },
  "shots": [
    { "id": "s1", "startMs": 0,     "endMs": 30000 },
    { "id": "s2", "startMs": 30000, "endMs": 45400 }
  ],
  "cues": {
    "c001": { "textHash": "sha256:ce8bd8cc...", "status": "verified", "provenance": "human_editor",
              "speaker": "maya", "lanes": ["lower_left", "bottom_center"] },
    "c010": { "textHash": "sha256:0fd44cd7...", "status": "verified", "provenance": "human_editor",
              "speakers": ["daniel", "maya"], "lanes": ["bottom_center"] },
    "c011": { "textHash": "sha256:167f4f1b...", "status": "verified", "provenance": "human_editor",
              "speaker": "amara", "lanes": ["bottom_center"] },
    "c016": { "textHash": "sha256:7a77cc9a...", "status": "verified", "provenance": "human_editor",
              "sound": { "direction": "right" }, "lanes": ["lower_right", "bottom_center"] },
    "c024": { "textHash": "sha256:bbff7b98...", "status": "proposed", "provenance": "automated_suggestion",
              "speaker": "daniel", "lanes": ["lower_right", "bottom_center"] },
    "c029": { "textHash": "sha256:89637c03...", "status": "verified", "provenance": "human_editor",
              "speaker": "maya", "emphasis": [ { "tokenIndex": 2, "kind": "weight" } ],
              "lanes": ["lower_left", "bottom_center"] }
  }
}
```

Everything in the companion file is optional. An empty `cues` object is valid and gives you Standard captions. A track that has `<v Name>` voice spans but no companion file still gets speaker labels in Speaker-aware mode, which is a way to start with no extra work.

## Progressive fallback guarantees

For every cue the runtime tries the Detailed enhancement first, then the Speaker-aware one, and otherwise shows the plain Standard cue. Where it can, it falls back one feature at a time rather than all at once:

- an unsafe placement does not remove a verified label
- unavailable colour does not remove the label or lane
- unverified emphasis does not remove the speaker lane
- stale metadata (a hash mismatch) does not remove the original text
- `proposed` metadata never reaches the viewer
- an unknown speaker id removes only the speaker enhancement
- a malformed companion file leaves the video and the Standard captions intact
- an error while resolving one cue draws that cue in Standard and carries on

The rule that holds all of this together: an enhancement may disappear; the original caption may not.

## Architecture

The design puts the platform first. Levels 1 and 2 are drawn by the TV's own renderer from cues the app creates, and Level 3 hides the native track and draws an overlay from the native cue events. A core package with no framework dependencies (`packages/core`) does the parsing, validation, hashing, and a deterministic two-pass resolver, and a thin Vega app (`apps/vega-player`) connects it to `react-native-w3cmedia`. The full description, with diagrams, the start-up sequence, the remote map, diagnostics, and the failure table, is in `docs/architecture.md`.

## Quick start

```bash
npm install
npm test -w @sightline-wip/core
npm run validate -- assets/the-envelope/captions.en.vtt assets/the-envelope/companion.en.json
```

That runs the core tests and the validator without a Fire TV or the Vega SDK. To run the app on the Vega Virtual Device:

```bash
npm run bundle-assets
cd apps/vega-player && npm run build:release
vega virtual-device start
vega run-app build/aarch64-release/vega-player_aarch64.vpkg com.sightlinewip.player.main -d VirtualDevice
# in another terminal, from the repository root:
cd assets && npx http-server -p 8081 -a 0.0.0.0 --cors
```

First set `DEV_HOST` in `apps/vega-player/src/media/config.ts` to your Mac's address on the local network. Running `npm test` at the root runs the core suite and the app's Node tests (51 core, 17 runtime, 5 app on September 3, 2026).

## Vega environment and exact versions

Checked on September 1, 2026:

- Vega SDK 0.24.9914
- Vega CLI 1.3.4
- Vega Virtual Device, aarch64 guest, on an Apple Silicon Mac (macOS 26.5)
- React Native for Vega 0.83 from the generated `helloWorld` template (`@amazon-devices/react-native-kepler ~4.0.0`, React 19.2.0, react-native 0.83.0)
- `@amazon-devices/react-native-w3cmedia` 2.3.2
- `@amazon-devices/kepler-a11y-settings-interface-turbo` 1.0.0 (added to `package.json` by hand; see friction log FL-006)
- Node 24 (the repo needs Node 22.6 or newer for `--experimental-strip-types`)
- Package id `com.sightlinewip.player`, component `com.sightlinewip.player.main`, OS target 1.2

## Media/HLS setup

The virtual device cannot open URL-mode sources (see the caveat further down), so playback goes through the Vega-patched Shaka player (4.8.5, copied from `AmazonAppDev/vega-video-sample`) on the Media Source Extensions path, and that path needs HLS, the segmented streaming format.

- `tools/hls/make-hls.sh assets/<scene>/<master>.mp4` builds a single-file fMP4 HLS rendition next to the master (ffmpeg, stream copy, 4 s segments).
- `cd assets && npx http-server -p 8081 -a 0.0.0.0 --cors` serves the scenes.
- `apps/vega-player/src/media/config.ts` holds `DEV_HOST`, the scene list, the HLS URI, and an MP4 URI for a future URL-mode test on hardware.
- The footage in every scene directory is a synthesized stand-in (`tools/placeholder-video.py`) until we shoot the real scenes.

## Validator

```bash
npm run validate -- assets/the-envelope/captions.en.vtt assets/the-envelope/companion.en.json
npm run validate -- assets/the-envelope/captions.en.vtt          # VTT only
npm run hashes -- assets/the-envelope/captions.en.vtt            # print cue hashes for authoring
```

It reports errors by path, with hints, for: duplicate or missing cue ids, a companion entry with no matching cue, a hash mismatch (with the expected hash), an unsupported schema version, an unknown speaker id, an invalid status, an invalid lane, bad shot times or overlapping shots, protected rectangles outside the viewport, an invalid sound direction, an emphasis token index out of range, an invalid colour token, and a malformed reveal time. `proposed` cues produce a warning. `npm run bundle-assets` runs the same validation on every scene and refuses to bundle one that fails. Exit codes: 0 valid, 1 errors, 2 usage or I/O.

Current result for "The Envelope": 31 cues; the validator reports 14 warnings (12 reading-rate, one proposed cue, one machine-verified notice), and `c024` is `proposed` by design.

## Tests and metrics

Unit tests (`node --test`, with TypeScript stripped at runtime): 51 in `packages/core/test`, 17 in `packages/vega-captions/test`, 5 in `apps/vega-player/test-node`, plus 6 pytest cases for the proposal rules in `tools/author/tests`. All pass on September 3, 2026.

Measured numbers. These are the only measurements in the project, taken on the virtual device on September 1, 2026 (`docs/gate-1-prototype.md`, Results; raw log `docs/gate2-run-2026-09-01.log`).

Method: the app logs the media time it reads inside the native `cuechange` handler at each cue boundary. The boundary error is that media time minus the cue's start (or end). We ran one scripted pass per mode: play, pause at 9 s, resume, seek to 7 s, seek to 12 s, seek to 0, driven by `inputd-cli` on the device. Seek recomputations are left out of the boundary statistics.

| Mode | p50 | p95 |
|---|---:|---:|
| Standard | +150 ms | +233 ms |
| Speaker-aware | +108 ms | +234 ms |
| Detailed | +176 ms | +252 ms |
| All (n = 45) | +155 ms | +252 ms (max +262 ms) |

Lost cues: 0 across the three modes, each with one pause and resume and three seeks; every boundary produced an event. Seeks recompute the active set within about 300 ms.

Caveats: every error is late and clusters near the `timeupdate` granularity, which is undocumented, so the true render latency is probably smaller than the sampled media time suggests, and this method cannot show that. By this method the 150 ms internal target is not met; the disclosed 250 ms band is. A second clock (`useSecondClock.ts`, sampling on animation frames anchored to media time) is implemented but its output has not been analysed, and no frame-accurate capture has been done. The statement we can defend is: about 250 ms p95 by the current virtual-device event measurement, with zero lost cues in the scripted test.

Lane estimator calibration, from the same session, at `CaptionTextSize = normal` only: one native caption line is about 9.5% of the viewport height, and one character is about 1.74% of the viewport width. We exercised the size-driven fallback through the app's development scale keys (at 1.25x the 21-character prototype cue dropped to the bottom; at 1.5x every side-lane cue dropped), not yet through the real system setting.

## DHH validation

No Deaf or hard-of-hearing (DHH) viewer has seen any mode, and no study is scheduled. Every design choice rests on published research (the CHI 2024 Caption Royale study and the Caption with Intention design system) and is recorded as a hypothesis, not a finding. A complete study kit (recruitment plan, outreach messages, screener, consent, moderator script with scoring sheet, remote TV playback guide) is in `docs/study/` for anyone who wants to run the sessions, with the decision rules in `docs/validation-plan.md`. If you rely on captions and want to try the modes and tell us what is wrong with them, open an issue; we will publish what we hear, including the negative and mixed parts.

## Accessibility decisions

Every decision and its reason, the questions we are keeping for co-design with DHH users, and the known gaps are in `docs/accessibility-decisions.md`.

## Prior art and acknowledgements

This project builds on existing work. We did not invent speaker labels, positioned captions, or per-character colour.

- Caption With Intention (2025): per-character colour, variable-weight emphasis, word-level timing. Its design system is available on request under an all-rights-reserved notice. We implemented its palette, sizes, weights and rules from the published design system, we bundle its font (Roboto Flex, OFL) as static instances, and its PDF, template and clip are not in this repository.
- OpenCaptions: an extraction pipeline and `.cwi.json` format that replaces the caption track rather than sitting beside it.
- CapTune: caption transformations the viewer can choose within a space the creator sets.
- Speaker-following and positioned-subtitle research: Hu et al. (TOMM 2014), Brown et al. (BBC R&D, TVX 2015), Kurzhals et al. (CHI 2017, 2020), Vy and Fels (2010), Samaradivakara et al. (2025), and the DCMP guidance on placement.
- Google Expressive Captions: emphasis through capital letters and sound descriptions.
- Ava SpeakerID: speaker identification in live captioning.
- SAAC and related work on confidence gating.
- May et al. (2025) on showing only essential sounds and on revealing speakers too early.
- Netflix Timed Text Style Guide, DCMP Captioning Key, WCAG 1.2.2 / 1.4.1 / 1.4.3 / 2.3.3, and FCC 47 CFR 79.1(j) for the baseline and placement rules.
- `AmazonAppDev/vega-video-sample` for the Shaka/MSE integration and the `KeplerCaptionsView` wiring, which this app follows line by line.

What may be new here: a companion profile that only ever shows verified data and is locked to the caption text by hash, a fallback ladder that works per cue and per feature, a spoiler-safe reveal policy inside the runtime, and a Fire TV runtime that reads the system caption preferences and applies them to the enhanced rendering. Whether any of that helps viewers is what the study is for.

## What the project does not claim

It is not an animated-subtitle generator, a clone of Caption With Intention, a live transcription product, an LLM experience, an emotion or face recognition system, an automatic character identifier, a replacement for caption editors, an overlay for other streaming apps, a new standards proposal, or a claim that placed or coloured captions are better for everyone. The companion file is an experimental profile. We make no claim that it works until DHH participants have been through the study, and a small study will be reported as product feedback, not as proof.

## VVD URL-mode caveat

On this Vega Virtual Device image (SDK 0.24.9914, aarch64 guest on Apple Silicon), URL-mode playback fails for every source we tried (local HTTP with and without Range support, public HTTPS MP4, packaged `file:///pkg/assets/raw/` file, and an MP3) with the native error `Open failed -1 / MPB 50004`, which reaches the app as `MediaError` code 4 with an empty message. The unmodified official `vega-video-sample` plays through the MSE pipeline, and when we forced it into URL mode it failed the same way, so the fault is in the virtual device image and not in the app. The prototype therefore plays HLS through the Vega-patched Shaka player. URL mode on a physical Fire TV Stick is untested. The full record is in `docs/friction-log.md`, FL-008.

## AWS integration

Not used. The plan describes an optional step that asks Amazon Transcribe to propose speaker partitions, aligned to the approved cue text and written out as `proposed` metadata for a person to review. We will consider it only if the core runtime, the content, and the study are on schedule on September 18.

## Open-source package

`packages/core` is a portable TypeScript package with no React Native or Vega imports. It holds the WebVTT parser with `<v>` support, the canonical cue model, visible-text normalization, SHA-256 cue hashes (written in plain TypeScript so it runs in Node, browsers, and Hermes), the companion-profile JSON Schema and validator, the label rules, the lane estimator with title-safe and protected-region checks, and the two-pass resolver. It runs under `node --test` today. `apps/vega-player` is the Vega reference implementation. The intended npm name after renaming is `@<name>/core`.

## Limitations

- Virtual device only; no physical Fire TV test yet (playback, remote, rendering, colour, contrast).
- We have not driven the real system caption size change through the virtual device's UI (it has no Accessibility page), so the estimator is calibrated at `normal` only.
- Sync is known only to about 250 ms p95 by an event-based method; there is no frame-accurate measurement yet.
- The Detailed overlay applies size, colour, background, opacity, and edge style, but font family and window background are applied by the overlay.
- URL-mode playback is untested on hardware; HLS through a copied proprietary Shaka build is the only path we have exercised.
- The footage is synthesized placeholder video; the scenes have not been shot.
- No DHH participant has evaluated any mode.
- `KEY_REWIND` from the device's `inputd-cli` has not been mapped to an app event.
- Settings are saved with the platform's async-storage module; there are no accounts.

## Product feedback and friction log

- `docs/product-feedback.md`: the mandatory feedback for every Amazon and Vega tool we used.
- `docs/friction-log.md`: FL-001 to FL-029, written down as they happened.

## License

The code is under the Apache License 2.0; see `LICENSE`. Our own documents, figures and captures are CC BY 4.0. Third-party material keeps its own licence: the Shaka Player bundle is Apache-2.0 with notices in `apps/vega-player/src/w3cmedia/LICENSE-THIRD-PARTY.md`, Roboto Flex is under the SIL Open Font License 1.1 (`OFL.txt` beside the fonts), the Tears of Steel excerpts are CC BY 3.0 by the Blender Foundation, and the Vega Shaka glue files are fetched from Amazon's MIT-0 sample at install time rather than committed. Details and the reasoning are in `docs/licensing.md`.

## State on September 3, 2026

- **Real footage.** Two excerpts of *Tears of Steel* (Blender Foundation, CC BY 3.0) in `assets/tos-bridge` and `assets/tos-lab`, playing on the Vega Virtual Device. The Envelope and the micro-scenes still use synthesized stand-ins until the shoot.
- **Schema 0.2.** Word timings, delivery levels (loudness, pitch, pace), capitals and stretched spellings, and sound events sit beside the approved WebVTT file, each with a status. `docs/authoring.md` describes the tools that produce them (WhisperX alignment, librosa measurement, PANNs sound tagging) and the local review page where a person verifies them.
- **Caption with Intention in Detailed mode.** The palette, a 5% baseline with a 3 to 12% loudness range, weight by pitch band, a 90% box, read-ahead white with colour at word onset, italics for off-camera voices, ♫ for music, and Roboto Flex. `docs/prior-art.md` records the rules and the research behind them.
- **Word colouring on the platform renderer.** Speaker-aware splits each cue at verified word boundaries and uses WebVTT colour classes, so Fire TV draws it with the viewer's own size and font. Measured against an event-anchored media clock: word changes land within about 10 ms and cue changes within about 50 ms at the median, with p95 near 145 ms and zero lost cues, on the virtual device (`docs/sync-report.md`, September 3 clean run).
- **Fixtures and tests.** Selectable fixture scenes exercise the fallback on the device, and 73 tests across core, runtime and app run with `npm test`.
- **Server address.** `apps/vega-player/assets/raw/config.json` holds the LAN host (`devHost`) and is read at start-up, so a different network needs a repackage, not a code change.
- **Offline.** The three main scenes carry a packaged HLS copy. If the LAN server does not answer within 1.5 s the app plays from the package (`[player] source=packaged`), so a demo does not depend on the laptop.

Run the review page for a scene:

```
python3 tools/author/review_server.py assets/tos-bridge
```

## Honesty notes (read before judging the numbers)

- **Machine-verified data in the shipped scenes.** In `assets/tos-bridge` and `assets/tos-lab`, word timings, loudness and pitch measurements and sound events were verified by named rules (`verifiedBy: "auto:..."`); which line a person verified and which a rule verified is written into every entry. In `assets/the-envelope` the older bench acceptance still applies (`score>=0.5`, `dev-bench`). The validator prints a MACHINE-VERIFIED warning for every such file. A rule can never verify a cue itself: the speakers and sides of the bridge were set by the author against the footage, and the lab's cues stay unverified and play as plain captions until a person reviews them in the review page.
- **Reading rate.** The Envelope stand-in and parts of the Tears of Steel tracks go over 180 words per minute on the validator's new check. The Envelope's cue durations follow a synthesized read and will be re-timed to the real footage.
- **Lead compensation.** Native cues are scheduled 100 ms early because of measured event lag (three runs; docs/sync-report.md). A visual measurement on the virtual device (docs/sync-report.md, Measurement C) shows captions landing within a frame of the boundary rather than early. Hardware has not been measured.
- **CI Main Red** is lightened to #FF3B3B (from #E51717) so it passes 4.5:1 over the caption box. All other palette values are the design system's.
