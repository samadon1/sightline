#!/usr/bin/env python3
"""
Propose speaker clusters per cue from the audio, without any cloud service or gated model.

  venv-author/bin/python tools/author/speakers.py <captions.en.vtt> <audio-16k-mono.wav> <words.json> <out.speakers.json> [--k 2] [--auto]

Each cue's voiced frames (from its verified word spans, or the whole cue if none) give a fixed-length
voice print: mean and standard deviation of 20 MFCCs, median f0 and voiced fraction. Cues are clustered
(agglomerative, cosine) into k voices, or k is chosen automatically by silhouette score between 2 and 5.
Output: {"clusters": {"A": [cueIds...]}, "cues": {cueId: {"cluster": "A", "confidence": 0-1}}, all proposed.

A person names each cluster (this is Celia, this is Thom) in the review page; the runtime never sees
unnamed clusters. Where a caption file already carries <v Name> spans, the tool reports agreement so
the reviewer can spot the cues that disagree. Diarization models with better accuracy (pyannote) need
an access token and a licence acceptance, which is a decision for the project owner, not this script.
"""
import json, sys, os
import numpy as np

def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    opt = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    vtt, wav, words_path, out = a[:4]
    k_fixed = int(opt("--k", "0"))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from align import parse_vtt
    import librosa
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import StandardScaler
    y, sr = librosa.load(wav, sr=16000, mono=True)
    cues = parse_vtt(vtt); words = json.load(open(words_path))
    hop = 160
    mf = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20, hop_length=hop)
    f0, _, _ = librosa.pyin(y, fmin=70, fmax=400, sr=sr, frame_length=1024, hop_length=hop)
    feats, ids, voices = [], [], []
    for c in cues:
        spans = [(w["startMs"], w["endMs"]) for w in words.get(c["id"], []) if w.get("score", 1) >= 0.5] or [(c["startMs"], c["endMs"])]
        idx = np.concatenate([np.arange(int(s / 10), max(int(s / 10) + 1, int(e / 10))) for s, e in spans])
        idx = idx[idx < mf.shape[1]]
        if len(idx) < 5: continue
        seg = mf[:, idx]; fseg = f0[idx]; fseg = fseg[~np.isnan(fseg)]
        vec = np.concatenate([seg.mean(1), seg.std(1), [np.median(fseg) if len(fseg) else 0.0, len(fseg) / len(idx)]])
        feats.append(vec); ids.append(c["id"])
        import re
        m = re.search(r"<v\s+([^>]+)>", c["raw"]); voices.append(m.group(1).strip() if m else None)
    X = StandardScaler().fit_transform(np.array(feats))
    best = None
    ks = [k_fixed] if k_fixed else range(2, min(6, len(ids)))
    for k in ks:
        if k >= len(ids): continue
        lab = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average").fit_predict(X)
        sc = silhouette_score(X, lab, metric="cosine") if k > 1 and len(set(lab)) > 1 else -1
        if best is None or sc > best[0]: best = (sc, k, lab)
    sc, k, lab = best
    names = "ABCDEFGH"
    # confidence: distance margin between own centroid and the nearest other centroid
    cents = {c: X[lab == c].mean(0) for c in set(lab)}
    def cos(u, v): return float(np.dot(u, v) / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-9))
    res_cues, clusters = {}, {}
    for i, cid in enumerate(ids):
        own = cos(X[i], cents[lab[i]]); others = [cos(X[i], cents[c]) for c in cents if c != lab[i]]
        conf = float(np.clip((own - max(others)) / 2 + 0.5, 0, 1)) if others else 1.0
        name = names[lab[i]]
        res_cues[cid] = {"cluster": name, "confidence": round(conf, 2), "voiceSpan": voices[i]}
        clusters.setdefault(name, []).append(cid)
    # agreement with <v> spans, if present
    agreement = None
    if any(voices):
        from collections import Counter
        maj = {n: Counter(v for c, v in zip(ids, voices) if res_cues[c]["cluster"] == n and v).most_common(1) for n in clusters}
        maj = {n: (m[0][0] if m else None) for n, m in maj.items()}
        agree = sum(1 for c, v in zip(ids, voices) if v and maj[res_cues[c]["cluster"]] == v)
        agreement = {"clusterVoice": maj, "agree": agree, "of": sum(1 for v in voices if v)}
    json.dump({"k": int(k), "silhouette": round(float(sc), 3), "clusters": clusters, "cues": res_cues, "agreement": agreement, "status": "proposed"}, open(out, "w"), indent=2)
    print(f"speakers: {len(ids)} cues -> {k} clusters (silhouette {sc:.2f}); agreement with <v> spans: {agreement['agree'] if agreement else '-'} of {agreement['of'] if agreement else '-'}")
    for n, members in clusters.items(): print(f"  {n}: {', '.join(members)}  ({agreement['clusterVoice'][n] if agreement else ''})")

if __name__ == "__main__":
    main()
