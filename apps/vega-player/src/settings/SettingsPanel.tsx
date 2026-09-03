/**
 * Caption settings: mode, reduced motion, and the two Detailed-only toggles (schema 0.2). "Use
 * Standard captions" returns to Standard in one press from any mode.
 * Full screen from the landing page (over the scene's blurred backdrop); in playback, a glass sheet on
 * the right so the video stays visible.
 */

import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { TVFocusGuideView } from "@amazon-devices/react-native-kepler";
import { FocusButton } from "../ui/Focusable";
import { GlassPanel, Scrim } from "../ui/Glass";
import { backdropFor } from "../media/posters";
import { MODES, MODE_DESCRIPTION, MODE_LABEL, resetToStandard, setSettings, useSettings } from "./store";
import { colors, font, px, radius, safe, space, type as typeScale } from "../theme";

export function SettingsPanel({ onClose, overlay, sceneId, ended }: { onClose: () => void; overlay?: boolean; sceneId?: string; ended?: boolean }): React.JSX.Element {
  const s = useSettings();
  // Preferred focus is a one-shot request (FL-029): after the first focus lands, no re-render may pull focus back.
  const [wantFocus, setWantFocus] = useState(true);
  const body = (
    <>
      <Text style={styles.title}>Captions</Text>
      <Text style={styles.lede}>Choose how much context you get. The approved words never change.</Text>
      <ModePreview mode={s.mode} typography={s.deliveryTypography !== false} wordHighlight={s.wordHighlight !== false} />
      <View style={styles.content}>
        <Text style={styles.group}>Mode</Text>
        <View style={styles.list}>
          {MODES.map((m, i) => (
            <FocusButton key={m} variant="row" label={MODE_LABEL[m]} hint={MODE_DESCRIPTION[m]} selected={s.mode === m} onPress={() => setSettings({ mode: m })} hasTVPreferredFocus={wantFocus && (s.mode === m || (i === 0 && !MODES.includes(s.mode)))} onFocusChange={(f) => { if (f) setWantFocus(false); }} />
          ))}
        </View>
        <Text style={styles.group}>Motion</Text>
        <View style={styles.list}>
          <FocusButton variant="row" label="Reduced motion" hint={s.reducedMotion ? "On: nothing moves while a caption shows." : "Off: in Detailed, each word lifts briefly as it is said."} selected={s.reducedMotion} onPress={() => setSettings({ reducedMotion: !s.reducedMotion })} />
        </View>
        <Text style={styles.group}>Detailed</Text>
        <View style={styles.list}>
          <FocusButton variant="row" label="Word highlighting" hint="Each word turns to the speaker's colour as it is said." selected={s.wordHighlight !== false} onPress={() => setSettings({ wordHighlight: s.wordHighlight === false })} />
          <FocusButton variant="row" label="Size and weight follow the voice" hint="Louder is larger, quieter is smaller; deeper voices heavier, higher voices lighter." selected={s.deliveryTypography !== false} onPress={() => setSettings({ deliveryTypography: s.deliveryTypography === false })} />
        </View>
      </View>
      <View style={styles.footerRow}>
        <FocusButton label="Use Standard captions" onPress={() => { resetToStandard(); onClose(); }} />
        <FocusButton label={overlay ? (ended ? "Close" : "Resume") : "Done"} onPress={onClose} />
      </View>
    </>
  );
  if (overlay) {
    return (
      <View style={styles.overlayRoot}>
        <Scrim side="left" style={{ left: undefined, right: 0, width: px(1100), transform: [{ scaleX: -1 }] }} />
        <GlassPanel strong style={styles.sheet}><TVFocusGuideView style={styles.trap} trapFocusLeft trapFocusRight trapFocusUp trapFocusDown>{body}</TVFocusGuideView></GlassPanel>
      </View>
    );
  }
  return (
    <View style={styles.root}>
      {sceneId ? <Image source={backdropFor(sceneId)} style={styles.fill} resizeMode="cover" /> : null}
      <Scrim side="left" style={{ width: px(1400) }} />
      <View style={styles.page}>{body}</View>
    </View>
  );
}

/** One sample line, drawn the way the selected mode would draw it. Static: the sample is not a real cue. Words are separate elements because nested text spans measure short on this platform. */
function ModePreview({ mode, typography, wordHighlight }: { mode: string; typography: boolean; wordHighlight: boolean }): React.JSX.Element {
  const yellow = colors.speaker["speaker-1"];
  const words: Array<{ t: string; c: string; loud?: boolean }> = mode === "standard"
    ? [{ t: "You're", c: colors.ink }, { t: "a", c: colors.ink }, { t: "jerk,", c: colors.ink }, { t: "Thom.", c: colors.ink }]
    : [{ t: "You're", c: yellow }, { t: "a", c: yellow }, { t: "jerk,", c: yellow, loud: mode === "detailed" && typography }, { t: "Thom.", c: wordHighlight ? "rgba(255,255,255,0.9)" : yellow }];
  return (
    <View style={pv.box}>
      <View style={pv.cap}>
        {mode !== "standard" ? <Text style={[pv.label, { color: yellow }]}>CELIA</Text> : null}
        <View style={pv.row}>{words.map((w, i) => <Text key={i} style={[pv.word, { color: w.c }, w.loud && pv.loud]}>{w.t}</Text>)}</View>
      </View>
      <Text style={pv.note}>{mode === "standard" ? "Drawn by the TV in your caption settings." : mode === "speaker-aware" ? (wordHighlight ? "The speaker's name and colour; each word turns to the colour as it is said. Drawn by the TV." : "The speaker's name and colour for the whole line. Drawn by the TV.") : (wordHighlight ? "Words ahead of the voice show in white and turn to the colour as they are said" : "The whole line in the speaker's colour") + (typography ? "; louder words are larger." : ".")}</Text>
    </View>
  );
}
const pv = StyleSheet.create({
  box: { borderRadius: radius.md, backgroundColor: "rgba(0,0,0,0.42)", borderWidth: 1, borderColor: colors.line, paddingVertical: px(12), paddingHorizontal: px(22), marginTop: px(4) },
  cap: { flexDirection: "column", alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.9)", paddingHorizontal: px(14), paddingVertical: px(6), borderRadius: px(4) },
  row: { flexDirection: "row", alignItems: "baseline", gap: px(10) },
  label: { fontSize: px(22), fontFamily: font.regular, letterSpacing: 1 },
  word: { fontSize: px(38), fontFamily: font.regular },
  loud: { fontSize: px(50), fontFamily: font.bold },
  note: { color: colors.inkFaint, fontSize: typeScale.micro, fontFamily: font.regular, marginTop: px(10) },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  page: { flex: 1, paddingHorizontal: safe.x, paddingVertical: safe.y, maxWidth: px(1180) },
  overlayRoot: { ...StyleSheet.absoluteFillObject, zIndex: 6 },
  trap: { flex: 1 },
  sheet: { position: "absolute", top: px(20), bottom: px(20), right: px(28), width: px(900), paddingHorizontal: space.lg, paddingVertical: space.md },
  title: { color: colors.ink, fontSize: typeScale.title, fontFamily: font.bold, letterSpacing: -0.5 },
  lede: { color: colors.inkMuted, fontSize: typeScale.small, fontFamily: font.regular, marginTop: px(2), marginBottom: px(8) },
  content: { flex: 1 },
  group: { color: colors.inkFaint, fontSize: typeScale.micro, letterSpacing: px(3), textTransform: "uppercase", fontFamily: font.bold, marginTop: px(14), marginBottom: px(6) },
  list: { gap: px(6) },
  footerRow: { flexDirection: "row", gap: space.sm, marginTop: px(12) },
});
