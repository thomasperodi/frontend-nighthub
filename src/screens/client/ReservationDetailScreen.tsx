import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ScrollView, Alert, Platform, ToastAndroid, Linking } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { getReservation, cancelReservation } from "../../services/reservations";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

export default function ReservationDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { theme } = useTheme();
  const [res, setRes] = useState<any>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const load = async () => {
    const r = await getReservation(id);
    setRes(r);
  };

  useEffect(() => { load(); }, [id]);

  if (!res) return null;

  const qrValue =
    res.qr_payload ??
    res.qrToken ??
    res.qr_token ??
    JSON.stringify({
      type: 'event_entry',
      reservation_id: res.id,
      user_id: res.user_id,
      event_id: res.event_id,
    });

  const isCheckedIn = Boolean(res.checked_in_at);
  const isEntryReservation = res.type === 'entry';
  const hasStripeTicket = Boolean(
    res.ticket_order?.id ||
    res.ticket_order_id ||
    res.stripe_session_id ||
    res.stripe_payment_intent ||
    res.payment_provider === 'stripe' ||
    res.payment_method === 'stripe',
  );
  const isCancellationBlocked = isCheckedIn || isEntryReservation || hasStripeTicket;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(qrValue)}`;
  const statusTone = getStatusTone(res.status, theme.colors.primary, theme.colors.muted);

  const eventName = res.event?.name ?? res.event_id;
  const eventDateText = formatEventDate(res.event?.date);
  const eventTimeText = formatEventTime(res.event);
  const venueName = res.event?.venue?.name ?? res.venue?.name ?? 'Locale da confermare';
  const venueAddress = formatVenueLocation(res.event?.venue ?? res.venue);
  const ownerLabel = res.user?.username ?? res.user?.email?.split('@')[0] ?? 'Ingresso personale';
  const zoneLabel = res.venue_table?.zona ?? res.venue_table?.nome ?? '';
  const tableLabel = res.venue_table?.numero
    ? `Tavolo ${res.venue_table.numero}`
    : zoneLabel
      ? `Zona ${zoneLabel}`
      : 'Zona richiesta';

  const cancellationBlockReason = (() => {
    if (isCheckedIn) return 'Prenotazione completata';
    if (hasStripeTicket) return 'I ticket acquistati con Stripe non sono annullabili dal cliente';
    if (isEntryReservation) return 'Gli ingressi in lista non sono annullabili dal cliente';
    return null;
  })();

  const showMessage = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Info', message);
  };

  const openVenueDirections = async () => {
    const venue = res.event?.venue ?? res.venue;
    const lat = toNumberOrNull(venue?.latitude);
    const lng = toNumberOrNull(venue?.longitude);
    const hasCoordinates = lat !== null && lng !== null;
    const addressLabel = [venue?.address, venue?.city].filter(Boolean).join(', ') || venueName;
    const encodedDestination = encodeURIComponent(addressLabel);
    const coordinateQuery = hasCoordinates ? `${lat},${lng}` : '';

    const googleMapsAppUrl = Platform.select({
      ios: hasCoordinates
        ? `comgooglemaps://?center=${coordinateQuery}&q=${coordinateQuery}`
        : `comgooglemaps://?q=${encodedDestination}`,
      android: hasCoordinates
        ? `google.navigation:q=${coordinateQuery}`
        : `google.navigation:q=${encodedDestination}`,
      default: undefined,
    });

    const googleMapsWebUrl = hasCoordinates
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
        showMessage('Impossibile aprire la mappa');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Feather name="chevron-left" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Dettaglio prenotazione</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.topCard, { borderColor: statusTone + '66', backgroundColor: theme.colors.card }]}> 
          <View style={styles.topRowMeta}>
            <View style={[styles.statusBadge, { borderColor: statusTone + '80', backgroundColor: statusTone + '1F' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusTone }]} />
              <Text style={[styles.statusBadgeText, { color: statusTone }]}>{statusLabelFromReservation(res.status)}</Text>
            </View>
            <View style={styles.orderWrap}>
              <Text style={[styles.orderLabel, { color: theme.colors.muted }]}>Prenotazione</Text>
              <Text style={[styles.orderValue, { color: theme.colors.text }]} numberOfLines={1}>{String(res.id).slice(0, 8).toUpperCase()}</Text>
            </View>
          </View>

          <Text style={[styles.eventEyebrow, { color: statusTone }]}>Ticket digitale</Text>
          <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{eventName}</Text>
          {res.type === 'table' ? (
            <Text style={[styles.metaText, { color: theme.colors.muted }]}>
              {tableLabel}
            </Text>
          ) : (
            <Text style={[styles.metaText, { color: isCheckedIn ? theme.colors.primary : theme.colors.muted }]}> 
              {isCheckedIn ? 'Ingresso registrato al locale' : 'Biglietto ingresso attivo'}
            </Text>
          )}

          <View style={styles.eventInfoRow}>
            <View style={[styles.eventInfoIcon, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Feather name="calendar" size={15} color={statusTone} />
            </View>
            <View style={styles.eventInfoTextWrap}>
              <Text style={[styles.eventInfoMain, { color: theme.colors.text }]}>{eventDateText}</Text>
              <Text style={[styles.eventInfoSub, { color: theme.colors.muted }]}>{eventTimeText}</Text>
            </View>
          </View>

          <View style={[styles.venueRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}> 
            <View style={[styles.venueIconWrap, { borderColor: statusTone + '50', backgroundColor: statusTone + '14' }]}>
              <Feather name="map-pin" size={14} color={statusTone} />
            </View>
            <View style={styles.venueTextWrap}>
              <Text style={[styles.venueTitle, { color: theme.colors.text }]} numberOfLines={1}>{venueName}</Text>
              <Text style={[styles.venueSub, { color: theme.colors.muted }]} numberOfLines={1}>{venueAddress}</Text>
            </View>
            <TouchableOpacity
              style={[styles.venueAction, { backgroundColor: statusTone }]}
              onPress={openVenueDirections}
              activeOpacity={0.85}
            >
              <Feather name="navigation" size={13} color={theme.colors.text} />
              <Text style={[styles.venueActionText, { color: theme.colors.text }]}>Vai</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.ticketCutRow, { borderColor: statusTone + '40' }]}>
            <View style={[styles.ticketCut, { backgroundColor: theme.colors.background, borderColor: statusTone + '40' }]} />
            <View style={[styles.ticketDash, { borderColor: statusTone + '40' }]} />
            <View style={[styles.ticketCut, { backgroundColor: theme.colors.background, borderColor: statusTone + '40' }]} />
          </View>
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
          <Text style={[styles.label, { color: theme.colors.muted }]}>Tipo</Text>
          <Text style={[styles.value, { color: theme.colors.text }]}>{res.type === 'table' ? 'Prenotazione zona tavolo' : 'Ingresso QR'}</Text>

          {res.guests ? <Text style={[styles.infoLine, { color: theme.colors.muted }]}>{res.guests} persone</Text> : null}

          {res.type === 'entry' ? (
            <>
              <View style={[styles.qrCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
                <Text style={[styles.qrHint, { color: theme.colors.muted }]}>Scansiona all'ingresso</Text>
                <TouchableOpacity onPress={() => setQrOpen(true)} activeOpacity={0.85} style={styles.qrTouchWrap}>
                  <View style={styles.qrCornerTL} />
                  <View style={styles.qrCornerTR} />
                  <View style={styles.qrCornerBL} />
                  <View style={styles.qrCornerBR} />
                  <Image source={{ uri: qrImageUrl }} style={styles.qrImage} />
                </TouchableOpacity>

                <View style={[styles.ownerPill, { borderColor: statusTone + '40', backgroundColor: statusTone + '16' }]}>
                  <Feather name="star" size={12} color={statusTone} />
                  <Text style={[styles.ownerPillText, { color: statusTone }]}>{ownerLabel}</Text>
                </View>
              </View>

              <View style={styles.qrActionsRow}>
                <TouchableOpacity
                  onPress={() => setQrOpen(true)}
                  style={[styles.actionBtnPrimary, { backgroundColor: theme.colors.primary }]}
                >
                  <Feather name="maximize-2" size={16} color={theme.colors.text} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Apri grande</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>

        {cancellationBlockReason ? (
          <View style={[styles.policyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
            <View style={styles.policyRow}>
              <Feather name="shield" size={16} color={theme.colors.muted} />
              <Text style={[styles.policyText, { color: theme.colors.muted }]}>{cancellationBlockReason}</Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.cancelBtn,
            {
              backgroundColor: isCancellationBlocked ? theme.colors.card : theme.colors.primary,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={async () => {
            if (isCancellationBlocked) return;
            try {
              await cancelReservation(id);
              await load();
              showMessage('Prenotazione annullata');
            } catch {
              Alert.alert('Operazione non disponibile', 'Questa prenotazione non può essere annullata dal cliente.');
            }
          }}
          disabled={isCancellationBlocked}
        >
          <Text style={{ color: isCancellationBlocked ? theme.colors.muted : theme.colors.text, fontWeight: '800' }}>
            {isCancellationBlocked ? 'Annullamento non disponibile' : 'Annulla prenotazione'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <SafeAreaView style={styles.modalRoot} edges={["top", "bottom"]}>
          <View style={[styles.modalInner, { backgroundColor: theme.colors.background }]}> 
            <TouchableOpacity style={[styles.modalClose, { borderColor: theme.colors.border }]} onPress={() => setQrOpen(false)}>
              <Feather name="x" size={16} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Biglietto QR</Text>
            <Text style={[styles.modalSub, { color: theme.colors.muted }]}>Mostra il codice allo staff del locale</Text>
            {res.type === 'entry' ? <Image source={{ uri: qrImageUrl }} style={styles.qrFull} /> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtnGhost, { borderColor: theme.colors.border }]} onPress={() => setQrOpen(false)}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Chiudi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, gap: 12, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerSpacer: { width: 40, height: 40 },
  topCard: { borderWidth: 1, borderRadius: 22, padding: 16 },
  topRowMeta: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  orderWrap: { alignItems: 'flex-end', maxWidth: 130 },
  orderLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  orderValue: { marginTop: 2, fontSize: 13, fontWeight: '900' },
  eventEyebrow: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 4 },
  eventTitle: { fontSize: 25, fontWeight: '900', lineHeight: 30 },
  metaText: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  eventInfoRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventInfoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfoTextWrap: { flex: 1 },
  eventInfoMain: { fontSize: 14, fontWeight: '800' },
  eventInfoSub: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  venueRow: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 13,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  venueIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueTextWrap: { flex: 1 },
  venueTitle: { fontSize: 13, fontWeight: '800' },
  venueSub: { marginTop: 1, fontSize: 11, fontWeight: '600' },
  venueAction: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueActionText: { fontSize: 11, fontWeight: '900' },
  ticketCutRow: {
    marginTop: 14,
    marginHorizontal: -16,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketCut: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  ticketDash: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  sectionCard: { borderWidth: 1, borderRadius: 16, padding: 14 },
  label: { fontSize: 12, fontWeight: '700' },
  value: { marginTop: 4, fontSize: 16, fontWeight: '900' },
  infoLine: { marginTop: 6, fontSize: 13 },
  qrCard: { marginTop: 12, borderWidth: 1, borderRadius: 18, alignItems: 'center', padding: 14 },
  qrHint: { fontSize: 11, marginBottom: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9 },
  qrTouchWrap: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  qrCornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 14,
    height: 14,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#5E5CE6',
    zIndex: 2,
  },
  qrCornerTR: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 14,
    height: 14,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#5E5CE6',
    zIndex: 2,
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 14,
    height: 14,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#5E5CE6',
    zIndex: 2,
  },
  qrCornerBR: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 14,
    height: 14,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#5E5CE6',
    zIndex: 2,
  },
  qrImage: { width: 228, height: 228, borderRadius: 12 },
  ownerPill: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerPillText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  qrActionsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, flex: 1 },
  actionBtnText: { fontSize: 13, fontWeight: '800' },
  policyCard: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  policyText: { fontSize: 12, fontWeight: '700', flex: 1 },
  cancelBtn: { marginTop: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  modalInner: { marginHorizontal: 18, marginVertical: 24, borderRadius: 22, padding: 16, alignItems: 'center', flex: 1, justifyContent: 'center' },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 21, fontWeight: '900' },
  modalSub: { marginTop: 6, marginBottom: 16, fontSize: 13 },
  qrFull: { width: 320, height: 320, borderRadius: 14 },
  modalActions: { marginTop: 20, flexDirection: 'row', gap: 10, width: '100%' },
  modalBtnGhost: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalBtnPrimary: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
});

function statusLabelFromReservation(status?: string) {
  if (status === 'confirmed') return 'Confermata';
  if (status === 'pending') return 'In attesa';
  if (status === 'completed') return 'Completata';
  if (status === 'cancelled') return 'Annullata';
  return 'Attiva';
}

function getStatusTone(status: string | undefined, primary: string, muted: string) {
  if (status === 'cancelled') return '#EF4444';
  if (status === 'pending') return '#F59E0B';
  if (status === 'completed') return primary;
  if (status === 'confirmed') return primary;
  return muted;
}

function formatEventDate(value?: string) {
  if (!value) return 'Data non disponibile';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Data non disponibile';
  const label = d.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatEventTime(event: any) {
  const start = toHourMinute(event?.start_time ?? event?.startAt ?? event?.start_at);
  const end = toHourMinute(event?.end_time ?? event?.endAt ?? event?.end_at);
  if (start && end) return `${start} - ${end}`;
  if (start) return `Dalle ${start}`;
  return 'Orario non disponibile';
}

function toHourMinute(value?: string | null) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;

  const fromIso = raw.match(/T(\d{2}):(\d{2})/);
  if (fromIso) return `${fromIso[1]}:${fromIso[2]}`;

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  return null;
}

function formatVenueLocation(venue?: any) {
  if (!venue) return 'Posizione non disponibile';
  const address = String(venue.address ?? '').trim();
  const city = String(venue.city ?? '').trim();
  if (address && city) return `${address}, ${city}`;
  if (address) return address;
  if (city) return city;
  return 'Posizione non disponibile';
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}