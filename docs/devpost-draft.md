# Devpost submission draft (private)

Fill this in after naming approval and the shoot. Bracketed items are placeholders. Every claim stays tied to a measured result or a capture.

## Project name
[Approved name] (working title Sightline)

## Tagline
Captions that let you choose how much context you get, and never put the approved words at risk.

## Track and mini-challenges
- Primary: Fire TV (Vega OS)
- Mini-challenge: Open Source (packages/core, the companion metadata profile, and the Vega reference app)
- AWS Builder: [not entered unless the September 18 checkpoint approves the Transcribe authoring command]

## Inspiration
In 2025, Deaf and hard-of-hearing viewers told researchers that caption preferences differ so much that no single caption design suits everyone. The study's own title quotes one of them: "Choices? That's the dream." Speaker labels, placed captions and expressive type all exist already, but there was no TV runtime that lets the viewer pick the level, respects the TV's own caption settings, and never risks the approved words. So we built one.

## What it does
[Name] is a Fire TV caption runtime that applies the Caption with Intention design system on top of an approved WebVTT track, the standard text file that holds a video's captions and their timings. A companion file beside the track adds verified data: who is speaking, when each word is said, measured loudness and pitch, sound events, and regions of the picture where a face is. There are three modes. Standard is the untouched track. Speaker-aware is drawn by Fire TV's own caption renderer with a colour per character and colouring word by word, so the viewer's caption size and font still apply. Detailed follows the design system's rules: type size from loudness (3% to 12% of the screen), weight and width from the pitch of the voice, read-ahead text in white that turns to the character's colour at each word, italics for voices off camera, sound labels with a direction, ♫ for music, and, when Reduced motion is off, a small pop on each word. Reduced motion is on by default. Every enhancement comes from verified data, and anything unverified, invalid or unsafe disappears for that word or cue while the approved caption stays. One press returns to Standard.

## How we built it
- React Native for Vega 0.83, Vega SDK 0.24. Standard and Speaker-aware are drawn by Fire TV's own caption view from positioned VTTCue objects the app creates. To colour words on that path we split each cue at the word boundaries and use WebVTT colour classes, which the renderer honours. Detailed hides the native track and draws an overlay driven by a media clock anchored to player events.
- A TypeScript core with no framework dependencies (parser, SHA-256 hashing of the visible text, schema validator, two-pass resolver, label rules, lane estimator, native cue splitting) with 51 tests, plus 17 runtime tests, 5 app tests and 6 pipeline rule tests.
- The companion metadata profile (v0.2, JSON Schema in `schema/`) sits beside the WebVTT file. Every cue is locked to its text by a hash, and every enhancement is gated on a verified status. Authoring tools propose data from the audio and video (WhisperX forced alignment, which lines up each written word with the moment it is spoken; librosa loudness and pitch; PANNs sound tagging; YuNet face regions), and a local review page is where a person verifies them.
- Real footage: two excerpts of Tears of Steel (Blender Foundation, CC BY 3.0).
- The comparison point is a fair Standard track written to the Netflix English Timed Text Style Guide, not a weakened baseline.

## Challenges
- URL-mode playback fails on the Vega Virtual Device for every source, and we reproduced that with the official sample. Playback runs through the Vega-patched Shaka player and HLS instead, and the friction log records it.
- The virtual device has no Accessibility settings page, and third-party apps cannot write caption preferences, so the real size-change demo needs physical hardware.
- The app's own log rate limit hid the media pipeline's error lines until we stopped the player screen re-rendering on every frame.

## Accomplishments
- Native positioned cues, overlay timing from a hidden track, and zero lost cues across pause, seek and mode changes on the virtual device.
- Every claim above is measured on the device or read from the code. No Deaf or hard-of-hearing viewer has seen the modes yet, and we say so on the page rather than imply otherwise.

## What we learned
- Polled media time on the platform is stale by up to 700 ms, but the value carried by timeupdate events is fresh. One clock anchored to those events now drives everything, and native cues are scheduled 100 ms early so they land on the boundary. Word changes land within about 10 ms at the median and cue changes within about 50 ms, with p95 near 145 ms and zero lost cues, on the virtual device (one clean end-to-end run, September 3). A visual measurement (OCR of window captures against a clock burned into the picture) puts the overlay within one frame.
- Speaker colour, weight and size were the devices Deaf and hard-of-hearing participants preferred in the CHI 2024 Caption Royale study, and they rejected shadows, opacity and spacing tricks, so we never used those.
- We have not run a study with Deaf or hard-of-hearing viewers. The study kit is in the repository for anyone who wants to run one, and the modes are built so that a negative result costs nothing: one press returns the plain captions.

## What's next
- Testing on a physical device, sessions with Deaf and hard-of-hearing viewers if we can recruit them, and the publisher SDK path.

## Built with
React Native for Vega, Vega SDK, W3C media APIs, WebVTT, TypeScript, Shaka Player (Vega patches from AmazonAppDev/vega-video-sample), ffmpeg.

## Links
- Repository: https://github.com/samadon1/sightline
- Video: https://youtu.be/tEMhDXov5MM (2 min 53 s, English, captions uploaded)
- Product feedback: docs/product-feedback.md; Friction log: docs/friction-log.md

## Disclosure
All code, captions and scripts were made during the hackathon window. The Tears of Steel excerpts are CC BY 3.0 (Blender Foundation). The Envelope and the micro-scenes use synthesized stand-in footage until the shoot. The word timings, delivery levels and sound events in the current companion files were verified by named machine rules (`verifiedBy: auto:*`). The speaker attribution and lanes on the bridge excerpt were set by the author while watching the footage. The lab excerpt's cues still need a human pass, and until then they play as Standard captions with timing.
