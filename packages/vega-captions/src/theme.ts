/**
 * What the overlay needs from a theme: the Caption with Intention character palette, the 1920x1080 design
 * scale, and the bundled Roboto Flex family names. A host app can re-export these so its own theme and the
 * captions agree.
 */

import { Dimensions } from "react-native";

/** Caption with Intention Design System V1.0: six main-character colours (2.1.1), twelve supporting shades (2.1.2). */
export const SPEAKER_COLORS: Record<string, string> = {
    "speaker-1": "#E5E517", // CI Main Yellow
    "speaker-2": "#17E5E5", // CI Main Blue
    "speaker-3": "#FF3B3B", // CI Main Red is #E51717 (4.47:1 on black, 3.70:1 over the box); lightened to pass 4.5:1 (5.9:1 / 4.9:1)
    "speaker-4": "#E58017", // CI Main Orange
    "speaker-5": "#17E517", // CI Main Green
    "speaker-6": "#E517E5", // CI Main Pink
    "support-1": "#E85C2E", "support-2": "#EBC247", "support-3": "#C2EB47", "support-4": "#82ED5E",
    "support-5": "#47EB70", "support-6": "#5EEDC9", "support-7": "#47C2EB", "support-8": "#5E82ED",
    "support-9": "#8C6BED", "support-10": "#CC6BED", "support-11": "#EB47C2", "support-12": "#ED5E82",
    neutral: "#FFFFFF",
};

export const colors = { speaker: SPEAKER_COLORS };

const win = Dimensions.get("window");
/** Sizes are authored for a 1920-wide canvas and scaled by the real window at load (the virtual device reports a narrower logical window). */
export const SCALE = Math.min(win.width / 1920, win.height / 1080) || 1;
export const px = (n: number): number => Math.round(n * SCALE);
export const windowSize = { width: win.width, height: win.height };

/** Bundled Roboto Flex static instances (the platform ignores variable fonts and fontWeight; families select weight). */
export const font = { regular: "Roboto Flex", bold: "Roboto Flex Bold", light: "Roboto Flex Light" };

/** Caption with Intention 2.1.4: minor characters take a pastel from the centre of the wheel, HSB(h, 30%, 90%). */
export function minorColor(hueDeg: number): string {
  const h = ((hueDeg % 360) + 360) % 360, sat = 0.3, val = 0.9;
  const c = val * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = val - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}
