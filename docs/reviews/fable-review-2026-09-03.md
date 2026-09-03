# Fable review, 2026-09-03

Third independent pass. Tree at `f5cda10` (2026-09-02 22:50 UTC) plus, at the time of reading, six uncommitted modifications and one untracked log (`git status`: README.md, AboutScreen.tsx, settings/store.ts, accessibility-decisions.md, sync-report.md, propose.py, `docs/device-log-2026-09-03-probe.txt.gz`). Someone was editing while I read; where an uncommitted change affects a finding I say so. Nothing in this review modifies the tree.

Commands run: `cd packages/core && npm test` (45 pass, 0 fail, 325 ms); `cd apps/vega-player && npm test` (20 pass, 0 fail, 348 ms); `npm run validate` on tos-bridge (`OK (11 warnings)`, MACHINE-VERIFIED 67 words / 11 delivery / 2 sounds), tos-lab (`OK (36 warnings)`, 67 / 19 / 8), the-envelope (`OK (14 warnings)`, 117 / 31 / 0); `npm run sync-report` on the new Sep 3 log (the three speaker-aware rows reproduce digit for digit); two throwaway Node scripts against `packages/core` and `node_modules/ajv` (quoted below); Python over the companion files for the counts.

Findings from the two September 2 reviews that were fixed are not repeated. Verified fixed since review B: `resolveAlone` chain regression (R1), `MediaClock` stalls and rate (R2), fallback-controller double cues (R3, the constructor now removes its own cues on throw), negative seek, settings race, dispose, red contrast, colour-alone label restore, the offline-path evidence (D1: `docs/device-log-2026-09-02-offline-packaged.txt.gz` contains one `source=packaged`), and the Envelope reading-rate count (D7: doc and validator both say 12). Still open from those reviews and not repeated in detail here: per-word size is now implemented (row 43), weight and width are now separate axes, but the lane-calibration constants (`lanes.ts:67-70`) still have no artefact, the box-covers-text capture (`sounds01`) was never retaken, `NATIVE_LEAD_MS = 120` is still dead code, and the DHH outreach status is unchanged (`docs/validation-plan.md:5`).

---

## Verdict

**CONDITIONAL GO for the October 23 submission.** The one thing that decides it: whether, by the internal freeze, `verified` in the shipped companion files means a person looked. Today it means a rule did. Every word timing, every delivery level, every sound event and, new since yesterday, the speaker attribution on 11 cues across the two film excerpts were set to `verified` by `propose.py --auto`, and the app's landing page tells the viewer "10 of 19 cues verified" on that basis. The accessibility record still says "Only human-verified metadata reaches an enhanced render". A judge who opens `assets/tos-lab/companion.en.json` finds five different diarized voices all "verified" as the Director. Fix that (an evening in the review page for the bridge, and stop `--auto` from writing cue status) and the entry is defensible; leave it and the central claim of the product is false in its own demo data. The second hard condition is unchanged from both prior reviews and is the project's own written blocker: no `LICENSE`, and an `AMAZON PROPRIETARY/CONFIDENTIAL` file in a repository the Devpost rules require to be public with a detectable licence.

---

## Findings, by severity

### Blockers

**1. The verification gate is now machine-operated end to end, and the auto rules certify wrong speaker attribution as verified.** Blocker.
Evidence: `tools/author/propose.py:173-174` sets `cue["status"] = "verified"` when a diarized cluster "agrees with the track" at confidence 0.6. "Agrees" (`propose.py:168`, `diarize.py:45-53`) means the cluster's majority `<v>` name equals this cue's `<v>` name, and the `<v>` names in `assets/tos-lab/captions.en.vtt` are 18 "Director" and 1 "Barley", which the scene README calls "the author's guesses from the subtitle text ... several of them are probably wrong". Result in `assets/tos-lab/companion.en.json`: 10 cues `verified` by `auto:diarization`, spread across clusters SPEAKER_00, 01, 02, 03 and 04, all as `director`. Five voices, one name, all verified. On the bridge, c010 is verified the same way. Counts across the shipped scenes: tos-bridge 67/76 words verified (32 `auto:align>=0.7`, 25 `auto:interpolated`, 10 `auto:aligned-low-score`), 11/11 delivery `auto:measured`, 2/3 sounds `auto:panns`; tos-lab 67/78, 19/19, 8/15; the-envelope 117/134 at `score>=0.5`, 31/31 `dev-bench`. Human `verifiedBy`: zero entries in any file. `LandingScreen.tsx:101-102` renders "N of M cues verified" from `status` alone. `docs/accessibility-decisions.md:123` still reads "Only human-verified metadata reaches an enhanced render". Every cue's `provenance` still ends "pending human review".
Why it matters: the product's one differentiator over an automated effects pass is the human gate. Speaker attribution is the enhancement the accessibility record itself calls the most harmful to get wrong (§15, first bullet), and it is now the enhancement the auto rule sets. Word-level rules are arguable (finding 6); cue-status by diarization-agrees-with-a-guess is not, because the two "independent sources" are a model and the thing it is being checked against.
Smallest fix: `--auto` must never write `cue.status`; it may write `speakerProposal` only. Reserve `verified` on cues, speakers and sounds for `verifiedBy: "human"`, and make the resolver require `verifiedBy === "human"` for `status === "verified"` on cues (one comparison at `resolver.ts:113`). Then run the bridge (11 cues) through `review_server.py` before the demo cut, and correct §15 to say what the data says until then.

**2. The repository still cannot be published, by its own rule.** Blocker.
Evidence: `ls LICENSE*` matches nothing; `apps/vega-player/src/w3cmedia/shakaplayer/ShakaPlayer.ts:1-13` still reads "AMAZON PROPRIETARY/CONFIDENTIAL ... the accompanying LICENSE.TXT file" and no such file exists; `docs/licensing.md` still says "Until one is done, do not publish the repository or enter the Open Source mini-challenge"; `docs/devpost-draft.md:50` still says "[public URL after naming approval]"; `docs/name-review.md:3` still "awaiting Samuel's approval"; package id still `com.sightlinewip.player`. `.git` is now 259 MB (150 MB yesterday): three device logs of 38, 30 and 27 MB were committed on Sep 2. Devpost requires a public repository with a detectable open-source licence.
Why it matters: this is the only finding that can make the entry inadmissible rather than weaker, and every day of history added makes the eventual rewrite bigger.
Smallest fix: decide Apache-2.0 today; replace the Shaka copy with upstream `shaka-player` from npm plus a patch file (option (a) in `docs/licensing.md`); start the public repository fresh from a squashed tree without the confidential file and without the 96 MB of logs (keep them in a release asset or a separate evidence repo).

### High

**3. Cue-level `offScreen` is honoured on unverified and stale cues.** High.
Evidence: `packages/core/src/resolver.ts:145` reads `... || speakerDef.offScreen === true || meta?.offScreen === true` outside any `verified` check, and `speakerDef` exists for unverified cues through the `<v>` compatibility rung (`:130-135`). Script output against the current core: a cue with `status: "proposed"` and a stale hash and `offScreen: true` resolves to `offScreen= true label= THOM reasons= metadata_unverified|speaker_unavailable`. The validator (`schema.ts:349`) allow-lists `offScreen` on cues but never checks its type: `offScreen: "yes"` passed validation in the same run. `offScreen` feeds italics in Detailed (`DetailedOverlay.tsx:148`) and forces the label on (`labels.ts:61`).
Why it matters: it is the exact hole the fail-closed rule exists to prevent, on a field added in the last commit, with no test. The bridge ships three such cues (c001, c008, c009).
Smallest fix: `verified && meta.offScreen === true`; add the boolean check beside `speaker.offScreen` at `schema.ts:255`; one test.

**4. Interpolated word timings are invented, then measured against, then reported as sync.** High.
Evidence: `propose.py:49-58` shares a gap by character count and marks the run `verified` (`auto:interpolated`); `:28-38` verifies a whole cue whose mean alignment score is 0.35 or more (`auto:aligned-low-score`). In `assets/tos-bridge/companion.en.json`: c002 word 0 "Look" has score 0.0 and timing 7000–7081 (81 ms), verified; c004 words 0–2 "Why don't you" have scores 0.0, 0.1, 0.31, verified, and that is the cue whose capture is the evidence for integration row 43 ("Why don't you" larger than "just admit"); c005 is verified whole at scores 0.15–0.62. 35 of the bridge's 67 verified words are below the project's own 0.7 rule. `delivery.py:50-59` then measures `loudDb` over those invented spans (c004 word 0: +2.3 dB over 60 ms). The new uncommitted `docs/sync-report.md` row (Sep 3) shows the consequence: 49 word boundaries instead of 37, median error +30 ms instead of +6 ms, "not its letter". A boundary that was never measured cannot be late or early; the number is now partly a measurement of the interpolation.
Why it matters: `docs/authoring.md` justifies the rules by "a low-score final word left a line half coloured at its end". The overlay already solves that without inventing timings: `layout.ts:84-92` `spokenAt` colours an untimed token when its predecessor ends. Only the native path lacks it (`resolver.ts:456-458` never advances past the last timed word). The rules trade the promise for a native-path cosmetic that is one line to fix properly.
Smallest fix: delete `auto:interpolated` and `auto:aligned-low-score` (leave the timings in the file as `proposed`); in `nativeWordSegments` add a bound at the last timed word's `endMs` that colours the remaining tokens; regenerate the bridge; re-run the sync row.

**5. The Shaka player is never unloaded; every scene change and every Retry leaks one.** High.
Evidence: `PlayerScreen.tsx:197-204` cleanup disposes the controller, detaches the clock, pauses and deinitialises the `VideoPlayer`, and never touches `shakaRef`. `ShakaPlayer.ts:482-504` has `unload()` which calls `player.destroy()`. `grep -n "unload\|destroy" PlayerScreen.tsx` returns nothing. `load()` at `ShakaPlayer.ts:200` fires `internalLoad` (`:459-463`) without a catch, so a failed load is an unhandled rejection that the global handler at `App.tsx:26-29` logs and swallows.
Why it matters: "Next scene" on the end card and "Try again" on the error card are the two paths a judge will use, and each leaves a Shaka instance with its MediaSource buffers and its listeners on a deinitialised player. A Fire TV Stick has a fraction of the VVD's memory; this is the most likely way the demo dies on hardware after the third scene.
Smallest fix: `try { shakaRef.current?.unload(); } catch {}` in the cleanup before `deinitialize`; wrap `internalLoad` in a catch that sets the error state.

**6. The transport chrome never auto-hides while playing.** High.
Evidence: `PlayerScreen.tsx:228-232`: `useEffect(() => { if (panel !== "controls" || play !== "playing") return; const t = setTimeout(..., 4000); return () => clearTimeout(t); }, [panel, play, clock]);` and `:153` updates `clock` from `timeupdate` about once a second. Each update clears the 4 s timer and starts a new one, so it never fires. `:318-335` draws the chrome with a full-height bottom scrim (`chrome: height px(420), zIndex 5`) over the caption area (`captions: zIndex 2`; Detailed's bottom lane sits at 7.5% from the bottom).
Why it matters: one press of Select, Left or Right during playback and the progress bar, times and hint pills sit over the captions until the viewer pauses. Nothing in `docs/captures` shows the chrome during playback, and no integration row covers it.
Smallest fix: remove `clock` from the dependency array and key the timer on the last key press (a ref).

**7. Standard mode is not "the untouched track": the 100 ms lead is applied to it too.** High.
Evidence: `CaptionController.ts:174-183` `make()` subtracts `leadStart`/`leadWord` for every mode; `:182-183` are the Standard paths (`raw`, `plain`). `docs/devpost-draft.md:15` "Standard is the untouched track"; `docs/accessibility-decisions.md:101` "no timing manipulated to favour the enhanced modes"; `README.md:35` "exactly as authored".
Why it matters: it is even-handed, so the fairness rule is not broken, but three documents say the opposite of what the code does, and if the entry lag on hardware is the 56 ms minimum the project has measured, the fair baseline lands 44 ms early on a real Stick with no instrument to see it. The controller test (`controller.test.ts:85`) asserts the lead for Speaker-aware only.
Smallest fix: `const ls = mode === "standard" ? 0 : ...` with a test, or one sentence in the three documents saying Standard is shifted by the same measured lag.

**8. One bad sound event or shot rejects the whole companion file, silently.** High.
Evidence: `CaptionController.ts:119` keeps the profile only if `v.ok || v.errors.every(e => e.path.startsWith("$.cues."))`. Script: a profile with a valid verified cue plus one sound event whose label contains brackets (`$.sounds[0].label` error) returns `controller would reject profile wholesale: true`. The same applies to `$.shots[i]` overlaps and `vtt#` duplicate-id errors. The viewer sees Standard captions with no message; `docs/architecture.md:13` promises "per-cue errors reject only that cue's enhancement".
Why it matters: the publisher path (`PlayerScreen.tsx:59-82`) fetches this file over HTTP; a publisher fixing a sound label removes every speaker label in the scene, and the app's only signal is a `devLog`.
Smallest fix: drop the offending entry per `$.sounds[i]` / `$.shots[i]` error (the resolver already tolerates missing entries) and reserve wholesale rejection for `$.schemaVersion`, `$.speakers`, `$.cues` not being an object.

**9. `propose.py --auto` promotes a human-rejected cue to verified and overwrites human sound and shot decisions.** High (partly fixed in the uncommitted tree).
Evidence: `propose.py:173` gates on `cue.get("status") != "verified"`, so a cue a reviewer set to `rejected` (a wrong attribution) is flipped to `verified` when diarization agrees with the (wrong) `<v>` tag. `:199` `prof["sounds"] = out_snd` and `:159` `prof["shots"] = shots` replace the arrays wholesale. `grep ".bak" propose.py` is empty (only `review_server.py:39` writes a backup). The uncommitted diff adds `if w.get("verifiedBy") == "human": continue` for words and a `delivery.verifiedBy == "human"` guard, which closes the word and delivery halves; the tos-lab file already shows the re-run pattern: five cues at `auto:diarization>=0.8+track` and five at `>=0.6+track`, i.e. an earlier run's verdicts survived a threshold change.
Why it matters: the review page is the exception queue; if the queue's output does not survive the next pipeline run, the human step is decorative.
Smallest fix: skip any entry (cue, word, delivery, sound, shot) whose `verifiedBy` is `human` or whose status is `rejected`; write `.bak` before writing; refuse `--auto` on a file containing any human verification unless `--force`.

### Medium

**10. The published JSON Schema rejects every shipped real companion file.** Medium.
Evidence: `node_modules/ajv` against `schema/companion-profile-0.2.schema.json`: tos-bridge INVALID (181 errors, first: `faceIdentities` additional property), tos-lab INVALID (208), the-envelope INVALID (165, first: `words[0].width`); micro-scene-a valid. The exported file lacks `width` and `faceIdentities` that `schema.ts:129,144,154` declare (export not re-run), and `schema.ts` itself lacks `cue.offScreen`, `speakerProposal`, `words[].score`, `sounds[].directionProvenance` that the hand validator allow-lists (`schema.ts:349,419,373`). `schema/README.md` says the file is generated from `schema.ts` and is what publishers validate against.
Smallest fix: add the fields to `COMPANION_PROFILE_JSON_SCHEMA` (authoring annotations can be documented as ignored), re-run `npm run export-schema`, and add one core test that ajv-validates every `assets/*/companion.en.json` against the export.

**11. Syllable colouring is not timed; it flips at the next word.** Medium.
Evidence: `CaptionController.ts:216-218` builds `renderKey` from the count of words started; `nowMs` reaches the overlay only when that key changes (`:222`). `DetailedOverlay.tsx:52` colours a syllable chunk when `c.startMs <= nowMs`, but `nowMs` is frozen at the last word onset. So the first chunk colours at the word's onset and the rest at the following word's onset. The captures for row 46 ("fol|low", "ro|botics half-coloured") show exactly that steady state, not a transition. Row 46 says Verified.
Smallest fix: include syllable boundaries in the key (or a per-frame `nowMs` only while a multi-chunk word is active), or mark 2.2.2 "implemented, untimed" and drop the row.

**12. No two-line cap.** Medium.
Evidence: script: a three-line cue resolves to `bottom_center` with 3 lines; `DetailedOverlay.tsx:152` maps every authored line, `styles.wordRow` is `flexWrap: "wrap"`, and `overflowScale` (`layout.ts:41-44`) only shrinks type to fit 35% of the height, it never limits rows. `docs/prior-art.md:25` adopts "at most two lines"; §9 claims "two-line cap" implemented.
Smallest fix: when `tokenLines(c.text).length > 2` or the measured row count exceeds 2, render at cue-level colour on the native path (Speaker-aware treatment) and log `size_rejected`.

**13. Sound events bypass layout and are never sized.** Medium.
Evidence: `CaptionController.ts:251` hard-codes `lane: "bottom_center", stackIndex: 99` and skips `layoutActiveSet`, so protected regions and occupancy are never checked for them. `sounds[]` has no loudness field (`schema.ts:155-174`), so `cueHeightPct` returns the 5% baseline for every event; `docs/prior-art.md:27,§9` and `docs/authoring.md` claim sound effects "sized by loudness". On the bridge, `sfx03` is `[music]` from 34.0 s to 48.0 s, a 14-second label stacked under c010 and c011 in Detailed.
Smallest fix: route events through `layoutActiveSet` as sound cues; add `loudDb` to `sounds[]` from `sounds.py` (it has the window RMS available) or delete the sizing claim.

**14. Italic for off-camera voices is unverified on the device and probably not rendering.** Medium.
Evidence: `apps/vega-player/assets/fonts/` holds nine static instances (Regular, Light, Bold × Narrow, Wide, default); none is italic. FL-024 records that the platform picks faces by family name and ignores `fontWeight`; `DetailedOverlay.tsx:148` relies on `fontStyle: "italic"` with family "Roboto Flex". No capture in `docs/captures/` is named for italics or off-camera; the three `offScreen` cues (c001, c008, c009) are the ones that would show it. Row 28 and the About screen both claim italics.
Smallest fix: one capture of c001 in Detailed. If upright, generate slanted instances (Roboto Flex has a slant axis) and select them by family in `familyFor`.

**15. Landing badges present machine verification as verification, and two badges ignore status.** Medium.
Evidence: `LandingScreen.tsx:96-102`: "N speakers" and "N of M cues verified" read `status === "verified"` (machine on both film scenes, finding 1); `:99` "Loudness and pitch" fires on `c.delivery` regardless of status; `:100` "Sound labels" on `sounds.length` regardless of status. The comment at `:87-88` says "no badge claims a feature the scene cannot show".
Smallest fix: count `verifiedBy === "human"` only, or word the badge "auto-checked".

**16. Placeholder scenes are labelled "Original scene" on the landing page.** Medium.
Evidence: `LandingScreen.tsx:63` kicker: `scene.id.startsWith("tos-") ? "Real footage" : ... : "Original scene"`; `media/config.ts:61-63` subtitles for The Envelope and the micro-scenes carry no placeholder note. Only the About screen (`AboutScreen.tsx:24`) says "placeholder footage until the shoot". `docs/phase-reports.md:72`: "Footage is synthesized (macOS `say` voices over a stage graphic)".
Why it matters: a judge browsing the rail sees three "original scenes" with poster art. Finding out later that they are TTS over a graphic reads as concealment; the README discloses it, the app does not.
Smallest fix: kicker "Placeholder footage" until the shoot.

**17. The error boundary and the error card promise Standard captions and deliver a Back button.** Medium.
Evidence: `ErrorBoundary.tsx:24-27`: "Standard captions and the rest of the demo still work" with one action, Back, whose `onReset` (`App.tsx:46`) only routes to landing; settings are untouched, so Play again reproduces the crash in the same mode. `PlayerScreen.tsx:309`: the same sentence when the *video* failed to play, where captions cannot work either.
Smallest fix: `onReset` calls `resetToStandard()`; reword the media error card.

**18. Focus is likely yanked back to the selected mode row on every settings toggle.** Medium, needs the device.
Evidence: `SettingsPanel.tsx:27` sets `hasTVPreferredFocus={s.mode === m ...}` on the selected row; FL-029 (`docs/friction-log.md`) records that on this platform `hasTVPreferredFocus` "re-asserts on every render" and that any state update re-rendering the end card "pulled focus back to its preferred button". `useSettings()` re-renders the panel on every `setSettings`, so pressing "Reduced motion" (`:32`) or "Word highlighting" (`:36`) re-renders with the mode row still preferred.
Smallest fix: the one-shot pattern already used on the landing page (`wantFocus` state, cleared after first focus), and one remote-script check on the VVD.

**19. Every word boundary re-renders the whole player screen, including the video surface.** Medium.
Evidence: `PlayerScreen.tsx:184` subscribes with three `setState`s (`setResolved`, `setNowMs`, `setSfxStart`) per controller emit; emits happen at every word boundary (`CaptionController.ts:222`), every cue change (`:267`) and every recompute; `:153` adds one per second. All of them re-render `KeplerVideoSurfaceView` and `KeplerCaptionsView` (`:279-280`). The file header (`:14-15`) and FL-008 state the rule this breaks: the surface re-rendering is what tripped the 300 lines/s log limit and hid the pipeline's errors.
Smallest fix: have `DetailedOverlay` subscribe to the controller itself (it already receives the controller's state shape), or `React.memo` the surface pair.

**20. The typography default was flipped to on in the uncommitted tree, reversing yesterday's evidence-based decision.** Medium.
Evidence: uncommitted `settings/store.ts:31` `deliveryTypography: true` (was `false` in `f5cda10`, set after review A 4.11 on Caption Royale's finding that colour with size was the hardest condition). The new `accessibility-decisions.md` addendum gives the reason: the mode "looked broken ('no font changes') to the first person who tried it". That toggle also enables verified capitals and stretched spellings (`SettingsPanel.tsx:37`).
Why it matters: a tester expecting to see the effect is not the DHH pilot, and §14 of the same document lists "whether Detailed adds anything a viewer wants" as a question for participants, not engineers. Either default is defensible; deciding it on one hearing tester's reaction while writing "the pilot decides" is not.
Smallest fix: keep whichever default, but record it in §14 as a pilot condition (A/B within the session script) rather than a settled choice.

**21. The sync report carries three different current claims, and the tool still prints the dead constant.** Medium.
Evidence: `docs/sync-report.md:50` "schedules every native cue 120 ms early (`NATIVE_LEAD_MS`)"; `:58` "The entry lead now sits at the midpoint, 130 ms" (D6, not fixed); `:71` "within about 20 ms at the median, p95 near 125 ms"; `:101` "Claim we make: approximately 250 ms p95"; the new uncommitted Sep 3 section: "about 30 ms at the median". `CaptionController.ts:42` still exports `NATIVE_LEAD_MS = 120` with a docstring saying the track is scheduled that much early; nothing reads it; `tools/sync-report.ts:107` prints its name. The tool also prints `+-12` for a negative overall median (`:106`) and, run on the Sep 3 log, prints Detailed rows for the lab excerpt scored against the bridge track (p50 -3907 ms) because it cannot scope a log to a scene. The virtual-device caveats themselves are stated honestly throughout.
Smallest fix: one "current claim" paragraph at the top of the file with a date; delete `NATIVE_LEAD_MS`; fix the sign formatting; make the tool take a `--mode` or `--scene` filter.

**22. Documentation a judge reads first still contradicts the code after two review passes.** Medium.
Evidence: `docs/architecture.md:202` "exactly two viewer settings", `:209` "in memory only", `:281,298` "34 tests", `:316` "the `vega-player` workspace's `jest` script currently fails", `:42` "Font family and window background are not yet applied" (`DetailedOverlay.tsx:104-107` applies both). `docs/accessibility-decisions.md:26,136` same stale sentence, `:40` "four speaker tokens" (19), `:85` "80% opacity" (0.9 at `DetailedOverlay.tsx:101`), `:123` (finding 1). `README.md:134,172,259` say 18 app tests (20), `:247` "FL-001 to FL-027" (FL-029). `docs/devpost-draft.md:24` "17 app tests", `:55` says the tags are `score>=0.5` (they are `auto:*` on both film scenes). `docs/authoring.md` table says diarization 0.6; `propose.py:8` docstring says 0.8; `propose.py:82` code says 0.6. `docs/integration-tests.md` row 35 still cites the lead-120 log as current.
Smallest fix: one pass with `grep -n` for each number above; the README "Honesty notes" already sets the standard.

**23. The authoring pipeline is not reproducible by anyone but the author, and has no tests.** Medium.
Evidence: `docs/authoring.md` installs with `uv pip install ... whisperx librosa soundfile audiotimm` (no versions, no lock file); pyannote is "3.x"; `diarize.py:25-27` monkey-patches `torch.load` to `weights_only=False` for every checkpoint (arbitrary pickle execution from a download); pyannote needs a Hugging Face account and accepted terms; no authoring run log is committed; `find . -name "test_*.py"` returns nothing, so `interpolate_gaps`, the function that manufactures verified timings, has zero tests. `propose.py:97` derives the VTT path from `argv[0]`, so `propose.py --auto assets/x/companion.en.json` (flag first) silently loses the cue-time bounds and disables the low-score rule.
Smallest fix: `requirements.lock` with hashes, a committed run log per scene, and a `pytest` for `interpolate_gaps` and the diarization gate using the shipped JSON.

**24. Measurement assumptions in `delivery.py` that the docs do not state.** Medium.
Evidence: `delivery.py:50-59` measures RMS over the word span with whatever else is in the mix (on the bridge, c010 and c011 sit under `sfx03` music); `:83` pitch bands are absolute (`<160`, `>200` Hz) and `spk_med` (`:72`) is computed and only written to `reference`, so the weight axis still encodes the actor's sex (review A 4.6, open); `:66-69` width is the centroid relative to the *scene* median, so with two voices one is always wide and the other narrow; `align.py:52` `language_code="en"` and the vowel regexes in `delivery.py:86,99` and `layout.ts:115` are English-only; nothing anywhere writes `caps` (zero `caps` or `stretch` in any shipped file), so "capitals for intensity" has no producer. For long films: `asd.py:30-50` keeps every face embedding and mouth patch in memory for the whole film; `sounds.py:35-43` writes two temporary WAVs per second and never deletes `tmp`; the native path creates one `VTTCue` per word boundary (`CaptionController.ts:186-187`), roughly 10,000 native cues for a feature, unmeasured on the platform.
Smallest fix: write these limits into `docs/authoring.md` as a "Scope" section; use `spk_med`; clean `tmp`.

**25. Overlapping speech can be auto-verified as the louder voice.** Medium.
Evidence: `diarize.py:42-43` `confidence` is the share of the cue covered by the *dominant* cluster; `propose.py:173` verifies at 0.6. A 65/35 overlap where the caption belongs to the quieter voice passes if the majority mapping agrees with the tag (which, under a guessed tag, it will, finding 1). On the bridge, c005 (Thom's line) gets `speakerProposal.speaker: celia, confidence 0.76, agreesWithTrack: false`; the disagreement is visible only in the review page, and the runtime never shows the proposal.
Smallest fix: covered by finding 1; additionally require the second-best cluster's share to be under 0.25 before any auto decision.

**26. The most important paths are untested.** Medium.
Evidence: the 45 core tests cover parsing, hashing, validation, the label rule, both resolver passes, native segments, loudness mapping, fail-closed status and colour-alone restore; the 20 app tests cover the controller's native splitting, leads, tick gating, the media clock, and seven pure layout rules. Untested: `DetailedOverlay.tsx` as a component (box, wrapping, three lines, italics, the `bottomHeight` measurement loop); `PlayerScreen.tsx` entirely (the chrome timer, cleanup, fallback controller); cue-level `offScreen` on an unverified cue (finding 3); wholesale rejection scope (finding 8); the Standard-mode lead (finding 7); sound-event layout (finding 13); the exported schema against the shipped assets (finding 10); every Python rule (finding 23).
Smallest fix: five tests, one per finding above, before any of the fixes; the fixtures already exist for three of them.

### Low

**27. Contrast is now measured; two colours sit within 4% of the target.** Low.
Evidence (computed, WCAG relative luminance, text over the 90% black box with white video behind it): speaker-1 12.95, speaker-2 11.14, speaker-3 4.95, speaker-4 6.19, speaker-5 10.21, **speaker-6 4.65**, support-1 5.00, support-2 10.28, support-3 12.72, support-4 11.85, support-5 11.15, support-6 12.02, support-7 8.48, support-8 4.91, **support-9 4.53**, support-10 5.74, support-11 5.18, support-12 5.43; read-ahead white 90% 14.28; viewer-colour read-ahead at 60% opacity 5.2 (yellow) and 6.95 (white). All pass 4.5:1, but `docs/accessibility-decisions.md:87` still says "checked by inspection ... not measured", and the viewer's own `textBackgroundOpacity` at 75% takes pink to about 2.8:1 (their choice; say so).
Smallest fix: paste this table into §10 and drop the "by inspection" sentence.

**28. The label is not bold.** Low.
Evidence: `DetailedOverlay.tsx:224` `label: { fontWeight: "700" }` with `fontFamily` = "Roboto Flex" (`:151`); FL-024 says weight is chosen by family, not `fontWeight`.
Smallest fix: `fontFamily: font.bold` on the label.

**29. Lane continuity is never scoped to the shot.** Low.
Evidence: `CaptionController.ts:100,248` `previousLaneBySpeaker` is keyed by speaker and never cleared on shot change or seek; `docs/architecture.md` §5 says "within the shot".

**30. Off-screen is still decided by a regex over the display label.** Low.
Evidence: `resolver.ts:145` `/UNKNOWN|VOICE|PHONE|RADIO|OUTSIDE|OFF[- ]SCREEN/i.test(labelText)` (review A 4.10, unchanged). A character called "Voice" is italic forever.

**31. The About screen shows a private LAN address to the viewer.** Low.
Evidence: `AboutScreen.tsx:25` prints `DEV_HOST`; `config.ts:18` commits `192.168.1.84`. A judge reads "Stream server for this build: 192.168.1.84:8081".

**32. Face-recognition output ships in the companion file.** Low.
Evidence: `propose.py:186` writes `faceIdentities` (SFace embedding clusters with sample boxes of the actors, `asd.py:103`) into `companion.en.json`; tos-bridge carries eight. `docs/accessibility-decisions.md:128`: "No ... face recognition ... anywhere in the runtime." True of the runtime, but the shipped data file is the first place a judge will see "face recognition" and the second place they will see §128.
Smallest fix: keep `asd.json` in `.author/`; write only `speakerProposal.face.identity` per cue.

**33. The music label reads "♫ music ♫".** Low.
Evidence: `sounds.py:72` lowercases the PANNs class name as the label; both bridge music events are `music`; `DetailedOverlay.tsx:169,177` wrap it in notes. Row 31 describes "dramatic music"; the file no longer says that.

**34. Repository weight.** Low.
Evidence: `git ls-files` largest: 38.6 MB, 30.3 MB and 27.2 MB device logs, two 13–22 MB film excerpts twice each (assets and `assets/raw` HLS). Combined with finding 2, any history rewrite is now a 259 MB job.

---

## Assumptions I could not verify without hardware or a person

- **Anything on a Fire TV Stick.** Every rendering, focus, timing and memory claim above is read from code or from VVD captures. Findings 5, 6, 14 and 18 are stated from the code and need one device session each to confirm; finding 6 in particular could be masked if `timeupdate` on hardware fires less often than every four seconds, which nothing in the logs suggests.
- **Whether the italic face renders.** I have the font list and FL-024; I do not have a capture of an off-camera cue in Detailed.
- **Whether the captures match `f5cda10`.** All 91 dated captures are from Sep 2; the last commit changed the bridge lanes and the auto rules after most of them; no capture carries a build id.
- **The Caption with Intention PDF and template.** Every "CI 2.x.y" reference is unverifiable from the repository; the compliance findings (11, 12, 13, 14) are against `docs/prior-art.md`'s own summary of the rules.
- **Any Python tool's behaviour when run.** whisperx, pyannote, audiotimm and the ONNX models are not installed here; findings 4, 9, 23, 24 and 25 are from reading the source and the JSON it produced.
- **What the concurrent editor intends.** Six files changed under me during this pass; I reviewed the working tree as it was at the end of the read, and the uncommitted state of `propose.py`, `store.ts`, `AboutScreen.tsx`, `README.md`, `accessibility-decisions.md` and `sync-report.md` may differ by the time this is read.
- **The name, the licence and the outreach.** Decisions for Samuel; nothing in the tree shows them moving since Sep 2.
