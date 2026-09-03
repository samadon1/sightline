/**
 * Word clock for Detailed mode (schema 0.2): samples the shared media clock on animation frames and hands
 * the estimate to the controller, which re-lays out the overlay only at a cue, word or sound-event
 * boundary. The clock itself anchors on fresh media events (FL-027). Inactive while paused.
 */

import { useEffect, type MutableRefObject } from "react";
import type { CaptionController } from "./CaptionController.ts";
import type { MediaClock } from "../media/MediaClock.ts";
import { devLog } from "../log.ts";

export function useWordClock(clockRef: MutableRefObject<MediaClock | null>, controllerRef: MutableRefObject<CaptionController | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const clock = clockRef.current; const c = controllerRef.current;
    if (!clock || !c) return;
    let raf = 0; let stop = false; let frames = 0;
    const tick = () => {
      if (stop) return;
      frames++;
      const est = clock.now();
      try { c.tickAt(est); } catch (e) { devLog(`[wordclock] tick failed ${String(e)}`); }
      if (frames % 600 === 0) { const d = clock.driftStats(); devLog(`[wordclock] anchor drift mean=${d.mean.toFixed(0)} max=${d.max.toFixed(0)} n=${d.n}`); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [active, clockRef, controllerRef]);
}
