#!/usr/bin/env python3
"""
Active speaker detection from the picture, offline: which face is talking during each cue.

  venv-author/bin/python tools/author/asd.py <video.mp4> <captions.en.vtt> <out.asd.json> --yunet <yunet.onnx> --sface <sface.onnx> [--fps 10]

Method (no training, no cloud): YuNet detects faces on every sampled frame; SFace embeddings cluster the faces
into identities across shots; for each face track the mouth region (from the mouth-corner landmarks) is
compared frame to frame, and the mean absolute change, normalised by face size, is a lip-activity score.
For each cue the identity with the highest lip activity while the cue is on screen is the proposed on-camera
speaker, with a confidence from the margin over the next face. No face with activity → off-camera (proposed).

Output: {"identities": {"F1": {"frames": n, "sampleFace": [x,y,w,h]}}, "cues": {cueId: {"identity": "F1"|null,
"confidence": 0-1, "offCamera": bool, "faces": {"F1": activity, ...}}}, all proposed. propose.py merges it as
`speakerProposal.face`; a person names identities once (F1 = Celia) in the review page.
"""
import sys, os, json
import numpy as np, cv2

def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    opt = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    video, vtt, out = a[:3]; fps_s = float(opt("--fps", "10"))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from align import parse_vtt
    det = None; rec = cv2.FaceRecognizerSF.create(opt("--sface"), "")
    cap = cv2.VideoCapture(video); fps = cap.get(cv2.CAP_PROP_FPS); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    det = cv2.FaceDetectorYN.create(opt("--yunet"), "", (W, H), score_threshold=0.6)
    step = max(1, int(round(fps / fps_s)))
    obs = []  # (t_ms, box, landmarks, embedding, mouth_patch)
    idx = 0; prev_gray = None
    while True:
        ok, frame = cap.read()
        if not ok: break
        if idx % step == 0:
            t = idx / fps * 1000
            _, found = det.detect(frame)
            if found is not None:
                for f in found:
                    x, y, w, h = [float(v) for v in f[:4]]
                    if w < W * 0.04: continue
                    lm = f[4:14].reshape(5, 2)  # right eye, left eye, nose, right mouth, left mouth
                    aligned = rec.alignCrop(frame, f)
                    emb = rec.feature(aligned).flatten()
                    mx0, mx1 = int(min(lm[3][0], lm[4][0]) - w * 0.1), int(max(lm[3][0], lm[4][0]) + w * 0.1)
                    my0, my1 = int(min(lm[3][1], lm[4][1]) - h * 0.12), int(max(lm[3][1], lm[4][1]) + h * 0.15)
                    mx0, my0 = max(0, mx0), max(0, my0); mx1, my1 = min(W, mx1), min(H, my1)
                    patch = cv2.cvtColor(frame[my0:my1, mx0:mx1], cv2.COLOR_BGR2GRAY) if my1 > my0 and mx1 > mx0 else None
                    if patch is not None: patch = cv2.resize(patch, (48, 24))
                    obs.append({"t": t, "box": [x, y, w, h], "emb": emb, "patch": patch})
        idx += 1
    if not obs: json.dump({"identities": {}, "cues": {}}, open(out, "w")); print("asd: no faces"); return
    # identities: greedy clustering on cosine similarity of SFace embeddings
    ids = []  # list of (centroid, count, sample_box)
    assign = []
    for o in obs:
        e = o["emb"] / (np.linalg.norm(o["emb"]) + 1e-9)
        best, bs = None, 0.0
        for i, (c, cnt, box) in enumerate(ids):
            s = float(np.dot(e, c / (np.linalg.norm(c) + 1e-9)))
            if s > bs: best, bs = i, s
        if best is not None and bs >= 0.363:  # SFace's documented cosine match threshold
            c, cnt, box = ids[best]; ids[best] = ((c * cnt + e) / (cnt + 1), cnt + 1, box); assign.append(best)
        else:
            ids.append((e, 1, o["box"])); assign.append(len(ids) - 1)
    # Second pass: merge identities whose centroids match (greedy order can split one person across shots).
    parent = list(range(len(ids)))
    def find(i):
        while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            ci = ids[i][0] / (np.linalg.norm(ids[i][0]) + 1e-9); cj = ids[j][0] / (np.linalg.norm(ids[j][0]) + 1e-9)
            if float(np.dot(ci, cj)) >= 0.363: parent[find(j)] = find(i)
    roots = sorted(set(find(i) for i in range(len(ids))), key=lambda r: -sum(ids[k][1] for k in range(len(ids)) if find(k) == r))
    root_name = {r: f"F{n+1}" for n, r in enumerate(roots)}
    names = {i: root_name[find(i)] for i in range(len(ids))}
    merged_count = {r: sum(ids[k][1] for k in range(len(ids)) if find(k) == r) for r in roots}
    # lip activity per identity over time: mean abs difference between consecutive mouth patches of the same identity
    by_id = {}
    for o, i in zip(obs, assign): by_id.setdefault(names[i], []).append(o)
    activity = {}  # (identity, t) -> score
    for i, seq in by_id.items():
        seq.sort(key=lambda o: o["t"])
        for p, q in zip(seq, seq[1:]):
            if p["patch"] is None or q["patch"] is None or q["t"] - p["t"] > 400: continue
            d = float(np.mean(np.abs(q["patch"].astype(np.float32) - p["patch"].astype(np.float32)))) / 255.0
            activity[(i, q["t"])] = d
    cues = parse_vtt(vtt)
    res = {}
    for c in cues:
        per = {}
        for (i, t), d in activity.items():
            if c["startMs"] <= t <= c["endMs"]: per.setdefault(i, []).append(d)
        scores = {i: round(float(np.mean(v)), 4) for i, v in per.items() if len(v) >= 2}
        if scores:
            ranked = sorted(scores.items(), key=lambda kv: -kv[1])
            top, ts = ranked[0]; second = ranked[1][1] if len(ranked) > 1 else 0.0
            conf = round(float(min(1.0, (ts - second) / (ts + 1e-9))), 2) if len(ranked) > 1 else 0.3  # one face only: the detector misses profile faces, so a lone winner proves little
            res[c["id"]] = {"identity": top, "confidence": conf, "offCamera": False, "faces": scores}
        else:
            res[c["id"]] = {"identity": None, "confidence": 0.0, "offCamera": True, "faces": {}}
    identities = {root_name[r]: {"frames": merged_count[r], "sampleFace": [round(v, 1) for v in ids[r][2]]} for r in roots}
    json.dump({"identities": identities, "cues": res, "status": "proposed", "provenance": "yunet+sface+lip-activity"}, open(out, "w"), indent=2)
    print(f"asd: {len(obs)} face observations, {len(ids)} identities, {sum(1 for r in res.values() if r['identity'])}/{len(cues)} cues with an on-camera speaker -> {out}")
    for cid, r in res.items(): print(f"  {cid} {r['identity']} conf={r['confidence']} faces={r['faces']}")

if __name__ == "__main__":
    main()
