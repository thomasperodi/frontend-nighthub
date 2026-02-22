import React, { useCallback, useMemo, useState } from "react";
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
import { fetchAdminDashboard } from "../../../services/admin";
import { AdminDashboardData } from "../../../types/admin";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type LoadState = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  data: AdminDashboardData | null;
};

export default function AdminDashboardTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [state, setState] = useState<LoadState>({
    loading: true,
    refreshing: false,
    error: null,
    data: null,
  });

  const loadDashboard = useCallback(async (asRefresh = false) => {
    setState((prev) => ({
      ...prev,
      loading: asRefresh ? prev.loading : true,
      refreshing: asRefresh,
      error: null,
    }));

    try {
      const data = await fetchAdminDashboard();
      setState({ loading: false, refreshing: false, error: null, data });
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || "Errore nel caricamento dashboard";
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: String(message),
      }));
    }
  }, []);

  React.useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const metrics = state.data?.metrics;
  const urgentContract = state.data?.expiringContracts?.[0] ?? null;
  const topVenue = state.data?.topVenues?.[0] ?? null;
  const firstAlert = state.data?.alerts?.[0] ?? null;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={() => void loadDashboard(true)}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Panoramica essenziale</Text>
            <Text style={styles.heroSubtitle}>I numeri più utili per decidere subito.</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void loadDashboard(true)}>
            <Feather name="refresh-cw" size={14} color={theme.colors.text} />
            <Text style={styles.refreshButtonText}>Aggiorna</Text>
          </TouchableOpacity>
        </View>

        {state.loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Caricamento dashboard...</Text>
          </View>
        ) : null}

        {state.error ? (
          <View style={styles.errorCard}>
            <Feather name="alert-triangle" size={16} color={theme.colors.error} />
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        ) : null}

        {metrics ? (
          <>
            <View style={styles.mainCard}>
              <Text style={styles.mainLabel}>Ricavi del mese</Text>
              <Text style={styles.mainValue}>{currencyFormatter.format(metrics.revenueMonth)}</Text>
              <Text style={styles.mainHint}>
                Ticket medio {currencyFormatter.format(metrics.avgOrderValue)} • Prenotazioni oggi {metrics.reservationsToday}
              </Text>
            </View>

            <View style={styles.kpiRow}>
              <KpiCard icon="users" label="Utenti attivi" value={metrics.activeUsers30d.toLocaleString("it-IT")} />
              <KpiCard icon="map-pin" label="Locali attivi" value={`${metrics.activeVenues}/${metrics.totalVenues}`} />
              <KpiCard icon="clock" label="Permanenza media" value={`${metrics.avgStayMinutes30d} min`} />
              <KpiCard icon="calendar" label="Scadenze 30g" value={`${metrics.contractsExpiringIn30d}`} />
            </View>
          </>
        ) : null}

        <Section title="Focus di oggi">
          <FocusItem
            icon="alert-circle"
            label="Priorità contratti"
            value={
              urgentContract
                ? `${urgentContract.venueName} • ${urgentContract.daysLeft} gg`
                : "Nessuna urgenza"
            }
            note={
              urgentContract
                ? `Scadenza ${dateFormatter.format(new Date(urgentContract.expiresAt))}`
                : ""
            }
          />

          <FocusItem
            icon="award"
            label="Top locale"
            value={topVenue ? topVenue.name : "Nessun dato"}
            note={topVenue ? currencyFormatter.format(topVenue.revenue) : ""}
          />

          <FocusItem
            icon="bell"
            label="Alert principale"
            value={firstAlert ? firstAlert.title : "Nessun alert"}
            note={firstAlert ? firstAlert.detail : ""}
          />
        </Section>
      </View>
    </ScrollView>
  );

  function KpiCard({
    icon,
    label,
    value,
  }: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
    value: string;
  }) {
    return (
      <View style={styles.kpiCard}>
        <View style={styles.kpiHead}>
          <Feather name={icon} size={14} color={theme.colors.primary} />
          <Text style={styles.kpiLabel}>{label}</Text>
        </View>
        <Text style={styles.kpiValue}>{value}</Text>
      </View>
    );
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function FocusItem({
  icon,
  label,
  value,
  note,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  note: string;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.focusItem}>
      <View style={styles.focusIconWrap}>
        <Feather name={icon} size={14} color={theme.colors.primary} />
      </View>
      <View style={styles.focusTextWrap}>
        <Text style={styles.focusLabel}>{label}</Text>
        <Text style={styles.focusValue}>{value}</Text>
        {note ? <Text style={styles.focusNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 140,
    },
    container: {
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 12,
    },
    heroCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    heroTextWrap: {
      flex: 1,
      gap: 2,
    },
    heroTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.colors.text,
    },
    heroSubtitle: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    refreshButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    refreshButtonText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 4,
    },
    loadingText: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: "600",
    },
    errorCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.error,
      backgroundColor: `${theme.colors.error}1a`,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    errorText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "600",
    },
    mainCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 14,
      gap: 3,
    },
    mainLabel: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "700",
    },
    mainValue: {
      fontSize: 28,
      color: theme.colors.text,
      fontWeight: "900",
    },
    mainHint: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: "700",
    },
    kpiRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    kpiCard: {
      width: "48%",
      minHeight: 78,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 10,
      justifyContent: "space-between",
    },
    kpiHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    kpiLabel: {
      fontSize: 11,
      color: theme.colors.muted,
      fontWeight: "700",
    },
    kpiValue: {
      fontSize: 18,
      color: theme.colors.text,
      fontWeight: "900",
    },
    section: {
      gap: 8,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "900",
    },
    sectionBody: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 10,
      gap: 10,
    },
    focusItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    focusIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: `${theme.colors.primary}1f`,
      alignItems: "center",
      justifyContent: "center",
    },
    focusTextWrap: {
      flex: 1,
      gap: 2,
    },
    focusLabel: {
      fontSize: 11,
      color: theme.colors.muted,
      fontWeight: "700",
    },
    focusValue: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: "800",
    },
    focusNote: {
      fontSize: 11,
      color: theme.colors.muted,
      fontWeight: "600",
      lineHeight: 15,
    },
  });
