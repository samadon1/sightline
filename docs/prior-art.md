# Prior art and what we reuse (September 2, 2026)

Written after Samuel asked whether we had actually studied Caption with Intention and Google's Expressive Captions before building. We had not, properly. This is the correction: what each source specifies, what is reusable, and what changes in our plan.

## 1. Caption with Intention (CI) — the design system we should implement to the letter

Source: Design System V1.0 PDF (54 pages), After Effects template, Roboto Flex font, all downloaded from captionwithintention.org (scratchpad copies; "All Rights Reserved" on the PDF, "free design system" on the site; no code exists, and page 53 says an AI-based system "will be deployed as open-source" once developed, so our runtime would be among the first software implementations). Chicago Hearing Society with the Academy's RAISE programme.

Rules we adopt verbatim:

| Topic | CI rule | Our previous choice | Change |
|---|---|---|---|
| Main character colours | Six: Yellow E5E517, Blue 17E5E5, Red E51717, Orange E58017, Green 17E517, Pink E517E5. Hero and villain opposite on the wheel; three mains spaced as far apart as possible | Our own palette (speaker-1..4) | Adopt CI palette as `speaker-1..6`; keep tokens so the viewer's own colour still wins |
| Supporting characters | Twelve shades between the mains (E85C2E, EBC247, C2EB47, 82ED5E, 47EB70, 5EEDC9, 47C2EB, 5E82ED, 8C6BED, CC6BED, EB47C2, ED5E82) | none | Add `support-1..12` |
| Minor characters | HSB(hue, 30%, 90%) pastels | none | Add `minor` token family |
| Off-camera | Italic type | UNKNOWN VOICE label + lane | Overlay: italic for off-screen; native path cannot italicise (FL-022), so the label stays there |
| Read-ahead | Whole line first in white at 90% opacity; words take the character colour at word onset ("In" of "inexplicable", not "ble") | Same idea, implemented | Set read-ahead to white 90%; colour at word start (we already do) |
| Motion | Each word pops +15% size (25% elevation) as it colours | None (reduced motion) | Keep off under Reduced motion (default); offer as the only motion when Reduced motion is off |
| Syllable variation | Optional per-syllable colouring | none | Defer |
| Type | Roboto Flex (variable: weight, width, slant, optical size) | System font | Bundle Roboto Flex in the app (font licence: SIL OFL); fall back to system font if Vega cannot load it |
| Baseline size | 5% of screen height for normal volume | 60 px at 1080 (5.6%) | Set 5% |
| Size range (volume) | 3% (whisper) to 12% (yell) of screen height, anywhere in between | 0.85–1.3× | Map loudness to 3%–12%, quantised for now |
| Weight (pitch) | 160–200 Hz → Regular 400; lower voices heavier and wider; higher voices lighter and condensed; harmonics drive width | 400/500/700 | Weight from measured f0 band: <160 Hz heavier, >200 Hz lighter; width from the spectral centroid band (darker voice → wide, brighter → narrow); nine static instances because the platform ignores variable fonts |
| Captions box | 90% black; text may break out of the box for very loud or sudden bursts | 80% | Set 90%; "break out" deferred |
| Box lines | Box splits per line, at most two lines on screen | our lanes | Keep lanes (CI has none: it is bottom-only); cap at two lines |
| Work area | Lower 20% of the frame with 5% / 2.5% / 5% / 7.5% margins (see p. 45) | our lane geometry | Align the bottom lane to this geometry; side lanes are our extension |
| Sound effects | White, in brackets, still sized by loudness and "pop" in sync with the sound | white brackets, direction marker | Add loudness sizing for sound cues; keep direction marker |
| Music | ♫ on either side, white, not animated | none | Add ♫ rule for music cues |
| Exceptions | Black-and-white or period films: colour off, animation only, editor's call | modes | Already a mode/toggle |
| Standards | CI augments closed captions, never replaces them | our fallback principle | Same; cite CI p. 52 |

## 2. Google Expressive Captions (Android Live Caption)

Closed, on-device, live, US English. Nothing to download. Behaviours to mirror in authored form: capitals for intensity, lengthened words ("Noooooo"), and sound labels (laughter, applause, music, later whispering, throat clearing). All three exist in our schema 0.2 as verified word/sound metadata. Difference we keep: theirs is live inference; ours is offline measurement plus a human check.

## 3. Research with Deaf and hard-of-hearing participants (what the studies say)

- **Caption Royale** (de Lacerda Pataca et al., CHI 2024, 39 DHH participants, CC BY-NC preprint): of nine typographic modulations, **font colour** won for valence and **font colour with font weight** or **font size** won for arousal; shadow colour, opacity, letter spacing, baseline shift and an "emotional typeface" were rejected as hard to read. In the performance study, colour+weight and colour+size beat the plain baseline on emotion recognition; colour+weight had lower cognitive load, colour+size read as more expressive but more distracting. All styled captions scored lower than baseline on ease of reading, so the recommendation is to offer them as options with adjustable ranges. Pipeline: Gentle forced alignment, per-word audio slices, transformer emotion model. This validates our choices (colour, weight, size) and our toggles, and tells us not to use shadow, opacity or spacing tricks.
- **Visualization of Speech Prosody and Emotion in Captions** (CHI 2023) and **Visible Nuances** (CHI 2023): prosody-driven typography for DHH viewers; participants preferred an emotion-based model over prosody alone; font weight favoured for intense utterances.
- **Automatically Generated Emotive Captions** (CHI EA 2023): three schemas mapping audio emotion models to typography or colour.
- **"Choices? That's the dream"** (Frontiers 2025): DHH viewers want choice in non-speech information captioning — our modes.
- **CapTune** (arXiv 2508.19971, 2025): adapting non-speech captions with generative models; relevant to sound labels.
- Google's own Expressive Captions and CI both cite this line of work.

## 4. Platform facts we tested today

- Fire TV's native renderer honours `<c.yellow>`-style WebVTT class colours but ignores `<b>`, `<i>`, `<u>` and karaoke timestamp tags (FL-022). So Speaker-aware can get CI colour attribution natively, and even word colouring by splitting cues at word boundaries (with native event lag). Italic for off-camera is overlay-only.

## 5. Tools we reuse instead of writing

| Need | Reuse | Status |
|---|---|---|
| Word timing | WhisperX (wav2vec2 forced alignment) against the approved text | In use (tools/author/align.py) |
| Loudness, pitch | librosa RMS and pyin | In use (tools/author/delivery.py); thresholds to be replaced by CI's dB→size and Hz→weight mappings |
| Sound events | BEATs or CLAP (AudioSet tagging) through `audiotimm`; PANNs/YAMNet for framewise detection | To add (tools/author/sounds.py) |
| Review page | wavesurfer.js regions in a local HTML page, not a bespoke editor | To add |
| Typeface | Roboto Flex from CI's download (SIL OFL) | To bundle |
| Playback | Vega-patched Shaka, Fire TV native renderer | In use |
| Design rules | CI Design System V1.0 | Adopted as the rulebook for Detailed mode |

## 6. What remains ours

The runtime that applies these rules on a TV against an approved, hash-locked caption file with per-feature fallback, the companion schema, the resolver, and the measurement method. CI explicitly asks for this technology (p. 50: current caption decoders cannot support it, so studios burn captions in).

## 7. What the After Effects template actually animates (read from its expressions, September 2)

The `.aep` is binary, but its expressions are plain text. The word animation is built from three text animators driven by two layer markers (START, END) per line:

- **Colour sweep ("Words" animator, fillColor):** a range selector whose end advances from 0 to the number of words between the markers with `ease(time, inTime, outTime, 0, textLenWords)`; a second variant uses `easeOut` with a one-frame anticipation. So in the template the reveal is a constant-rate sweep between two marks, softened by the selector's ease settings ("Text Levels Min/Max Ease"). Our runtime has per-word timings, which is strictly better data for the same effect.
- **Pop ("Up" animator, position):** a one-word-wide range (`start + 1`) whose y offset is `-amp` from a "Control_Null" slider, driven with a four-frame anticipation, so the lift leads the colour change by about three frames (~125 ms at 24 fps). The design system describes the same moment as a 15% size increase with 25% elevation.
- **Box:** the box layer sizes itself from `sourceRectAtTime` with 20 px padding (×3 horizontally, ×2 vertically) and follows the text.

The reference clip in the download is the clean plate, not a rendered example. Implementation choices for the runtime: per-word elements so a single word can lift and scale; lift 25% of the type size and scale 1.15 at word onset, easing back over the word's duration (capped at 300 ms); colour crossfades from read-ahead white to the character colour over about 120 ms; the lift starts 40 ms before the word. All of it only when Reduced motion is off. With Reduced motion on, the colour changes at word onset and nothing moves.

## 8. Timing, reading speed and placement: what the guidance and studies say (September 2, evening)

- **Sync tolerance.** Reported thresholds: a 300 ms caption delay already raises early drop-off in short-form viewing; a 2022 industry survey put 67% of viewers calling misaligned captions "very distracting"; work cited from KU Leuven claims comprehension gains in fast material when lag stays under 100 ms, and about 50 ms is described as imperceptible for nearly everyone. Broadcast guidance for live subtitling treats synchronisation delay as a direct quality loss for Deaf viewers. Consequence for us: the native path's raw 125 ms median was on the wrong side of the 100 ms line, which is why the 120 ms lead compensation went in today (docs/sync-report.md); the overlay path sits at single-digit milliseconds to commit.
- **Reading speed and duration.** BBC subtitle guidelines: 160–180 words per minute, and a minimum of about 0.3 s on screen per word (1.2 s for a four-word subtitle). Our validator does not check reading rate yet; a warning for cues over 180 wpm or under 0.3 s per word belongs in `validate` (added to the backlog).
- **Placement.** Guidance for Deaf and hard-of-hearing viewers puts captions near the bottom and off faces; misplaced captions covering the speaker's face are the most cited failure. That is what the protected-region mechanism is for, and today's face detector (tools/author/faces.py, YuNet) proposes those regions per shot so a person no longer has to draw them.
- **Speaker identification.** Amin et al. (2023) compared speaker-identifier types for live TV with DHH viewers; Caption Royale (CHI 2024) found colour the most preferred valence cue. We use colour plus a label plus a lane, so identification never rests on colour alone.

Sources: BBC Subtitling Guidelines (via Clevercast summary), Artlangs and Syncora timing notes citing the 2022 survey and the KU Leuven work, Springer "Synchro-Sub" (2023) on live-subtitle synchronisation quality, NIDCD and Southeast ADA Center caption guidance, Makeability Lab AR captioning. The sync figures are industry reports rather than peer-reviewed thresholds and are used as direction, not as claims.

## 9. Audit against the design system, end of September 2

Implemented: palette (mains, supports, minor pastel function), colour assignment by frequency with opposite pairs (`propose.py --assign-colours`), off-camera italics, read-ahead white 90%, colour at word onset, word pop (Reduced motion off), Roboto Flex in nine static instances, 5% baseline, 3–12% by measured loudness per word, weight by pitch band, width by harmonics, 90% box, two-line cap, lower-20% work area, sound effects white and sized, ♫ for music, the exceptions as toggles, coexistence with closed captions (fallback). Later the same evening: syllable-level colouring (2.2.2) implemented and seen on device; box break-out for shouted words (2.4.1) implemented but not yet seen, because no verified word in the demo data reaches the shouted level. Every device in the design system now has an implementation.
