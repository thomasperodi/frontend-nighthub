import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useTheme } from "../../../theme/ThemeProvider";
import { fetchAdminUsers } from "../../../services/admin";
import { AdminUser } from "../../../types/admin";

export default function AdminUsersTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await fetchAdminUsers();
        if (!isMounted) return;
        setUsers(data);
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
          <Text style={styles.loadingText}>Caricamento utenti...</Text>
        </View>
      )}
      <Section title="Ultimi utenti" actionLabel="Vedi tutti" onAction={() => Alert.alert("Utenti", "Apro lista completa utenti")}
      >
        {users.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nessun utente trovato</Text>
          </View>
        ) : (
          users.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={styles.userCard}
              onPress={() => Alert.alert(user.name, "Apri dettaglio utente")}
            >
              <View>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userMeta}>{user.role}</Text>
              </View>
              <View
                style={[
                  styles.userStatus,
                  user.status === "Attivo" ? styles.userStatusActive : styles.userStatusBlocked,
                ]}
              >
                <Text style={styles.userStatusText}>{user.status}</Text>
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
  userCard: {
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
  userName: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },
  userMeta: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },
  userStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  userStatusActive: {
    backgroundColor: theme.colors.accent + "22",
  },
  userStatusBlocked: {
    backgroundColor: theme.colors.error + "22",
  },
  userStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.text,
  },
});
