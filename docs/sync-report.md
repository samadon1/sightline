# Sync report

**Current claim (September 3, 2026, virtual device only):** with leads of 100 ms on the enhanced modes, native word changes land within about 10 ms of the boundary at the median and cue changes within about 50 ms, p95 near 145 ms either way, with zero lost cues; the overlay's own clock tracks boundaries within 8 ms (p95) and shows within one frame by Measurement C. Standard mode is not shifted. Measured on one clean end-to-end run of the bridge excerpt in Speaker-aware (33 word boundaries, 18 cue boundaries, 0 of 11 cues lost): raw log `docs/device-log-2026-09-03-sync-bridge-speaker-aware.txt`, per-sample rows `docs/architecture-figures/sync-rows-2026-09-03-bridge-speaker-aware.json`, figure `docs/architecture-figures/fig-sync-measured.png`. Older sections below record how the numbers got here; where they disagree with this paragraph, this paragraph is current.

Measured on the Vega Virtual Device (SDK 0.24.9914, aarch64, Apple Silicon Mac), synthesized placeholder footage for "The Envelope" (31 cues, 54 s) played through the MSE/Shaka path. Raw log: `docs/device-log-2026-09-02-envelope-walkthrough.txt`. Generated with `npm run sync-report -- <log> assets/the-envelope/captions.en.vtt`.

| Method | Mode | n | p50 (ms) | p95 (ms) | max (ms) | min (ms) |
|---|---|---:|---:|---:|---:|---:|
| A | detailed | 25 | +141 | +239 | +257 | +5 |
| A | speaker-aware | 33 | +118 | +233 | +255 | +4 |
| B | detailed | 26 | +0 | +6 | +12 | +0 |
| B | speaker-aware | 40 | +0 | +6 | +95 | -88 |
| A | all | 58 | +128 | +237 | +257 | 4 |

Boundary crossings counted: 58. Cues never observed active (lost): 0 of 31.

Standard mode, same scene, separate run later the same night (raw log `docs/device-log-2026-09-02-envelope-standard.txt.gz`):

| Method | Mode | n | p50 (ms) | p95 (ms) | max (ms) | min (ms) |
|---|---|---:|---:|---:|---:|---:|
| A | standard | 58 | +134 | +234 | +278 | +2 |
| B | standard | 69 | +0 | +56 | +909 | -533 |

Boundary crossings counted: 58. Lost: 0 of 31. The Method B outliers are the first and last frames of the run (the anchor is set on play and the scene's end card), not boundary misses; the p50 is unchanged.

Method A samples the media clock inside the native cue-change handler; positive means late. Seek/play/mode recomputes within 350 ms are excluded. Method B is the first animation frame on which the resolver's expected set changed, timed from a performance.now() anchor; it is an independent estimate, not a render measurement.


## Earlier run (September 1, prototype track, 4 cues, scripted pause/seek per mode)

| Mode | n | p50 | p95 | max |
|---|---:|---:|---:|---:|
| Standard | 15 | +150 ms | +233 ms | +262 ms |
| Speaker-aware | 15 | +108 ms | +234 ms | +242 ms |
| Detailed | 15 | +176 ms | +252 ms | +255 ms |

Zero lost cues in that run as well (docs/gate2-run-2026-09-01.log).

## Word boundaries on the platform renderer (September 2, Tears of Steel bridge excerpt)

Speaker-aware now splits each cue into one native cue per verified word boundary (docs/friction-log.md FL-022). The sync tool scores those boundaries against the companion file's word timings (`npm run sync-report -- <log> <vtt> <companion.json>`). Raw log: `docs/device-log-2026-09-02-native-words-sync.txt`.

| Method | Mode | n | p50 (ms) | p95 (ms) | max (ms) | min (ms) |
|---|---|---:|---:|---:|---:|---:|
| A | speaker-aware, word boundaries | 37 | +127 | +221 | +244 | +4 |
| A | speaker-aware, cue boundaries | 19 | +126 | +225 | +229 | +62 |

Lost: 0 of 11 cues. Word boundaries carry the same event lag as cue boundaries, so the native word colouring runs about 125 ms behind the audio at the median by this method. The overlay path (Detailed) drives colouring from the animation-frame clock, which tracks boundaries within about 6 ms on the JS clock; whether that shows on screen is still Measurement C.

## Lead compensation on the native path (September 2, evening)

Four runs put the native cue-event lag at a median of about 125 ms, so the controller now schedules every native cue 120 ms early (`NATIVE_LEAD_MS`). Same excerpt, same method, after the change (raw log `docs/device-log-2026-09-02-native-lead120.txt`):

| Method | Mode | n | p50 (ms) | p95 (ms) | max (ms) | min (ms) |
|---|---|---:|---:|---:|---:|---:|
| A | speaker-aware, word boundaries | 36 | -21 | +112 | +121 | -115 |
| A | speaker-aware, cue boundaries | 19 | +56 | +103 | +122 | -3 |
| A | all | 55 | +16 | +112 | +122 | -115 |

Lost: 0 of 11. Word changes now land a little early at the median, cue changes a little late; both p95 values halved. Caption with Intention asks for colour at the onset, never after, so a slight lead on words is the right side to err on. The overlay path is not shifted: it runs from its own clock. After this run the lead was split: 175 ms for cue entries and exits, 100 ms for word changes (`NATIVE_LEAD_START_MS`, `NATIVE_LEAD_WORD_MS`), because entries lagged 75 ms more than word swaps. The split run (raw log `docs/device-log-2026-09-02-native-split175.txt`) gave word boundaries p50 -5 ms, p95 +144 ms and cue boundaries p50 -94 ms, p95 +75 ms: word swaps are consistent across runs (raw lag 95–99 ms), cue entries are not (raw 176 ms in one run, 81 ms in the next). Both leads were later set to 100 ms (see the clock section below); the honest statement is that native word changes land within about ±10 ms at the median and native cue entries within about ±50 ms, with a p95 near 120 ms either way, until hardware measurements settle the entry figure.

## The media clock, and Method A re-measured with it (September 2, evening)

Polled `currentTime` on the VVD is stale by up to 700 ms (FL-027); the value carried by a `timeupdate` event is fresh. The app now keeps one event-anchored clock (`src/media/MediaClock.ts`) that the controller, the word clock and the second clock all read. Anchor drift over a Detailed run: mean 0 ms, max 49 ms, n = 192. Earlier Method A numbers were read from polled `currentTime` inside the cue handler and therefore include that staleness; the run below is the first with the fresh clock (raw logs `docs/device-log-2026-09-02-native-eventclock.txt`, `...-detailed-eventclock.txt`; leads 130/100 at the time):

| Method | Mode | n | p50 (ms) | p95 (ms) | max (ms) | min (ms) |
|---|---|---:|---:|---:|---:|---:|
| A | speaker-aware, word boundaries | 37 | +14 | +126 | +142 | -88 |
| A | speaker-aware, cue boundaries | 17 | -74 | +115 | +121 | -109 |
| A | detailed (native events while hidden) | 16 | +57 | +116 | +118 | -120 |
| B | detailed | 19 | +1 | +7 | +9 | +0 |

Lost: 0 of 11 in both runs. Across the three native runs the raw entry lag (event time minus boundary, before any lead) was 176, 81 and 56 ms and the raw word-swap lag 99, 95 and 114 ms; both leads are now 100 ms. With them (raw log `docs/device-log-2026-09-02-native-lead100-eventclock.txt`): word boundaries p50 +6 ms, p95 +132 ms; cue boundaries p50 +16 ms, p95 +115 ms; 0 of 11 lost. What we claim for the native path: word and cue changes land within about 20 ms at the median, p95 near 125 ms, zero lost cues, on the virtual device. The overlay path is driven by the fresh clock directly (B p95 7 ms) and shows within a frame in Measurement C.

## Measurement R: overlay render latency (September 2, evening)

Every word-clock boundary logs its wall time; the overlay logs the wall time at which the layout for that media time committed (`[render]`). Raw log `docs/device-log-2026-09-02-render-latency.txt`, Detailed mode, The bridge excerpt:

| Method | n | p50 (ms) | p95 (ms) | max (ms) |
|---|---:|---:|---:|---:|
| R (JS commit after the clock tick) | 48 | 3 | 7 | 68 |

With plain word elements under Reduced motion (the default; raw log `docs/device-log-2026-09-02-render-latency-plain.txt`): n = 49, p50 2 ms, p95 4 ms, max 24 ms. So from clock decision to React commit is single-digit milliseconds; the remaining unknown between commit and pixels is the platform compositor, which only Measurement C on hardware can see.

## Measurement C on the virtual device: what the compositor shows (September 2, afternoon)

Method: window captures of the VVD at about 1.8 per second while The Envelope stand-in plays (it burns a clock and the active cue id into the picture). Each capture is read by macOS Vision OCR: the burned-in clock gives the media time the compositor is showing; the caption text read from the same capture gives the caption set the compositor is showing. Both come from one snapshot, so no clock skew. For each capture: if the shown set equals the schedule's set at that time, the visual lag is at most (time since the last boundary); if not, the smallest shift that makes them agree is a lower bound. Tool: `tools/measure-c.py` (macOS Vision OCR through pyobjc; `tools/ocr-clock.py` reads one capture). Rows and sample captures: docs/measurements/2026-09-02-measurement-c/.

| Path | Samples | Agree | Disagree near a boundary (lower bounds) | Agreeing samples that bound lag from above |
|---|---:|---:|---|---|
| Overlay (Detailed) | 84 | 79 | 5 samples at 20–40 ms after a boundary | 0, 33, 33, 33 ms (then 100 ms and up) |
| Native (Speaker-aware, lead 175/100 ms) | 60 | 53 | all seven: late ≥ 40, 80, 140, 580, 820, 1120 ms and one early ≥ 180 ms. The 580/820/1120 and the 180 rows are cue c025/c027 samples where the capture shows the caption on screen (native-f0053-c025-shown.png) but OCR failed on the two-colour line, so they are measurement misses, not lag; the 40–140 rows are real | 0, 33, 33, 67, 67 ms |

Native path again with both leads at 100 ms (rows in docs/measurements/2026-09-02-measurement-c/native-lead100-rows.json): 58 samples, 50 agree; the disagreements are one startup sample (the picture trails the clock at start, FL-019), five boundary samples at 20 to 240 ms, and two OCR misses on two-colour lines. Agreeing samples bound the lag at 0, 13 and 13 ms in the tightest cases. Same picture as the 175 ms run: the native path is within a frame or two, with the occasional late cue change.

Reading: on the virtual device the overlay path changes captions within about one video frame (33 ms) of the boundary, which matches Method B (6 ms p95 on the JS clock) plus one frame of compositing. The native path with lead compensation is also on time in the samples that can bound it, with the occasional 80–140 ms late case that Method A also shows (p95 +112 ms). The method cannot resolve below a frame or below the capture cadence, and OCR misses lines whose words are in two colours. It says nothing about physical hardware.

## What the numbers mean

- **Method A** (native cue-change events): the media clock read inside the handler is consistently 100 to 260 ms past the cue boundary in every mode and on both tracks. Because the same lag appears in Standard mode, where the platform draws the captions itself, it is a property of when the native pipeline dispatches the event and of the coarse `timeupdate`-style clock the app can read, not of the app's overlay.
- **Method B** (animation-frame sampling against a `performance.now()` anchor): the resolver's expected set changes within about 6 ms (p95) of the boundary when measured on the JS clock. This confirms the anchored clock and the resolver are frame-accurate; it says nothing about when pixels change on screen.
- **Lost cues: 0 of 31** across pause, resume, seek and mode changes in this run, and 0 of 4 across the September 1 scripted suite.
- **Claim we make:** approximately 250 ms p95 by the current event method, zero lost cues in the scripted tests. We do not claim a lower figure until a frame-accurate capture (HDMI or 60 fps recording with the burned-in clock) is compared against the rendered caption (Measurement C).

## Not yet measured

- Visual latency on physical hardware (Measurement C above is virtual-device only and cannot resolve below one frame).
- Physical Fire TV hardware.
- Startup: the first video frames can trail the media clock by about a second on the VVD (FL-019); a visual measurement should start after the first two seconds.

## Re-measured after the September 2 data changes (September 3, morning)

Bridge excerpt, Speaker-aware, leads 100/100, event-anchored clock, after the auto pass added interpolated word timings (67 of 76 words timed) and corrected the lanes. Raw log: docs/device-log-2026-09-03-probe.txt.gz (the file also holds a Detailed run of the lab excerpt; only the speaker-aware rows below are against the bridge track).

| Method | Mode | n | p50 (ms) | p95 (ms) | max (ms) | min (ms) |
|---|---|---:|---:|---:|---:|---:|
| A | speaker-aware (word) | 49 | +30 | +126 | +141 | -87 |
| A | speaker-aware | 15 | -30 | +64 | +146 | -84 |
| B | speaker-aware | 19 | +0 | +4 | +9 | +0 |

Lost: 0 of 11. More word boundaries than before (49 against 37) because interpolated words now split cues too; the median moved from +6 to +30 ms, still inside the "about 20 ms at the median, p95 near 125" claim's spirit but not its letter. The honest statement is now: word changes land within about 30 ms at the median, p95 near 125 ms, on the virtual device.

## Clean single-scene run (September 3, the figure's source)

Earlier September 3 numbers came from a log that held two scenes, so cue boundaries from the lab run were scored against the bridge track and inflated the tail (p95 2476 ms). `tools/sync-report.ts` now takes `--mode`, and the run below is one scene, one mode, start to finish.

| Method | Mode | n | p50 (ms) | p95 (ms) | max (ms) | min (ms) |
|---|---|---:|---:|---:|---:|---:|
| A | speaker-aware (word) | 33 | +7 | +129 | +145 | -90 |
| A | speaker-aware (cue) | 18 | +51 | +145 | +150 | -93 |
| B | speaker-aware | 19 | +0 | +8 | +23 | +0 |

Lost: 0 of 11.
