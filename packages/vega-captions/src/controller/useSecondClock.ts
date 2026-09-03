/**
 * Measurement B: on each animation frame, note the first frame on which the resolver's expected active
 * set changes, using the shared event-anchored media clock (FL-027), and log its distance to the cue
 * boundary. Independent of native cue events; says nothing about pixels.
 */

import { useEffect, type MutableRefObject } from "react";
import type { CaptionController } from "./CaptionController.ts";
import type { MediaClock } from "../media/MediaClock.ts";
import { devLog } from "../log.ts";

export function useSecondClock(clockRef: MutableRefObject<MediaClock | null>, controllerRef: MutableRefObject<CaptionController | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const clock = clockRef.current; const c = controllerRef.current;
    if (!clock || !c) return;
    let lastExpected = c.expectedAt(clock.now()).join(",");
    let raf = 0; let stop = false;
    const tick = () => {
      if (stop) return;
      const est = clock.now();
      const exp = c.expectedAt(est).join(",");
      if (exp !== lastExpected) {
        const ids = (exp || lastExpected).split(",").filter(Boolean);
        devLog(`[clockB] frame-change est=${est.toFixed(0)} wall=${Date.now()} from=${lastExpected || "-"} to=${exp || "-"} n=${ids.length}`);
        lastExpected = exp;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [active, clockRef, controllerRef]);
}
