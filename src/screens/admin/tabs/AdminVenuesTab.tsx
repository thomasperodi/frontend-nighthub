import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
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

type VenueStatus = "active" | "expiring" | "inactive" | "overuse";
type VenueDetailTab = "overview" | "contract" | "usage" | "extra" | "manager" | "notes";

const DETAIL_TABS: Array<{ key: VenueDetailTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "contract", label: "Abbonamento" },
  { key: "usage", label: "Utilizzo" },
  { key: "extra", label: "Extra" },
  { key: "manager", label: "Manager" },
  { key: "notes", label: "Note" },
];

const INITIAL_CREATE_FORM: CreateVenueForm = {
  name: "",
  city: "",
  radius: "100",
  contractStartAt: "",
  contractEndAt: "",
  contractMonthlyFee: "",
  managerUserId: "",
};

function isVenueOperational(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "active" || normalized === "operativo";
}

function resolveVenueStatus(venue: AdminVenue): VenueStatus {
  const daysLeft = venue.contractDaysLeft;
  const isExpiringSoon = typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 30;
  if (isExpiringSoon) return "expiring";
  if ((venue.occupancy ?? 0) > 100) return "overuse";
  if (!isVenueOperational(venue.status)) return "inactive";
  return "active";
}

function statusLabel(status: VenueStatus) {
  if (status === "active") return "Attivo";
  if (status === "expiring") return "In scadenza";
  if (status === "overuse") return "Over-uso";
  return "Inattivo";
}

function usageLimitFromFee(fee: number | null | undefined) {
  if (!fee || fee < 40) return { events: 2, people: 600, plan: "ESSENTIAL" };
  if (fee < 90) return { events: 6, people: 2500, plan: "PULSE" };
  return { events: 12, people: 6000, plan: "PEAK" };
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(value, 100));
}

export default function AdminVenuesTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | VenueStatus>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateVenueForm>(INITIAL_CREATE_FORM);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const [selectedVenue, setSelectedVenue] = useState<AdminVenue | null>(null);
  const [activeTab, setActiveTab] = useState<VenueDetailTab>("overview");
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
    const overUse = venues.filter((venue) => resolveVenueStatus(venue) === "overuse").length;

    return {
      monthlyRevenue,
      expiringSoon,
      withManager,
      overUse,
    };
  }, [venues]);

  const filteredVenues = useMemo(() => {
    const query = search.trim().toLowerCase();
    return venues.filter((venue) => {
      const status = resolveVenueStatus(venue);
      const statusMatch = statusFilter === "all" || status === statusFilter;
      if (!statusMatch) return false;
      if (!query) return true;
      return `${venue.name} ${venue.city} ${venue.managerName ?? ""}`.toLowerCase().includes(query);
    });
  }, [search, statusFilter, venues]);

  const openVenueDetail = useCallback((venue: AdminVenue) => {
    setSelectedVenue(venue);
    setActiveTab("overview");
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

  const closeVenueDetail = useCallback(() => {
    setSelectedVenue(null);
    setEditingContract(null);
  }, []);

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
      setShowCreate(false);
      await loadVenues(false);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Creazione locale non riuscita"));
    } finally {
      setSubmittingCreate(false);
    }
  }, [createForm, loadVenues]);

  const onSaveContract = useCallback(async () => {
    if (!editingContract || !selectedVenue) return;

    setSavingContract(true);
    setError(null);

    try {
      await updateAdminVenueContract(selectedVenue.id, {
        contract_start_at: editingContract.contractStartAt.trim() || null,
        contract_end_at: editingContract.contractEndAt.trim() || null,
        contract_status: editingContract.contractStatus.trim() || null,
        contract_monthly_fee: editingContract.contractMonthlyFee.trim()
          ? Number(editingContract.contractMonthlyFee)
          : null,
        contract_notes: editingContract.contractNotes.trim() || null,
        contract_auto_renew: editingContract.contractAutoRenew,
      });

      await loadVenues(false);
      setSelectedVenue((prev) => {
        if (!prev || prev.id !== selectedVenue.id) return prev;
        return {
          ...prev,
          contractStartAt: editingContract.contractStartAt || null,
          contractExpiresAt: editingContract.contractEndAt || null,
          contractStatus: editingContract.contractStatus || null,
          contractMonthlyFee: editingContract.contractMonthlyFee
            ? Number(editingContract.contractMonthlyFee)
            : null,
          contractNotes: editingContract.contractNotes || null,
          contractAutoRenew: editingContract.contractAutoRenew,
        };
      });
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || "Aggiornamento contratto non riuscito"));
    } finally {
      setSavingContract(false);
    }
  }, [editingContract, loadVenues, selectedVenue]);

  return (
    <>
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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.pageTitle}>Locali</Text>
              <Text style={styles.pageSubtitle}>Contratti, utilizzo e manager in un unico pannello.</Text>
            </View>
            <TouchableOpacity style={styles.newButton} onPress={() => setShowCreate(true)}>
              <Feather name="plus" size={15} color={theme.colors.text} />
              <Text style={styles.newButtonText}>Nuovo</Text>
            </TouchableOpacity>
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
              <KpiCard icon="grid" label="Locali" value={String(venues.length)} />
              <KpiCard icon="clock" label="Scadenze 30g" value={String(summary.expiringSoon)} />
              <KpiCard icon="users" label="Manager" value={`${summary.withManager}/${venues.length || 0}`} />
              <KpiCard icon="trending-up" label="Ricavi" value={currencyFormatter.format(summary.monthlyRevenue)} />
            </View>
          ) : null}

          <View style={styles.searchToolbar}>
            <View style={styles.searchWrap}>
              <Feather name="search" size={14} color={theme.colors.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Cerca locale o citta"
                placeholderTextColor={theme.colors.muted}
                style={styles.searchInput}
              />
            </View>
            <TouchableOpacity
              style={[styles.filterButton, filterOpen ? styles.filterButtonActive : null]}
              onPress={() => setFilterOpen((current) => !current)}
            >
              <Feather name="sliders" size={14} color={filterOpen ? theme.colors.primary : theme.colors.muted} />
            </TouchableOpacity>
          </View>

          {filterOpen ? (
            <View style={styles.filterRow}>
              {[
                { key: "all", label: "Tutti" },
                { key: "active", label: "Attivi" },
                { key: "expiring", label: "In scadenza" },
                { key: "overuse", label: "Over-uso" },
                { key: "inactive", label: "Inattivi" },
              ].map((item) => {
                const active = statusFilter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.filterChip, active ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(item.key as "all" | VenueStatus)}
                  >
                    <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <View style={styles.listSectionHeader}>
            <Text style={styles.listSectionTitle}>Lista locali</Text>
            <Text style={styles.listSectionHint}>Over-uso: {summary.overUse} · Contratti critici: {summary.expiringSoon}</Text>
          </View>

          {venues.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Feather name="map-pin" size={24} color={theme.colors.muted} />
              <Text style={styles.emptyText}>Nessun locale disponibile</Text>
            </View>
          ) : (
            filteredVenues.map((venue) => {
              const status = resolveVenueStatus(venue);
              const limits = usageLimitFromFee(venue.contractMonthlyFee);
              const daysLeft = venue.contractDaysLeft;
              const expiringSoon = typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 30;

              return (
                <TouchableOpacity
                  key={venue.id}
                  style={styles.venueCard}
                  activeOpacity={0.92}
                  onPress={() => openVenueDetail(venue)}
                >
                  <View style={styles.venueTopRow}>
                    <View style={styles.venueMainInfo}>
                      <View style={styles.venueTitleRow}>
                        <Text style={styles.venueName} numberOfLines={1}>
                          {venue.name}
                        </Text>
                        <View
                          style={[
                            styles.statusChip,
                            status === "active" ? styles.statusChipActive : null,
                            status === "expiring" ? styles.statusChipWarning : null,
                            status === "overuse" ? styles.statusChipDanger : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              status === "active" ? styles.statusChipTextActive : null,
                              status === "expiring" ? styles.statusChipTextWarning : null,
                              status === "overuse" ? styles.statusChipTextDanger : null,
                            ]}
                          >
                            {statusLabel(status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.venueMeta}>
                        {venue.city} · {venue.managerName ?? "Manager non assegnato"}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={theme.colors.muted} />
                  </View>

                  <View style={styles.inlineBadges}>
                    <Badge
                      text={`${limits.plan} · ${venue.contractMonthlyFee ? currencyFormatter.format(venue.contractMonthlyFee) : "N/D"}/m`}
                    />
                    <Badge text={`Occupazione ${venue.occupancy}%`} warning={status === "overuse"} />
                    {expiringSoon ? <Badge text={`${daysLeft}gg scad.`} warning /> : null}
                  </View>

                  <View style={styles.venueBottomRow}>
                    <Text style={styles.metricText}>Eventi mese: {venue.eventsCompletedMonth ?? 0}</Text>
                    <Text style={styles.metricText}>Persone: {venue.analyzedPeopleMonth ?? 0}</Text>
                    <Text style={styles.metricRevenue}>{currencyFormatter.format(venue.revenue)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {filteredVenues.length === 0 && venues.length > 0 ? (
            <View style={styles.emptyState}>
              <Feather name="search" size={22} color={theme.colors.muted} />
              <Text style={styles.emptyText}>Nessun locale corrisponde ai filtri.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedVenue)} animationType="fade" transparent onRequestClose={closeVenueDetail}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.overlay} onPress={closeVenueDetail} />
          <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {selectedVenue ? (
            <>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderTextWrap}>
                  <Text style={styles.sheetTitle}>{selectedVenue.name}</Text>
                  <Text style={styles.sheetSubtitle}>
                    {selectedVenue.city} · {usageLimitFromFee(selectedVenue.contractMonthlyFee).plan}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={closeVenueDetail}>
                  <Feather name="x" size={16} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
                {DETAIL_TABS.map((tab) => {
                  const selected = activeTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[styles.tabChip, selected ? styles.tabChipActive : null]}
                      onPress={() => setActiveTab(tab.key)}
                    >
                      <Text style={[styles.tabChipText, selected ? styles.tabChipTextActive : null]}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <ScrollView
                style={styles.sheetBody}
                contentContainerStyle={styles.sheetBodyContent}
                showsVerticalScrollIndicator={false}
              >
                {activeTab === "overview" ? (
                  <View style={styles.infoGrid}>
                    <InfoCard icon="activity" label="Stato" value={statusLabel(resolveVenueStatus(selectedVenue))} />
                    <InfoCard
                      icon="credit-card"
                      label="Fee mensile"
                      value={
                        selectedVenue.contractMonthlyFee
                          ? currencyFormatter.format(selectedVenue.contractMonthlyFee)
                          : "N/D"
                      }
                    />
                    <InfoCard
                      icon="calendar"
                      label="Eventi mese"
                      value={String(selectedVenue.eventsCompletedMonth ?? 0)}
                    />
                    <InfoCard
                      icon="users"
                      label="Persone mese"
                      value={String(selectedVenue.analyzedPeopleMonth ?? 0)}
                    />
                    <InfoCard
                      icon="trending-up"
                      label="Fatturato"
                      value={currencyFormatter.format(selectedVenue.revenue)}
                    />
                    <InfoCard
                      icon="clock"
                      label="Scadenza"
                      value={
                        selectedVenue.contractDaysLeft === null || selectedVenue.contractDaysLeft === undefined
                          ? "N/D"
                          : `${selectedVenue.contractDaysLeft}gg`
                      }
                    />
                  </View>
                ) : null}

                {activeTab === "contract" ? (
                  <>
                    <TextInput
                      value={editingContract?.contractStatus ?? ""}
                      onChangeText={(value) =>
                        setEditingContract((prev) => (prev ? { ...prev, contractStatus: value } : prev))
                      }
                      placeholder="Stato contratto"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                    <View style={styles.inlineInputs}>
                      <TextInput
                        value={editingContract?.contractStartAt ?? ""}
                        onChangeText={(value) =>
                          setEditingContract((prev) => (prev ? { ...prev, contractStartAt: value } : prev))
                        }
                        placeholder="Inizio (YYYY-MM-DD)"
                        placeholderTextColor={theme.colors.muted}
                        style={[styles.input, styles.inlineInput]}
                      />
                      <TextInput
                        value={editingContract?.contractEndAt ?? ""}
                        onChangeText={(value) =>
                          setEditingContract((prev) => (prev ? { ...prev, contractEndAt: value } : prev))
                        }
                        placeholder="Fine (YYYY-MM-DD)"
                        placeholderTextColor={theme.colors.muted}
                        style={[styles.input, styles.inlineInput]}
                      />
                    </View>
                    <TextInput
                      value={editingContract?.contractMonthlyFee ?? ""}
                      onChangeText={(value) =>
                        setEditingContract((prev) =>
                          prev ? { ...prev, contractMonthlyFee: value.replace(/[^0-9.]/g, "") } : prev,
                        )
                      }
                      placeholder="Canone mensile EUR"
                      placeholderTextColor={theme.colors.muted}
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                    <TextInput
                      value={editingContract?.contractNotes ?? ""}
                      onChangeText={(value) =>
                        setEditingContract((prev) => (prev ? { ...prev, contractNotes: value } : prev))
                      }
                      placeholder="Note contratto"
                      placeholderTextColor={theme.colors.muted}
                      style={[styles.input, styles.textArea]}
                      multiline
                    />
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() =>
                        setEditingContract((prev) =>
                          prev ? { ...prev, contractAutoRenew: !prev.contractAutoRenew } : prev,
                        )
                      }
                    >
                      <Feather
                        name={editingContract?.contractAutoRenew ? "check-square" : "square"}
                        size={16}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.secondaryButtonText}>Rinnovo automatico</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={() => void onSaveContract()}
                      disabled={savingContract}
                    >
                      {savingContract ? (
                        <ActivityIndicator size="small" color={theme.colors.text} />
                      ) : (
                        <>
                          <Feather name="save" size={16} color={theme.colors.text} />
                          <Text style={styles.primaryButtonText}>Salva contratto</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}

                {activeTab === "usage" ? (
                  <>
                    <UsageCard
                      label="Eventi"
                      used={selectedVenue.eventsCompletedMonth ?? 0}
                      included={usageLimitFromFee(selectedVenue.contractMonthlyFee).events}
                      styles={styles}
                    />
                    <UsageCard
                      label="Persone"
                      used={selectedVenue.analyzedPeopleMonth ?? 0}
                      included={usageLimitFromFee(selectedVenue.contractMonthlyFee).people}
                      styles={styles}
                    />
                  </>
                ) : null}

                {activeTab === "extra" ? (
                  <View style={styles.detailList}>
                    <DetailRow label="Occupazione attuale" value={`${selectedVenue.occupancy}%`} />
                    <DetailRow label="Eventi live" value={String(selectedVenue.eventsActive ?? 0)} />
                    <DetailRow
                      label="Scadenza contratto"
                      value={
                        selectedVenue.contractExpiresAt
                          ? dateFormatter.format(new Date(selectedVenue.contractExpiresAt))
                          : "Non impostata"
                      }
                    />
                    <DetailRow
                      label="Stima extra"
                      value={resolveVenueStatus(selectedVenue) === "overuse" ? "Possibile costo extra" : "Nessun extra"}
                      highlight={resolveVenueStatus(selectedVenue) === "overuse"}
                    />
                  </View>
                ) : null}

                {activeTab === "manager" ? (
                  <View style={styles.detailList}>
                    <DetailRow label="Manager" value={selectedVenue.managerName ?? "Non assegnato"} />
                    <DetailRow label="Email" value={selectedVenue.managerEmail ?? "N/D"} />
                    <DetailRow
                      label="Assegnazione"
                      value={selectedVenue.managerUserId ? "Attiva" : "Da configurare"}
                      highlight={!selectedVenue.managerUserId}
                    />
                  </View>
                ) : null}

                {activeTab === "notes" ? (
                  <View style={styles.detailList}>
                    <DetailRow
                      label="Note"
                      value={selectedVenue.contractNotes?.trim() ? selectedVenue.contractNotes.trim() : "Nessuna nota"}
                    />
                    <Text style={styles.smallHint}>Aggiorna la sezione Abbonamento per modificare le note.</Text>
                  </View>
                ) : null}
              </ScrollView>
            </>
          ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showCreate} animationType="fade" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.overlay} onPress={() => setShowCreate(false)} />
          <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderTextWrap}>
              <Text style={styles.sheetTitle}>Crea Nuovo Locale</Text>
              <Text style={styles.sheetSubtitle}>Imposta anagrafica e contratto base.</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowCreate(false)}>
              <Feather name="x" size={16} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent}>
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
              placeholder="Citta"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />

            <View style={styles.inlineInputs}>
              <TextInput
                value={createForm.radius}
                onChangeText={(value) =>
                  setCreateForm((prev) => ({ ...prev, radius: value.replace(/[^0-9]/g, "") }))
                }
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
                placeholder="Canone EUR"
                placeholderTextColor={theme.colors.muted}
                keyboardType="decimal-pad"
                style={[styles.input, styles.inlineInput]}
              />
            </View>

            <TextInput
              value={createForm.contractStartAt}
              onChangeText={(value) => setCreateForm((prev) => ({ ...prev, contractStartAt: value }))}
              placeholder="Inizio contratto (YYYY-MM-DD)"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
            <TextInput
              value={createForm.contractEndAt}
              onChangeText={(value) => setCreateForm((prev) => ({ ...prev, contractEndAt: value }))}
              placeholder="Fine contratto (YYYY-MM-DD)"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />

            <View style={styles.assignBlock}>
              <Text style={styles.assignLabel}>Manager locale</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                <TouchableOpacity
                  style={[styles.assignChip, !createForm.managerUserId ? styles.assignChipSelected : null]}
                  onPress={() => setCreateForm((prev) => ({ ...prev, managerUserId: "" }))}
                >
                  <Text
                    style={[
                      styles.assignChipText,
                      !createForm.managerUserId ? styles.assignChipTextSelected : null,
                    ]}
                  >
                    Nessuno
                  </Text>
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
                        <Text
                          style={[styles.assignChipText, selected ? styles.assignChipTextSelected : null]}
                          numberOfLines={1}
                        >
                          {user.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void onCreateVenue()}
              disabled={submittingCreate}
            >
              {submittingCreate ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <>
                  <Feather name="plus-circle" size={16} color={theme.colors.text} />
                  <Text style={styles.primaryButtonText}>Crea locale</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );

  function KpiCard({
    icon,
    label,
    value,
  }: {
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
    value: string;
  }) {
    return (
      <View style={styles.kpiCard}>
        <Feather name={icon} size={14} color={theme.colors.primary} />
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
    );
  }

  function Badge({ text, warning }: { text: string; warning?: boolean }) {
    return <Text style={[styles.infoBadge, warning ? styles.infoBadgeWarn : null]}>{text}</Text>;
  }

  function InfoCard({
    icon,
    label,
    value,
  }: {
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
    value: string;
  }) {
    return (
      <View style={styles.infoCard}>
        <Feather name={icon} size={14} color={theme.colors.primary} />
        <Text style={styles.infoCardValue}>{value}</Text>
        <Text style={styles.infoCardLabel}>{label}</Text>
      </View>
    );
  }

  function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={[styles.detailRowValue, highlight ? styles.detailRowValueWarn : null]}>{value}</Text>
      </View>
    );
  }
}

function UsageCard({
  label,
  used,
  included,
  styles,
}: {
  label: string;
  used: number;
  included: number;
  styles: any;
}) {
  const over = used > included;
  const pct = clampPercentage((used / Math.max(1, included)) * 100);

  return (
    <View style={styles.usageCard}>
      <View style={styles.usageHeader}>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={[styles.usageValue, over ? styles.usageValueWarn : null]}>
          {used} / {included}
        </Text>
      </View>
      <View style={styles.usageTrack}>
        <View
          style={[
            styles.usageFill,
            { width: `${pct}%` },
            over ? styles.usageFillDanger : pct > 80 ? styles.usageFillWarning : styles.usageFillOk,
          ]}
        />
      </View>
      {over ? <Text style={styles.usageOverflow}>Superato di {used - included} {label.toLowerCase()}</Text> : null}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 120,
    },
    container: {
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 14,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    pageTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: theme.colors.text,
    },
    pageSubtitle: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    newButton: {
      borderRadius: 12,
      minHeight: 40,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    newButtonText: {
      color: theme.colors.text,
      fontSize: 12,
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
      minHeight: 86,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 12,
      justifyContent: "center",
      gap: 4,
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
    searchToolbar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    searchWrap: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "600",
      paddingVertical: 0,
    },
    filterButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    filterButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}1a`,
    },
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    listSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
      gap: 8,
    },
    listSectionTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.colors.text,
    },
    listSectionHint: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    filterChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}1a`,
    },
    filterChipText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.text,
    },
    filterChipTextActive: {
      color: theme.colors.primary,
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
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 12,
      gap: 8,
    },
    venueTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
    },
    venueMainInfo: {
      flex: 1,
      gap: 4,
    },
    venueName: {
      fontSize: 15,
      fontWeight: "900",
      color: theme.colors.text,
      flex: 1,
    },
    venueTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    statusChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      overflow: "hidden",
    },
    statusChipActive: {
      borderColor: "rgba(52,211,153,0.35)",
      backgroundColor: "rgba(52,211,153,0.12)",
    },
    statusChipWarning: {
      borderColor: "rgba(245,158,11,0.35)",
      backgroundColor: "rgba(245,158,11,0.12)",
    },
    statusChipDanger: {
      borderColor: "rgba(239,68,68,0.35)",
      backgroundColor: "rgba(239,68,68,0.12)",
    },
    statusChipText: {
      fontSize: 10,
      fontWeight: "900",
      color: theme.colors.muted,
    },
    statusChipTextActive: {
      color: "#34d399",
    },
    statusChipTextWarning: {
      color: "#f59e0b",
    },
    statusChipTextDanger: {
      color: theme.colors.error,
    },
    venueMeta: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    inlineBadges: {
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
    infoBadgeWarn: {
      borderColor: "rgba(245,158,11,0.45)",
      backgroundColor: "rgba(245,158,11,0.14)",
    },
    venueBottomRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
    },
    metricText: {
      fontSize: 11,
      color: theme.colors.muted,
      fontWeight: "700",
    },
    metricRevenue: {
      marginLeft: "auto",
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: "900",
    },
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      maxHeight: "88%",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      overflow: "hidden",
      paddingBottom: 14,
    },
    sheetHandle: {
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.muted,
      opacity: 0.35,
      alignSelf: "center",
      marginTop: 9,
      marginBottom: 10,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 10,
    },
    sheetHeaderTextWrap: {
      flex: 1,
      gap: 2,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.text,
    },
    sheetSubtitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    tabsRow: {
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 8,
    },
    tabChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    tabChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}20`,
    },
    tabChipText: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: "800",
    },
    tabChipTextActive: {
      color: theme.colors.primary,
    },
    sheetBody: {
      maxHeight: "100%",
    },
    sheetBodyContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 30,
      gap: 10,
    },
    infoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    infoCard: {
      width: "48%",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 10,
      gap: 4,
    },
    infoCardValue: {
      fontSize: 14,
      fontWeight: "900",
      color: theme.colors.text,
    },
    infoCardLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.muted,
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
    usageCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 10,
      gap: 7,
    },
    usageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    usageLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.colors.text,
    },
    usageValue: {
      fontSize: 11,
      fontWeight: "800",
      color: "#34d399",
    },
    usageValueWarn: {
      color: theme.colors.error,
    },
    usageTrack: {
      width: "100%",
      height: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.border,
      overflow: "hidden",
    },
    usageFill: {
      height: "100%",
      borderRadius: 999,
    },
    usageFillOk: {
      backgroundColor: "#34d399",
    },
    usageFillWarning: {
      backgroundColor: "#f59e0b",
    },
    usageFillDanger: {
      backgroundColor: theme.colors.error,
    },
    usageOverflow: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.error,
    },
    detailList: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 10,
    },
    detailRowLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    detailRowValue: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "right",
      maxWidth: "65%",
    },
    detailRowValueWarn: {
      color: "#f59e0b",
    },
    smallHint: {
      marginTop: 8,
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.muted,
    },
  });
