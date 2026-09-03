#!/usr/bin/env python3
"""
Detect non-speech sound events for schema 0.2 `sounds[]`, all proposed, with an AudioSet tagger from
audiotimm (PANNs CNN14 by default; BEATs if installed). Nothing is invented: every event carries the
model's label, confidence, and the window it came from, and a person names the final label and the
direction in the review page.

  venv-author/bin/python tools/author/sounds.py <audio-16k-mono.wav> <captions.en.vtt> <out.sounds.json>
      [--model panns-cnn14-16k] [--window 1.0] [--hop 0.5] [--min-score 0.35]

Windows overlapping dialogue cues are still analysed, but "Speech"/"Narration"-type labels are dropped,
and events whose label is already captioned in a bracketed cue are marked duplicate.
"""
import json, sys, os, re, tempfile, wave, array

SPEECHY = re.compile(r"speech|narration|conversation|monologue|male speech|female speech|child speech|singing|humming|whispering|shout|yell|laughter|crying|sobbing|screaming|chatter|babbling|breathing|cough|sneeze|throat", re.I)
KEEP_VOCAL = re.compile(r"laughter|crying|sobbing|screaming|shout|yell|whispering|cough|sneeze|throat|gasp|sigh|humming|singing", re.I)

def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    opt = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    wav, vtt, out = a[:3]
    model = opt("--model", "panns-cnn14-16k"); win = float(opt("--window", "1.0")); hop = float(opt("--hop", "0.5")); minscore = float(opt("--min-score", "0.35"))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from align import parse_vtt, visible_tokens
    from audiotimm import Classifier
    cues = parse_vtt(vtt)
    bracketed = [" ".join(visible_tokens(c["raw"])).strip("[]() ").lower() for c in cues if re.match(r"^\s*[\[(].*[\])]\s*$", " ".join(visible_tokens(c["raw"])))]
    clf = Classifier.load(model)
    with wave.open(wav, "rb") as w:
        sr, n = w.getframerate(), w.getnframes(); frames = w.readframes(n); sw = w.getsampwidth(); ch = w.getnchannels()
    assert sw == 2 and ch == 1, "expected 16-bit mono"
    samples = array.array("h", frames)
    total = n / sr
    tmp = tempfile.mkdtemp()
    windows = []
    t = 0.0
    while t + 0.25 < total:
        s0, s1 = int(t * sr), int(min(total, t + win) * sr)
        path = os.path.join(tmp, f"w{len(windows):04d}.wav")
        with wave.open(path, "wb") as o:
            o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes(samples[s0:s1].tobytes())
        windows.append((t, min(total, t + win), path)); t += hop
    results = clf.predict([p for _, _, p in windows])
    per = []
    for (t0, t1, _), r in zip(windows, results.results if hasattr(results, "results") else results):
        top = r.top(5) if hasattr(r, "top") else []
        cands = []
        for item in top:
            label, score = (item[0], float(item[1])) if isinstance(item, (tuple, list)) else (str(getattr(item, "label", item)), float(getattr(item, "score", 0)))
            if score < minscore: continue
            if SPEECHY.search(label) and not KEEP_VOCAL.search(label): continue
            cands.append((label, score))
        per.append((t0, t1, cands))
    # merge consecutive windows sharing the top label
    events, cur = [], None
    for t0, t1, cands in per:
        if not cands:
            if cur: events.append(cur); cur = None
            continue
        label, score = cands[0]
        if cur and cur["label"] == label and t0 <= cur["end"] + 1e-6:
            cur["end"] = t1; cur["score"] = max(cur["score"], score)
        else:
            if cur: events.append(cur)
            cur = {"label": label, "start": t0, "end": t1, "score": score}
    if cur: events.append(cur)
    # Level per event relative to the clip's overall speech level (80th percentile of 1 s window RMS), in dB, so the
    # runtime can size the label (CI 2.4.4). Computed from the same samples PANNs saw.
    import math
    def rms_db(s0, s1):
        seg = samples[s0:s1]
        if not len(seg): return -40.0
        return 20 * math.log10(math.sqrt(sum(v * v for v in seg) / len(seg)) / 32768 + 1e-9)
    win_db = [rms_db(int(t0 * sr), int(t1 * sr)) for (t0, t1, _) in windows]
    ref = sorted(win_db)[int(0.8 * (len(win_db) - 1))] if win_db else -20.0
    outl = []
    for k, e in enumerate(events):
        e["loudDb"] = round(max(-40.0, min(40.0, rms_db(int(e["start"] * sr), int(e["end"] * sr)) - ref)), 1)
        lab = e["label"].lower()
        dup = any(lab.split(",")[0] in b or b in lab for b in bracketed)
        outl.append({"id": f"sfx{k+1:02d}", "startMs": int(e["start"] * 1000), "endMs": int(e["end"] * 1000), "label": e["label"].split(",")[0].lower(),
                     "loudDb": e["loudDb"], "status": "proposed", "provenance": f"{model} score={e['score']:.2f}" + ("; already captioned" if dup else "")})
    json.dump(outl, open(out, "w"), indent=2)
    import shutil; shutil.rmtree(tmp, ignore_errors=True)  # the per-window WAVs are scratch
    print(f"sounds: {len(outl)} proposed events from {len(windows)} windows -> {out}")
    for e in outl[:12]: print(f"  {e['startMs']:6d}-{e['endMs']:6d} {e['label']}  ({e['provenance']})")

if __name__ == "__main__":
    main()
