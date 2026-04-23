import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import {
  fetchAdminUsers,
  fetchAdminVenues,
  updateAdminUserAssignment,
} from "../../../services/admin";
import type { AdminUser, AdminVenue } from "../../../types/admin";
import {
  formatCompactNumber,
  formatDateTime,
  formatRelativeDate,
} from "../adminUtils";

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

function normalizeRole(value?: string): UserRole {
  if (value === "staff" || value === "venue" || value === "admin") return value;
  return "client";
}

export default function AdminUsersTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("client");
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [venueSearch, setVenueSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const loadData = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setError(null);
      const [usersData, venuesData] = await Promise.all([
        fetchAdminUsers({ force: asRefresh }),
        fetchAdminVenues({ force: asRefresh }),
      ]);
      setUsers(usersData);
      setVenues(venuesData);

      const nextSelectedId =
        usersData.find((user) => user.id === selectedUserId)?.id ?? usersData[0]?.id ?? null;
      setSelectedUserId(nextSelectedId);

      const selectedUser = usersData.find((user) => user.id === nextSelectedId);
      if (selectedUser) {
        setSelectedRole(normalizeRole(selectedUser.roleKey));
        setSelectedVenueId(selectedUser.venueId ?? null);
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

  const summary = useMemo(() => {
    const active = users.filter((user) => user.status === "Attivo").length;
    const inactive = users.length - active;
    const assigned = users.filter((user) => Boolean(user.venueId)).length;
    const managers = users.filter((user) => normalizeRole(user.roleKey) === "venue").length;
    const staff = users.filter((user) => normalizeRole(user.roleKey) === "staff").length;
    const unassignedOperators = users.filter((user) => {
      const role = normalizeRole(user.roleKey);
      return (role === "venue" || role === "staff") && !user.venueId;
    }).length;

    return { active, inactive, assigned, managers, staff, unassignedOperators };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && normalizeRole(user.roleKey) !== roleFilter) return false;
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      if (!query) return true;

      const haystack = [
        user.name,
        user.email ?? "",
        user.role,
        user.venueName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [users, search, roleFilter, statusFilter]);

  const suggestedUsers = useMemo(
    () => users
      .filter((user) => {
        const role = normalizeRole(user.roleKey);
        return user.status === "Inattivo" || ((role === "venue" || role === "staff") && !user.venueId);
      })
      .slice(0, 4),
    [users],
  );

  const filteredVenues = useMemo(() => {
    const query = venueSearch.trim().toLowerCase();
    if (!query) return venues.slice(0, 8);
    return venues
      .filter((venue) => `${venue.name} ${venue.city}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [venueSearch, venues]);

  const handleSelectUser = useCallback((user: AdminUser) => {
    setSelectedUserId(user.id);
    setSelectedRole(normalizeRole(user.roleKey));
    setSelectedVenueId(user.venueId ?? null);
  }, []);

  const handleSaveAssignment = useCallback(async () => {
    if (!selectedUserId) {
      setError("Seleziona prima un utente");
      return;
    }

    if ((selectedRole === "venue" || selectedRole === "staff") && !selectedVenueId) {
      setError("Manager e staff devono avere un locale assegnato");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await updateAdminUserAssignment(selectedUserId, {
        role: selectedRole,
        venue_id: selectedRole === "venue" || selectedRole === "staff" ? selectedVenueId : null,
      });
      await loadData(false);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Salvataggio non riuscito"));
    } finally {
      setSaving(false);
    }
  }, [loadData, selectedRole, selectedUserId, selectedVenueId]);

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
          <Text style={styles.heroEyebrow}>NIGHTHUB USERS</Text>
          <Text style={styles.heroTitle}>Ruoli, assegnazioni e stati utente</Text>
          <Text style={styles.heroSubtitle}>
            Centro operativo per riallineare manager e staff ai locali corretti e ridurre account non presidiati.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
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

        <View style={styles.kpiGrid}>
          <KpiCard label="Utenti totali" value={formatCompactNumber(users.length)} note={`${summary.active} attivi`} />
          <KpiCard label="Operatori assegnati" value={formatCompactNumber(summary.assigned)} note={`${summary.unassignedOperators} da sistemare`} />
          <KpiCard label="Manager" value={formatCompactNumber(summary.managers)} note={`${summary.staff} staff`} />
          <KpiCard label="Inattivi" value={formatCompactNumber(summary.inactive)} note="Da riattivare o riposizionare" />
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.panelTitle}>Assegnazione rapida</Text>
          <Text style={styles.panelSubtitle}>
            Cambia ruolo e locale del profilo selezionato senza uscire dalla lista.
          </Text>

          <View style={styles.selectedCard}>
            <Text style={styles.selectedName}>{selectedUser?.name ?? "Nessun utente selezionato"}</Text>
            <Text style={styles.selectedMeta}>
              {selectedUser?.email ?? "Email non disponibile"}
            </Text>
            <Text style={styles.selectedMeta}>
              Ruolo attuale {selectedUser?.role ?? "-"} • Locale {selectedUser?.venueName ?? "nessuno"}
            </Text>
            <Text style={styles.selectedHint}>
              Ultima attivita {formatRelativeDate(selectedUser?.lastActivityAt)} • Sessioni 30g {selectedUser?.sessions30d ?? 0}
            </Text>
          </View>

          <View style={styles.chipsWrap}>
            {ROLES.map((role) => {
              const active = selectedRole === role.key;
              return (
                <TouchableOpacity
                  key={role.key}
                  style={[styles.choiceChip, active ? styles.choiceChipActive : null]}
                  onPress={() => setSelectedRole(role.key)}
                >
                  <Text style={[styles.choiceChipText, active ? styles.choiceChipTextActive : null]}>
                    {role.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {(selectedRole === "venue" || selectedRole === "staff") ? (
            <>
              <TextInput
                value={venueSearch}
                onChangeText={setVenueSearch}
                placeholder="Cerca locale per nome o citta"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />

              <View style={styles.venueList}>
                {filteredVenues.map((venue) => {
                  const active = selectedVenueId === venue.id;
                  return (
                    <TouchableOpacity
                      key={venue.id}
                      style={[styles.venueRow, active ? styles.venueRowActive : null]}
                      onPress={() => setSelectedVenueId(venue.id)}
                    >
                      <View style={styles.venueRowCopy}>
                        <Text style={styles.venueRowName}>{venue.name}</Text>
                        <Text style={styles.venueRowMeta}>{venue.city} • {venue.status}</Text>
                      </View>
                      <Feather
                        name={active ? "check-circle" : "circle"}
                        size={18}
                        color={active ? theme.colors.primary : theme.colors.muted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}

          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSaveAssignment()} disabled={saving}>
            {saving ? (
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
          <Text style={styles.sectionTitle}>Utenti da attenzionare</Text>
          <Text style={styles.sectionSubtitle}>Le situazioni che bloccano operativita o richiedono follow-up.</Text>
        </View>

        <View style={styles.alertListCard}>
          {suggestedUsers.length === 0 ? (
            <Text style={styles.emptyText}>Nessuna anomalia rilevante al momento.</Text>
          ) : (
            suggestedUsers.map((user) => {
              const role = normalizeRole(user.roleKey);
              const isUnassignedOperator = (role === "venue" || role === "staff") && !user.venueId;
              return (
                <TouchableOpacity key={user.id} style={styles.alertRow} onPress={() => handleSelectUser(user)}>
                  <View style={styles.alertIconWrap}>
                    <Feather
                      name={user.status === "Inattivo" ? "moon" : "briefcase"}
                      size={15}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.alertCopy}>
                    <Text style={styles.alertTitle}>{user.name}</Text>
                    <Text style={styles.alertDetail}>
                      {user.status === "Inattivo"
                        ? `Ultima attivita ${formatRelativeDate(user.lastActivityAt)}`
                        : isUnassignedOperator
                          ? `${user.role} senza locale assegnato`
                          : `${user.role} • ${user.venueName ?? "nessun locale"}`}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.colors.muted} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lista utenti</Text>
          <Text style={styles.sectionSubtitle}>Filtro rapido per ruolo, stato e locale associato.</Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca nome, email, ruolo o locale"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, styles.searchInput]}
          />
          <TouchableOpacity
            style={[styles.filterToggleButton, filterOpen ? styles.filterToggleButtonActive : null]}
            onPress={() => setFilterOpen((current) => !current)}
          >
            <Feather name="sliders" size={16} color={filterOpen ? theme.colors.primary : theme.colors.muted} />
          </TouchableOpacity>
        </View>

        {filterOpen ? (
          <>
            <View style={styles.chipsWrap}>
              {STATUS_FILTERS.map((item) => {
                const active = statusFilter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.filterChip, active ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(item.key)}
                  >
                    <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.chipsWrap}>
              <TouchableOpacity
                style={[styles.filterChip, roleFilter === "all" ? styles.filterChipActive : null]}
                onPress={() => setRoleFilter("all")}
              >
                <Text style={[styles.filterChipText, roleFilter === "all" ? styles.filterChipTextActive : null]}>
                  Tutti i ruoli
                </Text>
              </TouchableOpacity>
              {ROLES.map((role) => {
                const active = roleFilter === role.key;
                return (
                  <TouchableOpacity
                    key={role.key}
                    style={[styles.filterChip, active ? styles.filterChipActive : null]}
                    onPress={() => setRoleFilter(role.key)}
                  >
                    <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{role.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.resultsHint}>Risultati {filteredUsers.length}</Text>

        <View style={styles.userList}>
          {filteredUsers.map((user) => {
            const active = selectedUserId === user.id;
            const role = normalizeRole(user.roleKey);
            const needsVenue = (role === "venue" || role === "staff") && !user.venueId;
            return (
              <TouchableOpacity
                key={user.id}
                style={[styles.userCard, active ? styles.userCardActive : null]}
                onPress={() => handleSelectUser(user)}
              >
                <View style={styles.userCardMain}>
                  <View style={styles.userCardTopRow}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <View style={[styles.statusBadge, user.status === "Attivo" ? styles.statusBadgeActive : null]}>
                      <Text style={styles.statusBadgeText}>{user.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.userMeta}>{user.email ?? "Email non disponibile"}</Text>
                  <Text style={styles.userMeta}>{user.role} • {user.venueName ?? "nessun locale"}</Text>
                  <Text style={styles.userHint}>
                    Ultimo accesso {formatRelativeDate(user.lastActivityAt)} • Sessioni 30g {user.sessions30d ?? 0}
                  </Text>
                </View>
                <View style={styles.userCardSide}>
                  {needsVenue ? (
                    <Text style={styles.sideWarning}>Assegna locale</Text>
                  ) : null}
                  <Text style={styles.sideMeta}>{formatDateTime(user.lastActivityAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {filteredUsers.length === 0 ? <Text style={styles.emptyText}>Nessun utente trovato con i filtri correnti.</Text> : null}
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
      color: theme.colors.muted,
      fontWeight: "600",
    },
    loadingRow: {
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
      fontWeight: "700",
      color: theme.colors.muted,
      lineHeight: 16,
    },
    panelCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 14,
      gap: 12,
    },
    panelTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.colors.text,
    },
    panelSubtitle: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    selectedCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 12,
      gap: 4,
    },
    selectedName: {
      fontSize: 14,
      fontWeight: "900",
      color: theme.colors.text,
    },
    selectedMeta: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    selectedHint: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    choiceChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    choiceChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}18`,
    },
    choiceChipText: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.colors.text,
    },
    choiceChipTextActive: {
      color: theme.colors.primary,
    },
    input: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 13,
      fontWeight: "600",
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    searchInput: {
      flex: 1,
    },
    filterToggleButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      alignItems: "center",
      justifyContent: "center",
    },
    filterToggleButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}1F`,
    },
    venueList: {
      gap: 8,
    },
    venueRow: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    venueRowActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}16`,
    },
    venueRowCopy: {
      flex: 1,
      gap: 2,
    },
    venueRowName: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.colors.text,
    },
    venueRowMeta: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    primaryButton: {
      minHeight: 44,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    primaryButtonText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    sectionHeader: {
      gap: 4,
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
    alertListCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 14,
      gap: 12,
    },
    alertRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    alertIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${theme.colors.primary}18`,
    },
    alertCopy: {
      flex: 1,
      gap: 2,
    },
    alertTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.colors.text,
    },
    alertDetail: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    filterChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}16`,
    },
    filterChipText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.text,
    },
    filterChipTextActive: {
      color: theme.colors.primary,
    },
    resultsHint: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    userList: {
      gap: 10,
    },
    userCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      padding: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    userCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}14`,
    },
    userCardMain: {
      flex: 1,
      gap: 4,
    },
    userCardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    userName: {
      flex: 1,
      fontSize: 14,
      fontWeight: "900",
      color: theme.colors.text,
    },
    userMeta: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    userHint: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    userCardSide: {
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 6,
      maxWidth: 96,
    },
    sideWarning: {
      fontSize: 10,
      fontWeight: "900",
      color: theme.colors.error,
      textAlign: "right",
    },
    sideMeta: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.muted,
      textAlign: "right",
    },
    statusBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    statusBadgeActive: {
      borderColor: theme.colors.accent,
      backgroundColor: `${theme.colors.accent}18`,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: "900",
      color: theme.colors.text,
    },
    emptyText: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
      color: theme.colors.muted,
    },
  });