import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, TextInput, Alert } from "react-native";
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
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Eventi</Text>
        <TouchableOpacity
          onPress={() => {
            try {
              navigation.navigate('CreateEvent');
            } catch {
              // route might not exist in current navigator
            }
          }}
        >
          <Feather name="plus" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
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
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <Feather name="x" size={16} color={theme.colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filtersRow}>
        {(
          [
            { key: 'all' as const, label: 'Tutti' },
            { key: 'live' as const, label: 'Live' },
            { key: 'upcoming' as const, label: 'Futuri' },
            { key: 'past' as const, label: 'Passati' },
            { key: 'draft' as const, label: 'Bozze' },
            { key: 'closed' as const, label: 'Chiusi' },
          ] satisfies Array<{ key: QuickFilter; label: string }>
        ).map((chip) => {
          const active = filter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => setFilter(chip.key)}
              style={[
                styles.filterChip,
                { borderColor: theme.colors.border },
                active && { borderColor: theme.colors.primary, backgroundColor: 'rgba(109,91,255,0.12)' },
              ]}
            >
              <Text style={[styles.filterChipText, { color: active ? theme.colors.primary : theme.colors.text }]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.card, { borderColor: theme.colors.border }]}
              onPress={() => {
                // Optional: allow parent (VenueHome) to jump directly to reservations
                try {
                  onSelectEvent?.(item);
                } catch {
                  // ignore
                }
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>{formatDate(item.date)} • {formatStatus(item.status)}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => {
                    try {
                      navigation.navigate('CreateEvent', { eventId: item.id });
                    } catch {
                      // ignore
                    }
                  }}
                  style={[styles.editBtn, { borderColor: theme.colors.border }]}
                >
                  <Feather name="edit-2" size={16} color={theme.colors.text} />
                </TouchableOpacity>

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
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  )}
                </TouchableOpacity>

                <Feather name="chevron-right" size={18} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[styles.subtle, { color: theme.colors.muted }]}>Nessun evento</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "800" },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '700',
  },
  clearBtn: { padding: 6 },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipText: { fontSize: 12, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  subtle: { fontSize: 12, fontWeight: '600' },
  error: { fontSize: 13, fontWeight: '700', textAlign: 'center', paddingHorizontal: 18 },
  retry: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginTop: 8 },
  retryText: { color: 'white', fontWeight: '800' },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardTitle: { color: "white", fontWeight: "700" },
  cardSubtitle: { color: "#CFC6FF", marginTop: 4 },
});
