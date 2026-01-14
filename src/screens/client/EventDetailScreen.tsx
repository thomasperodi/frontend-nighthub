import React from "react";
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Share, ToastAndroid, Alert, Platform } from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import TableBookingModal from "../../components/TableBookingModal";
import { useState } from "react";
import { createReservation } from "../../services/reservations";
import { getUserPromos } from "../../services/userPromos";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EventDetailScreen({ route, navigation }: any) {
  const { item } = route.params;
  const { theme } = useTheme();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [userPromos, setUserPromos] = useState<string[]>([]);

  useEffect(() => { (async () => { const p = await getUserPromos(); setUserPromos(p || []); })(); }, []);
  const onBooked = async (reservation: any) => {
    // apply a user promo automatically if present
    const userPromo = (item.promos || []).find((p:any) => userPromos.includes(p.id));
    if (userPromo) reservation.promoAppliedId = userPromo.id;

    await createReservation(reservation);

    // close modal (if parent still has it open) and return to home
    setBookingOpen(false);
    navigation.navigate('ClientHome');

    // show confirmation toast (Android) or alert (iOS)
    if (Platform.OS === 'android') {
      ToastAndroid.show('Prenotazione confermata', ToastAndroid.SHORT);
    } else {
      Alert.alert('Prenotazione confermata', 'La tua prenotazione è stata confermata.');
    }
  };

  const reserveEntry = async () => {
    const reservation = {
      id: `r_${Date.now()}`,
      type: 'entry',
      eventId: item.id,
      eventTitle: item.title,
      createdAt: new Date().toISOString(),
      qrToken: `QR_${Math.random().toString(36).slice(2, 10)}`,
      status: 'reserved',
      promoAppliedId: null,
    } as any;

    const userPromo = (item.promos || []).find((p:any) => userPromos.includes(p.id));
    if (userPromo) reservation.promoAppliedId = userPromo.id;

    await createReservation(reservation);
    navigation.navigate('ReservationDetail', { id: reservation.id });
  };

  const shareEvent = async () => {
    try {
      const shareText = `${item.title} - ${item.date} ${item.time} @ ${item.venue}\nScopri di più sull'app!`;
      await Share.share({ message: shareText });
    } catch(e) { /* ignore */ }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }] }>
      <ScrollView>
        <View style={styles.topImageWrap}>
          <Image source={{ uri: item.image }} style={styles.image} />
          <TouchableOpacity style={[styles.back, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Feather name="arrow-left" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.inner}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
          <Text style={[styles.meta, { color: theme.colors.muted }]}>{item.date} • {item.time}</Text>
          <Text style={[styles.location, { color: theme.colors.muted }]}>{item.venue} • {item.city}</Text>

          <View style={{ height: 12 }} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Offerte per questo evento</Text>

          {item.promos && item.promos.length ? (
            item.promos.map((p: any) => (
              <View key={p.id} style={[styles.promoRow, { borderColor: theme.colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.promoTitle, { color: theme.colors.text }]}>{p.title}</Text>
                  <Text style={[styles.promoDetails, { color: theme.colors.muted }]}>{p.details}{p.validUntil ? ` • valido fino ${p.validUntil}` : ''}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.promoDetails, { color: theme.colors.muted }]}>Nessuna promozione disponibile per questo evento.</Text>
          )}

          <View style={{ height: 16 }} />
          <PrimaryButton title="Riserva il tuo ingresso" onPress={reserveEntry} />
          <View style={{ height: 8 }} />
          <PrimaryButton title="Riserva il tuo tavolo" onPress={() => setBookingOpen(true)} />
          <View style={{ height: 8 }} />
          <TouchableOpacity style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }} onPress={shareEvent}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Condividi</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TableBookingModal visible={bookingOpen} onClose={() => setBookingOpen(false)} event={item} onBooked={onBooked} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topImageWrap: { position: 'relative' },
  image: { width: "100%", height: 260 },
  back: { position: 'absolute', left: 12, top: 12, padding: 8, borderRadius: 10 },
  inner: { padding: 18 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  meta: { fontSize: 13, marginBottom: 6 },
  location: { fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  desc: { lineHeight: 20 },
  promoRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
  promoTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  promoDetails: { fontSize: 13 },
  useBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  useText: { fontWeight: '700' }
});