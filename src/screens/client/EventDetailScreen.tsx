import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import TableBookingModal from "../../components/TableBookingModal";
import { createReservation, fetchReservationsByEvent } from "../../services/reservations";
import { createGroupTableProposal } from "../../services/friends";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchEventById } from "../../services/events";
import type { Event, EventEntryPrice, Promo } from "../../types/events";
import { useAuth } from "../../providers/AuthProvider";
import { resolveEventImageUri } from "../../utils/media";
import { buildTrackedEventLinks } from "../../utils/deepLinks";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { confirmPaymentIntent, createPaymentSheetIntent } from "../../services/payments";
import { initStripe, LinkDisplay, useStripe } from "@stripe/stripe-react-native";

function calculateTotalAmount({
  ticketPriceCents,
  platformFeeCents,
  stripePercentage,
  stripeFixedCents,
}: {
  ticketPriceCents: number;
  platformFeeCents: number;
  stripePercentage: number;
  stripeFixedCents: number;
}) {
  return Math.ceil(
    (ticketPriceCents + platformFeeCents + stripeFixedCents) /
      (1 - stripePercentage),
  );
}

export default function EventDetailScreen({ route, navigation }: any) {
  const item = route?.params?.item ?? null;
  const routeEventId = route?.params?.id as string | undefined;
  const { theme } = useTheme();
  const { user } = useAuth();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'M' | 'F' | 'ALTRO'>('ALL');
  const [previewTime, setPreviewTime] = useState<string | null>(null);
  const [isReservingEntry, setIsReservingEntry] = useState(false);
  const [isBuyingPresale, setIsBuyingPresale] = useState(false);
  const [presaleQuantity, setPresaleQuantity] = useState(1);
  const [isSharingStory, setIsSharingStory] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const storyCardRef = useRef<View>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const backButtonTop = Math.max(insets.top, 12) + 6;

  const eventId = (item?.id as string | undefined) ?? routeEventId;

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
    const address = e?.venue?.address ?? e?.address ?? '';
    const latitude = e?.venue?.latitude ?? e?.latitude ?? null;
    const longitude = e?.venue?.longitude ?? e?.longitude ?? null;

    return {
      raw: e,
      name,
      date,
      timeRange,
      image,
      venue,
      city,
      address,
      latitude,
      longitude,
      promos: (e?.promos ?? []) as Promo[],
      entry_prices: (e?.entry_prices ?? []) as EventEntryPrice[],
      description: e?.description ?? e?.desc ?? '',
    };
  }, [event, item]);

  const posterHeight = useMemo(() => {
    return Math.round(Math.min(screenHeight * 0.56, Math.max(360, screenWidth * 1.06)));
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
      let successMessage = 'La richiesta tavolo è stata inviata. Il locale confermerà la prenotazione.';

      if (reservation?.mode === 'group-proposal') {
        const groupIds = Array.isArray(reservation?.group_ids)
          ? reservation.group_ids.map((groupId: unknown) => String(groupId)).filter(Boolean)
          : [];

        if (!reservation?.venue_id || !groupIds.length) {
          throw new Error('Dati proposta gruppo incompleti');
        }

        await Promise.all(
          groupIds.map((groupId: string) =>
            createGroupTableProposal(groupId, {
              venue_id: String(reservation.venue_id),
              guests: Number(reservation.guests),
              note: reservation.note,
            }),
          ),
        );

        successMessage =
          groupIds.length === 1
            ? 'Proposta pubblicata nel gruppo. Tutti possono seguirla e votare dalla chat gruppo o dalla tab Attivita.'
            : `Ho pubblicato ${groupIds.length} proposte nei gruppi selezionati. Trovi voti e stato nella tab Attivita.`;
      } else {
        await createReservation({
          ...reservation,
          user_id: user.id,
        });

        const inviteCount = Array.isArray(reservation?.meta?.invited_friend_ids)
          ? reservation.meta.invited_friend_ids.length
          : 0;
        successMessage =
          inviteCount > 0
            ? `Richiesta tavolo inviata. Ho avvisato ${inviteCount} ${inviteCount === 1 ? 'amico' : 'amici'}: trovano l'invito nella tab Amici.`
            : 'La richiesta tavolo è stata inviata. Il locale confermerà la prenotazione.';
      }

      // close modal (if parent still has it open) and return to home
      setBookingOpen(false);
      navigation.navigate('ClientHome');

      // show confirmation toast (Android) or alert (iOS)
      if (Platform.OS === 'android') {
        ToastAndroid.show(successMessage, ToastAndroid.SHORT);
      } else {
        Alert.alert('Richiesta inviata', successMessage);
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
    const links = eventId
      ? buildTrackedEventLinks({ eventId })
      : null;

    try {
      await Share.share({
        title: 'NightHub',
        message: links
          ? `Apri evento su NightHub:\n${links.smartUrl}\n\nLink web:\n${links.webUrl}\n\nDeep link app:\n${links.appDeepLink}`
          : 'Scopri NightHub',
        url: links?.smartUrl,
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

  const isPresaleEvent = display.raw?.access_mode === 'PRE_SALE';
  const presalePrice =
    typeof display.raw?.presale_price === 'number'
      ? display.raw.presale_price
      : Number(display.raw?.presale_price ?? 0);
  const presaleCurrency = String(display.raw?.presale_currency ?? 'eur').toUpperCase();
  const presaleCapacity =
    display.raw?.presale_capacity !== null && display.raw?.presale_capacity !== undefined
      ? Number(display.raw.presale_capacity)
      : null;
  const presaleSold = Number(display.raw?.presale_sold ?? 0);
  const ticketPriceCents = Math.round(Math.max(presalePrice, 0) * presaleQuantity * 100);
  const platformFeeCents = 0;
  const estimatedTotalCents = calculateTotalAmount({
    ticketPriceCents,
    platformFeeCents,
    stripePercentage: 0.0525,
    stripeFixedCents: 25,
  });
  const estimatedServiceFeeCents = Math.max(estimatedTotalCents - ticketPriceCents, 0);
  const ticketPriceTotal = (ticketPriceCents / 100).toFixed(2);
  const serviceFeeTotal = (estimatedServiceFeeCents / 100).toFixed(2);
  const totalAmount = (estimatedTotalCents / 100).toFixed(2);
  const availablePresale = presaleCapacity !== null ? Math.max(presaleCapacity - presaleSold, 0) : null;
  const eventTag = String(
    display.raw?.genre ??
    display.raw?.music_genre ??
    display.raw?.category ??
    'Evento',
  );
  const accessTag = isPresaleEvent ? 'Prevendita' : 'Lista';
  const heroVenue = display.venue || 'Location da confermare';
  const heroAddress = display.address
    ? `${display.address}${display.city ? ` • ${display.city}` : ''}`
    : (display.city || 'Dettagli location in arrivo');
  const venueLatitude = display.latitude !== null && display.latitude !== undefined
    ? Number(display.latitude)
    : null;
  const venueLongitude = display.longitude !== null && display.longitude !== undefined
    ? Number(display.longitude)
    : null;
  const hasVenueCoordinates =
    Number.isFinite(venueLatitude) &&
    Number.isFinite(venueLongitude);
  const hasVenueLocation = Boolean(heroVenue || display.address || display.city || hasVenueCoordinates);
  const accessIntro = isPresaleEvent
    ? 'Acquista online e ricevi subito il ticket confermato.'
    : 'Entra in lista gratis e mostra il QR direttamente all’ingresso.';
  const highlightTitle = isPresaleEvent ? 'Ingresso garantito tutta la notte' : 'Entrata smart con NightHub';
  const highlightDescription = isPresaleEvent
    ? 'Paghi in pochi tocchi e tieni il ticket sempre pronto nella tua area prenotazioni.'
    : 'Riservi il posto in lista, eviti passaggi inutili e trovi il QR già pronto da mostrare al locale.';
  const optionSectionTitle = isPresaleEvent ? 'Opzioni di accesso' : 'Dettagli lista';
  const optionSectionDescription = isPresaleEvent
    ? 'Scegli il ticket giusto e controlla le fasce disponibili prima di pagare.'
    : 'Qui trovi le eventuali condizioni della lista, come orario, target e prezzo all’ingresso.';

  const openVenueMap = async () => {
    if (!hasVenueLocation) {
      Alert.alert('Posizione non disponibile', 'La posizione del locale non e ancora disponibile per questo evento.');
      return;
    }

    const addressLabel = [display.address, display.city].filter(Boolean).join(', ') || display.venue || 'Locale evento';
    const encodedDestination = encodeURIComponent(addressLabel);
    const coordinateQuery = hasVenueCoordinates ? `${venueLatitude},${venueLongitude}` : '';
    const googleMapsAppUrl = Platform.select({
      ios: hasVenueCoordinates
        ? `comgooglemaps://?center=${coordinateQuery}&q=${coordinateQuery}`
        : `comgooglemaps://?q=${encodedDestination}`,
      android: hasVenueCoordinates
        ? `google.navigation:q=${coordinateQuery}`
        : `google.navigation:q=${encodedDestination}`,
      default: undefined,
    });
    const googleMapsWebUrl = hasVenueCoordinates
      ? `https://www.google.com/maps/search/?api=1&query=${coordinateQuery}`
      : `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`;

    try {
      if (googleMapsAppUrl) {
        const supported = await Linking.canOpenURL(googleMapsAppUrl);
        if (supported) {
          await Linking.openURL(googleMapsAppUrl);
          return;
        }
      }

      await Linking.openURL(googleMapsWebUrl);
      return;
    } catch {
      try {
        await Linking.openURL(googleMapsWebUrl);
        return;
      } catch {
        // fall through to alert below
      }
    }

    Alert.alert('Impossibile aprire la mappa', 'Non sono riuscito ad aprire Google Maps su questo dispositivo.');
  };

  const buyPresale = async () => {
    if (!user?.id) {
      Alert.alert('Accedi', 'Devi effettuare l\'accesso per acquistare la prevendita.');
      return;
    }

    if (!eventId) {
      Alert.alert('Errore', 'Evento non valido.');
      return;
    }

    try {
      setIsBuyingPresale(true);
      const intent = await createPaymentSheetIntent({
        event_id: eventId,
        quantity: presaleQuantity,
      });

      const stripeReturnScheme = 'nighthub';
      const stripeReturnUrl = `${stripeReturnScheme}://stripe-redirect`;

      await initStripe({
        publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
        urlScheme: stripeReturnScheme,
        stripeAccountId: intent.stripe_account_id,
      });

      const init = await initPaymentSheet({
        merchantDisplayName: 'NightHub',
        paymentIntentClientSecret: intent.payment_intent_client_secret,
        allowsDelayedPaymentMethods: false,
        link: { display: LinkDisplay.NEVER },
        returnURL: stripeReturnUrl,
      });

      if (init.error) {
        Alert.alert('Errore', init.error.message || 'Impossibile inizializzare il pagamento');
        return;
      }

      const result = await presentPaymentSheet();
      if (result.error) {
        Alert.alert('Pagamento annullato', result.error.message || 'Pagamento non completato');
        return;
      }

      const confirmation = await confirmPaymentIntent(intent.payment_intent_id);
      if (!confirmation.paid || !confirmation.reservation?.id) {
        Alert.alert('Pagamento in verifica', 'Pagamento ricevuto ma ticket ancora in verifica. Riprova tra qualche secondo.');
        return;
      }

      if (Platform.OS === 'android') {
        ToastAndroid.show('Ticket acquistato con successo', ToastAndroid.SHORT);
      } else {
        Alert.alert('Ticket confermato', 'La prevendita è stata confermata.');
      }

      navigation.navigate('ReservationDetail', { id: confirmation.reservation.id });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Errore pagamento ticket';
      Alert.alert('Errore', String(msg));
    } finally {
      setIsBuyingPresale(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["left", "right"]}>
      <View style={styles.heroWrap}>
        {display.image ? (
          <Image
            source={{ uri: resolveEventImageUri(display.image) }}
            style={[styles.heroImage, { backgroundColor: theme.colors.card, height: posterHeight }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: theme.colors.card, height: posterHeight }]} />
        )}
        <View style={[styles.heroShadeTop, { height: posterHeight }]} />
        <View style={[styles.heroShadeBottom, { height: posterHeight, backgroundColor: theme.colors.background }]} />
        <View style={[styles.heroAccent, { height: posterHeight, backgroundColor: theme.colors.primary }]} />
      </View>

      <View style={[styles.floatingHeader, { top: backButtonTop }]}> 
        <TouchableOpacity
          style={[styles.glassIconButton, { borderColor: 'rgba(255,255,255,0.12)' }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Torna indietro"
        >
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.glassIconButton, { borderColor: 'rgba(255,255,255,0.12)' }]}
          onPress={shareStoryCard}
          disabled={isSharingStory}
          accessibilityRole="button"
          accessibilityLabel="Condividi evento"
        >
          {isSharingStory ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="share-2" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isPresaleEvent ? 250 : 188 }}
      >
        <View style={{ height: posterHeight - 16 }} />

        <View style={styles.contentWrap}>
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.primary,
              },
            ]}
          >
            <View style={styles.heroBadgeRow}>
              <View style={[styles.heroBadgePrimary, { backgroundColor: `${theme.colors.primary}22`, borderColor: `${theme.colors.primary}55` }]}>
                <Text style={[styles.heroBadgePrimaryText, { color: theme.colors.primary }]}>{eventTag}</Text>
              </View>
              <View style={[styles.heroBadgeGhost, { borderColor: `${theme.colors.border}99` }]}>
                <Text style={[styles.heroBadgeGhostText, { color: theme.colors.text }]}>{accessTag}</Text>
              </View>
            </View>

            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>{display.name || 'Evento NightHub'}</Text>

            <View style={[styles.metaCard, { borderColor: `${theme.colors.border}B3`, backgroundColor: `${theme.colors.background}D9` }]}>
              <View style={styles.metaRow}>
                <View style={[styles.metaIconWrap, { backgroundColor: `${theme.colors.card}CC`, borderColor: `${theme.colors.border}99` }]}>
                  <Feather name="calendar" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.metaTextWrap}>
                  <Text style={[styles.metaTitle, { color: theme.colors.text }]}>{display.date || 'Data da confermare'}</Text>
                  <Text style={[styles.metaSubtitle, { color: theme.colors.muted }]}>{display.timeRange || 'Orario in aggiornamento'}</Text>
                </View>
              </View>

              <View style={[styles.metaDivider, { backgroundColor: `${theme.colors.border}80` }]} />

              <View style={styles.metaRow}>
                <View style={[styles.metaIconWrap, { backgroundColor: `${theme.colors.card}CC`, borderColor: `${theme.colors.border}99` }]}>
                  <Feather name="map-pin" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.metaTextWrap}>
                  <Text style={[styles.metaTitle, { color: theme.colors.text }]}>{heroVenue}</Text>
                  <Text style={[styles.metaSubtitle, { color: theme.colors.muted }]}>{heroAddress}</Text>
                </View>
                <TouchableOpacity
                  onPress={openVenueMap}
                  disabled={!hasVenueLocation}
                  style={[
                    styles.mapButton,
                    {
                      borderColor: `${theme.colors.primary}33`,
                      backgroundColor: hasVenueLocation ? `${theme.colors.primary}14` : `${theme.colors.background}66`,
                    },
                    !hasVenueLocation && styles.mapButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Apri posizione sulla mappa"
                >
                  <Text style={[styles.mapButtonText, { color: hasVenueLocation ? theme.colors.primary : theme.colors.muted }]}>Mappa</Text>
                  <Feather name="arrow-up-right" size={14} color={hasVenueLocation ? theme.colors.primary : theme.colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.highlightCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: `${theme.colors.primary}40`,
                shadowColor: theme.colors.primary,
              },
            ]}
          >
            <View style={[styles.highlightOrb, { backgroundColor: `${theme.colors.primary}22` }]} />
            <View style={styles.highlightContent}>
              <View style={[styles.highlightIconWrap, { backgroundColor: `${theme.colors.primary}18`, borderColor: `${theme.colors.primary}44` }]}>
                <Feather name="zap" size={22} color={theme.colors.primary} />
              </View>
              <View style={styles.highlightTextWrap}>
                <Text style={[styles.highlightTitle, { color: theme.colors.text }]}>{highlightTitle}</Text>
                <Text style={[styles.highlightDescription, { color: theme.colors.muted }]}>{highlightDescription}</Text>
              </View>
            </View>
          </View>

          {display.description ? (
            <View style={[styles.copyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.sectionEyebrow, { color: theme.colors.primary }]}>Atmosfera</Text>
              <Text style={[styles.copyText, { color: theme.colors.muted }]}>{display.description}</Text>
            </View>
          ) : null}

          <View style={[styles.sectionCardLarge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Accesso evento</Text>
            <Text style={[styles.sectionBody, { color: theme.colors.muted }]}>{accessIntro}</Text>
            {availablePresale !== null ? (
              <View style={[styles.infoStrip, { backgroundColor: `${theme.colors.background}D9`, borderColor: `${theme.colors.border}80` }]}>
                <Text style={[styles.infoStripText, { color: theme.colors.text }]}>Disponibili ora: {availablePresale} / {presaleCapacity}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.sectionCardLarge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>{optionSectionTitle}</Text>
                <Text style={[styles.sectionBody, { color: theme.colors.muted }]}>{optionSectionDescription}</Text>
              </View>
            </View>

            {isPresaleEvent && (display.entry_prices?.length ?? 0) > 0 ? (
              <>
                <View style={styles.filterRow}>
                  {(['ALL', 'M', 'F', 'ALTRO'] as const).map((g) => {
                    const active = selectedGender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        onPress={() => setSelectedGender(g)}
                        style={[
                          styles.filterPill,
                          { borderColor: `${theme.colors.border}CC`, backgroundColor: `${theme.colors.background}B3` },
                          active && { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}14` },
                        ]}
                      >
                        <Text style={[styles.filterText, { color: active ? theme.colors.primary : theme.colors.muted }]}>
                          {g === 'ALL' ? 'Tutti' : g}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    onPress={() => setPreviewTime((t) => (t ? null : display.raw?.start_time ?? null))}
                    style={[styles.filterPill, { marginLeft: 'auto', borderColor: `${theme.colors.border}CC`, backgroundColor: `${theme.colors.background}B3` }]}
                  >
                    <Text style={[styles.filterText, { color: theme.colors.muted }]}>
                      {previewTime ? `Ora ${previewTime}` : 'Anteprima oraria'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {display.entry_prices.map((r) => {
                  const ok = isApplicable(r);
                  const time = r.start_time || r.end_time ? `${r.start_time ?? '--:--'} - ${r.end_time ?? '--:--'}` : 'Valido sempre';
                  const gender = r.gender ? ` • ${r.gender}` : '';
                  const label = r.label ? `${r.label}` : 'Ingresso standard';

                  return (
                    <View
                      key={r.id}
                      style={[
                        styles.accessOption,
                        {
                          borderColor: ok ? theme.colors.primary : `${theme.colors.border}CC`,
                          backgroundColor: ok ? `${theme.colors.primary}10` : `${theme.colors.background}B3`,
                        },
                      ]}
                    >
                      <View style={styles.accessOptionLeft}>
                        <View style={[styles.accessRadioOuter, { borderColor: ok ? theme.colors.primary : theme.colors.muted }]}> 
                          {ok ? <View style={[styles.accessRadioInner, { backgroundColor: theme.colors.primary }]} /> : null}
                        </View>
                        <View style={styles.accessTextWrap}>
                          <Text style={[styles.accessTitle, { color: theme.colors.text }]}>{label}</Text>
                          <Text style={[styles.accessMeta, { color: theme.colors.muted }]}>{time}{gender}</Text>
                        </View>
                      </View>

                      <View style={styles.accessOptionRight}>
                        {ok && previewTime ? (
                          <View style={[styles.recommendedPill, { backgroundColor: `${theme.colors.primary}18`, borderColor: `${theme.colors.primary}44` }]}>
                            <Text style={[styles.recommendedText, { color: theme.colors.primary }]}>Valido per l'orario scelto</Text>
                          </View>
                        ) : null}
                        <Text style={[styles.accessPrice, { color: ok ? theme.colors.primary : theme.colors.text }]}>€ {r.price}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : !isPresaleEvent && (display.entry_prices?.length ?? 0) > 0 ? (
              <>
                {display.entry_prices.map((r) => {
                  const time = r.start_time || r.end_time ? `${r.start_time ?? '--:--'} - ${r.end_time ?? '--:--'}` : 'Valida per tutta la serata';
                  const gender = r.gender ? ` • ${r.gender}` : '';
                  const label = r.label ? `${r.label}` : 'Ingresso in lista';
                  const priceLabel = Number(r.price) > 0 ? `€ ${r.price}` : 'Gratis';

                  return (
                    <View
                      key={r.id}
                      style={[
                        styles.accessOption,
                        {
                          borderColor: `${theme.colors.border}CC`,
                          backgroundColor: `${theme.colors.background}B3`,
                        },
                      ]}
                    >
                      <View style={styles.accessOptionLeft}>
                        <View style={[styles.accessInfoDot, { backgroundColor: `${theme.colors.primary}14`, borderColor: `${theme.colors.primary}33` }]}>
                          <Feather name="check" size={14} color={theme.colors.primary} />
                        </View>
                        <View style={styles.accessTextWrap}>
                          <Text style={[styles.accessTitle, { color: theme.colors.text }]}>{label}</Text>
                          <Text style={[styles.accessMeta, { color: theme.colors.muted }]}>{time}{gender}</Text>
                        </View>
                      </View>

                      <Text style={[styles.accessPrice, { color: theme.colors.text }]}>{priceLabel}</Text>
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={[styles.accessOption, { borderColor: `${theme.colors.border}CC`, backgroundColor: `${theme.colors.background}B3` }]}>
                <View style={styles.accessOptionLeft}>
                  <View style={[styles.accessInfoDot, { backgroundColor: `${theme.colors.primary}14`, borderColor: `${theme.colors.primary}33` }]}>
                    <Feather name="check" size={14} color={theme.colors.primary} />
                  </View>
                  <View style={styles.accessTextWrap}>
                    <Text style={[styles.accessTitle, { color: theme.colors.text }]}>{isPresaleEvent ? 'Ticket standard' : 'Lista NightHub con QR'}</Text>
                    <Text style={[styles.accessMeta, { color: theme.colors.muted }]}>{isPresaleEvent ? 'Ingresso garantito con pagamento online' : 'Prenotazione gratuita, conferma immediata e QR pronto da mostrare all’ingresso'}</Text>
                  </View>
                </View>
                <Text style={[styles.accessPrice, { color: theme.colors.primary }]}>{isPresaleEvent ? `${presaleCurrency} ${presalePrice.toFixed(2)}` : 'Gratis'}</Text>
              </View>
            )}
          </View>

          {display.promos && display.promos.length > 0 ? (
            <View style={[styles.sectionCardLarge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Promozioni</Text>

              {display.promos.map((p: any) => (
                <View key={p.id} style={[styles.promoRow, { borderColor: `${theme.colors.border}CC`, backgroundColor: `${theme.colors.background}B3` }]}>
                  <View style={[styles.promoIconWrap, { backgroundColor: `${theme.colors.primary}14`, borderColor: `${theme.colors.primary}33` }]}>
                    <Feather name="gift" size={18} color={theme.colors.primary} />
                  </View>
                  <View style={styles.promoTextWrap}>
                    <Text style={[styles.promoTitle, { color: theme.colors.text }]}>{p.title}</Text>
                    <Text style={[styles.promoDetails, { color: theme.colors.muted }]}>
                      {p.description ?? p.details ?? ''}
                      {p.discount_type ? ` • ${p.discount_type}` : ''}
                      {typeof p.discount_value === 'number' ? ` ${p.discount_type === 'percentage' ? `${p.discount_value}%` : `€${p.discount_value}`}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {!bookingOpen ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: `${theme.colors.background}F2`,
              borderTopColor: `${theme.colors.border}B3`,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {isPresaleEvent ? (
            <>
              <View style={styles.qtyRow}>
                <Text style={[styles.qtyLabel, { color: theme.colors.muted }]}>Quantità ticket</Text>
                <View style={[styles.qtyControls, { borderColor: `${theme.colors.border}CC`, backgroundColor: `${theme.colors.card}F2` }]}> 
                  <TouchableOpacity
                    onPress={() => setPresaleQuantity((q) => Math.max(1, q - 1))}
                    style={styles.qtyBtn}
                  >
                    <Feather name="minus" size={16} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyValue, { color: theme.colors.text }]}>{presaleQuantity}</Text>
                  <TouchableOpacity
                    onPress={() => setPresaleQuantity((q) => Math.min(10, q + 1))}
                    style={styles.qtyBtn}
                  >
                    <Feather name="plus" size={16} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.paymentInfoCard, { borderColor: `${theme.colors.border}CC`, backgroundColor: `${theme.colors.card}F2` }]}> 
                <View style={styles.paymentInfoRow}>
                  <Text style={[styles.paymentInfoLabel, { color: theme.colors.muted }]}>Biglietti</Text>
                  <Text style={[styles.paymentInfoValue, { color: theme.colors.text }]}>{presaleCurrency} {ticketPriceTotal}</Text>
                </View>
                <View style={styles.paymentInfoRow}>
                  <Text style={[styles.paymentInfoLabel, { color: theme.colors.muted }]}>Commissione servizio</Text>
                  <Text style={[styles.paymentInfoValue, { color: theme.colors.text }]}>{presaleCurrency} {serviceFeeTotal}</Text>
                </View>
                <View style={styles.paymentInfoRow}>
                  <Text style={[styles.paymentInfoTotal, { color: theme.colors.text }]}>Totale</Text>
                  <Text style={[styles.paymentInfoTotal, { color: theme.colors.text }]}>{presaleCurrency} {totalAmount}</Text>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.footerActions}>
            <TouchableOpacity
              style={[styles.tableButton, { borderColor: `${theme.colors.border}CC`, backgroundColor: `${theme.colors.card}F2` }]}
              onPress={() => setBookingOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Richiedi tavolo"
            >
              <Feather name="calendar" size={20} color={theme.colors.muted} />
              <Text style={[styles.tableButtonText, { color: theme.colors.muted }]}>Tavolo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryCta,
                { backgroundColor: theme.colors.primary, borderColor: `${theme.colors.primary}88` },
                (isPresaleEvent ? isBuyingPresale : isReservingEntry) && styles.primaryCtaDisabled,
              ]}
              onPress={isPresaleEvent ? buyPresale : reserveEntry}
              disabled={isPresaleEvent ? isBuyingPresale : isReservingEntry}
              accessibilityRole="button"
              accessibilityLabel={isPresaleEvent ? `Paga con carta ${presaleCurrency} ${totalAmount}` : 'Riserva il tuo ingresso'}
            >
              {(isPresaleEvent ? isBuyingPresale : isReservingEntry) ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                isPresaleEvent ? (
                  <Feather name="credit-card" size={20} color={theme.colors.text} />
                ) : (
                  <MaterialCommunityIcons name="qrcode-scan" size={20} color={theme.colors.text} />
                )
              )}
              <Text style={[styles.primaryCtaText, { color: theme.colors.text }]}>
                {isPresaleEvent ? `Paga • ${presaleCurrency} ${totalAmount}` : 'Riserva il tuo ingresso'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

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
  heroWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroImage: { width: '100%' },
  heroShadeTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  heroShadeBottom: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.44,
  },
  heroAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.04,
  },
  floatingHeader: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  glassIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10,10,14,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  contentWrap: {
    paddingHorizontal: 20,
    gap: 14,
    marginTop: -36,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroBadgePrimary: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  heroBadgePrimaryText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroBadgeGhost: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroBadgeGhostText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaTextWrap: { flex: 1 },
  mapButton: {
    marginLeft: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapButtonDisabled: {
    opacity: 0.55,
  },
  mapButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  metaTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  metaSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  metaDivider: {
    height: 1,
    borderRadius: 999,
  },
  highlightCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  highlightOrb: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -45,
    top: -40,
  },
  highlightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  highlightIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTextWrap: { flex: 1, gap: 4 },
  highlightTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  highlightDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  copyCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  copyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  sectionCardLarge: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  infoStrip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoStripText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '800',
  },
  accessOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  accessOptionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accessRadioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  accessInfoDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessTextWrap: { flex: 1, gap: 3 },
  accessTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  accessMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  accessOptionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  recommendedPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  accessPrice: {
    fontSize: 18,
    fontWeight: '900',
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  promoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTextWrap: { flex: 1, gap: 4 },
  promoTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  promoDetails: {
    fontSize: 13,
    lineHeight: 19,
  },
  emptyPromoCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 10,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  qtyControls: {
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
  },
  paymentInfoCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  paymentInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  paymentInfoValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  paymentInfoTotal: {
    fontSize: 15,
    fontWeight: '900',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  tableButton: {
    width: 72,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tableButtonText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  primaryCta: {
    flex: 1,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  primaryCtaDisabled: {
    opacity: 0.72,
  },
  primaryCtaText: {
    fontSize: 17,
    fontWeight: '800',
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