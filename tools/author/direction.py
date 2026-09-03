#!/usr/bin/env python3
"""
Propose a left/centre/right direction for each sound event from the stereo mix.

  venv-author/bin/python tools/author/direction.py <audio-stereo.wav> <sounds.json> [--threshold-db 3]

For each event window the RMS of the left and right channels is compared; a difference beyond the
threshold proposes "left" or "right", otherwise "center". Written back into sounds.json as
`direction` with `directionProvenance`; the event stays proposed until a person confirms it. Film mixes
often pan little, so the tool also reports the measured difference so a reviewer can judge.
"""
import json, sys, wave, array, math

def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    wav, sounds_path = a[:2]
    thr = float(sys.argv[sys.argv.index("--threshold-db") + 1]) if "--threshold-db" in sys.argv else 3.0
    with wave.open(wav, "rb") as w:
        sr, ch, sw, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        assert ch == 2 and sw == 2, "expected 16-bit stereo"
        data = array.array("h", w.readframes(n))
    L = data[0::2]; R = data[1::2]
    def rms(x, a, b):
        seg = x[a:b]
        return math.sqrt(sum(v * v for v in seg) / max(1, len(seg))) + 1e-9
    events = json.load(open(sounds_path))
    for e in events:
        s0, s1 = int(e["startMs"] * sr / 1000), int(e["endMs"] * sr / 1000)
        diff = 20 * math.log10(rms(R, s0, s1) / rms(L, s0, s1))
        e["direction"] = "right" if diff > thr else "left" if diff < -thr else "center"
        e["directionProvenance"] = f"stereo level difference {diff:+.1f} dB (R-L)"
    json.dump(events, open(sounds_path, "w"), indent=2)
    for e in events: print(f"  {e['startMs']:6d}-{e['endMs']:6d} {e['label']:<24} {e['direction']:<6} {e['directionProvenance']}")

if __name__ == "__main__":
    main()
