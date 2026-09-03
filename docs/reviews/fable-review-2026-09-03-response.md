# Response to the September 3 review

Same day. Each finding, what was done, and what is left for Samuel. Tests after this pass: 51 core, 22 app, 6 pipeline (pytest).

| # | Finding | Action |
|---|---|---|
| 1 | Machine rules certified cue status, including speaker attribution from the author's own `<v>` guesses | Fixed in three places. `propose.py --auto` never writes cue status again; it writes `speakerProposal.autoRecommend`. The resolver treats a cue whose `verifiedBy` starts with `auto:` as unverified (test). The shipped files were normalised: 10 lab cues and bridge c010 demoted to `proposed`; hand-authored cues carry `verifiedBy: human` with the provenance "author, checked against footage" (bridge sides were checked against film frames on September 2). The lab now plays as Standard with timing until a person verifies it, and the landing page says "0 of 19 cues verified by a person". §15 of the accessibility record rewritten to say what the data says. |
| 2 | No LICENSE; Amazon proprietary Shaka header; repository size | **Samuel.** Decisions only he can make (licence, name, whether to replace the vendored Shaka with upstream plus a patch). Not touched. |
| 3 | Cue-level `offScreen` honoured on unverified cues | Gated on `verified`; validator type-checks it; test. |
| 4 | Invented word timings measured and reported as sync | Interpolated words now carry no per-word measurement of their own (they inherit the cue-level measurement, which covered them, so a line keeps one size); the whole-cue low-score rule is deleted; the native path colours the untimed tail after the last timed word ends (test), so the cosmetic no longer needs invented timings. Interpolation for runs bounded by real words stays, flagged `interpolated: true`, with a pytest suite and the speech-energy evidence in docs/authoring.md. |
| 5 | Shaka never unloaded | `unload()` in the cleanup; a failed load reaches the app as an error card instead of an unhandled rejection. |
| 6 | Chrome never auto-hides | Timer keyed on the last key press; confirmed on the device (capture). |
| 7 | Standard mode shifted by the lead | Lead is 0 in Standard (test); the sync tool says so. |
| 8 | One bad sound or shot rejected the whole file | Per-entry: bad sounds and shots are dropped, the rest applies (test). |
| 9 | Re-runs overwrote human decisions | Human words, delivery, sounds and shots survive; rejected cues are never promoted; `.bak` written; `--auto` refuses a file with human verification unless `--force` (pytest). |
| 10 | Published JSON Schema rejected the real files | Fields added (`offScreen`, `speakerProposal`, `score`, `interpolated`, `directionProvenance`, `loudDb`), export re-run, ajv test over every shipped companion. |
| 11 | Syllable colouring untimed | The word clock now ticks every 80 ms inside a longer timed word, so chunks colour on time. |
| 12 | No two-line cap | A third authored line folds into the second in Detailed. |
| 13 | Sound events unsized, bypass layout | `sounds.py` measures each event's level relative to speech; the runtime sizes the label from it. They still take the bottom lane by construction (documented). |
| 14 | Italic unverified, probably not rendering | Three slanted Roboto Flex instances generated from the variable font and selected by family for off-camera cues; confirmed on the device (capture). |
| 15 | Badges called machine checks "verified" | Badges now count cues verified by a person and say "auto-checked" / "measured" for machine entries. |
| 16 | Placeholder scenes labelled "Original scene" | Kicker reads "Placeholder footage". |
| 17 | Error boundary promised Standard captions | Reset returns the settings to Standard; copy matches. |
| 18 | Settings focus yanked on toggles | One-shot preferred focus; confirmed on the device (capture). |
| 19 | Whole player re-rendered per word | Surface and native caption view memoised. |
| 20 | Typography default flipped on one tester's reaction | Recorded in §14 as a pilot A/B condition, default kept on. |
| 21 | Sync report contradictions; dead constant | Current-claim paragraph at the top; `NATIVE_LEAD_MS` deleted; sign formatting fixed; `--mode` filter added to the tool. |
| 22 | Stale numbers across docs | Every cited line corrected. |
| 23 | Pipeline not reproducible, untested | `tools/author/requirements.lock` (31 pins), 6 pytest cases, flag-first invocation fixed. |
| 24 | Undocumented measurement assumptions | "Scope and limits" section in docs/authoring.md; `sounds.py` cleans its temporary WAVs. |
| 25 | Overlap auto-verified as the louder voice | Moot for cue status (finding 1); documented under scope. |
| 26 | Untested paths | Tests added for 3, 4, 7, 8, 10 and the pipeline rules. Overlay and player components remain untested as components. |
| 27 | Contrast measured but not recorded | Table pasted into §10. |
| 28 | Label not bold | Bold family on the label. |
| 29 | Lane continuity not scoped to the shot | Reset on shot change. |
| 30 | Off-screen regex over the label | Left as is; documented. |
| 31 | LAN address on the About screen | Removed. |
| 32 | Face clusters in the shipped file | `faceIdentities` no longer written; removed from the shipped files. |
| 33 | "♫ music ♫" wording | A person's edit in the review page; left. |
| 34 | Repository weight | **Samuel**, with finding 2: the large device logs should leave history when the public repository is cut. |

Still true after this pass: every rendering, focus and timing claim is from the virtual device; the lab excerpt needs a human verification pass before it shows any enhancement; the bridge's word timings, measurements and sound events are machine-verified with their rules named.
