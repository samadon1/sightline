"""Fit a continuous voice-over read to the demo's beats.

The read (a TTS or human take of docs/demo-voiceover.md) is transcribed once with word timestamps
(scratchpad/vo/words.json). Each beat lists the sentences to keep; this script finds their spans in the
read, lays them out in order (a clip never starts before its beat's picture, and never overlaps the
previous clip), reports the drift, and writes voice-plan.json for build-demo-video.py --voice, plus the
mixed audio track. Usage: python3 fit-voice.py <words.json> <timeline.json> <read.wav> <out-dir>"""
import json, re, sys, wave, array
words = json.load(open(sys.argv[1])); timeline = json.load(open(sys.argv[2])); WAV, OUT = sys.argv[3], sys.argv[4]
NUM = {"14": "fourteen", "10": "ten", "3": "three", "2": "two", "1": "one", "5": "five"}
norm = lambda t: [NUM.get(x, x).replace("colour", "color") for x in re.sub(r"[^a-z0-9]+", " ", t.lower()).split()]

# ---- the cut: sentences kept per beat, in the read's order. Everything not listed is dropped from the mix.
KEEP = {
 "title": ["This is Sightline.", "Captions for Fire TV that show who is speaking, how loud, and when."],
 "open": ["More than 430 million people live with hearing loss that affects their daily life.", "For many of them, the captions are the film."],
 "same": ["Captions have looked the same since the 1970s.", "Just words at the bottom of the screen."],
 "gaps": ['Which person said the line.', 'Whether it was a whisper or a shout.', 'And the moment each word is said.'],
 "mute": ["Try it.", "Turn your sound off.", "For the next fourteen seconds, this film is only what you can read."],
 "standard": [],
 "ask": ['Who was angry?', 'Was anyone shouting?', 'The words were all there, but the fight was hard to follow.'],
 "reveal": ['Sightline puts the missing parts back.'],
 "spk-card": ["Speaker-aware gives each speaker a name and a colour.", "Each word turns to that colour as it is said, on the speaker's side of the screen."],
 "speaker": ["Thom is on the left in cyan.", "Celia is on the right in yellow.", "Nothing here is drawn by the app.", "It is Fire TV's own caption renderer."],
 "det-card": ['Detailed goes further.', 'Louder words are bigger.', 'A line spoken from off camera is in italics, and sounds get a label.'],
 "detailed": ["This follows the Caption with Intention design system, built for Deaf and hard of hearing viewers, and it is on by choice, never by default."],
 "motion-card": ["Motion is there if you want it, and off by default."],
 "detailed-motion": ["Here it is on.", "The same words, the same colours, and a small lift on each word as the voice reaches it."],
 "set-card": ["All of this is your choice.", "Your choice is saved, and standard captions are always one press away."],
 "settings": ["Open the Captions sheet and pick a mode.", "The preview at the top shows what you will get, and the TV keeps your choice until you change it."],
 "how": ['None of this is guessed.', 'We measure the film, write down what we found, and a person checks it.'],
 "f-e2e": ["Five measurements run on every scene.", "One step merges them into proposals, and a person confirms them."],
 "f-spec": ['First, word timing.', 'We line the approved words up with the sound.'],
 "f-deliv": ["Then loudness and pitch, word by word, against the speaker's own normal.", 'These numbers set the size and the weight of the type.'],
 "f-voice": ['Here the model hears one voice across three lines that the caption file gives to two people.'],
 "f-face": ["Face detection marks where a caption must not go.", "A line that would cover a face moves to the bottom."],
 "f-ladder": ['And every check a line has to pass before it is enhanced.'],
 "f-sync": ['Word changes land within about ten milliseconds of the boundary, and no line was ever lost.'],
 "never": ['It never invents a caption.', 'It does not guess who is speaking, read emotions, or change a single approved word.'],
 "close": ["@Sightline.", "A Fire TV caption runtime, a package other apps can use, and an open file format."],   # @: take these words from the first time they were read (the close's own read of the name is garbled)
}

# ---- find each kept sentence in the read, in order (fuzzy: 70% of its words must match in sequence near the cursor)
wn = [norm(w["w"]) for w in words]; flat = [(i, t) for i, ts in enumerate(wn) for t in ts]
cursor = 0; MISSES = []
def find(sentence):
    global cursor
    if sentence.startswith("@"):
        saved, cursor = cursor, 0
        try: return find(sentence[1:])
        finally: cursor = saved
    """Greedy in-order match: each token may be found within the next three read words, or is skipped
    (the read may say color for colour, Tom for Thom, or drop a word). 70% of tokens must land."""
    toks = norm(sentence)
    import difflib
    for start in range(cursor, min(len(flat), cursor + 400)):
        win = [t for _, t in flat[start:start + len(toks) + 4]]
        blocks = [bl for bl in difflib.SequenceMatcher(None, win, toks, autojunk=False).get_matching_blocks() if bl.size]
        hits = sum(bl.size for bl in blocks)
        if blocks and blocks[0].a <= 1 and hits >= max(1, round(0.7 * len(toks))):
            first = start + blocks[0].a; last = start + blocks[-1].a + blocks[-1].size - 1
            cursor = last + 1
            return words[flat[first][0]]["s"], words[flat[last][0]]["e"]
    MISSES.append(sentence); return None

if MISSES:
    full = " ".join(w["w"] for w in words)
    for m in MISSES:
        key = norm(m)[1] if len(norm(m)) > 1 else norm(m)[0]; i = full.lower().find(key)
        print("MISS:", m, "\n   read:", full[max(0, i - 60): i + 90] if i >= 0 else "(no anchor)")
GAP, LEAD, PAD = 0.35, 0.15, 0.45
MIN = {"reveal": 3.5, "f-e2e": 5.0, "f-spec": 4.5, "f-deliv": 4.5, "f-voice": 4.5, "f-face": 4.5, "f-ladder": 4.5, "f-sync": 4.5}
FIXED = {"standard": 14.0, "speaker": 12.0, "detailed": 9.0, "detailed-motion": 7.0, "settings": 8.0}
plan = {"beats": {}}; clips = []; t_prev_end = 0.0; report = []; t = 0.0
for b in timeline:
    name = b["name"]; kept = KEEP.get(name, [])
    spans = [sp for sp in (find(x) for x in kept) if sp]
    merged = []
    for s0, e0 in spans:
        if merged and s0 - merged[-1][1] < 0.6: merged[-1][1] = e0
        else: merged.append([s0, e0])
    speech = sum(e - s_ for s_, e in merged) + 0.25 * max(0, len(merged) - 1)
    seconds = FIXED.get(name) or max(MIN.get(name, 0), round(LEAD + speech + PAD, 1))
    if name in FIXED and merged and LEAD + speech + PAD > seconds: seconds = round(LEAD + speech + PAD, 1)
    start = t; pos = max(start + LEAD, t_prev_end + GAP); first = pos
    for s0, e0 in merged:
        clips.append((pos, s0, e0)); pos += (e0 - s0) + 0.25
    if merged: pos -= 0.25; t_prev_end = pos
    report.append((name, start, seconds, round(first - start if merged else 0, 2), round(speech, 2)))
    plan["beats"][name] = {"text": " ".join(x.lstrip("@") for x in kept), "seconds": seconds}
    t += seconds
timeline = [{"name": r[0], "start": r[1], "end": r[1] + r[2]} for r in report]
print(f"{'beat':16}{'start':>7}{'len':>6}{'drift':>7}{'speech':>8}")
for r in report: print(f"{r[0]:16}{r[1]:7.1f}{r[2]:6.1f}{r[3]:7.2f}{r[4]:8.2f}")
print(f"last clip ends {t_prev_end:.1f}s; picture ends {t:.1f}s")
if MISSES: raise SystemExit(f"{len(MISSES)} sentence(s) not found; fix KEEP")
json.dump(plan, open(OUT + "/voice-plan.json", "w"), indent=1)
# ---- mix: copy each clip into a silent track of the picture's length, 10 ms fades at each cut
w = wave.open(WAV); sr, n = w.getframerate(), w.getnframes(); src = array.array("h", w.readframes(n)); w.close()
total = int(timeline[-1]["end"] * sr) + sr; out = array.array("h", [0]) * total; fade = int(0.01 * sr)
for pos, s0, e0 in clips:
    a, b_ = int(s0 * sr), int(e0 * sr); seg = src[a:b_]; L = len(seg)
    for i in range(min(fade, L)): seg[i] = int(seg[i] * i / fade); seg[L - 1 - i] = int(seg[L - 1 - i] * i / fade)
    p = int(pos * sr); out[p:p + L] = seg
ow = wave.open(OUT + "/voice-mix.wav", "w"); ow.setnchannels(1); ow.setsampwidth(2); ow.setframerate(sr); ow.writeframes(out.tobytes()); ow.close()
print("wrote", OUT + "/voice-plan.json", OUT + "/voice-mix.wav")
