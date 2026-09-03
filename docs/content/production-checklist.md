# Production Checklist

For the two phone-shot micro-scenes ("Keys", "Hallway") and the final film "The Envelope". Tick as you go. The rights section is not optional; nothing goes into the public repository until it is complete.

## Pre-production

- [ ] Scripts locked: `micro-scene-a.md`, `micro-scene-b.md`, `the-envelope.md`
- [ ] Three performers confirmed (Maya, Daniel, Amara) with dates and call times
- [ ] Location confirmed; walked through with the camera to check the left/right layout and where the hallway door falls in frame
- [ ] Location release signed (see `actor-release-form.md`)
- [ ] Performer releases printed, two copies each, with the CC BY 4.0 paragraph highlighted so nobody is surprised
- [ ] Performers told in advance: no branded or printed clothing, bring a plain change of top
- [ ] Props gathered: envelopes with fictional addresses, plain blue key tag, jug or jar for the break, bucket, towel, safety glasses, dustpan, dish towel, plain mug, fabric bag
- [ ] Camera: phone or mirrorless charged, storage cleared, tripod, lens cloth
- [ ] Phone camera settings: 1080p, 30 fps, landscape, exposure and white balance lockable, HDR off, stabilisation on, "most compatible" H.264 format rather than HEVC if the phone offers it
- [ ] Audio: lav mics or shotgun, recorder, spare batteries, headphones, backup phone for audio
- [ ] Practical lights checked; all bulbs the same colour temperature
- [ ] Window diffusion (net curtain or bedsheet) available
- [ ] Rehearsal read-through done over a call or in person, with the overlap and the glass beat walked through

## Shoot day

- [ ] Room cleared of trademarks, artwork, calendars, packaging, magnets, printed text (see checklist in `the-envelope.md`)
- [ ] Every phone in the building on silent; backup recorder phone in airplane mode
- [ ] No TV, radio, music, dishwasher, washing machine, extractor fan, or fridge hum that can be avoided (unplug the fridge for the takes and plug it back in after)
- [ ] Camera placed on the correct side of the line; Maya on the left, Daniel on the right, door on the right
- [ ] Exposure and white balance locked before take one
- [ ] Mic levels set with a full-volume line, peaks around -12 dB
- [ ] Voice slate and clap at the top of every take
- [ ] Off-screen voice performed from behind the door, normal volume, no funny voice
- [ ] Glass break performed off screen right, safety glasses on, swept between takes
- [ ] Check playback of take one for picture, sound, and any distant music before continuing
- [ ] All planned takes done, or the drop order followed (inserts first, then extra takes)
- [ ] Room tone: 30 seconds, everyone still
- [ ] Glass break wild track: three drops
- [ ] Releases signed by every performer; parent or guardian section used if needed
- [ ] Media backed up to two separate drives before anyone leaves
- [ ] Room restored

## Post

- [ ] Sync main audio to picture using the clap; check the backup phone audio as a fallback
- [ ] Assemble the edit; keep left/right positions stable across every cut
- [ ] Dialogue clean-up only: level matching, light noise reduction, room tone under gaps. No music, no added effects beyond the recorded glass wild track if the live one is unusable
- [ ] Check the overlap is still intelligible after the mix
- [ ] Export the master: 1920x1080, H.264 High, level 4.1, 30 fps, yuv420p, AAC 48 kHz stereo (command in `the-envelope.md`)
- [ ] Verify the master with `ffprobe`
- [ ] Produce the HLS fMP4 rendition (command in `the-envelope.md`) and test it in the Fire TV build
- [ ] Re-conform the Standard WebVTT timings to the locked edit; keep cue ids unchanged
- [ ] Re-check each cue: 42 characters per line, two lines, 20 cps or under, at least 5/6 second, at least two frames between cues
- [ ] Have a second person review the Standard track for fairness: no missing IDs where a speaker is genuinely unidentifiable, no extra IDs where a speaker is visible
- [ ] Build the companion metadata file from the tables; check every cue id in the metadata exists in the WebVTT
- [ ] Watch the film once in each mode (Standard, Speaker-aware, Detailed) on the actual device
- [ ] Confirm the UNKNOWN VOICE label is not resolved to Amara before c019 in any mode

## Rights

- [ ] Signed performer release on file for every person whose face or voice is in the footage, including whoever performs the off-screen voice and the glass break if their voice is ever audible
- [ ] Signed location release on file
- [ ] Every release states the CC BY 4.0 (or similar) publication and the public repository use
- [ ] Script is original; nobody's lines, characters, or plot were copied
- [ ] No third-party music, sound effects libraries, fonts with restrictive licences, or stock footage used
- [ ] Final picture reviewed frame by frame for any logo, brand, artwork, or readable text
- [ ] `LICENSE` in the repository: MIT for the code; a separate `LICENSE-MEDIA` (CC BY 4.0) covering the film, stills, and caption files, with the required attribution line
- [ ] `CREDITS.md` lists performers under the names they asked for
- [ ] Copies of releases stored privately, not in the repository
- [ ] Study participants' consent form is separate from performer releases and handled by the study protocol

## Phone-shot checklist for the micro-scenes

These two scenes are rough on purpose, but rough picture with clean sound is fine and rough sound is not.

**Clean audio on a phone**

- Do not rely on the phone camera's own microphone. Record audio on a second phone placed on the counter or table between the speakers, within a metre and a half of everyone, using a voice recorder app set to the highest quality (WAV or lossless if offered, otherwise 256 kbps AAC). A cheap clip-on lav that plugs into that phone is better again.
- Put the recording phone in airplane mode so no notification lands in the take.
- Turn off anything that hums: fridge, extractor, heating fan, laptop.
- Close windows. Wait for passing traffic or a neighbour's music to stop before rolling.
- Listen back to the first take on headphones before shooting more.

**Framing for stable left/right positions**

- Phone landscape on a small tripod or propped against something solid at chest height. Never handheld.
- Decide once where the camera lives and do not move it to the other side of the room. Both setups stay on the same side of the line between the two main speakers.
- Maya's spot is on the left of frame, Daniel's on the right, the door or entrance on the right. Mark the floor with tape if people drift.
- Leave headroom and enough width that a third person can enter without anyone shuffling.
- Lock exposure and focus (tap and hold on most phones) so the picture does not pump when someone moves.

**One speaker partly facing away, naturally**

- Give that performer a real task that faces a wall: searching a drawer, sorting post, putting something on a shelf. The task does the turning; the performer should never think about the camera.
- Let them turn back when the dialogue would naturally make them turn (being challenged, being handed something).
- Do not ask anyone to hide their mouth or mumble. Clean diction, ordinary volume.

**Off-screen voice and the break (scene B)**

- The voice comes from behind a real door, at normal volume. Slightly ajar is enough.
- The glass break is a jar into a bucket behind the door on the right. Safety glasses, sweep between takes. Let both on-screen performers react by looking to the right, because that is what people do.

**Room tone**

- After the last take, everyone still, record 30 seconds with the same mic in the same place. Say "room tone" at the start so it is easy to find.

**Slating**

- At the top of every take, someone says the scene, setup, and take number out loud ("Keys, setup one, take two") and claps once in front of the camera. The clap lines up the audio phone with the video phone in the edit.
- Keep a paper log: take number, good or no good, one-word reason.
