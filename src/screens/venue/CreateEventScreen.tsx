import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

export default function CreateEventScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Nuovo Evento</Text>

      <TextInput placeholder="Nome evento" style={styles.input} />
      <TextInput placeholder="Data" style={styles.input} />
      <TextInput placeholder="Orario" style={styles.input} />

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Crea evento</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 20 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
    color: "white",
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#6D5BFF",
    padding: 16,
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "800" },
});
