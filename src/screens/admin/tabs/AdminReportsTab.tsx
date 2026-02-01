import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
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

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await fetchAdminReports();
        if (!isMounted) return;
        setReports(data);
        setRevenue(data.revenue);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const maxRevenue = Math.max(...revenue.map((r) => r.value), 1);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Caricamento report...</Text>
        </View>
      )}
      <Section title="Guadagni settimanali" actionLabel="Esporta" onAction={() => Alert.alert("Report", "Esportazione guadagni avviata")}
      >
        <RevenueChart maxRevenue={maxRevenue} />
      </Section>
      <Section title="Riepilogo mese" actionLabel="Scarica" onAction={() => Alert.alert("Report", "Scarico riepilogo mensile")}
      >
        <SummaryCard />
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
    return (
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryTitle}>Totale mese</Text>
          <Text style={styles.summaryValue}>€ {reports?.monthTotal?.toLocaleString() ?? "0"}</Text>
          <Text style={styles.summaryHint}>{reports?.monthHint ?? ""}</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Feather name="trending-up" size={18} color={theme.colors.primary} />
          <Text style={styles.summaryBadgeText}>Trend positivo</Text>
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
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary,
  },
});
