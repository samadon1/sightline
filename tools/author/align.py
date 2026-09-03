#!/usr/bin/env python3
"""
Forced alignment of an approved WebVTT track to the audio, producing schema 0.2 word timings.

  venv-author/bin/python tools/author/align.py <captions.en.vtt> <audio-16k-mono.wav> <out.words.json> [--offset-ms N]

The transcript is taken from the caption file (canonical text), never from ASR. WhisperX's
wav2vec2 alignment model places each visible token in time. Output: {"<cueId>": [{"i", "startMs",
"endMs", "score"}...]} with every entry status "proposed" (the review step verifies). Tokens the
aligner cannot place are omitted; the runtime renders them plainly.

The tokeniser must match packages/core normalize.visibleTokens: strip <v>/<c>/<i>/<b> tags, split on
whitespace. Keep the two in step.
"""
import json, re, sys, html

def parse_vtt(path):
    cues, cur = [], None
    lines = open(path, encoding="utf-8").read().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        m = re.match(r"(?:(\d+):)?(\d\d):(\d\d)\.(\d{3})\s+-->\s+(?:(\d+):)?(\d\d):(\d\d)\.(\d{3})", line)
        if m:
            cid = lines[i-1].strip() if i > 0 and lines[i-1].strip() and "-->" not in lines[i-1] else None
            h1, m1, s1, ms1, h2, m2, s2, ms2 = m.groups()
            start = (int(h1 or 0)*3600 + int(m1)*60 + int(s1))*1000 + int(ms1)
            end = (int(h2 or 0)*3600 + int(m2)*60 + int(s2))*1000 + int(ms2)
            text = []
            i += 1
            while i < len(lines) and lines[i].strip():
                text.append(lines[i]); i += 1
            raw = "\n".join(text)
            if cid: cues.append({"id": cid, "startMs": start, "endMs": end, "raw": raw})
        i += 1
    return cues

def visible_tokens(raw):
    t = re.sub(r"<[^>]+>", "", raw)
    t = html.unescape(t)
    return [w for w in re.split(r"\s+", t.strip()) if w]

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    offset = 0
    if "--offset-ms" in sys.argv: offset = int(sys.argv[sys.argv.index("--offset-ms")+1])
    vtt, wav, out = args[:3]
    import whisperx, torch
    device = "cpu"
    cues = parse_vtt(vtt)
    audio = whisperx.load_audio(wav)
    model_a, meta = whisperx.load_align_model(language_code="en", device=device)
    segments = [{"start": (c["startMs"]+offset)/1000.0, "end": (c["endMs"]+offset)/1000.0, "text": " ".join(visible_tokens(c["raw"]))} for c in cues]
    result = whisperx.align(segments, model_a, meta, audio, device, return_char_alignments=False)
    # WhisperX may split a segment at sentence punctuation, so do not pair output segments with cues.
    # It preserves word order and count, so walk one flat word list against the flat token list.
    flat_words = [w for seg in result["segments"] for w in seg.get("words", [])]
    flat_tokens = [(c, i, tok) for c in cues for i, tok in enumerate(visible_tokens(c["raw"]))]
    if len(flat_words) != len(flat_tokens):
        # A count mismatch would shift every later token by one. Re-align cue by cue instead, and drop any
        # cue whose own count still disagrees, so a bad cue costs its own timings and nothing else.
        print(f"warning: aligner returned {len(flat_words)} words for {len(flat_tokens)} tokens; re-aligning cue by cue", file=sys.stderr)
        flat_words = []; kept_tokens = []
        for c in cues:
            toks = visible_tokens(c["raw"])
            seg = [{"start": (c["startMs"]+offset)/1000.0, "end": (c["endMs"]+offset)/1000.0, "text": " ".join(toks)}]
            r1 = whisperx.align(seg, model_a, meta, audio, device, return_char_alignments=False)
            ws = [w for sg in r1["segments"] for w in sg.get("words", [])]
            if len(ws) != len(toks):
                print(f"  cue {c['id']}: {len(ws)} aligned words for {len(toks)} tokens; timings dropped for this cue", file=sys.stderr); continue
            flat_words.extend(ws); kept_tokens.extend((c, i, tok) for i, tok in enumerate(toks))
        flat_tokens = kept_tokens
    words_by_cue = {c["id"]: [] for c in cues}
    placed = total = 0
    for (c, i, tok), w in zip(flat_tokens, flat_words):
        total += 1
        if "start" in w and "end" in w:
            placed += 1
            e = {"i": i, "startMs": int(round(w["start"]*1000)) - offset, "endMs": int(round(w["end"]*1000)) - offset,
                 "score": round(float(w.get("score", 0)), 3), "status": "proposed"}
            e["startMs"] = max(c["startMs"], min(e["startMs"], c["endMs"]))
            e["endMs"] = max(e["startMs"], min(e["endMs"], c["endMs"]))
            words_by_cue[c["id"]].append(e)
    total = len(flat_tokens)
    json.dump(words_by_cue, open(out, "w"), indent=2)
    print(f"aligned {placed}/{total} tokens across {len(cues)} cues -> {out}")

if __name__ == "__main__":
    main()
