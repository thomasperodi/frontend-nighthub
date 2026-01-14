import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

export default function StaffScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Staff</Text>

      <View style={styles.card}>
        <Text style={styles.name}>Marco</Text>
        <Text style={styles.role}>Bar</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.name}>Giulia</Text>
        <Text style={styles.role}>Ingresso</Text>
      </View>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Aggiungi staff</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 20 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  name: { color: "white", fontWeight: "700" },
  role: { color: "#CFC6FF", marginTop: 4 },
  button: {
    backgroundColor: "#6D5BFF",
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "800" },
});
