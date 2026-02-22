import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { fetchAdminUsers, fetchAdminVenues, updateAdminUserAssignment } from "../../../services/admin";
import { AdminUser, AdminVenue } from "../../../types/admin";

type UserRole = "client" | "staff" | "venue" | "admin";
type RoleFilter = "all" | UserRole;
type StatusFilter = "all" | "Attivo" | "Inattivo";

const ROLES: Array<{ key: UserRole; label: string }> = [
  { key: "client", label: "Cliente" },
  { key: "staff", label: "Staff" },
  { key: "venue", label: "Manager" },
  { key: "admin", label: "Admin" },
];

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "Tutti" },
  { key: "Attivo", label: "Attivi" },
  { key: "Inattivo", label: "Inattivi" },
];

const toRoleKey = (value: string | undefined): UserRole => {
  if (value === "staff" || value === "venue" || value === "admin") return value;
  return "client";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminUsersTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [venueSearch, setVenueSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("venue");
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  const loadData = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [usersData, venuesData] = await Promise.all([fetchAdminUsers(), fetchAdminVenues()]);
      setUsers(usersData);
      setVenues(venuesData);

      if (!selectedUserId && usersData.length > 0) {
        const first = usersData[0];
        setSelectedUserId(first.id);
        setSelectedRole(toRoleKey(first.roleKey));
        setSelectedVenueId(first.venueId ?? null);
      }
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Errore caricamento utenti"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const filteredUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();

    return users.filter((user) => {
      if (roleFilter !== "all" && toRoleKey(user.roleKey) !== roleFilter) return false;
      if (statusFilter !== "all" && user.status !== statusFilter) return false;

      if (!needle) return true;

      const haystack = `${user.name} ${user.email ?? ""} ${user.role} ${user.venueName ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [users, userSearch, roleFilter, statusFilter]);

  const filteredVenues = useMemo(() => {
    const needle = venueSearch.trim().toLowerCase();
    if (!needle) return venues.slice(0, 20);
    return venues.filter((venue) => {
      const haystack = `${venue.name} ${venue.city}`.toLowerCase();
      return haystack.includes(needle);
    }).slice(0, 20);
  }, [venueSearch, venues]);

  const summary = useMemo(() => {
    const active = users.filter((user) => user.status === "Attivo").length;
    const managers = users.filter((user) => user.roleKey === "venue").length;
    const staff = users.filter((user) => user.roleKey === "staff").length;
    const assigned = users.filter((user) => Boolean(user.venueId)).length;

    return { active, managers, staff, assigned };
  }, [users]);

  const onSelectUser = useCallback((user: AdminUser) => {
    setSelectedUserId(user.id);
    setSelectedRole(toRoleKey(user.roleKey));
    setSelectedVenueId(user.venueId ?? null);
  }, []);

  const onSaveAssignment = useCallback(async () => {
    if (!selectedUserId) {
      setError("Seleziona prima un utente");
      return;
    }

    if ((selectedRole === "venue" || selectedRole === "staff") && !selectedVenueId) {
      setError("Per ruolo Manager/Staff devi selezionare un locale");
      return;
    }

    setSavingAssignment(true);
    setError(null);

    try {
      await updateAdminUserAssignment(selectedUserId, {
        role: selectedRole,
        venue_id: selectedRole === "venue" || selectedRole === "staff" ? selectedVenueId : null,
      });

      await loadData(false);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Aggiornamento utente non riuscito"));
    } finally {
      setSavingAssignment(false);
    }
  }, [loadData, selectedRole, selectedUserId, selectedVenueId]);

  const renderUserCard = ({ item }: { item: AdminUser }) => {
    const selected = item.id === selectedUserId;

    return (
      <TouchableOpacity
        style={[styles.userCard, selected ? styles.userCardSelected : null]}
        onPress={() => onSelectUser(item)}
      >
        <View style={styles.userMainInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userMeta} numberOfLines={1}>{item.email || "Email non disponibile"}</Text>
          <Text style={styles.userMeta} numberOfLines={1}>{item.role}</Text>
          <Text style={styles.userMeta}>Locale: {item.venueName ?? "Nessuno"}</Text>
        </View>

        <View style={styles.userSideInfo}>
          <View style={[styles.statusBadge, item.status === "Attivo" ? styles.statusActive : styles.statusInactive]}>
            <Text style={styles.statusBadgeText}>{item.status}</Text>
          </View>
          <Text style={styles.userSideMeta}>{formatDateTime(item.lastActivityAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Utenti, ruoli e assegnazioni</Text>
        <Text style={styles.heroSubtitle}>Gestione veloce anche con molti utenti, locali e manager.</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Caricamento utenti...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Feather name="alert-triangle" size={16} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading ? (
        <View style={styles.kpiRow}>
          <KpiCard label="Utenti" value={String(users.length)} />
          <KpiCard label="Attivi" value={String(summary.active)} />
          <KpiCard label="Manager" value={String(summary.managers)} />
          <KpiCard label="Assegnati" value={String(summary.assigned)} />
        </View>
      ) : null}

      <View style={styles.assignmentPanel}>
        <Text style={styles.panelTitle}>Assegnazione rapida</Text>
        <Text style={styles.panelSubtitle}>1) scegli utente • 2) scegli ruolo • 3) scegli locale (se richiesto)</Text>

        <View style={styles.selectedSummary}>
          <Text style={styles.selectedSummaryTitle}>{selectedUser?.name ?? "Nessun utente selezionato"}</Text>
          <Text style={styles.selectedSummaryText}>
            Ruolo attuale: {selectedUser?.role ?? "-"} • Locale: {selectedUser?.venueName ?? "Nessuno"}
          </Text>
          <Text style={styles.selectedSummaryMeta}>
            Ultima attività: {formatDateTime(selectedUser?.lastActivityAt)} • Sessioni 30g: {selectedUser?.sessions30d ?? 0}
          </Text>
        </View>

        <View style={styles.rolesRow}>
          {ROLES.map((role) => {
            const selected = selectedRole === role.key;
            return (
              <TouchableOpacity
                key={role.key}
                style={[styles.roleButton, selected ? styles.roleButtonSelected : null]}
                onPress={() => setSelectedRole(role.key)}
              >
                <Text style={[styles.roleButtonText, selected ? styles.roleButtonTextSelected : null]}>{role.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {(selectedRole === "venue" || selectedRole === "staff") ? (
          <View style={styles.venueSelector}>
            <TextInput
              value={venueSearch}
              onChangeText={setVenueSearch}
              placeholder="Cerca locale per nome/città"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
            <View style={styles.venueList}>
              <TouchableOpacity
                style={[styles.venueItem, selectedVenueId === null ? styles.venueItemSelected : null]}
                onPress={() => setSelectedVenueId(null)}
              >
                <Text style={[styles.venueItemText, selectedVenueId === null ? styles.venueItemTextSelected : null]}>Nessun locale</Text>
              </TouchableOpacity>
              {filteredVenues.map((venue) => {
                const selected = selectedVenueId === venue.id;
                return (
                  <TouchableOpacity
                    key={venue.id}
                    style={[styles.venueItem, selected ? styles.venueItemSelected : null]}
                    onPress={() => setSelectedVenueId(venue.id)}
                  >
                    <Text style={[styles.venueItemText, selected ? styles.venueItemTextSelected : null]} numberOfLines={1}>
                      {venue.name} • {venue.city}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <TouchableOpacity style={styles.primaryButton} onPress={() => void onSaveAssignment()} disabled={savingAssignment}>
          {savingAssignment ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <>
              <Feather name="save" size={16} color={theme.colors.text} />
              <Text style={styles.primaryButtonText}>Salva assegnazione</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Lista utenti</Text>
        <Text style={styles.sectionSubtitle}>Filtra e seleziona rapidamente</Text>
      </View>

      <TextInput
        value={userSearch}
        onChangeText={setUserSearch}
        placeholder="Cerca utente per nome, email, locale"
        placeholderTextColor={theme.colors.muted}
        style={styles.input}
      />

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((item) => {
          const selected = statusFilter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterChip, selected ? styles.filterChipSelected : null]}
              onPress={() => setStatusFilter(item.key)}
            >
              <Text style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, roleFilter === "all" ? styles.filterChipSelected : null]}
          onPress={() => setRoleFilter("all")}
        >
          <Text style={[styles.filterChipText, roleFilter === "all" ? styles.filterChipTextSelected : null]}>Tutti i ruoli</Text>
        </TouchableOpacity>
        {ROLES.map((item) => {
          const selected = roleFilter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterChip, selected ? styles.filterChipSelected : null]}
              onPress={() => setRoleFilter(item.key)}
            >
              <Text style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.resultHint}>Risultati: {filteredUsers.length}</Text>
    </View>
  );

  return (
    <FlatList
      data={filteredUsers}
      keyExtractor={(item) => item.id}
      renderItem={renderUserCard}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Feather name="users" size={22} color={theme.colors.muted} />
          <Text style={styles.emptyText}>Nessun utente trovato con i filtri correnti</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadData(true)}
          tintColor={theme.colors.primary}
        />
      }
    />
  );

  function KpiCard({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={styles.kpiValue}>{value}</Text>
      </View>
    );
  }
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 140,
    },
    container: {
      gap: 12,
      marginBottom: 12,
    },
    heroCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 14,
      gap: 6,
    },
    heroTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.text,
    },
    heroSubtitle: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "600",
      lineHeight: 18,
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
    kpiRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    kpiCard: {
      width: "48%",
      minHeight: 76,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 10,
      justifyContent: "space-between",
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    kpiValue: {
      fontSize: 17,
      fontWeight: "900",
      color: theme.colors.text,
    },
    assignmentPanel: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 12,
      gap: 10,
    },
    panelTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: theme.colors.text,
    },
    panelSubtitle: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    selectedSummary: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 10,
      gap: 3,
    },
    selectedSummaryTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    selectedSummaryText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "600",
    },
    selectedSummaryMeta: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: "600",
    },
    rolesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    roleButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    roleButtonSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}22`,
    },
    roleButtonText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    roleButtonTextSelected: {
      color: theme.colors.primary,
    },
    venueSelector: {
      gap: 8,
    },
    venueList: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 8,
      gap: 6,
      maxHeight: 180,
    },
    venueItem: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    venueItemSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}22`,
    },
    venueItemText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    venueItemTextSelected: {
      color: theme.colors.primary,
    },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      fontWeight: "600",
    },
    primaryButton: {
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      minHeight: 42,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryButtonText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    sectionHeader: {
      marginTop: 4,
      gap: 2,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: theme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    filterChipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}22`,
    },
    filterChipText: {
      fontSize: 11,
      color: theme.colors.text,
      fontWeight: "700",
    },
    filterChipTextSelected: {
      color: theme.colors.primary,
    },
    resultHint: {
      fontSize: 11,
      color: theme.colors.muted,
      fontWeight: "700",
    },
    userCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    userCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}14`,
    },
    userMainInfo: {
      flex: 1,
      gap: 2,
    },
    userName: {
      fontSize: 14,
      fontWeight: "900",
      color: theme.colors.text,
    },
    userMeta: {
      fontSize: 11,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    userSideInfo: {
      alignItems: "flex-end",
      gap: 5,
    },
    userSideMeta: {
      fontSize: 10,
      color: theme.colors.muted,
      fontWeight: "600",
      maxWidth: 100,
      textAlign: "right",
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusActive: {
      borderColor: theme.colors.accent,
      backgroundColor: `${theme.colors.accent}22`,
    },
    statusInactive: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    statusBadgeText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: "800",
    },
    emptyState: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingVertical: 22,
      alignItems: "center",
      gap: 8,
    },
    emptyText: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: "600",
    },
  });
