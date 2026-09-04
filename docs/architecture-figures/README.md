# Architecture figures (2 September 2026)

Figures used on the architecture page, in page order. Regenerate with `build-figures.py` (needs the authoring venv, the scratch intermediates from `author-scene.sh`, and the sync rows below; the script embeds the PNGs into the HTML page).

| File | Shows |
|---|---|
| fig1-end-to-end.svg | Authoring workstation (steps 1 to 7), companion + VTT files, stream origin, Fire TV paths |
| fig-alignment-spectrogram.png | WhisperX word spans over the mel spectrogram, bridge cues 1 and 2 |
| fig-delivery-measurements.png | Per-word loudness vs. speaker baseline and pyin pitch |
| fig-segmentation-raw.png | pyannote segmentation-3.0 raw output on a 10 s window: waveform, powerset log-probabilities, speaker activity |
| fig-rules-to-type.png | The size function from packages/core and cues 1 and 2 set in Roboto Flex instances from their measured numbers |
| fig-proposal-timeline.png | Voice clusters, on-camera identity, face boxes and sound events over the bridge scene |
| fig-protected-regions.png | Face box as protected region; mid lane rejected, bottom lane allowed |
| fig-active-speaker.png | YuNet boxes and landmarks at three cue midpoints with lip-activity scores and proposed identity |
| fig2-runtime.svg | Vega app runtime: probe, Shaka, VideoPlayer, MediaClock, controller, resolver, native track and overlay |
| fig-native-cue-splitting.png | One approved cue split into per-word native cues with the 100 ms lead and the observed events |
| fig-sync-measured.png | Method A and B errors per boundary crossing, from sync-rows-*.json (exported by `tools/sync-report.ts` with `SYNC_ROWS=<path>`) |
| fig3-fallback-ladder.svg | Per-cue checks and their fallbacks |
| fig4-palette.svg | The six Caption with Intention main colours as shipped |
| fig5-aws.svg | The AWS integrations: publish to S3 behind CloudFront, the app fetching from the distribution with its packaged fallback, and Amazon Transcribe as a second measurement feeding proposals to review (`build-aws-figure.py`, standalone) |

Film frames: Tears of Steel, Blender Foundation, CC BY 3.0.
