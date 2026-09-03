# Validation plan (index)

Status on September 3, 2026: no study is scheduled and none will run before the hackathon deadline. No participant has seen any caption mode and outreach has not been sent. The kit in `docs/study/` and the decision rules below stay as written so that anyone who runs the sessions later runs them the same way. The milestone dates below are the original plan and are not being pursued.

## The question the study answers

Do habitual DHH caption users find Speaker-aware captions materially clearer or more useful than a fair Standard baseline, without more distraction? Technical feasibility is no longer the main uncertainty; this is.

## Study kit

| File | What it is |
|---|---|
| `docs/study/recruitment-plan.md` | Channels (community forums, national associations, universities, paid panels, Samuel's own network), a one-week outreach schedule, compensation guidance, and how to make the outreach itself accessible |
| `docs/study/outreach-messages.md` | Forum post, organization email, and direct message templates. The product is not named. |
| `docs/study/screener.md` | The 3-minute screener (hearing profile, sign language, caption habits, viewing setup, settings changed, payment method, interpreter needs) |
| `docs/study/consent-and-info-sheet.md` | Plain-language information sheet and consent lines; product testing, not medical research; data deleted by 2026-12-31 |
| `docs/study/session-script.md` | 45-minute moderator script: calibration, Latin-square condition order, comprehension questions, 1 to 5 ratings, open questions, preference ranking, the scoring sheet, and the continuation and kill signals |
| `docs/study/remote-tv-playback.md` | How a remote participant gets each clip onto a television, best option first |
| `docs/content/captioning-style-notes.md` | The rules behind the fair Standard track and how the companion metadata adds context without touching the text |

Participant data (`docs/study/participants/`, `docs/study/raw/`) is git-ignored and never committed.

## Conditions

Within-subject, counterbalanced (all six orderings). Participants hear them as Style 1, 2, and 3, never by name.

- A: Standard (professionally authored bottom captions)
- B: Speaker-aware (verified label on the first cue of a run, stable left/right/bottom lane)
- C: Detailed (adds restrained speaker colour and one directional sound treatment; reduced motion on)

Pilot uses two or three rough phone-shot micro-scenes of 15 to 25 s. Final uses the polished 45 to 60 s scene ("The Envelope").

## Target sample

Five to eight habitual caption users: at least two Deaf sign-language users, at least two hard-of-hearing participants, at least two who watch captioned narrative TV daily, varied ages where possible. Recruit internationally. Compensation: 35 USD pilot, 60 USD final, plus 15 USD when a remote participant sets up TV casting or HDMI.

## Milestones

| Date | Milestone |
|---|---|
| Sep 2 | Outreach begins |
| Mon Sep 8 | Target: four participants confirmed |
| Tue Sep 9 to Sun Sep 14 | Rough pilot (micro-scenes, rough footage allowed) |
| Fri Sep 12 | Hard gate: at least three confirmed |
| Sep 14 | Pilot value decision (gate G5) and fair-baseline check (gate G6) |
| By Sat Sep 27 | Final study on the polished scene |

Engineering continues before these dates. The product pivots only when the value gate fails, not because recruiting is still in progress before the hard deadline.

## Measures per scene and condition

Speaker-attribution accuracy (ambiguous line, first speaker in an overlap, off-screen speaker named or generic), general comprehension, significant-sound recall, a missed-visual-event question, and 1 to 5 ratings for readability, distraction, comfort, and perceived control; mode preference with an open explanation; whether labels feel repetitive; whether side lanes help or add search effort; whether the scene feels natural or engineered.

## Continuation signal (decide after the third pilot session and again after the last)

Continue when all hold:

- attribution accuracy is higher in Speaker-aware than in Standard
- at least two of the first three participants (preferably four of the first five) rank an enhanced mode first for at least one micro-scene
- median distraction for Speaker-aware is not worse than for Standard
- no unresolved severe readability issue (one that stopped a participant reading a line)
- participants describe a real use case in their own words, unprompted

## Kill signal (pivot or redesign before the final study)

Any of these after one focused iteration:

- participants consistently rank Standard first
- Speaker-aware does not improve attribution over Standard
- median distraction for Speaker-aware is worse than Standard
- labels or lanes add confusion (searching for captions, misreading a label as dialogue, labels described as noise)
- the benefit shows only in the contrived blocking and vanishes on the more natural micro-scene
- the value cannot be explained to a participant without describing how the system works

A mixed result (for example, better attribution but worse distraction) means fix the specific cause, re-run two pilot participants, then decide. The baseline is never weakened and animation is never added to manufacture a difference.

## Remote versus in person

- **Remote participants** receive burned-in renders: one MP4 per condition and scene with the captions drawn into the picture at the calibrated size, delivered by private link the day before, played on their television by casting, AirPlay, HDMI, or the YouTube app with CC off (see `remote-tv-playback.md`). A 5-minute device check happens the day before. Burned-in renders test the visual design of each mode, not the live runtime, and they are not the product's rendering path.
- **In-person participants** (Accra) watch the prototype rendering live on Fire TV on Samuel's own television. This is the only path that tests the real runtime, including the viewer's caption settings and the fallback behaviour, and it is prioritised for the final study where possible.
- Laptop or monitor viewing is accepted for the pilot only when no TV is available, is recorded as such, and is treated as lower confidence for readability and distraction.

## Reporting

Results, including negative and mixed feedback, go in `docs/study-results.md` (not yet written) and are reported as product feedback from a small study, not as proof of general efficacy. Quotes are anonymous and used only with consent. One change made because of participant feedback is to be shown in the demo.
