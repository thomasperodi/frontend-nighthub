import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ScrollView, Alert, Platform, ToastAndroid, Linking } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { getReservation, cancelReservation } from "../../services/reservations";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";

export default function ReservationDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { theme } = useTheme();
  const [res, setRes] = useState<any>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [savingQr, setSavingQr] = useState(false);

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

  const eventName = res.event?.name ?? res.event_id;
  const tableLabel = res.venue_table?.numero
    ? `Tavolo ${res.venue_table.numero}`
    : res.venue_table?.nome ?? 'Tavolo';
  const zoneLabel = res.venue_table?.zona ?? '';

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

  const saveQrToGallery = async () => {
    if (savingQr) return;

    try {
      setSavingQr(true);

      const currentPermission = await MediaLibrary.getPermissionsAsync(true, ['photo']);
      let granted = currentPermission.granted;

      if (!granted) {
        const requestedPermission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
        granted = requestedPermission.granted;
      }

      if (!granted) {
        Alert.alert(
          'Permesso richiesto',
          'Per salvare il QR devi consentire l\'accesso a Foto/Galleria nelle impostazioni del telefono.',
          [
            { text: 'Annulla', style: 'cancel' },
            {
              text: 'Apri impostazioni',
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
        return;
      }

      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) {
        Alert.alert('Errore', 'Impossibile accedere allo storage del dispositivo.');
        return;
      }

      const fileUri = `${dir}reservation-qr-${res.id}.png`;
      await FileSystem.downloadAsync(qrImageUrl, fileUri);

      await MediaLibrary.saveToLibraryAsync(fileUri);
      showMessage('QR salvato in galleria');
    } catch {
      Alert.alert('Errore', 'Non sono riuscito a salvare il QR in galleria.');
    } finally {
      setSavingQr(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.topCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
          <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{eventName}</Text>
          {res.type === 'table' ? (
            <Text style={[styles.metaText, { color: theme.colors.muted }]}>
              {zoneLabel ? `${zoneLabel} • ` : ''}{tableLabel}
            </Text>
          ) : (
            <Text style={[styles.metaText, { color: isCheckedIn ? theme.colors.primary : theme.colors.muted }]}> 
              {isCheckedIn ? 'Ingresso registrato al locale' : 'Biglietto ingresso attivo'}
            </Text>
          )}
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
          <Text style={[styles.label, { color: theme.colors.muted }]}>Tipo</Text>
          <Text style={[styles.value, { color: theme.colors.text }]}>{res.type === 'table' ? 'Prenotazione tavolo' : 'Ingresso QR'}</Text>

          {res.guests ? <Text style={[styles.infoLine, { color: theme.colors.muted }]}>{res.guests} persone</Text> : null}

          {res.type === 'entry' ? (
            <>
              <View style={[styles.qrCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
                <Text style={[styles.qrHint, { color: theme.colors.muted }]}>Mostra questo QR allo staff all'ingresso</Text>
                <TouchableOpacity onPress={() => setQrOpen(true)} activeOpacity={0.85}>
                  <Image source={{ uri: qrImageUrl }} style={styles.qrImage} />
                </TouchableOpacity>
              </View>

              <View style={styles.qrActionsRow}>
                <TouchableOpacity onPress={saveQrToGallery} disabled={savingQr} style={[styles.actionBtnGhost, { borderColor: theme.colors.border }]}> 
                  <Feather name={savingQr ? "loader" : "download"} size={16} color={theme.colors.text} />
                  <Text style={[styles.actionGhostText, { color: theme.colors.text }]}>{savingQr ? 'Salvataggio...' : 'Salva in galleria'}</Text>
                </TouchableOpacity>

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
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Biglietto QR</Text>
            <Text style={[styles.modalSub, { color: theme.colors.muted }]}>Mostra il codice allo staff del locale</Text>
            {res.type === 'entry' ? <Image source={{ uri: qrImageUrl }} style={styles.qrFull} /> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtnGhost, { borderColor: theme.colors.border }]} onPress={() => setQrOpen(false)}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Chiudi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: theme.colors.primary }]}
                onPress={saveQrToGallery}
                disabled={savingQr}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{savingQr ? 'Salvataggio...' : 'Salva'}</Text>
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
  content: { padding: 18, gap: 12 },
  topCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  eventTitle: { fontSize: 20, fontWeight: '900' },
  metaText: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  sectionCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  label: { fontSize: 12, fontWeight: '700' },
  value: { marginTop: 4, fontSize: 16, fontWeight: '900' },
  infoLine: { marginTop: 6, fontSize: 13 },
  qrCard: { marginTop: 12, borderWidth: 1, borderRadius: 12, alignItems: 'center', padding: 12 },
  qrHint: { fontSize: 12, marginBottom: 10 },
  qrImage: { width: 220, height: 220, borderRadius: 8 },
  qrActionsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, flex: 1 },
  actionBtnText: { fontSize: 13, fontWeight: '800' },
  actionBtnGhost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 12, flex: 1 },
  actionGhostText: { fontSize: 13, fontWeight: '700' },
  policyCard: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  policyText: { fontSize: 12, fontWeight: '700', flex: 1 },
  cancelBtn: { marginTop: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  modalInner: { marginHorizontal: 18, marginVertical: 24, borderRadius: 16, padding: 16, alignItems: 'center', flex: 1, justifyContent: 'center' },
  modalTitle: { fontSize: 21, fontWeight: '900' },
  modalSub: { marginTop: 6, marginBottom: 16, fontSize: 13 },
  qrFull: { width: 320, height: 320, borderRadius: 10 },
  modalActions: { marginTop: 20, flexDirection: 'row', gap: 10, width: '100%' },
  modalBtnGhost: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBtnPrimary: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
});