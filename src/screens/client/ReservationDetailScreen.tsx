import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Share } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { getReservation, cancelReservation } from "../../services/reservations";

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

  const eventName = res.event?.name ?? res.event_id;
  const tableLabel = res.venue_table?.numero
    ? `Tavolo ${res.venue_table.numero}`
    : res.venue_table?.nome ?? 'Tavolo';
  const zoneLabel = res.venue_table?.zona ?? '';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }] }>
      <View style={{ padding: 18 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{eventName}</Text>
        {res.type === 'table' ? (
          <Text style={{ color: theme.colors.muted, marginTop: 6 }}>
            {zoneLabel ? `${zoneLabel} • ` : ''}{tableLabel}
          </Text>
        ) : (
          <Text style={{ color: theme.colors.muted, marginTop: 6 }}>Ingresso</Text>
        )}

        <View style={{ height: 12 }} />

        <View style={[{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }] }>
          <Text style={{ color: theme.colors.muted }}>Tipo</Text>
          <Text style={{ color: theme.colors.text, fontWeight: '700', marginTop: 6 }}>{res.type === 'table' ? 'Prenotazione tavolo' : 'Ingresso (QR)'}</Text>

          {res.guests ? (
            <Text style={{ color: theme.colors.muted, marginTop: 6 }}>{res.guests} persone</Text>
          ) : null}

          {res.invitees && res.invitees.length ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: theme.colors.muted }}>Invitees</Text>
              {res.invitees.map((i:any, idx:number) => (
                <Text key={idx} style={{ color: theme.colors.text }}>{i.name} {i.external ? '(esterno)' : ''}</Text>
              ))}
            </View>
          ) : null}

          {res.qrToken ? (
            <View style={{ marginTop: 12, alignItems: 'center', backgroundColor: theme.colors.card, padding: 12, borderRadius: 8 }}>
              <Text style={{ color: theme.colors.muted }}>QR Token</Text>
              <Text style={{ color: theme.colors.text, fontWeight: '700', marginTop: 6 }}>{res.qrToken}</Text>
              <TouchableOpacity onPress={() => setQrOpen(true)} style={{ marginTop: 12, alignItems: 'center' }}>
                <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(res.qrToken)}` }} style={{ width: 200, height: 200 }} />
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                <TouchableOpacity onPress={() => { Share.share({ message: `Mostra questo QR al locale: ${res.qrToken}` }); }} style={{ padding: 10, backgroundColor: theme.colors.primary, borderRadius: 8, marginRight: 8 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Condividi QR</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setQrOpen(true)} style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.muted, fontWeight: '700' }}>Visualizza a schermo intero</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ height: 16 }} />
        <TouchableOpacity style={{ padding: 12, backgroundColor: theme.colors.primary, borderRadius: 10 }} onPress={async () => { await cancelReservation(id); load(); }}>
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Annulla prenotazione</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={qrOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
          {res.qrToken ? (
            <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(res.qrToken)}` }} style={{ width: 320, height: 320 }} />
          ) : null}
          <TouchableOpacity style={{ marginTop: 20, padding: 12, backgroundColor: theme.colors.primary, borderRadius: 8 }} onPress={() => setQrOpen(false)}>
            <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Chiudi</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });