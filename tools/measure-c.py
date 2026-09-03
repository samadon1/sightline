"""Measurement C on the VVD: compare what the compositor shows (burned-in clock + caption text read by OCR)
with the caption schedule. For each capture: clock t; displayed cue set D (caption lines matched to cues);
expected set E(t). If D == E(t): visual lag <= t - (last boundary before t). Else find the smallest d with
E(t - d) == D: visual lag >= d (late) — or E(t + d) == D: early by d."""
import os, re, sys, glob, json, Vision
from Foundation import NSURL
from PIL import Image
S="/private/tmp/claude-501/-Users-mac-Downloads-Sightline/b8482812-cef5-4a8a-8b1d-7bb513b11292/scratchpad"
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "author"))
from align import parse_vtt, visible_tokens
vtt = sys.argv[1]; folder = sys.argv[2]
cues = parse_vtt(vtt)
norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
cue_lines = {c["id"]: [norm(l) for l in " ".join(visible_tokens(c["raw"])).split("\n")] for c in cues}
cue_full = {c["id"]: norm(" ".join(visible_tokens(c["raw"]))) for c in cues}
bounds = sorted(set([c["startMs"] for c in cues] + [c["endMs"] for c in cues]))
def expected(t): return frozenset(c["id"] for c in cues if c["startMs"] <= t < c["endMs"])
def ocr(path):
    im = Image.open(path); w, h = im.size; im.crop((0, 0, int(w * 0.829), h)).save(f"{S}/ocr-tmp.png")
    handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(NSURL.fileURLWithPath_(f"{S}/ocr-tmp.png"), None)
    req = Vision.VNRecognizeTextRequest.alloc().init(); req.setRecognitionLevel_(1); handler.performRequests_error_([req], None)
    return [r.topCandidates_(1)[0].string() for r in req.results()]
rows = []
for path in sorted(glob.glob(folder + "/f*.png")):
    lines = ocr(path)
    t = None; shown = set()
    for l in lines:
        m = re.search(r"(\d\d)[:.](\d\d)[.:,](\d{3})", l)
        if m and t is None: t = int(m.group(1)) * 60000 + int(m.group(2)) * 1000 + int(m.group(3)); continue
        n = norm(l)
        if len(n) < 3 or "placeholder" in n or "active" in n: continue
        # exact line or full-cue match first; otherwise a long substring of exactly one cue
        exact = [cid for cid, ls in cue_lines.items() if n in ls or n == cue_full[cid]]
        if exact: shown.add(exact[0]); continue
        subs = [cid for cid, full in cue_full.items() if n in full and len(n) >= max(8, len(full) // 2)]
        if len(subs) == 1: shown.add(subs[0])
    if t is None: continue
    E = expected(t); D = frozenset(shown)
    last_b = max([b for b in bounds if b <= t], default=0); nxt = min([b for b in bounds if b > t], default=t)
    if D == E: verdict = ("ok", t - last_b)
    else:
        late = next((d for d in range(20, 1500, 20) if expected(t - d) == D), None)
        early = next((d for d in range(20, 1500, 20) if expected(t + d) == D), None)
        verdict = ("late>=", late) if late is not None else ("early>=", early) if early is not None else ("unmatched", None)
    rows.append((path.split("/")[-1], t, sorted(E), sorted(D), verdict))
ok = [r for r in rows if r[4][0] == "ok"]; late = [r for r in rows if r[4][0] == "late>="]; early = [r for r in rows if r[4][0] == "early>="]; un = [r for r in rows if r[4][0] == "unmatched"]
print(f"samples {len(rows)}: agree {len(ok)}, late {len(late)}, early {len(early)}, unmatched {len(un)}")
if late: print("late lower bounds (ms):", sorted(r[4][1] for r in late))
if early: print("early lower bounds (ms):", sorted(r[4][1] for r in early))
# samples that agree and sit within 300 ms after a boundary bound the lag from above
tight = sorted(r[4][1] for r in ok if r[4][1] <= 400)
print("agreeing samples within 400 ms after a boundary (upper bounds on lag, ms):", tight)
for r in rows:
    if r[4][0] != "ok": print("  ", r[0], r[1], "expected", r[2], "shown", r[3], r[4])
json.dump(rows, open(folder + "/rows.json", "w"))
