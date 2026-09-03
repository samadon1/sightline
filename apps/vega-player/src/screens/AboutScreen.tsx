import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { FocusButton } from "../ui/Focusable";
import { GlassPanel, Scrim } from "../ui/Glass";
import { backdropFor } from "../media/posters";
import { colors, font, px, safe, space, type as typeScale } from "../theme";
import { PRODUCT_NAME } from "../productName";

export function AboutScreen({ onBack, sceneId }: { onBack: () => void; sceneId?: string }): React.JSX.Element {
  return (
    <View style={styles.root}>
      {sceneId ? <Image source={backdropFor(sceneId)} style={styles.fill} resizeMode="cover" /> : null}
      <Scrim side="left" style={{ width: px(1400) }} />
      <View style={styles.left}>
        <Text style={styles.kicker}>About</Text>
        <Text style={styles.title}>{PRODUCT_NAME}</Text>
        <Text style={styles.lede}>A Fire TV caption runtime. It starts from an approved caption track and adds only verified context, then returns cue by cue to ordinary captions whenever an enhancement is unavailable, unsafe, unverified, or unwanted.</Text>
        <View style={styles.actions}><FocusButton label="Back" onPress={onBack} hasTVPreferredFocus /></View>
      </View>
      <GlassPanel strong style={styles.card}>
        <View style={styles.content}>
          <Section heading="Standard">The captions as approved, drawn by the TV in your caption settings. Always available.</Section>
          <Section heading="Speaker-aware">Each speaker gets a name and a colour, and each word turns to that colour as it is said, on the speaker's side of the screen when the line fits there. Drawn by the TV.</Section>
          <Section heading="Detailed">Words ahead of the voice show in white, type size follows loudness and weight follows the voice, off-camera lines are italic, sounds are labelled with their direction. Drawn by the app, in your caption size, font and colours.</Section>
          <Section heading="What it never does">It does not invent captions, guess who is speaking, read emotions, or change the approved words. A line that nobody has verified keeps the name from the caption track and plays without colour or placement.</Section>
          <Section heading="Footage">“Tears of Steel” excerpts: (CC) Blender Foundation, 2012, mango.blender.org, Creative Commons Attribution 3.0. The Envelope, Keys and Hallway are original scenes with placeholder footage until the shoot.</Section>
        </View>
      </GlassPanel>
    </View>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: safe.x, paddingVertical: safe.y, flexDirection: "row", gap: space.xl, alignItems: "stretch" },
  fill: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  left: { width: px(620), paddingTop: space.lg },
  kicker: { color: colors.inkFaint, fontSize: typeScale.micro, letterSpacing: px(3), textTransform: "uppercase", fontFamily: font.bold },
  title: { color: colors.ink, fontSize: typeScale.display, fontFamily: font.bold, letterSpacing: -1, marginTop: px(6) },
  lede: { color: colors.inkMuted, fontSize: typeScale.body, lineHeight: typeScale.body * 1.4, fontFamily: font.regular, marginTop: space.sm },
  actions: { flexDirection: "row", marginTop: space.lg },
  card: { flex: 1, paddingHorizontal: space.lg, paddingVertical: space.md },
  content: { flex: 1, justifyContent: "center" },
  section: { marginBottom: space.sm },
  heading: { color: colors.inkMuted, fontSize: typeScale.micro, letterSpacing: px(3), textTransform: "uppercase", fontFamily: font.bold, marginBottom: 6 },
  body: { color: colors.ink, fontSize: typeScale.small, lineHeight: typeScale.small * 1.45, fontFamily: font.regular },
});
