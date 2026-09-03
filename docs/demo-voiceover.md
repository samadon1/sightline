# Voice-over for the demo video

Read in a normal speaking voice, no hurry. Each line starts when its section starts; the timings come from the same script that builds the picture, so they match the cut. Total about 173 seconds of picture.

| Start | Section | Say |
|---:|---|---|
| 0:00 | title | This is Sightline. Captions for Fire TV that show who is speaking, how loud, and when. |
| 0:06 | open | More than 430 million people live with hearing loss that affects their daily life. For many of them, the captions are the film. |
| 0:15 | same | Captions have looked the same since the 1970s. Just words at the bottom of the screen. |
| 0:20 | gaps | Which person said the line. Whether it was a whisper or a shout. And the moment each word is said. |
| 0:26 | mute | Try it. Turn your sound off. For the next fourteen seconds, this film is only what you can read. |
| 0:33 | standard | (no voice. Let the scene play with the sound off.) |
| 0:47 | ask | Who was angry? Was anyone shouting? The words were all there, but the fight was hard to follow. |
| 0:53 | reveal | Sightline puts the missing parts back. |
| 0:56 | spk-card | Speaker-aware gives each speaker a name and a colour. Each word turns to that colour as it is said, on the speaker's side of the screen. |
| 1:04 | speaker | Thom is on the left in cyan. Celia is on the right in yellow. Nothing here is drawn by the app. It is Fire TV's own caption renderer. |
| 1:16 | det-card | Detailed goes further. Louder words are bigger. A line spoken from off camera is in italics, and sounds get a label. |
| 1:23 | detailed | This follows the Caption with Intention design system, built for Deaf and hard of hearing viewers, and it is on by choice, never by default. |
| 1:32 | motion-card | Motion is there if you want it, and off by default. |
| 1:36 | detailed-motion | Here it is on. The same words, the same colours, and a small lift on each word as the voice reaches it. |
| 1:43 | set-card | All of this is your choice. Your choice is saved, and standard captions are always one press away. |
| 1:49 | settings | Open the Captions sheet and pick a mode. The preview at the top shows what you will get, and the TV keeps your choice until you change it. |
| 1:57 | how | None of this is guessed. We measure the film, write down what we found, and a person checks it. |
| 2:03 | f-e2e | Five measurements run on every scene. One step merges them into proposals, and a person confirms them. |
| 2:09 | f-spec | First, word timing. We line the approved words up with the sound. |
| 2:13 | f-deliv | Then loudness and pitch, word by word, against the speaker's own normal. These numbers set the size and the weight of the type. |
| 2:20 | f-voice | Here the model hears one voice across three lines that the caption file gives to two people. |
| 2:25 | f-face | Face detection marks where a caption must not go. A line that would cover a face moves to the bottom. |
| 2:30 | f-ladder | And every check a line has to pass before it is enhanced. |
| 2:35 | f-sync | Word changes land within about ten milliseconds of the boundary, and no line was ever lost. |
| 2:40 | never | It never invents a caption. It does not guess who is speaking, read emotions, or change a single approved word. |
| 2:47 | close | Sightline. A Fire TV caption runtime, a package other apps can use, and an open file format. |

If you record: a phone in a quiet room is fine. Export as one file, then `ffmpeg -i video.mp4 -i voice.m4a -c:v copy -c:a aac -shortest out.mp4`. The SRT beside the video carries the same words, so the video stays accessible with the sound off.
