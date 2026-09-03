/**
 * Gate 1 prototype assets. The VTT is inlined verbatim from assets/prototype/captions.en.vtt
 * so the first build has no asset-loading dependency. Keep the two in sync (tools will
 * regenerate this file later).
 */

export const PROTOTYPE_VTT = "WEBVTT\n\nNOTE Prototype track for Gate 1. Four cues, two speakers, one off-screen sound.\nNOTE Speaker names are carried in <v> spans (standard WebVTT). No companion file yet.\n\nc001\n00:00:01.200 --> 00:00:03.600\n<v Maya>Did you bring it?\n\nc002\n00:00:04.000 --> 00:00:06.800\n<v Daniel>It's in the envelope.\n\nc003\n00:00:07.100 --> 00:00:10.200\n<v Maya>Don't let him see it.\n\nc004\n00:00:11.000 --> 00:00:12.600\n[glass shatters off-screen]\n";

/**
 * Candidate video sources, tried in order until one loads (the player reports
 * MEDIA_ERR_SRC_NOT_SUPPORTED = 4 for a source it rejects). Gate 0 test matrix:
 *  1. local Range-capable server:  npx http-server -p 8081 -a 0.0.0.0 --cors  (assets/prototype)
 *  2. local Python server (no Range support): python3 -m http.server 8080
 *  3. known-good public HTTPS MP4 from the official vega-video-sample (transport/codec control)
 */
export const PROTOTYPE_VIDEO_URIS = [
  "http://192.168.1.84:8081/placeholder.mp4",
  "http://192.168.1.84:8080/placeholder.mp4",
  "https://edge-vod-media.cdn01.net/encoded/0000169/0169313/video_1880k/T7J66Z106.mp4?source=firetv&channelID=13454",
  // 4. audio-only control: if this loads and the MP4s do not, the virtual device lacks a video decoder path
  "http://192.168.1.84:8081/tone.mp3",
];
export const PROTOTYPE_VIDEO_URI = PROTOTYPE_VIDEO_URIS[0];
