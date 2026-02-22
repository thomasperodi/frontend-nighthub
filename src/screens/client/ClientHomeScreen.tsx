import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
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
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

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
    if (userPromos.length === 0) {
      setPromoFilter(null);
      setFilters((prev) => ({ ...prev, onlyMyPromos: false, promoTypes: [] }));
    }
  }, [userPromos.length]);

  useEffect(() => {
    if (route?.params?.promoFilter) {
      setPromoFilter(route.params.promoFilter);
    }
  }, [route?.params?.promoFilter]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentTab]);

  const toggleSort = () => setSortOrder((s) => (s === 'none' ? 'asc' : s === 'asc' ? 'desc' : 'none'));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>{getGreeting()}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Scopri le migliori serate</Text>
          </View>
          <TouchableOpacity 
            onPress={toggleTheme} 
            accessibilityRole="button" 
            style={[styles.themeBtn, { backgroundColor: theme.colors.card }]}
            activeOpacity={0.7}
          >
            <Feather name={isDark ? "moon" : "sun"} size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

      </View>

      <Animated.View style={[styles.tabContent, { opacity: fadeAnim }]}>
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
      </Animated.View>

      <FilterModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onApply={(f: any) => setFilters(f)}
        initial={filters}
        enablePromoFilters={userPromos.length > 0}
      />

      <BottomNav items={clientItems} active={currentTab} onChange={setCurrentTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    paddingBottom: 16, 
    borderBottomWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: { fontSize: 24, fontWeight: "800", marginBottom: 2 },
  subtitle: { fontSize: 14, fontWeight: "500" },
  themeBtn: { 
    padding: 10, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabContent: { flex: 1 },
});
