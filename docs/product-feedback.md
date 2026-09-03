# Product feedback: Amazon and Vega tools used

This is the mandatory hackathon product feedback, one entry per Amazon or Vega tool actually used. Every statement here comes from `docs/friction-log.md` (FL-001 to FL-011) or `docs/gate-1-prototype.md`; nothing is reported that was not experienced on this project. Environment: Vega SDK 0.24.9914, CLI 1.3.4, Vega Virtual Device (aarch64) on an Apple Silicon Mac running macOS 26.5, React Native for Vega 0.83 from the `helloWorld` template, `react-native-w3cmedia` 2.3.2, `kepler-a11y-settings-interface-turbo` 1.0.0. No physical Fire TV device has been used yet.

Where a field says "not recorded", the friction log has no entry for it and we did not want to invent one.

---

## 1. Vega SDK installer (`get_vvm.sh`)

- **What we used it for:** installing SDK 0.24.9914 unattended on the Mac.
- **What worked well:** the install completed, and `NONINTERACTIVE=true` does work for an unattended run.
- **What was confusing or difficult:** `NONINTERACTIVE` is undocumented on the install page; we found it by reading the script. In non-interactive mode the installer also edits five shell rc files, installs a VS Code extension, and enables telemetry by default without a prompt (FL-001).
- **Onboarding experience:** one script, then `source ~/vega/env` and `vega --version`. Fine once the flag was known.
- **Missing capability:** documented non-interactive flags and a documented telemetry opt-out.
- **Workaround:** read the script; set the environment variable.
- **Would we build with it again:** yes.
- **Most important feature request:** document `NONINTERACTIVE`, `SKIP_SDK_INSTALL`, `VEGA_SDK_VERSION`, and the telemetry opt-out on the install page.

## 2. Vega CLI (`vega`, 1.3.4)

- **What we used it for:** generating the app from a template (`vega project generate -t helloWorld`), adding platform packages (`vega project install`), starting and stopping the virtual device, installing and launching the app (`vega run-app`), streaming device logs (`vega device start-log-stream`), and running commands on the device (`vega device run-cmd`).
- **What worked well:** generate, build, run-app, and log streaming all worked as documented and were verified against the exact commands in `docs/gate-1-prototype.md`. `vega device run-cmd` turned out to be the door to everything else on the device.
- **What was confusing or difficult:** `vega project install` refused to add `@amazon-devices/kepler-a11y-settings-interface-turbo` with "not in OS version 1.2 profile, skipping", although 1.2 is the only OS target the CLI offers and the package exists on the registry (FL-006). `vega project list-templates` lists a RN 0.83 `helloWorld` first while the release notes call 0.83 early access (FL-007).
- **Onboarding experience:** good for the happy path. The template-version question and the profile mismatch both cost time on day one.
- **Missing capability:** no key-injection command (`vega device press-key` or similar), no screenshot or screen-recording command for the virtual device (FL-005, FL-009), no per-app log-level switch (FL-008).
- **Workaround:** added the accessibility package to `package.json` by hand; used `inputd-cli` through `run-cmd` for key presses.
- **Would we build with it again:** yes.
- **Most important feature request:** a documented `vega device press-key` (with the key names and their `TVEventHandler` equivalents) and a built-in screenshot/record command.

## 3. Vega Virtual Device

- **What we used it for:** every test and capture on this project so far: Gates 0 to 2, caption rendering, the sync measurement, and all captures in `docs/captures/`.
- **What worked well:** it boots reliably, the app installs and launches, remote input works, `KeplerCaptionsView` renders positioned cues, and `getCaptionPreferences()` returns real values. The scripted sync run (`docs/gate2-run-2026-09-01.log`) was done entirely on it.
- **What was confusing or difficult:** URL-mode media playback fails for every source (local HTTP, HTTPS, packaged `file:///pkg/assets/raw/`, MP3 as well as MP4) with `Open failed -1 / MPB 50004`; the unmodified official sample forced into URL mode fails the same way, so it is the VVD image and not the app (FL-008). This consumed most of the first night. The on-screen remote does not respond to host mouse or keyboard input (FL-009). The Settings UI has no Accessibility page, so the system caption size cannot be changed through the UI on the VVD. The known-issues page warns the VVD may crash when recording (FL-005).
- **Onboarding experience:** starting the device is one command. Discovering that only the MSE path plays media was not.
- **Missing capability:** URL-mode playback, a way to inject remote keys from the host, screenshot and recording, an Accessibility settings page for caption preferences, a documented way to raise one app's log level.
- **Workaround:** HLS through the Vega-patched Shaka player (MSE); `inputd-cli` over `run-cmd`; app-side scale keys to simulate size changes; per-frame logging removed so pipeline errors stop being suppressed.
- **Would we build with it again:** yes, it is the only device we have. We would plan the media path around MSE from the start.
- **Most important feature request:** make URL-mode playback work on the VVD, or state clearly in the docs that it does not, and populate `MediaError.message` with the MPB status and its meaning.

## 4. React Native for Vega (`helloWorld` template, RN 0.83)

- **What we used it for:** the whole app shell: screens, focus, settings, remote handling (`useTVEventHandler`), app state (`useKeplerAppStateManager`), and hosting the media and caption views.
- **What worked well:** the generated 0.83 template ran unchanged on the VVD (Gate 0), and everything built on it since has worked. React 19.2 and RN 0.83 gave no trouble.
- **What was confusing or difficult:** the release notes say 0.83 is early access and 0.72 is supported, while the official `vega-video-sample` and the first-listed template are already on 0.83 (FL-003, FL-007). The VVD reports a logical window narrower than 1920, so all sizes had to be authored for a 1920 canvas and scaled at load (`theme.ts`). Re-rendering `KeplerVideoSurfaceView` every frame trips the 300 lines/s app log limit and hides the media pipeline's errors (FL-008).
- **Onboarding experience:** good; the template is a working starting point.
- **Missing capability:** a single stated recommended React Native version for new projects.
- **Workaround:** used what the template generated and recorded the version; kept per-frame state out of the player screen.
- **Would we build with it again:** yes.
- **Most important feature request:** state the recommended RN version for new projects in one place, and note the log rate limit and its consequence for media debugging in the media docs.

## 5. W3C media APIs (`@amazon-devices/react-native-w3cmedia` 2.3.2)

- **What we used it for:** `VideoPlayer` (HTMLMediaElement-style API), media events, `addTextTrack`, `KeplerVideoSurfaceView`, `KeplerCaptionsView`, and the MSE path under Shaka.
- **What worked well:** once on the MSE path, `initialize`, surface and caption handle attachment, `play`, `pause`, seeking, and the documented events (`loadedmetadata`, `play`, `pause`, `seeking`, `seeked`, `timeupdate`, `ended`, `error`) all worked. Seeks recompute the active cue set within about 300 ms in our runs.
- **What was confusing or difficult:** the package README lists `addTextTrack` as unsupported while the "Implement Closed Captions" guide and the `HTMLMediaElement` page document it with samples (FL-002); the guide was right. No document covers local or bundled media; every sample streams over HTTPS (FL-004). URL mode fails on the VVD (FL-008) and `MediaError.message` is empty, so the only diagnostic was the suppressed native log. `loadedmetadata` fires twice on the Shaka/MSE path and mounted our surface twice until guarded (FL-010). `timeupdate` cadence is undocumented, and it caps what can be claimed about caption sync (FL-011).
- **Onboarding experience:** the closed-captions guide and the official sample were enough to get cues on screen. Media playback itself was the hard part.
- **Missing capability:** a documented asset URI scheme for bundled media; a working URL mode on the VVD; a populated `MediaError.message`; documented `timeupdate` cadence and where `cuechange` is dispatched from.
- **Workaround:** HLS through Shaka; a `metadataSeen` flag; packaged files read via `fetch("file:///pkg/assets/raw/...")` (verified) for non-media assets.
- **Would we build with it again:** yes, with the MSE path assumed from the start.
- **Most important feature request:** populate `MediaError.message` with the underlying MPB status and document URL-mode support per device.

## 6. TextTrack / VTTCue app-parsed path

- **What we used it for:** all three caption levels. The app parses the WebVTT itself (`packages/core`), creates `VTTCue` objects with `line`, `snapToLines`, `position`, `positionAlign`, `align`, and `size`, adds them to a `subtitles` track, and switches the track between `showing` and `hidden`.
- **What worked well:** position settings are honoured by the native renderer (Gate 1 pass). Mode switches that remove and re-add every cue on the same track show no visible flash. `cuechange` fires reliably, including while the track is `hidden`, which is what makes a custom overlay on native timing possible (FL-011, Gate 2 pass). `activeCues` is correct at every boundary we logged: 0 lost cues across three modes with pause/resume and three seeks each.
- **What was confusing or difficult:** the README versus guide conflict on `addTextTrack` (FL-002). The media time read inside a `cuechange` handler is consistently 100 to 260 ms past the cue boundary, in line with a coarse `timeupdate` cadence; the true render latency is probably smaller but cannot be shown with this method (FL-011).
- **Onboarding experience:** clear once the guide was trusted over the README.
- **Missing capability:** no VTTRegion, no CSS styling, automatic window size only, no measured cue bounds (so lane safety has to be estimated), no per-cue colour on the native path.
- **Workaround:** a conservative box estimator calibrated on the VVD; colour only in the overlay level.
- **Would we build with it again:** yes; it is the backbone of the native-first design.
- **Most important feature request:** expose rendered cue bounds (or the caption window rectangle) so apps can check for overlap without estimating, and document `cuechange` timing.

## 7. `KeplerCaptionsView`

- **What we used it for:** rendering Standard and Speaker-aware captions with the viewer's system caption style, positioned by the app's cue settings. Wired per the official sample: `onCaptionViewCreated` -> `setCaptionViewHandle`, `onCaptionViewDestroyed` -> `clearCaptionViewHandle`, `show={boolean}`, absolutely positioned above the video surface.
- **What worked well:** lower-left, lower-right, and bottom-center placement all render (`docs/captures/run22c.png`, `run25-spk-a.png`, `run22a.png`). A speaker label as the first line of the cue text renders as a label line with no extra work. `show={false}` in Detailed mode keeps native and overlay captions from appearing together.
- **What was confusing or difficult:** only one `KeplerCaptionsView` per process, which had to be designed around (one surface, never remounted on the second `loadedmetadata`). No measured bounds, no VTTRegion, no CSS.
- **Onboarding experience:** the sample's `PlayerScreen.tsx` was sufficient.
- **Missing capability:** cue bounds, per-cue colour, a documented list of which `VTTCue` fields are honoured.
- **Workaround:** estimator for bounds; overlay for colour.
- **Would we build with it again:** yes.
- **Most important feature request:** document exactly which `VTTCue` settings are honoured, and expose rendered bounds.

## 8. `@amazon-devices/kepler-a11y-settings-interface-turbo` (1.0.0)

- **What we used it for:** reading the viewer's caption preferences (`getCaptionPreferences()`) and subscribing to changes, so the Detailed overlay can apply them and the lane estimator can react to text size.
- **What worked well:** on the VVD `getCaptionPreferences()` returns real values (textSize normal, font default, colours default), and the app runs with the module imported behind a try/catch.
- **What was confusing or difficult:** `vega project install` refuses the package as "not in OS version 1.2 profile" even though the 0.24 docs present it as new and the SDK ships the native component (FL-006). The VVD Settings UI has no Accessibility page, so a real preference change has not been driven through the UI. Writes are reserved for system apps, so the app cannot change the size itself for testing (expected; logged, not shown to viewers). There is no system reduce-motion setting to read.
- **Onboarding experience:** the API itself is simple; getting the package installed was not.
- **Missing capability:** an OS profile that includes the module; a way to exercise preference changes on the VVD; a reduce-motion preference.
- **Workaround:** manual `package.json` entry; app-side scale keys for size testing; in-app reduced-motion default.
- **Would we build with it again:** yes; reading the system preferences is a core claim of the product.
- **Most important feature request:** include the module in the 1.2 profile (or say which OS version first exposes it), and give the VVD an Accessibility settings page so caption preference changes can be tested end to end.

## 9. `TVEventHandler` / remote input (`useTVEventHandler`)

- **What we used it for:** all remote handling, mapped in one module (`remote/useRemote.ts`).
- **What worked well:** `up`, `down`, `left`, `right`, `select`, `back`, `menu`, `playpause`, `info`, and `page_up`/`page_down` arrive as documented; key-down is filtered with `eventKeyAction === 0`. The OK button on the virtual remote arrives as `enter`, which the map treats as `select`.
- **What was confusing or difficult:** `KEY_REWIND` sent from `inputd-cli` did not reach the app as `skip_backward` or `rewind` (FL-009, Gate 1 open item). The mapping from `inputd` key names to `TVEventHandler` event types is not documented anywhere we found.
- **Onboarding experience:** straightforward; the manifest needs `com.amazon.inputd.service` and the hook does the rest.
- **Missing capability:** a documented table of event type names per physical remote button.
- **Workaround:** log every unmapped event and map by observation.
- **Would we build with it again:** yes.
- **Most important feature request:** publish the event-type table, including which `inputd` names map to which event types.

## 10. `inputd-cli` on the device

- **What we used it for:** pressing remote buttons from a script (`vega device run-cmd -c 'inputd-cli button_press KEY_DOWN'` and so on) to drive the repeatable caption sync run and the mode switches in `docs/gate2-run-2026-09-01.log`.
- **What worked well:** it works perfectly and also supports `series`, `send_text`, `touch`, and `mouse_click`. It unblocked every automated test on the first night (FL-009).
- **What was confusing or difficult:** it is undocumented. We found it by exploring the device. `KEY_REWIND` did not map to an app event.
- **Onboarding experience:** none; it had to be discovered.
- **Missing capability:** documentation, and a host-side CLI wrapper.
- **Workaround:** none needed once found.
- **Would we build with it again:** yes, every day.
- **Most important feature request:** expose it as `vega device press-key` with documented key names.

## 11. Vega-patched Shaka / MSE sample path (`AmazonAppDev/vega-video-sample`)

- **What we used it for:** the only working video playback path on the VVD. `ShakaPlayer.ts`, the compiled Shaka 4.8.5 build, and the DOM polyfills were copied from the official sample into `apps/vega-player/src/w3cmedia/` and driven with an HLS rendition built by `tools/hls/make-hls.sh`.
- **What worked well:** the sample plays; forcing it into URL mode reproduced the VVD failure, which is how FL-008 was root-caused. Our app plays 1080p H.264/AAC through it with ABR disabled.
- **What was confusing or difficult:** the sample streams over HTTPS and bundles no local MP4s, so the local-media question was unanswered (FL-004). `loadedmetadata` fires twice on this path (FL-010). The Shaka build and player wrapper carry an Amazon proprietary header, which complicates open-sourcing the app directory; the core package is kept free of it.
- **Onboarding experience:** the sample's `VideoHandler` sequence (create, focus, initialize, listeners, load, mount on `loadedmetadata`, attach handles, play) was followed line by line and works.
- **Missing capability:** a documented, redistributable way to get MSE playback without copying a proprietary player build; a working URL mode so simple demos do not need HLS at all.
- **Workaround:** copied the sample's player and committed it so a clean checkout builds; documented the licence caveat.
- **Would we build with it again:** yes on the VVD, because nothing else plays. We would prefer not to need it.
- **Most important feature request:** ship the Vega-patched Shaka build as an installable package with a clear licence, and document the double `loadedmetadata`.

---

## Not used

Amazon Transcribe and S3 were not used. The AWS integration is optional in the plan and has not started (`docs/architecture.md`, README "AWS integration").
