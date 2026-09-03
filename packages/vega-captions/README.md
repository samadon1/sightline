# @sightline-wip/vega-captions

This is the caption runtime from the Sightline reference app, packaged so that any React Native for Vega video app can embed it. It takes an approved WebVTT track (the standard text file that holds a video's captions and their timings) and one companion file of verified extra data, and renders the captions three ways:

- **Standard**: the track as written, on the TV's own caption renderer.
- **Speaker-aware**: a name and a colour for each speaker, with the words taking the colour as they are said, on the speaker's side of the screen when the line fits there. Still the TV's renderer, still the viewer's caption settings.
- **Detailed**: the Caption with Intention treatment on an overlay: the words ahead of the voice in white, size from loudness, weight from the voice, italics for voices off camera, and sound labels.

Every enhancement falls back on its own to the approved words, and nothing unverified reaches the screen. It pairs with `@sightline-wip/core` (parser, schema, resolver) and `@amazon-devices/react-native-w3cmedia` (`VideoPlayer`, `KeplerCaptionsView`).

## Add it to a Vega player

```tsx
import { VideoPlayer, VTTCue, KeplerCaptionsView } from "@amazon-devices/react-native-w3cmedia";
import { CaptionController, DetailedOverlay, MediaClock, useWordClock, useSystemCaptionPrefs } from "@sightline-wip/vega-captions";

// 1. One event-anchored clock on your player (polled currentTime is stale on Vega).
const clock = new MediaClock(); clock.attach(player);

// 2. The controller owns a native text track for Standard and Speaker-aware.
const track = player.addTextTrack("subtitles", "Captions", "en");
const controller = new CaptionController(
  { makeCue: (s, e, t) => new VTTCue(s, e, t), track, now: () => clock.now() },
  vttText, companionJsonOrNull, { mode: "speaker-aware", reducedMotion: true }, useSystemCaptionPrefs(),
);
controller.subscribe((state) => setOverlay(state));      // Detailed reads the resolved set from here

// 3. Mount the TV's caption view for Standard/Speaker-aware, or the overlay for Detailed.
<KeplerCaptionsView show={mode !== "detailed"} onCaptionViewCreated={(h) => player.setCaptionViewHandle(h)} />
{mode === "detailed" && <DetailedOverlay captions={overlay.overlay} nowMs={overlay.nowMs} sfxStart={overlay.sfxStart} system={prefs} reducedMotion />}

// 4. Detailed needs word-level ticks between cue events.
useWordClock(clockRef, controllerRef, playing && mode === "detailed");
```

After that, call `controller.setViewer(...)` when the viewer changes a setting, `controller.setSystem(prefs)` when the TV's caption preferences change, `controller.recompute("seeked")` after a seek, and `controller.dispose()` when the screen unmounts. The reference implementation is `apps/vega-player/src/screens/PlayerScreen.tsx`.

## What the host app provides

- The approved `captions.en.vtt` and its `companion.en.json` (the schema is in `schema/companion-profile-0.2.schema.json` and the authoring tools in `tools/author`). Fetch them from beside the stream or bundle them with the app.
- Fonts for Detailed: the twelve Roboto Flex static instances in `apps/vega-player/assets/fonts` (OFL). Or pass the viewer's chosen font family through the system preferences, and the overlay will use that instead.
- Optional: `setLogSink(fn)` to send the runtime's diagnostic lines (`[sync]`, `[companion]`, `[wordclock]`) into your own logger, or to silence them.

## What it never does

It never invents captions, guesses a speaker, reads emotions, or changes the approved words. A cue is only enhanced when a person has verified its companion entry and its text hash matches the track.

## Tests

`npm test` in this package runs the controller splitting and leads, the media clock, and the layout rules (17 tests).
