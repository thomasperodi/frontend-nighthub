import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from '@react-navigation/native';
import { getUserPromos } from "../../services/userPromos";
import { useTheme } from "../../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { NavItem } from "../../components/BottomNav";
import { listFriendRequests } from "../../services/friends";
import { listIncomingTableInvitations } from "../../services/reservations";

// Importar os novos componentes
import HomeTab from "./tabs/HomeTab";
import ProfileTab from "./tabs/ProfileTab";
import FriendsTab from "./tabs/FriendsTab";
import MapTab from "./tabs/MapTab";

export default function ClientHomeScreen({ route }: any) {
  const { theme, toggleTheme, isDark } = useTheme();
  const navigation: any = useNavigation();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ categories: [] as string[], onlyMyPromos: false, promoTypes: [] as string[] });
  const [currentTab, setCurrentTab] = useState("home");
  const [promoFilter, setPromoFilter] = useState<string | null>(null);
  const [userPromos, setUserPromos] = useState<string[]>([]);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const clientItems: NavItem[] = [
    { key: "home", icon: "home", label: "Home" },
    { key: "friends", icon: "users", label: "Amici", badgeCount: pendingFriendRequests },
    { key: "map", icon: "map", label: "Mappa" },
    { key: "profile", icon: "user", label: "Profilo" },
  ];

  const refreshPendingFriendRequests = async () => {
    try {
      const [requests, invitations] = await Promise.all([
        listFriendRequests(),
        listIncomingTableInvitations(),
      ]);
      const pendingInvitations = invitations.filter((item) => item.invitation_status === "pending").length;
      setPendingFriendRequests(requests.incoming.length + pendingInvitations);
    } catch {
      setPendingFriendRequests(0);
    }
  };


  useEffect(() => {
    (async () => {
      const p = await getUserPromos();
      setUserPromos(p && p.length ? p : []);
    })();

    refreshPendingFriendRequests();
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
    const requestedTab = route?.params?.openTab;
    if (
      requestedTab === "home" ||
      requestedTab === "friends" ||
      requestedTab === "map" ||
      requestedTab === "profile"
    ) {
      setCurrentTab(requestedTab);
    }
  }, [route?.params?.openTab]);

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

  useEffect(() => {
    if (currentTab === "friends") {
      refreshPendingFriendRequests();
    }
  }, [currentTab]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  const getHeaderContent = () => {
    switch (currentTab) {
      case "home":
        return { title: getGreeting(), subtitle: "Scopri le migliori serate" };
      case "friends":
        return { title: "Amici", subtitle: "Le tue connessioni" };
      case "map":
        return { title: "Mappa", subtitle: "Serate vicino a te" };
      case "profile":
        return { title: "Profilo", subtitle: "Il tuo account" };
      default:
        return { title: getGreeting(), subtitle: "" };
    }
  };

  const headerContent = getHeaderContent();
  const gradientColors: [string, string] = isDark
    ? ["#16103A", "#0B0B0B"]
    : ["#EDE9FF", "#F7F7FB"];
  const showTopHeader = currentTab !== "home";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {showTopHeader ? (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { borderBottomColor: theme.colors.border }]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTextBlock}>
              <Text style={[styles.greeting, { color: theme.colors.text }]}>{headerContent.title}</Text>
              <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{headerContent.subtitle}</Text>
            </View>
            <TouchableOpacity
              onPress={toggleTheme}
              accessibilityRole="button"
              style={[styles.themeBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", borderColor: theme.colors.border }]}
              activeOpacity={0.7}
            >
              <Feather name={isDark ? "moon" : "sun"} size={17} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      ) : null}

      <Animated.View style={[styles.tabContent, { opacity: fadeAnim }]}>
        {currentTab === "home" && (
          <HomeTab
            query={query}
            onQueryChange={setQuery}
            filters={filters}
            userPromos={userPromos}
            promoFilter={promoFilter}
            onPromoFilterChange={setPromoFilter}
            onFiltersChange={setFilters}
            onEventPress={(item) => navigation.navigate('EventDetail', { item })}
            onPromoPress={(promo) => navigation.navigate('PromoDetail', { promo })}
            onToggleTheme={toggleTheme}
            isDark={isDark}
          />
        )}

        {currentTab === "profile" && <ProfileTab navigation={navigation} />}
        {currentTab === "friends" && (
          <FriendsTab onPendingRequestsChange={setPendingFriendRequests} />
        )}

        <View
          pointerEvents={currentTab === "map" ? "auto" : "none"}
          style={[
            styles.persistentMapLayer,
            currentTab === "map" ? styles.persistentMapVisible : styles.persistentMapHidden,
          ]}
        >
          <MapTab
            isActive={currentTab === "map"}
            onEventPress={(item) => navigation.navigate('EventDetail', { item })}
          />
        </View>
      </Animated.View>

      <BottomNav items={clientItems} active={currentTab} onChange={setCurrentTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTextBlock: {
    flex: 1,
    marginRight: 12,
  },
  greeting: { fontSize: 26, fontWeight: "800", marginBottom: 2, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: "500", opacity: 0.8 },
  themeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabContent: { flex: 1 },
  persistentMapLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  persistentMapVisible: {
    opacity: 1,
    zIndex: 2,
  },
  persistentMapHidden: {
    opacity: 0,
    zIndex: -1,
  },
});
