import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";

export default function SettingsScreen({ navigation }: any) {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          activeOpacity={0.75}
        >
          <Feather name="arrow-left" size={18} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Impostazioni</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Tema scuro</Text>
            <Text style={[styles.rowSubtitle, { color: theme.colors.muted }]}>Attiva o disattiva il tema dell'app</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + "88" }}
            thumbColor={isDark ? theme.colors.primary : theme.colors.surface}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.infoRow}>
          <Feather name="bell" size={18} color={theme.colors.muted} />
          <Text style={[styles.infoText, { color: theme.colors.text }]}>Notifiche push gestite dalle impostazioni di sistema</Text>
        </View>
        <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
        <View style={styles.infoRow}>
          <Feather name="shield" size={18} color={theme.colors.muted} />
          <Text style={[styles.infoText, { color: theme.colors.text }]}>Privacy e sicurezza aggiornate automaticamente</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "900" },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "800" },
  rowSubtitle: { marginTop: 4, fontSize: 12, fontWeight: "500" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { flex: 1, fontSize: 13, fontWeight: "600" },
  separator: { height: 1, marginVertical: 12 },
});
