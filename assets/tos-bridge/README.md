# tos-bridge

Excerpt 00:18 to 01:06 of *Tears of Steel* (Blender Foundation, 2012), 720p release from download.blender.org/demo/movies/ToS/.

Licence: Creative Commons Attribution 3.0 (https://creativecommons.org/licenses/by/3.0/). Attribution: "(CC) Blender Foundation | mango.blender.org". Shown in the app's About screen.

- `tos-bridge-720p.mp4`: re-encoded excerpt (H.264, AAC), committed.
- `hls/`: derived rendition for the virtual device; not committed. Regenerate with `tools/hls/make-hls.sh assets/tos-bridge/tos-bridge-720p.mp4`.
- `captions.en.vtt`: fair Standard track re-timed from the film's official English subtitles (TOS-en.srt). Speaker attributions marked for review need a check against the picture.
- `companion.en.json`: schema 0.2 metadata (word timings, delivery levels, sound events, shots; machine-verified entries carry `verifiedBy`). Cues whose speaker attribution has not been checked against the picture are `proposed`.

Sides (September 2, evening): Thom stands on the left and Celia on the right in every two-shot, so Thom takes `lower_left` and Celia `lower_right`. Cues 1, 8 and 9 play over the city shot, the machine and the title card with nobody on screen: `offScreen`, bottom lane.
