# Integration test scenarios (spec v0.3 §16.2)

Status as of the night of September 2, 2026, on the Vega Virtual Device with synthesized stand-in footage. "Verified" means observed on the device with a capture or a log line; "unit" means covered in packages/core tests only; "open" means not yet run.

| # | Scenario | Status | Evidence |
|---:|---|---|---|
| 1 | App launches and plays the full scene | Verified | docs/captures/2026-09-02-env26-end.png (end card at 56 s) |
| 2 | Standard captions render all cues | Verified (prototype track, Sep 1; The Envelope, Sep 2: 58 boundary crossings, 0 of 31 lost) | docs/captures/2026-09-02-std02-envelope-standard-t9.png; docs/device-log-2026-09-02-envelope-standard.txt.gz |
| 3 | Speaker-aware selected before playback | Verified | default mode; env03-t15-dual.png |
| 4 | Standard → Speaker-aware during playback | Verified (Sep 1 scripted run) | docs/gate2-run-2026-09-01.log `[mode]` lines |
| 5 | Speaker-aware → Detailed during playback | Verified | env22-reveal-detailed.png; log `[mode] detailed` |
| 6 | Detailed → Standard with one action | Verified (settings panel "Use Standard captions") | shell13-settings.png |
| 7 | No duplicate native/custom caption during mode switch | Verified by construction and captures (native track `hidden` in Detailed; overlay unmounted otherwise) | env22 shows overlay only |
| 8 | Pause during an active cue and resume | Verified (Sep 1 scripted run: pause 9 s, resume 11 s; cue end still caught) | docs/gate2-run-2026-09-01.log |
| 9 | Seek backward into an earlier cue | Verified (seek 7 s → c003 active within ~300 ms) | same log |
| 10 | Seek forward over multiple cues | Verified (seek 12 s → c004 active) | same log |
| 11 | Replay from the beginning | Verified (seek 0 in scripted run; end card Replay button) | same log; env26 |
| 12 | Companion file absent | Verified (scene "Test: no companion file": every cue `metadata_missing`, bottom placement, `<v>` names kept as labels) | docs/captures/2026-09-02-fx05-no-companion-c003-bottom.png, fx06; docs/device-log-2026-09-02-fixtures.txt.gz |
| 13 | Companion file malformed | Unit (validator fails closed; controller rejects structural errors, keeps Standard). Cue-level errors verified on device (fixture scene loads, bad cues fall back one by one) | core tests; CaptionController constructor; fixtures log |
| 14 | Unsupported schema version | Unit | core tests |
| 15 | One cue hash mismatch | Verified (scene "Test: stale metadata": c001 `canonical_mismatch`, lane dropped to bottom, text and `<v>` label kept; neighbours unaffected) | docs/captures/2026-09-02-fx01-stale-hash-c001-bottom.png; fixtures log `[companion] error $.cues.c001.textHash` |
| 16 | One cue marked proposed | Verified (The Envelope c024; fixture c002 `metadata_unverified`) | env23-proposed-detailed.png; 2026-09-02-fx02-proposed-c002-bottom.png |
| 17 | Unknown/off-screen speaker | Verified (`[unknown voice]` canonical, no doubled label; reveal at 30 s). Unknown speaker *id* in metadata: fixture c003 `speaker_unknown`, verified lane kept, label from `<v>` | env04-t17-unknown.png, env22; 2026-09-02-fx03-unknown-speaker-c003-lane-kept.png |
| 18 | Two-speaker overlap with safe lanes | Unit (verified pair → separate lanes) | core tests |
| 19 | Two-speaker overlap requiring bottom stack | Verified for professional dual cues (single cue, combined label); unit for two cues stacking | env21-overlap-spk.png; core tests |
| 20 | Protected-region lane rejection | Verified (scene "Test: protected region": shot 7.0–10.5 s protects the lower left; c003 `protected_region` → bottom with label; c001 keeps the left lane; native path now applies each cue's own shot) | docs/captures/2026-09-02-fx07-protected-c001-left-kept.png, fx08; fixtures log |
| 21 | Caption-size setting changed to Large/Largest | Open on VVD (FL-012); simulated path verified | env24-emphasis-simsize.png |
| 22 | Lane fallback driven by the real system setting | Open (needs hardware) | FL-012 |
| 23 | App background/foreground | Open on VVD (KEY_HOME has no effect on the virtual device: playback and cue events continued; needs hardware, FL-020). Relaunching a running app restarts it cleanly at the landing screen; viewer settings now persist across the restart (async-storage) | docs/captures/2026-09-02-relaunch-landing.png; docs/device-log-2026-09-02-fixtures.txt.gz |
| 24 | Media error and retry | Implemented (error screen with Try again); open to provoke on device | PlayerScreen error state |
| 25 | Repeated launch without double caption-surface mount | Verified (three consecutive `launch-app` runs, Play each time: one caption surface, one player init per launch, no duplicate captions) | docs/captures/2026-09-02-relaunch1-single-caption.png; FL-016 |
| 27 | Viewer settings survive a relaunch | Verified (Standard chosen, `launch-app` restart, landing shows Standard) | docs/captures/2026-09-02-settings-persist-relaunch.png |
| 28 | Caption with Intention palette, sizes, weights, box and read-ahead in Detailed on real footage | Verified (Tears of Steel bridge: CI yellow/cyan, 90% box, 5% baseline, read-ahead white at 90%, colour at word onset, Roboto Flex). Note: the film is letterboxed, so a second caption line that sits over the black bar shows no visible box edge (90% black on black); the box does enclose it | docs/captures/2026-09-02-ci-detailed-*.png (two-lines capture replaced after the review) |
| 29 | Native colour attribution in Speaker-aware via WebVTT colour classes | Verified (label and text in the character colour on the platform renderer; span offset quirk worked around, FL-023) | docs/captures/2026-09-02-ci-native-*.png |
| 30 | Word colouring on the platform renderer (Speaker-aware) | Verified (one native cue per word boundary with the spoken prefix in a WebVTT colour class; 61 cue events in the first 17 s of the bridge excerpt; viewer size/font settings still apply) | docs/captures/2026-09-02-native-words-*.png; docs/device-log-2026-09-02-native-words.txt |
| 31 | Verified sound events render in Detailed (♫ rule, direction marker, stacking) and never move a side-lane cue | Verified (Tears of Steel bridge: "dramatic music" between ♫, "machinery whirring ▶", both stacked under a dialogue cue; side lane keeps a fixed clearance) | docs/captures/2026-09-02-sounds0*.png |
| 32 | Word colouring on a dual-speaker cue and a revealed speaker (The Envelope stand-in) | Verified | docs/captures/2026-09-02-envelope-words-*.png |
| 33 | Word pop with Reduced motion off (lift, scale, colour crossfade), nothing moves with it on | Verified for words (one frame caught mid-lift); sound-label pop implemented, not yet captured | docs/captures/2026-09-02-pop0*.png |
| 34 | Roboto Flex renders in Detailed (static weight instances by pitch band: Bold, Regular, Light) | Verified (probe widths differ; earlier captures show the Narrow/Wide instances that were used before weight and width were separated) | docs/captures/2026-09-02-font0*.png |
| 35 | Native lead compensation lands cue and word changes near the boundary | Verified (word boundaries p50 +30 ms, cue boundaries p50 -30 ms, 0 lost, September 3) | docs/device-log-2026-09-03-probe.txt.gz; docs/sync-report.md |
| 36 | Publisher path: caption track and companion fetched beside the stream, bundled fallback | Verified (`[assets] source=remote vtt=1275B companion=yes in 17 ms`; fallback path exercised when the server is stopped is still open) | docs/device-log-2026-09-02-publisher-path.txt |
| 37 | Continuous loudness sizing (3–12% of screen height from measured dB) | Verified (shouted line visibly larger) | docs/captures/2026-09-02-size01-alright-continuous.png |
| 38 | Visual latency on the virtual device (Measurement C) | Verified: overlay within one frame (79/84 samples agree; the rest 20–40 ms after a boundary); native path with lead within a frame in bounding samples, occasional 80–140 ms | docs/measurements/2026-09-02-measurement-c/; docs/sync-report.md |
| 39 | Colour never stands alone: a repeat-speaker cue forced to the bottom gets its label back | Verified (bridge c003 shows THOM at the bottom where the log had shown colour only) | docs/captures/2026-09-02-label-restored-c003-bottom.png |
| 40 | Offline: LAN server down, packaged HLS plays with captions | Verified (`[player] source=packaged`, 72 cue events on the bridge excerpt with the server stopped) | docs/device-log-2026-09-02-offline-packaged.txt.gz; FL-025 |
| 41 | Event-anchored media clock: no backward jumps, drift within 50 ms | Verified (anchor drift mean 0 ms, max 49 ms over 192 events; Method B p95 +7 ms) | docs/device-log-2026-09-02-clock-drift-polled.txt.gz (polled re-anchoring, −120 to −220 ms per second), docs/device-log-2026-09-02-clock-drift-timeupdate.txt.gz (event anchoring, mean −7 ms), docs/device-log-2026-09-02-detailed-eventclock.txt; FL-027 |
| 42 | Seek back and forward during Detailed playback clears and re-lays captions | Verified (seek to 4 s and to 19 s: no stale cue; word colours restart from the seek point; the VVD's picture catches up from the segment start, FL-027) | docs/captures/2026-09-02-seek0*.png; FL-027 |
| 43 | Per-word size from measured loudness and weight family by pitch band (typography toggle on; off by default) | Verified (bridge c004: "Why don't you" larger than "just admit"; light family on the high voices) | docs/captures/2026-09-02-perword-size-*.png |
| 44 | Packaged config.json sets the LAN host at startup | Verified (a marker host in the packaged file appears in the landing footer; playback then loads from it) | docs/captures/2026-09-02-config-marker-on-landing.png |
| 45 | Width from harmonics: nine static Roboto Flex instances chosen by pitch band and spectral-centroid band (typography toggle on) | Verified (bridge: cues render in wide, regular and narrow instances per the measured voice) | docs/captures/2026-09-02-width0*.png |
| 46 | Syllable-level colouring (CI 2.2.2, optional): a word's span divided across its vowel groups | Verified ("fol|low", "ro|botics" half-coloured mid-word on the bridge) | docs/captures/2026-09-02-syllable0*.png |
| 47 | Box break-out for shouted words (CI 2.4.1) | Implemented (overflow allowed, no box growth for level-2 words); not exercised on the bridge because the shouted words there are unverified by alignment score | apps/vega-player/src/captions/detailed/layout.ts `breaksOut` |
| 26 | Remote-only completion of all viewer tasks | Verified for landing, settings, play, mode switch, Back, end card | shell captures; inputd-cli scripts |

Fixture scenes are selectable in the app (Change scene) so a reviewer can reproduce rows 12, 15, 16, 17 and 20 on any device in under a minute each.

Product targets (§16.3) observed so far: canonical text preservation 100% (hash-gated; overlay and native text both come from the parsed cue); lost cues 0; duplicate rendering 0 observed; invalid enhancement causing video failure 0 (validator + per-cue isolation); Standard return 1 action; caption overflow 0 observed at normal size; proposed rendered as verified 0 (c024 check).
