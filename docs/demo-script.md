# Three-minute demo script (draft, spec v0.3 §25)

Replace "Sightline" after naming approval. Every simulator shot is labelled "Vega Virtual Device". Measured numbers are quoted with their method. Nothing is claimed that the build cannot do on the day of capture.

| Time | Picture | Voice-over / on-screen text | Source |
|---:|---|---|---|
| 0:00–0:12 | Tears of Steel, the bridge, Standard captions: Celia and Thom's argument. | "Captions can preserve every word and still leave an argument flat. Who is shouting? Who is speaking now?" | Real footage today (CC BY 3.0, credit on screen); The Envelope replaces it after the shoot |
| 0:12–0:30 | Same beat, Speaker-aware: Celia yellow on the left, Thom cyan on the right, each word taking its colour as it is spoken, drawn by Fire TV's own caption renderer at the viewer's size and font. | "This is Sightline: a Fire TV runtime that adds verified speaker context when it helps, and returns to ordinary captions when it does not. The words never change. Fire TV itself draws this, in your caption size." | Live app |
| 0:30–0:48 | Caption size change on a physical Stick (Settings → Accessibility): the native captions grow, the left lane is rejected and the cue drops to the bottom. Then Detailed on the bridge: the shout "...alright! Fine!" grows on its own from the measured loudness. | "Your caption size wins. When a bigger size makes a side lane unsafe, the runtime moves the caption to the bottom instead of covering the picture. And in Detailed mode the type follows the voice: louder is larger, by measurement, not by guess." | Hardware needed for the size-change half |
| 0:48–1:02 | c011 "[unknown voice] Don't open that." then the reveal at c019 "AMARA". | "A voice whose identity the story hides stays hidden. The label is generic until the reveal." | Live app |
| 1:02–1:15 | c024 in Speaker-aware: plain bottom caption while neighbours are labelled. Cut to the companion file showing `"status": "proposed"`. | "This cue's metadata is only proposed, not verified. So it renders as plain text. Only verified metadata reaches the viewer." | Live app + editor |
| 1:15–1:27 | Menu → "Use Standard captions". Captions return to the conventional bottom style mid-scene. | "One action returns to standard captions at any time." | Live app |
| 1:27–1:42 | Detailed mode on the bridge: Caption with Intention rules. "...alright! Fine!" grows with the shout; read-ahead white turns to colour word by word; "♫ [dramatic music] ♫" and "[machinery whirring] ▶" under the lab reveal. Reduced motion on. | "Detailed follows the Caption with Intention design system: size for volume, weight for pitch, colour at word onset, sound labels with a direction. Nothing moves while a caption is on screen." | Live app |
| 1:42–2:00 | Split screen: captions.en.vtt beside companion.en.json (textHash, status, speaker, lanes). | "The approved WebVTT file is untouched. A companion file adds speaker, placement and verification, keyed by cue id and locked to the text with a hash." | Editor capture |
| 2:00–2:18 | Architecture card from docs/architecture.md: three levels, native-first. | "Standard and Speaker-aware are drawn by Fire TV's own caption renderer, so your size, font and colours apply automatically. Detailed is a small overlay driven by the same native cue clock." | Slide |
| 2:18–2:34 | Sync table from docs/sync-report.md and one Measurement C frame. | "Measured on the virtual device: zero lost cues across pause, seek and mode changes; word and cue changes within about twenty milliseconds at the median on Fire TV's own renderer, and the overlay within one frame of the picture. Hardware numbers will replace these." | Slide |
| 2:34–2:48 | One quote card from the DHH pilot and one change made because of it. | Fill in after the pilot. If the pilot has not run, cut this to a statement that the study is scheduled and show the kit. | docs/study |
| 2:48–3:00 | Landing screen, then the closing card. | "The enhancement can disappear. The approved caption never does." | Live app |

## Capture plan

- Preferred: Fire TV Stick over HDMI capture at 1080p60, phone-shot real footage.
- Fallback: VVD window capture with `tools`-style screenshots or QuickTime screen recording; the known-issues page warns the VVD may crash under simultaneous recording, so record in short segments.
- Keep the burned-in clock test asset out of the final cut except in the measurement section.

## Cut of 3 September 2026 (built)

`~/Downloads/sightline-demo-2026-09-03.mp4`, 2 min 28 s, 1920x1080, no audio, 9.6 MB. Built by `tools/video/build-demo-video.py` from device captures plus the committed architecture figures, so the video cannot state a number the repository does not hold.

Order: the problem, Standard, Speaker-aware, Detailed, then how it is built (end-to-end diagram, forced alignment on the spectrogram, loudness and pitch, raw voice separation with its disagreement, face detection and protected regions, the proposal timeline, the fallback ladder, the measured sync), then what it never does, one press back to Standard, and the closing card with the footage credit.

Footage rights: CC BY 3.0 (Blender Foundation). The closing card carries the full attribution the licence asks for, including the licence URL and the note that the footage was excerpted and captioned. If YouTube Content ID claims the excerpt, dispute it citing CC BY 3.0.

Still to add before submission: a voice-over or captions of its own (the video is silent), and hardware footage if a Stick arrives. It has no audio track, so a caption file for the video itself is the accessible way to narrate it.

## Cut v2 of 3 September (plain words, artwork cards, crossfades)

`~/Downloads/sightline-demo-2026-09-03-v2.mp4`, 2 min 26 s, 1920x1080, 30 fps, no audio, 16 MB, with `sightline-demo-2026-09-03-v2.srt` beside it. Cards sit on the scene's own blurred artwork (the app's look), every line of copy is plain spoken English, and sections crossfade. `docs/demo-voiceover.md` holds the narration with start times; the SRT carries the same words. Both come out of `tools/video/build-demo-video.py` from the same timeline as the picture, so they cannot drift.

Smoother footage: `tools/video/vvd-burst.py <dir> <prefix> <seconds> 6` captures the device window at about 5 to 6 frames per second by window id (safe: never a screen region). Run the three modes into a `vid2` folder and rebuild with `--footage vid2`. Not yet done: the device was off limits when v2 was cut, so v2 uses the earlier 1.4 fps stills with short blends between frames.

## Cut v3 (3 September, evening): the human case first

The Caption with Intention case-study film (Chicago Hearing Society, 2:16) opens on the person, not the feature: fifty years of film progress against captions frozen since 1971, the 430 million figure, Deaf people naming the three gaps on camera, the reveal, Deaf viewers reacting to real films, then panels and studios as proof. Our v2 opened on a feature line. v3 reorders the first forty-five seconds to match that shape with what we can say truthfully:

| Start | Beat | Note |
|---:|---|---|
| 0:00 | More than 430 million people live with hearing loss. For many of them, the captions are the film. | WHO deafness and hearing loss fact sheet, 2024, cited on the card. |
| 0:05 | Captions have looked the same since the 1970s. | |
| 0:10 | Three things they leave out: who is speaking, how loud, when. | The same three gaps the case study names. |
| 0:16 | Turn your sound off. | The voice-over stops for the fourteen seconds of Standard footage. The viewer reads, as a Deaf viewer would. |
| 0:34 | Who was angry? Who spoke last? Was anyone shouting? | |
| 0:40 | Sightline puts the missing parts back. | Then the two modes as before. |

Footage: fresh 18 s bursts of each mode at about 6 fps (`tools/video/vvd-burst.py`, `--footage vid2`), each started five seconds after Play so the three modes begin on the same line; the builder keeps the frames at their captured pace and trims them to the beat. Where the case study shows Deaf viewers reacting we have nothing to show, so the film moves straight from the modes to how it works. A card saying the study had not run was tried and cut. A motion beat (Detailed with Reduced motion off, captured at a smaller device window because capture speed had dropped under memory pressure) follows the Detailed beat; the proposal-timeline figure was dropped to pay for it. A settings beat (the Captions sheet captured while the remote moves between modes) replaces the separate one-press-back card. A three-second title beat names the project before the cold open. Total 178 seconds. `--out demo.mp4` streams frames into ffmpeg instead of dumping PNGs (a full dump is about four gigabytes). Three figure beats lost half a second each to stay under three minutes. Output: `~/Downloads/sightline-demo-2026-09-03-v3.mp4` and `.srt`; voice-over in `docs/demo-voiceover.md`. The Standard beat has no narration line and no SRT cue on purpose.
