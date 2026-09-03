/**
 * App shell: landing → playback, with settings and About reachable from the landing screen.
 * Navigation is a small state machine; Back always goes one level up, then exits at the root.
 */

import React, { useEffect, useState } from "react";
import { LandingScreen } from "./screens/LandingScreen";
import { PlayerScreen } from "./screens/PlayerScreen";
import { AboutScreen } from "./screens/AboutScreen";
import { SettingsPanel } from "./settings/SettingsPanel";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { hydrateSettings, resetToStandard } from "./settings/store";
import { useRemote } from "./remote/useRemote";
import { DEFAULT_SCENE_ID, SCENES, SCENE_ORDER, loadRuntimeConfig } from "./media/config";
import { SCALE, windowSize } from "./theme";
import { devLog } from "./diagnostics/log";
devLog(`[window] ${windowSize.width}x${windowSize.height} scale=${SCALE.toFixed(3)}`);

type Route = "landing" | "player" | "settings" | "about";

// Uncaught JS errors take a Vega app to the launcher. Log them with context first; non-fatal ones are
// swallowed so a transient failure (a rejected fetch, a late event on a disposed player) does not end the session.
const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler?: () => (e: Error, isFatal?: boolean) => void; setGlobalHandler?: (h: (e: Error, isFatal?: boolean) => void) => void } };
if (g.ErrorUtils?.setGlobalHandler) {
  const previous = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((e, isFatal) => {
    devLog(`[crash] ${isFatal ? "fatal" : "non-fatal"}: ${String(e)} ${e?.stack?.split("\n").slice(0, 2).join(" | ") ?? ""}`);
    if (isFatal && previous) previous(e, isFatal);
  });
}

export const App = (): React.JSX.Element => {
  const [route, setRoute] = useState<Route>("landing");
  const [configHost, setConfigHost] = useState<string | null>(null);
  useEffect(() => { void hydrateSettings(); void loadRuntimeConfig().then((h) => { devLog(`[config] devHost=${h}`); setConfigHost(h); }); }, []);
  const [sceneId, setSceneId] = useState(DEFAULT_SCENE_ID);
  const scene = SCENES[sceneId]; // SCENES is rebuilt when the packaged config loads (configHost changes re-render)
  void configHost;
  const sceneList = SCENE_ORDER.map((id) => SCENES[id]);

  // Back from a root-level screen returns to landing; the player owns its own Back handling.
  // Back on settings/about returns to landing (consumed); Back on landing is left to the OS (exit).
  useRemote((a) => { if (a === "back" && (route === "settings" || route === "about")) { setRoute("landing"); return true; } if (a === "menu" && route === "landing") { setRoute("settings"); return true; } return false; }, route !== "player");

  switch (route) {
    case "player": return <ErrorBoundary label="player" onReset={() => { resetToStandard(); setRoute("landing"); }}><PlayerScreen key={sceneId} scene={scene} onExit={() => setRoute("landing")} onNextScene={() => setSceneId((id) => SCENE_ORDER[(SCENE_ORDER.indexOf(id) + 1) % SCENE_ORDER.length])} /></ErrorBoundary>;
    case "settings": return <SettingsPanel sceneId={sceneId} onClose={() => setRoute("landing")} />;
    case "about": return <AboutScreen sceneId={sceneId} onBack={() => setRoute("landing")} />;
    default: return <LandingScreen scene={scene} scenes={sceneList} onPlay={() => setRoute("player")} onSettings={() => setRoute("settings")} onAbout={() => setRoute("about")} onSelectScene={setSceneId} onPlayScene={(id) => { setSceneId(id); setRoute("player"); }} />;
  }
};
