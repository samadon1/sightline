# Gate 0–2 prototype checklist (September 1–5, 2026)

Decision basis: `sightline_fable_review.md` §25.6 and §25.14, plus the adjudication of September 1.
Working name only. Rename before any public repository.

## What this prototype must prove

| Gate | Evidence | Pass | Fail |
|---|---|---|---|
| G0 Environment | VVD boots; sample app runs; remote works; a 1080p H.264/AAC MP4 plays from a bundled or locally served file | All four | Cannot play local video after one day and cannot host it either |
| G1 Native lanes | App parses `captions.en.vtt`, creates `VTTCue` objects with `line`/`position`/`align`/`size`, and `KeplerCaptionsView` shows them in left, right, and bottom lanes; changing Fire TV caption size in Settings changes the rendered captions; mode switch (Standard ↔ Speaker-aware) rebuilds cues with no flash | All three | Native ignores position settings and G2 also fails |
| G2 Overlay clock | Native track set to `hidden`; a React Native overlay renders the same cue model; p95 cue-boundary error ≤ 150 ms (≤ 250 ms acceptable if `timeupdate` is coarse, disclosed); zero lost cues across 20 scripted pause/seek operations | Numbers logged | Drift or lost cues after two focused days |

Also part of G1 (raised in the adjudication): the native renderer does not expose measured cue bounds. The font-size lane fallback therefore uses `estimateLaneBox()` from `packages/core/src/lanes.ts`. Calibrate its `charW` and `lineH` constants against what the VVD actually renders at each `CaptionTextSize` value, and record the numbers in the friction log.

## Verified platform facts to rely on (Vega 0.24 docs, September 1, 2026)

- App-parsed cue path: `videoPlayer.addTextTrack('subtitles', label, 'en')`, `new VTTCue(start, end, text)`, set `lineAlign`, `positionAlign`, `size`, then `textTrack.addCue(cue)`. Text track modes: `disabled | hidden | showing`.
- `TextTrack` exposes `cues`, `activeCues`, `oncuechange`, `addCue`, `removeCue`. `VTTCue` exposes `onenter` / `onexit`. Whether these fire while the track is `hidden` is a G2 test, not an assumption.
- `KeplerCaptionsView` wiring (from the official sample `PlayerScreen.tsx`): `onCaptionViewCreated={(h) => video.setCaptionViewHandle(h)}`, `onCaptionViewDestroyed={(h) => video.clearCaptionViewHandle(h)}`, `show={boolean}`, absolutely positioned above `KeplerVideoSurfaceView`. Only one `KeplerCaptionsView` per process.
- Native limits: no VTTRegion, no CSS styling, auto window size only, bottom placement when position is absent.
- Media events: `timeupdate, ended, play, pause, seeking, seeked, ratechange, loadedmetadata, error`. `playbackRate`, `loop`, `volume`, `muted`, `preload`, `fastSeek` are unsupported. `timeupdate` cadence is undocumented: measure it.
- Accessibility: `@amazon-devices/kepler-a11y-settings-interface-turbo` → `CaptioningProps` (`textSize`, `textColor`, `textFont`, `textEdgeStyle`, `textOpacity`, `textBackgroundColor`, `textBackgroundOpacity`, `windowBackgroundColor`, `windowBackgroundOpacity`). Read-only for third-party apps. No system reduce-motion setting exists.
- Remote: `useTVEventHandler` keys `up, down, left, right, select, back, menu, playpause, …`; manifest needs `com.amazon.inputd.service`.
- The official sample is on React Native 0.83 (`@amazon-devices/react-native-kepler ~4.0.0+rn0.83.0`) even though docs call 0.83 early access and 0.72 supported. Use whatever the SDK template generates; record the version in the friction log.

## Commands (verified against CLI 1.3.4 / SDK 0.24.9914 on this Mac)

The app was generated with `vega project generate -t helloWorld -n SightlinePlayer --packageId com.sightlinewip.player`
and merged into `apps/vega-player`. Package id `com.sightlinewip.player`, component `com.sightlinewip.player.main`.

```bash
# after install (installer updates ~/.zshrc; open a new shell or:)
source ~/vega/env
vega --version

# virtual device
vega virtual-device start --timeout 120
vega device list
vega virtual-device stop

# build + run (from apps/vega-player; dependencies are installed at the repo root via workspaces)
npm run build:debug        # = react-native build-vega --build-type Debug
vega run-app build/aarch64-debug/*.vpkg com.sightlinewip.player.main -d VirtualDevice
vega device start-log-stream   # console.log lines: [clock] [cuechange] [mode] [a11y]

# real Fire TV Stick (Developer Mode on, USB attached)
vega device install-app --packagePath build/armv7-release/<app>_armv7.vpkg
vega device launch-app --appName <component-id>
```

## Build order (smallest first)

1. Generate the app from the SDK template; run it unchanged on the VVD. (G0)
2. Replace the home screen with a full-screen `KeplerVideoSurfaceView` + `KeplerCaptionsView` playing `assets/prototype/placeholder.mp4`. Try a bundled asset first; if it will not load, serve the file from a local HTTP server on the Mac and use `http://<mac-ip>:8080/placeholder.mp4`. (G0)
3. Load `assets/prototype/captions.en.vtt` with `parseVtt()` from `packages/core`; add a `subtitles` track; add four `VTTCue` objects with no settings; set `mode = 'showing'`. Confirm bottom captions. (G1 Standard)
4. Add a `Speaker-aware` toggle on `select` or `menu`: rebuild cues with `laneToCueSettings(lane)` (Maya → `lower_left`, Daniel → `lower_right`, sound → `bottom_center`) and a label line (`MAYA` above the text). Confirm left/right placement. (G1)
5. In Fire TV Settings → Accessibility → Closed Captions, change text size to Large and Largest; return to the app; confirm the native captions resize; log `CaptioningProps` on each change. (G1)
6. Calibrate `estimateLaneBox()` constants against what steps 4–5 render. Make the left lane reject at the largest size and fall to bottom. (G1, fallback demo)
7. Set the track to `hidden`; add an absolutely positioned overlay `<View>` that renders `activeCues` text in the lane box; log every `cuechange` / `onenter` / `onexit` with `video.currentTime` and `Date.now()`. If none fire when hidden, drive it from `timeupdate` + `requestAnimationFrame`. (G2)
8. Script: play 5 s, pause 2 s, resume, seek −4 s, seek +6 s, seek to 0, repeat ×4. Log expected vs rendered cue at each boundary. Compute p50/p95 boundary error and lost-cue count. (G2)
9. Write `docs/friction-log.md` entries as they happen, not afterwards.

## Measurement log format

```
ts_wall_ms, media_time_ms, event, expected_cue, rendered_cue, lane, mode, note
```

Boundary error = `media_time_ms at render − cue.startMs` (or `endMs` for exits). Report p50 and p95 over all boundaries in the scripted run.

## Not in this prototype

Word timing, companion JSON file, protected regions, Studio, Transcribe, AWS, polished film, animation, any settings beyond Mode and Reduced motion.

---

## Results, September 1, 2026 (night one)

Environment: Vega SDK 0.24.9914, CLI 1.3.4, VVD aarch64 on an Apple Silicon Mac, React Native for Vega 0.83 (helloWorld template), `react-native-w3cmedia` 2.3.2, `kepler-a11y-settings-interface-turbo` 1.0.0.

| Gate | Result | Evidence |
|---|---|---|
| G0 Environment | **Pass, with one platform caveat** | VVD boots; app installs and launches; remote input works (`inputd-cli` on the device, and `useTVEventHandler` in the app). Video plays **only through the MSE path** (Shaka, HLS rendition of the placeholder served from the Mac). URL-mode playback fails for every source with native `Open failed -1 / MPB 50004`, reproduced with the official sample forced into URL mode. See friction log FL-008. |
| G1 Native lanes | **Pass** (font-size step pending) | App-parsed `VTTCue` objects with `line/position/positionAlign/align/size` render in the lower-left and lower-right lanes on `KeplerCaptionsView`, with the speaker label as a first line (`docs/captures/run22c.png`, `run25-spk-a.png`). Standard mode renders bottom-center (`run22a.png`). Mode switch rebuilds cues with no visible flash. `getCaptionPreferences()` returns real values (textSize normal, font default, colors default). The resolver's size-driven fallback is exercised via the app's scale keys: at 1.25x the 21-character cue drops to bottom, at 1.5x all side-lane cues drop (`[mode]` lines in `docs/gate2-run-2026-09-01.log`). Changing the system caption size in the VVD settings UI and watching the native size follow is the one G1 step not yet done. |
| G2 Overlay clock | **Pass at the disclosed band** | Native track set to `hidden` still fires `cuechange`; the React Native overlay renders `activeCues` text in sync with the burned-in clock (`run25-det.png`). Scripted run per mode: play, pause at 9 s, resume, seek 7 s, seek 12 s, seek 0. Boundary-crossing error (media time at `cuechange` minus cue boundary), seek recomputes excluded: Standard p50 +150 / p95 +233 ms; Speaker-aware p50 +108 / p95 +234 ms; Detailed p50 +176 / p95 +252 ms; overall n=45, p50 +155, p95 +252, max +262 ms. Every boundary produced an event: **0 lost cues** across 3 modes × (1 pause/resume + 3 seeks). Seeks recompute the active set within about 300 ms. The errors are all late and cluster near the `timeupdate` granularity, so the true render latency is likely smaller than the sampled media time suggests; the 150 ms target is not met by this measurement method, the 250 ms disclosed band is. |

Calibration captured from the VVD at CaptionTextSize "normal": one native caption line ≈ 9.5% of viewport height; ≈ 1.74% of viewport width per character. `estimateLaneBox()` now uses these; side lanes allow a label plus one dialogue line, longer text goes to the bottom lane.

Open items for September 2 to 5:
- Change the system caption size in VVD Settings → Accessibility and confirm the native captions scale and the lane fallback triggers from the real setting (not the app's scale keys).
- Fix the double `loadedmetadata` / double surface mount (guarded in code now; confirm in the log).
- Remote: `KEY_REWIND` from `inputd-cli` did not reach the app as `skip_backward` or `rewind`; the event names are now logged (`[remote]`) to map them.
- Measure with a second clock source (wall time at `cuechange` versus frame-accurate capture) before quoting a number below 250 ms.
- Test URL mode on a physical Fire TV Stick; if it works there, the HLS step is VVD-only.

---

## Results, September 2, 2026 (night two: product shell on the same runtime)

- The prototype screen was replaced by the product shell (landing, caption settings with one-action Standard, About, playback controls, loading and error states, end card) driven by `packages/core` through `CaptionController`. Captures: `docs/captures/2026-09-02-*.png`.
- "The Envelope", "Keys" and "Hallway" have fair Standard tracks (Netflix TTSG rules) and validated companion files; synthesized stand-in footage exercises them end to end (labelled as not study footage).
- Verified on the VVD: speaker labels on run starts, dual-speaker cues labelled "DANIEL, then MAYA", `[unknown voice]` left as canonical text with no doubled label, the `proposed` cue (c024) rendering plain, Detailed overlay with speaker colour and the reveal at 30 s, one-action return to Standard, Back handled inside the app.
- Side-lane budget changed to a label plus two dialogue lines with a 35% height cap after the first Envelope run sent most real-length captions to the bottom; at "large" all labelled cues fall to the bottom (tests in packages/core).
- Sync on The Envelope (58 boundary crossings): Method A p50 +128 ms, p95 +237 ms, max +257 ms, 0 lost cues; Method B (rAF clock) p95 +6 ms. See docs/sync-report.md.
- The real system caption-size change could not be exercised on the VVD (FL-012); the fallback is exercised through a development-only simulated size.
