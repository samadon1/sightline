#!/usr/bin/env bash
# One command from a master video plus an approved WebVTT track to a proposed companion file.
#
#   tools/author/author-scene.sh assets/<scene> [--accept-dev | --auto]
#
# Requires .venv-author (docs/authoring.md) and, for face regions, the YuNet model file given by
# SIGHTLINE_YUNET (default: models/face_detection_yunet_2023mar.onnx next to the repo). Every output is
# proposed; --accept-dev applies the development-bench acceptance (words by alignment score, delivery) and
# tags it as machine-verified, which the validator then reports. Never use --accept-dev for pilot assets.
# --auto applies confidence-gated verification (propose.py --auto) plus colour assignment; the review page is
# then the exception queue.
set -euo pipefail
scene="${1:?usage: author-scene.sh assets/<scene> [--accept-dev]}"
accept="${2:-}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
py="${SIGHTLINE_PY:-$root/.venv-author/bin/python}"
yunet="${SIGHTLINE_YUNET:-$root/models/face_detection_yunet_2023mar.onnx}"
master="$(ls "$scene"/*.mp4 | grep -v placeholder | head -1 || true)"; master="${master:-$scene/placeholder.mp4}"
work="$scene/.author"; mkdir -p "$work"
export SSL_CERT_FILE="$("$py" -m certifi)"
echo "== audio"; ffmpeg -y -loglevel error -i "$master" -vn -ac 1 -ar 16000 "$work/audio-16k.wav"; ffmpeg -y -loglevel error -i "$master" -vn -ac 2 -ar 16000 "$work/audio-stereo.wav"
echo "== align";    "$py" "$root/tools/author/align.py" "$scene/captions.en.vtt" "$work/audio-16k.wav" "$work/words.json"
echo "== delivery"; "$py" "$root/tools/author/delivery.py" "$scene/captions.en.vtt" "$work/audio-16k.wav" "$work/words.json" "$scene/companion.en.json" "$work/delivery.json"
echo "== sounds";   "$py" "$root/tools/author/sounds.py" "$work/audio-16k.wav" "$scene/captions.en.vtt" "$work/sounds.json" --model panns-cnn14 || echo "sounds: skipped ($?)"
[ -f "$work/sounds.json" ] && "$py" "$root/tools/author/direction.py" "$work/audio-stereo.wav" "$work/sounds.json" >/dev/null || true
if [ -f "$yunet" ]; then echo "== faces"; "$py" "$root/tools/author/faces.py" "$master" "$work/shots.json" --model "$yunet"; else echo "faces: skipped (no YuNet model at $yunet)"; fi
sface="${SIGHTLINE_SFACE:-$root/models/face_recognition_sface_2021dec.onnx}"
if [ -f "$yunet" ] && [ -f "$sface" ]; then echo "== active speaker detection"; "$py" "$root/tools/author/asd.py" "$master" "$scene/captions.en.vtt" "$work/asd.json" --yunet "$yunet" --sface "$sface" 2>/dev/null | grep -v "^  " || true; else echo "asd: skipped (needs YuNet and SFace models)"; fi
echo "== diarize (pyannote; needs the gated models)"; "$py" "$root/tools/author/diarize.py" "$scene/captions.en.vtt" "$work/audio-16k.wav" "$work/diarization.json" 2>/dev/null | grep -v "^  " || echo "diarize: skipped (see docs/authoring.md for the one-time setup)"
echo "== propose"
args=(--words "$work/words.json" --delivery "$work/delivery.json")
[ -f "$work/sounds.json" ] && args+=(--sounds "$work/sounds.json")
[ -f "$work/shots.json" ] && args+=(--shots "$work/shots.json")
[ -f "$work/diarization.json" ] && args+=(--diarization "$work/diarization.json")
[ -f "$work/asd.json" ] && args+=(--asd "$work/asd.json")
[ "$accept" = "--accept-dev" ] && args+=(--accept-min-score 0.5 --accept-delivery)
[ "$accept" = "--auto" ] && args+=(--auto --assign-colours)
python3 "$root/tools/author/propose.py" "$scene/companion.en.json" "${args[@]}"
echo "== validate"; (cd "$root" && npm run --silent validate -- "$scene/captions.en.vtt" "$scene/companion.en.json") || true
echo "next: python3 tools/author/review_server.py $scene  (verify in the browser), then npm run bundle-assets"
