#!/usr/bin/env bash
# Build an HLS (fMP4, single file) rendition next to a scene's MP4 master.
#
#   tools/hls/make-hls.sh assets/the-envelope/the-envelope-1080p.mp4
#   → assets/the-envelope/hls/<name>.m3u8 (+ .m4s)
#
# Why: the Vega Virtual Device cannot open URL-mode sources (docs/friction-log.md FL-008), so the
# app plays through the Vega-patched Shaka player and needs HLS. Serve the assets/ directory with:
#   cd assets && npx http-server -p 8081 -a 0.0.0.0 --cors
set -euo pipefail
src="${1:?usage: make-hls.sh <master.mp4>}"
dir="$(dirname "$src")/hls"
name="$(basename "${src%.*}")"
mkdir -p "$dir"
ffmpeg -y -loglevel error -i "$src" -c:v copy -c:a copy \
  -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type fmp4 -hls_flags single_file \
  -hls_fmp4_init_filename "${name}-init.mp4" "$dir/${name}.m3u8"
echo "wrote $dir/${name}.m3u8"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -of compact "$src"
