/**
 * @sightline-wip/vega-captions: the caption runtime for React Native for Vega video apps.
 *
 * Pair it with @sightline-wip/core (resolver, schema) and a VideoPlayer from react-native-w3cmedia:
 * the controller owns a native text track for Standard and Speaker-aware, the overlay draws Detailed,
 * and the media clock keeps both on the player's own time. See README.md for the ten-line embed.
 */

export { CaptionController, nativeColorClass, NATIVE_LEAD_START_MS, NATIVE_LEAD_WORD_MS } from "./controller/CaptionController.ts";
export type { NativeCue, NativeTrack, CaptionState, ControllerDeps } from "./controller/CaptionController.ts";
export { useWordClock } from "./controller/useWordClock.ts";
export { useSecondClock } from "./controller/useSecondClock.ts";
export { DetailedOverlay } from "./detailed/DetailedOverlay.tsx";
export * from "./detailed/layout.ts";
export { useSystemCaptionPrefs, requestCaptionTextSize } from "./native/useSystemCaptionPrefs.ts";
export { MediaClock } from "./media/MediaClock.ts";
export type { ClockSource } from "./media/MediaClock.ts";
export { devLog, syncLog, setLogSink } from "./log.ts";
export { SPEAKER_COLORS, colors as captionColors, minorColor, px, SCALE, windowSize, font } from "./theme.ts";
