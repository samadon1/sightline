/**
 * Glass surfaces: translucent panels with a hairline border and a faint top sheen, in the spirit of
 * tvOS. The platform has no runtime blur, so a panel over video stays legible through its scrim, and
 * a panel over artwork sits on a pre-blurred still (see media/posters).
 */

import React from "react";
import { Image, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, px, radius } from "../theme";

const SHEEN = require("../assets/glass-sheen.png");
export const SCRIM_BOTTOM = require("../assets/scrim-bottom.png");
export const SCRIM_LEFT = require("../assets/scrim-left.png");
export const SCRIM_TOP = require("../assets/scrim-top.png");

export function GlassPanel({ children, style, strong, radiusPx }: { children?: React.ReactNode; style?: ViewStyle | ViewStyle[]; strong?: boolean; radiusPx?: number }): React.JSX.Element {
  const r = radiusPx ?? radius.lg;
  return (
    <View style={[styles.panel, { borderRadius: r, backgroundColor: strong ? "rgba(16,18,24,0.78)" : colors.surface }, style]}>
      <View pointerEvents="none" style={[styles.sheenWrap, { borderTopLeftRadius: r, borderTopRightRadius: r }]}><Image source={SHEEN} style={styles.sheen} resizeMode="stretch" /></View>
      {children}
    </View>
  );
}

/** Full-bleed gradient scrim. `side` picks the direction; the image is a 1-pixel strip stretched to the box. */
export function Scrim({ side, style }: { side: "bottom" | "left" | "top"; style?: ViewStyle }): React.JSX.Element {
  const src = side === "bottom" ? SCRIM_BOTTOM : side === "left" ? SCRIM_LEFT : SCRIM_TOP;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}><Image source={src} style={styles.fill} resizeMode="stretch" /></View>;
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: colors.glassBorder, overflow: "hidden" },
  sheenWrap: { position: "absolute", left: 0, right: 0, top: 0, height: px(120), overflow: "hidden" },
  sheen: { width: "100%", height: "100%" },
  fill: { width: "100%", height: "100%" },
});
