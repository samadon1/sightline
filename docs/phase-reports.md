# Phase reports

Format per spec v0.3 §27. Newest first.

---

# Phase 1 Report (September 2, 2026, overnight): product vertical slice

## Status
PARTIAL. Everything that does not need people or hardware is built and verified on the virtual device. Blocked items: real footage, DHH participants, physical Fire TV, name approval, licence choice.

## Commits
- 8351208 docs: sync report, friction log FL-012..017, gate results night two, captures
- 3453190 feat: BackHandler-based Back, side-lane budget label+2 lines with height cap, controller layout fix, simulated size dev path, sync-report tool; docs
- 7134902 feat(app): scene picker, three placeholder scenes, window-scaled TV layout, enter key mapping, size-write dev keys, double-play guard
- 600568e feat(app): product shell, caption controller on core resolver, Detailed overlay, second clock; scene assets + content docs
- 58c943d docs: product name collision review (primary Cuelith; awaiting approval)
- d6529f9 build: commit the Vega-patched Shaka build so a clean checkout builds; root package type module
- 9ec8fa2 feat(core): normalization, sha256 cue hashes, companion profile schema + validator, label rules, two-pass resolver

## Gate card
| Requirement | Result | Evidence path |
|---|---|---|
| Canonical VTT parser with stable ids and `<v>` spans | PASS | packages/core/src/vtt.ts, test/vtt.test.ts |
| Minimal schema 0.1, validator with actionable errors, text hash | PASS | packages/core/src/{schema,hashes,normalize}.ts; `npm run validate` |
| verified vs proposed handling | PASS | resolver tests; The Envelope c024 renders plain (docs/captures/2026-09-02-env23-proposed-detailed.png) |
| Two-pass resolver, label-frequency rule | PASS | packages/core/src/{resolver,labels}.ts; 34 core tests |
| Real Standard and Speaker-aware on native renderer | PASS | docs/captures/2026-09-02-env03-t15-dual.png, env21-overlap-spk.png |
| Minimal Detailed mode (colour, static emphasis, sound direction) on hidden-track overlay | PASS | docs/captures/2026-09-02-env22-reveal-detailed.png, env24-emphasis-simsize.png |
| System-size-driven lane fallback | PARTIAL | Logic verified in tests and via in-app simulated size (labelled); real system setting cannot be changed on the VVD (FL-012) |
| UNKNOWN VOICE without spoiler | PASS | docs/captures/2026-09-02-env04-t17-unknown.png; reveal at 30 s (env22) |
| One overlap case | PASS | dual-speaker cues c010/c015 ("DANIEL, then MAYA"); Hallway c007 |
| One protected-region case | PASS (Sep 2, later run) | Fixture scene `fixture-protected-region`; verified on the VVD, docs/captures/2026-09-02-fx07/fx08 |
| One-action return to Standard | PASS | Settings panel "Use Standard captions" (docs/captures/2026-09-02-shell13-settings.png) |
| Remote-operable landing/settings/playback shell | PASS | shell11-landing.png, shell13-settings.png; Back via BackHandler (FL-013) |
| Rough micro-scene A or B end to end | PARTIAL | Scripts, fair VTT tracks and companion files exist and play with synthesized stand-in footage; phone-shot footage requires people |

## What changed
- `packages/core`: types, normalize, hashes (pure TS SHA-256), schema validator, labels (reveal + frequency rules), two-pass resolver with per-cue exception isolation, dual-speaker cues, canonical bracketed-id suppression, lane estimator calibrated from the VVD.
- `apps/vega-player`: product shell (landing, settings, about, player with controls, loading, error/retry, end card), `CaptionController`, `DetailedOverlay` applying CaptioningProps, `useSecondClock` (Measurement B), `useSystemCaptionPrefs`, remote map (enter/ok, pageup/pagedown, BackHandler), diagnostics ring buffer and hidden panel (Info key), window-scaled TV theme.
- Assets: fair Standard tracks and validated companion files for The Envelope, Keys, Hallway; synthesized placeholder videos and HLS renditions; `tools/bundle-assets.ts` inlines them.
- Tools: `validate`, `hashes`, `bundle-assets`, `sync-report`, `hls/make-hls.sh`, `placeholder-video.py`.
- Docs: README, architecture, accessibility decisions, product feedback, validation plan, sync report, name review, study kit (6 files), content kit (6 files), friction log FL-001 to FL-017.

## Tests
- command: `npm test` (workspaces)
- result: core 34/34, app 5/5
- failures: none

## Metrics
- method: Measurement A (native cue-change media time vs boundary), seek/play/mode recomputes excluded; Measurement B (rAF clock anchored to media time)
- n: 58 boundary crossings (The Envelope, Speaker-aware + Detailed)
- p50: +128 ms (A)
- p95: +237 ms (A); +6 ms (B)
- max: +257 ms (A)
- exclusions: 350 ms after seek/play/mode; Standard mode not in this run (covered on Sep 1 with the prototype track)
- lost cues: 0 of 31

## Captures and logs
- docs/captures/2026-09-02-*.png (12 captures)
- docs/device-log-2026-09-02-envelope-walkthrough.txt
- docs/sync-report.md

## Product decisions made
- Side lanes hold a label plus up to two dialogue lines, capped at 35% of the viewport height; longer or larger text goes to the bottom. Rationale: real 30 to 42 character captions never fit a "label plus one line" side lane at normal size.
- A dual-speaker cue (professional "-A / -B" form) keeps its text and gets one combined label "A, then B" at the bottom.
- A canonical bracketed id in the text ("[unknown voice] ...") suppresses the enhancement label to avoid doubling.
- Label frequency: first cue of a run, speaker change, 4 s gap, overlap, shot change, off-screen, reveal, prior fallback. Recorded as a hypothesis for the pilot.
- Default mode Speaker-aware, reduced motion on; the public demo may start in Standard for the comparison.

## Known limitations
- Footage is synthesized (macOS `say` voices over a stage graphic). Not study material.
- The real system caption-size change is unverified on the VVD (FL-012); simulated size is development-only and does not change native caption size.
- Visual latency (Measurement C) not measured; no physical device.
- `onSurfaceViewCreated` fires twice (FL-016); guarded.
- The Detailed overlay does not yet apply `textFont` or window background colour.
- Protected regions are implemented but no scene authors one yet.
- The Shaka player wrapper copied from the official sample carries an Amazon proprietary header inside an MIT-0 repository; settle before the repo goes public (or switch to hls.js).

## External dependencies
- Samuel: approve a product name (docs/name-review.md, primary "Cuelith"); choose licence (MIT code + CC BY 4.0 media intended); recruit DHH participants (docs/study); shoot the two micro-scenes and The Envelope (docs/content); a physical Fire TV Stick for URL mode, real size change and HDMI capture.

## Addendum (September 2, later the same night): fixture scenes on device
- Three fixture scenes were added to the scene picker and run on the VVD in Speaker-aware mode: `fixture-no-companion` (every cue `metadata_missing`, bottom, `<v>` names kept), `fixture-stale-metadata` (c001 stale hash → `canonical_mismatch`, bottom; c002 proposed → `metadata_unverified`; c003 unknown speaker id → `speaker_unknown`, verified lane kept, label from `<v>`), and `fixture-protected-region` (c003 → `protected_region`, bottom; c001 unaffected). Captures: docs/captures/2026-09-02-fx00 to fx09. Log: docs/device-log-2026-09-02-fixtures.txt.gz.
- Fix found by the fixture: the native (Standard/Speaker-aware) path had passed an empty protected-region list; `resolveAlone` now takes each cue's own shot. Test added (35 core tests).
- Overlay now honours the system caption font family and window background.
- Integration rows 12, 13 (cue-level), 15, 16, 17 and 20 moved to Verified.

- Standard mode on The Envelope measured: Method A p50 +134, p95 +234, max +278 ms; 0 of 31 lost (docs/sync-report.md). Three consecutive relaunches showed one caption surface each. KEY_HOME does not background the app on the VVD (FL-020), so row 23 stays open for hardware.
- Gap found: viewer settings are not persisted across launches (in-memory store). Small local persistence is the next product item.

## Addendum (September 2, daytime): real footage, schema 0.2, Caption with Intention
- Samuel redirected the goal to real videos and expressive captions. Two Tears of Steel excerpts (CC BY 3.0) play on the VVD. Schema 0.2 adds word timings, delivery levels, caps/stretch variants and sound events; WhisperX forced alignment and librosa measurements produce them as proposed data (tools/author). Word colour reveal runs on the device from the anchored animation-frame clock.
- After a prior-art review (docs/prior-art.md), Detailed mode now implements the Caption with Intention Design System V1.0: palette, 5% baseline with 3–12% loudness range, weight by pitch band, 90% box, lower-20% work area, read-ahead white at 90%, italic off-camera, music ♫ rule, Roboto Flex bundled. Speaker-aware gets native colour attribution through WebVTT colour classes (FL-022, FL-023).
- Settings persist across launches. Fixture scenes cover no-companion, stale metadata, protected region and native markup.
- Speaker-aware now carries Caption with Intention colour attribution and word-by-word colouring on the platform renderer itself (cue splitting at verified word boundaries, WebVTT colour classes), so the viewer's own caption size and font apply. Timing on that path carries the native cue-event lag (docs/sync-report.md).

## Addendum (September 2, afternoon session): animation, proposals, latency
- Caption with Intention's word pop and sound-label pop implemented behind Reduced motion, from the template's expressions. Static Roboto Flex instances load (variable font did not, FL-024); weight and width follow the pitch band by family.
- Authoring proposals: speaker clusters (audio-only, weak; pyannote needs a token), stereo direction (film mixes are centred; reported, not asserted), face-protected regions per shot (YuNet) mapped into screen coordinates.
- Latency: native cues scheduled 120 ms early (p50 +16 ms, p95 +112 ms, 0 lost); overlay JS commit 3 ms p50, 7 ms p95 after the clock tick. Compositor latency still needs hardware.
- Continuous 3–12% sizing from measured dB; reading-rate warnings (BBC 180 wpm, 0.3 s/word) in the validator; JSON Schema exported to schema/; publisher path fetches caption files beside the stream with bundled fallback.

## Next phase
- Hardware: Measurement C (compositor latency, pop at 60 fps), real size change, HDMI capture. People: review-page verification pass, lab speakers, pilot, shoot, name and licences. Colour/contrast review of the overlay palette against the system caption colours. Everything else needs people or hardware.
- Then: pilot sessions as soon as participants confirm; re-conform tracks to real footage; physical device tests.

---

# Phase 0 Report (September 2, 2026): preserve and harden

## Status
PASS with two items carried into Phase 1 (real size change: FL-012; remote rewind: FL-015).

## Commits
- 48bf192 chore: preserve Vega gate 0-2 baseline (tag `gate-0-2-pass-2026-09-01`, later re-pointed to d6529f9 so a clean checkout builds)

## Gate card
| Requirement | Result | Evidence path |
|---|---|---|
| Private git repository, baseline committed and tagged | PASS | `git tag` gate-0-2-pass-2026-09-01 |
| Clean checkout builds | PASS | worktree build of the tag produced apps/vega-player/build/aarch64-release/vega-player_aarch64.vpkg |
| Dependency versions pinned | PASS | package-lock.json committed; versions in README |
| Running commands documented | PASS | docs/architecture.md, README Quick start |
| Logs/captures preserved | PASS | docs/captures, docs/gate2-run-2026-09-01.log |
| Real system caption-size test | FAIL on VVD | FL-012: no Accessibility page, device tool needs a profile, third-party write is a no-op |
| Lane fallback from the real setting | PARTIAL | verified from simulated size; needs hardware |
| Double-mount guard verified | PASS | loadedmetadata guard; surface callback double-fire guarded (FL-016) |
| Rewind event mapped or documented | DOCUMENTED | FL-015: KEY_REWIND produces no app event; skip_backward/rewind names mapped defensively |
| Second clock started | PASS | apps/vega-player/src/captions/controller/useSecondClock.ts; Measurement B in docs/sync-report.md |
| URL-mode caveat isolated | PASS | FL-008; media config keeps mp4Uri for hardware tests only |

## Tests
- command: `npm test`; result: pass (see Phase 1)

## Metrics
- see Phase 1

## Captures and logs
- docs/captures/2026-09-01-*.png retained from night one

## Product decisions made
- Keep React Native 0.83 (template default; matches the official sample).
- Commit the Vega-patched Shaka build artifact so the repo is reproducible.

## Known limitations
- Baseline tag re-pointed once (documented in the tag message).

## External dependencies
- none for this phase

## Next phase
- Phase 1 (above).
