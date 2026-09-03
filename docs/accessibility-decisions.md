# Accessibility decisions

This page records every accessibility decision in the prototype and the reason for it. Some of these are engineering rules that hold regardless of user feedback. Others are hypotheses that the DHH pilot exists to test, and they are marked as such. The last section lists what has not been tested.

## 1. The canonical text is immutable

The WebVTT file is the source of truth for cue id, timing, visible text, order, standard speaker identification, and essential non-speech text. No mode edits, adds, or removes caption text. The companion file can only add context around a cue.

Enforcement: each companion entry carries a SHA-256 hash of the cue's normalized visible text. If the hash does not match, the enhancement for that cue is ignored and the canonical cue renders as normal. The parser keeps `rawText` byte for byte and never rewrites it. Unit tests cover both ("raw text is never rewritten", "stale hash removes the enhancement, never the text").

Reason: wrong or altered words are the most harmful failure a caption system can have. Everything else in the design is allowed to fail; this is not.

## 2. Standard is always available and one action away

Standard mode is conventional bottom captions drawn by the TV's own renderer. It is the fair comparator, the emergency fallback, the guaranteed mode, and the path when no companion file exists. A "Use Standard captions" button appears in the settings panel and on the end-of-scene card and returns to Standard in one press.

Reason: a viewer who dislikes or cannot read an enhanced mode must never be stuck in it, and must not have to find a menu to escape.

## 3. The system caption settings are authoritative

Vega exposes the viewer's caption settings through `kepler-a11y-settings-interface-turbo` (`CaptioningProps`: text size, colour, font, edge style, opacity, background colour and opacity, window colour and opacity). They are read-only for third-party apps.

- Standard and Speaker-aware are drawn by `KeplerCaptionsView`, so they inherit every system setting automatically. This is the main reason Level 2 stays native.
- Detailed is a custom overlay and must apply the settings itself. It currently applies `textSize`, `textColor`, `textBackgroundColor`, `textBackgroundOpacity`, and `textEdgeStyle`. It also applies `textFont` (a viewer-chosen family replaces Roboto Flex) and the window background colour and opacity (September 2).
- The viewer's colour choice overrides the speaker colour. If the viewer has set a caption text colour, the overlay uses that colour for every speaker and drops the palette. Labels and lanes remain.
- The runtime subscribes to preference changes and rebuilds the cue set when they change, so a size change also re-runs lane safety.

Reason: the viewer configured those settings for a reason, and a caption product that ignores them is worse than one that adds nothing.

## 4. No colour-only speaker cues

A speaker is never identified by colour alone. Colour appears only in Detailed mode, and only in addition to a text label and a stable lane. If colour is unavailable (native levels, viewer override, renderer without colour support) the label and lane stay.

Reason: WCAG 1.4.1. Colour vision differences, TV colour-correction modes, and viewer colour overrides all make colour unreliable on its own.

## 5. The speaker palette differs in lightness, not only hue

The speaker tokens in `apps/vega-player/src/theme.ts` are the Caption with Intention palette: six main colours and twelve supporting shades (red lightened to pass 4.5:1), with `neutral` as white. This has not been checked against Vega's colour-correction modes on a device; that is an open item.

## 6. No motion during a cue; reduced motion defaults on

- No caption moves while it is showing. There is no face following, no bouncing, spinning, or scaling.
- Lane changes happen only between cues or shots, as cuts.
- Static emphasis in Detailed (weight or underline on a marked word) does not shorten reading time and does not animate.
- Word-by-word reveal: implemented on September 2 (colour at word onset in Speaker-aware and Detailed; the lift-and-scale pop only with Reduced motion off). Earlier text on this line said it was the first thing to cut; the design system and the research made it the first thing to build instead.
- Reduced motion is an in-app setting that defaults on. Vega has no system reduce-motion setting to inherit, so the app has to carry a safe default itself. In P0 nothing animates either way; the setting exists so the default is explicit and so any future presentation option has to earn its way past it.

Reason: WCAG 2.3.3 (animation from interactions) and 2.2.2 (moving content), and prior research that found head-following captions distracting.

## 7. Label frequency rule (hypothesis for the DHH pilot)

A label on every cue adds reading load. Netflix and BBC conventions label on speaker change. The prototype implements a deterministic rule in `packages/core/src/labels.ts`, exposed as configuration so it can be changed without touching the resolver. A label is shown when any of these is true:

- first cue of a speaker's run (no previous non-sound cue, or a different speaker)
- the speaker changed
- the same speaker returns after a gap of at least 4 seconds
- two speakers overlap in time
- first cue after a shot change
- the speaker is off-screen or not visually identifiable (generic label in use)
- the label changes from generic to named because the reveal time has passed
- the prior cue fell back in a way that removed speaker context

Within an uninterrupted same-speaker run the label is not repeated; colour and lane carry continuity.

This rule is recorded as a design hypothesis, not a finding. The pilot's session script asks directly whether labels felt useful or repetitive, and the config also supports a "label every cue" comparison. The rule will be revised on what participants say.

## 8. Reveal policy and generic labels

Each speaker in the companion file may carry a `genericLabel` and a `revealAtMs`. Before the reveal time, every cue attributed to that speaker shows the generic label (`UNKNOWN VOICE`, `WOMAN ON PHONE`, `RADIO`, and so on). Nothing is renamed retroactively after the reveal. The runtime never infers a name.

In "The Envelope", `amara` is `UNKNOWN VOICE` until 30 s, and the Standard track uses `[unknown voice]` for the same reason. Where the canonical text already carries a bracketed id that matches the label, the enhancement label is suppressed so the id is not shown twice.

Reason: DHH viewers have reported premature speaker-name reveals as spoilers (May et al. 2025). A caption runtime should not know more than the audience is meant to.

## 9. Sound text is canonical; direction is only an enhancement

Essential sounds (`[glass shatters]`) are authored into the WebVTT track by the captioner and appear in every mode. The companion file may add a verified direction (`left`, `right`, `center`), which Detailed mode shows as a small arrow and, where safe, a side lane. If the directional placement is unsafe or unverified, the sound caption stays and renders bottom-center. The sound is never removed.

Not every incidental sound is captioned; the text is human-authored to the style guide in `docs/content/captioning-style-notes.md`.

## 10. Contrast target and Detailed overlay defaults

Target: at least 4.5:1 text-to-background contrast wherever the app controls the colours (WCAG 1.4.3). The Detailed overlay defaults are white text on a black background at 90% opacity, with the label in the speaker colour at 0.8 of the dialogue size. Viewer background and opacity settings replace these defaults when set.

Contrast, computed (WCAG relative luminance, text over the 90% black box with white video behind it, September 3): speaker-1 12.95, speaker-2 11.14, speaker-3 4.95, speaker-4 6.19, speaker-5 10.21, speaker-6 4.65; support-1 5.00, support-2 10.28, support-3 12.72, support-4 11.85, support-5 11.15, support-6 12.02, support-7 8.48, support-8 4.91, support-9 4.53, support-10 5.74, support-11 5.18, support-12 5.43; read-ahead white at 90% 14.28. All pass 4.5:1. Speaker-6 and support-9 sit within 4% of the threshold. A viewer who lowers the text background opacity to 75% takes pink to about 2.8:1; that is their setting and it is honoured. Not yet measured with an instrument on a television.

## 11. TV-distance type scale and focus ring

All sizes are authored for a 1920 by 1080 canvas and scaled to the real window (`theme.ts`). The type scale runs from 22 (small) to 64 (display), with the Detailed caption base at 40 at system size `normal`. Every interactive control uses one `FocusButton` component with a 4-unit warm focus ring and a lifted surface so focus is unambiguous from about three metres. Selected options also carry a radio mark, so selection and focus are not confused.

Reviewed on the VVD only; not yet reviewed from living-room distance on a television.

## 12. D-pad only

Every viewer task (choose a scene, play, pause, seek, open settings, change mode, return to Standard, read About, exit) is reachable with the Fire TV remote's D-pad, Select, Menu, Back, and Play/Pause. There is no pointer or touch dependency. Diagnostics are behind the Info key and are not part of the viewer flow.

## 13. The fair Standard baseline rule

The Standard track is authored to a professional style guide (Netflix English TTSG and DCMP Captioning Key; see `docs/content/captioning-style-notes.md`): 42 characters per line, two lines maximum, reading speed at or under 20 characters per second, speaker ids only where the speaker cannot be seen, essential sounds only, no timing manipulated to favour the enhanced modes, no scene written so that Standard fails on purpose.

Reason: if the comparison is not fair, nothing the study finds is worth reporting. A habitual DHH caption user should describe the baseline as "normal good captions"; that is an explicit gate (G6) before any claim is made.

## 14. What must be co-designed with DHH users, not decided by engineers

The following are open questions for the pilot, not settled design:

- the default mode
- label frequency (section 7)
- lane versus bottom placement for the same speaker
- sound description wording
- label size relative to dialogue
- whether a persistent colour per character is welcome or noisy
- whether Detailed adds anything a viewer wants
- whether side lanes help attribution or add search effort
- whether the scenes feel natural or engineered

Hearing participants wearing headphones are not a substitute for DHH evaluation, and a small study is reported as product feedback, not as proof of general efficacy.

Pilot condition added September 3: the default for "size and weight follow the voice" inside Detailed (currently on) is a within-session A/B in the pilot script, not a settled choice; the one hearing tester's reaction that prompted the change is not evidence about DHH viewers.

## 15. Harm prevention list

- Wrong speaker attribution can change what a scene means. A cue's status is a person's call: the resolver treats a cue whose `verifiedBy` names a rule (`auto:*`) as unverified, and `propose.py --auto` never writes cue status (it writes `speakerProposal`). Word timings, measurements and sound events may be machine-verified with their rule named in `verifiedBy`, the validator warns about every such file, and the landing page says "auto-checked" for them. `proposed` metadata never reaches an enhanced render (unit test: "speaker-aware: verified labels, lanes, reveal, proposed ignored, canonical text intact").
- Speaker names can spoil a reveal. Generic labels are used until `revealAtMs`.
- A significant sound stays in the captions even when its directional enhancement is removed.
- A bad companion file must not stop video or Standard captions. Structural errors reject the profile; per-cue errors reject only that cue's enhancement; a resolver exception on one cue isolates that cue.
- No caption may overflow the viewport or sit over a known protected region; the estimator prefers a false fallback over an overflow, and the runtime prefers bottom fallback over shrinking the viewer's chosen size.
- No emotion recognition, face recognition, or automatic character identification, anywhere in the runtime.
- Findings from a handful of participants are reported with their limits, including negative and mixed feedback.

## 16. Known gaps

- No physical device test yet. Everything above was exercised on the Vega Virtual Device only. Remote behaviour, caption rendering, colour, and contrast on a real Fire TV and television are unverified.
- The VVD Settings UI has no Accessibility page, so the real system caption size change has not been driven through the UI. `getCaptionPreferences()` returns real values (textSize normal, default font and colours), and the app subscribes to changes, but the size-driven lane fallback has so far been triggered only through the app's own development scale keys. A write from the app (`setCaptionPreferences`) is expected to be refused for a third-party app.
- The lane estimator is calibrated at one size (`normal`). The other four sizes use a fixed multiplier that has not been measured.
- The Detailed overlay applies the viewer's text size, colour, font, edge style, text background and window background; it cannot apply them to the platform's own renderer in reverse.
- The speaker palette has not been checked against Vega's colour-correction modes.
- No DHH participant has yet seen any mode. The label rule, lane placement, and everything in section 14 are untested hypotheses.

## Word "pop" (Caption with Intention 2.2.3) — implemented behind Reduced motion, September 2, 2026

Caption with Intention lifts each word (25% elevation, +15% size) as it takes the character colour, leading the colour by a few frames; sound-effect labels pop with the sound; music descriptors do not animate. The runtime implements this in Detailed mode with each word as its own element: a lift of 25% of the type size and a 1.15 scale at word onset, easing back over the word's duration (120–300 ms), and a 120 ms colour crossfade from read-ahead white. Reduced motion is on by default, and with it on nothing moves: colour switches at word onset and the layout is identical. The After Effects template's expressions, which are the source for these numbers, are summarised in docs/prior-art.md section 7. Evidence: docs/captures/2026-09-02-pop01-awesome-lifted.png (one frame of "awesome" lifted and enlarged mid-line on the virtual device). The sound-label pop renders without error but a window capture at roughly two frames a second could not freeze it; a screen recording on hardware is the next check.

## Notes added after the September 2 review

- **CI Main Red lightened.** #E51717 measures 4.47:1 on black and 3.70:1 over the 90% box; the runtime uses #FF3B3B (5.9:1 and 4.9:1). Every other palette value is the design system's.
- **Colour never stands alone.** If the frequency rule withholds a repeat label and the cue ends at the bottom without a lane, the label is restored whenever a colour is applied (pass 2). A logged case of colour with neither label nor lane prompted this.
- **Untimed words follow their neighbours.** A token without verified timing colours when a later timed word has started or the previous timed word has ended. This changes only when a canonical word takes the colour, never the word itself; it keeps a line from reading in the wrong order when the aligner could not place a short word.
- **Viewer text colour.** When the viewer sets a caption colour, that colour is used for every word and the reveal survives as opacity (60% read-ahead, 100% spoken) rather than hue.
- **Fail closed.** A word, delivery or sound entry without a status is treated as not verified. Machine-set verification carries `verifiedBy` and the validator reports it.

## Reading rate after re-timing (September 2, evening)

`tools/author/retime.py` extends cues into their gaps to meet 180 wpm and 0.3 s per word without touching a word. After it: tos-lab and both micro-scenes pass; The Envelope stand-in still has 12 cues over the rate (the validator lists them) (the synthesized read leaves no gap; the real shoot re-times them), and the Tears of Steel bridge has 5 (the film's own subtitle timings for a fast argument; c008 "...by these giant robotic claws of death..." is 375 wpm because the line is delivered that fast). Those cues are a known limitation of the fair baseline, listed by `npm run validate`, and the pilot analysis excludes findings that depend on them.

## Detailed typography default (September 3)

Size and weight from the voice were off by default (Caption Royale: colour with size was the most distracting condition). Changed to on inside Detailed. Reasoning: Detailed is not the default mode; Speaker-aware is. A viewer who selects Detailed is selecting the Caption with Intention treatment, and shipping it with its typography off made the mode look broken ("no font changes") to the first person who tried it. The toggle remains one press away and is stated on the Captions screen. Reduced motion stays on by default: motion is the device the guidelines treat as risky, and it is the one that cannot be undone by looking away.

Side lanes: the promise is "on the speaker's side when the line fits". At the TV's default caption size a side lane holds a label and two short lines; longer lines go to the bottom (`size_rejected`), and the copy now says so instead of promising a stable place.
