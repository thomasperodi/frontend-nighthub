import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { NavItem } from "../../components/BottomNav";
import { fetchAdminDashboard } from "../../services/admin";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import AdminDashboardTab from "./tabs/AdminDashboardTab";
import AdminVenuesTab from "./tabs/AdminVenuesTab";
import AdminUsersTab from "./tabs/AdminUsersTab";
import AdminReportsTab from "./tabs/AdminReportsTab";
import AdminProfileTab from "./tabs/AdminProfileTab";

type AdminTabKey = "dashboard" | "venues" | "users" | "reports" | "profile";

type HomeBadges = {
  contractsExpiringIn30d: number;
  alertsCount: number;
  newUsers30d: number;
};

const TAB_META: Record<AdminTabKey, { title: string; subtitle: string; icon: keyof typeof Feather.glyphMap }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Cabina di regia operativa in tempo reale.",
    icon: "activity",
  },
  venues: {
    title: "Locali",
    subtitle: "Contratti, piani e utilizzo del network.",
    icon: "map-pin",
  },
  users: {
    title: "Utenti",
    subtitle: "Ruoli, assegnazioni e stato accessi.",
    icon: "users",
  },
  reports: {
    title: "Report",
    subtitle: "Trend ricavi e performance periodo.",
    icon: "bar-chart-2",
  },
  profile: {
    title: "Profilo",
    subtitle: "Account admin e impostazioni di sicurezza.",
    icon: "shield",
  },
};

const NAV_ITEMS: Array<NavItem & { key: AdminTabKey }> = [
  { key: "dashboard", icon: "grid", label: "Dashboard" },
  { key: "venues", icon: "map-pin", label: "Locali" },
  { key: "users", icon: "users", label: "Utenti" },
  { key: "reports", icon: "bar-chart-2", label: "Report" },
  { key: "profile", icon: "user", label: "Profilo" },
];

export default function AdminHomeScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTabKey>("dashboard");
  const [badges, setBadges] = useState<HomeBadges | null>(null);
  const [loadingBadges, setLoadingBadges] = useState(false);

  const loadBadges = useCallback(async (asRefresh = false) => {
    setLoadingBadges(true);

    try {
      const dashboard = await fetchAdminDashboard({ force: asRefresh });
      setBadges({
        contractsExpiringIn30d: dashboard.metrics.contractsExpiringIn30d,
        alertsCount: dashboard.alerts.length,
        newUsers30d: dashboard.metrics.newUsers30d,
      });
    } catch {
      setBadges(null);
    } finally {
      setLoadingBadges(false);
    }
  }, []);

  useEffect(() => {
    void loadBadges(false);
  }, [loadBadges]);

  const navItems = useMemo(
    () =>
      NAV_ITEMS.map((item) => {
        if (!badges) return item;
        if (item.key === "dashboard") return { ...item, badgeCount: badges.alertsCount };
        if (item.key === "venues") return { ...item, badgeCount: badges.contractsExpiringIn30d };
        if (item.key === "users") return { ...item, badgeCount: badges.newUsers30d };
        return item;
      }),
    [badges],
  );

  const activeMeta = TAB_META[activeTab];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <View style={styles.titleWrap}>
          <View style={styles.eyebrowRow}>
            <Feather name={activeMeta.icon} size={13} color={theme.colors.primary} />
            <Text style={styles.eyebrow}>NIGHTHUB ADMIN</Text>
          </View>
          <Text style={styles.title}>{activeMeta.title}</Text>
          <Text style={styles.subtitle}>{activeMeta.subtitle}</Text>
        </View>

        <TouchableOpacity style={styles.syncButton} onPress={() => void loadBadges(true)} activeOpacity={0.85}>
          {loadingBadges ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <>
              <Feather name="refresh-cw" size={14} color={theme.colors.text} />
              <Text style={styles.syncText}>Sync</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === "dashboard" && <AdminDashboardTab onQuickAction={(tabKey: AdminTabKey) => setActiveTab(tabKey)} />}
        {activeTab === "venues" && <AdminVenuesTab />}
        {activeTab === "users" && <AdminUsersTab />}
        {activeTab === "reports" && <AdminReportsTab />}
        {activeTab === "profile" && <AdminProfileTab onLogout={signOut} />}
      </View>

      <BottomNav items={navItems} active={activeTab} onChange={(key) => setActiveTab(key as AdminTabKey)} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    topBar: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.08)",
      backgroundColor: "rgba(255,255,255,0.02)",
    },
    titleWrap: {
      flex: 1,
      gap: 3,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: "900",
      color: theme.colors.primary,
      letterSpacing: 0.7,
    },
    title: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    syncButton: {
      minHeight: 38,
      minWidth: 78,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      backgroundColor: "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 10,
    },
    syncText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: "800",
    },
    content: {
      flex: 1,
    },
  });
