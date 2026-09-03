# Fable review B, 2026-09-02 — verification pass

Verification of the fixes claimed against `docs/reviews/fable-review-2026-09-02.md`. Tree at `72f488e` when the code read below was taken; `ccecfd1` landed mid-review and added `docs/device-log-2026-09-02-render-latency-plain.txt` plus one line to `docs/sync-report.md:81`. Working tree clean.

`npm test` from the repository root: **62 pass, 0 fail** — 45 in `packages/core/test` (348 ms), 17 in `apps/vega-player/test-node` (354 ms). Up from 41 + 11.

`assets/tos-bridge/companion.en.json` carries 62 `verifiedBy` fields: 48 `"score>=0.5"` on words, 14 `"dev-bench"` (11 delivery objects, 3 sound events). `npm run validate -- assets/tos-bridge/captions.en.vtt assets/tos-bridge/companion.en.json` prints `warning $: MACHINE-VERIFIED DATA: 48 words, 11 delivery entries, 3 sound events carry status "verified" set by a rule, not a person` and exits `OK (8 warnings)`. Confirmed. Same warning fires on `the-envelope` (117/31/0, 14 warnings) and `tos-lab` (51/19/0, 39 warnings). `assets/the-envelope/companion.en.json` has 148 `verifiedBy` fields, `assets/tos-lab/companion.en.json` 70.

---

## 1. Section 2 claims (claims-versus-evidence table)

| # | Prior verdict | Now |
|---|---|---|
| 1 | README says `npm test` fails | **FIXED.** `README.md:134` now reads "Root `npm test` runs the core suite and the app's Node tests (45 and 11 at the time of writing)". The jest sentence is gone. The count is wrong (see 2). |
| 2 | "34 core / five app" | **NOT FIXED.** `README.md:172` still says "34 in `packages/core/test` … Five more in `apps/vega-player/test-node`" and "All pass on September 2, 2026". Actual 45 and 17. |
| 3 | "39 core and 10 app" | **PARTIALLY FIXED.** `README.md:259` now says "45 core tests and 16 app tests"; actual is 17. `README.md:134` says 11. Three different app counts in one file, none correct. |
| 4 | "31 cues, OK with one warning" | **NOT FIXED.** `README.md:168` unchanged; the validator returns `OK (14 warnings)` — 12 reading-rate, one `c024` proposed, one MACHINE-VERIFIED. |
| 5 | "Settings are exactly two" | **FIXED.** `README.md:38`: "caption mode, reduced motion, and two Detailed-only toggles (word highlighting; size and weight follow the voice)". |
| 6 | "Settings are in memory only" | **FIXED.** `README.md:38` "They persist on the device"; the Limitations entry is consistent. |
| 7 | "not yet font family or window background" | **NOT FIXED, three places.** `README.md:237`, `docs/accessibility-decisions.md:26` and `:136` all still say it. `DetailedOverlay.tsx:96` applies `textFont` and `:99` applies `windowBackgroundColor`/`windowBackgroundOpacity`. |
| 8 | "FL-001 to FL-011" | **NOT FIXED.** `README.md:247` now says "FL-001 to FL-024"; the log ends at FL-027 (`docs/friction-log.md`, FL-025/026/027 added in `7547935`, `73fd726`, `4a79274`). |
| 9 | "no assets from it are used here" | **NOT FIXED, and now self-contradicted.** `README.md:203` unchanged, while `README.md:273` states "All other palette values are the design system's". A reader hits both. |
| 10 | "schema version 0.1" | **PARTIALLY FIXED.** `README.md:61` still says 0.1 over 0.2 assets; `assets/tos-bridge/README.md:10` and `assets/tos-lab/README.md:10` still say "schema 0.1 metadata". |
| 11 | verified fails open on words/delivery | **FIXED.** `resolver.ts:196` `if (w.status !== "verified")`, `:216` `if (!verified || d.status !== "verified")`, both with the comment "absent status is not verified". Test `core.test.ts:421`. |
| 12 | lane calibration unbacked | **NOT FIXED.** `README.md:189`, `lanes.ts:68`, `docs/architecture.md:161-162` and `docs/gate-1-prototype.md:88` repeat 9.5% / 1.74%; no capture, log or measurement record exists for either. FL-026 now explains the mid-frame capture as a viewport-vs-screen difference, which is plausible but is a second reason the estimator's rectangles are not the renderer's. |
| 13 | sync tables | **STILL SUPPORTED.** Re-ran `npm run sync-report` on three logs; every table reproduced digit-for-digit (details in §5). |
| 14 | lost cues 0 | **STILL SUPPORTED.** 0 of 11 in all three re-runs. |
| 15 | Measurement R, no tool | **UNCHANGED.** `tools/sync-report.ts` still does not parse `[render]` lines; I re-derived the new plain-elements row by hand (n=49, p50 2, p95 4, max 24 — exactly `docs/sync-report.md:81`). |
| 16 | "overlay only re-renders at boundaries" | **UNCHANGED.** `CaptionController.ts:212` gates on `renderKey`, but `:196`, `:216`, `:260` and `:268` all reset `renderKey = ""` and emit, so `onCueChange` and `recompute` still commit outside clock boundaries. |
| 17 | `2026-09-01-*.png` matches nothing | **NOT FIXED.** `docs/phase-reports.md:140` unchanged; zero files match. |
| 18 | "12 captures" | **NOT FIXED.** 75 files now match `docs/captures/2026-09-02-*.png`. |
| 19 | gate card "34 core tests" | **NOT FIXED** (historical text, `docs/phase-reports.md:27,47`). |
| 20 | lead numbers | **SUPPORTED**, superseded by the 100/100 run (§5). |
| 21 | "weight by pitch band" | **NOT FIXED.** `layout.ts:12-13` still sets both `WEIGHT_BY_PITCH` and `FAMILY_BY_PITCH`; FL-024 (`docs/friction-log.md:197`) still says faces are chosen by family name. `README.md:257` and integration row 34 still say "weight". What varies is width. |
| 22 | row 28 contradicted by its own capture | **PARTIALLY FIXED.** `docs/captures/2026-09-02-ci-detailed-thom-bottom-two-lines.png` was replaced (`5057f5c`) and now shows a correct left-to-right reveal. Row 28 adds "the film is letterboxed, so a second caption line that sits over the black bar shows no visible box edge; the box does enclose it". I opened the capture: the box's left and right edges match line 2's extent, so the explanation is consistent — but the capture cannot show it, and no capture over a non-letterboxed shot was added. Asserted, not demonstrated. |
| 23 | row 30 word colouring | **STILL SUPPORTED.** |
| 24 | row 31 side-lane clipping | **NOT FIXED.** `docs/captures/2026-09-02-sounds01-music-overlap-sidelane.png` is unchanged (not in any commit since); I opened it and the lower third of "Whatever, Thom. We're done." still sits outside the bottom edge of its black box. Row 31 still cites `sounds0*.png` as Verified. Sound events still bypass layout: `CaptionController.ts:245` hard-codes `lane: "bottom_center", stackIndex: 99`. |
| 25 | row 37 per-cue sizing | **NOT FIXED.** `DetailedOverlay.tsx:118` still computes one `lineSize` per cue and `:144`/`:178` pass it to every `WordEl`; `layout.ts:33` still takes `Math.max` of the word `loudDb`. Per-word `loud`/`loudDb` still changes nothing on screen. |
| 26 | canonical text 100% | **UNCHANGED.** `CaptionController.ts:162` still prepends `${label}\n`, `:180` still wraps in `<c.class>` spans. |
| 27 | honest rows | **STILL HONEST**, and row 36's fallback caveat survived. |
| 28 | simulator-only disclosure | **STILL SUPPORTED.** |
| 29 | FL-022 | **STILL SUPPORTED.** |
| 30 | prior-art thresholds used past support | **PARTIALLY ADDRESSED.** The lead is now 100 ms (`CaptionController.ts:51-52`) and is justified by three measured runs rather than by the literature (`docs/sync-report.md:71`), plus a virtual-device visual check. See 3.3 below. |

---

## 2. Section 3 (correctness risks in the code)

**3.1 fail-open verification — FIXED.** `resolver.ts:196,216`; `tools/sync-report.ts` was not the runtime and the runtime is now closed. Test at `core.test.ts:421-433` asserts a status-less word is dropped, `delivery` becomes `undefined`, and `words_unverified`/`delivery_unverified` are reported. Residual: `status` is still optional in the exported schema (`schema.ts:119` requires only `i`/`startMs`/`endMs`; the `delivery` object at `:135-148` has no `required` at all), so a third-party author reading `schema/companion-profile-0.2.schema.json` gets no warning that a status-less entry is silently dropped.

**3.2 machine-invented spellings — FIXED at the tool.** `tools/author/propose.py:65`: a merged `stretch` demotes the word to `proposed` and strips `verifiedBy` unless it was human-verified. `resolver.ts:200` already required `collapseRuns(w.stretch) === collapseRuns(tokens[w.i])`. Hole: the guard is `w.get("verifiedBy", "human") != "human"`, so a word with `status: "verified"` and *no* `verifiedBy` (an older asset, a hand edit) keeps its stretch and is treated as human-approved.

**3.3 NATIVE_LEAD_MS 120 — PARTIALLY FIXED.** The lead is now 100 ms for both entries and word swaps (`CaptionController.ts:51-52`), chosen from three measured raw lags (176/81/56 ms entry, 99/95/114 ms word swap, `docs/sync-report.md:71`) rather than from the literature, and Method A was re-measured against a fresh clock. `NATIVE_LEAD_MS = 120` at `:42` is now dead — nothing reads it, and `docs/sync-report.md:50` and the tool's own footer line still name it. The measurement that would settle it (frame-accurate, on hardware) still does not exist, and 100 ms is above the smallest measured raw entry lag of 56 ms, so a 44 ms early bias remains possible on the entry path. The virtual-device Measurement C data contains exactly one early sample (`native-rows.json`, `f0054.png`, `early>=180`) and `docs/sync-report.md:90` does not mention it.

**3.4 nearest-boundary bias in the sync tool — NOT FIXED.** `tools/sync-report.ts:74` unchanged. The headline "+16 ms" (now "+6/+16 ms", `docs/sync-report.md:71`) still comes from a matcher that snaps each event to the nearest of boundaries 100–400 ms apart while errors span ±130 ms.

**3.5 positional zip in the aligner — PARTIALLY FIXED.** `tools/author/align.py:59-72` now detects a global count mismatch, re-aligns cue by cue and drops any cue whose own count still disagrees. It does not check per cue when the global counts happen to agree (one dropped word in cue 2 and one added in cue 5 still zips clean), and there is still no committed authoring run log, so I still cannot tell whether it fired on any shipped scene.

**3.6 delivery verified with no test — PARTIALLY FIXED.** `propose.py:58-59` now gates delivery on an explicit `--accept-delivery` flag and stamps `verifiedBy: "dev-bench"`; `--accept-min-score` no longer verifies delivery as a side effect. There is still no score threshold on delivery: the flag verifies every cue's delivery object, which is why all 11/19/31 delivery entries are machine-verified in the three scenes.

**3.7 comment asserting a property the code lacks — FIXED by correcting the comment.** `propose.py:69-71` now says the resolver honours protected regions whatever their status and argues why that is the safe direction. The code is unchanged; the claim now matches it.

**3.8 untimed/unverified words inferred as spoken — PARTIALLY FIXED.** `layout.ts:53-61` `spokenAt` is now a documented rule (an untimed token colours once a later timed word has started or the previous timed word has ended, never before) with a test at `overlayLayout.test.ts` ("untimed words follow neighbours and never lead them"), and the result is visible in `docs/captures/2026-09-02-label-restored-c003-bottom.png`, where the reveal now reads left to right. `resolver.ts:446` still colours the entire cue when no verified timing exists at all.

**3.9 token indices from two strings — FIXED.** `layout.ts:45-47` `tokenLines` runs each line of `plainText` through the core's `normalizeVisibleText`, and `overlayLayout.test.ts` asserts it matches `visibleTokens`. `resolver.ts:283` still indexes a third string (`c.text.split(/\s+/)`) inside `estimate()`, but that only sizes the box.

**3.10 orphan cues / constructor throw — FIXED for orphans, PARTIALLY for the throw.** `CaptionController.ts:183-188`: removal first, `this.nativeCues = []`, then per-cue try/catch on `addCue` that records only what was added. The constructor can still throw (`nativeWordSegments` at `:180` is outside any try/catch), but `PlayerScreen.tsx:167-175` now catches it and rebuilds a Standard-only controller, and `App.tsx:44` wraps the screen in `ErrorBoundary`. New hole: the failed first controller is never disposed, so any cues it managed to add before throwing stay on the shared `TextTrack` and the fallback controller adds a second set.

**3.11 dispose does not detach cues — FIXED.** `CaptionController.ts:277`.

**3.12 mode change during asset load — FIXED.** `PlayerScreen.tsx:84` keeps `settingsRef` current and `:179` applies `settingsRef.current` after construction.

**3.13 state mutated inside an argument expression — RENAMED, NOT FIXED.** `layoutNow` at `CaptionController.ts:230-233` now writes `this.pendingSfx` and `emitOverlay` at `:236` reads it. The ordering dependency is identical: `:196`, `:216`, `:259` and `:269` all rely on `layoutNow()` being evaluated while building `emitOverlay`'s argument. It is now documented rather than accidental, which is better, but a refactor that hoists the patch object still breaks sound-event onset silently.

**3.14 speaker-4 and support tokens lose word colouring silently — PARTIALLY FIXED.** `CaptionController.ts:190-193` logs `[mode] native colour unavailable for N cue(s)`. It goes to the dev log only; no `fallbackReasons` entry, nothing in the diagnostics panel.

**3.15 reveal disappears under a viewer colour — FIXED.** `DetailedOverlay.tsx:174-175`: the reveal survives as opacity (60% → 100%) in the viewer's hue.

**3.16 dead `speaker_unavailable` — FIXED.** `resolver.ts:134` pushes it once with no undo; test `core.test.ts:463`.

**3.17 reason pushed after de-duplication — FIXED.** `resolver.ts:347` now guards with `.includes("no_safe_lane")` before pushing past the `new Set` at `:345`.

**3.18 `resolveAlone` grouping — FIXED, AND OVER-CORRECTED (see §3 below).** `resolver.ts:391-398` now sweeps connected components; the test at `core.test.ts:449` asserts the new behaviour.

**3.19 negative seek — FIXED.** `PlayerScreen.tsx:230,232` guard with `Number.isFinite(p.duration) && p.duration > 0`.

**3.20 development code in the viewer path — PARTIALLY FIXED.** `PlayerScreen.tsx:235` and `:242` now `break` unless `diag` is on, and the font probes at `:268-273` render only while `diag` is on. `diag` is toggled by the remote's Info button (`:233`), so the path is two remote presses from a viewer; there is still no `__DEV__` guard.

**3.21 no offline path — FIXED in code, UNVERIFIED in evidence.** `apps/vega-player/src/media/fileScheme.ts` registers a Shaka `file:` scheme over XHR and `PlayerScreen.tsx:44-54` probes the LAN manifest for 1.5 s before falling back; packaged HLS renditions are committed for all three scenes. `DEV_HOST` is still a hard-coded private LAN IP (`media/config.ts:17`). No committed log shows the fallback firing — see §4.

**3.22 remote track paired with a bundled companion — FIXED.** `PlayerScreen.tsx:72-77` returns the remote companion only alongside the remote VTT, with the reason in a comment.

**3.23 emoji-presentation arrows — FIXED.** `DetailedOverlay.tsx:141,153,159` emit `︎` after the arrows. Not re-captured, so the rendering is unverified.

**3.24 window size read at module load — FIXED.** `DetailedOverlay.tsx:82-83` uses `useWindowDimensions()` with the module constant only as a fallback.

---

## 3. Section 4 (accessibility and design)

**4.1 red fails contrast — FIXED, and the arithmetic checks out.** `theme.ts:23` is now `#FF3B3B` with the working shown in the comment. I recomputed: `#E51717` is 4.44:1 on black and 3.70:1 over the 90% box on a white shot; `#FF3B3B` is 5.94:1 and 4.95:1. Both match the committed figures. The twelve support shades were not measured; `support-8` `#5E82ED` computes to 4.9:1 over the box on a white shot, i.e. still marginal. `docs/accessibility-decisions.md:87` still says contrast "has been checked by inspection … not measured"; only the red is measured, in the addendum at `:146`.

**4.2 read-ahead and unverified share one white — PARTIALLY FIXED.** The arbitrary interleaving is gone (3.8). Three states still render identically: read-ahead, a sound caption and a word whose neighbours have not yet reached it are all `READ_AHEAD` / `#FFFFFF` at `DetailedOverlay.tsx:130,144`.

**4.3 colour-only attribution — FIXED.** `resolver.ts:336-340` restores `suppressedLabel` whenever a coloured cue lands at `bottom_center` without a label, and clears `label_suppressed_by_rule`. Test `core.test.ts:435`; capture `docs/captures/2026-09-02-label-restored-c003-bottom.png` shows THOM restored on the exact cue the earlier device log had logged in the forbidden state. Side effect not discussed anywhere: on the native path most cues land at `bottom_center`, so the label-frequency rule is now largely inert in Speaker-aware and Detailed.

**4.4 reading rate fails the project's own gate — PARTIALLY FIXED.** `tools/author/retime.py` was added and applied. The Envelope went from 12 over-rate cues to 12 (c001 206, c002 214, c005 180, c009 180, c013 183, c014 216, c015 189, c020 196, c021 181, c025 187, c030 180, c031 180 wpm); tos-bridge went from 6 to 5, worst case c008 from 420 to 375 wpm. `docs/accessibility-decisions.md:154` reports "8 cues too fast" for The Envelope and 5 for tos-bridge; the validator reports **12** for The Envelope. `tools/bundle-assets.ts` still warns rather than errors. G6 is still unmet on both study instruments.

**4.5 `accessibility-decisions.md` contradicts itself — NOT FIXED.** `:47` still reads "Word-by-word reveal is not implemented … the first thing cut" while `:140` onward describes the shipped word pop and `:148` describes untimed-word colouring. `:123` still asserts "Only human-verified metadata reaches an enhanced render", which is false of every shipped scene and is contradicted by `README.md:270`. `:85` now also misstates the code: it says the box defaults to 80% opacity; `DetailedOverlay.tsx:93` uses 0.9.

**4.6 pitch bands are absolute, `spk_med` computed and discarded — NOT FIXED.** `tools/author/delivery.py` unchanged in the fix commits.

**4.7 no overflow clamp — NOT FIXED.** `DetailedOverlay.tsx:118` still allows `0.12 × 2.0 = 24%` of screen height per line with no two-line cap; `resolver.ts:319` still `break`s out of the lane loop at `bottom_center` before any size, title-safe or protected-region check. `docs/accessibility-decisions.md:127` still claims no caption may overflow.

**4.8 the box does not cover its own text — NOT DEMONSTRATED EITHER WAY.** The two-lines capture was replaced and its box now matches line 2's horizontal extent (consistent with the letterbox explanation in row 28). The side-lane capture `2026-09-02-sounds01-music-overlap-sidelane.png` is unchanged and still shows clipped glyphs. `72f488e` replaced `Animated.Text` with plain `Text` under Reduced motion (`DetailedOverlay.tsx:47-49`), which is the most likely fix for the `wordRow` height under-measurement, but no capture was taken after it. There is still no layout test that would catch a box shorter than its text.

**4.9 the renderer's placement is not the estimator's — DOCUMENTED, NOT FIXED.** FL-026 (`docs/friction-log.md:207-213`) now explains it: the native renderer positions within the letterboxed picture, the overlay within the screen. The estimator (`lanes.ts:80`) is unchanged, so the title-safe, protected-region and collision checks on the native path are still evaluated against rectangles that do not match the renderer's. FL-026 cites no capture.

**4.10 off-screen decided by regex over a label — NOT FIXED.** `resolver.ts:145` unchanged.

**4.11 both new toggles default on — NOT FIXED.** `settings/store.ts:29` still defaults `wordHighlight` and `deliveryTypography` to `true`, so selecting Detailed still delivers colour, size and width at once — the Caption Royale condition.

**4.12 nothing in the overlay is tested — FIXED for the rules, NOT for the component.** `apps/vega-player/src/captions/detailed/layout.ts` is a pure module with 5 tests in `test-node/overlayLayout.test.ts` covering token indexing, `spokenAt`, size/weight rules, side-lane clearance and pop duration. `DetailedOverlay.tsx` itself — the box, the lane styles, the overflow, the `wordRow` measurement — still has no test.

---

## 4. Section 5 (process and evidence hygiene)

**5.1 reproducibility — STILL THE STRONGEST ASSET, and it held.** I re-ran `npm run sync-report` on three committed logs. `docs/device-log-2026-09-02-native-eventclock.txt` reproduced `docs/sync-report.md:66-67,69` exactly (word 37 / +14 / +126 / +142 / −88; cue 17 / −74 / +115 / +121 / −109; B 19 / +0 / +2 / +3). `...-detailed-eventclock.txt` reproduced `:68-69` exactly (A 16 / +57 / +116 / +118 / −120; B 19 / +1 / +7 / +9). `...-native-lead100-eventclock.txt` reproduced `:71` exactly (word p50 +6, p95 +132; cue p50 +16, p95 +115; 0 of 11 lost). The drift claim at `:62` ("mean 0 ms, max 49 ms, n = 192") is the literal last `[wordclock] anchor drift` line of the detailed log. The new plain-elements row at `:81` (n 49, p50 2, p95 4, max 24) reproduced by hand from `docs/device-log-2026-09-02-render-latency-plain.txt`. Measurement R still has no committed tool.

**5.2 machine-verified demo assets — NOT FIXED; DISCLOSED INSTEAD.** `assets/tos-bridge/companion.en.json` is still 48/76 words at `verifiedBy: "score>=0.5"`, all 11 delivery objects and all 3 sound events at `verifiedBy: "dev-bench"`. `docs/authoring.md` still prohibits this for demo assets. What changed is that the state is now machine-detectable and loudly reported: `schema.ts:373` emits the MACHINE-VERIFIED warning, `README.md:270` discloses it, and every entry carries `verifiedBy`. That is a real improvement in honesty and no improvement in the data. The counting rule has a hole: `schema.ts:338,366,411` count an entry only when `verifiedBy` is present and not `"human"`, so a `verified` entry with no `verifiedBy` at all is silently treated as human-reviewed, and `verifiedBy: "human"` is a self-report anyone can write.

**5.3 The Envelope's delivery measures a TTS voice — NOT FIXED.** No document says the delivery typography in The Envelope captures derives from `say` output.

**5.4 summaries drifted — PARTIALLY FIXED.** Five of the ten README errors are corrected (claims 1, 5, 6, and partially 3, 10); five are not (claims 2, 4, 7, 8, 9), and claim 3 acquired a new wrong number. The `accessibility-decisions.md` self-contradiction is untouched. The scene READMEs still say schema 0.1.

**5.5 licences — PARTIALLY FIXED.** `apps/vega-player/assets/fonts/OFL.txt` now ships beside the five TTFs. `docs/licensing.md` is new, states the Shaka problem precisely, notes that history contains the file, and says in terms: "Until one is done, do not publish the repository or enter the Open Source mini-challenge." That is the right instruction and it is written down. Nothing is resolved: there is still **no `LICENSE` file anywhere in the tree**, `ShakaPlayer.ts:1-13` still carries the AMAZON PROPRIETARY/CONFIDENTIAL header with no LICENSE.TXT, no permission has been sought, and the Tears of Steel on-screen credit still does not say "excerpt, re-encoded".

**5.6 other things a judge would notice — MOSTLY UNCHANGED.** `media/config.ts:17` still commits `192.168.1.84`. `schema.ts:30-31` still declares the 0.1 `$id` and title. The product is still "Sightline" everywhere; `docs/name-review.md:3` still says "awaiting Samuel's approval".

---

## 5. The ten ranked next steps

1. **Re-author tos-bridge through the review page — NOT DONE.** 48 words, 11 delivery objects and 3 sound events are still machine-verified. Mitigated by disclosure (5.2), not by work.
2. **Settle Shaka, add LICENSE — PARTIALLY DONE.** OFL.txt shipped, `docs/licensing.md` written with a publish-blocker instruction; no LICENSE, no decision, no permission request.
3. **Send the DHH outreach — NOT DONE.** `docs/validation-plan.md:5` still reads "Outreach has not been sent"; `:43` still shows "Sep 2 | Outreach begins". Today is September 2 and nothing in the tree shows it went.
4. **Set the lead to 0 or cap it — PARTIALLY DONE.** 120 → 100, justified by three re-measured runs and one virtual-device visual check rather than by the literature. Still above the smallest measured raw entry lag (56 ms), still no frame-accurate hardware measurement, and the one early Measurement C sample is unreported.
5. **Fix the verification fail-opens — MOSTLY DONE.** Runtime fails closed with a test (`resolver.ts:196,216`; `core.test.ts:421`); `propose.py:58` no longer verifies delivery as a side effect; `align.py:59-72` re-aligns per cue on a count mismatch. `status` is still optional in the JSON Schema, delivery still has no score threshold, and the per-cue check does not run when global counts happen to agree.
6. **Fix the overlay box, add overlay tests — PARTIALLY DONE.** `layout.ts` extracted with 5 tests; the box behaviour is still untested, the side-lane capture still shows clipping and was not retaken.
7. **Re-time the tracks — PARTIALLY DONE.** `retime.py` added and applied; The Envelope still fails 12 cues, tos-bridge 5. Still a warning, not an error, in `tools/bundle-assets.ts`.
8. **Correct README and the accessibility record — PARTIALLY DONE.** See 5.4. The "Honesty notes" section (`README.md:268-273`) is new and is the single best documentation change in this batch: it names the machine-verified data, the reading-rate failures, the lead, and the palette change in four sentences.
9. **Colour-only attribution and the red — DONE.** Both (4.1, 4.3), with a test, a capture and correct arithmetic.
10. **Runnable without a laptop, record early — CODE DONE, EVIDENCE MISSING.** See 3.21 and §4 below. No demo cut exists.

---

## 6. Regressions and new findings

**R1. `resolveAlone` now drops every cue in a three-cue overlap chain to the bottom lane.** `resolver.ts:391-398` groups by connected component; `layoutActiveSet:306` then computes `forceBottomStack = dialogue.length > 2` over that whole component, and `:303` shares one `occupied` array across it. I ran it: for A (0–2000 s, lower_left), B (1500–3500, lower_right), C (3000–5000, lower_left) — A and C never on screen together — all three come back `bottom_center` with `no_safe_lane` and `stackIndex` 0/1/2, and the bottom-stack rule at `:353-364` forces labels on all three. The same A and B alone keep `lower_left` and `lower_right`. This is the native path used by Standard and Speaker-aware, i.e. the default mode, and the test at `core.test.ts:449` asserts the new behaviour as correct. It is latent today: I checked all ten committed tracks and none has a single overlapping cue pair. The right shape is transitive grouping for occupancy but a *simultaneity* test (not group size) for `forceBottomStack`, and occupancy scoped to cues that actually co-occur.

**R2. `MediaClock` free-runs through a stall.** `MediaClock.ts:54-57` projects `anchorMedia + (performance.now() − anchorWall)` whenever `playing` is true, and `attach` at `:34-39` listens only to `timeupdate`, `seeked`, `play`, `playing`, `pause`, `ended`. There is no `waiting`, `stalled` or `ratechange` listener and no playback-rate term, so during a rebuffer the clock keeps advancing at wall-clock rate while media time is frozen and the overlay runs ahead of the picture. FL-019 already records that the VVD's picture trails the clock at startup and after a seek into a segment (FL-027's last bullet), which is the same failure with a different cause. The word clock (`useWordClock.ts:21`) and the controller both read this clock, so the whole Detailed path inherits it.

**R3. The fallback controller can double the native cues.** `PlayerScreen.tsx:167-175` builds a second `CaptionController` when the first throws, without calling `dispose()` on the first. If the throw happens after `rebuild`'s `addCue` loop (`CaptionController.ts:185-188`) — for example in `layoutNow` at `:196` — the first controller's cues remain on the shared `TextTrack` and the viewer sees each caption twice.

**R4. `NATIVE_LEAD_MS = 120` is dead but still authoritative-looking.** `CaptionController.ts:42` is exported, documented as the shipping value, and read by nothing; `tools/sync-report.ts` still prints "scheduled N ms early (NATIVE_LEAD_MS)". The two live constants are at `:51-52`.

**R5. `retime.py` mis-parses its own arguments.** `tools/author/retime.py:34` builds the positional list as `[x for x in sys.argv[1:] if not x.startswith("--")]`, which does not skip flag *values*, so `retime.py --gap-ms 80 captions.vtt` takes `"80"` as the file path. `--apply` rewrites the file in place with no backup.

**R6. `fileScheme.ts:26` treats `status === 0` with a truthy body as success**, which is correct for `file:` on this platform per FL-025 but will also swallow a partial or cross-origin failure if the plugin is ever reached with an http URI; the scheme registration at `:39` is keyed to `"file"` so this is currently unreachable.

**R7. `ErrorBoundary` covers render errors only.** `ErrorBoundary.tsx:14-31` is a class boundary around the player (`App.tsx:44`); the async setup path in `PlayerScreen.tsx:126-189` is covered by its own try/catch, and `App.tsx:23-29` installs a global handler that logs and re-throws fatals. Nothing catches a throw inside the `oncuechange` callback (`CaptionController.ts:123 → 252`), which runs outside React.

---

## 7. Documentation claims not supported by committed evidence

**D1. The offline path has no committed evidence.** `docs/friction-log.md:203` claims "72 cue events on the bridge excerpt with the LAN server stopped" and integration row 40 marks it **Verified** with `docs/friction-log.md FL-025` as its evidence column — the friction log citing itself. Every committed log that contains `[player] source=` shows `source=lan` (4 occurrences across `render-latency-plain`, `native-lead100-eventclock`, `native-eventclock`); `source=packaged` appears in no log. The one demo-day-critical capability is the one with no artefact.

**D2. Integration row 42 cites uncommitted evidence.** "scratchpad captures sk01–sk05 summarised in FL-027" — no seek captures exist under `docs/captures/`.

**D3. FL-027's headline numbers are not in any committed log.** `docs/friction-log.md:217` gives "120–220 ms typically and up to 710 ms" for polled staleness and "a mean of 7 ms over 160 events" for the event value. The eventclock logs post-date the fix and carry only `anchor drift`; nothing in the tree contains the comparison those two figures come from.

**D4. FL-026 cites no capture** for the claim that the native renderer places at 90% of picture height, which is the explanation now doing the work for both the "mid-frame cue" finding and integration row 28's box claim.

**D5. Measurement C under-reports the native path's disagreements.** `docs/sync-report.md:90` lists "40, 80, 140 ms; the rest are OCR misses on two-colour lines". `native-rows.json` actually holds seven disagreements: `late>=` 40, 80, 140, **180, 580, 820, 1120** and one `early>=180` (`f0054.png`). The doc's "the rest are OCR misses" is a manual judgement over four rows the tool classified as late and one it classified as early, and integration row 38 repeats it as "occasional 80–140 ms". The overlay half is accurate: 84 samples, 79 agree, disagreements exactly [20, 40, 20, 40, 40], tightest agreeing bounds 0/33/33/33 ms — all four figures match `overlay-rows.json`. The method's own limits are stated honestly at `:92`.

**D6. `docs/sync-report.md:58` is stale inside a current document.** It ends "The entry lead now sits at the midpoint, 130 ms" — the code has been 100/100 since `4a79274`, corrected only in the next section at `:71`.

**D7. `docs/accessibility-decisions.md:154` undercounts its own validator.** It says The Envelope "still has 8 cues too fast"; `npm run validate` reports 12.

**D8. README "Honesty notes" are accurate** on all four points — machine-verified data with the exact `verifiedBy` strings, the reading-rate failures, the 100 ms lead with the Measurement C caveat, and the red change — and every one checks out against the tree. The problem is that `README.md:203`, `:237`, `:247` and `docs/accessibility-decisions.md:47,85,123,136` were not brought into line with them, so the same file set states both positions.

---

## 8. Verdict

### (a) The hackathon submission plan: CONDITIONAL GO

The engineering answered the review seriously — the verification gate now fails closed with a test, the colour-alone hole is closed with a test and a capture, the red is measured and fixed, the orphan-cue and dispose and seek and settings-race bugs are gone, an offline path exists, an error boundary exists, an event-anchored clock replaced a stale polled read and every number that depended on it was re-measured and reproduces from the committed logs digit-for-digit — and the README "Honesty notes" (`README.md:268-273`) is exactly the disclosure a judge should find. None of that moves the verdict, because nothing on the critical path moved: there is still no `LICENSE` file, `ShakaPlayer.ts:1-13` still carries "AMAZON PROPRIETARY/CONFIDENTIAL" with no accompanying LICENSE.TXT in a repository intended for the Open Source mini-challenge, `docs/validation-plan.md:5` still says outreach has not been sent on the day its own schedule says outreach begins, `docs/name-review.md:3` still says awaiting approval, `docs/devpost-draft.md:50` still reads "[public URL after naming approval]", and no physical Fire TV and no demo cut exist. `docs/licensing.md` now says in writing "do not publish the repository or enter the Open Source mini-challenge" until the Shaka question is settled — the project has written its own submission blocker down and not yet cleared it. Seven weeks is still enough time, so the verdict stays conditional on the same list: settle Shaka or move to hls.js, add a LICENSE, send the outreach this week, and finish the five README/accessibility corrections that are still open.

### (b) A credible Caption with Intention implementation on Fire TV: CONDITIONAL GO

It is closer than it was and the newest evidence is the best in the repository: `docs/captures/2026-09-02-label-restored-c003-bottom.png` shows a correct left-to-right word reveal with a restored speaker label on real footage, the native word-colouring result stands, and the lead is now set from three re-measured runs against a clock the project proved was the honest one (FL-027) with every table reproducing from the committed logs. Two of the four devices CI specifies are still not what the documents say. Size does not follow volume per word: `DetailedOverlay.tsx:118` still computes one `lineSize` per cue and `:144`/`:178` hand that constant to every word, while `layout.ts:33` takes the maximum dB in the cue, so per-word `loud`/`loudDb` still changes nothing on screen and integration row 37 still says Verified. Weight still does not follow pitch: `layout.ts:12-13` sets both a weight and a family, and FL-024 (`docs/friction-log.md:197`) says the platform picks faces by family, so what varies is width — `README.md:257`, `docs/prior-art.md:23` and row 34 still say weight. The 90% box is unproven in both directions: the replaced two-lines capture is consistent with the box enclosing line 2 but cannot show it, and the unchanged `2026-09-02-sounds01-music-overlap-sidelane.png` still shows a side-lane line running past the bottom of its box, with row 31 still marked Verified against it and still no layout test that would catch it. Above all, the gate that separates this from an automated effect still has not been used: every word, delivery and sound entry in all three real scenes is machine-verified, which the project now says out loud in four places and has not yet fixed in one. Fix the per-word size, correct the weight-versus-width language, retake the box captures, and run one scene through the review page, and the claim is fully defensible.

---

## 9. The five most valuable remaining actions

1. **Run `assets/tos-bridge` through `tools/author/review_server.py` and ship it with `verifiedBy: "human"`.** It is the demo scene, it backs eight "Verified" rows, and it is 11 cues and 76 words. Everything else in this report is a detail beside a judge opening `companion.en.json` and finding `"score>=0.5"` next to a claim about human verification. The validator will stop printing MACHINE-VERIFIED for that file, which is the proof.
2. **Clear the licence blocker the project wrote for itself.** `docs/licensing.md` says not to publish until the Shaka question is answered; answer it (upstream shaka-player from npm plus a patch is option (a) and is a day's work), add a `LICENSE`, and add "excerpt, re-encoded" to the Tears of Steel credit. Until then the Open Source entry cannot be filed, and the file is in 150 MB of history.
3. **Send the DHH outreach today and prove the offline path in the same session.** The schedule at `docs/validation-plan.md:43` says today; the hard gate is September 12. In the same sitting, stop the LAN server, play the bridge excerpt, and commit the log showing `[player] source=packaged` — D1 is the only demo-critical capability with no committed evidence, and FL-018's four-hour VVD limit means capture day is not the time to discover it.
4. **Make size follow volume per word, or stop claiming it.** `DetailedOverlay.tsx:118` → per-word `heightPctForLoudness(w.loud, w.loudDb)` passed into `WordEl`, with a two-line cap and a height clamp so 4.7 closes at the same time; then retake the box captures (side lane and a non-letterboxed two-line cue) and add one layout test that fails when the box is shorter than its text. This is the largest remaining gap between the documents and the pixels.
5. **Close the six documentation errors that survived, in one pass.** `README.md:168` (14 warnings, not one), `:172` (45/17), `:237` and `docs/accessibility-decisions.md:26,136` (font family and window background are applied), `README.md:247` (FL-027), `README.md:61` and both scene READMEs (schema 0.2), `docs/accessibility-decisions.md:47` (word reveal is implemented — point it at `docs/expressive-plan.md:36-38`), `:123` (not true of any shipped asset), `:154` (12, not 8), and `docs/sync-report.md:58` (100 ms, not 130). Each is one line, and the "Honesty notes" section already sets the standard the rest of the file should meet.
