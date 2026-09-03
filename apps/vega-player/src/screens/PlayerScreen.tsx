/**
 * Playback screen.
 *
 * Playback: MSE via the Vega-patched Shaka player (URL mode is broken on the virtual device,
 * friction log FL-008). Order mirrors vega-video-sample VideoHandler: new VideoPlayer →
 * setMediaControlFocus → initialize → listeners → autoplay=false → text track + cues →
 * ShakaPlayer.load(hls) → on loadedmetadata mount surface + captions → surface created →
 * setSurfaceHandle → play().
 *
 * Captions: CaptionController owns the native text track. Standard and Speaker-aware are drawn
 * by KeplerCaptionsView; Detailed hides the native track and draws DetailedOverlay from the
 * controller's active set. Only one native caption surface is ever mounted.
 *
 * No per-frame state updates in this component (the device log rate limit hides pipeline errors
 * when the surface re-renders every frame).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { KeplerCaptionsView, KeplerMediaControlHandler, KeplerVideoSurfaceView, VideoPlayer, VTTCue } from "@amazon-devices/react-native-w3cmedia";
import { TVFocusGuideView, useKeplerAppStateManager } from "@amazon-devices/react-native-kepler";
import type { SystemCaptionPreferences } from "@sightline-wip/core";
import { ShakaPlayer } from "../w3cmedia/shakaplayer/ShakaPlayer";
import { CaptionController, DetailedOverlay, MediaClock, requestCaptionTextSize, useSystemCaptionPrefs, useSecondClock, useWordClock, type NativeCue, type NativeTrack } from "@sightline-wip/vega-captions";
import { SettingsPanel } from "../settings/SettingsPanel";
import { MODE_LABEL, useSettings } from "../settings/store";
import { useRemote } from "../remote/useRemote";
import { devLog, syncLog } from "../diagnostics/log";
import { DiagnosticsPanel } from "../diagnostics/DiagnosticsPanel";
import { FocusButton } from "../ui/Focusable";
import { colors, font, px, safe, space, type as typeScale } from "../theme";
import { GlassPanel, Scrim } from "../ui/Glass";
import { posterFor } from "../media/posters";
import type { SceneMedia } from "../media/config";
import { SCENES_BUNDLED } from "../assets/scenes.generated";
import { registerFileScheme } from "../media/fileScheme";

type PlayState = "loading" | "playing" | "paused" | "ended" | "error";

/** The LAN manifest if it answers within 1.5 s, else the packaged rendition when the scene has one. */
async function chooseHlsUri(scene: SceneMedia): Promise<string> {
  if (!scene.localHlsUri) return scene.hlsUri;
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), 1500);
  try {
    const res = await fetch(scene.hlsUri, ctl ? { signal: ctl.signal, method: "GET" } : { method: "GET" });
    if (res.ok) { devLog("[player] source=lan"); return scene.hlsUri; }
  } catch { /* unreachable */ } finally { clearTimeout(timer); }
  devLog("[player] source=packaged (LAN server unreachable)");
  return scene.localHlsUri;
}

/** Fetch the caption track and companion file from the publisher's server with a short timeout; bundled copies otherwise. */
async function loadCaptionAssets(scene: SceneMedia, bundledVtt: string, bundledCompanion: unknown | null): Promise<{ vtt: string; companion: unknown | null; source: "remote" | "bundled" }> {
  if (!scene.remote) return { vtt: bundledVtt, companion: bundledCompanion, source: "bundled" };
  const withTimeout = async (uri: string, ms: number): Promise<string | null> => {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => ctl?.abort(), ms);
    try {
      const res = await fetch(uri, ctl ? { signal: ctl.signal } : undefined);
      if (!res.ok) return null;
      return await res.text();
    } catch { return null; } finally { clearTimeout(timer); }
  };
  const t0 = Date.now();
  const [vtt, comp] = await Promise.all([withTimeout(scene.remote.vttUri, 2500), withTimeout(scene.remote.companionUri, 2500)]);
  let companion: unknown | null = null;
  if (comp) { try { companion = JSON.parse(comp); } catch { companion = null; } }
  if (vtt && vtt.startsWith("WEBVTT")) {
    // Track and companion come from the same source, never mixed: a remote track with no remote companion
    // plays with Standard captions rather than against a bundled companion that may describe older text.
    devLog(`[assets] source=remote vtt=${vtt.length}B companion=${companion ? "yes" : "none (enhancements off)"} in ${Date.now() - t0} ms`);
    return { vtt, companion, source: "remote" };
  }
  devLog(`[assets] source=bundled (remote unavailable after ${Date.now() - t0} ms)`);
  return { vtt: bundledVtt, companion: bundledCompanion, source: "bundled" };
}

export function PlayerScreen({ scene, onExit, onNextScene }: { scene: SceneMedia; onExit: () => void; onNextScene?: () => void }): React.JSX.Element {
  const settings = useSettings();
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const appState = useKeplerAppStateManager();
  const system = useSystemCaptionPrefs();

  const videoRef = useRef<VideoPlayer | null>(null);
  const shakaRef = useRef<ShakaPlayer | null>(null);
  const controllerRef = useRef<CaptionController | null>(null);
  const clockRef = useRef<MediaClock | null>(null);
  const captionHandleRef = useRef<string | null>(null);
  const metadataSeen = useRef(false);

  const [ready, setReady] = useState(false);
  const [play, setPlay] = useState<PlayState>("loading");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<ReturnType<CaptionController["expectedAt"]> | null>(null);
  const [resolved, setResolved] = useState<import("@sightline-wip/core").ResolvedCaption[]>([]);
  const [panel, setPanel] = useState<"none" | "settings" | "controls">("none");
  const [diag, setDiag] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const recovered = useRef(false); // one automatic recovery per scene
  const resumeAtRef = useRef(0);
  // Development only: when the platform refuses the caption-size write (third-party apps cannot
  // write CaptioningProps; the VVD has no Accessibility settings page), simulate the size in-app so
  // the lane-fallback logic can still be exercised. Native captions do not change size in this
  // path, and the diagnostics panel says SIMULATED. Never used in the viewer flow.
  const [simulatedSize, setSimulatedSize] = useState<string | null>(null);
  const effectiveSystem = useMemo(() => (system ? (simulatedSize ? { ...system, textSize: simulatedSize } : system) : null), [system, simulatedSize]);
  const [clock, setClock] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const [firstFrame, setFirstFrame] = useState(false); // the poster stays until the picture is actually moving (UX review M15)

  const bundled = SCENES_BUNDLED[scene.id];

  // Second clock (Measurement B): rAF sampling anchored to media time; logs the first frame on
  // which the expected active set changes and compares it with the boundary.
  useSecondClock(clockRef, controllerRef, ready && play === "playing");
  // Word clock (schema 0.2): drives word colouring and sound events in Detailed between cue events.
  useWordClock(clockRef, controllerRef, ready && play === "playing" && settings.mode === "detailed");
  const [nowMs, setNowMs] = useState(0);
  const [sfxStart, setSfxStart] = useState<Map<string, number>>(new Map());

  // 1. Player lifecycle.
  useEffect(() => {
    let disposed = false;
    metadataSeen.current = false;
    playStarted.current = false;
    // A new scene (or a retry) starts from a clean slate; otherwise an end card or a stale clock survives the switch.
    setPlay("loading"); setReady(false); setPanel("none"); setClock(0); setDuration(0); setErrorText(null); setFirstFrame(false); if (reloadKey === 0) recovered.current = false;
    (async () => {
      try {
        const p = new VideoPlayer();
        videoRef.current = p;
        try { await p.setMediaControlFocus(appState.getComponentInstance(), new KeplerMediaControlHandler()); } catch (e) { devLog(`[kmc] ${String(e)}`); }
        await p.initialize();
        if (disposed) return;
        // A scene change creates a new VideoPlayer while the caption view may already exist: re-attach it (UX review B2).
        if (captionHandleRef.current) { try { p.setCaptionViewHandle(captionHandleRef.current); } catch (e) { devLog(`[captions] re-attach failed ${String(e)}`); } }
        devLog("[player] initialized");
        p.addEventListener("loadedmetadata", () => {
          if (metadataSeen.current) { devLog("[player] loadedmetadata (again, ignored)"); return; }
          metadataSeen.current = true;
          devLog(`[player] loadedmetadata dur=${p.duration}`);
          if (Number.isFinite(p.duration)) setDuration(p.duration);
          if (resumeAtRef.current > 0.5) { try { p.currentTime = resumeAtRef.current; } catch { /* ignore */ } resumeAtRef.current = 0; }
          setReady(true);
        });
        p.addEventListener("play", () => { setPlay("playing"); controllerRef.current?.recompute("play"); });
        // After "ended" the platform restarts without a play event (UX review B1): "playing" and the first timeupdate are the fallbacks.
        p.addEventListener("playing", () => setPlay((cur) => (cur === "ended" || cur === "loading" ? "playing" : cur)));
        p.addEventListener("pause", () => { setPlay("paused"); controllerRef.current?.recompute("pause"); });
        p.addEventListener("seeked", () => controllerRef.current?.recompute("seeked"));
        p.addEventListener("ended", () => { setPlay("ended"); setPanel((cur) => (cur === "controls" ? "none" : cur)); controllerRef.current?.recompute("ended"); });
        p.addEventListener("error", () => {
          const e = (p as any).error; devLog(`[player] error ${JSON.stringify(e)}`);
          // A decode error in the middle of playback (the virtual device's audio sink throws one now and then after a
          // seek) gets one silent recovery: reload the scene at the same position. A second failure shows the card.
          if (e?.code === 3 && metadataSeen.current && !recovered.current) {
            recovered.current = true; resumeAtRef.current = p.currentTime;
            devLog(`[player] recovering once at ${p.currentTime.toFixed(1)} s`);
            setReloadKey((k) => k + 1); return;
          }
          setPlay("error"); setErrorText("The video could not be played.");
        });
        let last = 0;
        p.addEventListener("timeupdate", () => {
          const n = Date.now(); if (n - last > 1000) { last = n; setClock(p.currentTime); }
          if (p.currentTime > 0.15) setFirstFrame(true);
        });
        p.autoplay = false;

        const track = p.addTextTrack("subtitles", "Captions", "en") as unknown as NativeTrack;
        // Publisher path: try the caption files served beside the stream, fall back to the bundled copies.
        // The stream source probe runs at the same time so an offline start pays one timeout, not two.
        const [assets, hlsUri] = await Promise.all([
          loadCaptionAssets(scene, bundled?.vtt ?? "WEBVTT\n", bundled?.companion ?? null),
          chooseHlsUri(scene),
        ]);
        if (disposed) return;
        // One event-anchored media clock for the controller and both frame clocks (FL-027).
        const clock = new MediaClock();
        clock.attach(p as unknown as import("@sightline-wip/vega-captions").ClockSource);
        clockRef.current = clock;
        let controller: CaptionController;
        try {
          controller = new CaptionController(
            { makeCue: (s, e, t) => new VTTCue(s, e, t) as unknown as NativeCue, track, now: () => clock.now(), nativeMarkup: scene.nativeMarkup },
            assets.vtt, assets.companion, settings, system,
          );
        } catch (e) {
          // The companion file or the resolver failed in a way validation did not catch: play with Standard
          // captions from the canonical track alone, and say so.
          devLog(`[controller] failed (${String(e)}); Standard captions only`);
          controller = new CaptionController(
            { makeCue: (s, e, t) => new VTTCue(s, e, t) as unknown as NativeCue, track, now: () => clock.now() },
            assets.vtt, null, { ...settings, mode: "standard" }, system,
          );
        }
        controllerRef.current = controller;
        controller.subscribe((st) => { setResolved(st.overlay); setNowMs(st.nowMs); setSfxStart(st.sfxStart); });
        // The viewer may have changed a setting while the assets loaded: apply the latest, not the closure's.
        controller.setViewer(settingsRef.current);

        registerFileScheme();
        shakaRef.current = new ShakaPlayer(p, { secure: false, abrEnabled: false, abrMaxWidth: 1920, abrMaxHeight: 1080 });
        shakaRef.current.onLoadError = (e) => { if (disposed) return; devLog(`[player] load failed ${String(e)}`); setPlay("error"); setErrorText("The stream could not be loaded."); };
        shakaRef.current.load({ uri: hlsUri, secure: false, drm_scheme: "", drm_license_uri: "" } as any, false);
        devLog(`[player] load ${hlsUri}`);
      } catch (e) {
        devLog(`[player] setup failed: ${String(e)}`);
        setPlay("error"); setErrorText("The player could not start.");
      }
    })();
    return () => {
      disposed = true;
      controllerRef.current?.dispose(); controllerRef.current = null;
      clockRef.current?.detach(); clockRef.current = null;
      // The Shaka instance owns MediaSource buffers and listeners on the player: unload it before the player goes.
      const sh = shakaRef.current; shakaRef.current = null;
      try { sh?.unload(); } catch (e) { devLog(`[player] shaka unload ${String(e)}`); }
      const p = videoRef.current; videoRef.current = null;
      try { p?.pause(); } catch { /* ignore */ }
      try { (p as any)?.deinitialize?.(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, scene.id]);

  // 2. Push viewer and system preferences into the controller.
  useEffect(() => { controllerRef.current?.setViewer(settings); controllerRef.current?.recompute("mode"); }, [settings.mode, settings.reducedMotion, settings.wordHighlight, settings.deliveryTypography, ready]);
  useEffect(() => { if (effectiveSystem) controllerRef.current?.setSystem(effectiveSystem); }, [effectiveSystem, ready]);

  // 3. Surface and caption view.
  const playStarted = useRef(false);
  const onSurfaceViewCreated = useCallback((h: string) => {
    devLog(`[surface] created${playStarted.current ? " (again; surface re-attached, play not repeated)" : ""}`);
    const p = videoRef.current;
    p?.setSurfaceHandle(h);
    if (captionHandleRef.current) p?.setCaptionViewHandle(captionHandleRef.current);
    if (playStarted.current) return;
    playStarted.current = true;
    setPanel("controls"); // the title and mode show for a few seconds at the start, then the chrome hides itself
    p?.play().then(() => devLog("[player] play() ok")).catch((e: unknown) => devLog(`[player] play() failed ${String(e)}`));
  }, []);
  const onSurfaceViewDestroyed = useCallback((h: string) => { try { videoRef.current?.clearSurfaceHandle(h); } catch { /* ignore */ } }, []);
  const onCaptionViewCreated = useCallback((h: string) => { captionHandleRef.current = h; try { videoRef.current?.setCaptionViewHandle(h); } catch (e) { devLog(`[captions] attach failed ${String(e)}`); } }, []);
  const onCaptionViewDestroyed = useCallback((h: string) => { captionHandleRef.current = null; try { videoRef.current?.clearCaptionViewHandle(h); } catch { /* ignore */ } }, []);

  // 3b. The transport chrome hides itself a few seconds after the last key while playing; it stays while paused.
  const [chromeTick, setChromeTick] = useState(0); // bumped on every key press so the hide timer restarts from the last press, not from the clock
  useEffect(() => {
    if (panel !== "controls" || play !== "playing") return;
    const t = setTimeout(() => setPanel((cur) => (cur === "controls" ? "none" : cur)), 4000);
    return () => clearTimeout(t);
  }, [panel, play, chromeTick]);

  // 4. Remote.
  useRemote((action) => {
    const p = videoRef.current;
    setChromeTick((n) => n + 1);
    if (panel === "settings") { if (action === "back" || action === "menu") { setPanel("none"); return true; } return; }
    // With the end card or an error card up, the buttons own Select and the arrows; only Back and Menu are global.
    if (play === "ended" || errorText) { if (action === "back") { onExit(); return true; } if (action === "menu") setPanel("settings"); return; }
    switch (action) {
      case "select": case "playpause":
        if (!p) return; if (p.paused) void p.play(); else p.pause(); setPanel("controls"); break;
      case "menu": setPanel("settings"); break;
      case "back": onExit(); return true; // one press leaves playback, as the on-screen hint says
      case "left": if (p) { p.currentTime = Math.max(0, p.currentTime - 10); syncLog({ event: "seek_back", mediaMs: p.currentTime * 1000 }); setPanel("controls"); } break;
      case "right": if (p) { p.currentTime = Math.min(Number.isFinite(p.duration) && p.duration > 0 ? p.duration - 0.3 : Number.MAX_SAFE_INTEGER, p.currentTime + 10); syncLog({ event: "seek_fwd", mediaMs: p.currentTime * 1000 }); setPanel("controls"); } break;
      case "skipBack": if (p) { p.currentTime = Math.max(0, p.currentTime - 30); syncLog({ event: "seek_back", mediaMs: p.currentTime * 1000 }); setPanel("controls"); } break;
      case "skipForward": if (p) { p.currentTime = Math.min(Number.isFinite(p.duration) && p.duration > 0 ? p.duration - 0.3 : Number.MAX_SAFE_INTEGER, p.currentTime + 30); syncLog({ event: "seek_fwd", mediaMs: p.currentTime * 1000 }); setPanel("controls"); } break;
      case "info": setDiag((d) => !d); break;
      case "pageUp": {
        if (!diag) break; // development only: reachable while the diagnostics panel is open   // development only: try the real system write, then simulate if nothing arrives
        const before = system?.textSize;
        void requestCaptionTextSize("very_large").then(() => setTimeout(() => {
          if ((system?.textSize ?? before) === before) { devLog("[a11y] no preference event after write; SIMULATING textSize=very_large in-app"); setSimulatedSize("very_large"); }
        }, 1500));
        break;
      }
      case "pageDown": if (!diag) break; void requestCaptionTextSize("normal"); setSimulatedSize(null); devLog("[a11y] simulation cleared"); break;
      default: break;
    }
  }, true);

  // Dev: does the bundled Roboto Flex actually render? Two off-screen strings, one per family; widths differ if it loaded.
  const probe = useRef<{ flex?: number; sys?: number }>({});
  const onProbe = (k: "flex" | "sys") => (e: { nativeEvent: { layout: { width: number } } }) => {
    probe.current[k] = e.nativeEvent.layout.width;
    if (probe.current.flex && probe.current.sys) devLog(`[font] robotoFlex=${probe.current.flex.toFixed(1)} system=${probe.current.sys.toFixed(1)} loaded=${Math.abs(probe.current.flex - probe.current.sys) > 0.5}`);
  };

  const retry = () => { setErrorText(null); setPlay("loading"); setReady(false); setReloadKey((k) => k + 1); };

  const statusLine = useMemo(() => `${MODE_LABEL[settings.mode]} · ${play === "playing" ? "Playing" : play === "paused" ? "Paused" : play === "ended" ? "Finished" : play === "loading" ? "Loading" : "Error"} · ${clock.toFixed(0)} s`, [settings.mode, play, clock]);
  const progress = duration > 0 ? Math.min(1, Math.max(0, clock / duration)) : 0;

  return (
    <View style={styles.root}>
      {ready && play !== "error" && (
        <>
          <Surfaces onSurfaceViewCreated={onSurfaceViewCreated} onSurfaceViewDestroyed={onSurfaceViewDestroyed} onCaptionViewCreated={onCaptionViewCreated} onCaptionViewDestroyed={onCaptionViewDestroyed} showNative={settings.mode !== "detailed"} />
        </>
      )}
      {settings.mode === "detailed" && play !== "error" ? <DetailedOverlay captions={resolved} system={effectiveSystem ?? {}} reducedMotion={settings.reducedMotion} nowMs={nowMs} sfxStart={sfxStart} /> : null}

      {diag ? (
        <View style={styles.probe} pointerEvents="none">
          <Text onLayout={onProbe("flex")} style={{ fontFamily: "Roboto Flex Wide", fontSize: 40 }}>Whose it is. Obviously.</Text>
          <Text onLayout={onProbe("sys")} style={{ fontSize: 40 }}>Whose it is. Obviously.</Text>
        </View>
      ) : null}

      {(play === "loading" || !firstFrame) && !errorText ? (
        // The poster covers the black gap before the first frame (FL-019) and carries the title in.
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={posterFor(scene.id)} style={styles.fill} resizeMode="cover" />
          <Scrim side="bottom" style={{ top: px(500) }} />
          {panel === "controls" ? null : (
            <View style={styles.loadingBlock}>
              <Text style={styles.kicker}>{MODE_LABEL[settings.mode]}</Text>
              <Text style={styles.loadingTitle}>{scene.title}</Text>
              <Text style={styles.loadingSub}>{play === "loading" ? "Loading…" : " "}</Text>
            </View>
          )}
        </View>
      ) : null}

      {errorText ? (
        <View style={styles.center}>
          <GlassPanel strong style={styles.errorCard}>
            <Text style={styles.errorTitle}>Playback problem</Text>
            <Text style={styles.errorBody}>{errorText} The rest of the demo still works; try again or go back.</Text>
            <TVFocusGuideView style={styles.rowActions} trapFocusLeft trapFocusRight trapFocusUp trapFocusDown>
              <FocusButton label="Try again" onPress={retry} hasTVPreferredFocus />
              <FocusButton label="Back" onPress={onExit} />
            </TVFocusGuideView>
          </GlassPanel>
        </View>
      ) : null}

      {panel === "controls" && !errorText ? (
        <View style={styles.chrome} pointerEvents="none">
          <Scrim side="bottom" style={{ top: 0 }} />
          <View style={styles.chromeInner}>
            <Text style={styles.kicker}>{MODE_LABEL[settings.mode]}{settings.reducedMotion ? " · Reduced motion" : ""}</Text>
            <Text style={styles.chromeTitle} numberOfLines={1}>{scene.title}</Text>
            <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}><View style={[styles.trackFill, { width: Math.round(trackW * progress) }]} /><View style={[styles.trackKnob, { left: Math.round(trackW * progress) }]} /></View>
            <View style={styles.times}>
              <Text style={styles.time}>{fmtTime(clock)}</Text>
              <Text style={styles.timeState}>{play === "paused" ? "❚❚  Paused" : play === "ended" ? "Finished" : ""}</Text>
              <Text style={styles.time}>{duration > 0 ? `-${fmtTime(Math.max(0, duration - clock))}` : ""}</Text>
            </View>
            <View style={styles.hintRow}>
              <Hint k="Select" v={play === "ended" ? "Replay" : play === "paused" ? "Play" : "Pause"} /><Hint k={"\u25C0\uFE0E \u25B6\uFE0E"} v="Seek 10 s" /><Hint k={"\u23EA\uFE0E \u23E9\uFE0E"} v="Skip 30 s" /><Hint k="Menu" v="Captions" /><Hint k="Back" v="Exit" />
            </View>
          </View>
        </View>
      ) : null}

      {panel === "settings" ? <SettingsPanel overlay ended={play === "ended"} sceneId={scene.id} onClose={() => setPanel("none")} /> : null}

      {play === "ended" && panel === "none" ? (
        <View style={styles.endWrap}>
          <Scrim side="bottom" style={{ top: 0 }} />
          <GlassPanel strong style={styles.endCard}>
            <Text style={styles.kicker}>Scene finished</Text>
            <Text style={styles.endTitle}>{scene.title}</Text>
            <TVFocusGuideView style={styles.rowActions} trapFocusLeft trapFocusRight trapFocusUp trapFocusDown>
              <FocusButton glyph="↺" label="Replay" onPress={() => { const p = videoRef.current; if (p) { p.currentTime = 0; setPlay("playing"); setPanel("controls"); void p.play(); } }} hasTVPreferredFocus />
              {onNextScene ? <FocusButton glyph={"\u25B6\uFE0E"} label="Next scene" onPress={onNextScene} /> : null}
              <FocusButton label="Captions" onPress={() => setPanel("settings")} />
              <FocusButton label="Back" onPress={onExit} />
            </TVFocusGuideView>
          </GlassPanel>
        </View>
      ) : null}

      {diag ? <DiagnosticsPanel header={`diagnostics · ${statusLine} · scale ${controllerRef.current?.fontScale ?? "?"} · textSize ${effectiveSystem?.textSize ?? "?"}${simulatedSize ? " (SIMULATED, native size unchanged)" : ""}`} /> : null}
    </View>
  );
}

/** The video surface and the native caption view, memoised: word-clock and clock updates re-render the chrome, never these. */
const Surfaces = React.memo(function Surfaces(p: { onSurfaceViewCreated: (h: string) => void; onSurfaceViewDestroyed: (h: string) => void; onCaptionViewCreated: (h: string) => void; onCaptionViewDestroyed: (h: string) => void; showNative: boolean }): React.JSX.Element {
  return (
    <>
      <KeplerVideoSurfaceView style={StyleSheet.absoluteFill} onSurfaceViewCreated={p.onSurfaceViewCreated} onSurfaceViewDestroyed={p.onSurfaceViewDestroyed} />
      <KeplerCaptionsView style={styles.captions} onCaptionViewCreated={p.onCaptionViewCreated} onCaptionViewDestroyed={p.onCaptionViewDestroyed} show={p.showNative} />
    </>
  );
});

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec)); const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function Hint({ k, v }: { k: string; v: string }): React.JSX.Element {
  return <View style={styles.hint}><Text style={styles.hintKey}>{k}</Text><Text style={styles.hintVal}>{v}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  fill: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  probe: { position: "absolute", left: -5000, top: -5000, opacity: 0, alignItems: "flex-start" },
  captions: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent", zIndex: 2 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: safe.x, zIndex: 5 },
  kicker: { color: colors.inkMuted, fontSize: typeScale.small, letterSpacing: px(3), textTransform: "uppercase", fontFamily: font.bold },
  loadingBlock: { position: "absolute", left: safe.x, right: safe.x, bottom: px(120) },
  loadingTitle: { color: colors.ink, fontSize: typeScale.display, fontFamily: font.bold, letterSpacing: -1, marginTop: px(6) },
  loadingSub: { color: colors.inkMuted, fontSize: typeScale.body, fontFamily: font.regular, marginTop: px(8) },
  errorCard: { paddingHorizontal: space.lg, paddingVertical: space.lg, maxWidth: px(1000) },
  errorTitle: { color: colors.ink, fontSize: typeScale.title, fontFamily: font.bold },
  errorBody: { color: colors.inkMuted, fontSize: typeScale.body, fontFamily: font.regular, marginTop: space.xs },
  rowActions: { flexDirection: "row", gap: space.sm, marginTop: space.md, flexWrap: "wrap" },
  chrome: { position: "absolute", left: 0, right: 0, bottom: 0, height: px(420), zIndex: 5 },
  chromeInner: { position: "absolute", left: safe.x, right: safe.x, bottom: px(54) },
  chromeTitle: { color: colors.ink, fontSize: typeScale.title, fontFamily: font.bold, letterSpacing: -0.5, marginTop: px(4), marginBottom: space.sm },
  track: { height: px(8), borderRadius: px(4), backgroundColor: "rgba(255,255,255,0.28)", overflow: "visible" },
  trackFill: { height: px(8), borderRadius: px(4), backgroundColor: colors.ink },
  trackKnob: { position: "absolute", top: px(-6), marginLeft: px(-10), width: px(20), height: px(20), borderRadius: px(10), backgroundColor: colors.ink },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: px(12) },
  time: { color: colors.ink, fontSize: typeScale.small, fontFamily: font.bold, fontVariant: ["tabular-nums"], minWidth: px(120) },
  timeState: { color: colors.inkMuted, fontSize: typeScale.small, fontFamily: font.regular },
  hintRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  hint: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderColor: colors.glassBorder, borderWidth: 1, borderRadius: px(999), paddingVertical: px(6), paddingHorizontal: px(16), gap: px(10) },
  hintKey: { color: colors.ink, fontSize: typeScale.small, fontFamily: font.bold },
  hintVal: { color: colors.inkMuted, fontSize: typeScale.small, fontFamily: font.regular },
  endWrap: { position: "absolute", left: 0, right: 0, bottom: 0, height: px(520), zIndex: 5, justifyContent: "flex-end", paddingHorizontal: safe.x, paddingBottom: safe.y },
  endCard: { paddingHorizontal: space.lg, paddingVertical: space.md, alignSelf: "flex-start", maxWidth: px(1400) },
  endTitle: { color: colors.ink, fontSize: typeScale.title, fontFamily: font.bold, letterSpacing: -0.5, marginTop: px(4) },
});
