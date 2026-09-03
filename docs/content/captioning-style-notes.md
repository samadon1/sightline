# Captioning Style Notes

One page on the rules behind the Standard track, and on how the companion metadata adds speaker, lane, and sound information without touching the text.

## Sources

- Netflix, English (USA) Timed Text Style Guide: https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-Timed-Text-Style-Guide
- Netflix, Timed Text Style Guide: General Requirements (duration and gap rules): https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements
- DCMP, Captioning Key: https://dcmp.org/learn/captioningkey
  - Speaker identification: https://dcmp.org/learn/603-captioning-key---speaker-identification
  - Sound effects and music: https://dcmp.org/learn/602-captioning-key---sound-effects-and-music
  - Presentation rate: https://dcmp.org/learn/601-captioning-key---presentation-rate

## Rules applied to the Standard track

The Standard track is meant to be what a competent professional would deliver for this film. It is not weakened to make the other modes look good, and it is not enhanced beyond normal practice.

**Text shape**

- No more than 42 characters per line, including any speaker ID or sound effect brackets.
- No more than two lines per cue.
- When a cue needs two lines, prefer a bottom-heavy shape (shorter top line), but not a one or two word top line. Break after punctuation or before a conjunction or preposition. Never split an article from its noun or an adjective from its noun.

**Timing**

- Reading speed at or under 20 characters per second for adult content (17 for children's content; not relevant here).
- Minimum cue duration 5/6 of a second (about 0.83 s). Maximum 7 seconds.
- At least two frames between consecutive cues. At 30 fps we use 0.2 s as a working gap, which also helps the eye register a change.
- Cues follow the audio closely; they do not start early to give the reader a head start.

**Speaker identification**

- A speaker ID is used only when the speaker cannot be identified visually: off screen, out of frame, or in a shot where it is genuinely unclear who is talking.
- IDs go in square brackets, lowercase except for proper nouns, before the text on the same line: `[Amara] Put it down.` or `[man] Put it down.`
- When the speaker is unseen and the audience is not meant to know who it is, a generic descriptor is used. The Netflix guide's examples are `[man]` and `[woman]`. In this film we use `[unknown voice]` because a gendered label would give away the reveal. It follows the same rule: bracketed, lowercase, descriptive, used only because the speaker is not visible.
- Speaker IDs and sound effects are never italicised.
- DCMP adds the general principle that identifying both on-screen and off-screen speakers is vital for clarity. We follow the Netflix rule about when to add an ID, since it is the stricter and more common professional convention, and we rely on the companion metadata (not the Standard text) to go further.

**Two speakers in one cue**

- Used only when two short lines follow each other so quickly that separate cues would fall under the minimum duration or read badly.
- Format: a hyphen with no space at the start of each line, one speaker per line, each line a complete sentence. `-Know what?` / `-Whose it is. Obviously.`
- The hyphens show that there are two speakers. They do not say who. That is normal, and it is one of the honest reasons Standard captions can lose attribution in a fast exchange.

**Sound effects**

- Bracketed, lowercase, only when the sound matters to understanding: `[glass shatters]`.
- Descriptive, not vague; `[glass shatters]` rather than `[noise]`.
- Direction is not written into the text. A hearing viewer knows the glass broke to the right; a Standard caption reader does not. The metadata carries direction for Detailed mode.

**What the Standard track deliberately does not do**

- No WebVTT `<v Speaker>` voice tags, no `position:` or `line:` cue settings, no colour, no per-speaker placement. Those are exactly the things the other two modes add, so they stay out of the baseline.
- No speaker IDs on visible speakers "just in case". That would be non-standard, and it would make the comparison unfair in the other direction.

## Companion metadata

The same WebVTT file is used in all three modes. What changes is a companion file (schema version 0.1) that sits beside it. Cue metadata is keyed by cue id (`c001`, `c002`, ...), which are the WebVTT cue identifiers and never change once the study starts; timings may be re-conformed, ids may not. Speakers are keyed by a short id (`maya`, `daniel`, `amara`) and carry their display label and colour token. Lanes are `lower_left`, `lower_right`, and `bottom_center`; each cue lists its lanes in order of preference, with `bottom_center` as the fallback. A dual-speaker cue lists two speaker ids under `speakers`. A concealed identity is expressed on the speaker, not on the cue: `amara` carries `genericLabel: "UNKNOWN VOICE"` and `revealAtMs: 30000`, so every cue attributed to `amara` that starts before 30 s shows UNKNOWN VOICE and every cue from 30 s onward shows AMARA. Each cue also carries a `textHash` of its canonical visible text, a `status`, and a `provenance`.

Example, `companion.en.json`:

```json
{
  "schemaVersion": "0.1",
  "canonicalTrack": "captions.en.vtt",
  "speakers": {
    "maya":   { "label": "MAYA",   "color": "speaker-1", "revealAtMs": 0 },
    "daniel": { "label": "DANIEL", "color": "speaker-2", "revealAtMs": 0 },
    "amara":  { "label": "AMARA",  "genericLabel": "UNKNOWN VOICE", "color": "speaker-3", "revealAtMs": 30000 }
  },
  "shots": [ { "id": "s1", "startMs": 0, "endMs": 54000 } ],
  "cues": {
    "c001": { "textHash": "sha256:...", "status": "verified", "speaker": "maya",   "lanes": ["lower_left", "bottom_center"], "provenance": "human_editor" },
    "c010": { "textHash": "sha256:...", "status": "verified", "speakers": ["daniel", "maya"], "lanes": ["bottom_center"], "provenance": "human_editor" },
    "c011": { "textHash": "sha256:...", "status": "verified", "speaker": "amara",  "lanes": ["bottom_center"], "provenance": "human_editor" },
    "c016": { "textHash": "sha256:...", "status": "verified", "sound": { "direction": "right" }, "lanes": ["lower_right", "bottom_center"], "provenance": "human_editor" },
    "c019": { "textHash": "sha256:...", "status": "verified", "speaker": "amara",  "lanes": ["lower_right", "bottom_center"], "provenance": "human_editor" }
  }
}
```

How each mode uses it:

- **Standard** ignores the companion file. Text at the bottom, exactly as authored.
- **Speaker-aware** reads `speaker` (or `speakers`), `lanes`, and the speaker table. A run is a set of consecutive cues with the same speaker id; on the first cue of a run it prefixes the speaker's `label`, or the `genericLabel` if the cue starts before that speaker's `revealAtMs`. It places the cue in the first lane in its `lanes` list: `lower_left` for Maya, `lower_right` for Daniel and Amara, `bottom_center` for shared cues and for the concealed voice. The text itself is unchanged, including any bracketed ID already in it. For a dual-speaker cue, each hyphen line gets its own label. The `shots` list records the picture boundaries within which lane assignments hold; because every setup in this film shares one camera axis, one shot entry covers the whole running time.
- **Detailed** adds restrained per-speaker colour from the `color` token in the speaker table, and one directional sound treatment for any cue with a `sound.direction` field. Everything else is as in Speaker-aware.

Two rules protect the study:

1. The label for a concealed speaker is the `genericLabel` (UNKNOWN VOICE) in every mode for every cue that starts before `revealAtMs`. Nothing is shown retroactively, and no mode renames earlier cues after the reveal.
2. The companion file never edits, adds, or removes caption text. The `textHash` ties each entry to the canonical visible text of its cue; if the hash does not match, the cue is not treated as `verified` and falls back to Standard rendering.

The repository's validator (`npm run validate -- captions.en.vtt companion.en.json`) checks that every cue id in the companion file exists in the WebVTT, that each textHash matches the canonical visible text, that speaker ids, lanes, sound directions and reveal times are valid, and that only `verified` cues reach the enhanced modes. Reading-speed and line-length checks for the Standard track are done by the captioner against the limits above.
