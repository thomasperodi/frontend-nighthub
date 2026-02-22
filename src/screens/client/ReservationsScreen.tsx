import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { getReservations } from "../../services/reservations";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

export default function ReservationsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [list, setList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const r = await getReservations();
    setList(r);
  };

  const statusLabel = (status?: string) => {
    if (status === 'confirmed') return 'Confermata';
    if (status === 'pending') return 'In attesa';
    if (status === 'completed') return 'Completata';
    if (status === 'cancelled') return 'Annullata';
    return status ?? '---';
  };

  const statusColor = (status?: string) => {
    if (status === 'confirmed' || status === 'completed') return theme.colors.primary;
    return theme.colors.muted;
  };

  const formatDate = (value?: string) => {
    if (!value) return 'Data non disponibile';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Data non disponibile';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <View style={styles.headerWrap}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Le tue prenotazioni</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Apri una prenotazione per mostrare il QR al locale</Text>
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          try { await load(); } finally { setRefreshing(false); }
        }} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('ReservationDetail', { id: item.id })} style={[styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eventName, { color: theme.colors.text }]} numberOfLines={1}>{item.event?.name ?? item.event_id}</Text>
              <Text style={[styles.eventDate, { color: theme.colors.muted }]}>{formatDate(item.event?.date)}</Text>
              {item.type === 'table' ? (
                <Text style={[styles.metaText, { color: theme.colors.muted }]}>
                  {(item.venue_table?.zona ? `${item.venue_table.zona} • ` : '')}
                  {item.venue_table?.numero ? `Tavolo ${item.venue_table.numero}` : (item.venue_table?.nome ?? 'Tavolo')}
                  {item.guests ? ` • ${item.guests} ospiti` : ''}
                </Text>
              ) : (
                <Text style={[styles.metaText, { color: theme.colors.muted }]}>Ingresso con QR{item.total_amount ? ` • €${Number(item.total_amount).toFixed(2)}` : ''}</Text>
              )}
            </View>

            <View style={styles.rightWrap}>
              <View style={[styles.statusPill, { borderColor: statusColor(item.status) }]}>
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={theme.colors.muted} />
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 28 }}
        ListEmptyComponent={() => (
          <View style={[styles.emptyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <Feather name="calendar" size={24} color={theme.colors.muted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nessuna prenotazione</Text>
            <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>Quando prenoti un evento, qui trovi il tuo biglietto QR.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 13 },
  row: { padding: 14, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventName: { fontWeight: '800', fontSize: 15 },
  eventDate: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  metaText: { marginTop: 4, fontSize: 13 },
  rightWrap: { alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 52 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 18, alignItems: 'center', gap: 8, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
});