/**
 * Last line of defence for the viewer: a render error inside the player shows a plain message and a way
 * back instead of taking the whole app down to the launcher (which is what an uncaught error does on Vega).
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { FocusButton } from "./Focusable";
import { colors, px, safe, space, type as typeScale } from "../theme";
import { devLog } from "../diagnostics/log";

type Props = { children: React.ReactNode; onReset: () => void; label?: string };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    devLog(`[crash] ${this.props.label ?? "screen"}: ${String(error)} ${info.componentStack?.split("\n").slice(0, 3).join(" | ") ?? ""}`);
  }
  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong with the captions display</Text>
        <Text style={styles.body}>The player stopped to keep the app running. Captions are back to Standard; the rest of the demo still works.</Text>
        <View style={styles.row}>
          <FocusButton label="Back to Standard captions" onPress={() => { this.setState({ error: null }); this.props.onReset(); }} hasTVPreferredFocus />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: safe.x, paddingVertical: safe.y, justifyContent: "center" },
  title: { color: colors.ink, fontSize: typeScale.heading, fontWeight: "800", marginBottom: space.sm },
  body: { color: colors.inkMuted, fontSize: typeScale.body, maxWidth: px(1200), marginBottom: space.md },
  row: { flexDirection: "row" },
});
