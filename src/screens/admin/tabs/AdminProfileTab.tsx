import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { fetchAdminDashboard, fetchAdminProfile, logoutAdmin } from "../../../services/admin";
import type { AdminDashboardData, AdminProfile } from "../../../types/admin";
import { formatCompactNumber, formatCurrency } from "../adminUtils";

type Props = {
  onLogout: () => void;
};

export default function AdminProfileTab({ onLogout }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setError(null);
      const [profileData, dashboardData] = await Promise.all([
        fetchAdminProfile(),
        fetchAdminDashboard({ force: asRefresh }),
      ]);
      setProfile(profileData);
      setDashboard(dashboardData);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Errore caricamento profilo"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutAdmin();
    } catch {
      // Ignore network failures during logout.
    } finally {
      onLogout();
    }
  }, [onLogout]);

  const metrics = dashboard?.metrics;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadData(true)}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>NIGHTHUB SETTINGS</Text>
          <Text style={styles.heroTitle}>Profilo admin e controllo account</Text>
          <Text style={styles.heroSubtitle}>
            Vista compatta su identita, numeri in gestione e azioni operative legate alla sicurezza del profilo.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Caricamento profilo...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Feather name="alert-triangle" size={16} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Feather name="shield" size={26} color={theme.colors.primary} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{profile?.name ?? "Admin"}</Text>
            <Text style={styles.profileMeta}>{profile?.email ?? "Email non disponibile"}</Text>
            <Text style={styles.profileRole}>{String(profile?.role ?? "admin").toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <KpiCard label="Utenti attivi 30g" value={formatCompactNumber(metrics?.activeUsers30d)} note="base attiva recente" />
          <KpiCard label="Locali attivi" value={formatCompactNumber(metrics?.activeVenues)} note={`su ${formatCompactNumber(metrics?.totalVenues)}`} />
          <KpiCard label="Ricavi mese" value={formatCurrency(metrics?.revenueMonth)} note={`ticket medio ${formatCurrency(metrics?.avgOrderValue)}`} />
          <KpiCard label="Alert aperti" value={formatCompactNumber(dashboard?.alerts.length)} note="da presidiare oggi" />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Focus operativo</Text>
          <View style={styles.bulletRow}>
            <Feather name="users" size={15} color={theme.colors.primary} />
            <Text style={styles.bulletText}>
              Stai monitorando {formatCompactNumber(metrics?.totalUsers)} utenti complessivi, con {formatCompactNumber(metrics?.newUsers30d)} nuovi ingressi negli ultimi 30 giorni.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Feather name="map-pin" size={15} color={theme.colors.primary} />
            <Text style={styles.bulletText}>
              Ci sono {formatCompactNumber(metrics?.contractsExpiringIn30d)} contratti in scadenza e {formatCompactNumber(metrics?.contractsMissingData)} profili venue con dati contrattuali incompleti.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Feather name="activity" size={15} color={theme.colors.primary} />
            <Text style={styles.bulletText}>
              Oggi la piattaforma registra {formatCompactNumber(metrics?.eventsActiveToday)} eventi live e {formatCompactNumber(metrics?.reservationsToday)} prenotazioni.
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Azioni account</Text>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => void loadData(true)}>
            <Feather name="refresh-cw" size={16} color={theme.colors.text} />
            <Text style={styles.secondaryActionText}>Aggiorna dati account e dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={18} color="white" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  function KpiCard({ label, value, note }: { label: string; value: string; note: string }) {
    return (
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiNote}>{note}</Text>
      </View>
    );
  }
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 140,
    },
    container: {
      paddingHorizontal: 20,
      paddingTop: 6,
      gap: 16,
    },
    heroCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 18,
      gap: 6,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: "900",
      color: theme.colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: theme.colors.text,
    },
    heroSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    loadingText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    errorCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.error,
      backgroundColor: `${theme.colors.error}14`,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    errorText: {
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    profileCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    avatarWrap: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${theme.colors.primary}18`,
    },
    profileCopy: {
      flex: 1,
      gap: 4,
    },
    profileName: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.colors.text,
    },
    profileMeta: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    profileRole: {
      fontSize: 11,
      fontWeight: "900",
      color: theme.colors.primary,
      letterSpacing: 0.6,
    },
    kpiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    kpiCard: {
      width: "48%",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 14,
      gap: 6,
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    kpiValue: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.text,
    },
    kpiNote: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    sectionCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 16,
      gap: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: theme.colors.text,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    bulletText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    secondaryAction: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    secondaryActionText: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.colors.text,
    },
    logoutButton: {
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: theme.colors.error,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    logoutText: {
      color: "white",
      fontSize: 13,
      fontWeight: "900",
    },
  });