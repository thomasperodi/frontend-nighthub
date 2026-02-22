import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { fetchAdminReports } from "../../../services/admin";
import { AdminReportsData, AdminRevenuePoint } from "../../../types/admin";

export default function AdminReportsTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [reports, setReports] = useState<AdminReportsData | null>(null);
  const [revenue, setRevenue] = useState<AdminRevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchAdminReports();
      setReports(data);
      setRevenue(data.revenue);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Errore caricamento report"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadReports(false);
  }, []);

  const maxRevenue = Math.max(...revenue.map((r) => r.value), 1);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadReports(true)}
          tintColor={theme.colors.primary}
        />
      }
    >
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Caricamento report...</Text>
        </View>
      )}
      {!loading && error ? (
        <View style={styles.errorCard}>
          <Feather name="alert-triangle" size={16} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <Section title="Guadagni settimanali" actionLabel="Esporta" onAction={() => Alert.alert("Report", "Esportazione guadagni avviata")}
      >
        <RevenueChart maxRevenue={maxRevenue} />
      </Section>
      <Section title="Riepilogo mese" actionLabel="Scarica" onAction={() => Alert.alert("Report", "Scarico riepilogo mensile")}
      >
        <SummaryCard />
      </Section>

      <Section title="Mix ricavi" actionLabel="Dettagli" onAction={() => Alert.alert("Report", "Mostro dettaglio canali")}
      >
        <BreakdownCard />
      </Section>
    </ScrollView>
  );

  function RevenueChart({ maxRevenue }: { maxRevenue: number }) {
    return (
      <View style={styles.chartCard}>
        {revenue.map((item) => (
          <View key={item.label} style={styles.chartItem}>
            <View
              style={[
                styles.chartBar,
                { height: Math.max(16, (item.value / maxRevenue) * 120) },
              ]}
            />
            <Text style={styles.chartLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    );
  }

  function SummaryCard() {
    const trendPositive = (reports?.monthVsPrevious ?? 0) >= 0;
    return (
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryTitle}>Totale mese</Text>
          <Text style={styles.summaryValue}>€ {reports?.monthTotal?.toLocaleString() ?? "0"}</Text>
          <Text style={styles.summaryHint}>{reports?.monthHint ?? ""}</Text>
        </View>
        <View style={[styles.summaryBadge, trendPositive ? styles.summaryBadgePositive : styles.summaryBadgeNegative]}>
          <Feather name={trendPositive ? "trending-up" : "trending-down"} size={18} color={trendPositive ? theme.colors.primary : theme.colors.error} />
          <Text style={[styles.summaryBadgeText, trendPositive ? styles.summaryBadgeTextPositive : styles.summaryBadgeTextNegative]}>
            {trendPositive ? "Trend positivo" : "Trend in calo"}
          </Text>
        </View>
      </View>
    );
  }

  function BreakdownCard() {
    const entries = reports?.channelBreakdown?.entries ?? 0;
    const tables = reports?.channelBreakdown?.tables ?? 0;
    const total = Math.max(entries + tables, 1);
    const entryPct = Math.round((entries / total) * 100);
    const tablePct = Math.round((tables / total) * 100);

    return (
      <View style={styles.summaryCard}>
        <View style={styles.breakdownRow}>
          <Text style={styles.summaryTitle}>Ticket/Entry</Text>
          <Text style={styles.breakdownValue}>€ {entries.toLocaleString("it-IT")}</Text>
          <Text style={styles.breakdownPct}>{entryPct}%</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.summaryTitle}>Tavoli</Text>
          <Text style={styles.breakdownValue}>€ {tables.toLocaleString("it-IT")}</Text>
          <Text style={styles.breakdownPct}>{tablePct}%</Text>
        </View>
      </View>
    );
  }
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {actionLabel ? (
          <TouchableOpacity onPress={onAction}>
            <Text style={styles.sectionAction}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  scrollContent: {
    paddingBottom: 140,
  },
  loadingContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  errorCard: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.card,
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
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  chartCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  chartItem: {
    alignItems: "center",
    flex: 1,
  },
  chartBar: {
    width: 18,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.muted,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 4,
  },
  summaryHint: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  summaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.primary + "22",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  summaryBadgePositive: {
    backgroundColor: theme.colors.primary + "22",
  },
  summaryBadgeNegative: {
    backgroundColor: theme.colors.error + "22",
  },
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  summaryBadgeTextPositive: {
    color: theme.colors.primary,
  },
  summaryBadgeTextNegative: {
    color: theme.colors.error,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  breakdownValue: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: "800",
  },
  breakdownPct: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "700",
    width: 40,
    textAlign: "right",
  },
});
