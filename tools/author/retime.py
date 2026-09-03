#!/usr/bin/env python3
"""
Re-time a WebVTT track so it meets the reading-rate rule (BBC guidance: at most 180 words per minute and
at least 0.3 s per word) wherever the gaps allow, without changing a single word.

  python3 tools/author/retime.py <captions.en.vtt> [--apply] [--gap-ms 80] [--max-wpm 180] [--min-s-per-word 0.3]

For each cue that reads too fast, the end time is extended into the following gap (keeping `gap-ms`
before the next cue) up to the duration the rule needs; if the gap is not enough, the start is pulled
earlier into the preceding gap. Cues that still fail are listed for a person. Text and ids are untouched,
so text hashes and companion files remain valid; word timings stay inside their cues because cues only grow.
"""
import re, sys

def parse(path):
    lines = open(path, encoding="utf-8").read().split("\n")
    cues = []; i = 0
    while i < len(lines):
        m = re.match(r"(?:(\d+):)?(\d\d):(\d\d)\.(\d{3})\s+-->\s+(?:(\d+):)?(\d\d):(\d\d)\.(\d{3})(.*)$", lines[i])
        if m:
            t = lambda h, mi, s, ms: (int(h or 0) * 3600 + int(mi) * 60 + int(s)) * 1000 + int(ms)
            j = i + 1; body = []
            while j < len(lines) and lines[j].strip(): body.append(lines[j]); j += 1
            cues.append({"line": i, "start": t(*m.groups()[:4]), "end": t(*m.groups()[4:8]), "tail": m.group(9), "words": len(re.sub(r"<[^>]+>", "", " ".join(body)).split())})
            i = j
        else: i += 1
    return lines, cues

def fmt(ms):
    h, r = divmod(ms, 3600000); mi, r = divmod(r, 60000); s, ms = divmod(r, 1000)
    return f"{h:02d}:{mi:02d}:{s:02d}.{ms:03d}"

def main():
    argv = sys.argv[1:]; VALUE = {"--gap-ms", "--max-wpm", "--min-s-per-word"}
    flags, positional = {}, []; k = 0
    while k < len(argv):
        if argv[k] in VALUE: flags[argv[k]] = argv[k + 1]; k += 2
        elif argv[k].startswith("--"): flags[argv[k]] = True; k += 1
        else: positional.append(argv[k]); k += 1
    path = positional[0]; apply = "--apply" in flags
    gap = int(flags.get("--gap-ms", 80)); max_wpm = float(flags.get("--max-wpm", 180)); min_spw = float(flags.get("--min-s-per-word", 0.3))
    lines, cues = parse(path)
    changed = 0; still = []
    for k, c in enumerate(cues):
        need = max(c["words"] / max_wpm * 60000, c["words"] * min_spw * 1000)
        dur = c["end"] - c["start"]
        if dur >= need: continue
        nxt = cues[k + 1]["start"] if k + 1 < len(cues) else c["end"] + 10_000_000
        prv = cues[k - 1]["end"] if k > 0 else 0
        # Only ever grow a cue: never shrink an end that already touches the next cue.
        new_end = max(c["end"], min(nxt - gap, c["start"] + int(need + 0.5)))
        new_start = c["start"]
        if new_end - new_start < need:
            # Only ever grow: a start may move earlier into the preceding gap, never later.
            new_start = min(c["start"], max(prv + gap, new_end - int(need + 0.5)))
        if (new_end, new_start) != (c["end"], c["start"]):
            c["end"], c["start"] = new_end, new_start; changed += 1
        if c["end"] - c["start"] < need - 1: still.append((k, c))
    for c in cues: lines[c["line"]] = f"{fmt(c['start'])} --> {fmt(c['end'])}{c['tail']}"
    print(f"{path}: {changed} cues re-timed, {len(still)} still too fast for the rule")
    for k, c in still: print(f"  cue #{k+1} {fmt(c['start'])}-{fmt(c['end'])}: {c['words']} words in {(c['end']-c['start'])/1000:.2f} s ({c['words']/((c['end']-c['start'])/60000):.0f} wpm); no room either side")
    if apply: open(path, "w", encoding="utf-8").write("\n".join(lines)); print("written")

if __name__ == "__main__":
    main()
