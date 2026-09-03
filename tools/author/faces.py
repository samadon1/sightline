#!/usr/bin/env python3
"""
Propose protected regions (faces) per shot from the video, so the resolver keeps captions off them.

  venv-author/bin/python tools/author/faces.py <video.mp4> <out.shots.json> --model <face_detection_yunet_2023mar.onnx> [--step 0.5] [--min-face 0.04]

OpenCV's YuNet face detector (ONNX, from opencv_zoo; pass --model) runs on one frame every `step` seconds. Detections are expressed as
normalised rectangles, padded by 10%, and grouped into one-second shots; consecutive shots with a
similar union rectangle are merged. Frames without faces produce shots without regions. Everything is
proposed: a person confirms in the review page. The detector can miss profiles and small faces; that is
acceptable because a missed face costs a caption over a face, which is today's baseline, not a wrong
caption.
"""
import json, sys, cv2

def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    opt = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
    video, out = a[:2]; step = opt("--step", 0.5); min_face = opt("--min-face", 0.04)
    cap = cv2.VideoCapture(video); fps = cap.get(cv2.CAP_PROP_FPS); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); W = cap.get(cv2.CAP_PROP_FRAME_WIDTH); H = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    model = sys.argv[sys.argv.index("--model") + 1]
    det = cv2.FaceDetectorYN.create(model, "", (int(W), int(H)), score_threshold=0.6)
    # Regions are expressed in screen coordinates: a widescreen picture is letterboxed inside 16:9 on the TV,
    # so video-frame rectangles are mapped into the picture's band of the screen.
    screen_aspect = 16 / 9; vid_aspect = W / H
    if vid_aspect > screen_aspect: sy, oy, sx, ox = screen_aspect / vid_aspect, (1 - screen_aspect / vid_aspect) / 2, 1.0, 0.0
    else: sx, ox, sy, oy = vid_aspect / screen_aspect, (1 - vid_aspect / screen_aspect) / 2, 1.0, 0.0
    samples = []
    t = 0.0
    while t * fps < n:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps)); ok, frame = cap.read()
        if not ok: break
        _, found = det.detect(frame)
        faces = [] if found is None else [(float(f[0]), float(f[1]), float(f[2]), float(f[3])) for f in found if f[2] >= W * min_face and f[3] >= H * min_face]
        rects = []
        for (x, y, w, h) in faces:
            px, py = w * 0.1, h * 0.1
            rx, ry, rw, rh = max(0, (x - px) / W), max(0, (y - py) / H), min(1, (w + 2 * px) / W), min(1, (h + 2 * py) / H)
            rects.append({"x": ox + rx * sx, "y": oy + ry * sy, "w": rw * sx, "h": rh * sy})
        samples.append((t, rects)); t += step
    # one-second buckets → union rectangle of all faces in the bucket
    shots = []
    sec = {}
    for t, rects in samples: sec.setdefault(int(t), []).extend(rects)
    last = None
    for s in sorted(sec):
        rs = sec[s]
        if rs:
            x0 = min(r["x"] for r in rs); y0 = min(r["y"] for r in rs); x1 = max(r["x"] + r["w"] for r in rs); y1 = max(r["y"] + r["h"] for r in rs)
            u = {"x": round(x0, 3), "y": round(y0, 3), "w": round(x1 - x0, 3), "h": round(y1 - y0, 3), "reason": f"face ({len(rs)} detections)"}
        else: u = None
        if last and last["endMs"] == s * 1000 and ((u is None and not last.get("protected")) or (u and last.get("protected") and abs(last["protected"][0]["x"] - u["x"]) < 0.08 and abs(last["protected"][0]["y"] - u["y"]) < 0.08 and abs(last["protected"][0]["w"] - u["w"]) < 0.1)):
            last["endMs"] = (s + 1) * 1000
            if u: last["protected"][0]["reason"] = u["reason"]
        else:
            last = {"id": f"s{len(shots)+1:02d}", "startMs": s * 1000, "endMs": (s + 1) * 1000}
            if u: last["protected"] = [u]
            shots.append(last)
    json.dump(shots, open(out, "w"), indent=2)
    withf = [s for s in shots if s.get("protected")]
    print(f"faces: {len(samples)} frames sampled, {len(shots)} shots, {len(withf)} with a protected face region -> {out}")
    for s in withf[:12]: p = s["protected"][0]; print(f"  {s['startMs']:6d}-{s['endMs']:6d}  x={p['x']:.2f} y={p['y']:.2f} w={p['w']:.2f} h={p['h']:.2f}  {p['reason']}")

if __name__ == "__main__":
    main()
