/**
 * TV focus primitives. Every interactive control uses `FocusButton`, so focus looks the same
 * everywhere: the focused control turns near-white with dark text and grows a little (tvOS), which
 * reads from across a room and does not depend on colour. Reduced motion skips the growth.
 *
 * Variants: "pill" for actions (a row of glass pills), "row" for options in a list (with a check
 * mark when selected), "card" for artwork tiles (the caller draws the content).
 */

import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, font, px, radius, space, type as typeScale } from "../theme";
import { useSettings } from "../settings/store";

export type FocusButtonProps = {
  label: string;
  hint?: string;
  /** A short glyph drawn before the label (a unicode symbol; no icon font on the platform). */
  glyph?: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  selected?: boolean;
  variant?: "pill" | "row";
  style?: ViewStyle;
  testID?: string;
  /** Called when focus arrives or leaves; the landing page uses it to sequence what mounts after Play has focus. */
  onFocusChange?: (focused: boolean) => void;
};

export function useFocusScale(focused: boolean, amount = 1.06): Animated.Value {
  const reduced = useSettings().reducedMotion;
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) { v.setValue(focused ? amount : 1); return; }
    Animated.timing(v, { toValue: focused ? amount : 1, duration: 160, useNativeDriver: true }).start();
  }, [focused, reduced, amount, v]);
  return v;
}

export const FocusButton = React.forwardRef<View, FocusButtonProps>(function FocusButton({ label, hint, glyph, onPress, hasTVPreferredFocus, selected, variant = "pill", style, testID, onFocusChange }, ref): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const scale = useFocusScale(focused, variant === "pill" ? 1.06 : 1.02);
  const isRow = variant === "row";
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        ref={ref}
        onPress={onPress}
        onFocus={() => { setFocused(true); onFocusChange?.(true); }}
        onBlur={() => { setFocused(false); onFocusChange?.(false); }}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityRole="button"
        accessibilityLabel={hint ? `${label}. ${hint}` : label}
        accessibilityState={{ selected: !!selected }}
        testID={testID}
        style={[isRow ? styles.row : styles.pill, selected && !focused && styles.selected, focused && styles.focused, style]}
      >
        {glyph ? <Text style={[styles.glyph, focused && styles.inkFocused]}>{glyph}</Text> : null}
        <View style={styles.col}>
          <Text style={[isRow ? styles.rowLabel : styles.pillLabel, focused && styles.inkFocused]} numberOfLines={1}>{label}</Text>
          {hint && isRow ? <Text style={[styles.hint, focused && styles.hintFocused]} numberOfLines={1}>{hint}</Text> : null}
        </View>
        {selected !== undefined && isRow ? <Text style={[styles.check, focused && styles.inkFocused, !selected && styles.checkOff]}>{selected ? "✓" : ""}</Text> : null}
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: px(16), paddingHorizontal: px(34), borderWidth: 1, borderColor: colors.glassBorder, minHeight: px(72) },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: px(10), paddingHorizontal: px(24), borderWidth: 1, borderColor: colors.glassBorder, minHeight: px(66) },
  selected: { backgroundColor: colors.surfaceRaised, borderColor: "rgba(255,255,255,0.34)" },
  focused: { backgroundColor: colors.focus, borderColor: colors.focus },
  col: { flexShrink: 1, flexGrow: 1 },
  glyph: { color: colors.ink, fontSize: typeScale.body, marginRight: px(14), fontFamily: font.regular },
  pillLabel: { color: colors.ink, fontSize: typeScale.body, fontFamily: font.bold },
  rowLabel: { color: colors.ink, fontSize: typeScale.body, fontFamily: font.bold },
  inkFocused: { color: colors.focusInk },
  hint: { color: colors.inkMuted, fontSize: typeScale.small, marginTop: 2, fontFamily: font.regular },
  hintFocused: { color: "rgba(11,13,18,0.72)" },
  check: { color: colors.ink, fontSize: typeScale.body, marginLeft: space.sm, width: px(34), textAlign: "center", fontFamily: font.bold },
  checkOff: { opacity: 0 },
});
