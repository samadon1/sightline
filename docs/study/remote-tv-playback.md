# Remote TV playback: getting the clips onto a participant's television

Goal: a remote participant watches each condition on a TV at living-room distance, not on a laptop next to their face. This document lists the ways to do that, from best to worst, and what to send the participant.

**Burned-in renders are used only for remote study delivery and are not the product's rendering path.** The prototype renders an approved caption track live on Fire TV. For remote participants we export each condition as a video file with the captions drawn into the picture, so the file looks the same on any screen. Remote sessions therefore test the visual design of each mode, not the live rendering.

## What to prepare (Samuel)

- For each condition (A Standard, B Speaker-aware, C Detailed) and each scene, one MP4 with captions burned in at the calibrated size. Name them by style number, not by condition name (`scene1-style1.mp4`), and keep a private mapping per participant ordering.
- A calibration MP4: a still frame with a two-line caption at default size, 20 seconds.
- Upload to a private folder (Google Drive or Dropbox) and, separately, as unlisted YouTube videos. Send links the day before.
- Confirm the participant's playback path on a 5-minute device check call before the session.

## Options, best first

### 1. Fire TV Stick or Fire TV built in

- Best case: sideload nothing. Open the YouTube app on the Fire TV and play the unlisted link (see the YouTube note below), or play the MP4 from a USB drive using a media player app, or cast from a phone.
- Amazon's own help page describes screen mirroring for Fire TV: put the phone and Fire TV on the same Wi-Fi, then on the Fire TV go to Settings, Display & Sounds, Enable Display Mirroring. If that option does not appear, the device does not support mirroring. Source: https://www.amazon.com/gp/help/customer/display.html?nodeId=ToUjwyfVuffzVfbR6b
- Android phones and Windows laptops mirror to Fire TV natively (Miracast). iPhones and Macs do not; they need a third-party receiver app on the Fire TV such as AirScreen, or a Fire TV model with AirPlay 2 (some Fire TV Edition sets and newer Cubes). Source: https://www.androidpolice.com/cast-iphone-fire-tv-stick/
- Mirroring adds compression and sometimes a frame delay. Ask the participant to play the file full screen and turn the phone screen off after starting if the app allows it.

### 2. Chromecast, Google TV, or a smart TV with casting

- From a laptop: open the MP4 in Chrome (drag the file into a tab), then use Chrome's Cast menu, choose Cast tab or Cast file. Cast file gives the best quality.
- From an Android phone: open the file in Google Photos or Files, tap Cast.
- From an iPhone to a Chromecast: use the YouTube app with the unlisted link and the Cast button.

### 3. AirPlay (Apple TV or an AirPlay 2 TV)

- On iPhone or Mac, play the MP4 in the Files app, Photos, or QuickTime, then AirPlay it to the TV. This is a direct video stream, not a mirror, and looks clean.
- Many recent Samsung, LG, Sony, and Roku TVs support AirPlay 2. Check the TV's settings for AirPlay.

### 4. Plain HDMI laptop connection

- The most reliable path and the one with no compression. A laptop with an HDMI port (or a USB-C to HDMI adapter) plugs into the TV. Play the MP4 full screen in VLC or the default player.
- Set the TV as the only display (Windows: Win+P, Second screen only; Mac: mirror displays) so the participant is not looking at the laptop.
- Keep the video call on a phone or tablet so the TV shows only the clip.

### 5. YouTube app on the TV (unlisted link)

- Simple for the participant: open YouTube on any smart TV, search is not needed, they sign in or use the phone-to-TV link code to send the unlisted video.
- **Limitation:** YouTube renders its own captions from an uploaded caption track, and it decides font, size, and position. That would replace our rendering, so the study must not rely on a YouTube caption track. Upload the burned-in versions only and make sure captions in the YouTube player are switched off so nothing is drawn on top. Ask the participant to confirm the CC button is off during the device check.
- Unlisted means anyone with the link can watch. Do not put the links in any public post. Delete the videos after the study.

### 6. Laptop or monitor only (fallback)

- Acceptable for the pilot when a TV is not available. Ask the participant to sit at least 1.5 metres back and to use full screen. Record device as laptop or monitor on the scoring sheet and treat those results as lower confidence for readability and distraction.

## Device check call (5 minutes, the day before)

1. Confirm the participant can play the calibration clip on the TV, full screen, from where they usually sit.
2. Confirm the caption size is readable. If not, send a larger render.
3. Confirm the video call runs on a different device from the TV, and that captions or the interpreter are visible on that device.
4. For YouTube: confirm the CC button is off.
5. Agree on the words the moderator will use to say "play the next one" and how the participant signals they are done.

## In-person alternative (Accra)

Participants in or near Accra can come to Samuel's TV with the Fire TV prototype running live. This is the only path that tests the real rendering. Prioritise it for the final study where possible and record device as TV Fire TV.
