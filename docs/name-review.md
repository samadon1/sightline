# Name collision review

**Search date:** 2026-09-02. **Status:** decided September 3, 2026: the repository is published under the name Sightline; the search below stays as the record of what was found. Scope: replacement for the rejected codename (Sightline Media, UK video accessibility incl. captioning; live US SIGHTLINE software marks).

**Criteria applied:** 1 or 2 words, ideally 8 letters or fewer; pronounceable in English; not medicalized; not patronizing; not built on hearing as the norm (no hear/ear/sound/silent/deaf- constructions); does not imply we invented captions or that captions are AI-generated; evocative of choice, context, lanes, stability, safety net, progressive enhancement, or who-is-speaking. Coined words allowed.

**What "checked" means:** for every candidate: web searches for the exact name with "captions", "subtitles", "app", "Fire TV" and "streaming"; the npm registry; the GitHub users/orgs API and repository search; HTTP fetch of .com/.app/.tv; USPTO wordmark "contains" search on tmsearch.uspto.gov (shortlist only) plus Trademarkia US and UK filters; UK Companies House by name. Nothing was bought, reserved, or contacted. "No response" for a domain means no HTTP answer, not proof it is unregistered.

## Candidate table

| Candidate | Direction | Meaning | Conflicts found | npm / GitHub | Risk | Verdict |
|---|---|---|---|---|---|---|
| **Cuelith** | coined | cue + -lith (stone): the approved cue set in stone; everything else is added on top | None found. USPTO 0 live / 0 dead. Trademarkia US 0 / UK 0. Companies House none. cuelith.com whois "No match". PyPI 404. | npm `cuelith` free, no `@cuelith/*`. GitHub org free. | Low | Primary. |
| **Softfall** | fallback / safety | a soft fall: every enhancement lands safely on plain captions | No software use. Generic Australian term for playground impact surfacing (Softfall Surfaces Pty Ltd; softfallguys.com.au), unrelated class. USPTO 0/0. Trademarkia 0/0. softfall.com registered (AU registrar, no site). | npm free. GitHub org free (6 unrelated hobby repos). | Low | Backup 1. |
| **Saidby** | who-is-speaking | "said by": the caption carries who is speaking | saidby.com parked for sale (HugeDomains). GitHub user Saidby exists (2022, dormant). Musician "SaidBySed". Companies House: SAID BY RABIAH LTD (unrelated). USPTO 0/0. | npm free. GitHub handle taken; use `saidby-tv`. | Low to medium | Backup 2. |
| Cuerail | lanes | cues on a rail | Dead USPTO mark CUERAIL 90046695 (queue-rail hardware, class 9, abandoned). French farm SCEA DU CUERAIL. | npm free. GitHub org free. | Low to medium | Reserve. |
| Cuedial | viewer choice | a dial per cue | Live product cuedial.com (business calling app). USPTO 0/0. | npm free. GitHub org free. | Medium | Reserve only. |
| Cuelane | lanes | each cue in its own lane | Live SaaS cuelane.com (Dutch presentation tool); cuelane.app redirects there. | npm free. | Medium to high | Avoid. |
| Sidelane | lanes | enhancements beside the words | sidelane.app "coming soon"; sidelane.com parked; two UK companies; US startup; artist. | GitHub user taken. | Medium | Skip. |
| Namecue | who-is-speaking | the name, on cue | Live USPTO application NAMECUE 99622097 (2026, class 9 name/face identification app); namecue.app live. | GitHub taken. | High | Reject. |
| Sayline | who-is-speaking | the line and who says it | Live product sayline.app (macOS dictation). | GitHub taken. | High | Reject. |
| Keel | stability | the keel keeps the boat upright | npm `keel` taken; keel-hq/keel 2.7k stars; multiple live KEEL class 9/42 marks. | Taken. | High | Reject. |
| Holdfast | safety net | hold fast to the approved words | HOLDFAST registered (game, classes 9/28/41/42); holdfast.media. | npm taken. | High | Reject. |
| Leeway | viewer choice | room to choose | Pending LEEWAY class 9 (2026); gitpod-io/leeway; App Store developer. | GitHub taken. | High | Reject. |
| Yourcue | viewer choice | your cue | Your Cue Ltd UK med-tech; yourcue.com is "Cue AI". | GitHub taken. | High | Reject (also medical association). |
| Cuevo | coined | abstract | cuevo.app "Audio cues made easy"; dead CUEVO marks (class 36); adjacent to a piracy brand name. | GitHub taken. | Medium to high | Reject. |

## Recommendation

**Primary: Cuelith.** Nothing against it on any axis checked: no web presence, no USPTO record live or dead, no Trademarkia US/UK hit, no Companies House entry, unregistered .com, free npm name and scope, free GitHub org, free PyPI name. "Cue" is the unit the runtime works in (a WebVTT cue); "-lith" (stone) carries stability and "never put the approved words at risk". It says nothing about hearing, medicine, AI, or inventing captions. Pronounced "KYOO-lith", seven letters. Watch-out: "cue" alone is crowded in billiards and event-tech marks, so keep the single word and never shorten it to "Cue".

**Backup 1: Softfall.** Most evocative of the mechanic (a graceful, cue-by-cue fall to plain captions). Clean in software. Costs: softfall.com is registered (no site), and "soft" can read as weak in a settings menu.

**Backup 2: Saidby.** Best of the attribution direction. Clean at USPTO and Trademarkia. Costs: saidby.com parked for sale; the bare GitHub handle is held by a dormant account.

### Exact strings if Cuelith is approved

- Product name: `Cuelith`
- GitHub: `github.com/cuelith` / `cuelith/cuelith`
- npm: `@cuelith/core`, `@cuelith/vega`
- Vega package id: `dev.cuelith.player` (register `cuelith.dev` first; otherwise `com.cuelith.player`)

Fallbacks: `Softfall` / `@softfall/core` / `dev.softfall.player`; `Saidby` / `github.com/saidby-tv/saidby` / `@saidby/core` / `dev.saidby.player`.

## What could not be verified

- USPTO: literal "contains" search only, for the six shortlisted names; no phonetic equivalents, design marks, or state registrations; not an attorney clearance. The other candidates were checked through Trademarkia's mirror.
- UK IPO: the official search returned a bot check; UK results come from Trademarkia's UK filter.
- EUIPO / WIPO: not searched.
- npm scopes: inferred from registry search returning no `@name/*` packages; not proof the scope is unclaimed.
- Domains: HTTP response plus whois for cuelith.com, softfall.com, saidby.com only.
- App stores: Amazon Appstore not queried directly.
- Companies House: six shortlisted names only; no US state registries.
- Common-law use by small businesses is only as visible as web search makes it.

## Decision needed from Samuel

Approve `Cuelith` (or a backup), then: register the domain, create the GitHub org, rename the package id, replace "Sightline" in UI strings and docs. The repository stays private until then.
