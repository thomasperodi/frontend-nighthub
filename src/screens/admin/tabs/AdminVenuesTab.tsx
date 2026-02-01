import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { fetchAdminVenues } from "../../../services/admin";
import { AdminVenue } from "../../../types/admin";

export default function AdminVenuesTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await fetchAdminVenues();
        if (!isMounted) return;
        setVenues(data);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Caricamento locali...</Text>
        </View>
      )}
      <Section
        title="Locali attivi"
        actionLabel="Aggiungi"
        onAction={() => Alert.alert("Locali", "Aggiungi un nuovo locale")}
      >
        {venues.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={24} color={theme.colors.muted} />
            <Text style={styles.emptyText}>Nessun locale disponibile</Text>
          </View>
        ) : (
          venues.map((venue) => (
            <TouchableOpacity
              key={venue.id}
              style={styles.venueCard}
              onPress={() => Alert.alert(venue.name, "Apri gestione locale")}
            >
              <View>
                <Text style={styles.venueName}>{venue.name}</Text>
                <Text style={styles.venueMeta}>
                  {venue.city} • {venue.status}
                </Text>
              </View>
              <View style={styles.venueStats}>
                <Text style={styles.venueStatText}>Occupazione {venue.occupancy}%</Text>
                <Text style={styles.venueRevenue}>€ {venue.revenue.toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </Section>
    </ScrollView>
  );
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
  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
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
  venueCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  venueName: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },
  venueMeta: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },
  venueStats: {
    alignItems: "flex-end",
    gap: 6,
  },
  venueStatText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: "600",
  },
  venueRevenue: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: "800",
  },
});
