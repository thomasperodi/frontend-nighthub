import React, { useMemo } from "react";
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
import { fetchEventById } from "../../services/events";
import type { Event, EventEntryPrice, Promo } from "../../types/events";
import { useAuth } from "../../providers/AuthProvider";
import { resolveEventImageUri } from "../../utils/media";

export default function EventDetailScreen({ route, navigation }: any) {
  const { item } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [userPromos, setUserPromos] = useState<string[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'M' | 'F' | 'ALTRO'>('ALL');
  const [previewTime, setPreviewTime] = useState<string | null>(null);

  const eventId = item?.id as string | undefined;

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const e = await fetchEventById(eventId);
        if (e) setEvent(e);
      } catch {
        // ignore; fallback to route item
      }
    })();
  }, [eventId]);

  useEffect(() => { (async () => { const p = await getUserPromos(); setUserPromos(p || []); })(); }, []);

  const display = useMemo(() => {
    const e: any = event ?? item;
    const name = e?.name ?? e?.title ?? '';
    const date = e?.date ?? '';
    const start = e?.start_time ?? e?.time ?? '';
    const end = e?.end_time ?? '';
    const timeRange = start && end ? `${start} - ${end}` : start || end || '';
    const image = e?.image ?? null;
    const venue = e?.venue?.name ?? e?.venue ?? '';
    const city = e?.venue?.city ?? e?.city ?? '';

    return {
      raw: e,
      name,
      date,
      timeRange,
      image,
      venue,
      city,
      promos: (e?.promos ?? []) as Promo[],
      entry_prices: (e?.entry_prices ?? []) as EventEntryPrice[],
      description: e?.description ?? e?.desc ?? '',
    };
  }, [event, item]);

  const parseMinutes = (t?: string | null) => {
    if (!t) return null;
    const m = /^([01]\d|2[0-3]):([0-5]\d)/.exec(t);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  const isApplicable = (r: EventEntryPrice) => {
    const gOk = !r.gender || selectedGender === 'ALL' || r.gender === selectedGender;
    if (!gOk) return false;

    const t = parseMinutes(previewTime);
    if (t === null) return true;

    const s = parseMinutes(r.start_time ?? null);
    const e = parseMinutes(r.end_time ?? null);
    if (s === null && e === null) return true;
    if (s !== null && e === null) return t >= s;
    if (s === null && e !== null) return t <= e;
    if (s === null || e === null) return true;

    // Handle ranges that wrap after midnight
    if (s <= e) return t >= s && t <= e;
    return t >= s || t <= e;
  };
  const onBooked = async (reservation: any) => {
    if (!user?.id) {
      Alert.alert('Accedi', 'Devi effettuare l\'accesso per prenotare.');
      throw new Error('Not authenticated');
    }

    // NOTE: backend reservations schema does not currently store promos; keep UI-only logic out of payload.

    try {
      await createReservation({
        ...reservation,
        user_id: user.id,
      });

      // close modal (if parent still has it open) and return to home
      setBookingOpen(false);
      navigation.navigate('ClientHome');

      // show confirmation toast (Android) or alert (iOS)
      if (Platform.OS === 'android') {
        ToastAndroid.show('Prenotazione confermata', ToastAndroid.SHORT);
      } else {
        Alert.alert('Prenotazione confermata', 'La tua prenotazione è stata confermata.');
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Errore nella prenotazione';
      Alert.alert('Errore', status ? `${msg} (${status})` : msg);
      throw e;
    }
  };

  const reserveEntry = async () => {
    if (!user?.id) {
      Alert.alert('Accedi', 'Devi effettuare l\'accesso per prenotare.');
      return;
    }

    if (!eventId) {
      Alert.alert('Errore', 'Evento non valido.');
      return;
    }

    const created = await createReservation({
      user_id: user.id,
      event_id: eventId,
      type: 'entry',
      guests: 1,
      status: 'confirmed',
    } as any);

    navigation.navigate('ReservationDetail', { id: created.id });
  };

  const shareEvent = async () => {
    try {
      const shareText = `${display.name} - ${display.date} ${display.timeRange} @ ${display.venue}\nScopri di più sull'app!`;
      await Share.share({ message: shareText });
    } catch(e) { /* ignore */ }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }] }>
      <ScrollView>
        <View style={styles.topImageWrap}>
          {display.image ? (
              <Image source={{ uri: resolveEventImageUri(display.image) }} style={styles.image} />
          ) : (
            <View style={[styles.image, { backgroundColor: theme.colors.card }]} />
          )}
          <TouchableOpacity style={[styles.back, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Feather name="arrow-left" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.inner}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{display.name}</Text>
          <Text style={[styles.meta, { color: theme.colors.muted }]}>{display.date}{display.timeRange ? ` • ${display.timeRange}` : ''}</Text>
          <Text style={[styles.location, { color: theme.colors.muted }]}>{display.venue}{display.city ? ` • ${display.city}` : ''}</Text>

          {display.description ? (
            <>
              <View style={{ height: 10 }} />
              <Text style={[styles.desc, { color: theme.colors.muted }]}>{display.description}</Text>
            </>
          ) : null}

          <View style={{ height: 16 }} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Prezzi ingresso</Text>

          {(display.entry_prices?.length ?? 0) > 0 ? (
            <>
              <View style={styles.filterRow}>
                {(['ALL', 'M', 'F', 'ALTRO'] as const).map((g) => {
                  const active = selectedGender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setSelectedGender(g)}
                      style={[styles.filterPill, active && { borderColor: theme.colors.primary }]}
                    >
                      <Text style={[styles.filterText, { color: active ? theme.colors.primary : theme.colors.muted }]}>
                        {g === 'ALL' ? 'Tutti' : g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setPreviewTime((t) => (t ? null : display.raw?.start_time ?? null))}
                  style={[styles.filterPill, { marginLeft: 'auto' }]}
                >
                  <Text style={[styles.filterText, { color: theme.colors.muted }]}>
                    {previewTime ? `Ora: ${previewTime}` : 'Mostra per ora'}
                  </Text>
                </TouchableOpacity>
              </View>

              {display.entry_prices.map((r) => {
                const ok = isApplicable(r);
                const time = r.start_time || r.end_time ? `${r.start_time ?? '--:--'} - ${r.end_time ?? '--:--'}` : 'Sempre';
                const gender = r.gender ? ` • ${r.gender}` : '';
                const label = r.label ? `${r.label}` : 'Ingresso';
                return (
                  <View
                    key={r.id}
                    style={[styles.priceRow, { borderColor: ok ? theme.colors.primary : theme.colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.priceTitle, { color: theme.colors.text }]}>{label}</Text>
                      <Text style={[styles.priceMeta, { color: theme.colors.muted }]}>{time}{gender}</Text>
                    </View>
                    <Text style={[styles.priceValue, { color: ok ? theme.colors.primary : theme.colors.text }]}>€ {r.price}</Text>
                  </View>
                );
              })}
            </>
          ) : (
            <Text style={[styles.promoDetails, { color: theme.colors.muted }]}>Prezzi non disponibili.</Text>
          )}

          <View style={{ height: 12 }} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Offerte per questo evento</Text>

          {display.promos && display.promos.length ? (
            display.promos.map((p: any) => (
              <View key={p.id} style={[styles.promoRow, { borderColor: theme.colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.promoTitle, { color: theme.colors.text }]}>{p.title}</Text>
                  <Text style={[styles.promoDetails, { color: theme.colors.muted }]}> 
                    {p.description ?? p.details ?? ''}
                    {p.discount_type ? ` • ${p.discount_type}` : ''}
                    {typeof p.discount_value === 'number' ? ` ${p.discount_type === 'percentage' ? `${p.discount_value}%` : `€${p.discount_value}`}` : ''}
                  </Text>
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

      <TableBookingModal visible={bookingOpen} onClose={() => setBookingOpen(false)} event={display.raw} onBooked={onBooked} />
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
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  filterPill: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
  priceTitle: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  priceMeta: { fontSize: 12 },
  priceValue: { fontSize: 14, fontWeight: '900' },
  promoRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
  promoTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  promoDetails: { fontSize: 13 },
  useBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  useText: { fontWeight: '700' }
});