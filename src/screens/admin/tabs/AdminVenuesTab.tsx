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
  createAdminVenue,
  fetchAdminUsers,
  fetchAdminVenues,
  updateAdminVenueContract,
} from "../../../services/admin";
import { AdminUser, AdminVenue } from "../../../types/admin";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

type CreateVenueForm = {
  name: string;
  city: string;
  radius: string;
  contractStartAt: string;
  contractEndAt: string;
  contractMonthlyFee: string;
  managerUserId: string;
};

type ContractEditState = {
  venueId: string;
  contractStartAt: string;
  contractEndAt: string;
  contractStatus: string;
  contractMonthlyFee: string;
  contractNotes: string;
  contractAutoRenew: boolean;
};

const INITIAL_CREATE_FORM: CreateVenueForm = {
  name: "",
  city: "",
  radius: "100",
  contractStartAt: "",
  contractEndAt: "",
  contractMonthlyFee: "",
  managerUserId: "",
};

export default function AdminVenuesTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateVenueForm>(INITIAL_CREATE_FORM);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractEditState | null>(null);
  const [savingContract, setSavingContract] = useState(false);

  const loadVenues = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [venuesData, usersData] = await Promise.all([fetchAdminVenues(), fetchAdminUsers()]);
      setVenues(venuesData);
      setUsers(usersData);
      const firstAssignable = usersData.find((user) => user.roleKey !== "admin");
      if (firstAssignable) {
        setCreateForm((prev) => (prev.managerUserId ? prev : { ...prev, managerUserId: firstAssignable.id }));
      }
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Errore caricamento locali"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadVenues(false);
  }, [loadVenues]);

  const summary = useMemo(() => {
    const monthlyRevenue = venues.reduce((acc, venue) => acc + (venue.revenue || 0), 0);
    const expiringSoon = venues.filter((venue) => {
      const daysLeft = venue.contractDaysLeft;
      return typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 30;
    }).length;
    const withManager = venues.filter((venue) => Boolean(venue.managerUserId)).length;

    return {
      monthlyRevenue,
      expiringSoon,
      withManager,
    };
  }, [venues]);

  const onCreateVenue = useCallback(async () => {
    const name = createForm.name.trim();
    if (!name) {
      setError("Inserisci il nome del locale");
      return;
    }

    setSubmittingCreate(true);
    setError(null);

    try {
      await createAdminVenue({
        name,
        city: createForm.city.trim() || undefined,
        radius_geofence: createForm.radius.trim() ? Number(createForm.radius) : undefined,
        contract_start_at: createForm.contractStartAt.trim() || undefined,
        contract_end_at: createForm.contractEndAt.trim() || undefined,
        contract_monthly_fee: createForm.contractMonthlyFee.trim()
          ? Number(createForm.contractMonthlyFee)
          : undefined,
        contract_status: createForm.contractEndAt.trim() ? "active" : undefined,
        manager_user_id: createForm.managerUserId.trim() || undefined,
      });

      setCreateForm(INITIAL_CREATE_FORM);
      await loadVenues(false);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Creazione locale non riuscita"));
    } finally {
      setSubmittingCreate(false);
    }
  }, [createForm, loadVenues]);

  const openContractEditor = useCallback((venue: AdminVenue) => {
    setEditingContract({
      venueId: venue.id,
      contractStartAt: venue.contractStartAt ? venue.contractStartAt.slice(0, 10) : "",
      contractEndAt: venue.contractExpiresAt ? venue.contractExpiresAt.slice(0, 10) : "",
      contractStatus: venue.contractStatus ?? "active",
      contractMonthlyFee:
        venue.contractMonthlyFee === null || venue.contractMonthlyFee === undefined
          ? ""
          : String(venue.contractMonthlyFee),
      contractNotes: venue.contractNotes ?? "",
      contractAutoRenew: Boolean(venue.contractAutoRenew),
    });
  }, []);

  const onSaveContract = useCallback(async () => {
    if (!editingContract) return;

    setSavingContract(true);
    setError(null);

    try {
      await updateAdminVenueContract(editingContract.venueId, {
        contract_start_at: editingContract.contractStartAt.trim() || null,
        contract_end_at: editingContract.contractEndAt.trim() || null,
        contract_status: editingContract.contractStatus.trim() || null,
        contract_monthly_fee: editingContract.contractMonthlyFee.trim()
          ? Number(editingContract.contractMonthlyFee)
          : null,
        contract_notes: editingContract.contractNotes.trim() || null,
        contract_auto_renew: editingContract.contractAutoRenew,
      });

      setEditingContract(null);
      await loadVenues(false);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Aggiornamento contratto non riuscito"));
    } finally {
      setSavingContract(false);
    }
  }, [editingContract, loadVenues]);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadVenues(true)}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Gestione Locali & Contratti</Text>
          <Text style={styles.heroSubtitle}>
            Crea nuovi locali, monitora scadenze contrattuali e aggiorna i dati economici in un unico punto.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Caricamento locali...</Text>
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
            <KpiCard label="Locali monitorati" value={String(venues.length)} />
            <KpiCard label="Scadenze 30g" value={String(summary.expiringSoon)} />
            <KpiCard label="Manager assegnati" value={`${summary.withManager}/${venues.length || 0}`} />
            <KpiCard label="Ricavi mese" value={currencyFormatter.format(summary.monthlyRevenue)} />
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Nuovo locale</Text>
          <Text style={styles.panelSubtitle}>Compila i campi essenziali e assegna subito un utente manager: il ruolo verrà aggiornato automaticamente.</Text>

          <TextInput
            value={createForm.name}
            onChangeText={(value) => setCreateForm((prev) => ({ ...prev, name: value }))}
            placeholder="Nome locale"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
          <TextInput
            value={createForm.city}
            onChangeText={(value) => setCreateForm((prev) => ({ ...prev, city: value }))}
            placeholder="Città"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />

          <View style={styles.inlineInputs}>
            <TextInput
              value={createForm.radius}
              onChangeText={(value) => setCreateForm((prev) => ({ ...prev, radius: value.replace(/[^0-9]/g, "") }))}
              placeholder="Raggio geofence"
              placeholderTextColor={theme.colors.muted}
              keyboardType="number-pad"
              style={[styles.input, styles.inlineInput]}
            />
            <TextInput
              value={createForm.contractMonthlyFee}
              onChangeText={(value) =>
                setCreateForm((prev) => ({ ...prev, contractMonthlyFee: value.replace(/[^0-9.]/g, "") }))
              }
              placeholder="Canone mensile €"
              placeholderTextColor={theme.colors.muted}
              keyboardType="decimal-pad"
              style={[styles.input, styles.inlineInput]}
            />
          </View>

          <TextInput
            value={createForm.contractEndAt}
            onChangeText={(value) => setCreateForm((prev) => ({ ...prev, contractEndAt: value }))}
            placeholder="Scadenza contratto (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />

          <TextInput
            value={createForm.contractStartAt}
            onChangeText={(value) => setCreateForm((prev) => ({ ...prev, contractStartAt: value }))}
            placeholder="Inizio contratto (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />

          <View style={styles.assignBlock}>
            <Text style={styles.assignLabel}>Assegna manager locale (auto ruolo Venue)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <TouchableOpacity
                style={[styles.assignChip, !createForm.managerUserId ? styles.assignChipSelected : null]}
                onPress={() => setCreateForm((prev) => ({ ...prev, managerUserId: "" }))}
              >
                <Text style={[styles.assignChipText, !createForm.managerUserId ? styles.assignChipTextSelected : null]}>Nessuno</Text>
              </TouchableOpacity>
              {users
                .filter((user) => user.roleKey !== "admin")
                .map((user) => {
                  const selected = createForm.managerUserId === user.id;
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={[styles.assignChip, selected ? styles.assignChipSelected : null]}
                      onPress={() => setCreateForm((prev) => ({ ...prev, managerUserId: user.id }))}
                    >
                      <Text style={[styles.assignChipText, selected ? styles.assignChipTextSelected : null]} numberOfLines={1}>
                        {user.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
            <Text style={styles.assignHint}>
              Se selezioni un utente, alla creazione locale verrà associato al locale e impostato automaticamente con ruolo Venue.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => void onCreateVenue()} disabled={submittingCreate}>
            {submittingCreate ? (
              <ActivityIndicator size="small" color={theme.colors.text} />
            ) : (
              <>
                <Feather name="plus-circle" size={16} color={theme.colors.text} />
                <Text style={styles.primaryButtonText}>Crea locale</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dettaglio locali</Text>
          <Text style={styles.sectionSubtitle}>Manager, stato operativo e scadenza contratto in un colpo d’occhio</Text>
        </View>

        {venues.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={24} color={theme.colors.muted} />
            <Text style={styles.emptyText}>Nessun locale disponibile</Text>
          </View>
        ) : (
          venues.map((venue) => {
            const isEditing = editingContract?.venueId === venue.id;
            const daysLeft = venue.contractDaysLeft;
            const isExpiringSoon = typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 30;

            return (
              <View key={venue.id} style={styles.venueCard}>
                <TouchableOpacity style={styles.venueHeader} onPress={() => openContractEditor(venue)}>
                  <View style={styles.venueMainInfo}>
                    <Text style={styles.venueName}>{venue.name}</Text>
                    <Text style={styles.venueMeta}>
                      {venue.city} • {venue.status}
                    </Text>
                    <View style={styles.badgesRow}>
                      <Text style={[styles.infoBadge, venue.managerUserId ? styles.infoBadgeOk : styles.infoBadgeWarn]}>
                        {venue.managerUserId ? "Manager assegnato" : "Manager da assegnare"}
                      </Text>
                      <Text style={styles.infoBadge}>Occupazione {venue.occupancy}%</Text>
                    </View>
                    <Text style={styles.managerText}>
                      Manager: {venue.managerName ?? "Non assegnato"}
                      {venue.managerEmail ? ` • ${venue.managerEmail}` : ""}
                    </Text>
                    <Text style={styles.venueMeta}>
                      LIVE {venue.eventsActive ?? 0} • CHIUSI mese {venue.eventsCompletedMonth ?? 0}
                    </Text>
                  </View>
                  <View style={styles.venueStats}>
                    <Text style={styles.venueRevenue}>{currencyFormatter.format(venue.revenue)}</Text>
                    <Text style={styles.venueStatText}>Canone {venue.contractMonthlyFee ? currencyFormatter.format(venue.contractMonthlyFee) : "N/D"}</Text>
                    {venue.contractExpiresAt ? (
                      <Text style={[styles.contractBadge, isExpiringSoon ? styles.contractBadgeWarning : null]}>
                        {isExpiringSoon ? "Scadenza urgente" : "Scadenza"} {dateFormatter.format(new Date(venue.contractExpiresAt))}
                      </Text>
                    ) : (
                      <Text style={styles.contractBadge}>Contratto non impostato</Text>
                    )}
                  </View>
                </TouchableOpacity>

                {isEditing && editingContract ? (
                  <View style={styles.contractEditor}>
                    <TextInput
                      value={editingContract.contractStatus}
                      onChangeText={(value) => setEditingContract((prev) => (prev ? { ...prev, contractStatus: value } : prev))}
                      placeholder="Stato contratto (active, pending, expired...)"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />

                    <View style={styles.inlineInputs}>
                      <TextInput
                        value={editingContract.contractStartAt}
                        onChangeText={(value) => setEditingContract((prev) => (prev ? { ...prev, contractStartAt: value } : prev))}
                        placeholder="Inizio (YYYY-MM-DD)"
                        placeholderTextColor={theme.colors.muted}
                        style={[styles.input, styles.inlineInput]}
                      />
                      <TextInput
                        value={editingContract.contractEndAt}
                        onChangeText={(value) => setEditingContract((prev) => (prev ? { ...prev, contractEndAt: value } : prev))}
                        placeholder="Fine (YYYY-MM-DD)"
                        placeholderTextColor={theme.colors.muted}
                        style={[styles.input, styles.inlineInput]}
                      />
                    </View>

                    <TextInput
                      value={editingContract.contractMonthlyFee}
                      onChangeText={(value) =>
                        setEditingContract((prev) =>
                          prev ? { ...prev, contractMonthlyFee: value.replace(/[^0-9.]/g, "") } : prev,
                        )
                      }
                      placeholder="Canone mensile €"
                      placeholderTextColor={theme.colors.muted}
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />

                    <TextInput
                      value={editingContract.contractNotes}
                      onChangeText={(value) => setEditingContract((prev) => (prev ? { ...prev, contractNotes: value } : prev))}
                      placeholder="Note contratto"
                      placeholderTextColor={theme.colors.muted}
                      style={[styles.input, styles.textArea]}
                      multiline
                    />

                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() =>
                        setEditingContract((prev) => (prev ? { ...prev, contractAutoRenew: !prev.contractAutoRenew } : prev))
                      }
                    >
                      <Feather
                        name={editingContract.contractAutoRenew ? "check-square" : "square"}
                        size={16}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.secondaryButtonText}>Rinnovo automatico</Text>
                    </TouchableOpacity>

                    <View style={styles.editorActions}>
                      <TouchableOpacity style={styles.ghostButton} onPress={() => setEditingContract(null)}>
                        <Text style={styles.ghostButtonText}>Annulla</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.primaryButton} onPress={() => void onSaveContract()} disabled={savingContract}>
                        {savingContract ? (
                          <ActivityIndicator size="small" color={theme.colors.text} />
                        ) : (
                          <>
                            <Feather name="save" size={16} color={theme.colors.text} />
                            <Text style={styles.primaryButtonText}>Salva contratto</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
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
      paddingBottom: 140,
    },
    container: {
      paddingHorizontal: 20,
      paddingTop: 14,
      gap: 14,
    },
    heroCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 14,
      gap: 6,
    },
    heroTitle: {
      fontSize: 20,
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
      gap: 10,
    },
    kpiCard: {
      width: "48%",
      minHeight: 82,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 12,
      justifyContent: "space-between",
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.text,
    },
    panel: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 14,
      gap: 8,
    },
    panelTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.colors.text,
    },
    panelSubtitle: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "600",
      marginBottom: 4,
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
    assignBlock: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 10,
      gap: 8,
    },
    assignLabel: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    chipsRow: {
      gap: 8,
      paddingVertical: 2,
    },
    assignChip: {
      maxWidth: 170,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    assignChipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}22`,
    },
    assignChipText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    assignChipTextSelected: {
      color: theme.colors.primary,
    },
    assignHint: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 16,
    },
    inlineInputs: {
      flexDirection: "row",
      gap: 8,
    },
    inlineInput: {
      flex: 1,
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
      marginTop: 6,
      gap: 2,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    emptyState: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingVertical: 26,
      alignItems: "center",
      gap: 8,
    },
    emptyText: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: "600",
    },
    venueCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      overflow: "hidden",
    },
    venueHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
      padding: 14,
    },
    venueMainInfo: {
      flex: 1,
      gap: 5,
    },
    venueName: {
      fontSize: 15,
      fontWeight: "900",
      color: theme.colors.text,
    },
    venueMeta: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    badgesRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    infoBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    infoBadgeOk: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}22`,
    },
    infoBadgeWarn: {
      borderColor: theme.colors.error,
      backgroundColor: `${theme.colors.error}22`,
    },
    managerText: {
      fontSize: 11,
      color: theme.colors.text,
      fontWeight: "700",
    },
    venueStats: {
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 5,
    },
    venueRevenue: {
      fontSize: 13,
      color: theme.colors.primary,
      fontWeight: "900",
    },
    venueStatText: {
      fontSize: 11,
      color: theme.colors.text,
      fontWeight: "700",
    },
    contractBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    contractBadgeWarning: {
      borderColor: theme.colors.error,
      backgroundColor: `${theme.colors.error}22`,
    },
    contractEditor: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      padding: 12,
      gap: 8,
    },
    textArea: {
      minHeight: 72,
      textAlignVertical: "top",
    },
    secondaryButton: {
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    editorActions: {
      flexDirection: "row",
      gap: 8,
    },
    ghostButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostButtonText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
  });
