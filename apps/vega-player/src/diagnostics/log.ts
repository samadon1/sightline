/**
 * Development diagnostics. The caption runtime logs through @sightline-wip/vega-captions; this module plugs a
 * sink into it that also keeps an in-memory ring buffer for the hidden diagnostics panel (Info key).
 * The viewer UI never shows these lines. Only console.info/warn/error reach the device log.
 */

import { devLog as runtimeLog, syncLog, setLogSink } from "@sightline-wip/vega-captions";

const RING = 40;
const buffer: string[] = [];
const listeners = new Set<(lines: string[]) => void>();
let enabled = true;

setLogSink((line) => {
  if (!enabled) return;
  console.info(line);
  buffer.push(line);
  if (buffer.length > RING) buffer.shift();
  listeners.forEach((l) => l([...buffer]));
});

export function setDiagnosticsEnabled(on: boolean): void { enabled = on; }
export const devLog = runtimeLog;
export { syncLog };

export function subscribeDiagnostics(l: (lines: string[]) => void): () => void {
  listeners.add(l);
  l([...buffer]);
  return () => { listeners.delete(l); };
}
