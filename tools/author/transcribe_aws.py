#!/usr/bin/env python3
"""
Amazon Transcribe as a second, independent measurement for the authoring pipeline.

  AWS_PROFILE=<profile> python3 tools/author/transcribe_aws.py <captions.en.vtt> <audio-16k-mono.wav> <outdir> \
      [--bucket <s3 bucket>] [--max-speakers 4] [--job <name>] [--from-json <saved transcribe result>] [--compare <words.json>]

What it does: uploads the scene audio to S3, runs a Transcribe job with speaker labels, downloads the result,
and turns it into the two proposal files the rest of the pipeline already understands:

  <outdir>/words-transcribe.json        align.py format: {"<cueId>": [{"i", "startMs", "endMs", "score", "status": "proposed"}]}
  <outdir>/diarization-transcribe.json  diarize.py format: per-cue speaker cluster, confidence, proposed speaker, agreement with <v> spans
  <outdir>/transcribe.json              the raw Transcribe result, kept for the record

The transcript Transcribe hears is never used as caption text. Each recognised word is matched, in order, to
the approved words of the cue whose time window contains it; only the timing and the speaker label carry over.
Everything is written as "proposed" (propose.py gates it, the review page is where a person confirms it).
--compare prints how far the Transcribe word onsets sit from another words.json (for example WhisperX), so the
two sources can be checked against each other. --from-json skips AWS and parses a saved result (offline tests).

Uses the aws CLI (no boto3), so the usual AWS_PROFILE / region settings apply. Cost: Transcribe bills per second
of audio; a one-minute scene is a fraction of a cent.
"""
import difflib, json, os, re, subprocess, sys, time, urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from align import parse_vtt, visible_tokens

def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default

def aws(*args, capture=True):
    r = subprocess.run(["aws", *args], capture_output=capture, text=True)
    if r.returncode != 0: raise SystemExit(f"aws {' '.join(args[:2])} failed: {r.stderr.strip()[:300]}")
    return r.stdout

def run_job(wav, bucket, job, max_speakers):
    key = f"transcribe/{job}.wav"
    print(f"== upload {wav} -> s3://{bucket}/{key}")
    aws("s3", "cp", wav, f"s3://{bucket}/{key}", "--only-show-errors")
    print(f"== start job {job} (en-US, speaker labels, up to {max_speakers} speakers)")
    aws("transcribe", "start-transcription-job", "--transcription-job-name", job, "--language-code", "en-US",
        "--media", f"MediaFileUri=s3://{bucket}/{key}", "--media-format", "wav",
        "--settings", f"ShowSpeakerLabels=true,MaxSpeakerLabels={max_speakers}")
    t0 = time.time()
    while True:
        st = json.loads(aws("transcribe", "get-transcription-job", "--transcription-job-name", job))["TranscriptionJob"]
        s = st["TranscriptionJobStatus"]
        if s == "COMPLETED":
            uri = st["Transcript"]["TranscriptFileUri"]; print(f"   completed in {time.time() - t0:.0f}s")
            return json.load(urllib.request.urlopen(uri))
        if s == "FAILED": raise SystemExit(f"job failed: {st.get('FailureReason')}")
        time.sleep(5)

def parse_result(res):
    """Flat word list [{w, s, e, conf, spk}] from a Transcribe result (pronunciation items only)."""
    r = res["results"]
    spk_at = {}
    for seg in r.get("speaker_labels", {}).get("segments", []):
        for it in seg.get("items", []): spk_at[it["start_time"]] = it["speaker_label"]
    words = []
    for it in r["items"]:
        if it.get("type") != "pronunciation": continue
        alt = it["alternatives"][0]
        words.append({"w": alt["content"], "s": float(it["start_time"]), "e": float(it["end_time"]),
                      "conf": float(alt.get("confidence", 0)), "spk": spk_at.get(it["start_time"])})
    return words

NUM = {"14": "fourteen", "10": "ten"}
def norm(tok):
    t = re.sub(r"[^a-z0-9']+", "", tok.lower().replace("’", "'"))
    return NUM.get(t, t)

def match_cues(cues, words, slack=1.0):
    """For each cue, align its approved tokens to the recognised words inside its window (plus slack) with a
    sequence matcher; matched tokens take the recognised word's times and confidence."""
    out, placed, total = {}, 0, 0
    for c in cues:
        toks = visible_tokens(c["raw"]); total += len(toks)
        lo, hi = c["startMs"] / 1000 - slack, c["endMs"] / 1000 + slack
        win = [w for w in words if w["s"] >= lo and w["e"] <= hi]
        a = [norm(w["w"]) for w in win]; b = [norm(t) for t in toks]
        entries = []
        for bl in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
            for k in range(bl.size):
                w = win[bl.a + k]; i = bl.b + k
                s = max(c["startMs"], min(int(round(w["s"] * 1000)), c["endMs"]))
                e = max(s, min(int(round(w["e"] * 1000)), c["endMs"]))
                entries.append({"i": i, "startMs": s, "endMs": e, "score": round(w["conf"], 3), "status": "proposed", "speaker": w["spk"]})
        entries.sort(key=lambda x: x["i"]); placed += len(entries)
        out[c["id"]] = entries
    return out, placed, total

def diarization(cues, matched, words):
    """diarize.py-shaped rows: the cue's cluster is the speaker label carrying most of its matched words
    (falling back to the words inside its window), confidence is that label's share."""
    rows = {}
    for c in cues:
        labels = [e["speaker"] for e in matched.get(c["id"], []) if e.get("speaker")]
        if not labels:
            labels = [w["spk"] for w in words if w["spk"] and w["s"] >= c["startMs"] / 1000 and w["e"] <= c["endMs"] / 1000]
        cnt = Counter(labels); best = cnt.most_common(1)[0][0] if cnt else None
        conf = cnt[best] / sum(cnt.values()) if best else 0.0
        m = re.search(r"<v\s+([^>]+)>", c["raw"]); voice = m.group(1).strip() if m else None
        rows[c["id"]] = {"cluster": best, "confidence": round(conf, 2), "voiceSpan": voice}
    votes = defaultdict(Counter)
    for r in rows.values():
        if r["voiceSpan"] and r["cluster"]: votes[r["cluster"]][r["voiceSpan"]] += 1
    mapping = {k: v.most_common(1)[0][0] for k, v in votes.items()}
    for r in rows.values():
        name = mapping.get(r["cluster"]) if r["cluster"] else None
        r["proposedSpeaker"] = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") if name else (r["cluster"].lower() if r["cluster"] else None)
    tagged = [r for r in rows.values() if r["voiceSpan"] and r["cluster"]]
    agree = sum(1 for r in tagged if mapping.get(r["cluster"]) == r["voiceSpan"])
    segs = []
    for w in words:
        if not w["spk"]: continue
        if segs and segs[-1][2] == w["spk"] and w["s"] * 1000 - segs[-1][1] < 800: segs[-1][1] = round(w["e"] * 1000)
        else: segs.append([round(w["s"] * 1000), round(w["e"] * 1000), w["spk"]])
    return {"speakersFound": len({w["spk"] for w in words if w["spk"]}), "cues": rows, "mapping": mapping,
            "agreement": {"agree": agree, "of": len(tagged)}, "segments": segs, "status": "proposed", "provenance": "amazon-transcribe"}

def compare(matched, other_path):
    other = json.load(open(other_path)); diffs = []
    for cid, entries in matched.items():
        o = {e["i"]: e for e in other.get(cid, [])}
        for e in entries:
            if e["i"] in o: diffs.append(abs(e["startMs"] - o[e["i"]]["startMs"]))
    if not diffs: print("compare: no words in common"); return {}
    diffs.sort(); n = len(diffs)
    stats = {"words": n, "medianMs": diffs[n // 2], "p90Ms": diffs[min(n - 1, int(0.9 * n))], "within50ms": sum(d <= 50 for d in diffs) / n}
    print(f"compare with {os.path.basename(other_path)}: {n} words in common, onset difference median {stats['medianMs']} ms, p90 {stats['p90Ms']} ms, {stats['within50ms']:.0%} within 50 ms")
    return stats

def main():
    pos = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and not sys.argv[i - 1].startswith("--")]
    if len(pos) < 3: raise SystemExit(__doc__)
    vtt, wav, outdir = pos[:3]; os.makedirs(outdir, exist_ok=True)
    cues = parse_vtt(vtt)
    if arg("--from-json"): res = json.load(open(arg("--from-json")))
    else:
        bucket = arg("--bucket") or os.environ.get("BUCKET")
        if not bucket:
            cfg = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "aws", "config.env")
            if os.path.exists(cfg):
                for line in open(cfg):
                    if line.startswith("BUCKET="): bucket = line.strip().split("=", 1)[1]
        if not bucket: raise SystemExit("no bucket: pass --bucket or run tools/aws/publish-media.sh first")
        job = arg("--job") or f"sightline-{os.path.basename(os.path.dirname(os.path.abspath(vtt)))}-{int(time.time())}"
        res = run_job(wav, bucket, job, int(arg("--max-speakers", "4")))
        json.dump(res, open(os.path.join(outdir, "transcribe.json"), "w"), indent=1)
    words = parse_result(res)
    matched, placed, total = match_cues(cues, words)
    json.dump({cid: [{k: v for k, v in e.items() if k != "speaker"} for e in es] for cid, es in matched.items()},
              open(os.path.join(outdir, "words-transcribe.json"), "w"), indent=2)
    dia = diarization(cues, matched, words)
    json.dump(dia, open(os.path.join(outdir, "diarization-transcribe.json"), "w"), indent=2)
    print(f"transcribe: {len(words)} words heard; {placed}/{total} approved tokens timed across {len(cues)} cues; "
          f"{dia['speakersFound']} voices, agreement with <v> spans {dia['agreement']['agree']}/{dia['agreement']['of']} -> {outdir}")
    if arg("--compare"):
        stats = compare(matched, arg("--compare"))
        json.dump(stats, open(os.path.join(outdir, "compare-transcribe.json"), "w"), indent=1)

if __name__ == "__main__":
    main()
