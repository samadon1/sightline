# Authoring a scene (schema 0.2)

Everything a scene needs sits in `assets/<scene>/`: the master video, the approved WebVTT track, and the companion file. The tools produce **proposed** metadata from measurements; a person verifies it in the review page. Only `verified` data reaches the viewer.

## One-time setup

```
uv venv --python 3.12 .venv-author
uv pip install --python .venv-author/bin/python whisperx librosa soundfile audiotimm
export SSL_CERT_FILE=$(.venv-author/bin/python -m certifi)   # model downloads on macOS python builds
```
WhisperX pulls torch and the wav2vec2 alignment model (about 360 MB) on first use; PANNs weights are about 310 MB. Keep 3 GB free.

## Steps

1. **Master and HLS.** Put `<scene>-720p.mp4` (or 1080p) in the folder and run `tools/hls/make-hls.sh assets/<scene>/<file>.mp4`. The virtual device plays HLS only (FL-008).
2. **Approved captions.** Write `captions.en.vtt` with stable cue ids and `<v Name>` voice spans. This file is canonical: nothing downstream changes its words.
3. **Companion skeleton.** (Colours can be left blank: `propose.py --assign-colours` ranks speakers by cue count and applies Caption with Intention's wheel, mains first and opposite pairs apart; the review page states the rule so a person can override it for the story.) Create `companion.en.json` with `speakers` (label, colour token, `offScreen` if never on camera), `shots` (protected regions), and one entry per cue with `textHash` (from `npm run validate -- <vtt> --hashes`), `status`, `speaker`, `lanes`.
4. **Audio.** `ffmpeg -i <master> -vn -ac 1 -ar 16000 scene-16k.wav`
5. **Align.** `.venv-author/bin/python tools/author/align.py assets/<scene>/captions.en.vtt scene-16k.wav words.json` — forced alignment of the approved text; output has an alignment score per word.
6. **Measure delivery.** `.venv-author/bin/python tools/author/delivery.py assets/<scene>/captions.en.vtt scene-16k.wav words.json assets/<scene>/companion.en.json delivery.json` — loudness levels (Caption with Intention size steps), pitch band (their 160–200 Hz baseline), pace, stretch candidates.
6b. **Diarize.** `.venv-author/bin/python tools/author/diarize.py assets/<scene>/captions.en.vtt scene-16k.wav diarization.json` — pyannote speaker-diarization-3.1, offline after a one-time setup: `hf auth login` with a Hugging Face token, accept the conditions on `pyannote/speaker-diarization-3.1` and `pyannote/segmentation-3.0`, keep `pyannote.audio` on the 3.x line. Per cue it gives the dominant voice cluster, a confidence, the majority name for that cluster from the track's `<v>` spans, and whether it agrees with the track. On the Tears of Steel bridge it agreed with the film's own tags on 7 of 11 cues (film audio with music); on the lab excerpt it found five voices where the hand-written track said one. It is a proposal a person confirms, and the review page shows the disagreements.
6c. **Active speaker detection.** `.venv-author/bin/python tools/author/asd.py <master.mp4> assets/<scene>/captions.en.vtt asd.json --yunet <yunet.onnx> --sface <sface.onnx>` — YuNet faces, SFace identities across shots, lip activity per face per cue. On the bridge it names the on-camera speaker for 8 of 11 cues, 7 of them matching the track, and flags the other three as off camera (one is a profile the detector misses, two are reaction shots). Models: `face_detection_yunet_2023mar.onnx` and `face_recognition_sface_2021dec.onnx` from opencv_zoo (fetch the SFace file through media.githubusercontent.com; the raw GitHub URL returns a Git LFS pointer).
7. **Detect sounds.** `.venv-author/bin/python tools/author/sounds.py scene-16k.wav assets/<scene>/captions.en.vtt sounds.json` — AudioSet tags per window, speech dropped, proposed events with the model's confidence.
8. **Merge.** `python3 tools/author/propose.py assets/<scene>/companion.en.json --words words.json --delivery delivery.json --sounds sounds.json --diarization diarization.json` writes schema 0.2, everything proposed. Add `--auto` for confidence-gated automatic verification: words above alignment score 0.7, measured delivery levels, non-speech sound events above 0.8, and diarized speakers that agree with the track and cover 80% of the cue verify themselves, each recording its rule in `verifiedBy` ("auto:..."); everything below the thresholds stays proposed and the review page becomes the exception queue. `--accept-min-score 0.5` is the older development-bench acceptance and is not for pilot or demo assets.
9. **Review.** `python3 tools/author/review_server.py assets/<scene>` and open http://localhost:8090/. Play, click words to seek, press V to verify the word under the playhead, double-click a word to edit its timing and levels, set cue and delivery status, save. The previous file is kept as `.bak`.
10. **Validate and bundle.** `npm run validate -- assets/<scene>/captions.en.vtt assets/<scene>/companion.en.json`, then `npm run bundle-assets`, then build the app.

## What the runtime does with it

- Standard: canonical text only.
- Speaker-aware (platform renderer): label, lane, Caption with Intention colour attribution through WebVTT colour classes, and word-by-word colouring by cue splitting at verified word boundaries. Viewer size and font apply.
- Detailed (overlay): all of the above plus size from loudness (3–12% of screen height), weight from pitch band, capitals and stretched spellings, italics for off-camera voices, sound events with direction, ♫ for music.

Every field falls back on its own: an unverified or invalid word renders plainly, an unverified sound event is not shown, an unknown speaker keeps its lane but loses its colour.

## Automatic verification rules (September 2, evening)

`propose.py --auto` writes `verifiedBy` on everything it verifies, so the review page and the validator can tell a rule from a person:

| Rule | Condition | `verifiedBy` |
|---|---|---|
| Aligned word | WhisperX score at or above 0.7 | `auto:align>=0.7` |
| Interpolated run | up to three low-score words between verified anchors (or the cue edges) within 1.5 s; the aligner's timing is kept when monotonic and inside the gap, else the gap is shared by character count | `auto:interpolated` |
| Low-score cue | a cue with no anchor at all whose aligner timings are monotonic, inside the cue, and average at least 0.35 | `auto:aligned-low-score` |
| Delivery | measurements, always | `auto:measured` |
| Speaker | the diarized voice agrees with the track's `<v>` span at confidence 0.6 or more | `auto:diarization>=0.6+track` |
| Sound event | PANNs score 0.8 or more | `auto:panns>=0.8` |

Why the word rules exist: the runtime never colours an unverified word, so a low-score final word left a line half coloured at its end, which viewers read as a fault. A slightly early onset is the lesser harm, and the provenance keeps it visible. Shouts over noise (very low mean scores) stay cue-level, where the whole line takes the character colour at once.

Sides and off-camera lines are still a person's call: the active-speaker detector misses profile faces (bridge: it credited Thom's line to the only face it found, Celia's), so its confidence is capped at 0.3 when a single face is in frame. A cue can be marked `offScreen` on its own (a line over a cutaway); the resolver renders it italic in Detailed and the skeleton puts it on the bottom lane.

Evidence for the interpolation rule (September 3): over the bridge and lab excerpts, words verified by `auto:interpolated` sit on speech energy as well as words the aligner scored at 0.7 or more (bridge: mean level -21.9 dB against -22.1 dB, 28% of each in near-silence by a 400 ms RMS window; lab: -20.0 against -21.7 dB, 17% against 23%). Re-running `propose.py` never touches an entry whose `verifiedBy` is `human`.

## Scope and limits of the measurements (September 3)

- Loudness is RMS over the word or cue span with everything else in the mix; a line under music measures louder than the voice alone (bridge c010 and c011 sit under `sfx03`). Sound-event levels are relative to the clip's speech level.
- Pitch bands are absolute (Caption with Intention 2.3.8: 160–200 Hz regular), so weight partly encodes the speaker's voice register, by design of the source system. The per-speaker median is recorded in `reference` for a future relative option.
- Width is the spectral centroid relative to the scene median: with two voices, one tends wide and the other narrow.
- English only: the aligner runs with `language_code="en"` and the syllable and vowel rules are English.
- `caps` and `stretch` have no automatic producer; they are set by a person in the review page.
- Long films: the active-speaker tool keeps face embeddings and mouth patches in memory for the whole run, and the native path creates one cue per word boundary (about ten thousand for a feature), unmeasured on the platform. Both are known limits, not tested paths.
- Overlapping speech: the diarization confidence is the dominant cluster's share of the cue; a 65/35 overlap can propose the louder voice. Proposals only; a person decides.
- Pinned environment: `tools/author/requirements.lock` (from the authoring venv on September 3). pyannote checkpoints are loaded with `weights_only=False` because the official files predate PyTorch's safe default; only run it on models you trust.
