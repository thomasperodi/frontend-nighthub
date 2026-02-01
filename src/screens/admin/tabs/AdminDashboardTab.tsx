import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { fetchAdminDashboard } from "../../../services/admin";
import { AdminAlert, AdminMetrics, AdminRevenuePoint } from "../../../types/admin";

export default function AdminDashboardTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [revenue, setRevenue] = useState<AdminRevenuePoint[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await fetchAdminDashboard();
        if (!isMounted) return;
        setMetrics(data.metrics);
        setRevenue(data.revenue);
        setAlerts(data.alerts);
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
          <Text style={styles.loadingText}>Caricamento dashboard...</Text>
        </View>
      )}
      <View style={styles.sectionStack}>
        <Header />
        <QuickActions />
        <MetricsGrid />
        <Section title="Guadagni settimanali" actionLabel="Dettagli" onAction={() => Alert.alert("Report", "Apro i dettagli dei guadagni")}
        >
          <RevenueChart maxRevenue={maxRevenue} />
        </Section>
        <Section title="Azioni da completare">
          <AlertsList />
        </Section>
      </View>
    </ScrollView>
  );

  function Header() {
    return (
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard Admin</Text>
          <Text style={styles.subtitle}>Panoramica completa dell’app</Text>
        </View>
        <View style={styles.profileBadge}>
          <Feather name="shield" size={22} color="white" />
        </View>
      </View>
    );
  }

  function QuickActions() {
    return (
      <View style={styles.quickActions}>
        <QuickAction icon="plus-circle" label="Nuovo locale" color={theme.colors.primary} onPress={() => Alert.alert("Locali", "Apro la creazione di un nuovo locale")}
        />
        <QuickAction icon="user-check" label="Gestisci utenti" color={theme.colors.accent} onPress={() => Alert.alert("Utenti", "Apro la gestione utenti")}
        />
        <QuickAction icon="download" label="Esporta report" color={theme.colors.primary} onPress={() => Alert.alert("Report", "Esportazione avviata")}
        />
      </View>
    );
  }

  function MetricsGrid() {
    if (!metrics) return null;
    return (
      <View style={styles.metricsGrid}>
        <MetricCard label="Locali attivi" value={`${metrics.activeVenues}`} hint="+2 questa settimana" />
        <MetricCard label="Utenti totali" value={`${metrics.totalUsers}`} hint="+1.2k questo mese" />
        <MetricCard label="Guadagni mensili" value={`€ ${metrics.revenueMonth.toLocaleString()}`} hint="+18% vs mese scorso" />
        <MetricCard label="Prenotazioni oggi" value={`${metrics.reservationsToday}`} hint="Picco alle 22:00" />
      </View>
    );
  }

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

  function AlertsList() {
    return (
      <View>
        {alerts.map((alert) => (
          <TouchableOpacity
            key={alert.id}
            style={styles.alertCard}
            onPress={() => Alert.alert(alert.title, alert.detail)}
          >
            <View>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertDetail}>{alert.detail}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
        ))}
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

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity style={styles.quickActionCard} onPress={onPress}>
      <Feather name={icon} size={20} color={color} />
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
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
  sectionStack: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 4,
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
  },
  metricsGrid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  metricCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  metricLabel: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
  },
  metricHint: {
    fontSize: 12,
    color: theme.colors.primary,
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
  alertCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },
  alertDetail: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },
});
