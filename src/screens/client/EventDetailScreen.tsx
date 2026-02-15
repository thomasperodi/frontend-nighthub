import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Share, ToastAndroid, Alert, Platform, useWindowDimensions } from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import TableBookingModal from "../../components/TableBookingModal";
import { useRef, useState } from "react";
import { createReservation, fetchReservationsByEvent } from "../../services/reservations";
import { getUserPromos } from "../../services/userPromos";
import { useEffect } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchEventById } from "../../services/events";
import type { Event, EventEntryPrice, Promo } from "../../types/events";
import { useAuth } from "../../providers/AuthProvider";
import { resolveEventImageUri } from "../../utils/media";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

export default function EventDetailScreen({ route, navigation }: any) {
  const { item } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [userPromos, setUserPromos] = useState<string[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'M' | 'F' | 'ALTRO'>('ALL');
  const [previewTime, setPreviewTime] = useState<string | null>(null);
  const [isReservingEntry, setIsReservingEntry] = useState(false);
  const [isSharingStory, setIsSharingStory] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const storyCardRef = useRef<View>(null);

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

  const posterHeight = useMemo(() => {
    return Math.round(Math.min(screenHeight * 0.58, Math.max(320, screenWidth * 1.08)));
  }, [screenHeight, screenWidth]);

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
      const duplicate = String(msg).toLowerCase().includes('già una prenotazione per questa serata') ||
        String(msg).toLowerCase().includes('gia una prenotazione per questa serata');
      if (duplicate) {
        Alert.alert('Prenotazione già presente', 'Hai già una prenotazione per questa serata.');
      } else {
        Alert.alert('Errore', status ? `${msg} (${status})` : msg);
      }
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

    try {
      setIsReservingEntry(true);

      const existingReservations = await fetchReservationsByEvent(eventId);
      const existingActive = existingReservations.find((reservation) =>
        reservation.user_id === user.id &&
        reservation.status !== 'cancelled',
      );

      if (existingActive) {
        Alert.alert(
          'Prenotazione già presente',
          'Hai già una prenotazione per questa serata. Vai nelle tue prenotazioni per vedere il QR.',
          [
            {
              text: 'Apri prenotazione',
              onPress: () => navigation.navigate('ReservationDetail', { id: existingActive.id }),
            },
            { text: 'Chiudi', style: 'cancel' },
          ],
        );
        return;
      }

      const created = await createReservation({
        user_id: user.id,
        event_id: eventId,
        type: 'entry',
        guests: 1,
        status: 'confirmed',
      } as any);

      if (Platform.OS === 'android') {
        ToastAndroid.show('Prenotazione ingresso confermata. Mostra il QR al locale.', ToastAndroid.SHORT);
      } else {
        Alert.alert('Prenotazione confermata', 'Apri il biglietto e mostra il QR allo staff del locale.');
      }

      navigation.navigate('ReservationDetail', { id: created.id });
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Errore nella prenotazione';
      const duplicate =
        String(msg).toLowerCase().includes('già una prenotazione per questa serata') ||
        String(msg).toLowerCase().includes('gia una prenotazione per questa serata') ||
        String(msg).toLowerCase().includes('unique constraint') ||
        String(msg).toLowerCase().includes('reservations_unique_active_user_event_idx');

      if (duplicate) {
        Alert.alert('Prenotazione già presente', 'Hai già una prenotazione per questa serata. Vai nelle tue prenotazioni per vedere il QR.');
      } else {
        Alert.alert('Errore', status ? `${msg} (${status})` : msg);
      }
    } finally {
      setIsReservingEntry(false);
    }
  };

  const shareEvent = async () => {
    const androidStoreUrl = process.env.EXPO_PUBLIC_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.perodithomas.nighthub';
    const iosStoreUrl = process.env.EXPO_PUBLIC_APP_STORE_URL || '';
    const genericAppUrl = process.env.EXPO_PUBLIC_APP_SHARE_URL || '';
    const appUrl = genericAppUrl || (Platform.OS === 'ios' ? iosStoreUrl || androidStoreUrl : androidStoreUrl);

    const eventDeepLink = eventId ? `exp+frontend-app://event/${encodeURIComponent(eventId)}` : '';
    const posterUrl = display.image ? resolveEventImageUri(display.image) : '';

    try {
     

      await Share.share({
        title: 'NightHub',
        url: appUrl || eventDeepLink || undefined,
      });
    } catch(e) { /* ignore */ }
  };

  const shareStoryCard = async () => {
    if (isSharingStory) return;

    try {
      setIsSharingStory(true);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare || !storyCardRef.current) {
        await shareEvent();
        return;
      }

      const storyUri = await captureRef(storyCardRef, {
        format: 'jpg',
        quality: 0.96,
        result: 'tmpfile',
        width: 1080,
        height: 1920,
      });

      await Sharing.shareAsync(storyUri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Condividi la storia',
      });
    } catch {
      await shareEvent();
    } finally {
      setIsSharingStory(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }] }>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.topImageWrap}>
          {display.image ? (
              <Image
                source={{ uri: resolveEventImageUri(display.image) }}
                style={[styles.image, { backgroundColor: theme.colors.card, height: posterHeight }]}
                resizeMode="cover"
              />
          ) : (
            <View style={[styles.image, { backgroundColor: theme.colors.card, height: posterHeight }]} />
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
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
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
                      style={[styles.filterPill, { borderColor: theme.colors.border }, active && { borderColor: theme.colors.primary, backgroundColor: theme.colors.background }]}
                    >
                      <Text style={[styles.filterText, { color: active ? theme.colors.primary : theme.colors.muted }]}>
                        {g === 'ALL' ? 'Tutti' : g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setPreviewTime((t) => (t ? null : display.raw?.start_time ?? null))}
                  style={[styles.filterPill, { marginLeft: 'auto', borderColor: theme.colors.border }]}
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
          </View>

          <View style={{ height: 12 }} />
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
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
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.border,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <PrimaryButton
          title="Riserva il tuo ingresso"
          onPress={reserveEntry}
          isLoading={isReservingEntry}
          disabled={isReservingEntry}
        />

        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
            onPress={() => setBookingOpen(true)}
          >
            <Feather name="calendar" size={16} color={theme.colors.primary} />
            <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Riserva tavolo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
            onPress={shareStoryCard}
            disabled={isSharingStory}
            accessibilityLabel="Condividi evento"
            accessibilityRole="button"
          >
            <Feather name={isSharingStory ? "loader" : "share-2"} size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.storyRenderRoot} pointerEvents="none">
        <View
          ref={storyCardRef}
          collapsable={false}
          style={[styles.storyCard, { backgroundColor: theme.colors.background }]}
        >
          {display.image ? (
            <Image source={{ uri: resolveEventImageUri(display.image) }} style={styles.storyPoster} resizeMode="cover" />
          ) : (
            <View style={[styles.storyPoster, { backgroundColor: theme.colors.card }]} />
          )}

          <View style={[styles.storyOverlay, { backgroundColor: theme.colors.background, opacity: 0.25 }]} />

          <View style={[styles.storyBrandPill, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
            <Image source={require('../../../assets/icon.png')} style={styles.storyLogo} />
            <Text style={[styles.storyBrandText, { color: theme.colors.text }]}>NightHub</Text>
          </View>

          <View style={[styles.storyBottomCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 

            <View style={styles.storyBottomBrandWrap}>
              <View style={[styles.storyBottomBrandPill, { borderColor: theme.colors.primary, backgroundColor: theme.colors.background }]}> 
                <Image source={require('../../../assets/icon.png')} style={styles.storyBottomLogo} />
                <View>
                  <Text style={[styles.storyBottomBrandTitle, { color: theme.colors.text }]}>NightHub</Text>
                  <Text style={[styles.storyBottomBrandSub, { color: theme.colors.primary }]}>Scarica l'app e apri l'evento</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      <TableBookingModal visible={bookingOpen} onClose={() => setBookingOpen(false)} event={display.raw} onBooked={onBooked} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topImageWrap: { position: 'relative' },
  image: { width: "100%" },
  back: { position: 'absolute', left: 12, top: 12, padding: 8, borderRadius: 10 },
  inner: { padding: 18 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  meta: { fontSize: 13, marginBottom: 6 },
  location: { fontSize: 13 },
  sectionCard: { borderWidth: 1, borderRadius: 14, padding: 12 },
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
  useText: { fontWeight: '700' },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 8,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  iconBtn: {
    width: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRenderRoot: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  storyCard: {
    width: 1080,
    height: 1920,
    overflow: 'hidden',
    justifyContent: 'space-between',
    paddingHorizontal: 56,
    paddingVertical: 64,
  },
  storyPoster: {
    ...StyleSheet.absoluteFillObject,
  },
  storyOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  storyBrandPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  storyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  storyBrandText: {
    fontSize: 30,
    fontWeight: '900',
  },
  storyBottomCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  storyAppHeadline: {
    fontSize: 58,
    lineHeight: 64,
    fontWeight: '900',
    textAlign: 'center',
  },
  storyAppSubhead: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  storyAppLink: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  storyBottomBrandWrap: {
    alignItems: 'center',
    marginTop: 6,
  },
  storyBottomBrandPill: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  storyBottomLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  storyBottomBrandTitle: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  storyBottomBrandSub: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
});