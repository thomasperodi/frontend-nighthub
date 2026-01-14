import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import BottomNav, { NavItem } from "../../components/BottomNav";
import { useState } from "react";

import StaffScreen from "./StaffScreen";
import EventsScreen from "./EventsScreen";
import ReportScreen from "./ReportsScreen"
import ProfileScreen from "./ProfileScreen";


export default function VenueHomeScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [currentTab, setCurrentTab] = useState("dashboard");

const businessItems: NavItem[] = [
  { key: "dashboard", icon: "home", label: "Dashboard" },
  { key: "staff", icon: "users", label: "Staff" },
  { key: "events", icon: "calendar", label: "Eventi" },
  { key: "analytics", icon: "bar-chart-2", label: "Report" },
  { key: "profile", icon: "user", label: "Profilo" },
];

const renderDashboard = () => (
  <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
    {/* HEADER */}
    <View style={styles.header}>
      <View>
        <Text style={[styles.venueName, { color: theme.colors.text }]}>Club Phoenix</Text>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live ora</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.profileButton} onPress={() => setCurrentTab("profile")}>
        <Feather name="settings" size={20} color={theme.colors.text} />
      </TouchableOpacity>
    </View>

    {/* KPI */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiRow}>
      <KpiCard label="Incasso totale" value="€4.820" icon="dollar-sign" />
      <KpiCard label="Ingressi" value="312" icon="users" />
      <KpiCard label="Bar" value="€2.140" icon="coffee" />
      <KpiCard label="Tavoli" value="€1.900" icon="grid" />
    </ScrollView>

    {/* AZIONI RAPIDE */}
    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Azioni rapide</Text>
    <View style={styles.actionsGrid}>
      <ActionButton icon="camera" label="Scan Ingresso" onPress={() => navigation.navigate("ScanEntry")} />
      <ActionButton icon="archive" label="Guardaroba" onPress={() => navigation.navigate("Wardrobe")} />
      <ActionButton icon="shopping-bag" label="Bar" onPress={() => navigation.navigate("BarSales")} />
      <ActionButton icon="star" label="Tavoli" onPress={() => navigation.navigate("Tables")} />
    </View>

    {/* EVENTO ATTIVO */}
    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Evento attivo</Text>
    <View style={styles.eventCard}>
      <View>
        <Text style={styles.eventTitle}>Friday Students Night</Text>
        <Text style={styles.eventSubtitle}>22:30 – 04:30</Text>
      </View>
      <TouchableOpacity style={styles.eventButton} onPress={() => setCurrentTab("events")}>
        <Text style={styles.eventButtonText}>Gestisci</Text>
      </TouchableOpacity>
    </View>
  </ScrollView>
);

const renderStaff = () => (
  <>
    {/* <Feather name="users" size={48} color={theme.colors.muted} />
    <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>Gestione Staff</Text>
    <Text style={[styles.placeholderText, { color: theme.colors.muted }]}>
      Visualizza e gestisci il personale del locale
    </Text> */}
    <StaffScreen />
  </>
);

const renderEvents = () => (
  <>
    <EventsScreen />
  </>
);

const renderAnalytics = () => (
  <>
    {/* <Feather name="bar-chart-2" size={48} color={theme.colors.muted} />
    <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>Report & Analisi</Text>
    <Text style={[styles.placeholderText, { color: theme.colors.muted }]}>
      Visualizza statistiche e report dettagliati
    </Text> */}
    <ReportScreen />
  </>
);

const renderProfile = () => (
  <>
    {/* <Feather name="user" size={48} color={theme.colors.muted} />
    <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>Profilo Locale</Text>
    <Text style={[styles.placeholderText, { color: theme.colors.muted }]}>
      Gestisci le informazioni e impostazioni del locale
    </Text> */}
    <ProfileScreen />
  </>
);

  function KpiCard({ label, value, icon }: any) {
    return (
      <View style={styles.kpiCard}>
        <Feather name={icon} size={18} color="#B9A7FF" />
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
    );
  }

  function ActionButton({ icon, label, onPress }: any) {
    return (
      <TouchableOpacity style={styles.actionButton} onPress={onPress}>
        <Feather name={icon} size={22} color="white" />
        <Text style={styles.actionLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

return (
  <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
    {/* Renderizza il contenuto in base al tab attivo */}
    {currentTab === "dashboard" && renderDashboard()}
    {currentTab === "staff" && renderStaff()}
    {currentTab === "events" && renderEvents()}
    {currentTab === "analytics" && renderAnalytics()}
    {currentTab === "profile" && renderProfile()}

    <BottomNav items={businessItems} active={currentTab} onChange={setCurrentTab} />
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  header: { padding: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  venueName: { fontSize: 26, fontWeight: "800" },
  liveRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e", marginRight: 6 },
  liveText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },
  profileButton: { padding: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)" },
  kpiRow: { paddingLeft: 18 },
  kpiCard: { width: 140, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginRight: 12 },
  kpiValue: { color: "white", fontSize: 20, fontWeight: "800", marginTop: 10 },
  kpiLabel: { color: "#CFC6FF", fontSize: 12, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginHorizontal: 24, marginTop: 28, marginBottom: 14 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 18, justifyContent: "space-between" },
  actionButton: { width: "48%", backgroundColor: "#6D5BFF", borderRadius: 18, paddingVertical: 22, alignItems: "center", marginBottom: 14 },
  actionLabel: { color: "white", marginTop: 8, fontWeight: "700" },
  eventCard: { marginHorizontal: 24, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventTitle: { color: "white", fontSize: 16, fontWeight: "700" },
  eventSubtitle: { color: "#CFC6FF", marginTop: 4 },
  eventButton: { backgroundColor: "#8B7BFF", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  eventButtonText: { color: "white", fontWeight: "700" },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  placeholderTitle: { fontSize: 20, fontWeight: "800", marginTop: 16 },
  placeholderText: { fontSize: 14 },
});