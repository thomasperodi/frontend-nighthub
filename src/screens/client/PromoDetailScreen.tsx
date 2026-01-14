import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { getUserPromos, addUserPromo } from "../../services/userPromos";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PromoDetailScreen({ route, navigation }: any) {
  const { promo } = route.params;
  const { theme } = useTheme();
  const [isForYou, setIsForYou] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getUserPromos();
      setIsForYou(p.includes(promo.id));
    })();
  }, [promo.id]);
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView>
        <View style={styles.topImageWrap}>
          <Image source={{ uri: promo.image }} style={styles.image} />
          <TouchableOpacity style={[styles.back, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Feather name="arrow-left" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.inner}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{promo.title}</Text>
          {isForYou && (
            <View style={{ marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, alignSelf: 'flex-start', backgroundColor: theme.colors.primary }}>
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Offerta riservata a te</Text>
            </View>
          )}
          <Text style={[styles.meta, { color: theme.colors.muted, marginTop: 8 }]}>{promo.discount} • fino al {promo.until}</Text>

          <View style={{ height: 12 }} />
          <Text style={[styles.section, { color: theme.colors.text }]}>Dettagli</Text>
          <Text style={[styles.desc, { color: theme.colors.muted }]}>{promo.details}</Text>

          <View style={{ height: 16 }} />

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}
            onPress={() => navigation.navigate('ClientHome', { promoFilter: promo.id })}
            accessibilityRole="button"
          >
            <Text style={[styles.actionText, { color: theme.colors.primary }]}>Vedi eventi correlati</Text>
          </TouchableOpacity>

          <View style={{ height: 8 }} />

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isForYou ? theme.colors.card : theme.colors.primary }]}
            onPress={async () => {
              if (!isForYou) {
                await addUserPromo(promo.id);
                setIsForYou(true);
              }
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.actionText, { color: isForYou ? theme.colors.text : theme.colors.text }]}>{isForYou ? 'Promozione già tua' : 'Aggiungi alle mie offerte'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topImageWrap: { position: 'relative' },
  image: { width: '100%', height: 220 },
  back: { position: 'absolute', left: 12, top: 12, padding: 8, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  inner: { padding: 18 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  meta: { fontSize: 13, marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  desc: { lineHeight: 20 },
  actionButton: { paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontWeight: '700' }
});