import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          activeOpacity={0.75}
        >
          <Feather name="arrow-left" size={18} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Aiuto e supporto</Text>
      </View>

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

      <TouchableOpacity
        style={[styles.contactButton, { borderColor: theme.colors.primary + "44", backgroundColor: theme.colors.primary + "11" }]}
        onPress={openEmail}
        activeOpacity={0.8}
      >
        <Feather name="mail" size={18} color={theme.colors.primary} />
        <Text style={[styles.contactText, { color: theme.colors.primary }]}>Contatta supporto via email</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "900" },
  listWrap: { gap: 10 },
  faqCard: {
    borderWidth: 1,
    borderRadius: 14,
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
  faqTitle: { fontSize: 14, fontWeight: "800" },
  faqDescription: { fontSize: 12, fontWeight: "500", marginTop: 4, lineHeight: 18 },
  contactButton: {
    marginTop: 18,
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
