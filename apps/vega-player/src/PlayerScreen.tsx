/**
 * Gate 1 player screen (working playback path).
 *
 * Playback: MSE via the Vega-patched Shaka Player (URL mode is broken on the virtual device,
 * see docs/friction-log.md FL-008). Sequence mirrors vega-video-sample VideoHandler:
 * new VideoPlayer → setMediaControlFocus → initialize → listeners → autoplay=false →
 * addTextTrack + cues → ShakaPlayer.load(hls) → on loadedmetadata mount surface + captions →
 * onSurfaceViewCreated → setSurfaceHandle → play().
 *
 * Captions: Level 1/2 on the native KeplerCaptionsView via app-created VTTCue objects with
 * lane position settings; Level 3 hides the native track and draws an overlay from activeCues.
 *
 * Keep per-frame state updates out of this component: the app log rate limit (300 lines/s)
 * is tripped by re-rendering KeplerVideoSurfaceView, which suppresses the pipeline's own logs.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  KeplerCaptionsView,
  KeplerMediaControlHandler,
  KeplerVideoSurfaceView,
  VideoPlayer,
  VTTCue,
} from "@amazon-devices/react-native-w3cmedia";
import { useKeplerAppStateManager, useTVEventHandler } from "@amazon-devices/react-native-kepler";
import { parseVtt, type CanonicalCue } from "@sightline-wip/core";
import { ShakaPlayer } from "./w3cmedia/shakaplayer/ShakaPlayer";
import {
  type Mode,
  type NativeCue,
  type NativeTrack,
  resolveAll,
  toNativeCues,
  replaceTrackCues,
  fontScaleFromTextSize,
} from "./captionRuntime";
import { PROTOTYPE_VTT } from "./prototypeAssets";

const HLS_URI = "http://192.168.1.84:8081/hls/placeholder.m3u8";
const SPEAKER_LANES = { Maya: "lower_left", Daniel: "lower_right" } as const;
const MODES: Mode[] = ["standard", "speaker-aware", "detailed"];
const HUD_LINES = 8;

export function PlayerScreen(): React.JSX.Element {
  const videoRef = useRef<VideoPlayer | null>(null);
  const shakaRef = useRef<ShakaPlayer | null>(null);
  const trackRef = useRef<NativeTrack | null>(null);
  const nativeCuesRef = useRef<NativeCue[]>([]);
  const cuesRef = useRef<CanonicalCue[]>([]);
  const captionHandleRef = useRef<string | null>(null);
  const appState = useKeplerAppStateManager();

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("standard");
  const [fontScale, setFontScale] = useState(1);
  const [status, setStatus] = useState("init");
  const [mediaTime, setMediaTime] = useState(0);
  const [overlayText, setOverlayText] = useState<string | null>(null);
  const [hud, setHud] = useState<string[]>([]);

  const log = useCallback((line: string) => {
    console.info(line);
    setHud((h) => [...h.slice(-(HUD_LINES - 1)), line]);
  }, []);
  const runScriptRef = useRef<(i: number) => void>(() => {});

  const buildCues = useCallback((m: Mode, scale: number) => {
    const track = trackRef.current;
    if (!track) return;
    const resolved = resolveAll(cuesRef.current, m, { speakerLanes: SPEAKER_LANES, fontScale: scale });
    const next = toNativeCues(resolved, m, (s, e, t) => new VTTCue(s, e, t) as unknown as NativeCue);
    replaceTrackCues(track, next, nativeCuesRef.current);
    nativeCuesRef.current = next;
    track.mode = m === "detailed" ? "hidden" : "showing";
    log(`[mode] ${m} scale=${scale} ${resolved.map((r) => `${r.cue.id}:${r.lane}${r.fallbackReason ? "!" : ""}`).join(" ")}`);
  }, [log]);

  // 1. Create the player once, exactly in the sample's order.
  useEffect(() => {
    let lastStatusAt = 0;
    (async () => {
      try {
        const p = new VideoPlayer();
        videoRef.current = p;
        try { await p.setMediaControlFocus(appState.getComponentInstance(), new KeplerMediaControlHandler()); } catch (e) { log(`[kmc] ${String(e)}`); }
        await p.initialize();
        log("[player] initialized");

        let metadataSeen = false;
        p.addEventListener("loadedmetadata", () => {
          log(`[player] loadedmetadata dur=${p.duration}${metadataSeen ? " (again, ignored)" : ""}`);
          if (metadataSeen) return;
          metadataSeen = true;
          setReady(true);
          // Gate 2 scripted run: starts 3 s after metadata; cycles Standard → Speaker-aware → Detailed.
          setTimeout(() => runScriptRef.current(0), 3000);
        });
        p.addEventListener("play", () => setStatus("playing"));
        p.addEventListener("pause", () => setStatus("paused"));
        p.addEventListener("seeked", () => log(`[seek] -> ${(p.currentTime * 1000).toFixed(0)} ms`));
        p.addEventListener("ended", () => setStatus("ended"));
        p.addEventListener("error", () => { log(`[player] error ${JSON.stringify((p as any).error)}`); setStatus("error"); });
        // Throttled clock display (1 Hz) so the surface view is not re-rendered per frame.
        p.addEventListener("timeupdate", () => {
          const now = Date.now();
          if (now - lastStatusAt > 1000) { lastStatusAt = now; setMediaTime(p.currentTime); }
        });
        p.autoplay = false;

        const parsed = parseVtt(PROTOTYPE_VTT);
        cuesRef.current = parsed.cues;
        parsed.warnings.forEach((w) => log(`[vtt] ${w}`));
        const track = p.addTextTrack("subtitles", "Prototype", "en") as unknown as NativeTrack;
        trackRef.current = track;
        (track as any).oncuechange = () => {
          const active = Array.from(((track as any).activeCues ?? []) as ArrayLike<NativeCue>);
          console.info(`[cuechange] media=${(p.currentTime * 1000).toFixed(0)} active=${active.map((c) => c.id).join(",") || "-"} wall=${Date.now()}`);
          setOverlayText(active.map((c) => c.text).join("\n\n") || null);
        };
        buildCues("standard", 1);

        shakaRef.current = new ShakaPlayer(p, { secure: false, abrEnabled: false, abrMaxWidth: 1920, abrMaxHeight: 1080 });
        shakaRef.current.load({ uri: HLS_URI, secure: false, drm_scheme: "", drm_license_uri: "" } as any, false);
        log(`[player] load ${HLS_URI}`);
      } catch (e) {
        log(`[player] setup failed: ${String(e)}`);
      }
    })();
    return () => {
      const p = videoRef.current; videoRef.current = null;
      try { p?.pause(); } catch { /* ignore */ }
      try { (p as any)?.deinitialize?.(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gate 2 script: one pass per mode. Wall-clock steps; every step is logged with the media time so
  // cue boundary errors can be computed from the device log ([cuechange] lines).
  const runScript = useCallback((modeIndex: number) => {
    const p = videoRef.current;
    if (!p || modeIndex >= MODES.length) { log("[script] done"); return; }
    setMode(MODES[modeIndex]);
    const step = (label: string, fn: () => void) => { fn(); console.info(`[script] ${MODES[modeIndex]} ${label} media=${(p.currentTime * 1000).toFixed(0)} wall=${Date.now()}`); };
    const at = (ms: number, label: string, fn: () => void) => setTimeout(() => step(label, fn), ms);
    at(0,     "seek0+play", () => { p.currentTime = 0; void p.play(); });
    at(9000,  "pause",      () => p.pause());
    at(11000, "play",       () => void p.play());
    at(13000, "seek7",      () => { p.currentTime = 7; });
    at(16000, "seek12",     () => { p.currentTime = 12; });
    at(18000, "seek0",      () => { p.currentTime = 0; });
    at(32000, "next-mode",  () => runScriptRef.current(modeIndex + 1));
  }, [log]);
  runScriptRef.current = runScript;

  // 2. Rebuild cues when mode or font scale changes.
  useEffect(() => {
    if (ready) buildCues(mode, fontScale);
  }, [mode, fontScale, ready, buildCues]);

  // 3. System caption preferences (Vega 0.24; verified on device).
  useEffect(() => {
    let cancelled = false;
    let api: any = null;
    (async () => {
      try {
        const mod = await import("@amazon-devices/kepler-a11y-settings-interface-turbo");
        api = (mod as any).KeplerA11ySettingsInterface ?? (mod as any).default;
        const apply = (props: any) => {
          log(`[a11y] textSize=${props?.textSize} font=${props?.textFont} color=${props?.textColor} bg=${props?.textBackgroundColor}/${props?.textBackgroundOpacity}`);
          if (!cancelled && props?.textSize) setFontScale(fontScaleFromTextSize(String(props.textSize)));
        };
        apply(await api.getCaptionPreferences());
        await api.addCaptioningPreferencesListener?.(apply);
      } catch (e) {
        log(`[a11y] unavailable: ${String(e)}`);
      }
    })();
    return () => { cancelled = true; try { api?.removeCaptioningPreferencesListener?.(); } catch { /* ignore */ } };
  }, [log]);

  // 4. Remote.
  useTVEventHandler((evt: { eventType: string; eventKeyAction?: number }) => {
    if (evt.eventKeyAction !== 0) return;
    const p = videoRef.current;
    console.info(`[remote] ${evt.eventType}`);
    if (!p) return;
    switch (evt.eventType) {
      case "rewind": case "fast_backward": p.currentTime = 0; break;
      case "select":
      case "playpause":
        if (p.paused) void p.play(); else p.pause();
        break;
      case "menu":
        setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length]);
        break;
      case "skip_backward": p.currentTime = 0; break;
      case "skip_forward":  p.currentTime = Math.min((p.duration || 30) - 0.5, p.currentTime + 10); break;
      case "left":  p.currentTime = Math.max(0, p.currentTime - 5); break;
      case "right": p.currentTime = Math.min((p.duration || 30) - 0.5, p.currentTime + 5); break;
      case "up":    setFontScale((f) => Math.min(2.5, +(f + 0.25).toFixed(2))); break;
      case "down":  setFontScale((f) => Math.max(0.5, +(f - 0.25).toFixed(2))); break;
      default: break;
    }
  });

  const onSurfaceViewCreated = useCallback((h: string) => {
    log("[surface] created");
    const p = videoRef.current;
    p?.setSurfaceHandle(h);
    if (captionHandleRef.current) p?.setCaptionViewHandle(captionHandleRef.current);
    p?.play().then(() => log("[player] play() ok")).catch((e: unknown) => log(`[player] play() failed ${String(e)}`));
  }, [log]);
  const onSurfaceViewDestroyed = useCallback((h: string) => { try { videoRef.current?.clearSurfaceHandle(h); } catch { /* ignore */ } }, []);
  const onCaptionViewCreated = useCallback((h: string) => {
    captionHandleRef.current = h;
    log("[captions] view created");
    try { videoRef.current?.setCaptionViewHandle(h); } catch (e) { log(`[captions] attach failed ${String(e)}`); }
  }, [log]);
  const onCaptionViewDestroyed = useCallback((h: string) => { captionHandleRef.current = null; try { videoRef.current?.clearCaptionViewHandle(h); } catch { /* ignore */ } }, []);

  return (
    <View style={styles.root}>
      {ready && (
        <>
          <KeplerVideoSurfaceView style={StyleSheet.absoluteFill} onSurfaceViewCreated={onSurfaceViewCreated} onSurfaceViewDestroyed={onSurfaceViewDestroyed} />
          <KeplerCaptionsView style={styles.captions} onCaptionViewCreated={onCaptionViewCreated} onCaptionViewDestroyed={onCaptionViewDestroyed} show={mode !== "detailed"} />
        </>
      )}
      {mode === "detailed" && overlayText ? (
        <View style={styles.overlayBottom} pointerEvents="none">
          <Text style={[styles.overlayText, { fontSize: 36 * fontScale }]}>{overlayText}</Text>
        </View>
      ) : null}
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudText}>mode: {mode}   scale: {fontScale}   {status}   t={mediaTime.toFixed(1)}</Text>
        <Text style={styles.hudText}>select play/pause · menu mode · ←/→ seek 5s · ↑/↓ scale</Text>
        {hud.map((l, i) => <Text key={i} style={styles.hudLog}>{l}</Text>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  captions: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent", zIndex: 2 },
  overlayBottom: { position: "absolute", left: "10%", right: "10%", bottom: "8%", alignItems: "center", zIndex: 3 },
  overlayText: { color: "white", backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 16, paddingVertical: 6, textAlign: "center" },
  hud: { position: "absolute", top: 12, left: 12, zIndex: 4 },
  hudText: { color: "rgba(255,255,255,0.7)", fontSize: 18 },
  hudLog: { color: "rgba(180,255,180,0.85)", fontSize: 13, fontFamily: "monospace" },
});
