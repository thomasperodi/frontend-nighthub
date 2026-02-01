import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { NavItem } from "../../components/BottomNav";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import AdminDashboardTab from "./tabs/AdminDashboardTab";
import AdminVenuesTab from "./tabs/AdminVenuesTab";
import AdminUsersTab from "./tabs/AdminUsersTab";
import AdminReportsTab from "./tabs/AdminReportsTab";
import AdminProfileTab from "./tabs/AdminProfileTab";

const NAV_ITEMS: NavItem[] = [
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
  const [activeTab, setActiveTab] = useState<NavItem["key"]>("dashboard");

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.content}>
        {activeTab === "dashboard" && <AdminDashboardTab />}
        {activeTab === "venues" && <AdminVenuesTab />}
        {activeTab === "users" && <AdminUsersTab />}
        {activeTab === "reports" && <AdminReportsTab />}
        {activeTab === "profile" && <AdminProfileTab onLogout={signOut} />}
      </View>
      <BottomNav items={NAV_ITEMS} active={activeTab} onChange={setActiveTab} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
});
