# tos-lab

Excerpt 03:10 to 04:10 of *Tears of Steel* (Blender Foundation, 2012), 720p release from download.blender.org/demo/movies/ToS/.

Licence: Creative Commons Attribution 3.0 (https://creativecommons.org/licenses/by/3.0/). Attribution: "(CC) Blender Foundation | mango.blender.org". Shown in the app's About screen.

- `tos-lab-720p.mp4`: re-encoded excerpt (H.264, AAC), committed.
- `hls/`: derived rendition for the virtual device; not committed. Regenerate with `tools/hls/make-hls.sh assets/tos-lab/tos-lab-720p.mp4`.
- `captions.en.vtt`: fair Standard track re-timed from the film's official English subtitles (TOS-en.srt). Speaker attributions marked for review need a check against the picture.
- `companion.en.json`: schema 0.2 metadata (word timings, delivery levels, sound events, shots; machine-verified entries carry `verifiedBy`). Cues whose speaker attribution has not been checked against the picture are `proposed`.

Speaker attributions in `captions.en.vtt` (mostly "Director") are the author's guesses from the subtitle text. pyannote diarization (September 2) hears five distinct voices in this excerpt, so several of them are probably wrong; `companion.en.json` carries the per-cue `speakerProposal` with clusters and confidences for the reviewer.
