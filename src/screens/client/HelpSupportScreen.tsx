import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";

const FAQ_ITEMS = [
  {
    icon: "ticket" as const,
    title: "Dove trovo il mio QR?",
    description: "Apri Le mie prenotazioni e seleziona l'evento per mostrare il QR.",
  },
  {
    icon: "clock" as const,
    title: "Posso annullare una prenotazione?",
    description: "Le prenotazioni tavolo attive possono essere annullate dalla schermata dettaglio.",
  },
  {
    icon: "credit-card" as const,
    title: "Come funzionano i pagamenti?",
    description: "I pagamenti vengono confermati solo dopo esito positivo del provider sicuro.",
  },
];

export default function HelpSupportScreen({ navigation }: any) {
  const { theme } = useTheme();

  const openEmail = async () => {
    const url = "mailto:perodithomas88@gmail.com?subject=Supporto%20NightApp";
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
  };

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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Aiuto e supporto</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.primary + "22" }]}>
              <Feather name="life-buoy" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Siamo qui per aiutarti</Text>
              <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>Trovi le risposte rapide qui sotto oppure puoi scriverci in qualsiasi momento.</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.contactButton, { borderColor: theme.colors.primary + "44", backgroundColor: theme.colors.primary + "11" }]}
            onPress={openEmail}
            activeOpacity={0.8}
          >
            <Feather name="mail" size={18} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.primary }]}>Contatta supporto via email</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>FAQ</Text>
        <View style={styles.listWrap}>
          {FAQ_ITEMS.map((item) => (
            <View key={item.title} style={[styles.faqCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + "22" }]}>
                <Feather name={item.icon} size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.faqTextWrap}>
                <Text style={[styles.faqTitle, { color: theme.colors.text }]}>{item.title}</Text>
                <Text style={[styles.faqDescription, { color: theme.colors.muted }]}>{item.description}</Text>
              </View>
            </View>
          ))}
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
  content: { paddingHorizontal: 18, paddingBottom: 30 },
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
    marginTop: 1,
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
  listWrap: { gap: 10 },
  faqCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  faqTextWrap: { flex: 1 },
  faqTitle: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  faqDescription: { fontSize: 12, fontWeight: "500", marginTop: 4, lineHeight: 18 },
  contactButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  contactText: { fontSize: 14, fontWeight: "800" },
});
