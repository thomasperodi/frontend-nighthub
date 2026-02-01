import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { listBarSales, listCloakroomSales, listEntries, listTableSales } from "../../services/staff";

type Props = { eventId?: string | null };

const sum = (values: Array<number | undefined | null>): number =>
  values.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);

export default function StaffScreen({ eventId }: Props) {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [barSales, setBarSales] = useState<any[]>([]);
  const [cloakSales, setCloakSales] = useState<any[]>([]);
  const [tableSales, setTableSales] = useState<any[]>([]);

  const totals = useMemo(() => {
    const totalEntries = sum(entries.map((e) => e.quantity));
    const totalBar = sum(barSales.map((s) => (Number.isFinite(Number(s.amount)) ? Number(s.amount) : 0)));
    const totalCloak = sum(cloakSales.map((s) => (Number.isFinite(Number(s.amount)) ? Number(s.amount) : 0)));
    const totalTables = sum(tableSales.map((s) => (Number.isFinite(Number(s.amount)) ? Number(s.amount) : 0)));
    return {
      totalEntries,
      totalBar,
      totalCloak,
      totalTables,
      totalRevenue: totalBar + totalCloak + totalTables,
    };
  }, [entries, barSales, cloakSales, tableSales]);

  const load = async () => {
    if (!eventId) {
      setEntries([]);
      setBarSales([]);
      setCloakSales([]);
      setTableSales([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [entriesRes, barRes, cloakRes, tableRes] = await Promise.allSettled([
        listEntries(eventId),
        listBarSales(eventId),
        listCloakroomSales(eventId),
        listTableSales(eventId),
      ]);

      if (entriesRes.status === 'fulfilled') setEntries(entriesRes.value);
      else setError((p) => p ?? 'Impossibile caricare ingressi');

      if (barRes.status === 'fulfilled') setBarSales(barRes.value);
      else setError((p) => p ?? 'Impossibile caricare vendite bar');

      if (cloakRes.status === 'fulfilled') setCloakSales(cloakRes.value);
      else setError((p) => p ?? 'Impossibile caricare vendite guardaroba');

      if (tableRes.status === 'fulfilled') setTableSales(tableRes.value);
      else setError((p) => p ?? 'Impossibile caricare vendite tavoli');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

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
        <Text style={[styles.title, { color: theme.colors.text }]}>Operazioni</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
          <Feather name="refresh-cw" size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {!eventId ? (
        <View style={styles.center}>
          <Feather name="calendar" size={28} color={theme.colors.muted} />
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Nessun evento live: avvia un evento per vedere i dati staff.</Text>
        </View>
      ) : loading && entries.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Caricamento…</Text>
        </View>
      ) : (
        <>
          {error ? (
            <View style={styles.banner}>
              <Feather name="alert-triangle" size={16} color="#f59e0b" />
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.grid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Ingressi</Text>
              <Text style={styles.kpiValue}>{totals.totalEntries}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Incasso Tot</Text>
              <Text style={styles.kpiValue}>€{totals.totalRevenue.toFixed(2)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Bar</Text>
              <Text style={styles.kpiValue}>€{totals.totalBar.toFixed(2)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Guardaroba</Text>
              <Text style={styles.kpiValue}>€{totals.totalCloak.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ultime attività</Text>
            <Text style={styles.rowText}>Ingressi registrati: {entries.slice(0, 1).length ? entries.length : 0}</Text>
            <Text style={styles.rowText}>Vendite bar: {barSales.length}</Text>
            <Text style={styles.rowText}>Vendite guardaroba: {cloakSales.length}</Text>
            <Text style={styles.rowText}>Pagamenti tavoli: {tableSales.length}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  iconBtn: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  mutedText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    marginBottom: 14,
  },
  bannerText: { color: '#f59e0b', fontSize: 12, fontWeight: '800', flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
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
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: { color: 'white', fontWeight: '900', fontSize: 14, marginBottom: 10 },
  rowText: { color: '#d1d5db', fontWeight: '600', fontSize: 12, marginTop: 6 },
});
