/**
 * Reads Vega's system caption preferences (kepler-a11y-settings-interface-turbo 1.0.0, verified on
 * the VVD) and subscribes to changes. Returns null until the first read completes.
 *
 * `requestCaptionTextSize` is a development helper: third-party apps cannot write these settings
 * (the write privilege is reserved for system apps), so on the VVD, where the Settings UI has no
 * Accessibility page, this call is expected to fail. It is logged, never shown to the viewer.
 */

import { useEffect, useState } from "react";
import type { SystemCaptionPreferences } from "@sightline-wip/core";
import { devLog } from "../log.ts";

let api: any = null;
async function getApi(): Promise<any> {
  if (api) return api;
  const mod = await import("@amazon-devices/kepler-a11y-settings-interface-turbo");
  api = (mod as any).KeplerA11ySettingsInterface ?? (mod as any).default;
  return api;
}

export function useSystemCaptionPrefs(): SystemCaptionPreferences | null {
  const [prefs, setPrefs] = useState<SystemCaptionPreferences | null>(null);
  useEffect(() => {
    let cancelled = false;
    let a: any = null;
    (async () => {
      try {
        a = await getApi();
        const apply = (p: any) => {
          if (cancelled) return;
          devLog(`[a11y] textSize=${p?.textSize} font=${p?.textFont} color=${p?.textColor} bg=${p?.textBackgroundColor}/${p?.textBackgroundOpacity} edge=${p?.textEdgeStyle}`);
          setPrefs({ ...(p ?? {}) });
        };
        apply(await a.getCaptionPreferences());
        await a.addCaptioningPreferencesListener?.(apply);
      } catch (e) {
        devLog(`[a11y] unavailable: ${String(e)}`);
        if (!cancelled) setPrefs({});
      }
    })();
    return () => { cancelled = true; try { a?.removeCaptioningPreferencesListener?.(); } catch { /* ignore */ } };
  }, []);
  return prefs;
}

export async function requestCaptionTextSize(textSize: string): Promise<boolean> {
  try {
    const a = await getApi();
    await a.setCaptionPreferences({ textSize });
    devLog(`[a11y] setCaptionPreferences(textSize=${textSize}) accepted`);
    return true;
  } catch (e) {
    devLog(`[a11y] setCaptionPreferences rejected: ${String(e)}`);
    return false;
  }
}
