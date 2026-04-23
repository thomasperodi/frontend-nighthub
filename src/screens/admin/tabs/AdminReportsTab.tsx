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
import { fetchAdminReports } from "../../../services/admin";
import { useTheme } from "../../../theme/ThemeProvider";
import { AdminReportsData } from "../../../types/admin";
import { average, formatCompactNumber, formatCurrency, formatPercent } from "../adminUtils";

export default function AdminReportsTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [period, setPeriod] = useState<"settimana" | "mese" | "trimestre">("mese");
  const [reports, setReports] = useState<AdminReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchAdminReports();
      setReports(data);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Errore caricamento report"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReports(false);
  }, [loadReports]);

  const revenue = reports?.revenue ?? [];
  const chartMax = Math.max(...revenue.map((item) => item.value), 1);
  const periodTotal = revenue.reduce((total, item) => total + item.value, 0);
  const averagePeriodDay = average(revenue.map((item) => item.value));
  const bestDay = revenue.reduce((current, item) => (item.value > current.value ? item : current), {
    label: "-",
    value: 0,
  });
  const weakestDay = revenue.reduce((current, item) => (item.value < current.value ? item : current), {
    label: "-",
    value: Number.MAX_SAFE_INTEGER,
  });

  const entries = reports?.channelBreakdown?.entries ?? 0;
  const tables = reports?.channelBreakdown?.tables ?? 0;
  const channelsTotal = Math.max(entries + tables, 1);
  const entriesPct = Math.round((entries / channelsTotal) * 100);
  const tablesPct = Math.round((tables / channelsTotal) * 100);
  const dominantChannel = entries >= tables ? "Entry/Ticket" : "Tavoli";
  const trendPositive = (reports?.monthVsPrevious ?? 0) >= 0;

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
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>NIGHTHUB REPORTS</Text>
              <Text style={styles.heroTitle}>Ricavi, mix canali e momentum</Text>
              <Text style={styles.heroSubtitle}>
                Lettura rapida in stile control room: confronto periodo, giorni forti e segnali da scalare.
              </Text>
            </View>
            <View style={styles.periodSwitch}>
              {(["settimana", "mese", "trimestre"] as const).map((item) => {
                const active = period === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.periodChip, active ? styles.periodChipActive : null]}
                    onPress={() => setPeriod(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.periodChipText, active ? styles.periodChipTextActive : null]}>
                      {item.charAt(0).toUpperCase() + item.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.heroMetricsRow}>
            <View style={styles.heroMetricStrong}>
              <Text style={styles.heroMetricLabel}>Totale mese</Text>
              <Text style={styles.heroMetricValue}>{formatCurrency(reports?.monthTotal)}</Text>
              <Text style={[styles.heroMetricTrend, trendPositive ? styles.heroMetricTrendPositive : styles.heroMetricTrendNegative]}>
                {trendPositive ? "+" : ""}{reports?.monthVsPrevious ?? 0}% vs mese precedente
              </Text>
            </View>

            <View style={styles.heroMetricBox}>
              <Text style={styles.heroMetricLabel}>Ordini pagati</Text>
              <Text style={styles.heroMetricValue}>{formatCompactNumber(reports?.paidOrders)}</Text>
              <Text style={styles.heroMetricHint}>{reports?.monthHint ?? "Confronto periodo non disponibile"}</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Caricamento report...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.errorCard}>
            <Feather name="alert-triangle" size={16} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.kpiRow}>
          <KpiCard label="Ultimo periodo" value={formatCurrency(periodTotal)} note={`Media ${formatCurrency(averagePeriodDay)}/giorno`} />
          <KpiCard label="Giorno migliore" value={`${bestDay.label}`} note={formatCurrency(bestDay.value)} />
          <KpiCard label="Canale dominante" value={dominantChannel} note={`${Math.max(entriesPct, tablesPct)}% del mix`} />
          <KpiCard label="Tavoli" value={formatPercent(tablesPct)} note={formatCurrency(tables)} />
        </View>

        <Section title="Ricavi nel periodo" subtitle="Distribuzione giornaliera e concentrazione dell'incasso.">
          <View style={styles.chartCard}>
            {revenue.map((item) => (
              <View key={item.label} style={styles.chartItem}>
                <View style={styles.chartTrack}>
                  <View style={[styles.chartBar, { height: Math.max(10, (item.value / chartMax) * 130) }]} />
                </View>
                <Text style={styles.chartLabel}>{item.label}</Text>
                <Text style={styles.chartValue}>{formatCompactNumber(item.value)}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Mix ricavi" subtitle="Quanto pesa ogni canale e dove si concentra il volume.">
          <View style={styles.mixCard}>
            <ChannelRow label="Entry / Ticket" value={entries} share={entriesPct} />
            <ChannelRow label="Tavoli" value={tables} share={tablesPct} />
          </View>
        </Section>

        <Section title="Lettura veloce" subtitle="Indicatori sintetici per capire la qualita del periodo in corso.">
          <View style={styles.insightsGrid}>
            <InsightCard
              icon={trendPositive ? "trending-up" : "trending-down"}
              title={trendPositive ? "Trend positivo" : "Trend da recuperare"}
              description={
                trendPositive
                  ? "Il mese sta performando meglio del precedente. Ha senso spingere sui venue top performer."
                  : "Il ritmo e sotto il mese precedente. Conviene verificare conversione e mix canali."
              }
            />
            <InsightCard
              icon="calendar"
              title="Volatilita giornaliera"
              description={`Best ${bestDay.label} ${formatCurrency(bestDay.value)} • Soft ${weakestDay.label} ${formatCurrency(weakestDay.value === Number.MAX_SAFE_INTEGER ? 0 : weakestDay.value)}`}
            />
            <InsightCard
              icon="shopping-cart"
              title="Qualita della raccolta"
              description={`Ordini pagati ${formatCompactNumber(reports?.paidOrders)} con totale mese ${formatCurrency(reports?.monthTotal)}`}
            />
          </View>
        </Section>
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

  function ChannelRow({ label, value, share }: { label: string; value: number; share: number }) {
    return (
      <View style={styles.channelRow}>
        <View style={styles.channelCopy}>
          <Text style={styles.channelLabel}>{label}</Text>
          <Text style={styles.channelValue}>{formatCurrency(value)}</Text>
        </View>
        <View style={styles.channelTrack}>
          <View style={[styles.channelFill, { width: `${Math.max(10, share)}%` }]} />
        </View>
        <Text style={styles.channelPct}>{share}%</Text>
      </View>
    );
  }

  function InsightCard({
    icon,
    title,
    description,
  }: {
    icon: keyof typeof Feather.glyphMap;
    title: string;
    description: string;
  }) {
    return (
      <View style={styles.insightCard}>
        <View style={styles.insightIconWrap}>
          <Feather name={icon} size={15} color={theme.colors.primary} />
        </View>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={styles.insightDescription}>{description}</Text>
      </View>
    );
  }
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      {children}
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
      paddingTop: 6,
      gap: 18,
    },
    heroCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 18,
      gap: 14,
    },
    heroTopRow: {
      gap: 10,
    },
    heroCopy: {
      gap: 4,
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
      color: theme.colors.muted,
      fontWeight: "600",
    },
    periodSwitch: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    periodChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      backgroundColor: "rgba(255,255,255,0.05)",
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    periodChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}22`,
    },
    periodChipText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.colors.muted,
    },
    periodChipTextActive: {
      color: theme.colors.primary,
    },
    heroMetricsRow: {
      flexDirection: "row",
      gap: 10,
    },
    heroMetricStrong: {
      flex: 1.1,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}55`,
      backgroundColor: `${theme.colors.primary}20`,
      padding: 14,
      gap: 8,
    },
    heroMetricBox: {
      flex: 0.9,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      backgroundColor: "rgba(255,255,255,0.06)",
      padding: 14,
      gap: 8,
    },
    heroMetricLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    heroMetricValue: {
      fontSize: 24,
      fontWeight: "900",
      color: theme.colors.text,
    },
    heroMetricTrend: {
      fontSize: 12,
      fontWeight: "800",
    },
    heroMetricTrendPositive: {
      color: theme.colors.accent,
    },
    heroMetricTrendNegative: {
      color: theme.colors.error,
    },
    heroMetricHint: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
      lineHeight: 16,
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
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "600",
    },
    kpiRow: {
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
      fontSize: 19,
      fontWeight: "900",
      color: theme.colors.text,
    },
    kpiNote: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
      lineHeight: 16,
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    chartCard: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      paddingHorizontal: 12,
      paddingTop: 18,
      paddingBottom: 12,
    },
    chartItem: {
      flex: 1,
      alignItems: "center",
      gap: 6,
    },
    chartTrack: {
      height: 136,
      justifyContent: "flex-end",
    },
    chartBar: {
      width: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
    },
    chartLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    chartValue: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.colors.text,
    },
    mixCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 14,
      gap: 14,
    },
    channelRow: {
      gap: 8,
    },
    channelCopy: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    channelLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.colors.text,
    },
    channelValue: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    channelTrack: {
      width: "100%",
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
    },
    channelFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    channelPct: {
      alignSelf: "flex-end",
      fontSize: 11,
      fontWeight: "800",
      color: theme.colors.primary,
    },
    insightsGrid: {
      gap: 10,
    },
    insightCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 14,
      gap: 8,
    },
    insightIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${theme.colors.primary}18`,
    },
    insightTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: theme.colors.text,
    },
    insightDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.muted,
      fontWeight: "600",
    },
  });