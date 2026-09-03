/**
 * Media configuration.
 *
 * The Vega Virtual Device cannot open URL-mode sources (friction log FL-008), so playback goes
 * through the Vega-patched Shaka player with an HLS rendition. `tools/hls/make-hls.sh` builds
 * the rendition; `npx http-server -p 8081 -a 0.0.0.0 --cors` in `assets/` serves it.
 *
 * Switch `MEDIA_PROFILE` to "demo" for a capture session where the media is served from a
 * stable host, or set the env at build time.
 */

export type MediaProfile = "dev" | "demo";

export const MEDIA_PROFILE: MediaProfile = "dev";

/** Change this to the development Mac's LAN address. The VVD reaches the host via its LAN IP or 10.0.2.2. */
/** Default LAN server; overridable without a rebuild by `assets/raw/config.json` ({"devHost": "http://host:port"}), read at startup (loadRuntimeConfig). */
export const DEFAULT_DEV_HOST = "http://192.168.1.84:8081";
export let DEV_HOST = DEFAULT_DEV_HOST;

export type SceneMedia = {
  id: string;
  title: string;
  subtitle: string;
  durationLabel: string;
  /** HLS master playlist for the MSE path. */
  hlsUri: string;
  /** Progressive MP4 for URL mode on physical hardware (untested on the VVD). */
  mp4Uri: string;
  /** Fixture only: hand the raw cue payload (with markup) to the native track in Standard mode. */
  nativeMarkup?: boolean;
  /**
   * Publisher path: caption track and companion file served beside the stream. Fetched at load with a
   * short timeout; the bundled copies are the fallback, so playback never waits on the network for captions.
   */
  remote?: { vttUri: string; companionUri: string };
  /** Packaged copy of the HLS rendition (assets/raw), used when the LAN server is unreachable. */
  localHlsUri?: string;
};

const scene = (id: string, title: string, subtitle: string, durationLabel: string): SceneMedia => ({
  id, title, subtitle, durationLabel,
  hlsUri: `${DEV_HOST}/${id}/hls/placeholder.m3u8`,
  mp4Uri: `${DEV_HOST}/${id}/placeholder.mp4`,
});

/** Scenes in landing-screen order. Footage is a synthesized stand-in until the shoot. */
const film = (id: string, file: string, title: string, subtitle: string, durationLabel: string): SceneMedia => ({
  id, title, subtitle, durationLabel,
  hlsUri: `${DEV_HOST}/${id}/hls/${file}.m3u8`,
  mp4Uri: `${DEV_HOST}/${id}/${file}.mp4`,
  remote: { vttUri: `${DEV_HOST}/${id}/captions.en.vtt`, companionUri: `${DEV_HOST}/${id}/companion.en.json` },
  localHlsUri: `file:///pkg/assets/raw/${id}/hls/${file}.m3u8`,
});

export function buildScenes(host: string): Record<string, SceneMedia> {
  DEV_HOST = host;
  return {
  "tos-bridge": film("tos-bridge", "tos-bridge-720p", "Tears of Steel: the bridge", "Two people, one argument, forty years. Blender Foundation, CC BY 3.0.", "48 seconds"),
  "tos-lab": film("tos-lab", "tos-lab-720p", "Tears of Steel: the lab", "A crew counting down, a director shouting. Blender Foundation, CC BY 3.0.", "60 seconds"),
  "the-envelope": { ...scene("the-envelope", "The Envelope", "Three people, one envelope, one voice from the hallway", "54 seconds"), localHlsUri: "file:///pkg/assets/raw/the-envelope/hls/placeholder.m3u8" },
  "micro-scene-a": scene("micro-scene-a", "Keys", "A rapid exchange between two people in view", "23 seconds"),
  "micro-scene-b": scene("micro-scene-b", "Hallway", "An off-screen voice and two people talking at once", "24 seconds"),
  prototype: scene("prototype", "Clock test", "Timing test pattern with lane markers", "30 seconds"),
  "fixture-no-companion": { ...scene("prototype", "Test: no companion file", "The clock test without its companion file: names come from the caption track only, with no colour or placement.", "30 seconds"), id: "fixture-no-companion" },
  "fixture-stale-metadata": { ...scene("prototype", "Test: stale metadata", "Stale hash on one cue, a proposed cue, an unknown speaker id. Each falls back on its own.", "30 seconds"), id: "fixture-stale-metadata" },
  "fixture-vtt-markup": { ...scene("prototype", "Test: native VTT markup", "Standard mode hands the track's own markup (colour classes, bold, italic, timestamps) to the TV renderer.", "30 seconds"), id: "fixture-vtt-markup", nativeMarkup: true },
  "fixture-protected-region": { ...scene("prototype", "Test: protected region", "A shot declares a face in the lower left while c003 is active. That cue moves to the bottom; c001 keeps the left lane.", "30 seconds"), id: "fixture-protected-region" },
  };
}

export let SCENES: Record<string, SceneMedia> = buildScenes(DEFAULT_DEV_HOST);
export const SCENE_ORDER = ["tos-bridge", "tos-lab", "the-envelope", "micro-scene-a", "micro-scene-b", "prototype", "fixture-no-companion", "fixture-stale-metadata", "fixture-protected-region", "fixture-vtt-markup"];
export const DEFAULT_SCENE_ID = "tos-bridge";

/**
 * Read `file:///pkg/assets/raw/config.json` (packaged with the app) and rebuild the scene table with its
 * devHost. Resolves quickly either way; a missing or invalid file keeps the default.
 */
export function loadRuntimeConfig(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", "file:///pkg/assets/raw/config.json", true);
      xhr.onload = () => {
        try {
          const cfg = JSON.parse(xhr.responseText || "{}") as { devHost?: string };
          if (typeof cfg.devHost === "string" && /^https?:\/\//.test(cfg.devHost)) { SCENES = buildScenes(cfg.devHost.replace(/\/$/, "")); resolve(cfg.devHost); return; }
        } catch { /* fall through */ }
        resolve(DEFAULT_DEV_HOST);
      };
      xhr.onerror = () => resolve(DEFAULT_DEV_HOST);
      xhr.send();
    } catch { resolve(DEFAULT_DEV_HOST); }
  });
}
