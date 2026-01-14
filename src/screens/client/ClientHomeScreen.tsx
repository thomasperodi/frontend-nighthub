import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import EventCard from "../../components/EventCard";
import TileEventCard from "../../components/TileEventCard";
import CompactEventCard from "../../components/CompactEventCard";
import SearchBar from "../../components/SearchBar";
import FilterModal from "../../components/FilterModal";
// import BottomNav from "./BottomNavClient";
import FeaturedCarousel from "../../components/FeaturedCarousel";
import { MOCK_EVENTS } from "../../data/mockEvents";
import { MOCK_PROMOS } from "../../data/mockPromos";
import { getUserPromos } from "../../services/userPromos";
import { useTheme } from "../../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { NavItem } from "../../components/BottomNav";
import { useAuth } from "../../providers/AuthProvider";
import { deleteAccountApi } from "../../services/auth";

export default function ClientHomeScreen({ route }: any) {
  const { theme, toggleTheme, isDark } = useTheme();
  const navigation: any = useNavigation();
  const [query, setQuery] = useState("");
  const { signOut } = useAuth();

  const confirmDelete = () => {
    Alert.alert('Elimina account', 'Sei sicuro di voler eliminare il tuo account? Questa azione è irreversibile.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try {
          await deleteAccountApi();
          Alert.alert('Account eliminato', 'Il tuo account è stato eliminato con successo.');
          await signOut();
        } catch (err: any) {
          console.error(err);
          Alert.alert('Errore', err?.response?.data?.message || 'Impossibile eliminare l\'account. Riprova.');
        }
      }}
    ]);
  };

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ categories: [] as string[], onlyMyPromos: false, promoTypes: [] as string[] });
  // const [activeTab, setActiveTab] = useState("home");
  const [currentTab, setCurrentTab] = useState("home");
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');

  const toggleSort = () => setSortOrder((s) => (s === 'none' ? 'asc' : s === 'asc' ? 'desc' : 'none'));

  const [refreshing, setRefreshing] = useState(false);
  const [promoFilter, setPromoFilter] = useState<string | null>(null);
  const [userPromos, setUserPromos] = useState<string[]>([]);

  const clientItems: NavItem[] = [
  { key: "home", icon: "home", label: "Home" },
  { key: "friends", icon: "users", label: "Amici" },
  { key: "map", icon: "map", label: "Mappa" },
  { key: "profile", icon: "user", label: "Profilo" },
];

  useEffect(() => {
    (async () => {
      const p = await getUserPromos();
      setUserPromos(p && p.length ? p : []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = MOCK_EVENTS.filter((e) => {
      if (filters.categories.length && !filters.categories.some((c) => e.tags.includes(c))) return false;
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
      // keep only events that have at least one promo that belongs to the current user
      const userSet = new Set(userPromos);
      list = list.filter((e) => e.promos && e.promos.some((p: any) => userSet.has(p.id)));
    }

    if (filters.promoTypes && filters.promoTypes.length) {
      const typeSet = new Set(filters.promoTypes);
      list = list.filter((e) => e.promos && e.promos.some((p: any) => typeSet.has(p.title)));
    }
    return list;
  }, [query, filters, sortOrder, promoFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    // simulate fetch
    await new Promise((res) => setTimeout(res, 800));
    setRefreshing(false);
  };

  useEffect(() => {
    if (route?.params?.promoFilter) {
      setPromoFilter(route.params.promoFilter);
    }
  }, [route?.params?.promoFilter]);

  const ListHeader = () => {
    // compute venues matching current promo filters
    const promoVenueSet = new Set<string>();
    const promoMatchEvents = MOCK_EVENTS.filter((e) => {
      if (promoFilter) return e.promos && e.promos.some((p: any) => p.id === promoFilter);
      if (filters.promoTypes && filters.promoTypes.length) return e.promos && e.promos.some((p:any) => filters.promoTypes.includes(p.title));
      return false;
    });
    promoMatchEvents.forEach((e) => promoVenueSet.add(e.venue));
    const promoVenues = Array.from(promoVenueSet);

    return (
      <View>
        {MOCK_PROMOS.length ? (
          <View style={{ paddingVertical: 16 }}>
            <FeaturedCarousel data={MOCK_PROMOS} onPress={(p: any) => navigation.navigate('PromoDetail', { promo: p })} />
          </View>
        ) : null}

        {promoFilter ? (
          (() => {
            const activePromo = MOCK_PROMOS.find((x) => x.id === promoFilter);
            return (
              <View style={{ paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: theme.colors.text }}>Filtrato per offerta</Text>
                  <Text style={{ color: theme.colors.muted }}>{activePromo?.title}</Text>
                </View>

                <TouchableOpacity onPress={() => { setPromoFilter(null); try { navigation.setParams?.({ promoFilter: undefined }); } catch(e){} }} accessibilityRole="button" style={{ padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border }}>
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
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, promoTypes: [] }))} accessibilityRole="button" style={{ padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border }}>
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

  const renderHome = () => (
    <View style={{ flex: 1 }}>
      {/* Promos and search are rendered as part of each list's header so they scroll naturally with the content */}

      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
        <SearchBar value={query} onChange={setQuery} onOpenFilters={() => setFiltersOpen(true)} />
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
              onPress={() => setViewMode('list')}
            >
              <Feather name="list" size={16} color={viewMode === 'list' ? theme.colors.primary : theme.colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewBtn, { backgroundColor: viewMode === 'grid' ? theme.colors.primary + '22' : 'transparent' }]}
              onPress={() => setViewMode('grid')}
            >
              <Feather name="grid" size={16} color={viewMode === 'grid' ? theme.colors.primary : theme.colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sortBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card, marginLeft: 8 }]}
              accessibilityRole="button"
              onPress={toggleSort}
            >
              {sortOrder === 'asc' && <Feather name="chevron-up" size={16} color={theme.colors.primary} />}
              {sortOrder === 'desc' && <Feather name="chevron-down" size={16} color={theme.colors.primary} />}
              {sortOrder === 'none' && <Feather name="shuffle" size={16} color={theme.colors.muted} />}
              <Text style={[styles.sortText, { color: sortOrder === 'none' ? theme.colors.muted : theme.colors.primary }]}> {sortOrder === 'asc' ? 'A → Z' : sortOrder === 'desc' ? 'Z → A' : 'Ordina'}</Text>
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
          renderItem={({ item }) => <EventCard item={item} onPress={(it: any) => navigation.navigate('EventDetail', { item: it })} />}
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
          renderItem={({ item }) => <TileEventCard item={item} onPress={(it: any) => navigation.navigate('EventDetail', { item: it })} />}
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
          renderItem={({ item }) => <CompactEventCard item={item} onPress={(it: any) => navigation.navigate('EventDetail', { item: it })} />}
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

  const renderProfile = () => (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ padding: 18 }}>
        <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>Il tuo profilo</Text>
        <Text style={[styles.placeholderText, { color: theme.colors.muted }]}>Informazioni account, preferiti e impostazioni.</Text>

        <View style={{ height: 12 }} />
        <TouchableOpacity style={[{ padding: 12, backgroundColor: theme.colors.primary, borderRadius: 10 }]} onPress={() => navigation.navigate('Reservations')}>
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Le mie prenotazioni</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />
        <TouchableOpacity style={[{ padding: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 }]} onPress={() => signOut()}>
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Esci</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />
        <TouchableOpacity style={[{ padding: 12, backgroundColor: '#FF4D4F', borderRadius: 10 }]} onPress={() => confirmDelete()}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Elimina account</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 18 }}>
        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>Versione app 1.0.0</Text>
      </View>
    </View>
  );

  const renderFriends = () => (
    <View style={styles.placeholder}>
      <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>Amici</Text>
      <Text style={[styles.placeholderText, { color: theme.colors.muted }]}>Vedi cosa fanno i tuoi amici e invita a eventi.</Text>
    </View>
  );

  const renderMap = () => (
    <View style={styles.placeholder}>
      <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>Mappa</Text>
      <Text style={[styles.placeholderText, { color: theme.colors.muted }]}>Visualizza eventi sulla mappa (prossimamente).</Text>
    </View>
  );

  return (
    <SafeAreaView
  style={[styles.container, { backgroundColor: theme.colors.background }]}
  edges={['top']}
>  
      <View style={[styles.header, { borderBottomColor: theme.colors.border }] }>
        <Text style={[styles.greeting, { color: theme.colors.text }]}> Scopri le migliori serate</Text>
        <TouchableOpacity onPress={toggleTheme} accessibilityRole="button" style={styles.themeBtn}>
          <Feather name={isDark ? "moon" : "sun"} size={18} color={theme.colors.muted} />
        </TouchableOpacity>
      </View>

      {currentTab === "home" && renderHome()}
      {currentTab === "profile" && renderProfile()}
      {currentTab === "friends" && renderFriends()}
      {currentTab === "map" && renderMap()}

      <FilterModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onApply={(f: any) => setFilters(f)}
        initial={filters}
      />

      {/* <BottomNav active={activeTab} onChange={setActiveTab} /> */}
      <BottomNav items={clientItems} active={currentTab} onChange={setCurrentTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 18, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { fontSize: 18, fontWeight: "700" },
  themeBtn: { padding: 8, borderRadius: 10 },
  searchContainer: { paddingHorizontal: 18, paddingBottom: 8 },
  resultsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, marginTop: 6 },
  resultsText: { fontSize: 13 },
  sortBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  sortText: { marginLeft: 8, fontWeight: "600" },
  viewBtn: { padding: 8, borderRadius: 8, marginRight: 8 },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  placeholderTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  placeholderText: {  },
  empty: { padding: 28, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptyText: {  },
});
