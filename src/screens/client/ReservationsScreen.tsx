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
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

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

  const canCancelFromClient = (item: any) => item?.type === 'table' && item?.status !== 'completed' && item?.status !== 'cancelled';

  const formatDate = (value?: string) => {
    if (!value) return 'Data non disponibile';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Data non disponibile';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const upcomingCount = list.filter((item) => item?.status !== 'completed' && item?.status !== 'cancelled').length;
  const pastCount = list.filter((item) => item?.status === 'completed').length;
  const cancelledCount = list.filter((item) => item?.status === 'cancelled').length;
  const filteredList = list.filter((item) => {
    if (activeTab === 'past') return item?.status === 'completed';
    if (activeTab === 'cancelled') return item?.status === 'cancelled';
    return item?.status !== 'completed' && item?.status !== 'cancelled';
  });

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Le tue prenotazioni</Text>
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Apri un ticket per mostrare il QR all'ingresso del locale.</Text>
          </View>
          <TouchableOpacity
            style={[styles.historyBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
            activeOpacity={0.85}
          >
            <Feather name="clock" size={16} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.segmentedWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('upcoming')}
            style={[
              activeTab === 'upcoming' ? styles.segmentedItemActive : styles.segmentedItemGhost,
              activeTab === 'upcoming'
                ? { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                : null,
            ]}
            activeOpacity={0.85}
          >
            <Text style={[activeTab === 'upcoming' ? styles.segmentedLabelActive : styles.segmentedLabelGhost, { color: activeTab === 'upcoming' ? theme.colors.text : theme.colors.muted }]}>Prossime</Text>
            <Text style={[activeTab === 'upcoming' ? styles.segmentedCount : styles.segmentedGhostCount, { color: activeTab === 'upcoming' ? theme.colors.primary : theme.colors.muted }]}>{upcomingCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('past')}
            style={[
              activeTab === 'past' ? styles.segmentedItemActive : styles.segmentedItemGhost,
              activeTab === 'past'
                ? { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                : null,
            ]}
            activeOpacity={0.85}
          >
            <Text style={[activeTab === 'past' ? styles.segmentedLabelActive : styles.segmentedLabelGhost, { color: activeTab === 'past' ? theme.colors.text : theme.colors.muted }]}>Passate</Text>
            <Text style={[activeTab === 'past' ? styles.segmentedCount : styles.segmentedGhostCount, { color: activeTab === 'past' ? theme.colors.primary : theme.colors.muted }]}>{pastCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('cancelled')}
            style={[
              activeTab === 'cancelled' ? styles.segmentedItemActive : styles.segmentedItemGhost,
              activeTab === 'cancelled'
                ? { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                : null,
            ]}
            activeOpacity={0.85}
          >
            <Text style={[activeTab === 'cancelled' ? styles.segmentedLabelActive : styles.segmentedLabelGhost, { color: activeTab === 'cancelled' ? theme.colors.text : theme.colors.muted }]}>Annullate</Text>
            <Text style={[activeTab === 'cancelled' ? styles.segmentedCount : styles.segmentedGhostCount, { color: activeTab === 'cancelled' ? theme.colors.primary : theme.colors.muted }]}>{cancelledCount}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredList}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          try { await load(); } finally { setRefreshing(false); }
        }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ReservationDetail', { id: item.id })}
            style={[styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
            activeOpacity={0.85}
          >
            <View style={[styles.leftAccent, { backgroundColor: statusColor(item.status) + '33' }]} />

            <View style={styles.cardMain}>
              <View style={styles.rowTopMeta}>
                <View style={[styles.typePill, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                  <Feather
                    name={item.type === 'table' ? 'users' : 'shield'}
                    size={12}
                    color={theme.colors.text}
                  />
                  <Text style={[styles.typePillText, { color: theme.colors.text }]}>{item.type === 'table' ? 'Prenotazione tavolo' : 'Ticket ingresso'}</Text>
                </View>
                {!canCancelFromClient(item) ? (
                  <View style={[styles.lockPill, { borderColor: theme.colors.border }]}>
                    <Feather name="lock" size={11} color={theme.colors.muted} />
                    <Text style={[styles.lockPillText, { color: theme.colors.muted }]}>Non annullabile</Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.eventName, { color: theme.colors.text }]} numberOfLines={1}>{item.event?.name ?? item.event_id}</Text>

              <View style={styles.dateRow}>
                <Feather name="calendar" size={12} color={theme.colors.muted} />
                <Text style={[styles.eventDate, { color: theme.colors.muted }]}>{formatDate(item.event?.date)}</Text>
              </View>

              {item.type === 'table' ? (
                <Text style={[styles.metaText, { color: theme.colors.muted }]}>
                  {(item.venue_table?.zona ? `Zona ${item.venue_table.zona}` : (item.venue_table?.nome ? `Zona ${item.venue_table.nome}` : 'Zona richiesta'))}
                  {item.venue_table?.numero ? ` • Tavolo ${item.venue_table.numero}` : ''}
                  {item.guests ? ` • ${item.guests} ospiti` : ''}
                </Text>
              ) : (
                <Text style={[styles.metaText, { color: theme.colors.muted }]}>Biglietto con QR{item.total_amount ? ` • €${Number(item.total_amount).toFixed(2)}` : ''}</Text>
              )}
            </View>

            <View style={styles.rightWrap}>
              <View style={[styles.statusPill, { borderColor: statusColor(item.status), backgroundColor: statusColor(item.status) + '14' }]}>
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
              </View>
              <View style={[styles.chevronWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <Feather name="chevron-right" size={16} color={theme.colors.muted} />
              </View>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28 }}
        ListEmptyComponent={() => (
          <View style={[styles.emptyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Feather name="calendar" size={24} color={theme.colors.muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nessuna prenotazione disponibile</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.muted }]}>Quando confermi un evento, qui troverai il ticket con QR pronto da mostrare in cassa.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    marginHorizontal: 18,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 2 },
  titleBlock: { flex: 1 },
  historyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  segmentedWrap: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentedItemActive: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentedItemGhost: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentedLabelActive: { fontSize: 12, fontWeight: '800' },
  segmentedCount: { fontSize: 12, fontWeight: '900' },
  segmentedLabelGhost: { fontSize: 12, fontWeight: '700' },
  segmentedGhostCount: { fontSize: 11, fontWeight: '800' },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leftAccent: { width: 5, alignSelf: 'stretch', borderRadius: 999 },
  cardMain: { flex: 1 },
  rowTopMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' },
  typePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  typePillText: { fontSize: 11, fontWeight: '800' },
  lockPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockPillText: { fontSize: 11, fontWeight: '700' },
  eventName: { fontWeight: '800', fontSize: 15 },
  dateRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  eventDate: { fontSize: 12, fontWeight: '700' },
  metaText: { marginTop: 4, fontSize: 13 },
  rightWrap: { alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 66 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  chevronWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: 'center', gap: 10, marginTop: 8 },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySubtitle: { textAlign: 'center', fontSize: 13, lineHeight: 18 },
});