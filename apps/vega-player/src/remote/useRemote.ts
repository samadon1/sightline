/**
 * Fire TV remote mapping. One place maps raw Vega TV events to app actions so screens never
 * see key names. Unrecognized events are logged in development.
 *
 * Verified key names (Vega 0.24 TVEventHandler): up, down, left, right, select, back, menu,
 * playpause, skip_backward, skip_forward, page_up, page_down, info, more.
 */

import { useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { useTVEventHandler } from "@amazon-devices/react-native-kepler";
import { devLog } from "../diagnostics/log";

export type RemoteAction =
  | "up" | "down" | "left" | "right" | "select" | "back" | "menu" | "playpause"
  | "skipBack" | "skipForward" | "info" | "pageUp" | "pageDown";

const MAP: Record<string, RemoteAction> = {
  up: "up", down: "down", left: "left", right: "right", select: "select", enter: "select", ok: "select", back: "back",
  menu: "menu", playpause: "playpause", play: "playpause", pause: "playpause", play_pause: "playpause",
  skip_backward: "skipBack", rewind: "skipBack", fast_backward: "skipBack", backward: "skipBack",
  skip_forward: "skipForward", fast_forward: "skipForward", forward: "skipForward",
  info: "info", more: "info",
  page_up: "pageUp", page_down: "pageDown", pageup: "pageUp", pagedown: "pageDown",
};

type Handler = (action: RemoteAction) => boolean | void;

/**
 * Subscribe to key-down remote actions. Return true from the handler to mark it consumed.
 *
 * Back is special: Vega exits the app on an unhandled Back, and the TV event stream cannot
 * override that. Back therefore arrives through React Native's BackHandler, and the handler's
 * return value decides whether the app keeps it (true) or lets the OS leave the app (false).
 */
export function useRemote(handler: Handler, enabled = true): void {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; }, [handler]);
  useTVEventHandler((evt: { eventType: string; eventKeyAction?: number }) => {
    if (!enabled || evt.eventKeyAction !== 0) return;
    const action = MAP[evt.eventType];
    if (!action) { devLog(`[remote] unmapped event "${evt.eventType}"`); return; }
    if (action === "back") return; // delivered via BackHandler below
    ref.current(action);
  });
  useEffect(() => {
    if (!enabled) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => ref.current("back") === true);
    return () => sub.remove();
  }, [enabled]);
}
