"""Demo video v2: plain words, artwork behind the cards, crossfades, 30 fps. Also writes the voice-over
script and an SRT for the video from the same timeline, so narration and picture cannot drift apart.

  python3 build_video2.py [--footage vid|vid2] [--out demo.mp4]     footage dir under the scratchpad (vid2 = 6 fps bursts)
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import os, shutil, sys, math, re

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + "/"
S = os.environ.get("DEMO_SCRATCH", os.path.expanduser("~/sightline-scratch")).rstrip("/") + "/"   # captures, figure PNGs and outputs live here
FOOT = S + (sys.argv[sys.argv.index("--footage") + 1] if "--footage" in sys.argv else "vid") + "/"
FIG = REPO + "docs/architecture-figures/"; FPNG = S + "figpng/"
FONTS = REPO + "apps/vega-player/assets/fonts/"
POST = REPO + "apps/vega-player/src/assets/posters/"
FRM = S + "frames2/"; DOCS = REPO + "docs/"
TEXT_ONLY = "--text-only" in sys.argv
import json
VOICE = json.load(open(sys.argv[sys.argv.index("--voice") + 1])) if "--voice" in sys.argv else None
W, H, FPS = 1920, 1080, 30
BG, INK, MUTED = (5, 6, 8), (255, 255, 255), (208, 212, 218)
YELLOW, CYAN, ORANGE = (229, 229, 23), (23, 229, 229), (237, 113, 0)
F = lambda n, s: ImageFont.truetype(FONTS + n, s)
BOLD, REG = "Roboto Flex Bold.ttf", "Roboto Flex.ttf"
if not TEXT_ONLY: shutil.rmtree(FRM, ignore_errors=True); os.makedirs(FRM, exist_ok=True)

def wrap(d, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

_bd = {}
def backdrop(poster):
    if poster not in _bd:
        im = Image.open(POST + poster).convert("RGB").resize((W, H)).filter(ImageFilter.GaussianBlur(30))
        im = ImageEnhance.Brightness(im).enhance(0.40)
        scrim = Image.new("L", (W, H), 0); sd = ImageDraw.Draw(scrim)
        for x in range(0, W, 4): sd.rectangle((x, 0, x + 4, H), fill=int(210 * max(0, 1 - x / 1350)))
        _bd[poster] = Image.composite(Image.new("RGB", (W, H), BG), im, scrim)
    return _bd[poster].copy()

def card(kicker, title, body=None, accent=YELLOW, poster="tos-bridge.jpg", note=None):
    if TEXT_ONLY: return None
    im = backdrop(poster); d = ImageDraw.Draw(im)
    y = 320
    if kicker: d.text((160, y), kicker.upper(), font=F(BOLD, 30), fill=accent); y += 62
    for l in wrap(d, title, F(BOLD, 92), 1180): d.text((160, y), l, font=F(BOLD, 92), fill=INK); y += 108
    if body:
        y += 22
        for l in wrap(d, body, F(REG, 42), 1060): d.text((160, y), l, font=F(REG, 42), fill=MUTED); y += 58
    if note:
        f = F(REG, 27); ls = wrap(d, note, f, W - 320); ny = H - 84 - (len(ls) - 1) * 36
        for l in ls: d.text((160, ny), l, font=f, fill=(140, 144, 150)); ny += 36
    return im

SCREEN = {}   # window-width -> x of the remote panel's left edge (captures can come from different window sizes)
def screen_edge(im):
    if im.width not in SCREEN:
        px = im.load(); edge = im.width
        for x in range(im.width // 2, im.width):
            if min(sum(px[x, y]) / 3 for y in (60, 80, 100, 120)) > 150: edge = x; break
        SCREEN[im.width] = edge - 8
    return SCREEN[im.width]

def shot(path, label, sub):
    if TEXT_ONLY: return None
    im = Image.open(path).convert("RGB"); im = im.crop((0, 40, screen_edge(im), im.height))
    band = 118; avail = H - band
    sc = min(W / im.width, avail / im.height)
    im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), BG); canvas.paste(im, ((W - im.width) // 2, (avail - im.height) // 2))
    d = ImageDraw.Draw(canvas); d.rectangle((0, H - band, W, H), fill=BG)
    d.text((160, H - 96), label, font=F(BOLD, 40), fill=INK)
    d.text((160 + d.textlength(label, font=F(BOLD, 40)) + 28, H - 88), sub, font=F(REG, 32), fill=MUTED)
    return canvas

def figure(path, caption, crop_square=False):
    if TEXT_ONLY: return None
    im = Image.open(path); im = im.convert("RGB")
    if crop_square:
        bg = im.getpixel((5, 5)); px = im.load(); top, bot = 0, im.height - 1
        while top < im.height and all(px[x, top] == bg for x in range(0, im.width, 40)): top += 1
        while bot > top and all(px[x, bot] == bg for x in range(0, im.width, 40)): bot -= 1
        im = im.crop((0, max(0, top - 8), im.width, min(im.height, bot + 8)))
    pad = 80; band = 130; avail = H - band - pad
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    sc = min((W - 2 * pad) / im.width, avail / im.height)
    im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    canvas.paste(im, ((W - im.width) // 2, pad + (avail - im.height) // 2))
    d = ImageDraw.Draw(canvas); d.rectangle((0, H - band, W, H), fill=BG)
    ls = wrap(d, caption, F(REG, 34), W - 320); y = H - band + (band - len(ls) * 44) // 2
    for l in ls: d.text((160, y), l, font=F(REG, 34), fill=INK); y += 44
    return canvas

# ---- timeline: segments of (frames list, seconds) with the narration attached
timeline = []   # (name, images, seconds, narration)
def seg(name, images, seconds, narration):
    if VOICE and name in VOICE["beats"]:
        b = VOICE["beats"][name]; seconds = b.get("seconds", seconds); narration = b.get("text", narration)
    timeline.append((name, images, seconds, narration))

BURST_SECONDS = 18.0   # vvd-burst.py runs are 18 s long; frames keep their real pace and are trimmed to the segment
def footage(prefix, label, sub, seconds, skip=0.0, burst=None):
    fs = sorted(f for f in os.listdir(FOOT) if f.startswith(prefix + "-"))
    if FOOT.rstrip("/").endswith("vid2"):
        per = (burst or BURST_SECONDS) / len(fs); fs = fs[round(skip / per):][:max(1, round(seconds / per))]
    return [shot(FOOT + f, label, sub) for f in fs], seconds

CREDIT = 'Footage: "Tears of Steel" (CC) Blender Foundation 2012, mango.blender.org. Licence CC BY 3.0, creativecommons.org/licenses/by/3.0. Excerpted and shown with captions added. Captured on the Vega Virtual Device.'

WHO = "Source: World Health Organization, deafness and hearing loss fact sheet, 2024."
seg("title", [card(None, "Sightline", "Captions for Fire TV that show who is speaking, how loud, and when.", CYAN)], 3.2,
    "This is Sightline. Captions for Fire TV that show who is speaking, how loud, and when. Here is why that matters.")
seg("open", [card(None, "More than 430 million people live with hearing loss.", "For many of them, the captions are the film.", YELLOW, "tos-bridge.jpg", WHO)], 5.5,
    "More than 430 million people live with hearing loss that affects their daily life. For many of them, the captions are the film.")
seg("same", [card(None, "Captions have looked the same since the 1970s.", "Just words at the bottom of the screen.")], 4.5,
    "Cameras, effects and sound have all moved on. Captions have looked the same since the 1970s. Just words at the bottom of the screen.")
seg("gaps", [card("Three things they leave out", "Who said it, how loud, and when.", "Which person said the line. Whether it was a whisper or a shout. The moment each word is said.", ORANGE)], 6.5,
    "They leave out three things. Which person said the line. Whether it was a whisper or a shout. And the moment each word is said.")
seg("mute", [card("Try it", "Turn your sound off.", "For the next fourteen seconds, this film is only what you can read.")], 4.2,
    "Try it. Turn your sound off. For the next fourteen seconds, this film is only what you can read.")
imgs, s = footage("std", "Standard", "the captions as written, drawn by the TV", 14.0)
seg("standard", imgs, s, "")
seg("ask", [card(None, "Who was angry?", "Who spoke last? Was anyone shouting? The words were all there, but the fight was hard to follow.")], 5.5,
    "Who was angry? Who spoke last? Was anyone shouting? The words were all there, but the fight was hard to follow.")
seg("reveal", [card("Sightline", "This puts the missing parts back.", "Two caption modes for Fire TV, drawn in the TV's own caption settings.", CYAN)], 5.0,
    "Sightline puts the missing parts back. Two caption modes for Fire TV, drawn in the TV's own caption settings.")
seg("spk-card", [card("Speaker-aware", "Each speaker gets a name and a colour.", "Words turn to that colour as they are said, on the speaker's side of the screen. The TV draws it, in your own caption size and font.", CYAN)], 4.8,
    "Speaker-aware gives each speaker a name and a colour. Each word turns to that colour as it is said, on the speaker's side of the screen. The TV still draws it, in your own caption size and font.")
imgs, s = footage("spk", "Speaker-aware", "drawn by the TV, in your caption settings", 16.0)
seg("speaker", imgs, s, "Thom is on the left in cyan. Celia is on the right in yellow. When a line plays over a shot with nobody in it, the caption sits at the bottom. Nothing here is drawn by the app. It is Fire TV's own caption renderer.")
seg("det-card", [card("Detailed", "The type follows the voice.", "Louder words are bigger. Deeper voices are heavier. Lines from off camera are in italics. Sounds get a label.", ORANGE)], 4.8,
    "Detailed goes further. Louder words are bigger. Deeper voices are heavier. A line spoken from off camera is in italics, and sounds get a label.")
imgs, s = footage("det", "Detailed", "the Caption with Intention design system", 12.0)
seg("detailed", imgs, s, "The words ahead of the voice stay white, and turn to the speaker's colour as they are said. This follows the Caption with Intention design system, built for Deaf and hard of hearing viewers, and it is on by choice, never by default.")
seg("motion-card", [card("Motion, if you want it", "Each word can lift as it is said.", "Off by default. Turn it on in the sheet and the word being spoken rises for a moment.", ORANGE)], 4.0,
    "Motion is there if you want it, and off by default. Turn it on in the sheet and the word being spoken lifts for a moment.")
imgs, s = footage("detm", "Detailed, with motion", "each word lifts as it is said", 10.0, skip=3.0)
seg("detailed-motion", imgs, s, "Here it is on. The same words, the same colours, and a small lift on each word as the voice reaches it.")
seg("set-card", [card("Your choice", "Pick how much you want to see.", "One sheet on the TV. Your choice is saved. Standard captions are always one press away.", CYAN)], 4.2,
    "All of this is your choice. One sheet on the TV. Your choice is saved, and standard captions are always one press away.")
imgs, s = footage("set", "Captions", "one sheet, saved on the TV", 8.0, skip=0.8, burst=11.0)
seg("settings", imgs, s, "Open the Captions sheet and pick a mode. The preview at the top shows what you will get, and the TV keeps your choice until you change it.")
seg("how", [card("How it works", "No guessing.", "We measure the film, write down what we found, and a person checks it. The TV only shows what was checked.", ORANGE, "tos-lab.jpg")], 5.0,
    "None of this is guessed. We measure the film, write down what we found, and a person checks it. The TV only shows what was checked.")
seg("f-e2e", [figure(FPNG + "fig1-end-to-end.svg.png", "Five measurements per scene. One step merges them into proposals. A person confirms. The caption file itself is never edited; a hash locks it.", True)], 8.5,
    "Five measurements run on every scene. One step merges them into proposals, and a person confirms them. The caption file itself is never edited. A hash locks it.")
seg("f-spec", [figure(FIG + "fig-alignment-spectrogram.png", "Word timing. We line the approved words up with the sound. Orange spans pass the confidence bar. Grey ones wait for a person.")], 7.0,
    "First, word timing. We line the approved words up with the sound. The orange spans pass the confidence bar. The grey ones wait for a person.")
seg("f-deliv", [figure(FIG + "fig-delivery-measurements.png", "Loudness and pitch, per word, against the speaker's own normal. These numbers set the size and the weight of the type. We never label an emotion.")], 7.5,
    "Then loudness and pitch, word by word, against the speaker's own normal. These numbers set the size and the weight of the type. We never label an emotion.")
seg("f-voice", [figure(FIG + "fig-segmentation-raw.png", "Voice separation, raw. The model hears one voice across three lines that the caption file gives to two people. We flag that for a person instead of picking a side.")], 6.0,
    "Voice separation, shown raw. Here the model hears one voice across three lines that the caption file gives to two people. We flag that for a person instead of picking a side.")
seg("f-face", [figure(FIG + "fig-protected-regions.png", "Face detection marks where a caption must not go. A line that would cover a face moves to the bottom.")], 6.0,
    "Face detection marks where a caption must not go. A line that would cover a face moves to the bottom.")
seg("f-ladder", [figure(FPNG + "fig3-fallback-ladder.svg.png", "Every check a line has to pass. Each red branch keeps the approved words on screen and writes down why the extra was dropped.", True)], 7.5,
    "And every check a line has to pass before it is enhanced. Each red branch keeps the approved words on screen and writes down why the extra was dropped.")
seg("f-sync", [figure(FIG + "fig-sync-measured.png", "Measured on the virtual device, one scene start to finish. Word changes land within about 10 ms of the boundary. No line was ever lost.")], 7.5,
    "We measured it on the virtual device, one scene start to finish. Word changes land within about ten milliseconds of the boundary, and no line was ever lost.")
seg("never", [card("What it never does", "It never invents a caption.", "It does not guess who is speaking, read emotions, or change a single approved word. A line no person has checked plays as a plain caption.", ORANGE)], 5.6,
    "It never invents a caption. It does not guess who is speaking, read emotions, or change a single approved word. A line no person has checked plays as a plain caption.")
seg("close", [card(None, "Sightline", "A Fire TV caption runtime, a package other apps can use, and an open file format.", CYAN, "tos-bridge.jpg", CREDIT)], 5.5,
    "Sightline. A Fire TV caption runtime, a package other apps can use, and an open file format.")

# ---- render with crossfades (0.4 s between segments, 0.12 s between footage frames)
XF, FF = 0.4, 0.07
n = [0]
# --out <file.mp4> streams frames straight into ffmpeg (no frame dump on disk); otherwise PNGs go to FRM
OUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
FFM = None
if OUT and not TEXT_ONLY:
    import subprocess
    FFM = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
def emit(img):
    n[0] += 1
    if FFM: FFM.stdin.write(img.tobytes())
    else: img.save(f"{FRM}{n[0]:05d}.png")
def blend(a, b, t): return Image.blend(a, b, t)

prev_last = None; times = []
if TEXT_ONLY:
    t = 0.0
    for name, images, seconds, narration in timeline: times.append((name, t, t + seconds, narration)); t += seconds
    n[0] = round(t * FPS)
for name, images, seconds, narration in ([] if TEXT_ONLY else timeline):
    start = n[0] / FPS
    if len(images) == 1:
        img = images[0]; total = round(seconds * FPS)
        for i in range(total):
            if prev_last is not None and i < XF * FPS: emit(blend(prev_last, img, (i + 1) / (XF * FPS)))
            else: emit(img)
        prev_last = img
    else:
        # footage: each captured frame holds for its real share of the beat; the beat is then trimmed or held to exactly `seconds`
        target = round(seconds * FPS); before = n[0]
        per = seconds / len(images); per_frames = max(1, round(per * FPS)); ff = max(1, round(FF * FPS))
        for k, img in enumerate(images):
            for i in range(per_frames):
                if n[0] - before >= target: break
                if k == 0 and prev_last is not None and i < XF * FPS: emit(blend(prev_last, img, (i + 1) / (XF * FPS)))
                elif k > 0 and i < ff: emit(blend(images[k - 1], img, (i + 1) / (ff + 1)))
                else: emit(img)
        while n[0] - before < target: emit(images[-1])
        prev_last = images[-1]
    times.append((name, start, n[0] / FPS, narration))
if FFM: FFM.stdin.close(); FFM.wait()
print(f"frames: {n[0]}  duration: {n[0]/FPS:.1f}s" + (f"  written to {OUT}" if OUT else ""))

# ---- narration script and captions for the video, from the same timeline
def tc(t, srt=False):
    h, m = int(t // 3600), int(t % 3600 // 60); s = t % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",") if srt else f"{m:d}:{int(s):02d}"
with open(DOCS + "demo-voiceover.md", "w") as f:
    f.write("# Voice-over for the demo video\n\nRead in a normal speaking voice, no hurry. Each line starts when its section starts; the timings come from the same script that builds the picture, so they match the cut. Total about %d seconds of picture.\n\n| Start | Section | Say |\n|---:|---|---|\n" % round(n[0] / FPS))
    for name, a, b, narr in times: f.write(f"| {tc(a)} | {name} | {narr or '(no voice. Let the scene play with the sound off.)'} |\n")
    f.write("\nIf you record: a phone in a quiet room is fine. Export as one file, then `ffmpeg -i video.mp4 -i voice.m4a -c:v copy -c:a aac -shortest out.mp4`. The SRT beside the video carries the same words, so the video stays accessible with the sound off.\n")
with open(S + "sightline-demo-2026-09-03.srt", "w") as f:
    k = 1
    for name, a, b, narr in times:
        if not narr: continue
        # split long narration into cues of at most ~90 characters, spread over the section
        # one or two sentences per cue, never a cut mid-sentence, at most about 90 characters
        sents = [x.strip() for x in re.split(r"(?<=[.!?])\s+", narr) if x.strip()]
        chunks, cur = [], ""
        for x in sents:
            t = (cur + " " + x).strip()
            if len(t) <= 90 or not cur: cur = t
            else: chunks.append(cur); cur = x
        if cur: chunks.append(cur)
        span = (b - a) / len(chunks)
        for i, c in enumerate(chunks):
            f.write(f"{k}\n{tc(a + i * span, True)} --> {tc(min(b, a + (i + 1) * span) - 0.05, True)}\n{c}\n\n"); k += 1
json.dump([{"name": nm, "start": round(a, 3), "end": round(b, 3), "text": nr} for nm, a, b, nr in times], open(S + "timeline.json", "w"), indent=1)
print("voice-over and SRT written")
