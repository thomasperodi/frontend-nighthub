import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import EventCard from "../../../components/EventCard";
import TileEventCard from "../../../components/TileEventCard";
import CompactEventCard from "../../../components/CompactEventCard";
import SearchBar from "../../../components/SearchBar";
import FeaturedCarousel from "../../../components/FeaturedCarousel";
import { useTheme } from "../../../theme/ThemeProvider";
import { useEvents } from "../../../hooks/useEvents";
import { usePromos } from "../../../hooks/usePromos";
import { useVenues } from "../../../hooks/useVenues";
import type { Event as ApiEvent, Promo as ApiPromo, Venue as ApiVenue } from "../../../types/events";

interface HomeTabProps {
  query: string;
  onQueryChange: (q: string) => void;
  onOpenFilters: () => void;
  filters: any;
  userPromos: string[];
  promoFilter: string | null;
  sortOrder: 'none' | 'asc' | 'desc';
  viewMode: 'list' | 'grid' | 'compact';
  onToggleSort: () => void;
  onToggleViewMode: (mode: 'list' | 'grid' | 'compact') => void;
  onPromoFilterChange: (id: string | null) => void;
  onFiltersChange: (f: any) => void;
  onEventPress: (item: any) => void;
  onPromoPress: (promo: any) => void;
  navigation: any;
}

export default function HomeTab({
  query,
  onQueryChange,
  onOpenFilters,
  filters,
  userPromos,
  promoFilter,
  sortOrder,
  viewMode,
  onToggleSort,
  onToggleViewMode,
  onPromoFilterChange,
  onFiltersChange,
  onEventPress,
  onPromoPress,
  navigation,
}: HomeTabProps) {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: eventsData,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useEvents();

  const {
    data: promosData,
    loading: promosLoading,
    error: promosError,
    refetch: refetchPromos,
  } = usePromos();

  const {
    data: venuesData,
    loading: venuesLoading,
    error: venuesError,
    refetch: refetchVenues,
  } = useVenues();

  type UiPromo = {
    id: string;
    title: string;
    details: string;
    discount: string;
    until: string;
    image: string;
    _raw?: ApiPromo;
  };

  type UiEvent = {
    id: string;
    title: string;
    date: string;
    time: string;
    venue: string;
    city: string;
    tags: string[];
    promos: UiPromo[];
    image: string;
    _raw?: ApiEvent;
  };

  const fallbackImage = (seed: string) =>
    `https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3&s=${encodeURIComponent(seed)}`;

  const formatShortDate = (value?: string) => {
    if (!value) return '';
    const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
    if (Number.isNaN(d.getTime())) return value;
    const s = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    const parts = s.split(' ');
    if (parts.length >= 2) {
      parts[1] = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    }
    return parts.join(' ');
  };

  const formatTime = (start?: string, end?: string) => {
    const clean = (t?: string) => {
      if (!t) return '';
      // already HH:MM or HH:MM:SS
      if (/^\d{2}:\d{2}/.test(t)) return t.slice(0, 5);
      const d = new Date(t);
      if (!Number.isNaN(d.getTime())) {
        try {
          return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        } catch {
          return d.toISOString().slice(11, 16);
        }
      }
      return '';
    };

    const s = clean(start);
    const e = clean(end);
    if (s && e) return `${s}-${e}`;
    return s || e || '';
  };

  const formatDiscount = (p: ApiPromo) => {
    const type = (p.discount_type || '').toLowerCase();
    const value = p.discount_value;
    if (type === 'percentage' && typeof value === 'number') return `${value}%`;
    if (type === 'fixed' && typeof value === 'number') return `€${value}`;
    if (type === 'free') return 'Gratis';
    return 'Offerta';
  };

  const promosUi = useMemo<UiPromo[]>(() => {
    const list = promosData ?? [];
    const events = eventsData ?? [];
    const venues = venuesData ?? [];
    const eventById = new Map(events.map((e) => [e.id, e] as const));
    const venueById = new Map(venues.map((v) => [v.id, v] as const));

    const mapped = list.map((p) => {
      const event = p.event_id ? eventById.get(p.event_id) : undefined;
      const venue = p.venue_id ? venueById.get(p.venue_id) : (event?.venue_id ? venueById.get(event.venue_id) : undefined);
      const img = (event as any)?.image || (venue as any)?.image || fallbackImage(p.id);
      const untilRaw = (p as any).validUntil || p.valid_to || (p as any).validUntil || p.validUntil;
      const until = formatShortDate(untilRaw) || formatShortDate(event?.date) || '';
      return {
        id: p.id,
        title: p.title,
        details: p.details || p.description || '',
        discount: formatDiscount(p),
        until,
        image: img,
        _raw: p,
      };
    });

    // de-dup by id
    const seen = new Set<string>();
    return mapped.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [promosData, eventsData, venuesData]);

  const eventsUi = useMemo<UiEvent[]>(() => {
    const events = eventsData ?? [];
    const allPromos = promosData ?? [];
    const venues: ApiVenue[] = venuesData ?? [];
    const venueById = new Map(venues.map((v) => [v.id, v] as const));

    // index promos by event_id and venue_id for enrichment
    const promosByEvent = new Map<string, ApiPromo[]>();
    const promosByVenue = new Map<string, ApiPromo[]>();
    for (const p of allPromos) {
      if (p.event_id) promosByEvent.set(p.event_id, [...(promosByEvent.get(p.event_id) ?? []), p]);
      if (p.venue_id) promosByVenue.set(p.venue_id, [...(promosByVenue.get(p.venue_id) ?? []), p]);
    }

    const mapPromo = (p: ApiPromo, event?: ApiEvent, venue?: ApiVenue): UiPromo => {
      const img = (event as any)?.image || (venue as any)?.image || fallbackImage(p.id);
      const untilRaw = (p as any).validUntil || p.valid_to || (p as any).validUntil || p.validUntil;
      const until = formatShortDate(untilRaw) || formatShortDate(event?.date) || '';
      return {
        id: p.id,
        title: p.title,
        details: p.details || p.description || '',
        discount: formatDiscount(p),
        until,
        image: img,
        _raw: p,
      };
    };

    return events.map((e) => {
      const venue = e.venue_id ? venueById.get(e.venue_id) : undefined;
      const mergedPromos: ApiPromo[] = [
        ...(e.promos ?? []),
        ...(promosByEvent.get(e.id) ?? []),
        ...(e.venue_id ? (promosByVenue.get(e.venue_id) ?? []) : []),
      ];
      const uniquePromos = Array.from(new Map(mergedPromos.map((p) => [p.id, p] as const)).values());
      const tags = (e.tags && e.tags.length ? e.tags : ['Serata']).map((t) => String(t));
      return {
        id: e.id,
        title: e.name,
        date: formatShortDate(e.date),
        time: formatTime(e.start_time, e.end_time),
        venue: (venue as any)?.name || e.venue_id || 'Locale',
        city: (venue as any)?.city || '',
        tags,
        promos: uniquePromos.map((p) => mapPromo(p, e, venue)),
        image: (e as any).image || (venue as any)?.image || fallbackImage(e.id),
        _raw: e,
      };
    });
  }, [eventsData, promosData, venuesData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = eventsUi.filter((e) => {
      if (filters.categories.length && !filters.categories.some((c: string) => e.tags.includes(c))) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        e.tags.join(" ").toLowerCase().includes(q)
      );
    });

    if (sortOrder === 'asc') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === 'desc') {
      list = [...list].sort((a, b) => b.title.localeCompare(a.title));
    }

    if (promoFilter) {
      list = list.filter((e) => e.promos && e.promos.some((p: any) => p.id === promoFilter));
    }

    if (filters.onlyMyPromos) {
      const userSet = new Set(userPromos);
      list = list.filter((e) => e.promos && e.promos.some((p: any) => userSet.has(p.id)));
    }

    if (filters.promoTypes && filters.promoTypes.length) {
      const typeSet = new Set(filters.promoTypes);
      list = list.filter((e) => e.promos && e.promos.some((p: any) => typeSet.has(p.title)));
    }
    return list;
  }, [query, filters, sortOrder, promoFilter, userPromos, eventsUi]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvents(), refetchPromos(), refetchVenues()]);
    } finally {
      // small delay to avoid flicker
      await new Promise((res) => setTimeout(res, 250));
    }
    setRefreshing(false);
  };

  const ListHeader = () => {
    const promoVenueSet = new Set<string>();
    const promoMatchEvents = eventsUi.filter((e) => {
      if (promoFilter) return e.promos && e.promos.some((p: any) => p.id === promoFilter);
      if (filters.promoTypes && filters.promoTypes.length) return e.promos && e.promos.some((p: any) => filters.promoTypes.includes(p.title));
      return false;
    });
    promoMatchEvents.forEach((e) => promoVenueSet.add(e.venue));
    const promoVenues = Array.from(promoVenueSet);

    return (
      <View>
        {promosUi.length ? (
          <View style={{ paddingVertical: 16 }}>
            <FeaturedCarousel data={promosUi} onPress={(p: any) => onPromoPress(p)} />
          </View>
        ) : null}

        {promoFilter ? (
          (() => {
            const activePromo = promosUi.find((x) => x.id === promoFilter);
            return (
              <View style={{ paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: theme.colors.text }}>Filtrato per offerta</Text>
                  <Text style={{ color: theme.colors.muted }}>{activePromo?.title}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    onPromoFilterChange(null);
                    try { navigation.setParams?.({ promoFilter: undefined }); } catch (e) { }
                  }}
                  accessibilityRole="button"
                  style={{ padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border }}
                >
                  <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Annulla</Text>
                </TouchableOpacity>
              </View>
            );
          })()
        ) : null}

        {filters.promoTypes && filters.promoTypes.length ? (
          <View style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontWeight: '700', color: theme.colors.text }}>Filtrato per tipo di promozione</Text>
                <Text style={{ color: theme.colors.muted }}>{filters.promoTypes.join(', ')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => onFiltersChange((f: any) => ({ ...f, promoTypes: [] }))}
                accessibilityRole="button"
                style={{ padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border }}
              >
                <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Annulla</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 8 }}>
              <Text style={{ fontWeight: '700', color: theme.colors.text }}>Locali con queste promozioni</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {promoVenues.length ? promoVenues.map((v) => (
                  <View key={v} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.colors.card, borderRadius: 18, marginRight: 8, marginBottom: 8 }}>
                    <Text style={{ color: theme.colors.text }}>{v}</Text>
                  </View>
                )) : <Text style={{ color: theme.colors.muted }}>Nessun locale trovato per queste promozioni</Text>}
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <SearchBar value={query} onChange={onQueryChange} onOpenFilters={onOpenFilters} />

        {(eventsLoading || promosLoading || venuesLoading) && !eventsUi.length ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: theme.colors.muted }}>Caricamento eventi…</Text>
          </View>
        ) : null}

        {(eventsError || promosError || venuesError) ? (
          <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, marginTop: 10 }}>
            <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Errore nel caricamento</Text>
            <Text style={{ color: theme.colors.muted, marginTop: 4 }} numberOfLines={3}>
              {eventsError || promosError || venuesError}
            </Text>
            <TouchableOpacity
              onPress={() => onRefresh()}
              accessibilityRole="button"
              style={{ marginTop: 10, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: theme.colors.primary }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.resultsRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.resultsText, { color: theme.colors.muted }]}>{filtered.length} risultati</Text>
            {filters.onlyMyPromos && (
              <View style={{ marginLeft: 8, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: theme.colors.primary, borderRadius: 12 }}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Con le mie offerte</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.viewBtn, { backgroundColor: viewMode === 'list' ? theme.colors.primary + '22' : 'transparent' }]}
              onPress={() => onToggleViewMode('list')}
            >
              <Feather name="list" size={16} color={viewMode === 'list' ? theme.colors.primary : theme.colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewBtn, { backgroundColor: viewMode === 'grid' ? theme.colors.primary + '22' : 'transparent' }]}
              onPress={() => onToggleViewMode('grid')}
            >
              <Feather name="grid" size={16} color={viewMode === 'grid' ? theme.colors.primary : theme.colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sortBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card, marginLeft: 8 }]}
              accessibilityRole="button"
              onPress={onToggleSort}
            >
              {sortOrder === 'asc' && <Feather name="chevron-up" size={16} color={theme.colors.primary} />}
              {sortOrder === 'desc' && <Feather name="chevron-down" size={16} color={theme.colors.primary} />}
              {sortOrder === 'none' && <Feather name="shuffle" size={16} color={theme.colors.muted} />}
              <Text style={[styles.sortText, { color: sortOrder === 'none' ? theme.colors.muted : theme.colors.primary }]}>
                {' '}{sortOrder === 'asc' ? 'A → Z' : sortOrder === 'desc' ? 'Z → A' : 'Ordina'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={{ color: theme.colors.muted, marginTop: 8 }}>
          Ordinamento: {sortOrder === 'none' ? 'Nessuno' : sortOrder === 'asc' ? 'A → Z' : 'Z → A'}
        </Text>
      </View>

      {viewMode === 'list' && (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <EventCard item={item} onPress={(it: any) => onEventPress(it)} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={ListHeader}
          ListHeaderComponentStyle={{ paddingBottom: 12 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nessun evento trovato</Text>
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Prova a modificare i filtri o la ricerca</Text>
            </View>
          )}
        />
      )}

      {viewMode === 'grid' && (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <TileEventCard item={item} onPress={(it: any) => onEventPress(it)} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={ListHeader}
          ListHeaderComponentStyle={{ paddingBottom: 12 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          numColumns={2}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nessun evento trovato</Text>
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Prova a modificare i filtri o la ricerca</Text>
            </View>
          )}
        />
      )}

      {viewMode === 'compact' && (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <CompactEventCard item={item} onPress={(it: any) => onEventPress(it)} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={ListHeader}
          ListHeaderComponentStyle={{ paddingBottom: 12 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nessun evento trovato</Text>
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Prova a modificare i filtri o la ricerca</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: { paddingHorizontal: 18, paddingBottom: 8 },
  resultsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, marginTop: 6 },
  resultsText: { fontSize: 13 },
  sortBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  sortText: { marginLeft: 8, fontWeight: "600" },
  viewBtn: { padding: 8, borderRadius: 8, marginRight: 8 },
  empty: { padding: 28, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptyText: { },
});
