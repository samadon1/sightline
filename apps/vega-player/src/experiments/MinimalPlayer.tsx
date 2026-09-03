/**
 * Bisect step 6: MSE playback via the sample's Shaka integration (URL mode is broken on this VVD,
 * see docs/friction-log.md FL-008). Sequence mirrors vega-video-sample VideoHandler.loadAdaptiveMediaPlayer.
 */
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeplerVideoSurfaceView, KeplerMediaControlHandler, VideoPlayer } from "@amazon-devices/react-native-w3cmedia";
import { useKeplerAppStateManager } from "@amazon-devices/react-native-kepler";
import { ShakaPlayer } from "./w3cmedia/shakaplayer/ShakaPlayer";

const HLS_URI = "http://192.168.1.84:8081/hls/placeholder.m3u8";

export function MinimalPlayer(): React.JSX.Element {
  const video = useRef<VideoPlayer | null>(null);
  const shaka = useRef<ShakaPlayer | null>(null);
  const appState = useKeplerAppStateManager();
  const [status, setStatus] = useState("mounted");
  const [ready, setReady] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const log = (l: string) => { console.info(l); setLines((x) => [...x.slice(-10), l]); };

  useEffect(() => {
    (async () => {
      try {
        const p = new VideoPlayer();
        video.current = p;
        try { await p.setMediaControlFocus(appState.getComponentInstance(), new KeplerMediaControlHandler()); } catch (e) { log(`kmc failed ${String(e)}`); }
        await p.initialize();
        log("initialized");
        p.addEventListener("loadedmetadata", () => { log(`loadedmetadata dur=${p.duration}`); setStatus("loadedmetadata"); setReady(true); });
        p.addEventListener("play", () => setStatus("playing"));
        p.addEventListener("timeupdate", () => setStatus(`playing t=${p.currentTime.toFixed(2)}`));
        p.addEventListener("error", () => { log(`error ${JSON.stringify((p as any).error)}`); setStatus("error"); });
        p.autoplay = false;
        shaka.current = new ShakaPlayer(p, { secure: false, abrEnabled: false, abrMaxWidth: 1920, abrMaxHeight: 1080 });
        shaka.current.load({ uri: HLS_URI, secure: false, drm_scheme: "", drm_license_uri: "" } as any, false);
        log(`shaka load ${HLS_URI}`);
      } catch (e) { log(`setup failed ${String(e)}`); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSurfaceViewCreated = (h: string) => {
    log("surface created");
    video.current?.setSurfaceHandle(h);
    video.current?.play().then(() => log("play() ok")).catch((e: unknown) => log(`play() failed ${String(e)}`));
  };
  const onSurfaceViewDestroyed = (h: string) => { video.current?.clearSurfaceHandle(h); };

  return (
    <View style={styles.root}>
      {ready && (
        <KeplerVideoSurfaceView style={StyleSheet.absoluteFill} onSurfaceViewCreated={onSurfaceViewCreated} onSurfaceViewDestroyed={onSurfaceViewDestroyed} />
      )}
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.t}>step6 (MSE/Shaka): {status}</Text>
        {lines.map((l, i) => <Text key={i} style={styles.s}>{l}</Text>)}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  hud: { position: "absolute", top: 12, left: 12 },
  t: { color: "white", fontSize: 20 },
  s: { color: "rgba(180,255,180,0.9)", fontSize: 14, fontFamily: "monospace" },
});
