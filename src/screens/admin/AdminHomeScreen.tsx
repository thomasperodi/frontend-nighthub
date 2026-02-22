import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { NavItem } from "../../components/BottomNav";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import AdminVenuesTab from "./tabs/AdminVenuesTab";
import AdminReportsTab from "./tabs/AdminReportsTab";
import AdminProfileTab from "./tabs/AdminProfileTab";

const AdminDashboardTab = require("./tabs/AdminDashboardTab").default;
const AdminUsersTab = require("./tabs/AdminUsersTab").default;

type AdminTabKey = "dashboard" | "venues" | "users" | "reports" | "profile";

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

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Admin</Text>
          <Text style={styles.title}>Control Panel</Text>
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === "dashboard" && <AdminDashboardTab />}
        {activeTab === "venues" && <AdminVenuesTab />}
        {activeTab === "users" && <AdminUsersTab />}
        {activeTab === "reports" && <AdminReportsTab />}
        {activeTab === "profile" && <AdminProfileTab onLogout={signOut} />}
      </View>

      <BottomNav items={NAV_ITEMS} active={activeTab} onChange={(key) => setActiveTab(key as AdminTabKey)} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  title: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.text,
  },
  content: {
    flex: 1,
  },
});
