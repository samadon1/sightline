#!/usr/bin/env bash
# Fetch the Vega Shaka glue (ShakaPlayer.ts, PlayerInterface.ts, polyfills) from Amazon's public
# vega-video-sample repository, the way that sample does at install, and apply Sightline's one change.
#
# Why: those files carry an "AMAZON PROPRIETARY/CONFIDENTIAL" header that cites a LICENSE.TXT Amazon does
# not ship; the only licence accompanying them is the MIT-0 of the repository they are distributed in. We do
# not commit them; we regenerate them from Amazon's own distribution. The compiled Shaka bundle in
# src/w3cmedia/shakaplayer/dist is Apache-2.0 (Shaka Player, Google) with Amazon's Vega patches applied and stays
# in the repository.
#
# Usage: tools/shaka/fetch-glue.sh   (from the repository root; needs curl and tar)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/apps/vega-player/src/w3cmedia"
TARBALL_URL="https://github.com/AmazonAppDev/vega-video-sample/raw/main/shaka-setup/shaka-rel-v4.8.5-r1.2.tar.gz"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -sSL -o "$TMP/rel.tgz" "$TARBALL_URL"
tar xzf "$TMP/rel.tgz" -C "$TMP"
SRC="$TMP/shaka-rel/src"
mkdir -p "$DEST/polyfills" "$DEST/shakaplayer/dist"
cp "$SRC/PlayerInterface.ts" "$DEST/PlayerInterface.ts"
cp "$SRC"/polyfills/*.ts "$DEST/polyfills/"
cp "$SRC/shakaplayer/ShakaPlayer.ts" "$DEST/shakaplayer/ShakaPlayer.ts"
# The sample adds ts-nocheck to these generated files; so do we.
for f in "$DEST/PlayerInterface.ts" "$DEST"/polyfills/*.ts "$DEST/shakaplayer/ShakaPlayer.ts"; do
  grep -q "@ts-nocheck" "$f" || { printf '// @ts-nocheck\n' | cat - "$f" > "$f.tmp" && mv "$f.tmp" "$f"; }
done
python3 "$ROOT/tools/shaka/apply-sightline-changes.py" "$DEST/shakaplayer/ShakaPlayer.ts"
echo "shaka glue fetched from vega-video-sample (MIT-0) into $DEST; Sightline changes applied"
