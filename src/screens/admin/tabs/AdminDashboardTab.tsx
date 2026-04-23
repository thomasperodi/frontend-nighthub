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
import { fetchAdminDashboard } from "../../../services/admin";
import { useTheme } from "../../../theme/ThemeProvider";
import { AdminDashboardData } from "../../../types/admin";
import { average, clamp, formatCompactNumber, formatCurrency, formatFullDate } from "../adminUtils";

type Props = {
  onQuickAction?: (tabKey: "dashboard" | "venues" | "users" | "reports" | "profile") => void;
};

type LoadState = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  data: AdminDashboardData | null;
};

type KpiCard = {
  label: string;
  value: string;
  sub?: string;
  icon: keyof typeof Feather.glyphMap;
  trend?: string;
  up?: boolean;
  warning?: boolean;
};

const todayFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const withSign = (value: number) => `${value > 0 ? "+" : ""}${value}`;

const formatStayDuration = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
};

export default function AdminDashboardTab({ onQuickAction }: Props) {
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
      const data = await fetchAdminDashboard({ force: asRefresh });
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

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const metrics = state.data?.metrics;
  const revenue = state.data?.revenue ?? [];
  const topVenues = state.data?.topVenues ?? [];
  const contracts = state.data?.expiringContracts ?? [];
  const alerts = state.data?.alerts ?? [];

  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical").length;
  const warningAlerts = alerts.filter((alert) => alert.severity === "warning").length;

  const operatingScore = clamp(
    100 - criticalAlerts * 18 - warningAlerts * 10 - (metrics?.contractsMissingData ?? 0) * 4 + (metrics?.eventsActiveToday ?? 0) * 2,
    32,
    99,
  );

  const chartMax = useMemo(() => Math.max(...revenue.map((item) => item.value), 1), [revenue]);
  const trendDelta = useMemo(() => {
    if (revenue.length < 2) return 0;
    const prev = revenue[revenue.length - 2]?.value ?? 0;
    const last = revenue[revenue.length - 1]?.value ?? 0;
    if (prev <= 0) return 0;
    return Math.round(((last - prev) / prev) * 100);
  }, [revenue]);

  const revenueWeek = revenue.reduce((total, item) => total + item.value, 0);
  const avgDaily = average(revenue.map((item) => item.value));
  const monthRevenue = metrics?.revenueMonth ?? revenueWeek;
  const paidOrdersRate =
    state.data && state.data.ordersMonth.total > 0
      ? Math.round((state.data.ordersMonth.paid / state.data.ordersMonth.total) * 100)
      : 0;
  const avgReservationsBaseline = metrics ? metrics.totalReservations / 30 : 0;
  const reservationsTrend =
    metrics && avgReservationsBaseline > 0
      ? Math.round(((metrics.reservationsToday - avgReservationsBaseline) / avgReservationsBaseline) * 100)
      : 0;
  const activeUsersRate =
    metrics && metrics.totalUsers > 0
      ? Math.round((metrics.activeUsers30d / metrics.totalUsers) * 100)
      : 0;

  const kpis = useMemo(
    (): KpiCard[] => [
      {
        label: "Locali attivi",
        value: metrics ? `${metrics.activeVenues}/${metrics.totalVenues}` : "-",
        sub: "network",
        icon: "map-pin" as const,
        trend: metrics ? withSign(metrics.activeVenues - (metrics.totalVenues - metrics.activeVenues)) : "",
        up: true,
      },
      {
        label: "Utenti attivi 30gg",
        value: metrics ? formatCompactNumber(metrics.activeUsers30d) : "-",
        sub: metrics ? `${metrics.totalUsers} totali` : "",
        icon: "users" as const,
        trend: metrics ? `${activeUsersRate}%` : "",
        up: true,
      },
      {
        label: "Nuovi utenti 30gg",
        value: metrics ? formatCompactNumber(metrics.newUsers30d) : "-",
        sub: "acquisizione",
        icon: "user-plus" as const,
        trend: metrics ? `+${metrics.newUsers30d}` : "",
        up: true,
      },
      {
        label: "Eventi oggi",
        value: metrics ? String(metrics.eventsActiveToday) : "-",
        sub: "attivi",
        icon: "calendar" as const,
        trend: metrics ? withSign(metrics.eventsActiveToday) : "",
        up: true,
      },
      {
        label: "Eventi mese",
        value: metrics ? String(metrics.eventsCompletedMonth) : "-",
        sub: "conclusi",
        icon: "calendar" as const,
        trend: metrics ? `+${metrics.eventsCompletedMonth}` : "",
        up: true,
      },
      {
        label: "Prenotazioni oggi",
        value: metrics ? formatCompactNumber(metrics.reservationsToday) : "-",
        sub: "check-in e tavoli",
        icon: "credit-card" as const,
        trend: metrics ? `${withSign(reservationsTrend)}%` : "",
        up: reservationsTrend >= 0,
      },
      {
        label: "Ricavi periodo",
        value: formatCurrency(monthRevenue),
        sub: "mese corrente",
        icon: "trending-up" as const,
        trend: `${trendDelta >= 0 ? "+" : ""}${trendDelta}%`,
        up: trendDelta >= 0,
      },
      {
        label: "Ticket medio",
        value: metrics ? formatCurrency(metrics.avgOrderValue) : "-",
        sub: "ordine pagato",
        icon: "receipt" as const,
        trend: metrics ? `€${Math.round(metrics.avgOrderValue)}` : "",
        up: true,
      },
      {
        label: "Sessioni venue 30gg",
        value: metrics ? formatCompactNumber(metrics.sessions30d) : "-",
        icon: "eye" as const,
        trend: metrics ? `+${formatCompactNumber(metrics.sessions30d)}` : "",
        up: true,
      },
      {
        label: "Permanenza media",
        value: metrics ? formatStayDuration(metrics.avgStayMinutes30d) : "-",
        sub: "sul locale",
        icon: "clock" as const,
      },
      {
        label: "Alert aperti",
        value: String(alerts.length),
        icon: "alert-triangle" as const,
        sub: "monitoraggio",
        warning: alerts.length > 0,
        up: false,
      },
      {
        label: "Contratti in scadenza",
        value: metrics ? String(metrics.contractsExpiringIn30d) : "0",
        sub: "prossimi 30gg",
        icon: "file-text" as const,
        warning: (metrics?.contractsExpiringIn30d ?? 0) > 0,
        up: false,
      },
      {
        label: "Ordini pagati",
        value: `${paidOrdersRate}%`,
        sub: state.data ? `${state.data.ordersMonth.paid} / ${state.data.ordersMonth.total}` : "",
        icon: "credit-card" as const,
        trend: state.data ? `+${state.data.ordersMonth.paid}` : "",
        up: true,
      },
    ],
    [
      activeUsersRate,
      alerts.length,
      metrics,
      monthRevenue,
      paidOrdersRate,
      reservationsTrend,
      state.data,
      trendDelta,
    ],
  );

  const quickActions = [
    { key: "venues" as const, label: "Scadenze", icon: "file-text" as const },
    { key: "venues" as const, label: "Extra utilizzo", icon: "zap" as const },
    { key: "reports" as const, label: "Report", icon: "bar-chart-2" as const },
    { key: "users" as const, label: "Utenti & ruoli", icon: "shield" as const },
  ];

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
          <View style={styles.heroHeader}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>NIGHTHUB</Text>
              <Text style={styles.heroSubtitle}>Cabina di regia · {todayFormatter.format(new Date())}</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <View style={styles.scoreCircleWrap}>
              <Text style={styles.scoreValue}>{operatingScore}</Text>
              <Text style={styles.scoreSuffix}>/100</Text>
            </View>
            <View style={styles.scoreCopy}>
              <Text style={styles.scoreTitle}>Operating Score</Text>
              <Text style={styles.scoreHint}>Piattaforma sotto controllo operativo</Text>
              <Text style={styles.scoreMeta}>{criticalAlerts} critici · {warningAlerts} warning</Text>
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={() => void loadDashboard(true)}>
              <Feather name="refresh-cw" size={14} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.quickActionsRow}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickActionButton}
              onPress={() => onQuickAction?.(action.key)}
              activeOpacity={0.86}
            >
              <Feather name={action.icon} size={14} color={theme.colors.primary} />
              <Text style={styles.quickActionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
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

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>KPI Principali</Text>
          <Text style={styles.sectionHint}>Basati sui dati live API</Text>
        </View>

        <View style={styles.kpiGrid}>
          {kpis.map((kpi) => (
            <View key={kpi.label} style={[styles.kpiCard, kpi.warning ? styles.kpiCardWarning : null]}>
              <View style={styles.kpiTopRow}>
                <Feather name={kpi.icon} size={14} color={kpi.warning ? "#f59e0b" : theme.colors.primary} />
                {kpi.trend ? (
                  <View style={styles.kpiTrendWrap}>
                    <Feather
                      name={kpi.up === false ? "arrow-down-right" : "arrow-up-right"}
                      size={11}
                      color={kpi.warning ? "#f59e0b" : kpi.up === false ? theme.colors.error : "#34d399"}
                    />
                    <Text
                      style={[
                        styles.kpiTrend,
                        kpi.warning ? styles.kpiTrendWarning : null,
                        kpi.up === false && !kpi.warning ? styles.kpiTrendDown : null,
                      ]}
                    >
                      {kpi.trend}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              {kpi.sub ? <Text style={styles.kpiSub}>{kpi.sub}</Text> : null}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Trend Ricavi</Text>
            <Text style={[styles.cardTitleTrend, trendDelta >= 0 ? styles.trendUp : styles.trendDown]}>
              {trendDelta >= 0 ? "+" : ""}{trendDelta}%
            </Text>
          </View>
          <View style={styles.revenueBarsRow}>
            {revenue.slice(-6).map((item) => (
              <View key={`${item.label}-${item.value}`} style={styles.revenueBarItem}>
                <View style={styles.revenueTrack}>
                  <View style={[styles.revenueFill, { height: Math.max(10, Math.round((item.value / chartMax) * 82)) }]} />
                </View>
                <Text style={styles.revenueLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.revenueHint}>Media periodo {formatCurrency(avgDaily)} / giorno</Text>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Top Locali per Fatturato</Text>
            <TouchableOpacity onPress={() => onQuickAction?.("venues")}>
              <Text style={styles.linkText}>Tutti</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.listWrap}>
            {topVenues.slice(0, 4).map((venue, index) => (
              <View key={venue.id} style={styles.listItem}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{venue.name}</Text>
                  <Text style={styles.listSub}>{formatCurrency(venue.revenue)}</Text>
                </View>
              </View>
            ))}
            {!topVenues.length ? <Text style={styles.emptyText}>Nessun locale disponibile.</Text> : null}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.cardTitle}>Contratti in Scadenza</Text>
          <View style={styles.listWrap}>
            {contracts.slice(0, 3).map((contract) => (
              <View key={contract.venueId} style={[styles.listItem, styles.warningItem]}>
                <Feather name="clock" size={14} color="#f59e0b" />
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{contract.venueName}</Text>
                  <Text style={styles.listSub}>{contract.daysLeft} gg · {formatFullDate(contract.expiresAt)}</Text>
                </View>
              </View>
            ))}
            {!contracts.length ? <Text style={styles.emptyText}>Nessuna scadenza nei prossimi giorni.</Text> : null}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.cardTitle}>Alert</Text>
          <View style={styles.listWrap}>
            {alerts.slice(0, 3).map((alert) => (
              <View
                key={String(alert.id)}
                style={[
                  styles.alertItem,
                  alert.severity === "critical"
                    ? styles.alertCritical
                    : alert.severity === "warning"
                      ? styles.alertWarning
                      : styles.alertInfo,
                ]}
              >
                <Feather name="alert-triangle" size={14} color={theme.colors.text} />
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{alert.title}</Text>
                  <Text style={styles.listSub}>{alert.detail}</Text>
                </View>
              </View>
            ))}
            {!alerts.length ? <Text style={styles.emptyText}>Nessun alert aperto.</Text> : null}
          </View>
        </View>
      </View>
    </ScrollView>
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
      gap: 14,
    },
    heroCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 14,
      gap: 10,
    },
    heroHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    heroTitleWrap: {
      gap: 2,
      flex: 1,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.text,
    },
    heroSubtitle: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    statusPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(52, 211, 153, 0.35)",
      backgroundColor: "rgba(52, 211, 153, 0.14)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "#34d399",
    },
    statusText: {
      color: "#34d399",
      fontSize: 10,
      fontWeight: "800",
    },
    scoreRow: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      backgroundColor: "rgba(255,255,255,0.05)",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
    },
    scoreCircleWrap: {
      width: 58,
      height: 58,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      backgroundColor: "rgba(255,255,255,0.03)",
      alignItems: "center",
      justifyContent: "center",
    },
    scoreValue: {
      fontSize: 21,
      fontWeight: "900",
      color: theme.colors.text,
      lineHeight: 22,
    },
    scoreSuffix: {
      fontSize: 9,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    scoreCopy: {
      flex: 1,
      gap: 2,
    },
    scoreTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    scoreHint: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: "600",
    },
    scoreMeta: {
      color: theme.colors.muted,
      fontSize: 10,
      fontWeight: "700",
    },
    refreshButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    quickActionsRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    quickActionButton: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      backgroundColor: "rgba(255,255,255,0.04)",
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    quickActionText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: "800",
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
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
      backgroundColor: `${theme.colors.error}16`,
      padding: 10,
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
    kpiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "900",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    sectionHint: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    kpiCard: {
      width: "48%",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      backgroundColor: "rgba(255,255,255,0.04)",
      paddingHorizontal: 10,
      paddingVertical: 9,
      gap: 4,
    },
    kpiCardWarning: {
      borderColor: "rgba(245, 158, 11, 0.35)",
      backgroundColor: "rgba(245, 158, 11, 0.12)",
    },
    kpiTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    kpiTrendWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    kpiTrend: {
      fontSize: 10,
      color: "#34d399",
      fontWeight: "800",
    },
    kpiTrendWarning: {
      color: "#f59e0b",
    },
    kpiTrendDown: {
      color: theme.colors.error,
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.text,
    },
    kpiLabel: {
      fontSize: 10,
      color: theme.colors.muted,
      fontWeight: "700",
      lineHeight: 13,
    },
    kpiSub: {
      fontSize: 10,
      color: `${theme.colors.muted}cc`,
      fontWeight: "600",
      lineHeight: 13,
      marginTop: 1,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 10,
      gap: 8,
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    cardTitleTrend: {
      fontSize: 11,
      fontWeight: "800",
    },
    trendUp: {
      color: "#34d399",
    },
    trendDown: {
      color: theme.colors.error,
    },
    revenueBarsRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 8,
    },
    revenueBarItem: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    revenueTrack: {
      height: 82,
      justifyContent: "flex-end",
    },
    revenueFill: {
      width: 12,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    revenueLabel: {
      fontSize: 9,
      color: theme.colors.muted,
      fontWeight: "700",
    },
    revenueHint: {
      fontSize: 10,
      color: theme.colors.muted,
      fontWeight: "700",
    },
    sectionBlock: {
      gap: 8,
    },
    listWrap: {
      gap: 8,
    },
    listItem: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      paddingHorizontal: 10,
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    warningItem: {
      borderColor: "rgba(245, 158, 11, 0.35)",
      backgroundColor: "rgba(245, 158, 11, 0.11)",
    },
    alertItem: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    alertCritical: {
      borderColor: "rgba(239, 68, 68, 0.35)",
      backgroundColor: "rgba(239, 68, 68, 0.12)",
    },
    alertWarning: {
      borderColor: "rgba(245, 158, 11, 0.35)",
      backgroundColor: "rgba(245, 158, 11, 0.12)",
    },
    alertInfo: {
      borderColor: "rgba(56, 189, 248, 0.35)",
      backgroundColor: "rgba(56, 189, 248, 0.12)",
    },
    rank: {
      width: 22,
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: "900",
    },
    listCopy: {
      flex: 1,
      gap: 2,
    },
    listTitle: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    listSub: {
      color: theme.colors.muted,
      fontSize: 10,
      fontWeight: "600",
      lineHeight: 13,
    },
    linkText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "800",
    },
    emptyText: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: "600",
    },
  });
