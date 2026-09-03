/**
 * Runtime diagnostics with a pluggable sink. By default lines go to console.info (on Vega that is the
 * `[KeplerScript-JavaScript]` tag in `vega device start-log-stream`). A host app can replace the sink to
 * keep a ring buffer for an in-app panel, or silence the runtime entirely.
 */

let sink: (line: string) => void = (line) => console.info(line);

/** Replace where runtime log lines go. Pass `() => {}` to silence. */
export function setLogSink(fn: (line: string) => void): void { sink = fn; }

export function devLog(line: string): void { sink(line); }

/** Structured sync-measurement line (Measurement A): media time sampled in the native cue-change handler. */
export function syncLog(fields: { event: string; mediaMs: number; expected?: string; rendered?: string; lane?: string; mode?: string; note?: string; lead?: number }): void {
  devLog(`[sync] wall=${Date.now()} media=${Math.round(fields.mediaMs)} event=${fields.event} expected=${fields.expected ?? "-"} rendered=${fields.rendered ?? "-"} lane=${fields.lane ?? "-"} mode=${fields.mode ?? "-"}${fields.lead !== undefined ? ` lead=${fields.lead}` : ""}${fields.note ? ` note=${fields.note}` : ""}`);
}
