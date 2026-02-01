import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import FilterModal from "../../components/FilterModal";
import { getUserPromos } from "../../services/userPromos";
import { useTheme } from "../../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { NavItem } from "../../components/BottomNav";
import { useAuth } from "../../providers/AuthProvider";

// Importar os novos componentes
import HomeTab from "./tabs/HomeTab";
import ProfileTab from "./tabs/ProfileTab";
import FriendsTab from "./tabs/FriendsTab";
import MapTab from "./tabs/MapTab";

export default function ClientHomeScreen({ route }: any) {
  const { theme, toggleTheme, isDark } = useTheme();
  const navigation: any = useNavigation();

  // Estado para Home Tab
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ categories: [] as string[], onlyMyPromos: false, promoTypes: [] as string[] });
  const [currentTab, setCurrentTab] = useState("home");
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
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

  useEffect(() => {
    if (route?.params?.promoFilter) {
      setPromoFilter(route.params.promoFilter);
    }
  }, [route?.params?.promoFilter]);

  const toggleSort = () => setSortOrder((s) => (s === 'none' ? 'asc' : s === 'asc' ? 'desc' : 'none'));

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.greeting, { color: theme.colors.text }]}>Scopri le migliori serate</Text>
        <TouchableOpacity onPress={toggleTheme} accessibilityRole="button" style={styles.themeBtn}>
          <Feather name={isDark ? "moon" : "sun"} size={18} color={theme.colors.muted} />
        </TouchableOpacity>
      </View>

      {currentTab === "home" && (
        <HomeTab
          query={query}
          onQueryChange={setQuery}
          onOpenFilters={() => setFiltersOpen(true)}
          filters={filters}
          userPromos={userPromos}
          promoFilter={promoFilter}
          sortOrder={sortOrder}
          viewMode={viewMode}
          onToggleSort={toggleSort}
          onToggleViewMode={setViewMode}
          onPromoFilterChange={setPromoFilter}
          onFiltersChange={setFilters}
          onEventPress={(item) => navigation.navigate('EventDetail', { item })}
          onPromoPress={(promo) => navigation.navigate('PromoDetail', { promo })}
          navigation={navigation}
        />
      )}

      {currentTab === "profile" && <ProfileTab navigation={navigation} />}
      {currentTab === "friends" && <FriendsTab />}
      {currentTab === "map" && <MapTab onEventPress={(item) => navigation.navigate('EventDetail', { item })} />}

      <FilterModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onApply={(f: any) => setFilters(f)}
        initial={filters}
      />

      <BottomNav items={clientItems} active={currentTab} onChange={setCurrentTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 18, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { fontSize: 18, fontWeight: "700" },
  themeBtn: { padding: 8, borderRadius: 10 },
});
