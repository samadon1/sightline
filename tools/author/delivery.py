#!/usr/bin/env python3
"""
Measure delivery per word and per cue from the audio: loudness, pitch, pace, elongation.

  venv-author/bin/python tools/author/delivery.py <captions.en.vtt> <audio-16k-mono.wav> <words.json> <companion.en.json> <out.delivery.json>

Nothing here classifies emotion. Every value is a measurement quantised against the scene's own
speech, so a quiet film and a loud film get the same range of levels:

  loud  : RMS (dB) of the word relative to the median of all timed words in the scene, quantised to the
          Caption with Intention size steps the runtime renders (3% whisper, 5% normal, 8% loud, 12% yell of
          screen height, 2.3.6): <= -5 dB → -1, -5..+3 → 0, +3..+6 → 1, > +6 → 2. Film dialogue is mixed
          with a narrow range, so the thresholds are tight; the review page is where a person adjusts.
  pitch : Caption with Intention 2.3.8: absolute bands. Median fundamental (pyin) of the word:
          < 160 Hz → -1 (heavier type), 160–200 Hz → 0 (Regular 400), > 200 Hz → 1 (lighter type)
  width : Caption with Intention 2.3.9, "harmonics drive width". Spectral centroid of the word relative to the
          scene's speech median: a darker, richer voice (centroid <= -20% of the median) → 1 (wide), a thin or bright
          one (>= +20%) → -1 (narrow), else 0. Rendered by choosing the wide/narrow static instances.
  pace  : cue syllable rate (vowel-group count / speech time) relative to the scene median: slow -1 / 0 / fast 1
  stretch: a word whose duration exceeds 2.2x the scene's per-character rate, is over 450 ms, and is voiced
          for at least 70% of its frames gets a proposed stretched spelling with the last vowel group repeated
          (e.g. "No" -> "Nooo"). Presentation only; a person confirms.

Output: {"cues": {cueId: {loud, pace}}, "words": {cueId: {"<i>": {loud, pitch, [stretch]}}}}, all proposed.
"""
import json, sys, re, statistics
import numpy as np

def main():
    vtt, wav, words_path, comp_path, out = sys.argv[1:6]
    sys.path.insert(0, __file__.rsplit("/", 1)[0])
    from align import parse_vtt, visible_tokens
    import librosa
    y, sr = librosa.load(wav, sr=16000, mono=True)
    cues = parse_vtt(vtt)
    words = json.load(open(words_path))
    comp = json.load(open(comp_path))
    speaker_of = {cid: (comp.get("cues", {}).get(cid, {}) or {}).get("speaker") for cid in words}
    hop = 160  # 10 ms
    rms = librosa.feature.rms(y=y, frame_length=400, hop_length=hop)[0]
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=1024, hop_length=hop)[0]
    f0, voiced, _ = librosa.pyin(y, fmin=70, fmax=400, sr=sr, frame_length=1024, hop_length=hop)
    def frames(ms0, ms1):
        a, b = int(ms0 / 10), max(int(ms0 / 10) + 1, int(ms1 / 10))
        return a, b
    # per-word measurements
    meas = []  # (cid, i, tok, dB, f0_med, dur_ms)
    for c in cues:
        toks = visible_tokens(c["raw"])
        for w in words.get(c["id"], []):
            a, b = frames(w["startMs"], w["endMs"])
            seg = rms[a:b]
            if len(seg) == 0: continue
            db = 20 * np.log10(max(float(np.sqrt(np.mean(seg ** 2))), 1e-6))
            fseg = f0[a:b]; fseg = fseg[~np.isnan(fseg)] if fseg is not None else np.array([])
            fmed = float(np.median(fseg)) if len(fseg) >= 2 else None
            vf = float(np.mean(~np.isnan(f0[a:b]))) if b > a else 0.0
            cmed = float(np.median(cent[a:b])) if b > a else 0.0
            meas.append((c["id"], w["i"], toks[w["i"]], db, fmed, w["endMs"] - w["startMs"], vf, cmed))
    if not meas: print("no timed words"); return
    db_med = statistics.median(m[3] for m in meas)
    # per-speaker pitch medians (semitone domain)
    st = lambda f: 12 * np.log2(f / 100.0)
    by_spk = {}
    cent_med = statistics.median(m[7] for m in meas if m[7] > 0) if any(m[7] > 0 for m in meas) else 1.0
    def width_level(cm):
        if cm <= 0: return 0
        r = cm / cent_med
        return 1 if r <= 0.8 else -1 if r >= 1.2 else 0
    for cid, i, tok, db, fmed, dur, vf, cm in meas:
        if fmed: by_spk.setdefault(speaker_of.get(cid) or cid, []).append(st(fmed))
    spk_med = {k: statistics.median(v) for k, v in by_spk.items()}
    # per-character rate for elongation
    rates = [dur / max(1, len(re.sub(r"[^A-Za-z']", "", tok))) for _, _, tok, _, _, dur, _, _ in meas if dur > 0]
    rate_med = statistics.median(rates)
    out_words, out_cues = {}, {}
    def loud_level(d):
        r = d - db_med
        return -1 if r <= -5 else 0 if r < 3 else 1 if r <= 6 else 2
    for cid, i, tok, db, fmed, dur, vf, cm in meas:
        e = {"loud": loud_level(db), "loudDb": round(db - db_med, 1), "width": width_level(cm)}
        if fmed and vf >= 0.4:
            e["pitch"] = -1 if fmed < 160 else 1 if fmed > 200 else 0
        core = re.sub(r"[^A-Za-z']", "", tok)
        if len(core) >= 2 and dur > 2.2 * rate_med * len(core) and dur > 450 and vf >= 0.7:
            m = re.search(r"[aeiouyAEIOUY]+(?![aeiouyAEIOUY])", tok)
            if m:
                reps = min(4, int(dur / (rate_med * len(core))))
                e["stretch"] = tok[:m.end()] + tok[m.end()-1] * reps + tok[m.end():]
        out_words.setdefault(cid, {})[str(i)] = e
    # cue level: loud = median of its words; pace from vowel groups per second of speech
    pace_raw = {}
    for c in cues:
        ws = [m for m in meas if m[0] == c["id"]]
        if not ws: continue
        med_db = statistics.median(m[3] for m in ws)
        loud = loud_level(med_db)
        text = " ".join(visible_tokens(c["raw"]))
        syll = len(re.findall(r"[aeiouy]+", text.lower()))
        speech_ms = sum(m[5] for m in ws)
        pace_raw[c["id"]] = syll / max(0.2, speech_ms / 1000)
        out_cues[c["id"]] = {"loud": loud, "loudDb": round(med_db - db_med, 1), "width": width_level(statistics.median(m[7] for m in ws))}
    if pace_raw:
        pm = statistics.median(pace_raw.values())
        for cid, r in pace_raw.items():
            out_cues[cid]["pace"] = -1 if r < 0.7 * pm else 1 if r > 1.4 * pm else 0
    json.dump({"cues": out_cues, "words": out_words, "reference": {"dbMedian": round(db_med, 1), "charRateMs": round(rate_med, 1), "speakerPitchMedianSemitones": {k: round(v, 1) for k, v in spk_med.items()}}}, open(out, "w"), indent=2)
    print(f"delivery: {len(meas)} words, {len(out_cues)} cues -> {out}; dB median {db_med:.1f}, char rate {rate_med:.0f} ms")

if __name__ == "__main__":
    main()
