import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, TextInput, Alert, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useCallback, useMemo, useState } from "react";
import { deleteEvent, fetchEventsByVenue } from "../../services/events";
import { Event } from "../../types/events";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

type QuickFilter = 'all' | 'live' | 'upcoming' | 'past' | 'draft' | 'closed';

type Props = {
  venueId?: string | null;
  onSelectEvent?: (event: Event) => void;
};

const FILTER_OPTIONS: Array<{ key: QuickFilter; label: string }> = [
  { key: 'all', label: 'Tutti' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'In arrivo' },
  { key: 'past', label: 'Passati' },
  { key: 'draft', label: 'Bozze' },
  { key: 'closed', label: 'Chiusi' },
];

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
}

function formatStatus(value?: string) {
  const s = String(value ?? '').trim().toUpperCase();
  if (s === 'LIVE') return 'Live';
  if (s === 'CLOSED') return 'Chiuso';
  if (s === 'DRAFT') return 'Programmato';
  return s || '';
}

function getStatusTone(value?: string) {
  const s = String(value ?? '').trim().toUpperCase();
  if (s === 'LIVE') return { color: '#FF6B6B', soft: 'rgba(255,107,107,0.14)', border: 'rgba(255,107,107,0.28)' };
  if (s === 'DRAFT') return { color: '#F4C95D', soft: 'rgba(244,201,93,0.14)', border: 'rgba(244,201,93,0.28)' };
  if (s === 'CLOSED') return { color: '#94A3B8', soft: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.24)' };
  return { color: '#8B7BFF', soft: 'rgba(139,123,255,0.14)', border: 'rgba(139,123,255,0.24)' };
}

export default function EventsScreen({ venueId, onSelectEvent }: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const live = events.filter((event) => String(event.status ?? '').trim().toUpperCase() === 'LIVE').length;
    const draft = events.filter((event) => String(event.status ?? '').trim().toUpperCase() === 'DRAFT').length;
    const closed = events.filter((event) => String(event.status ?? '').trim().toUpperCase() === 'CLOSED').length;
    return { total: events.length, live, draft, closed };
  }, [events]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const q = query.trim().toLowerCase();

    const list = (events ?? []).filter((e) => {
      const status = String(e.status ?? '').trim().toUpperCase();
      const dateMs = Date.parse(e.date ?? '');
      const isValidDate = Number.isFinite(dateMs);
      const isUpcoming = isValidDate ? dateMs >= todayMs : true;
      const isPast = isValidDate ? dateMs < todayMs : false;

      if (filter === 'live' && status !== 'LIVE') return false;
      if (filter === 'draft' && status !== 'DRAFT') return false;
      if (filter === 'closed' && status !== 'CLOSED') return false;
      if (filter === 'upcoming' && !isUpcoming) return false;
      if (filter === 'past' && !isPast) return false;

      if (!q) return true;
      const hay = `${e.name ?? ''} ${status} ${formatDate(e.date)}`.toLowerCase();
      return hay.includes(q);
    });

    const copy = [...list];
    copy.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
    return copy;
  }, [events, query, filter]);

  const load = useCallback(async () => {
    if (!venueId) {
      setEvents([]);
      setError('Venue ID mancante');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const list = await fetchEventsByVenue(venueId);
      setEvents(list);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.message || 'Errore nel caricamento eventi';
      setError(status ? `${msg} (${status})` : msg);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useFocusEffect(
    // refresh after returning from CreateEvent
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDelete = useCallback(
    (event: Event) => {
      if (!event?.id) return;
      Alert.alert(
        'Conferma eliminazione',
        'Sei sicuro di voler eliminare questo evento? Verranno eliminati anche i dati collegati (prenotazioni, vendite, promo).',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Elimina',
            style: 'destructive',
            onPress: async () => {
              const previous = events;
              try {
                setDeletingId(event.id);
                // Optimistic UI: remove immediately
                setEvents((cur) => (cur ?? []).filter((e) => e.id !== event.id));
                await deleteEvent(event.id);
                await load();
                Alert.alert('Eliminato', 'Evento eliminato.');
              } catch (e: any) {
                console.warn('delete event', e);
                setEvents(previous);
                const status = e?.response?.status;
                const msg = e?.response?.data?.message || e?.message || 'Eliminazione fallita';
                Alert.alert('Errore', status ? `${msg} (${status})` : String(msg));
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [events, load],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {loading && filtered.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.subtle, { color: theme.colors.muted }]}>Caricamento eventi…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color="#ef4444" />
          <Text style={[styles.error, { color: '#ef4444' }]}>{error}</Text>
          <TouchableOpacity style={[styles.retry, { backgroundColor: theme.colors.primary }]} onPress={onRefresh}>
            <Text style={styles.retryText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          ListHeaderComponent={
            <View style={styles.listHeaderWrap}>
              <View style={[styles.heroCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.headerTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eyebrow, { color: theme.colors.muted }]}>Pannello eventi</Text>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Gestisci le tue serate</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Tieni tutto sotto controllo: stato, calendario e operazioni rapide.</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.headerAction, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                    onPress={() => {
                      try {
                        navigation.navigate('CreateEvent');
                      } catch {
                        // route might not exist in current navigator
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Crea nuovo evento"
                  >
                    <Feather name="plus" size={18} color="#fff" />
                    <Text style={styles.headerActionText}>Nuovo</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.summaryGrid}>
                  <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.muted }]}>Totali</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{stats.total}</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.summaryLabel, { color: '#FF6B6B' }]}>Live</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{stats.live}</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.summaryLabel, { color: '#F4C95D' }]}>Bozze</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{stats.draft}</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.summaryLabel, { color: '#94A3B8' }]}>Chiusi</Text>
                    <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{stats.closed}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.searchRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                <Feather name="search" size={16} color={theme.colors.muted} />
                <TextInput
                  placeholder="Cerca evento (nome, stato, data…)"
                  placeholderTextColor={theme.colors.muted}
                  value={query}
                  onChangeText={setQuery}
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query.length > 0 ? (
                  <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                    <Feather name="x" size={16} color={theme.colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersRow}
                keyboardShouldPersistTaps="handled"
              >
                {FILTER_OPTIONS.map((chip) => {
                  const active = filter === chip.key;
                  return (
                    <TouchableOpacity
                      key={chip.key}
                      onPress={() => setFilter(chip.key)}
                      style={[
                        styles.filterChip,
                        { borderColor: theme.colors.border },
                        active && { borderColor: theme.colors.primary, backgroundColor: 'rgba(109,91,255,0.16)' },
                      ]}
                    >
                      <Text style={[styles.filterChipText, { color: active ? theme.colors.primary : theme.colors.text }]}>
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) => {
            const tone = getStatusTone(item.status);
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  try {
                    onSelectEvent?.(item);
                  } catch {
                    // ignore
                  }
                }}
              >
                <View style={[styles.cardStripe, { backgroundColor: tone.color }]} />

                <View style={styles.cardHeadRow}>
                  <View style={[styles.statusPill, { backgroundColor: tone.soft, borderColor: tone.border }]}> 
                    <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
                    <Text style={[styles.statusPillText, { color: tone.color }]}>{formatStatus(item.status) || 'Evento'}</Text>
                  </View>
                  <Text style={[styles.cardMeta, { color: theme.colors.muted }]}>ID {item.id.slice(0, 6)}</Text>
                </View>

                <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.name || 'Evento senza nome'}
                </Text>

                <View style={styles.infoRow}>
                  <Feather name="calendar" size={14} color={theme.colors.muted} />
                  <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]} numberOfLines={1}>
                    {formatDate(item.date) || 'Data non disponibile'}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    onPress={() => {
                      try {
                        navigation.navigate('CreateEvent', { eventId: item.id });
                      } catch {
                        // ignore
                      }
                    }}
                    style={[styles.ghostAction, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Modifica ${item.name}`}
                  >
                    <Feather name="edit-2" size={14} color={theme.colors.text} />
                    <Text style={[styles.ghostActionText, { color: theme.colors.text }]}>Modifica</Text>
                  </TouchableOpacity>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => onDelete(item)}
                      disabled={deletingId === item.id}
                      style={[styles.deleteBtn, { borderColor: theme.colors.border, opacity: deletingId === item.id ? 0.6 : 1 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Elimina ${item.name}`}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Feather name="trash-2" size={15} color="#ef4444" />
                      )}
                    </TouchableOpacity>

                    <View style={[styles.openBtn, { borderColor: theme.colors.border }]}> 
                      <Feather name="chevron-right" size={16} color={theme.colors.muted} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                <Feather name="calendar" size={18} color={theme.colors.muted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nessun evento trovato</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.muted }]}>Prova a cambiare filtro o crea un nuovo evento.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  listContent: { paddingHorizontal: 18, paddingBottom: 120, paddingTop: 6 },
  listHeaderWrap: { marginBottom: 6, gap: 10 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    gap: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: "900", letterSpacing: -0.6 },
  subtitle: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: 4 },
  headerAction: {
    minWidth: 98,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerActionText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  summaryGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summaryCard: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  summaryLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  summaryValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  clearBtn: { padding: 6 },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    paddingRight: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  subtle: { fontSize: 12, fontWeight: '600' },
  error: { fontSize: 13, fontWeight: '700', textAlign: 'center', paddingHorizontal: 18 },
  retry: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginTop: 8 },
  retryText: { color: 'white', fontWeight: '800' },
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 10,
  },
  cardStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  cardHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  cardMeta: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  statusDot: { width: 7, height: 7, borderRadius: 999 },
  statusPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardTitle: { fontWeight: "800", fontSize: 17, letterSpacing: -0.2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardSubtitle: { fontSize: 12, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  ghostAction: {
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ghostActionText: { fontSize: 12, fontWeight: '700' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  openBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptySubtitle: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
