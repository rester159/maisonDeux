import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useState, type ReactNode } from "react";

function ScreenShell({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

export function SavedSearchesScreen() {
  return <ScreenShell title="Saved Searches" />;
}

export function SearchHistoryScreen() {
  return <ScreenShell title="Search History (last 50)" />;
}

export function PriceAlertSetupScreen() {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState("5000");
  return (
    <ScreenShell title="Price Alert Setup">
      <TextInput
        value={threshold}
        onChangeText={setThreshold}
        keyboardType="number-pad"
        style={styles.input}
        placeholder="Threshold in USD"
      />
      <View style={styles.row}>
        <Text>Enable alert</Text>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>
    </ScreenShell>
  );
}

export function ProfileScreen() {
  return (
    <ScreenShell title="Profile">
      <Text>Subscription tier: Free</Text>
      <Text>Pro unlocks unlimited alerts and history.</Text>
    </ScreenShell>
  );
}

export function OnboardingScreen() {
  return (
    <ScreenShell title="Welcome to LuxeFinder">
      <Text>1) Upload one photo.</Text>
      <Text>2) We search every marketplace in parallel.</Text>
      <Text>3) Compare verified listings in one place.</Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }
});
