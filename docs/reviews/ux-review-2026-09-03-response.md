# Response to the hands-on UX review of September 3

Same day. Each finding, what was done, and what was verified on the virtual device afterwards (captures in docs/captures/2026-09-03-*.png).

| # | Finding | Action | Verified |
|---|---|---|---|
| B1 | Replay left the end card on top | Replay sets the playing state itself; a `playing` event is a second fallback for the missing `play` after `ended` | Yes: card gone, chrome up, hides after 4 s |
| B2 | No TV captions after Next scene | The player is keyed on the scene id so a scene change remounts it; the caption view is also re-attached after `initialize()` | Yes: BARLEY's line drawn by the TV on the second scene |
| H1 | Settings reset on relaunch | `run-app` reinstalls the package, which is the likely cause; the hydrate step now logs what it found (`[settings] restored …`) so a launcher relaunch on hardware can settle it | No (needs hardware) |
| H2 | Play/Pause and Fast-forward keys inert | The device's own key names (`play`, `pause`, `forward`, `backward`) mapped; skip keys seek 30 s each way and show the chrome; a "Skip 30 s" hint pill | Yes: fast-forward jumped 0:00 to 0:30 with the chrome |
| H3 | Detailed text half the size of the TV's | Size baseline raised from 5% to 7% of the height (whisper 4.5%, shout 13%), reasoning in the code and docs | Not re-measured; the mapping test was updated |
| H4 | About clipped, unreachable | Copy trimmed to fit without scrolling; About sits on the scene backdrop like Captions; dark card, white body text | Yes |
| M1 | Focused rail card clipped | The rail scrolls itself so the focused card and a margin stay in view | Yes: last card fully visible with its ring |
| M2 | Loose pill-to-rail focus | Fixed after reading Amazon's vega-tv-interfaces-sample: the runtime does expose `FocusManager.setNextFocus` and `TVFocusGuideView`. Every pill now routes Down to the current scene's card, every card routes Up to Play, Right on About stays put; the end card, the error card and the Captions sheet trap focus in all four directions | Yes: docs/captures/2026-09-03-focus-*.png, -endcard-focus-trapped.png, -sheet-focus-trapped.png |
| M3 | One-line TV captions over the chrome | Not changed: moving the caption view while the chrome shows would re-create native cues (flicker); the overlap lasts only while paused or for 4 s after a press; noted | — |
| M4 | Permanent "♫ music ♫" moved the dialogue | A music label shows for four seconds after its onset, then yields the lane | Code only |
| M5 | Ragged per-word sizes | A word takes its own size only when it differs from the line by 1.5% of the height or more | Code only |
| M6 | Unknown speaker kept its lane | An unknown speaker id now gives up placement as well as colour | Core test suite |
| M7/M8 | Sheet moved two rows; Detailed group cut | No scroll view: one-line hints, tighter rows; everything fits on the full screen and in the sheet | Yes |
| M9 | Preview ignored Word highlighting | Preview and its note follow the toggle | Code only |
| M10/M11 | Badges promised what did not play | Badges count voices from the track, promise timing and measurements only on verified lines, say "Not yet verified: names only" and "Names from the caption track only" | Yes: lab badges |
| M12 | About and mode copy contradicted the fallback | Rewritten in plain words: names from the track, no colour or placement; Detailed "drawn by the app" | Yes |
| M13 | Placeholder scenes showed a debug card | Placeholder videos regenerated: "Placeholder footage until the shoot", no cue ids, small corner clock; HLS repackaged | Frame checked |
| M14 | No artwork for test scenes | Brighter abstract art for the clock test and fixtures | Yes (rail) |
| M15 | Black flash on entry | Poster stays until the first moving frame | Yes: poster with chrome at 0.5 s |
| M16 | Next scene did not announce itself | The chrome (mode and title) shows for a few seconds whenever playback starts | Yes |
| L1 | Card select only selected | Select on a card starts that scene | Code only |
| L3 | "Resume" after the end | "Close" once the scene has finished | Yes |
| L5/L6 | Technical wording; inconsistent names | Plain-word descriptions; Keys and Hallway named consistently | Yes |
| L8 | Hint pills too small | Raised to the small size | Yes |
| L12 | Menu inert on the landing | Menu opens Captions on the landing | Code only |
| L2, L4, L7, L9, L10, L11, L13 | Dual-speaker colour, caption under the sheet, orphans, placeholder stall, rewind feedback (now covered by H2), log noise, end card over the title | Left as noted; the rewind feedback is fixed with H2 |

Verification method: remote key scripts with a capture after every step. Two runs looked like crashes and were not: the virtual device had exited on its own (FL-018), and a second Back on the landing page leaves the app by design.
