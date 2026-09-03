#!/usr/bin/env python3
"""
Speaker diarization with pyannote 3.1 (offline after the first download), scored per cue.

  venv-author/bin/python tools/author/diarize.py <captions.en.vtt> <audio-16k-mono.wav> <out.diarization.json>

Output: {"speakersFound": n, "cues": {cueId: {"cluster": "SPEAKER_01", "confidence": 0.0-1.0, "voiceSpan": "Thom"|null,
"proposedSpeaker": "thom"|null}}, "mapping": {"SPEAKER_01": "Thom"}, "agreement": {"agree": k, "of": n}}.
`confidence` is the share of the cue's duration covered by its dominant diarized voice; `proposedSpeaker` is the
majority name for that cluster among cues that carry a <v> span (or the cluster id when none do), lower-cased
to a speaker key. Everything is proposed; propose.py merges it and the review page shows the disagreements.

Setup (once): `hf auth login` with a Hugging Face token, accept the conditions on pyannote/speaker-diarization-3.1
and pyannote/segmentation-3.0, and install `pyannote.audio>=3.1,<4`. Checkpoints are loaded with
weights_only=False because pyannote's official files predate PyTorch's safe-loading default.
"""
import sys, re, json, time, os
from collections import Counter, defaultdict

def main():
    vtt, wav, out = sys.argv[1:4]
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from align import parse_vtt
    import torch, soundfile as sf
    _load = torch.load
    def _load_full(*a, **k): k["weights_only"] = False; return _load(*a, **k)
    torch.load = _load_full
    from pyannote.audio import Pipeline
    t0 = time.time()
    pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
    data, sr = sf.read(wav, dtype="float32"); wave = torch.from_numpy(data).unsqueeze(0)
    dia = pipe({"waveform": wave, "sample_rate": sr})
    segs = [(turn.start * 1000, turn.end * 1000, spk) for turn, _, spk in dia.itertracks(yield_label=True)]
    cues = parse_vtt(vtt)
    rows = {}
    for c in cues:
        m = re.search(r"<v\s+([^>]+)>", c["raw"]); voice = m.group(1).strip() if m else None
        overlap = {}
        for s, e, spk in segs:
            o = max(0, min(e, c["endMs"]) - max(s, c["startMs"]))
            if o > 0: overlap[spk] = overlap.get(spk, 0) + o
        best = max(overlap, key=overlap.get) if overlap else None
        conf = overlap[best] / (c["endMs"] - c["startMs"]) if best else 0.0
        rows[c["id"]] = {"cluster": best, "confidence": round(min(1.0, conf), 2), "voiceSpan": voice}
    votes = defaultdict(Counter)
    for r in rows.values():
        if r["voiceSpan"] and r["cluster"]: votes[r["cluster"]][r["voiceSpan"]] += 1
    mapping = {k: v.most_common(1)[0][0] for k, v in votes.items()}
    for r in rows.values():
        name = mapping.get(r["cluster"]) if r["cluster"] else None
        r["proposedSpeaker"] = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") if name else (r["cluster"].lower() if r["cluster"] else None)
    tagged = [r for r in rows.values() if r["voiceSpan"] and r["cluster"]]
    agree = sum(1 for r in tagged if mapping.get(r["cluster"]) == r["voiceSpan"])
    result = {"speakersFound": len(set(s for _, _, s in segs)), "cues": rows, "mapping": mapping, "agreement": {"agree": agree, "of": len(tagged)}, "segments": [[round(s), round(e), spk] for s, e, spk in segs], "status": "proposed", "provenance": "pyannote/speaker-diarization-3.1"}
    json.dump(result, open(out, "w"), indent=2)
    print(f"diarize: {result['speakersFound']} voices, {len(cues)} cues, agreement with <v> spans {agree}/{len(tagged)}, {time.time()-t0:.0f}s -> {out}")
    for cid, r in rows.items():
        flag = "" if not r["voiceSpan"] or mapping.get(r["cluster"]) == r["voiceSpan"] else "  <-- disagrees with the track"
        print(f"  {cid} {r['cluster']} conf={r['confidence']} track={r['voiceSpan']} proposed={r['proposedSpeaker']}{flag}")

if __name__ == "__main__":
    main()
