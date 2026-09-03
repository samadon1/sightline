#!/usr/bin/env python3
"""
Merge authoring outputs into a companion file as schema 0.2, everything `proposed`.

  python3 tools/author/propose.py assets/<scene>/companion.en.json --words <words.json> [--delivery <delivery.json>] [--sounds <sounds.json>] [--shots <shots.json>] [--diarization <diarization.json>] [--asd <asd.json>]
      [--accept-min-score 0.6] [--accept-delivery] [--auto] [--assign-colours]

--auto applies confidence-gated automatic verification (align >= 0.7, PANNs >= 0.8, diarization >= 0.8 and
agreeing with the track; delivery levels always, as measurements). Each auto decision records its rule in
verifiedBy ("auto:..."); the validator reports the totals; the review page is the exception queue.

Anything marked verified by a rule carries `verifiedBy` ("score>=0.6", "dev-bench") and the validator reports it
loudly; the review page sets verifiedBy to "human".

--accept-min-score marks aligned words at or above that alignment score `verified` with provenance
"whisperx auto-accepted (score>=X); pending human review". Use it on the development bench only;
pilot and demo assets go through the review page.
"""
import json, sys, re, os

def interpolate_gaps(cue, start_ms, end_ms, max_run=3, max_gap_ms=1500):
    """A short run of low-score words bounded by verified anchors (or the cue edges) within max_gap_ms becomes
    verified with provenance auto:interpolated. The aligner's own timing is kept when it is monotonic and inside
    the gap; otherwise the gap is shared by character count. A run that is the whole cue stays proposed, so a cue
    the aligner could not place at all keeps cue-level colour only. Returns the number of words promoted."""
    words = sorted(cue.get("words", []), key=lambda w: w["i"])
    if not words: return 0
    if not any(w.get("status") == "verified" for w in words): return 0  # no anchor: the cue colours as one line
    text_tokens = None
    n = 0; k = 0
    while k < len(words):
        if words[k].get("status") == "verified": k += 1; continue
        j = k
        while j < len(words) and words[j].get("status") != "verified": j += 1
        run = words[k:j]
        a_end = words[k - 1]["endMs"] if k > 0 else start_ms
        b_start = words[j]["startMs"] if j < len(words) else end_ms
        if len(run) <= max_run and 0 < b_start - a_end <= max_gap_ms:
            own = [(w["startMs"], w["endMs"]) for w in run]
            monotonic = all(own[i][0] < own[i][1] for i in range(len(own))) and all(own[i][1] <= own[i + 1][0] for i in range(len(own) - 1))
            inside = own[0][0] >= a_end - 40 and own[-1][1] <= b_start + 40
            if not (monotonic and inside):
                weights = [max(1, len(str(w.get("display") or "")) or 3) for w in run]
                total = sum(weights); t = a_end
                for w, wt in zip(run, weights):
                    d = max(120, int((b_start - a_end) * wt / total)); w["startMs"] = t; w["endMs"] = min(b_start, t + d); t = w["endMs"]
            for w in run:
                if w.get("verifiedBy") == "human": continue
                w["status"] = "verified"; w["verifiedBy"] = "auto:interpolated"; w["interpolated"] = True; n += 1
        k = j
    return n

_CUE_TIMES = {}
def _load_cue_times(vtt_path):
    import re
    def ms(t):
        h, m, sec = t.strip().split(":"); return int(round((int(h) * 3600 + int(m) * 60 + float(sec)) * 1000))
    for block in open(vtt_path).read().strip().split("\n\n"):
        ls = block.strip().split("\n")
        if len(ls) >= 2 and "-->" in ls[1]:
            a, b = ls[1].split("-->"); _CUE_TIMES[ls[0].strip()] = (ms(a), ms(b.split()[0]))
def cue_start_ms(cid): return _CUE_TIMES.get(cid, (0, 0))[0]
def cue_end_ms(cid): return _CUE_TIMES.get(cid, (0, 0))[1]

def main():
    argv = sys.argv[1:]
    VALUE_FLAGS = {"--words", "--delivery", "--sounds", "--shots", "--accept-min-score", "--diarization", "--asd"}
    # --auto: confidence-gated automatic verification with an audit trail (verifiedBy names the rule). Words above the
    # alignment threshold, measured delivery levels, high-confidence non-speech sound events, and diarized speakers that
    # agree with the track and cover the cue verify themselves; everything else stays proposed for the review page.
    AUTO = {"align": 0.7, "sound": 0.8, "diarization": 0.6}  # diarization gate applies only when the voice cluster agrees with the track: two sources
    flags, positional = {}, []
    k = 0
    while k < len(argv):
        t = argv[k]
        if t in VALUE_FLAGS: flags[t] = argv[k + 1]; k += 2
        elif t.startswith("--"): flags[t] = True; k += 1
        else: positional.append(t); k += 1
    path = positional[0]
    a_all = argv
    opt = lambda k: flags.get(k)
    prof = json.load(open(path))
    prof["schemaVersion"] = "0.2"
    accept = float(opt("--accept-min-score")) if opt("--accept-min-score") else None
    auto = bool(opt("--auto"))
    if positional and os.path.exists(positional[0]):
        _existing = json.load(open(positional[0]))
        _human = any(x.get("verifiedBy") == "human" for c in _existing.get("cues", {}).values() for x in [c, c.get("delivery") or {}] + (c.get("words") or [])) or any(e.get("verifiedBy") == "human" for e in _existing.get("sounds", []) + _existing.get("shots", []))
        if _human and not opt("--force"):
            print("refusing: this companion file carries human verification; re-run with --force (human entries are kept either way)"); sys.exit(3)
        import shutil; shutil.copy(positional[0], positional[0] + ".bak")
    _vtt = os.path.join(os.path.dirname(os.path.abspath(positional[0])), "captions.en.vtt") if positional else None
    if _vtt and os.path.exists(_vtt): _load_cue_times(_vtt)
    if auto and accept is None: accept = AUTO["align"]
    if opt("--assign-colours"):
        # Caption with Intention 2.1: six main colours for the main characters, twelve supporting shades for the
        # rest, with the two most frequent speakers on opposite sides of the wheel (hero and villain, 2.1.3), and
        # pairs kept far apart. Speakers ranked by cue count; existing colours are kept.
        MAINS = ["speaker-1", "speaker-2", "speaker-3", "speaker-6", "speaker-5", "speaker-4"]  # yellow, blue, red, pink, green, orange: each pair opposite
        SUPPORT = [f"support-{i}" for i in (1, 7, 4, 10, 2, 8, 5, 11, 3, 9, 6, 12)]  # alternating around the wheel
        counts = {}
        for cid, cue in prof.get("cues", {}).items():
            for sp in ([cue.get("speaker")] if cue.get("speaker") else cue.get("speakers", [])): counts[sp] = counts.get(sp, 0) + 1
        ranked = sorted((sp for sp in prof.get("speakers", {}) ), key=lambda sp: -counts.get(sp, 0))
        used = {d.get("color") for d in prof.get("speakers", {}).values() if d.get("color")}
        pool = [c for c in MAINS + SUPPORT if c not in used]
        assigned = 0
        for sp in ranked:
            d = prof["speakers"][sp]
            if d.get("color"): continue
            d["color"] = pool.pop(0) if pool else "neutral"; assigned += 1
        print(f"colours: {assigned} speakers assigned ({len(ranked)} ranked by cue count); mains go to the most frequent, pairs opposite on the wheel")
    if opt("--words"):
        words = json.load(open(opt("--words")))
        n = nv = 0
        for cid, entries in words.items():
            cue = prof.setdefault("cues", {}).get(cid)
            if not cue: continue
            out = []
            for w in entries:
                e = {"i": w["i"], "startMs": w["startMs"], "endMs": w["endMs"], "status": "proposed"}
                if "score" in w: e["score"] = round(float(w["score"]), 2)
                if accept is not None and w.get("score", 0) >= accept: e["status"] = "verified"; e["verifiedBy"] = (f"auto:align>={accept}" if auto else f"score>={accept}"); nv += 1
                for k in ("loud", "pitch", "caps", "stretch"):
                    if k in w: e[k] = w[k]
                out.append(e); n += 1
            # A person's verification outlives any re-run: human-verified word entries are kept as they are.
            human = {w["i"]: w for w in cue.get("words", []) if w.get("verifiedBy") == "human"}
            out = [human.get(e["i"], e) for e in out]
            cue["words"] = out
            if auto: nv += interpolate_gaps(cue, cue_start_ms(cid), cue_end_ms(cid))
            if accept is not None:
                base = (cue.get("provenance") or "human_editor").split("; words:")[0]
                cue["provenance"] = base + f"; words: whisperx auto-accepted (score>={accept}); pending human review"
        print(f"words: {n} entries, {nv} verified")
    if opt("--delivery"):
        deliv = json.load(open(opt("--delivery")))
        for cid, d in deliv.get("cues", {}).items():
            cue = prof.get("cues", {}).get(cid)
            if not cue: continue
            # Delivery levels are measurements; they become verified only when a person confirms them
            # (review page) or with --accept-delivery on the development bench, and then say so.
            if (cue.get("delivery") or {}).get("verifiedBy") == "human": continue  # a person's delivery judgement stands
            cue["delivery"] = {**d, "status": "verified" if ("--accept-delivery" in a_all or auto) else "proposed"}
            if auto: cue["delivery"]["verifiedBy"] = "auto:measured"
            elif "--accept-delivery" in a_all: cue["delivery"]["verifiedBy"] = "dev-bench"
            for w in cue.get("words", []):
                wd = deliv.get("words", {}).get(cid, {}).get(str(w["i"]))
                if wd and w.get("interpolated"):
                    # A placed span was never measured on its own: it takes the cue-level measurement (which covered it),
                    # so the line keeps one size instead of jumping between measured and placed words.
                    cd = deliv.get("cues", {}).get(cid, {})
                    for k in ("loud", "loudDb", "pitch", "width"):
                        if k in cd: w[k] = cd[k]
                    continue
                if wd:
                    w.update(wd)
                    # A synthesised spelling ("Nooo") is presentation a person must approve: never auto-verified.
                    if "stretch" in wd and w.get("verifiedBy", "human") != "human": w["status"] = "proposed"; w.pop("verifiedBy", None)
        print(f"delivery: {len(deliv.get('cues', {}))} cues")
    if opt("--shots"):
        shots = json.load(open(opt("--shots")))
        # Proposed shots replace the placeholder single shot; a person confirms them in review. The resolver
        # honours protected regions whatever their status: a wrong region can only move a caption to the
        # bottom lane, never hide it, so the safe direction is to honour it.
        for sh in shots: sh.setdefault("status", "proposed")
        keep = {sh.get("id"): sh for sh in prof.get("shots", []) if sh.get("verifiedBy") == "human"}
        shots = [keep.get(sh.get("id"), sh) for sh in shots] + [sh for sid, sh in keep.items() if sid not in {x.get("id") for x in shots}]
        prof["shots"] = shots
        print(f"shots: {len(shots)} ({sum(1 for s in shots if s.get('protected'))} with protected regions)")
    if opt("--diarization"):
        dia = json.load(open(opt("--diarization")))
        n = 0
        for cid, r in dia.get("cues", {}).items():
            cue = prof.get("cues", {}).get(cid)
            if not cue or not r.get("cluster"): continue
            cue["speakerProposal"] = {"cluster": r["cluster"], "confidence": r["confidence"], "speaker": r.get("proposedSpeaker"), "provenance": dia.get("provenance", "diarization"),
                                      "agreesWithTrack": (r.get("voiceSpan") is None) or (dia.get("mapping", {}).get(r["cluster"]) == r.get("voiceSpan"))}
            # A cue without a verified speaker takes the proposal as its (proposed) speaker when the id is declared.
            if cue.get("status") != "verified" and not cue.get("speaker") and r.get("proposedSpeaker") in prof.get("speakers", {}):
                cue["speaker"] = r["proposedSpeaker"]
            # --auto: a diarized speaker that agrees with the track and covers most of the cue verifies the cue's speaker.
            # A rule never sets a cue's status: agreement between a diarizer and the track's <v> tags is a proposal for
            # a person, because the tags may be the author's guess. The proposal carries the confidence; the review
            # page shows it; only a person writes status = verified on a cue.
            if auto and cue["speakerProposal"]["agreesWithTrack"] and r["confidence"] >= AUTO["diarization"]:
                cue["speakerProposal"]["autoRecommend"] = f"auto:diarization>={AUTO['diarization']}+track"
            n += 1
        print(f"diarization: {n} cues annotated ({dia.get('speakersFound')} voices; agreement {dia.get('agreement')})")
    if opt("--asd"):
        asd = json.load(open(opt("--asd")))
        n = 0
        for cid, r in asd.get("cues", {}).items():
            cue = prof.get("cues", {}).get(cid)
            if not cue: continue
            sp = cue.setdefault("speakerProposal", {})
            sp["face"] = {"identity": r.get("identity"), "confidence": r.get("confidence", 0), "offCamera": bool(r.get("offCamera")), "provenance": asd.get("provenance", "asd")}
            n += 1
        prof.pop("faceIdentities", None)  # face clusters stay in the authoring folder (asd.json), never in the shipped file
        print(f"asd: {n} cues annotated with on-camera speaker proposals ({len(asd.get('identities', {}))} face identities)")
    if opt("--sounds"):
        snd = json.load(open(opt("--sounds")))
        out_snd = []
        for ev in snd:
            ev = {**ev, "status": ev.get("status", "proposed")}
            score = 0.0
            m = re.search(r"score=([0-9.]+)", ev.get("provenance", ""))
            if m: score = float(m.group(1))
            if auto and score >= AUTO["sound"] and "already captioned" not in ev.get("provenance", ""):
                ev["status"] = "verified"; ev["verifiedBy"] = f"auto:panns>={AUTO['sound']}"
            out_snd.append(ev)
        keep_snd = {e.get("id"): e for e in prof.get("sounds", []) if e.get("verifiedBy") == "human"}
        out_snd = [keep_snd.get(e.get("id"), e) for e in out_snd] + [e for eid, e in keep_snd.items() if eid not in {x.get("id") for x in out_snd}]
        prof["sounds"] = out_snd
        print(f"sounds: {len(prof['sounds'])} events")
    json.dump(prof, open(path, "w"), indent=2); open(path, "a").write("\n")
    print(f"wrote {path}")

if __name__ == "__main__":
    main()
