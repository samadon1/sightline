/**
 * Viewer settings. P0 exposes exactly two: caption mode and reduced motion.
 * A tiny subscription API over an in-memory state, persisted on the device with the
 * platform's async-storage module (found by FL-020: launches reset to defaults otherwise).
 * No accounts, no cloud profiles; the stored value is one small JSON object.
 */

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Mode, ViewerPreferences } from "@sightline-wip/core";
import { devLog } from "../diagnostics/log";

const STORAGE_KEY = "sightline.viewerPreferences.v1";

export const MODES: Mode[] = ["standard", "speaker-aware", "detailed"];

export const MODE_LABEL: Record<Mode, string> = {
  standard: "Standard",
  "speaker-aware": "Speaker-aware",
  detailed: "Detailed",
};

export const MODE_DESCRIPTION: Record<Mode, string> = {
  standard: "Conventional captions at the bottom of the screen. Always available.",
  "speaker-aware": "Each speaker gets a name and a colour, on their side of the screen when the line fits. Drawn by the TV.",
  detailed: "Type size follows loudness, weight follows the voice, off-camera lines are italic, sounds are labelled. Drawn by the app.",
};

// Word highlighting on by default (colour was the preferred device in Caption Royale). Size and weight are on
// inside Detailed: Detailed is itself opt-in (Speaker-aware is the default mode), and a viewer who chooses it is
// choosing the full design system; the toggle takes the typography away in one press. Reduced motion stays on
// by default because motion, not type, is the device the research and the guidelines treat as risky.
const DEFAULTS: ViewerPreferences = { mode: "speaker-aware", reducedMotion: true, wordHighlight: true, deliveryTypography: true };

let state: ViewerPreferences = { ...DEFAULTS };
const listeners = new Set<(s: ViewerPreferences) => void>();

export function getSettings(): ViewerPreferences { return state; }

export function setSettings(patch: Partial<ViewerPreferences>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
  persist(state);
}

let hydrated = false;
function isMode(v: unknown): v is Mode { return typeof v === "string" && (MODES as string[]).includes(v); }

/** Load the stored preferences once at startup. Bad or missing data leaves the defaults. */
export async function hydrateSettings(): Promise<ViewerPreferences> {
  if (hydrated) return state;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    devLog(`[settings] restored ${raw ? raw : "nothing (defaults)"}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewerPreferences>;
      const next: ViewerPreferences = {
        mode: isMode(parsed.mode) ? parsed.mode : DEFAULTS.mode,
        reducedMotion: typeof parsed.reducedMotion === "boolean" ? parsed.reducedMotion : DEFAULTS.reducedMotion,
        wordHighlight: typeof parsed.wordHighlight === "boolean" ? parsed.wordHighlight : DEFAULTS.wordHighlight,
        deliveryTypography: typeof parsed.deliveryTypography === "boolean" ? parsed.deliveryTypography : DEFAULTS.deliveryTypography,
      };
      state = next;
      listeners.forEach((l) => l(state));
      devLog(`[settings] restored ${JSON.stringify(next)}`);
    } else {
      devLog("[settings] nothing stored; defaults");
    }
  } catch (e) {
    devLog(`[settings] restore failed, defaults kept: ${String(e)}`);
  }
  return state;
}

function persist(s: ViewerPreferences): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s)).catch((e: unknown) => devLog(`[settings] save failed: ${String(e)}`));
}

export function resetToStandard(): void { setSettings({ mode: "standard" }); }

export function useSettings(): ViewerPreferences {
  const [s, setS] = useState(state);
  useEffect(() => { listeners.add(setS); return () => { listeners.delete(setS); }; }, []);
  return s;
}
