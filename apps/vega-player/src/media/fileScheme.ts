/**
 * Shaka networking plugin for `file:` URIs so the packaged HLS rendition (assets/raw, readable through
 * fetch on Vega, FL-008) can play when no LAN server answers. Registered once before the first load.
 */
import shaka from "../w3cmedia/shakaplayer/dist/shaka-player.compiled";
import { devLog } from "../diagnostics/log";

let registered = false;

export function registerFileScheme(): void {
  if (registered) return;
  registered = true;
  const engine = (shaka as any).net?.NetworkingEngine;
  const AbortableOperation = (shaka as any).util?.AbortableOperation;
  if (!engine?.registerScheme || !AbortableOperation) { devLog("[player] file scheme: Shaka API not found; packaged playback unavailable"); return; }
  // React Native's fetch rejects file: responses (status 0 → "Failed to construct 'Response'"), so the plugin
  // reads through XMLHttpRequest, which delivers the bytes with status 0 for file URIs.
  const plugin = (uri: string, request: unknown, requestType: unknown, progressUpdated?: (t: number, b: number, r: number) => void) => {
    const start = Date.now();
    const p = new Promise<{ uri: string; originalUri: string; data: ArrayBuffer; headers: Record<string, string>; fromCache: boolean }>((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", uri, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = () => {
          const ok = xhr.status === 200 || (xhr.status === 0 && xhr.response);
          if (!ok || !xhr.response) { reject(new Error(`file scheme: status ${xhr.status} for ${uri}`)); return; }
          const data = xhr.response as ArrayBuffer;
          progressUpdated?.(Date.now() - start, data.byteLength, 0);
          resolve({ uri, originalUri: uri, data, headers: {}, fromCache: false });
        };
        xhr.onerror = () => reject(new Error(`file scheme: read failed for ${uri}`));
        xhr.send();
      } catch (e) { reject(e); }
    });
    return AbortableOperation.notAbortable(p);
  };
  try {
    engine.registerScheme("file", plugin, engine.PluginPriority?.APPLICATION ?? 3, false);
    devLog("[player] file scheme registered for packaged renditions");
  } catch (e) { devLog(`[player] file scheme registration failed: ${String(e)}`); }
}
