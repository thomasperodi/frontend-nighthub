import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";

export default function SettingsScreen({ navigation }: any) {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerIconBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          activeOpacity={0.75}
        >
          <Feather name="chevron-left" size={18} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Impostazioni</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.primary + "22" }]}>
              <Feather name="sliders" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Preferenze app</Text>
              <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>Personalizza esperienza, accessibilita e comportamento dell'app.</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>Aspetto</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.rowIconWrap, { backgroundColor: theme.colors.primary + "22" }]}>
              <Feather name={isDark ? "moon" : "sun"} size={15} color={theme.colors.primary} />
            </View>
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

        <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>Sistema</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIconWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Feather name="bell" size={16} color={theme.colors.muted} />
            </View>
            <Text style={[styles.infoText, { color: theme.colors.text }]}>Notifiche push gestite dalle impostazioni di sistema</Text>
          </View>
          <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
          <View style={styles.infoRow}>
            <View style={[styles.infoIconWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Feather name="shield" size={16} color={theme.colors.muted} />
            </View>
            <Text style={[styles.infoText, { color: theme.colors.text }]}>Privacy e sicurezza aggiornate automaticamente</Text>
          </View>
        </View>

        <View style={styles.bottomNoteWrap}>
          <Text style={[styles.bottomNote, { color: theme.colors.muted }]}>Le impostazioni vengono salvate automaticamente su questo dispositivo.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 6,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "900" },
  headerSpacer: { width: 40, height: 40 },
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  heroTextWrap: { flex: 1 },
  heroTitle: { fontSize: 19, fontWeight: "900" },
  heroSubtitle: { marginTop: 5, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 9,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "800" },
  rowSubtitle: { marginTop: 3, fontSize: 12, fontWeight: "500" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  infoText: { flex: 1, fontSize: 13, fontWeight: "600" },
  separator: { height: 1, marginVertical: 12 },
  bottomNoteWrap: { marginTop: 2 },
  bottomNote: { fontSize: 12, lineHeight: 18, fontWeight: "500" },
});
