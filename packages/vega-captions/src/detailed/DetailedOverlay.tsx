/**
 * Detailed mode overlay. Draws the resolved active set produced by the controller from native
 * cue timing. Reads and applies the supported system CaptioningProps explicitly: size, text
 * colour, background colour and opacity, edge style. Speaker colour is applied only when the
 * viewer has left text colour at the default; the viewer's choice always wins.
 *
 * No motion: with Reduced motion on (default) nothing animates; lane changes are cuts. Word
 * highlighting (schema 0.2) is a colour change at each word's start, driven by `nowMs`; sizes and
 * weights are fixed per word from verified delivery levels, so nothing reflows while a cue shows.
 */

import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { type ResolvedCaption, type ResolvedWord, type SystemCaptionPreferences } from "@sightline-wip/core";
import { READ_AHEAD, WEIGHT_BY_PITCH, familyFor, cueWidth, syllableChunks, breaksOut, isSoundCaption, isMusicCaption, cuePitch, cueHeightPct, wordHeightPct, overflowScale, tokenLines, spokenAt, sideLaneBottom, popDurationMs } from "./layout.ts";
import { colors, px, windowSize as fallbackWindow } from "../theme.ts";
import { devLog } from "../log.ts";

// Caption with Intention 2.4.3: the work area is the lower 20% of the frame, 7.5% clear at the bottom.
const LANE_STYLE: Record<string, object> = {
  bottom_center: { left: "10%", right: "10%", bottom: "7.5%", alignItems: "center" },
  lower_left: { left: "8%", width: "42%", bottom: "12%", alignItems: "flex-start" },
  lower_right: { right: "8%", width: "42%", bottom: "12%", alignItems: "flex-end" },
};

const SIZE_SCALE: Record<string, number> = { very_small: 0.6, small: 0.8, normal: 1, large: 1.5, very_large: 2 };
const COLOR_NAMES: Record<string, string> = { white: "#FFFFFF", black: "#000000", red: "#FF3B30", green: "#34C759", blue: "#3B82F6", yellow: "#FFD60A", magenta: "#FF2D95", cyan: "#32ADE6" };
const OPACITY: Record<string, number> = { percent_0: 0, percent_25: 0.25, percent_50: 0.5, percent_75: 0.75, percent_100: 1 };
const FONT_FAMILY: Record<string, string | undefined> = { default: undefined, sans_serif: undefined, serif: "serif", casual: "sans-serif", cursive: "serif", monospace_sans: "monospace", monospace_serif: "monospace", small_capitals: undefined };

function sysColor(v: string | undefined, fallback: string): string { return v && v !== "default" ? (COLOR_NAMES[v] ?? fallback) : fallback; }
function sysOpacity(v: string | undefined, fallback: number): number { return v && OPACITY[v] !== undefined ? OPACITY[v] : fallback; }

// Caption with Intention 2.3.5/2.3.6: baseline 5% of screen height; 3% whisper, 12% yell.


/**
 * One word as its own element so it can lift and scale (Caption with Intention 2.2.3: +15% size,
 * 25% elevation as the word colours, leading the colour by a few frames). With Reduced motion on,
 * colour switches at word onset and nothing moves. Only the transition into "spoken" animates.
 */
function WordEl(props: {
  text: string; spoken: boolean; animate: boolean; color: string; readAhead: string; fontSize: number; fontWeight: "300" | "400" | "700" | "900";
  fontStyle: "normal" | "italic"; fontFamily?: string; shadow: object; trailingSpace: boolean; popMs: number;
  /** Syllable colouring (CI 2.2.2): chunks with their own start times; colour only, so nested spans are safe. */
  syllables?: Array<{ text: string; startMs: number }>; nowMs?: number;
  /** Shouted word (CI 2.4.1): drawn without the line's vertical padding so it can exceed the box. */
  breakOut?: boolean;
}): React.JSX.Element {
  const { syllables, nowMs, breakOut } = props;
  const inner = syllables && syllables.length > 1 && nowMs !== undefined
    ? syllables.map((c, k) => <Text key={k} style={{ color: c.startMs <= nowMs ? props.color : props.readAhead }}>{c.text}</Text>)
    : props.text;
  // Reduced motion (the default): a plain Text per word, no Animated values or transforms to drive.
  if (!props.animate) {
    const { spoken, color, readAhead, fontSize, fontWeight, fontStyle, fontFamily, shadow, trailingSpace } = props;
    return <Text style={[shadow, { fontSize, fontWeight, fontStyle, fontFamily, color: spoken ? color : readAhead, marginRight: trailingSpace ? fontSize * 0.28 : 0 }, breakOut ? styles.breakOut : undefined]}>{inner}</Text>;
  }
  return <AnimatedWordEl {...props} inner={inner} />;
}

function AnimatedWordEl({ text, spoken, animate, color, readAhead, fontSize, fontWeight, fontStyle, fontFamily, shadow, trailingSpace, popMs, inner, breakOut }: {
  text: string; spoken: boolean; animate: boolean; color: string; readAhead: string; fontSize: number; fontWeight: "300" | "400" | "700" | "900";
  fontStyle: "normal" | "italic"; fontFamily?: string; shadow: object; trailingSpace: boolean; popMs: number; inner?: React.ReactNode; breakOut?: boolean;
}): React.JSX.Element {
  const progress = useRef(new Animated.Value(spoken ? 1 : 0)).current; // 0 read-ahead → 1 spoken
  const pop = useRef(new Animated.Value(0)).current;                    // 1 at onset → 0 settled
  const wasSpoken = useRef(spoken);
  useEffect(() => {
    if (spoken === wasSpoken.current) return;
    wasSpoken.current = spoken;
    if (!spoken) { progress.setValue(0); pop.setValue(0); return; }
    if (!animate) { progress.setValue(1); return; }
    Animated.timing(progress, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    pop.setValue(1);
    Animated.timing(pop, { toValue: 0, duration: popMs, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [spoken, animate, progress, pop, popMs]);
  const animatedColor = progress.interpolate({ inputRange: [0, 1], outputRange: [readAhead, color] });
  const translateY = pop.interpolate({ inputRange: [0, 1], outputRange: [0, -0.25 * fontSize] });
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  return (
    <Animated.Text style={[shadow, { fontSize, fontWeight, fontStyle, fontFamily, color: animatedColor, marginRight: trailingSpace ? fontSize * 0.28 : 0, transform: [{ translateY }, { scale }] }, breakOut ? styles.breakOut : undefined]}>
      {inner ?? text}
    </Animated.Text>
  );
}

export function DetailedOverlay({ captions, system, reducedMotion, nowMs = Number.POSITIVE_INFINITY, sfxStart = new Map() }: { captions: ResolvedCaption[]; system: SystemCaptionPreferences; reducedMotion: boolean; nowMs?: number; sfxStart?: Map<string, number> }): React.JSX.Element | null {
  const [bottomHeight, setBottomHeight] = useState(0);
  const win = useWindowDimensions();
  const windowSize = { width: win.width || fallbackWindow.width, height: win.height || fallbackWindow.height };
  // Measurement R: the wall time at which a layout for `nowMs` has been committed (compare with the
  // `[wordclock] ... wall=` line that requested it to get JS render latency).
  useEffect(() => { if (Number.isFinite(nowMs) && captions.length) devLog(`[render] nowMs=${nowMs.toFixed(0)} wall=${Date.now()}`); }, [nowMs, captions.length]);
  if (!captions.length) return null;
  const scale = SIZE_SCALE[(system.textSize ?? "normal").toLowerCase()] ?? 1;
  // Size is a fraction of the screen height (CI 2.3.4), scaled by the viewer's system caption size.
  const fontSize = windowSize.height * 0.05 * scale;
  const viewerTextColor = system.textColor && system.textColor !== "default" ? sysColor(system.textColor, "#FFFFFF") : null;
  const bg = sysColor(system.textBackgroundColor, "#000000");
  const bgAlpha = sysOpacity(system.textBackgroundOpacity, 0.9); // CI 2.4.1: 90% black box
  const edge = (system.textEdgeStyle ?? "none").toLowerCase();
  // CI 2.3.1: Roboto Flex (bundled in assets/fonts) unless the viewer chose a system font family.
  const viewerFamily = FONT_FAMILY[(system.textFont ?? "default").toLowerCase()];
  const fontFamily = viewerFamily ?? "Roboto Flex";
  const smallCaps = (system.textFont ?? "").toLowerCase() === "small_capitals";
  const winBg = system.windowBackgroundColor && system.windowBackgroundColor !== "default" ? `rgba(${hexToRgb(sysColor(system.windowBackgroundColor, "#000000"))},${sysOpacity(system.windowBackgroundOpacity, 0)})` : "transparent";
  const shadow = edge === "drop_shadowed" || edge === "raised" || edge === "depressed" ? { textShadowColor: "#000", textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 2 } : edge === "uniform" ? { textShadowColor: "#000", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 } : {};

  // Stack bottom cues in reading order.
  const bottom = captions.filter((c) => c.lane === "bottom_center").sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0));
  const sides = captions.filter((c) => c.lane !== "bottom_center");
  // Side lanes always clear one bottom caption (label plus a line: 19% of the height above the CI
  // work-area margin), so a sound label appearing under a side-lane cue does not move it (Reduced
  // motion: nothing moves while a caption shows). Only a taller bottom stack, measured, lifts them further.
  const sideBottom = sideLaneBottom(windowSize.height, bottomHeight, bottom.length > 0);

  const renderCue = (c: ResolvedCaption) => {
    const speakerColor = !viewerTextColor && c.speakerToken ? colors.speaker[c.speakerToken] ?? "#FFFFFF" : (viewerTextColor ?? "#FFFFFF");
    const emph = new Map((c.staticEmphasis ?? []).map((e) => [e.tokenIndex, e.kind]));
    const wordMap = new Map<number, ResolvedWord>((c.words ?? []).map((w) => [w.i, w]));
    const isSound = isSoundCaption(c);
    const isMusic = isMusicCaption(c);
    // Size follows the loudest measured level in the cue (CI 2.3.3); sound effects size too (2.4.4);
    // music descriptors are classic captions and do not animate (2.4.5).
    const cuePct = cueHeightPct(c);
    // At most two lines (CI 2.3.7): a third authored line folds into the second; the box still clamps to 35% of the height.
    const linesRaw = tokenLines(isMusic ? c.text.replace(/^\s*\[|\]\s*$/g, "").replace(/\[|\]/g, "") : c.text);
    const lines = linesRaw.length > 2 ? [linesRaw[0], linesRaw.slice(1).flat()] : linesRaw;
    // Per-word size (CI 2.3.5) when the cue carries measured words; each line's box follows its largest word.
    const wordMapForSize = new Map<number, ResolvedWord>((c.words ?? []).map((w) => [w.i, w]));
    let idxForSize = 0;
    const linePcts = lines.map((line) => Math.max(cuePct * 0.6, ...line.map(() => { const w = wordMapForSize.get(idxForSize++); return c.words?.length && !isSoundCaption(c) ? wordHeightPct(w, cuePct) : cuePct; })));
    const clamp = overflowScale(linePcts.length ? linePcts : [cuePct]);
    const lineSize = windowSize.height * cuePct * scale * clamp;
    const wordSize = (w: ResolvedWord | undefined) => windowSize.height * (c.words?.length && !isSoundCaption(c) ? wordHeightPct(w, cuePct) : cuePct) * scale * clamp;
    const cueWeight = WEIGHT_BY_PITCH[cuePitch(c.words)];
    const cueFamily = viewerFamily ?? familyFor(cuePitch(c.words), cueWidth(c), !!c.offScreen && !isSoundCaption(c));
    const dir = c.soundDirection;
    // Tokens are indexed across line breaks exactly as the core's visibleTokens does (whitespace split).
    // Token indexes must match the core's visibleTokens(rawText): plainText is the tag-stripped, entity-decoded,
    // NFC, whitespace-collapsed text, so splitting each line on whitespace yields the same token sequence.
    let idx = 0;
    const label = c.speakerLabel && c.delivery?.manner ? `${c.speakerLabel} [${c.delivery.manner}]` : c.speakerLabel ?? (c.delivery?.manner ? `[${c.delivery.manner}]` : undefined);
    const align = c.lane === "lower_left" ? "left" : c.lane === "lower_right" ? "right" : "center";
    // Sound effects and read-ahead text are white; spoken words take the character colour (2.2.2).
    // Dialogue without timed words takes the character colour whole, as Speaker-aware does; read-ahead white
    // only makes sense when words will take colour one by one.
    const baseColor = viewerTextColor ?? (isSound ? "#FFFFFF" : c.words?.length ? READ_AHEAD : speakerColor);
    const fontStyle = c.offScreen && !isSound ? "italic" : "normal"; // 2.1.5: off-camera voices in italic
    return (
      <View key={c.cueId} style={[styles.cue, { backgroundColor: `rgba(${hexToRgb(bg)},${bgAlpha})` }]}>
        {label ? <Text style={[styles.label, shadow, { fontSize: fontSize * 0.7, color: speakerColor, fontFamily, textAlign: align }]}>{label}</Text> : null}
        {lines.map((line, li) => {
          const useWords = !!c.words?.length && !isSound;
          // Sound effects "pop" in sync with the sound (CI 2.4.4): the whole label lifts once at its onset
          // when motion is allowed. Music descriptors do not animate (2.4.5).
          if (isSound && !isMusic && !reducedMotion && c.cueId.startsWith("sfx:") && li === 0) {
            const startMs = sfxStart.get(c.cueId) ?? 0;
            const label = `${dir === "left" ? "◀\uFE0E " : ""}${lines.map((l) => l.join(" ")).join(" ")}${dir === "right" ? " ▶\uFE0E" : ""}`;
            return (
              <View key={li} style={[styles.wordRow, { justifyContent: "center" }]}>
                <WordEl text={label} spoken={nowMs >= startMs} animate color="#FFFFFF" readAhead="#FFFFFF" fontSize={lineSize} fontWeight={cueWeight} fontStyle="normal" fontFamily={fontFamily} shadow={shadow} trailingSpace={false} popMs={300} />
              </View>
            );
          }
          if (isSound && !isMusic && !reducedMotion && c.cueId.startsWith("sfx:")) return null;
          if (!useWords) {
            return (
              <Text key={li} style={[styles.text, shadow, { fontSize: lineSize, fontWeight: cueWeight, fontStyle, color: baseColor, fontFamily: cueFamily, textAlign: align, textTransform: smallCaps ? "uppercase" : "none" }]}>
                {li === 0 && isMusic ? "♫ " : ""}
                {li === 0 && dir === "left" ? "◀\uFE0E " : ""}
                {line.map((tok, ti) => {
                  const i = idx++;
                  const k = emph.get(i);
                  return <Text key={i} style={[k === "weight" ? styles.bold : undefined, k === "underline" ? styles.underline : undefined]}>{tok}{ti < line.length - 1 ? " " : ""}</Text>;
                })}
                {li === lines.length - 1 && dir === "right" ? " ▶\uFE0E" : ""}
                {li === lines.length - 1 && isMusic ? " ♫" : ""}
              </Text>
            );
          }
          // Word elements: colour at word onset, and (Reduced motion off) a lift-and-scale pop per word.
          return (
            <View key={li} style={[styles.wordRow, { justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center" }]}>
              {line.map((tok, ti) => {
                const i = idx++;
                const k = emph.get(i);
                const w = wordMap.get(i);
                const spoken = spokenAt(i, c.words, nowMs);
                const dur = popDurationMs(w);
                // With a viewer-chosen text colour the hue is theirs; the reveal survives as opacity (60% → 100%).
                const revealColor = viewerTextColor ?? speakerColor;
                const revealAhead = viewerTextColor ? `rgba(${hexToRgb(viewerTextColor)},0.6)` : READ_AHEAD;
                return (
                  <WordEl key={i} text={w ? w.display : tok} spoken={spoken} animate={!reducedMotion} color={revealColor} readAhead={revealAhead}
                    syllables={w && !viewerTextColor ? syllableChunks(w.display, w.startMs, w.endMs) : undefined} nowMs={nowMs} breakOut={breaksOut(w)}
                    fontSize={wordSize(w)} fontWeight={k === "weight" ? "900" : cueWeight} fontStyle={fontStyle} fontFamily={k === "weight" && !viewerFamily ? familyFor(-1, cueWidth(c)) : cueFamily} shadow={shadow} trailingSpace={ti < line.length - 1} popMs={dur} />
                );
              })}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {sides.map((c) => <View key={c.cueId} style={[styles.lane, LANE_STYLE[c.lane], { backgroundColor: winBg, bottom: sideBottom }]}>{renderCue(c)}</View>)}
      {bottom.length ? <View style={[styles.lane, LANE_STYLE.bottom_center, { backgroundColor: winBg }]} onLayout={(e) => { const h = e.nativeEvent.layout.height; if (Math.abs(h - bottomHeight) > 1) setBottomHeight(h); }}>{bottom.map(renderCue)}</View> : null}
    </View>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

const styles = StyleSheet.create({
  lane: { position: "absolute" },
  cue: { paddingHorizontal: px(18), paddingVertical: px(8), marginTop: px(8), borderRadius: px(4), maxWidth: "100%", overflow: "visible" },
  breakOut: { marginTop: -px(10), marginBottom: -px(10) },
  label: { fontWeight: "700", fontFamily: "Roboto Flex Bold", letterSpacing: 1, marginBottom: 2 },
  text: { fontWeight: "500", lineHeight: undefined },
  wordRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", overflow: "visible" },
  bold: { fontWeight: "900" },
  underline: { textDecorationLine: "underline" },
});
