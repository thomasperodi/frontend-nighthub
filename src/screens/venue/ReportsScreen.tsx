import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

export default function ReportsScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Report</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Incasso mensile</Text>
        <Text style={styles.value}>€18.450</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Ingressi totali</Text>
        <Text style={styles.value}>1.240</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 20 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  label: { color: "#CFC6FF" },
  value: { color: "white", fontSize: 20, fontWeight: "800", marginTop: 6 },
});
