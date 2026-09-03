#!/usr/bin/env bash
# Poster stills and blurred backdrops for the app's landing and player screens.
# Usage: tools/ui/make-posters.sh   (run from the repository root; needs ffmpeg and the authoring venv's Pillow)
set -euo pipefail
OUT=apps/vega-player/src/assets/posters; mkdir -p "$OUT"; TMP=$(mktemp -d)
while IFS=: read -r id file t; do
  ffmpeg -y -loglevel error -ss "$t" -i "$file" -frames:v 1 -vf "scale=1280:-2" -q:v 3 "$TMP/$id.jpg"
done <<'LIST'
tos-bridge:assets/tos-bridge/tos-bridge-720p.mp4:14.0
tos-lab:assets/tos-lab/tos-lab-720p.mp4:8.0
LIST
python3 - "$TMP" "$OUT" <<'PY'
import sys, os, math
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
tmp, out = sys.argv[1], sys.argv[2]
def vignette(im, strength=0.35):
    w, h = im.size; m = Image.new("L", (w, h), 0); d = ImageDraw.Draw(m)
    d.ellipse((-w*0.15, -h*0.25, w*1.15, h*1.25), fill=255); m = m.filter(ImageFilter.GaussianBlur(w*0.12))
    dark = ImageEnhance.Brightness(im).enhance(1-strength); return Image.composite(im, dark, m)
def grade(im):
    im = ImageEnhance.Contrast(im).enhance(1.08); im = ImageEnhance.Color(im).enhance(1.08); return vignette(im)
def save(im, name):
    im.save(os.path.join(out, name), quality=82, optimize=True)
    bd = ImageEnhance.Brightness(im.resize((640, 360)).filter(ImageFilter.GaussianBlur(18))).enhance(0.55)
    bd.save(os.path.join(out, "backdrop-" + name), quality=80, optimize=True)
for f in sorted(os.listdir(tmp)):
    save(grade(Image.open(os.path.join(tmp, f)).convert("RGB")), f)
# Abstract art for scenes whose footage is a placeholder: a dark ground with one soft glow in a Caption with
# Intention colour, so the landing page never shows the synthetic test frame as if it were the film.
def abstract(hex_rgb, cx, cy, name):
    w, h = 1280, 720; im = Image.new("RGB", (w, h), (9, 10, 14)); glow = Image.new("RGB", (w, h), (0, 0, 0)); d = ImageDraw.Draw(glow)
    r = int(w*0.38); d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=hex_rgb); glow = glow.filter(ImageFilter.GaussianBlur(150))
    glow = ImageEnhance.Brightness(glow).enhance(0.7); im = Image.blend(im, Image.eval(glow, lambda v: v), 0.85)
    # faint diagonal grain lines for texture
    d = ImageDraw.Draw(im)
    for x in range(-h, w, 28): d.line((x, 0, x+h, h), fill=(255, 255, 255), width=1) if False else None
    save(vignette(im, 0.25), name)
abstract((229, 128, 23), 900, 260, "the-envelope.jpg")
abstract((23, 229, 229), 880, 300, "micro-scene-a.jpg")
abstract((229, 23, 229), 920, 240, "micro-scene-b.jpg")
abstract((150, 165, 200), 900, 280, "prototype.jpg")
PY
echo "posters written to $OUT"
