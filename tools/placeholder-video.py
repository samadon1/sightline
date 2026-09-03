#!/usr/bin/env python3
"""
Build a placeholder video for a scene from its canonical WebVTT track.

  python3 tools/placeholder-video.py assets/the-envelope [--voices]

The picture is a neutral stage with a burned-in millisecond clock, the speakers' stable
positions (left / right / doorway), and a dot that lights up where the current speaker stands.
The audio is synthesized speech (macOS `say`) for each cue, placed at the cue's start time, plus
a short glass-break noise burst for any [glass ...] cue. This is a stand-in for the phone-shot
micro-scenes and the final shoot, so the caption pipeline, timing measurements and study
delivery can be exercised before real footage exists. It never ships in the demo.

Speaker positions come from companion.en.json lanes (lower_left → left, lower_right → right,
bottom_center → centre/doorway). Output: <scene>/placeholder.mp4 and <scene>/hls/placeholder.m3u8.
"""
import json, os, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

scene = sys.argv[1].rstrip("/")
name = os.path.basename(scene)
W, H, FPS = 1920, 1080, 30
vtt = open(os.path.join(scene, "captions.en.vtt")).read()
comp = json.load(open(os.path.join(scene, "companion.en.json"))) if os.path.exists(os.path.join(scene, "companion.en.json")) else {"cues": {}, "speakers": {}}

def ts(s):
    h, m, rest = s.split(":") if s.count(":") == 2 else ("0", *s.split(":"))
    sec, ms = rest.split(".")
    return (int(h) * 3600 + int(m) * 60 + int(sec)) * 1000 + int(ms)

cues = []
for block in re.split(r"\n\s*\n", vtt.strip()):
    lines = block.strip().split("\n")
    if lines[0].startswith("WEBVTT") or lines[0].startswith("NOTE"): continue
    cid, timing, text = lines[0], lines[1], " ".join(lines[2:])
    a, b = [ts(x.strip()) for x in timing.split("-->")]
    plain = re.sub(r"<[^>]+>", "", text)
    cues.append((cid, a, b, plain))
dur_ms = max(b for _, _, b, _ in cues) + 1500

VOICES = {"maya": "Samantha", "daniel": "Daniel", "amara": "Karen"}
POS = {"lower_left": (330, 0), "lower_right": (1590, 0), "bottom_center": (960, 0)}

# ---- audio: say each cue at its start time, mix with ffmpeg adelay
tmp = tempfile.mkdtemp()
inputs, filters, idx = [], [], 0
for cid, a, b, plain in cues:
    meta = comp["cues"].get(cid, {})
    if re.match(r"^\s*\[.*\]\s*$", plain):
        # sound cue: short noise burst
        f = os.path.join(tmp, f"{cid}.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anoisesrc=d=0.6:c=white:a=0.5", "-af", "afade=t=out:st=0.2:d=0.4", f], check=True)
    else:
        spk = meta.get("speaker") or (meta.get("speakers") or ["maya"])[0]
        voice = VOICES.get(spk, "Samantha")
        spoken = re.sub(r"^\[[^\]]*\]\s*", "", plain).replace("-", " ")
        f = os.path.join(tmp, f"{cid}.aiff")
        subprocess.run(["say", "-v", voice, "-r", "185", "-o", f, spoken], check=True)
    inputs += ["-i", f]
    filters.append(f"[{idx}:a]adelay={a}|{a},volume=0.9[a{idx}]")
    idx += 1
mix = "".join(f"[a{i}]" for i in range(idx)) + f"amix=inputs={idx}:normalize=0:dropout_transition=0,apad=whole_dur={dur_ms/1000:.3f}[out]"
audio = os.path.join(tmp, "audio.wav")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filters) + ";" + mix, "-map", "[out]", "-ar", "48000", "-ac", "2", audio], check=True)

# ---- video frames
big = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 96)
mid = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 56)
small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 28)
base = Image.new("RGB", (W, H), (30, 38, 48))
d = ImageDraw.Draw(base)
d.rectangle([0, 0, 640, H], fill=(38, 48, 60)); d.rectangle([1280, 0, W, H], fill=(38, 48, 60))
d.rectangle([96, 54, 1824, 1026], outline=(80, 92, 104), width=2)
d.text((W // 2, 110), "Placeholder footage until the shoot", font=small, fill=(150, 160, 170), anchor="mm")
labels = {k: v.get("label", k.upper()) for k, v in comp.get("speakers", {}).items()}
lane_of_speaker = {}
for cid, a, b, plain in cues:
    m = comp["cues"].get(cid, {})
    sp = m.get("speaker")
    if sp and m.get("lanes"): lane_of_speaker.setdefault(sp, m["lanes"][0])
for sp, lane in lane_of_speaker.items():
    x = POS.get(lane, POS["bottom_center"])[0]
    d.text((x, 230), labels.get(sp, sp.upper()), font=mid, fill=(175, 185, 195), anchor="mm")
d.text((1680, 400), "doorway →", font=small, fill=(150, 160, 170), anchor="mm")

ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", audio,
    "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-g", "30",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", os.path.join(scene, "placeholder.mp4")], stdin=subprocess.PIPE)
n = int(dur_ms / 1000 * FPS) + 1
for i in range(n):
    ms = int(round(i * 1000 / FPS))
    fr = base.copy(); dd = ImageDraw.Draw(fr)
    if name == "prototype":
        # The clock test keeps its large burned-in clock: it is the reference for the visual sync measurement.
        dd.rectangle([640, 470, 1280, 610], fill=(0, 0, 0))
        dd.text((960, 540), f"{ms // 60000:02d}:{(ms // 1000) % 60:02d}.{ms % 1000:03d}", font=big, fill=(255, 255, 255), anchor="mm")
    else:
        # Placeholder scenes carry a small corner clock only, so the picture reads as a stand-in, not a diagnostic.
        dd.text((1780, 90), f"{ms // 60000:02d}:{(ms // 1000) % 60:02d}.{ms % 1000:03d}", font=small, fill=(110, 120, 130), anchor="mm")
    for cid, a, b, plain in cues:
        if a <= ms < b:
            m = comp["cues"].get(cid, {})
            if re.match(r"^\s*\[.*\]\s*$", plain):
                dd.rectangle([1700, 480, 1800, 580], fill=(255, 120, 120))
            else:
                sps = m.get("speakers") or ([m.get("speaker")] if m.get("speaker") else [])
                for sp in sps:
                    lane = lane_of_speaker.get(sp, "bottom_center")
                    x = POS.get(lane, POS["bottom_center"])[0]
                    dd.ellipse([x - 22, 290, x + 22, 334], fill=(255, 215, 80))
            pass  # no diagnostic cue id on a viewer-facing placeholder (UX review M13)
    ff.stdin.write(fr.tobytes())
ff.stdin.close(); ff.wait()
subprocess.run(["bash", "tools/hls/make-hls.sh", os.path.join(scene, "placeholder.mp4")], check=True)
print(f"placeholder for {name}: {dur_ms/1000:.1f}s, {len(cues)} cues")
