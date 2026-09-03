/**
 * TV-distance design tokens. Sizes are in dp on a 1920x1080 canvas (React Native for Vega
 * reports the TV as 1920 wide). Everything must be legible from about three metres.
 *
 * Look: near-black ground, edge-to-edge artwork, white type on translucent "glass" panels with a
 * hairline border. Focus is the tvOS gesture: the focused control turns near-white with dark text
 * and grows slightly. The platform has no live blur, so backdrops are pre-blurred stills.
 */

export const colors = {
  bg: "#050608",
  surface: "rgba(255,255,255,0.08)",
  surfaceRaised: "rgba(255,255,255,0.14)",
  ink: "#FFFFFF",
  inkMuted: "rgba(255,255,255,0.66)",
  inkFaint: "rgba(255,255,255,0.42)",
  // Focus: near-white glass with dark text (tvOS). Still passes 4.5:1 either way.
  focus: "rgba(255,255,255,0.94)",
  focusInk: "#0B0D12",
  line: "rgba(255,255,255,0.14)",
  glassBorder: "rgba(255,255,255,0.20)",
  scrim: "rgba(5,6,8,0.62)",
  danger: "#FF6B6B",
  ok: "#7BD88F",
  // Caption with Intention palette: owned by @sightline-wip/vega-captions so the app and the captions agree.
  speaker: SPEAKER_COLORS,
};

import { Dimensions } from "react-native";
import { SPEAKER_COLORS, minorColor } from "@sightline-wip/vega-captions";
export { minorColor };

/**
 * The Vega Virtual Device reports a logical window narrower than 1920 (density scaling), so all
 * sizes are authored for a 1920-wide canvas and scaled by the real window width at load.
 */
const win = Dimensions.get("window");
export const SCALE = Math.min(win.width / 1920, win.height / 1080) || 1;
export const px = (n: number): number => Math.round(n * SCALE);
export const windowSize = { width: win.width, height: win.height };

/** Bundled Roboto Flex static instances (FL-024). The UI uses three; the caption overlay uses all nine. */
export const font = { regular: "Roboto Flex", bold: "Roboto Flex Bold", light: "Roboto Flex Light" };

export const type = {
  display: px(84),
  title: px(48),
  heading: px(36),
  body: px(28),
  small: px(22),
  micro: px(18),
  caption: px(60), // Detailed overlay base size at CaptionTextSize "normal" (native line is about 9.5% of height)
};

export const space = { xs: px(8), sm: px(16), md: px(24), lg: px(40), xl: px(64) };

export const radius = { sm: px(10), md: px(18), lg: px(28), pill: px(999) };

/** Title-safe margins (5%). */
export const safe = { x: px(96), y: px(54) };

export const focusRing = {
  borderWidth: px(3),
  borderColor: colors.focus,
};
