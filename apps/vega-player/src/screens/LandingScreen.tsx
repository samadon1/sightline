/**
 * Landing: edge-to-edge artwork from the selected scene, the title block bottom-left, a row of glass
 * pills, and a poster rail for choosing a scene. Nothing here is a product surface beyond the demo.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { windowSize } from "../theme";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FocusManager, findNodeHandle } from "@amazon-devices/react-native-kepler";
import type { SceneMedia } from "../media/config";
import { SCENES_BUNDLED } from "../assets/scenes.generated";
import { posterFor } from "../media/posters";
import { FocusButton, useFocusScale } from "../ui/Focusable";
import { Scrim } from "../ui/Glass";
import { devLog } from "../diagnostics/log";
import { MODE_LABEL, useSettings } from "../settings/store";
import { colors, font, px, safe, space, type as typeScale } from "../theme";
import { PRODUCT_NAME } from "../productName";

type Props = {
  scene: SceneMedia;
  scenes: SceneMedia[];
  onPlay: () => void;
  /** Select on a rail card chooses the scene and starts it (UX review L1). */
  onPlayScene: (id: string) => void;
  onSettings: () => void;
  onAbout: () => void;
  onSelectScene: (id: string) => void;
};

export function LandingScreen({ scene, scenes, onPlay, onPlayScene, onSettings, onAbout, onSelectScene }: Props): React.JSX.Element {
  const settings = useSettings();
  // Initial focus: ask for it a beat after mount, so the poster rail (a scroll view) cannot claim it first.
  const [wantFocus, setWantFocus] = useState(false);
  // The rail mounts after Play has taken focus, so the scroll view can never claim the first focus (seen after returning from playback).
  // The rail mounts once Play reports focus (or after a generous fallback), so the scroll view can never take the first focus.
  const [showRail, setShowRail] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWantFocus(true), 250); const r = setTimeout(() => setShowRail(true), 2500); return () => { clearTimeout(t); clearTimeout(r); }; }, []);
  const badges = useMemo(() => sceneBadges(scene.id), [scene.id]);
  // Entrance: the title block and rail rise and fade in; the artwork drifts in very slowly. Off under Reduced motion.
  const reduced = settings.reducedMotion;
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const drift = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) { enter.setValue(1); drift.setValue(1); return; }
    enter.setValue(0); drift.setValue(1);
    Animated.timing(enter, { toValue: 1, duration: 520, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1.045, duration: 24000, useNativeDriver: true }),
      Animated.timing(drift, { toValue: 1, duration: 24000, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scene.id, reduced, enter, drift]);
  // The rail scrolls so the focused card and a margin are inside the window (UX review M1: the platform scrolls one press late).
  const railRef = useRef<ScrollView>(null);
  const keepCardInView = (i: number) => {
    const step = CARD_W + space.sm; const visible = windowSize.width - safe.x;
    const right = (i + 1) * step + px(40); const x = Math.max(0, right - visible);
    railRef.current?.scrollTo({ x, animated: !reduced });
  };
  // Explicit focus routes (the platform's spatial guess sends Down from About into the middle of the rail):
  // every pill goes Down to the current scene's card, every card goes Up to Play, Right from About stays put.
  const playRef = useRef<View>(null); const captionsRef = useRef<View>(null); const aboutRef = useRef<View>(null);
  const cardRefs = useRef<Map<string, View | null>>(new Map());
  useEffect(() => {
    if (!showRail) return;
    const t = setTimeout(() => {
      try {
        const h = (v: View | null) => (v ? findNodeHandle(v) : null);
        const play = h(playRef.current), about = h(aboutRef.current), current = h(cardRefs.current.get(scene.id) ?? null);
        for (const pill of [playRef, captionsRef, aboutRef]) { const from = h(pill.current); if (from && current) FocusManager.setNextFocus(from, current, "down"); }
        if (about) FocusManager.setNextFocus(about, about, "right");
        for (const [, card] of cardRefs.current) { const from = h(card); if (from && play) FocusManager.setNextFocus(from, play, "up"); }
      } catch (e) { devLog(`[focus] routes not applied: ${String(e)}`); }
    }, 200);
    return () => clearTimeout(t);
  }, [showRail, scene.id]);
  const rise = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [px(28), 0] }) }] };
  return (
    <View style={styles.root}>
      <Animated.Image source={posterFor(scene.id)} style={[styles.fill, { transform: [{ scale: drift }] }]} resizeMode="cover" />
      <Scrim side="left" style={{ width: px(1240) }} />
      <Scrim side="bottom" style={{ top: px(380) }} />
      <Scrim side="top" style={{ height: px(220) }} />

      <View style={styles.topBar}>
        <Text style={styles.wordmark}>{PRODUCT_NAME.toUpperCase()}</Text>
      </View>

      <Animated.View style={[styles.block, rise]}>
        <Text style={styles.kicker}>{scene.id.startsWith("tos-") ? "Real footage" : scene.id.startsWith("fixture-") || scene.id === "prototype" ? "Test scene" : "Placeholder footage"} · {scene.durationLabel}</Text>
        <Text style={styles.title} numberOfLines={2}>{scene.title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{scene.subtitle}</Text>
        <View style={styles.badges}>{badges.map((b) => <View key={b} style={styles.badge}><Text style={styles.badgeText}>{b}</Text></View>)}</View>
        <View style={styles.actions}>
          <FocusButton ref={playRef} glyph={"\u25B6\uFE0E"} label="Play" onPress={onPlay} hasTVPreferredFocus={wantFocus} onFocusChange={(f) => { if (f) setTimeout(() => setShowRail(true), 120); }} />
          <FocusButton ref={captionsRef} glyph="▤" label={`Captions · ${MODE_LABEL[settings.mode]}`} onPress={onSettings} />
          <FocusButton ref={aboutRef} label="About" onPress={onAbout} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.rail, rise]}>
        <Text style={styles.railLabel}>Scenes</Text>
        {showRail ? (
          <ScrollView ref={railRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
            {scenes.map((s, i) => <SceneCard key={s.id} ref={(v) => { cardRefs.current.set(s.id, v); }} scene={s} current={s.id === scene.id} onPress={() => { onSelectScene(s.id); onPlayScene(s.id); }} onFocused={() => keepCardInView(i)} />)}
          </ScrollView>
        ) : <View style={styles.railPlaceholder} />}
      </Animated.View>
    </View>
  );
}

/**
 * Small facts about a scene, read from its bundled companion file. Only what the data supports: no badge
 * claims a feature the scene cannot show.
 */
function sceneBadges(sceneId: string): string[] {
  const out: string[] = [];
  const bundled = SCENES_BUNDLED[sceneId];
  const comp = bundled?.companion as { sounds?: unknown[]; cues?: Record<string, { status?: string; verifiedBy?: string; speaker?: string; words?: Array<{ status?: string; verifiedBy?: string }>; delivery?: unknown }> } | null | undefined;
  // Voices named in the caption track itself (<v Name>): these show as names in every mode that labels.
  const voices = new Set(Array.from((bundled?.vtt ?? "").matchAll(/<v\s+([^>]+)>/g)).map((m) => m[1].trim().toLowerCase())).size;
  if (!comp) { out.push(voices ? "Names from the caption track only" : "Standard captions only"); return out; }
  const cues = Object.values(comp.cues ?? {});
  // "Verified" on a cue means a person looked (a rule can only propose). Word timing, measurements and sound
  // events may be machine-checked, and the badge says so.
  const human = (c: { status?: string; verifiedBy?: string }) => c.status === "verified" && !(c.verifiedBy ?? "").startsWith("auto:");
  const verifiedCues = cues.filter(human);
  if (voices) out.push(`${voices} voice${voices === 1 ? "" : "s"}`);
  // Word timing and voice measurements only play on verified cues, so they are only promised there.
  const words = verifiedCues.flatMap((c) => c.words ?? []).filter((w) => w.status === "verified");
  if (words.length) out.push(words.every((w) => (w.verifiedBy ?? "").startsWith("auto:")) ? "Word timing, auto-checked" : "Word timing");
  const deliv = verifiedCues.map((c) => c.delivery as { status?: string; verifiedBy?: string } | undefined).filter((d): d is { status?: string; verifiedBy?: string } => !!d && d.status === "verified");
  if (deliv.length) out.push(deliv.every((d) => (d.verifiedBy ?? "").startsWith("auto:")) ? "Loudness and pitch, measured" : "Loudness and pitch");
  const sounds = ((comp.sounds ?? []) as Array<{ status?: string }>).filter((e) => e.status === "verified");
  if (sounds.length) out.push("Sound labels");
  if (cues.length) out.push(verifiedCues.length === cues.length ? "All lines verified by a person" : verifiedCues.length === 0 ? "Not yet verified: names only" : `${verifiedCues.length} of ${cues.length} lines verified by a person`);
  return out;
}

const isTest = (id: string): boolean => id === "prototype" || id.startsWith("fixture-");

const SceneCard = React.forwardRef<View, { scene: SceneMedia; current: boolean; onPress: () => void; onFocused?: () => void }>(function SceneCard({ scene, current, onPress, onFocused }, ref): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const scale = useFocusScale(focused, 1.08);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable ref={ref} onPress={onPress} onFocus={() => { setFocused(true); onFocused?.(); }} onBlur={() => setFocused(false)} accessibilityRole="button" accessibilityLabel={`${scene.title}. ${scene.durationLabel}`} accessibilityState={{ selected: current }} style={[styles.card, current && styles.cardCurrent, focused && styles.cardFocused]}>
        <Image source={posterFor(scene.id)} style={styles.cardImage} resizeMode="cover" />
        <Scrim side="bottom" style={{ top: px(40) }} />
        {isTest(scene.id) ? <View style={styles.tag}><Text style={styles.tagText}>TEST</Text></View> : null}
        <Text style={[styles.cardTitle, focused && styles.cardTitleFocused]} numberOfLines={1}>{scene.title}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{scene.durationLabel}</Text>
      </Pressable>
    </Animated.View>
  );
});

const CARD_W = px(292), CARD_H = px(164);
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // Absolutely positioned images need explicit size on this platform, or they keep their intrinsic size.
  fill: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  topBar: { position: "absolute", left: safe.x, right: safe.x, top: safe.y, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  wordmark: { color: colors.inkMuted, fontSize: typeScale.small, letterSpacing: px(6), fontFamily: font.bold },
  block: { position: "absolute", left: safe.x, right: safe.x, bottom: px(296) },
  kicker: { color: colors.inkMuted, fontSize: typeScale.small, letterSpacing: px(3), textTransform: "uppercase", fontFamily: font.bold },
  title: { color: colors.ink, fontSize: typeScale.display, lineHeight: typeScale.display * 1.05, fontFamily: font.bold, marginTop: px(6), maxWidth: px(1300), letterSpacing: -1 },
  subtitle: { color: colors.inkMuted, fontSize: typeScale.body, lineHeight: typeScale.body * 1.35, fontFamily: font.regular, marginTop: px(10), maxWidth: px(1000) },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: px(8), marginTop: px(14) },
  badge: { borderRadius: px(999), borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: "rgba(0,0,0,0.28)", paddingVertical: px(5), paddingHorizontal: px(14) },
  badgeText: { color: colors.inkMuted, fontSize: typeScale.micro, fontFamily: font.bold, letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  rail: { position: "absolute", left: safe.x, right: 0, bottom: px(74) },
  railLabel: { color: colors.inkFaint, fontSize: typeScale.micro, letterSpacing: px(3), textTransform: "uppercase", fontFamily: font.bold, marginBottom: px(10) },
  railPlaceholder: { height: CARD_H + px(26) },
  railRow: { gap: space.sm, paddingRight: safe.x, paddingVertical: px(10) },
  card: { width: CARD_W, height: CARD_H, borderRadius: px(16), overflow: "hidden", borderWidth: px(3), borderColor: "transparent", backgroundColor: colors.surface, justifyContent: "flex-end", padding: px(14) },
  cardCurrent: { borderColor: "rgba(255,255,255,0.35)" },
  cardFocused: { borderColor: colors.focus },
  cardImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  tag: { position: "absolute", top: px(10), left: px(10), borderRadius: px(6), backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: px(8), paddingVertical: px(2) },
  tagText: { color: colors.ink, fontSize: px(14), letterSpacing: px(2), fontFamily: font.bold },
  cardTitle: { color: colors.ink, fontSize: typeScale.small, fontFamily: font.bold },
  cardTitleFocused: { color: colors.ink },
  cardMeta: { color: colors.inkMuted, fontSize: typeScale.micro, fontFamily: font.regular },
});
