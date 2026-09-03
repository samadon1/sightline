# Friction log

Recorded as it happens. Format per the hackathon rules (task, steps, expected vs actual, severity, workaround, suggestion). Hackathon rules: product feedback is mandatory; the friction log is optional with up to a 10% Stage 1 bonus.

## FL-001 · 2026-09-01 · Vega SDK installer

- Tool: `get_vvm.sh` installer (SDK 0.24.9914)
- Task: install the SDK unattended on an Apple Silicon Mac (macOS 26.5)
- Expected: a documented non-interactive flag
- Actual: `NONINTERACTIVE=true` works but is undocumented on the install page; discovered by reading the script. Installer also edits five shell rc files, installs a VS Code extension, and enables telemetry by default without a prompt in non-interactive mode.
- Severity: low
- Workaround: read the script; set the env var
- Suggestion: document `NONINTERACTIVE`, `SKIP_SDK_INSTALL`, `VEGA_SDK_VERSION`, and the telemetry opt-out on the install page

## FL-002 · 2026-09-01 · Documentation conflict on `addTextTrack`

- Tool: `@amazon-devices/react-native-w3cmedia` 2.3.x docs
- Task: decide whether the app-parsed cue path is supported
- Expected: one answer
- Actual: the package README lists `addTextTrack` under unsupported HTMLMediaElement features; the "Implement Closed Captions" guide and the `HTMLMediaElement` class page document it with code samples.
- Severity: medium (it decides the architecture)
- Workaround: trust the guide; verify on the virtual device in Gate 1
- Suggestion: remove `addTextTrack` from the README's unsupported list or explain the caveat

## FL-003 · 2026-09-01 · React Native version guidance

- Tool: Vega 0.24 release notes vs `AmazonAppDev/vega-video-sample`
- Task: choose a React Native version to pin
- Expected: docs and the official sample agree
- Actual: release notes say 0.83 is early access and 0.72 remains supported; the official video sample is already on RN 0.83 (`react-native-kepler ~4.0.0+rn0.83.0`, React 19.2).
- Severity: low
- Workaround: use whatever the SDK template generates; record it
- Suggestion: state the recommended version for new projects in one place

## FL-004 · 2026-09-01 · Local video playback undocumented

- Tool: W3C media player docs
- Task: play a bundled 1080p MP4 for a demo with no network dependency
- Expected: a documented asset URI scheme
- Actual: every sample streams over HTTPS; the sample README says no local MP4s are bundled; no doc covers `file://` or asset URIs.
- Severity: medium for offline demos
- Workaround: serve the file from the development Mac over HTTP (planned); verify a bundled asset first
- Suggestion: document local/bundled media support explicitly

## FL-005 · 2026-09-01 · No virtual-device recording command; recording may crash the VVD

- Tool: Vega Virtual Device
- Task: capture the demo video from the simulator
- Expected: a `vega virtual-device record` or screenshot command
- Actual: none documented; known-issues page says the VVD "may crash when running multiple resource-intensive processes (such as screen, audio, and video recording) simultaneously"
- Severity: medium (demo production risk)
- Workaround: record on a Fire TV Stick over HDMI capture, or capture short VVD segments
- Suggestion: add a built-in screenshot/record command

## FL-006 · 2026-09-01 · Accessibility settings module not in the OS 1.2 profile

- Tool: `vega project install` (CLI 1.3.4, SDK 0.24.9914)
- Task: add `@amazon-devices/kepler-a11y-settings-interface-turbo` (documented as new in 0.24) to a template app
- Expected: the resolver adds it like it added `react-native-w3cmedia`
- Actual: "not in OS version 1.2 profile, skipping". The only OS target the CLI offers is 1.2. The package exists on the registry (`latest` 1.0.0, `rn83-alpha` 1.0.0-rn-83) and the SDK ships a native `KeplerA11ySettingsInterface` component, so the JS module and the OS profile disagree.
- Severity: high for this project (system caption preferences are a core claim)
- Workaround: add `^1.0.0` to package.json by hand; import it behind a try/catch; test on the virtual device in Gate 1. If it fails at runtime, the app must disclose that it only reads its own caption-size setting.
- Suggestion: either include the module in the 1.2 profile or state in the 0.24 API docs which OS version first exposes it

## FL-007 · 2026-09-01 · Template and docs disagree on React Native version

- Tool: `vega project list-templates`
- Actual: `helloWorld` targets RN 0.83 and is listed first; `helloWorld-rn72` targets 0.72. Release notes call 0.83 early access. Chose `helloWorld` (0.83) to match the official video sample.
- Severity: low

## FL-008 · 2026-09-01 · URL-mode playback fails for every source on the virtual device (root-caused)

- Tool: `@amazon-devices/react-native-w3cmedia` 2.3.2 on Vega Virtual Device (SDK 0.24.9914, aarch64 guest on Apple Silicon)
- Task: play one MP4 in URL mode from a generated template app
- Expected: `loadedmetadata`, then playback
- Actual: `error` fires with `{code: 4, message: ""}` for every source tried: local MP4 over HTTP with Range support, local MP4 over plain HTTP, the official sample's public HTTPS MP4, and an audio-only MP3. `initialize()` resolves, surface and caption handles attach, and `getCaptionPreferences()` from the accessibility module returns real values, so the app runs and the media element exists. Changing the setup order (sample's prebuffer flow vs. the docs' surface-first flow), removing the text track, removing the caption view, adding `com.amazon.category.kepler.media`, and adding every media service and privilege the sample and the FAQ list made no difference.
- Diagnostics gap: the app's `W3CMEDIA` info logs are rate-suppressed ("943 logs were suppressed at this level"), so the pipeline's own reason never reaches `start-log-stream` or `copy-logs`. There is no documented way to raise the log level for one app, and `MediaError.message` is empty.
- Severity: critical for Gate 0 until the control result is in
- Root cause (verified): the native URL pipeline's open call fails synchronously. With the app's log flood removed, the W3CMEDIA lines read: `Creating URL MediaSource` → `opening...` → `All tracks configured, open now` → `Open failed -1` → `set_src_uri: MPB Call failed with code: 50004` → `makeMediaError: code= 4`. It fails for HTTP, HTTPS, and a packaged `file:///pkg/assets/raw/` file, and for MP3 as well as MP4.
- Control: the unmodified official `vega-video-sample` plays its tiles, but through the MSE pipeline (`build_mse_pipeline`, Shaka). When its `VideoHandler` is forced to URL mode (`loadStaticMediaPlayer`) with the sample's own public MP4, it fails with the identical `Open failed -1 / 50004`. So URL mode is broken on this VVD image (SDK 0.24.9914, aarch64 guest on Apple Silicon), independent of the app.
- Consequence: the prototype uses an MSE source (HLS via hls.js or Shaka). Whether URL mode works on a physical Fire TV Stick is untested.
- Side finding: files placed in `apps/<app>/assets/raw/` are packaged and readable at `file:///pkg/assets/raw/<name>` (verified with `fetch`), which answers the bundled-video question.
- Diagnostics lesson: the app's own log rate limit (300 lines/s) was tripped by React re-render logging from `KeplerVideoSurfaceView`; keep the player screen free of per-frame state updates or the pipeline's error lines are suppressed.
- Suggestion: populate `MediaError.message` with the MPB status (50004) and its meaning; document URL-mode support on the VVD; document a per-app log-level switch

## FL-009 · 2026-09-01 · `inputd-cli` is the way to drive the virtual device, and it is undocumented

- Tool: Vega Virtual Device
- Task: press remote buttons from a script (needed for repeatable caption sync tests and demo recording)
- Expected: a documented `vega device` key-injection command
- Actual: the on-screen remote does not respond to synthesized mouse events or keyboard input from the host. The device has `inputd-cli button_press KEY_DOWN|KEY_ENTER|KEY_MENU|…` (run via `vega device run-cmd -c '…'`), which works perfectly and also supports `series`, `send_text`, `touch`, `mouse_click`. Nothing in the docs mentions it.
- Severity: medium (it unblocked every automated test tonight)
- Suggestion: expose `vega device press-key` in the CLI and document the key names; document which `inputd` key names map to which `TVEventHandler` event types (`KEY_REWIND` did not arrive as `skip_backward`)

## FL-010 · 2026-09-01 · `loadedmetadata` fires twice on the Shaka/MSE path

- Tool: `react-native-w3cmedia` 2.3.2 + Vega-patched Shaka 4.8.5
- Actual: two `loadedmetadata` events per load; mounting the surface and caption views on the event mounted them twice (`[surface] created` ×2). Guarded with a flag in the app.
- Severity: low

## FL-011 · 2026-09-01 · `cuechange` timing and the sampled media time

- Tool: `TextTrack.oncuechange` / `activeCues` (native, app-parsed cues)
- Actual: events fire reliably, including while the track is `hidden` (which makes a custom overlay driven by native timing possible). The media time read inside the handler is consistently 100 to 260 ms past the cue boundary, in line with a coarse `timeupdate` cadence. `timeupdate` frequency is undocumented.
- Severity: low for captions, but it caps what can honestly be claimed about sync without a frame-accurate measurement
- Suggestion: document `timeupdate` cadence and whether `cuechange` is dispatched from the media clock or from `timeupdate`

## FL-012 · 2026-09-02 · No way to change the system caption size on the virtual device

- Tool: Vega Virtual Device settings, `a11y-tv-util`, `kepler-a11y-settings-interface-turbo`
- Task: exercise the "caption size grows, side lane falls back" behaviour from the real system setting
- Actual: the VVD launcher's Settings has only Account Settings and Parental Controls (no Accessibility page). The on-device `a11y-tv-util settings set CaptionsPrefTextSize large` first errored with "Error obtaining user profile object", then accepted the write after a `y` confirmation but `get` and `list` showed nothing and the native captions did not change. `KeplerA11ySettingsInterface.setCaptionPreferences({textSize:"very_large"})` resolves without error from a third-party app but no preference event follows and nothing changes (the write privilege is reserved for system apps). Reading preferences works (`getCaptionPreferences` returns real values).
- Severity: medium. The lane-fallback logic is verified in unit tests and, in-app, through a development-only simulated size (labelled SIMULATED in diagnostics); the native renderer's own size change remains unverified until a physical device.
- Suggestion: add an Accessibility page to the VVD settings, or make `a11y-tv-util` work without a signed-in profile

## FL-013 · 2026-09-02 · Back exits the app unless handled through BackHandler

- Tool: React Native for Vega remote input
- Actual: `TVEventHandler` receives `back`, but the OS still leaves the app on Back unless a `BackHandler` `hardwareBackPress` listener returns true. The docs say the default cannot be overridden through TVEventHandler; the BackHandler path is the one that works (as in the official sample).
- Severity: low once known; it cost one build cycle

## FL-014 · 2026-09-02 · Logical window is smaller than 1920 on the VVD

- Tool: React Native for Vega layout
- Actual: sizes authored for a 1920x1080 canvas render about twice too large; `Dimensions.get("window")` reports a smaller logical width (density scaling). All sizes are now multiplied by `window.width / 1920`.
- Suggestion: state the logical resolution and density of the VVD and of each Vega device in the docs

## FL-015 · 2026-09-02 · The OK button arrives as "enter", page keys as "pageup"/"pagedown"

- Tool: TVEventHandler event names
- Actual: the documented `select` never arrived from the on-screen remote or `inputd-cli KEY_ENTER`; the event type is `enter`. `KEY_PAGEUP` arrives as `pageup`, not `page_up`. `KEY_REWIND` from `inputd-cli` did not produce any app event.
- Suggestion: publish the exact event-type strings per key

## FL-016 · 2026-09-02 · `onSurfaceViewCreated` fires twice per mount

- Tool: `KeplerVideoSurfaceView`
- Actual: two `surface created` callbacks with different handles on a single mount; calling `play()` in the callback started playback twice. Guarded with a flag; the second handle is still attached.
- Severity: low

## FL-017 · 2026-09-02 · `cuechange` timing lag is present in Standard mode too

- Tool: native text track events
- Actual: the media time read in the `cuechange` handler is 100 to 260 ms past the boundary even when the platform renders the captions itself (Standard), so the lag is in event dispatch and clock granularity, not in the app overlay. See docs/sync-report.md.
- Suggestion: expose a presentation timestamp on cue events, or document the dispatch cadence

## FL-018 · 2026-09-02 · The Vega Virtual Device exited on its own after several hours

- Tool: Vega Virtual Device (VVD), SDK 0.24.9914, Apple Silicon host
- Actual: after roughly four hours of repeated `vega run-app` installs and remote input scripting, `vega device list` returned "No devices found" and `run-app` failed with "Cannot find an instance of Vega Virtual Device". No crash dialog. `vega virtual-device start --timeout 180` brought it back in under a minute and the app ran unchanged.
- Impact: 5 minutes. Demo capture sessions should start the VVD fresh.
- Suggestion: log the exit reason somewhere discoverable (`~/vega/sdk/.../logs` had nothing obvious).

## FL-019 · 2026-09-02 · At playback start the first video frames can trail the media clock by about a second

- Tool: HLS through the Vega-patched Shaka player on the VVD
- Actual: docs/captures/2026-09-02-fx09-startup-frame-lag.png shows the burned-in clock at 00:00.167 while the native renderer already displays cue c001 (starts at 1.200). The caption engine is following `currentTime`; the picture is catching up. Later captures in the same run line up (fxc01 at 1.367 with c001, fx07 at 2.233).
- Impact: none on the measurements, which compare cue events with `currentTime`, but a visual (Method C) measurement would see it as a large early error in the first second. Keep the first cue of any scene at least two seconds in, as The Envelope does.
- Suggestion: none for the platform yet; it may be VVD-only.

## FL-020 · 2026-09-02 · KEY_HOME does nothing on the VVD; `launch-app` on a running app restarts it

- Tool: `inputd-cli button_press KEY_HOME`, `vega device launch-app`
- Actual: during playback KEY_HOME left the app in the foreground (captions and cue events continued for the next seven seconds). `launch-app` on the already-running app tore it down and started a fresh process at the landing screen, with in-memory settings back to defaults.
- Impact: the background/foreground scenario (integration row 23) cannot be exercised on the virtual device. Viewer settings were not persisted; fixed the same morning with `@amazon-devices/react-native-async-storage__async-storage` (module declared in manifest.toml as in the official sample).
- Suggestion: a documented way to send the app to the background on the VVD, or a note that HOME is not routed there.

## FL-021 · 2026-09-02 · The VVD window at its default size hides the right 14% of the screen behind the remote panel

- Tool: Vega Virtual Device window (macOS), default 1160 × 568 points
- Actual: the device screen is 960 × 540 logical points, but the remote-control panel is drawn over the right edge of that area, so anything in the rightmost ~135 points is invisible in the window and in window captures. Right-lane captions looked as if they ran off the screen; the overlay's own `onLayout` showed the lanes exactly where they should be (root 960 × 540, right lane x=480 w=403). Resizing the window to about 1360 × 660 points (System Events `set size of window 1`) shows the whole screen.
- Impact: 90 minutes, one wrong hypothesis about nested `Text` measurement (retracted), one temporary layout workaround (reverted). Every earlier right-lane capture in docs/captures made before this entry is clipped the same way; the captions were not.
- Suggestion: open the window wide enough for the screen plus the panel by default, or make the panel push the screen instead of covering it.

## FL-022 · 2026-09-02 · What the native Fire TV caption renderer does with WebVTT cue-text markup

- Tool: KeplerCaptionsView via `VTTCue.text` (fixture scene `fixture-vtt-markup`, Standard mode, raw payload passed through)
- Observed on the VVD (docs/captures/2026-09-02-native-markup-*.png):
  - `<c.yellow>…</c>` renders the span in yellow. The standard WebVTT colour classes are therefore usable for per-span colour on the native path.
  - `<b>`, `<i>`, `<u>` are ignored (plain text, tags stripped).
  - Timestamp tags `<00:00:01.900>` are stripped and produce no karaoke effect (no past/future styling).
  - `<v Name>` is stripped, as expected; no label is drawn.
- Consequence: word-level colour on the platform renderer is possible by splitting a cue into one native cue per word boundary, each carrying the spoken words in `<c.colour>` and the rest plain. Its timing would carry the native cue-event lag (about 130 to 230 ms, docs/sync-report.md). Italic for off-camera voices, as Caption with Intention specifies, is not available on the native path.
- Suggestion: document the supported subset of WebVTT cue-text markup for third-party tracks.

## FL-023 · 2026-09-02 · A `<c.class>` span that starts after a line break ends early on the native renderer

- Tool: KeplerCaptionsView, cue text `THOM\n<c.cyan>Look Celia, we have to follow our passions;</c>`
- Actual: the colour stopped at "passi|ons;", four characters short: exactly the length of "THOM" on the line above. With "CELIA" the shortfall was five. The renderer appears to compute span offsets on the text without the first line and apply them to the full text.
- Fix: wrap the whole cue, label line included, in the span. The label takes the character colour, which is what Caption with Intention wants anyway.
- Suggestion: fix span offset calculation across line breaks.

## FL-024 · 2026-09-02 · Variable fonts are ignored; static instances load

- Tool: React Native for Vega text rendering, `assets/fonts/<Family>.ttf`
- Actual: the variable Roboto Flex file (13 axes) was packaged and named correctly but text rendered in the system face. Static instances made with fontTools (`Roboto Flex`, `Roboto Flex Light`, `Roboto Flex Bold`, `Roboto Flex Wide`, `Roboto Flex Narrow`, one family per file) load and render. Verified with an off-screen probe that measures the same string in two families (widths 454 vs 405 px).
- Pitfall found on the way: a probe whose two `Text` children sit in a column `View` reports identical widths because the parent stretches them; `alignItems: "flex-start"` is required for the measurement to mean anything.
- Impact: 40 minutes. Weight steps (Light 300, Regular 400, Bold 700) are chosen by family name rather than `fontWeight`; the Wide and Narrow instances are packaged for a future width axis driven by measured harmonics and are not used yet.
- Suggestion: document variable-font support (or its absence) and how `fontWeight` picks among files.

## FL-025 · 2026-09-02 · `fetch("file:///pkg/...")` rejects on Vega; XMLHttpRequest reads packaged files

- Tool: React Native for Vega fetch polyfill, packaged raw assets (`assets/raw` → `file:///pkg/assets/raw/...`)
- Actual: `fetch` of a packaged file throws `RangeError: Failed to construct 'Response': The status provided (0) is outside the range [200, 599]` and, unhandled inside a Shaka scheme plugin, took the app down to the launcher. `XMLHttpRequest` with `responseType = "arraybuffer"` returns the bytes with `status 0`. A Shaka `file` scheme plugin built on XHR plays the packaged HLS rendition (72 cue events on the bridge excerpt with the LAN server stopped).
- Impact: 40 minutes; one crash. The app now plays from the package whenever the LAN manifest does not answer within 1.5 s (`[player] source=packaged`). The package grew to about 38 MB.
- Suggestion: let fetch return a status-0 response for file URIs, or document the XHR route.

## FL-026 · 2026-09-02 · The native renderer positions cues within the video's letterboxed area, the overlay within the screen

- Tool: KeplerCaptionsView with positioned `VTTCue` (`line: 90`), a 2.39:1 film letterboxed in 16:9
- Actual: a bottom cue on the native path sits at 90% of the *picture* height, so it appears just above the black bar; the same lane in the overlay (Detailed) sits at 7.5% from the screen bottom, over the bar. Both are consistent with their own coordinate systems; a reviewer reading the captures saw the native cue "mid-frame".
- Impact: none functionally; the lane estimator's geometry (screen fractions) is a slight over-estimate of where the native renderer draws on letterboxed film. Documented rather than changed: the native placement keeps captions on the picture, which broadcasters prefer, and the overlay follows Caption with Intention's work area.
- Suggestion: expose the rendered caption viewport so an app can reconcile the two.

## FL-027 · 2026-09-02 · Polled `currentTime` is stale by up to 700 ms; the value at a `timeupdate` event is fresh

- Tool: `@amazon-devices/react-native-w3cmedia` VideoPlayer on the VVD
- Actual: reading `player.currentTime` from an animation frame returns a value that lags a wall-clock projection from the last event by 120–220 ms typically and up to 710 ms at times; the value read inside a `timeupdate` handler matches the projection within a mean of 7 ms over 160 events. A clock that re-anchored on polled reads every second therefore jumped backwards about 140 ms each time; anchoring on the events removed the jumps (Method B p95 +7 ms with no re-anchoring).
- Consequence for the measurements: Method A also read `currentTime` inside the native `cuechange` handler, so its "lag" includes the staleness of that read. The app now has one event-anchored media clock (`src/media/MediaClock.ts`) shared by the controller, the word clock and the second clock; Method A is re-measured with it below in docs/sync-report.md.
- Also seen: after a seek into the middle of a 4 s segment the picture on the VVD plays from the segment start while the clock reports the seek target for a moment (same as the startup case, FL-019); captions follow the clock.
- Suggestion: document the `timeupdate` cadence and the staleness of polled reads.

## FL-028 · Absolutely positioned images keep their intrinsic size
- Date: 2026-09-02
- Tool: React Native for Vega 0.83, `Image` on the Vega Virtual Device (SDK 0.24.9914)
- Task: fill a screen or a panel with a poster or a gradient strip (`style={StyleSheet.absoluteFill}`, `resizeMode="cover"`)
- Actual: the image renders at its intrinsic pixel size anchored top-left; a 640x360 backdrop covered a corner of the screen while a 1280x720 poster happened to cover it. On React Native for iOS and Android the same style fills the parent.
- Workaround: add explicit `width: "100%", height: "100%"` to the absolute style (or wrap in a sized `View`). Applied to every fill image and scrim in the app.
- Impact: 20 minutes. Suggestion: document the difference, or make absolute images without a size fill their parent as the upstream renderer does.

## FL-029 · Initial focus: a horizontal ScrollView wins it, and `hasTVPreferredFocus` re-asserts on every render
- Date: 2026-09-02
- Tool: React Native for Vega 0.83 focus engine, Vega Virtual Device (SDK 0.24.9914)
- Task: land initial focus on the Play button while a horizontal `ScrollView` of focusable cards is on the same screen; keep focus movable on an end card whose first button has `hasTVPreferredFocus`
- Actual: on some mounts (reliably after returning from playback) the scroll view's first card took focus although only Play declared `hasTVPreferredFocus`. And any state update that re-rendered the end card pulled focus back to its preferred button, so arrow keys appeared dead while a global key handler was also seeking on those keys.
- Workaround: request Play's focus 250 ms after mount and mount the rail only after Play reports focus (with a 2.5 s fallback); stop handling arrow and Select keys globally while the end card is up, so nothing re-renders it during navigation.
- Impact: 40 minutes over two sessions. Suggestion: document initial-focus precedence for scroll views, and make `hasTVPreferredFocus` a one-shot request as on the other platforms.

## FL-030 · After the virtual device restarts itself, the audio sink throws a decode error on the first seek
- Date: 2026-09-03
- Tool: Vega Virtual Device (SDK 0.24.9914), `novaaudiosink`
- Task: seek 10 s during playback of an HLS rendition through the Vega Shaka player
- Actual: on a device that had exited on its own (FL-018) and been started again, the first seek raised `MediaError code 3: [com.amazon.apmf.InvalidArgumentError]: Bad Value` from `novaaudiosink.c(2776)` in three of four runs; reloading the scene and seeking to the same position raised it again. After `vega virtual-device stop` and `start`, zero errors in three runs of the same script. No such line in any log from September 2.
- Workaround: stop and start the device cleanly before a session; the app also recovers once from a mid-playback decode error by reloading the scene at the same position before it shows the error card.
- Impact: 90 minutes, mostly spent suspecting the app. Suggestion: log the audio sink's state at seek, and reset it on app relaunch.

## FL-031 · Focus routing needs the Kepler APIs, not the React Native TV props
- Date: 2026-09-03
- Tool: React Native for Vega 0.83 focus engine
- Task: send Down from a row of buttons to a specific card, and keep focus inside a dialog
- Actual: the `nextFocusDown`/`nextFocusUp` props familiar from React Native TV had no effect, so spatial guessing sent Down from the last pill into the middle of a horizontal rail and Up from a card to the nearest pill rather than to the primary action. The working APIs are `FocusManager.setNextFocus(fromHandle, toHandle, "down")` with `findNodeHandle`, and `TVFocusGuideView` with `trapFocusUp/Down/Left/Right`, both from `@amazon-devices/react-native-kepler`. Found by reading AmazonAppDev/vega-tv-interfaces-sample (MIT-0), not from the platform docs we had.
- Impact: one UX finding carried for a day as "not fixable". Suggestion: mention both APIs on the focus-management page, and say plainly that the React Native TV `nextFocus*` props are not the mechanism here.
