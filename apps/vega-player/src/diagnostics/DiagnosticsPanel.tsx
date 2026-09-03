/** Hidden developer panel (Info key). Never part of the viewer flow or release captures. */
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { subscribeDiagnostics } from "./log";

export function DiagnosticsPanel({ header }: { header: string }): React.JSX.Element {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => subscribeDiagnostics(setLines), []);
  return (
    <View style={styles.root} pointerEvents="none">
      <Text style={styles.head}>{header}</Text>
      {lines.slice(-18).map((l, i) => <Text key={i} style={styles.line}>{l}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 12, left: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", padding: 10, borderRadius: 6 },
  head: { color: "#fff", fontSize: 18, marginBottom: 4 },
  line: { color: "rgba(180,255,180,0.9)", fontSize: 13, fontFamily: "monospace" },
});
