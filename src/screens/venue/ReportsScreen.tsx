import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { useEffect, useMemo, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { fetchEventsByVenue, fetchVenueStats } from "../../services/events";
import { Event, EventStats, VenueStats } from "../../types/events";

type Props = {
  venueId?: string | null;
  selectedEvent?: Event | null;
  eventStats?: EventStats | null;
};

const toNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

export default function ReportsScreen({ venueId, selectedEvent, eventStats }: Props) {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venueStats, setVenueStats] = useState<VenueStats | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const totals = useMemo(() => {
    const totalEntries = venueStats?.total_entries ?? 0;
    const totalEntriesRevenue = toNumber(venueStats?.total_entries_revenue);
    const totalBar = toNumber(venueStats?.total_bar);
    const totalCloak = toNumber(venueStats?.total_cloakroom);
    const totalTables = toNumber(venueStats?.total_tables);
    const totalRevenue = totalEntriesRevenue + totalBar + totalCloak + totalTables;
    const avgPerEntry = totalEntries > 0 ? totalRevenue / totalEntries : 0;
    return { totalEntries, totalEntriesRevenue, totalBar, totalCloak, totalTables, totalRevenue, avgPerEntry };
  }, [venueStats]);

  const live = useMemo(() => {
    const entriesRevenue = toNumber(eventStats?.total_entries_revenue);
    const bar = toNumber(eventStats?.total_bar);
    const clo = toNumber(eventStats?.total_cloakroom);
    const tab = toNumber(eventStats?.total_tables);
    const entries = eventStats?.total_entries ?? 0;
    const revenue = entriesRevenue + bar + clo + tab;
    const avg = entries > 0 ? revenue / entries : 0;
    return { entriesRevenue, bar, clo, tab, entries, revenue, avg };
  }, [eventStats]);

  const byEvent = useMemo(() => {
    const list = [...events];
    list.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
    return list.slice(0, 8);
  }, [events]);

  const load = async () => {
    if (!venueId) {
      setError('Venue ID mancante');
      setVenueStats(null);
      setEvents([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [vs, ev] = await Promise.all([
        fetchVenueStats(venueId),
        fetchEventsByVenue(venueId),
      ]);
      setVenueStats(vs);
      setEvents(ev);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.message || 'Errore nel caricamento report';
      setError(status ? `${msg} (${status})` : msg);
      setVenueStats(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [venueId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Report</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Aggiornamento live + storico locale</Text>
      </View>

      {!venueId ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color="#ef4444" />
          <Text style={[styles.error, { color: '#ef4444' }]}>Venue ID mancante</Text>
        </View>
      ) : loading && !venueStats ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.subtle, { color: theme.colors.muted }]}>Caricamento report…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color="#ef4444" />
          <Text style={[styles.error, { color: '#ef4444' }]}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Selected event snapshot */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Serata selezionata</Text>
          <View style={styles.card}>
            <Text style={styles.label}>{selectedEvent?.name ?? 'Nessuna serata selezionata'}</Text>
            {selectedEvent ? (
              <>
                <Text style={styles.value}>€{live.revenue.toFixed(2)}</Text>
                <Text style={styles.meta}>Ingressi: {live.entries} • Media/ingresso: €{live.avg.toFixed(2)}</Text>
                <Text style={styles.meta}>Ingresso €{live.entriesRevenue.toFixed(2)} • Bar €{live.bar.toFixed(2)}</Text>
                <Text style={styles.meta}>Guardaroba €{live.clo.toFixed(2)} • Tavoli €{live.tab.toFixed(2)}</Text>
              </>
            ) : (
              <Text style={styles.meta}>Seleziona un evento dalla Home per vedere i valori corretti della serata.</Text>
            )}
          </View>

          {/* Venue totals */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Storico locale</Text>
          <View style={styles.grid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Incasso Totale</Text>
              <Text style={styles.kpiValue}>€{totals.totalRevenue.toFixed(2)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Ingressi Totali</Text>
              <Text style={styles.kpiValue}>{totals.totalEntries}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Media/ingresso</Text>
              <Text style={styles.kpiValue}>€{totals.avgPerEntry.toFixed(2)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Incasso Ingresso</Text>
              <Text style={styles.kpiValue}>€{totals.totalEntriesRevenue.toFixed(2)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Incasso Tavoli</Text>
              <Text style={styles.kpiValue}>€{totals.totalTables.toFixed(2)}</Text>
            </View>
          </View>

          {/* Recent events */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ultimi eventi</Text>
          <View style={styles.card}>
            {byEvent.length === 0 ? (
              <Text style={styles.meta}>Nessun evento disponibile.</Text>
            ) : (
              byEvent.map((e) => {
                const es = venueStats?.events?.find((s) => s.event_id === e.id);
                const revenue =
                  toNumber(es?.total_entries_revenue) +
                  toNumber(es?.total_bar) +
                  toNumber(es?.total_tables) +
                  toNumber(es?.total_cloakroom);
                const entries = es?.total_entries ?? 0;
                return (
                  <View key={e.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{e.name}</Text>
                      <Text style={styles.rowSub}>{formatDate(e.date)} • {e.status}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.rowValue}>€{revenue.toFixed(0)}</Text>
                      <Text style={styles.rowSub}>{entries} ingressi</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "900" },
  subtitle: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  subtle: { fontSize: 12, fontWeight: '600' },
  error: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginTop: 10, marginBottom: 10 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  label: { color: "#CFC6FF" },
  value: { color: "white", fontSize: 22, fontWeight: "900", marginTop: 6 },
  meta: { color: '#d1d5db', fontSize: 12, fontWeight: '600', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  kpiCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  kpiLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  kpiValue: { color: 'white', fontSize: 18, fontWeight: '900', marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowTitle: { color: 'white', fontSize: 13, fontWeight: '900' },
  rowSub: { color: '#9ca3af', fontSize: 11, fontWeight: '700', marginTop: 4 },
  rowValue: { color: 'white', fontSize: 13, fontWeight: '900' },
});
