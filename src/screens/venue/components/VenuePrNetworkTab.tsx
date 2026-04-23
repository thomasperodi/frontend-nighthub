import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../../../theme/ThemeProvider";
import type { Event } from "../../../types/events";
import type { Reservation } from "../../../types/reservations";
import {
  createVenuePrMember,
  deleteVenuePrMember,
  listVenuePrMembers,
  searchVenueAssignableUsers,
  updateVenuePrMember,
  type AssignableVenueUser,
  type PrNetworkRole,
  type VenuePrMember,
} from "../../../services/prNetwork";
import { buildTrackedEventLinks } from "../../../utils/deepLinks";

type NetworkRole = PrNetworkRole;

type NetworkMember = VenuePrMember;

type MemberStats = {
  memberId: string;
  reservations: number;
  guests: number;
  confirmed: number;
  pending: number;
  entries: number;
  tables: number;
  revenue: number;
};

type Props = {
  venueId?: string;
  canManageTeam?: boolean;
  managementScope?: "venue" | "manager" | "none";
  managerMembershipId?: string | null;
  managerRole?: NetworkRole | null;
  venueEvents: Event[];
  selectedEventId: string | null;
  onSelectEventId: (eventId: string) => void;
  reservations: Reservation[];
  loading: boolean;
  refreshing: boolean;
  error?: string | null;
  onRefresh: () => Promise<void> | void;
  onOpenReservations: () => void;
};

const ROLE_LABEL: Record<NetworkRole, string> = {
  RESPONSABILE: "Responsabile",
  CAPO_SQUADRA: "Capo Squadra",
  PR: "PR",
};

const USER_SEARCH_MIN_LENGTH = 2;
const USER_SEARCH_DEBOUNCE_MS = 400;

function slugifyName(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
}

function buildRefCode(name: string, usedCodes: Set<string>) {
  const base = slugifyName(name) || "PR";
  let candidate = base;
  let i = 1;
  while (usedCodes.has(candidate)) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

function toMoney(value: number) {
  if (!Number.isFinite(value)) return "EUR 0.00";
  return `EUR ${value.toFixed(2)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null;
  const raw = obj[key];
  if (typeof raw !== "string") return null;
  const normalized = raw.trim();
  return normalized.length ? normalized : null;
}

function readNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readErrorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message) && message.length > 0) {
    return String(message[0]);
  }
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }
  if (typeof error?.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("it");
}

export default function VenuePrNetworkTab({
  venueId,
  canManageTeam = true,
  managementScope = "venue",
  managerMembershipId = null,
  managerRole = null,
  venueEvents,
  selectedEventId,
  onSelectEventId,
  reservations,
  loading,
  refreshing,
  error,
  onRefresh,
  onOpenReservations,
}: Props) {
  const { theme } = useTheme();

  const [members, setMembers] = useState<NetworkMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [venueUsers, setVenueUsers] = useState<AssignableVenueUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const userSearchRequestRef = useRef(0);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const effectiveManagementScope = useMemo(() => {
    if (!canManageTeam) return "none" as const;
    if (managementScope === "manager") return "manager" as const;
    return "venue" as const;
  }, [canManageTeam, managementScope]);

  const canCreateMembers = effectiveManagementScope !== "none";
  const isVenueManagement = effectiveManagementScope === "venue";
  const isManagerManagement = effectiveManagementScope === "manager";

  const selectedEvent = useMemo(
    () => (selectedEventId ? venueEvents.find((event) => event.id === selectedEventId) ?? null : null),
    [selectedEventId, venueEvents],
  );

  const selectedUser = useMemo(
    () => venueUsers.find((candidate) => candidate.id === selectedUserId) ?? null,
    [venueUsers, selectedUserId],
  );

  const loadMembers = useCallback(async () => {
    if (!venueId) {
      setMembers([]);
      setMembersError(null);
      setMembersLoading(false);
      return;
    }

    setMembersLoading(true);
    setMembersError(null);
    try {
      const data = await listVenuePrMembers(venueId);
      setMembers(data);
    } catch (loadError: any) {
      setMembersError(readErrorMessage(loadError, "Non riesco a caricare il team PR."));
    } finally {
      setMembersLoading(false);
    }
  }, [venueId]);

  const loadUsers = useCallback(
    async (searchText: string) => {
      if (!canCreateMembers) {
        setVenueUsers([]);
        return;
      }

      if (!venueId) {
        setVenueUsers([]);
        return;
      }

      const normalizedSearch = searchText.trim();
      if (normalizedSearch.length < USER_SEARCH_MIN_LENGTH) {
        setVenueUsers([]);
        setUsersLoading(false);
        userSearchRequestRef.current += 1;
        return;
      }

      const requestId = userSearchRequestRef.current + 1;
      userSearchRequestRef.current = requestId;

      setUsersLoading(true);
      try {
        const data = await searchVenueAssignableUsers(venueId, normalizedSearch);
        if (requestId !== userSearchRequestRef.current) return;
        setVenueUsers(data);
      } catch {
        if (requestId !== userSearchRequestRef.current) return;
        setVenueUsers([]);
      } finally {
        if (requestId !== userSearchRequestRef.current) return;
        setUsersLoading(false);
      }
    },
    [canCreateMembers, venueId],
  );

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (!canCreateMembers) {
      setDebouncedUserSearch("");
      setVenueUsers([]);
      setUsersLoading(false);
      userSearchRequestRef.current += 1;
      return;
    }

    const normalizedSearch = userSearch.trim();
    if (normalizedSearch.length < USER_SEARCH_MIN_LENGTH) {
      setDebouncedUserSearch("");
      setVenueUsers([]);
      setUsersLoading(false);
      userSearchRequestRef.current += 1;
      return;
    }

    const timeout = setTimeout(() => {
      setDebouncedUserSearch(normalizedSearch);
    }, USER_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [canCreateMembers, userSearch]);

  useEffect(() => {
    if (!debouncedUserSearch) return;
    void loadUsers(debouncedUserSearch);
  }, [debouncedUserSearch, loadUsers]);

  const handleRefresh = useCallback(async () => {
    const normalizedSearch = userSearch.trim();

    if (normalizedSearch.length < USER_SEARCH_MIN_LENGTH) {
      setVenueUsers([]);
      setUsersLoading(false);
      userSearchRequestRef.current += 1;
    }

    await Promise.all([
      Promise.resolve(onRefresh()),
      loadMembers(),
      normalizedSearch.length >= USER_SEARCH_MIN_LENGTH
        ? loadUsers(normalizedSearch)
        : Promise.resolve(),
    ]);
  }, [onRefresh, loadMembers, loadUsers, userSearch]);

  const membersInScope = useMemo(() => {
    if (!isManagerManagement || !managerMembershipId) {
      return members;
    }

    const childrenMap = new Map<string, string[]>();
    for (const member of members) {
      if (!member.parentId) continue;
      const list = childrenMap.get(member.parentId) ?? [];
      list.push(member.id);
      childrenMap.set(member.parentId, list);
    }

    const allowed = new Set<string>();
    const stack = [managerMembershipId];
    while (stack.length > 0) {
      const id = stack.pop();
      if (!id || allowed.has(id)) continue;
      allowed.add(id);
      const children = childrenMap.get(id) ?? [];
      for (const childId of children) stack.push(childId);
    }

    return members.filter((member) => allowed.has(member.id));
  }, [isManagerManagement, managerMembershipId, members]);

  const statsByMember = useMemo(() => {
    const map = new Map<string, MemberStats>();
    for (const member of membersInScope) {
      map.set(member.id, {
        memberId: member.id,
        reservations: 0,
        guests: 0,
        confirmed: 0,
        pending: 0,
        entries: 0,
        tables: 0,
        revenue: 0,
      });
    }

    for (const reservation of reservations) {
      const meta = asRecord(reservation.meta ?? null);
      const inviterUserId = readString(meta, "inviter_user_id");
      const trackingCode =
        readString(meta, "tracking_code") ||
        readString(meta, "pr_code") ||
        readString(meta, "ref_code") ||
        readString(meta, "promo_code");

      const guests = Math.max(Number(reservation.guests ?? 1), 1);
      const revenue = readNumber(reservation.total_amount);

      const matchedMember = membersInScope.find((member) => {
        const byUser = Boolean(member.userId && inviterUserId && member.userId === inviterUserId);
        const byCode = Boolean(
          trackingCode && member.refCode.toUpperCase() === trackingCode.toUpperCase(),
        );
        return byUser || byCode;
      });

      if (!matchedMember) continue;

      const current = map.get(matchedMember.id);
      if (!current) continue;

      current.reservations += 1;
      current.guests += guests;
      current.revenue += revenue;
      if (reservation.status === "pending") current.pending += 1;
      if (reservation.status === "confirmed" || reservation.status === "completed") current.confirmed += 1;
      if (reservation.type === "entry") current.entries += guests;
      if (reservation.type === "table") current.tables += guests;
    }

    return map;
  }, [membersInScope, reservations]);

  const childrenByMember = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const member of members) {
      if (!member.parentId) continue;
      const list = map.get(member.parentId) ?? [];
      list.push(member.id);
      map.set(member.parentId, list);
    }
    return map;
  }, [members]);

  const teamGuestsByMember = useMemo(() => {
    const out = new Map<string, number>();

    const collectGuests = (memberId: string): number => {
      if (out.has(memberId)) return out.get(memberId) ?? 0;
      const ownGuests = statsByMember.get(memberId)?.guests ?? 0;
      const childIds = childrenByMember.get(memberId) ?? [];
      const childrenGuests = childIds.reduce((sum, childId) => sum + collectGuests(childId), 0);
      const total = ownGuests + childrenGuests;
      out.set(memberId, total);
      return total;
    };

    for (const member of membersInScope) {
      collectGuests(member.id);
    }

    return out;
  }, [childrenByMember, membersInScope, statsByMember]);

  const globalStats = useMemo(() => {
    const totals = {
      trackedReservations: 0,
      trackedGuests: 0,
      trackedRevenue: 0,
      pending: 0,
      confirmed: 0,
      unassigned: 0,
    };

    for (const reservation of reservations) {
      const meta = asRecord(reservation.meta ?? null);
      const inviterUserId = readString(meta, "inviter_user_id");
      const trackingCode =
        readString(meta, "tracking_code") ||
        readString(meta, "pr_code") ||
        readString(meta, "ref_code") ||
        readString(meta, "promo_code");

      const guests = Math.max(Number(reservation.guests ?? 1), 1);
      const revenue = readNumber(reservation.total_amount);

      const matched = membersInScope.some((member) => {
        const byUser = Boolean(member.userId && inviterUserId && member.userId === inviterUserId);
        const byCode = Boolean(
          trackingCode && member.refCode.toUpperCase() === trackingCode.toUpperCase(),
        );
        return byUser || byCode;
      });

      if (matched) {
        totals.trackedReservations += 1;
        totals.trackedGuests += guests;
        totals.trackedRevenue += revenue;
        if (reservation.status === "pending") totals.pending += 1;
        if (reservation.status === "confirmed" || reservation.status === "completed") totals.confirmed += 1;
      } else if (inviterUserId || trackingCode) {
        totals.unassigned += 1;
      }
    }

    return totals;
  }, [membersInScope, reservations]);

  const topMember = useMemo(() => {
    const ranked = membersInScope
      .map((member) => ({
        member,
        guests: teamGuestsByMember.get(member.id) ?? 0,
      }))
      .sort((a, b) => b.guests - a.guests);
    return ranked[0] ?? null;
  }, [membersInScope, teamGuestsByMember]);

  const createMember = async () => {
    if (!venueId) {
      Alert.alert("Venue non disponibile", "Impossibile salvare il membro PR senza locale.");
      return;
    }

    if (!canCreateMembers) {
      Alert.alert("Permessi insufficienti", "Non hai permessi per aggiungere membri PR.");
      return;
    }

    if (!selectedUser) {
      Alert.alert("Utente richiesto", "Seleziona un utente esistente da autorizzare.");
      return;
    }

    if (selectedUser.already_assigned) {
      Alert.alert("Gia assegnato", "Questo utente e gia autorizzato nel PR network del locale.");
      return;
    }

    const roleToCreate: NetworkRole = isVenueManagement ? "RESPONSABILE" : "PR";
    const parentToCreate = isVenueManagement ? null : managerMembershipId;

    if (isManagerManagement && !parentToCreate) {
      Alert.alert("Gerarchia non valida", "Non riesco a identificare il responsabile del team.");
      return;
    }

    const usedCodes = new Set(members.map((member) => member.refCode.toUpperCase()));
    const generatedCode = buildRefCode(selectedUser.display_name, usedCodes);

    setMutationLoading(true);
    try {
      await createVenuePrMember(venueId, {
        user_id: selectedUser.id,
        role: roleToCreate,
        parent_membership_id: parentToCreate,
        ref_code: generatedCode,
      });

      setSelectedUserId(null);
      setUserSearch("");
      setVenueUsers([]);
      setUsersLoading(false);
      userSearchRequestRef.current += 1;

      await Promise.all([loadMembers(), Promise.resolve(onRefresh())]);
    } catch (error: any) {
      Alert.alert("Errore", readErrorMessage(error, "Non riesco ad autorizzare il membro."));
    } finally {
      setMutationLoading(false);
    }
  };

  const toggleMemberActive = async (memberId: string) => {
    if (!venueId) return;
    const member = members.find((row) => row.id === memberId);
    if (!member) return;
    if (!canManageMember(member)) {
      Alert.alert("Permessi insufficienti", "Non puoi modificare questo membro del network.");
      return;
    }

    setMutationLoading(true);
    try {
      await updateVenuePrMember(venueId, memberId, {
        is_active: !member.active,
      });
      await loadMembers();
    } catch (error: any) {
      Alert.alert("Errore", readErrorMessage(error, "Non riesco ad aggiornare il membro."));
    } finally {
      setMutationLoading(false);
    }
  };

  const deleteMember = async (memberId: string) => {
    if (!venueId) return;

    const member = members.find((row) => row.id === memberId);
    if (!member) return;
    if (!canManageMember(member)) {
      Alert.alert("Permessi insufficienti", "Non puoi eliminare questo membro del network.");
      return;
    }

    const hasChildren = members.some((member) => member.parentId === memberId);
    if (hasChildren) {
      Alert.alert(
        "Impossibile eliminare",
        "Questo membro ha PR sotto di lui. Riassegna prima i membri del team.",
      );
      return;
    }

    Alert.alert(
      "Conferma eliminazione",
      `Vuoi eliminare ${member.name} dal PR network?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            setMutationLoading(true);
            try {
              await deleteVenuePrMember(venueId, memberId);
              await loadMembers();
            } catch (error: any) {
              Alert.alert("Errore", readErrorMessage(error, "Non riesco a eliminare il membro."));
            } finally {
              setMutationLoading(false);
            }
          },
        },
      ],
    );
  };

  const shareTrackedLink = async (member: NetworkMember) => {
    if (!selectedEventId) {
      Alert.alert("Seleziona evento", "Scegli un evento per generare il link tracciato.");
      return;
    }

    const links = buildTrackedEventLinks({
      eventId: selectedEventId,
      refCode: member.refCode,
    });

    const eventName = selectedEvent?.name ?? "serata";

    try {
      await Share.share({
        title: "Invito NightHub",
        message:
          `${member.name} ti invita a ${eventName}.\n\n` +
          `Apri app o store (smart link):\n${links.smartUrl}\n\n` +
          `Link web tracciato:\n${links.webUrl}\n\n` +
          `Deep link diretto app:\n${links.appDeepLink}\n\n` +
          `Wallet Apple:\n${links.appleWalletUrl}\n\n` +
          `Wallet Google:\n${links.googleWalletUrl}`,
        url: links.smartUrl,
      });
    } catch {
      Alert.alert("Errore", "Non riesco a condividere il link in questo momento.");
    }
  };

  const openWalletLink = useCallback(
    async (member: NetworkMember, provider: "apple" | "google") => {
      if (!selectedEventId) {
        Alert.alert("Seleziona evento", "Scegli un evento prima di aprire il wallet link.");
        return;
      }

      const links = buildTrackedEventLinks({
        eventId: selectedEventId,
        refCode: member.refCode,
        wallet: provider,
      });

      const targetUrl = provider === "apple" ? links.appleWalletUrl : links.googleWalletUrl;

      try {
        const supported = await Linking.canOpenURL(targetUrl);
        if (supported) {
          await Linking.openURL(targetUrl);
          return;
        }
      } catch {
        // fallback below
      }

      try {
        await Linking.openURL(links.smartUrl);
      } catch {
        Alert.alert("Errore", "Non riesco ad aprire il link wallet in questo momento.");
      }
    },
    [selectedEventId],
  );

  const userCandidates = useMemo(() => {
    const query = normalizeSearchText(userSearch);

    const ordered = [...venueUsers].sort((a, b) => {
      if (a.already_assigned !== b.already_assigned) {
        return a.already_assigned ? 1 : -1;
      }
      if (a.is_associated_to_venue !== b.is_associated_to_venue) {
        return a.is_associated_to_venue ? -1 : 1;
      }
      return a.display_name.localeCompare(b.display_name, "it");
    });

    if (query.length < USER_SEARCH_MIN_LENGTH) return [];

    const filtered = ordered.filter((candidate) => {
      const name = normalizeSearchText(candidate.display_name);
      const username = normalizeSearchText(candidate.username);
      const email = normalizeSearchText(candidate.email);
      return name.includes(query) || username.includes(query) || email.includes(query);
    });

    return filtered.slice(0, 16);
  }, [userSearch, venueUsers]);

  const hasSearchQuery = userSearch.trim().length >= USER_SEARCH_MIN_LENGTH;

  const canSubmitNewMember =
    canCreateMembers &&
    Boolean(selectedUser) &&
    !selectedUser?.already_assigned &&
    (!isManagerManagement || Boolean(managerMembershipId)) &&
    !mutationLoading;

  const canManageMember = useCallback(
    (member: NetworkMember) => {
      if (!canManageTeam) return false;
      if (isVenueManagement) return true;
      if (isManagerManagement) {
        return Boolean(managerMembershipId && member.role === "PR" && member.parentId === managerMembershipId);
      }
      return false;
    },
    [canManageTeam, isVenueManagement, isManagerManagement, managerMembershipId],
  );

  const orderedMembers = useMemo(() => {
    const roleRank = new Map<NetworkRole, number>([
      ["RESPONSABILE", 0],
      ["CAPO_SQUADRA", 1],
      ["PR", 2],
    ]);

    return [...membersInScope].sort((a, b) => {
      const roleDiff = (roleRank.get(a.role) ?? 99) - (roleRank.get(b.role) ?? 99);
      if (roleDiff !== 0) return roleDiff;
      return a.name.localeCompare(b.name, "it");
    });
  }, [membersInScope]);

  if (!venueId) {
    return (
      <View style={styles.centeredWrap}>
        <Feather name="alert-circle" size={22} color={theme.colors.error} />
        <Text style={[styles.centeredText, { color: theme.colors.error }]}>Venue non disponibile per il network PR.</Text>
      </View>
    );
  }

  if (membersLoading) {
    return (
      <View style={styles.centeredWrap}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={[styles.centeredText, { color: theme.colors.muted }]}>Caricamento PR network...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || membersLoading}
          onRefresh={() => void handleRefresh()}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.heroEyebrow, { color: theme.colors.muted }]}>PR network</Text>
        <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Struttura locale: Responsabili PR e team</Text>
        <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>Gestione account a livello locale. L'evento serve solo per KPI, link e QR tracciati.</Text>

        <View style={[styles.hierarchyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
          <Text style={[styles.hierarchyTitle, { color: theme.colors.text }]}>Flusso gerarchico</Text>
          <Text style={[styles.hierarchyText, { color: theme.colors.muted }]}>1 Locale {"->"} Responsabili PR {"->"} PR</Text>
          <Text style={[styles.hierarchyText, { color: theme.colors.muted }]}>
            {isVenueManagement
              ? "Modalita locale: qui puoi aggiungere solo Responsabili PR."
              : isManagerManagement
                ? "Modalita responsabile: qui puoi aggiungere PR sotto il tuo team."
                : "Modalita sola lettura: puoi monitorare risultati e link tracciati."}
          </Text>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard label="Membri visibili" value={String(membersInScope.length)} tone="#67B7FF" />
          <MetricCard label="Ospiti tracciati" value={String(globalStats.trackedGuests)} tone="#7EE081" />
          <MetricCard label="Prenotazioni tracciate" value={String(globalStats.trackedReservations)} tone="#F4C95D" />
          <MetricCard label="Revenue tracciata" value={toMoney(globalStats.trackedRevenue)} tone="#FF6B6B" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Evento per tracking</Text>
        <Text style={[styles.mutedText, { color: theme.colors.muted }]}>La gerarchia team non dipende dall'evento selezionato.</Text>

        {venueEvents.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventChipsRow}>
            {venueEvents.map((event) => {
              const active = selectedEventId === event.id;
              return (
                <TouchableOpacity
                  key={event.id}
                  style={[
                    styles.eventChip,
                    {
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                      backgroundColor: active ? `${theme.colors.primary}20` : theme.colors.card,
                    },
                  ]}
                  onPress={() => onSelectEventId(event.id)}
                >
                  <Text
                    style={[styles.eventChipText, { color: active ? theme.colors.primary : theme.colors.text }]}
                    numberOfLines={1}
                  >
                    {event.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {selectedEvent ? (
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Evento attivo: {selectedEvent.name}</Text>
        ) : (
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Seleziona un evento per attivare link, QR e wallet.</Text>
        )}


        {!venueEvents.length && (
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Nessun evento disponibile. Crea un evento prima di aprire il tracking PR.</Text>
        )}
      </View>

      {error ? (
        <View style={[styles.warningCard, { borderColor: "#f59e0b55", backgroundColor: "#f59e0b18" }]}>
          <Feather name="alert-triangle" size={16} color="#f59e0b" />
          <Text style={styles.warningText}>{error}</Text>
        </View>
      ) : null}

      {membersError ? (
        <View style={[styles.warningCard, { borderColor: "#ef444455", backgroundColor: "#ef444418" }]}>
          <Feather name="wifi-off" size={16} color="#ef4444" />
          <Text style={[styles.warningText, { color: "#ef4444" }]}>{membersError}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Aggiornamento dati prenotazioni in corso...</Text>
        </View>
      ) : null}

      {canCreateMembers ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {isVenueManagement ? "Aggiungi responsabile PR" : "Aggiungi PR al tuo team"}
          </Text>
          <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.scopePill, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <Feather name={isVenueManagement ? "shield" : "users"} size={14} color={theme.colors.primary} />
            <Text style={[styles.scopePillText, { color: theme.colors.text }]}>
              {isVenueManagement
                ? "Locale: crea responsabili validi su tutto il locale"
                : `Responsabile${managerRole ? ` ${ROLE_LABEL[managerRole]}` : ""}: crea PR sotto al tuo profilo`}
            </Text>
          </View>

          {isManagerManagement && !managerMembershipId ? (
            <View style={[styles.warningCard, { borderColor: "#ef444455", backgroundColor: "#ef444418" }]}>
              <Feather name="alert-triangle" size={16} color="#ef4444" />
              <Text style={[styles.warningText, { color: "#ef4444" }]}>Impossibile identificare il tuo profilo responsabile per creare PR.</Text>
            </View>
          ) : null}

          <TextInput
            value={userSearch}
            onChangeText={setUserSearch}
            placeholder="Cerca utente esistente (nome, username, email)"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
            autoCapitalize="none"
          />

          {usersLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Ricerca utenti in corso...</Text>
            </View>
          ) : null}

          {selectedUser ? (
            <View style={[styles.selectedUserCard, { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}14` }]}>
              <View style={styles.selectedUserHead}>
                <Text style={[styles.selectedUserTitle, { color: theme.colors.text }]}>{selectedUser.display_name}</Text>
                <TouchableOpacity onPress={() => setSelectedUserId(null)}>
                  <Feather name="x" size={16} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.selectedUserSub, { color: theme.colors.muted }]}>
                {selectedUser.email}
                {selectedUser.username ? ` • @${selectedUser.username}` : ""}
              </Text>
            </View>
          ) : null}

          {!hasSearchQuery ? (
            <Text style={[styles.mutedText, { color: theme.colors.muted }]}>
              Digita almeno {USER_SEARCH_MIN_LENGTH} caratteri per cercare un utente.
            </Text>
          ) : null}

          {hasSearchQuery ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventChipsRow}>
              {userCandidates.map((candidate) => {
                const selected = selectedUserId === candidate.id;
                return (
                  <TouchableOpacity
                    key={candidate.id}
                    disabled={candidate.already_assigned}
                    style={[
                      styles.eventChip,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected ? `${theme.colors.primary}20` : theme.colors.card,
                        opacity: candidate.already_assigned ? 0.45 : 1,
                      },
                    ]}
                    onPress={() => {
                      setSelectedUserId(candidate.id);
                      setUserSearch(candidate.display_name);
                    }}
                  >
                    <Text
                      style={[
                        styles.eventChipText,
                        { color: selected ? theme.colors.primary : theme.colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {candidate.display_name}
                    </Text>
                    <Text style={[styles.userChipMeta, { color: theme.colors.muted }]} numberOfLines={1}>
                      {candidate.already_assigned
                        ? "Gia nel network"
                        : candidate.is_associated_to_venue
                          ? "Utente locale"
                          : "Utente app"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {hasSearchQuery && !userCandidates.length && !usersLoading ? (
            <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Nessun utente trovato con questa ricerca.</Text>
          ) : null}

          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>
            {isVenueManagement
              ? "Il membro verra creato come Responsabile PR, senza vincolo evento."
              : "Il membro verra creato come PR e assegnato automaticamente sotto il tuo team."}
          </Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.colors.primary,
                opacity: canSubmitNewMember ? 1 : 0.45,
              },
            ]}
            onPress={() => void createMember()}
            disabled={!canSubmitNewMember}
          >
            <Feather name="user-plus" size={16} color="#0B0B0B" />
            <Text style={styles.primaryButtonText}>{isVenueManagement ? "Aggiungi responsabile" : "Aggiungi PR"}</Text>
          </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {isManagerManagement ? "Il tuo network PR" : "Leaderboard PR locale"}
          </Text>
          <View style={styles.sectionActionsRow}>
            {membersError ? (
              <TouchableOpacity onPress={() => void loadMembers()}>
                <Text style={[styles.sectionLink, { color: theme.colors.primary }]}>Riprova team</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onOpenReservations}>
              <Text style={[styles.sectionLink, { color: theme.colors.primary }]}>Apri prenotazioni</Text>
            </TouchableOpacity>
          </View>
        </View>

        {topMember ? (
          <View style={[styles.topCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.topLabel, { color: theme.colors.muted }]}>
              {isManagerManagement ? "Top performer del tuo team" : "Top performer evento"}
            </Text>
            <Text style={[styles.topName, { color: theme.colors.text }]}>{topMember.member.name}</Text>
            <Text style={[styles.topValue, { color: theme.colors.primary }]}>{topMember.guests} ospiti totali di squadra</Text>
          </View>
        ) : (
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Nessun dato ancora disponibile per questo evento.</Text>
        )}

        {orderedMembers.map((member) => {
          const ownStats = statsByMember.get(member.id);
          const teamGuests = teamGuestsByMember.get(member.id) ?? 0;
          const parent = member.parentId
            ? members.find((candidate) => candidate.id === member.parentId) ?? null
            : null;

          const trackedLinks = selectedEventId
            ? buildTrackedEventLinks({ eventId: selectedEventId, refCode: member.refCode })
            : null;

          const trackedLink = trackedLinks?.smartUrl ?? null;

          const qrUrl = trackedLink
            ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                trackedLink,
              )}`
            : null;

          return (
            <View
              key={member.id}
              style={[
                styles.memberCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: member.active ? theme.colors.border : "#ef444455",
                  opacity: member.active ? 1 : 0.72,
                },
              ]}
            >
              <View style={styles.memberHeadRow}>
                <View style={styles.memberMainText}>
                  <Text style={[styles.memberName, { color: theme.colors.text }]}>{member.name}</Text>
                  <Text style={[styles.memberSub, { color: theme.colors.muted }]}>
                    {ROLE_LABEL[member.role]}
                    {parent ? ` - sotto ${parent.name}` : ""}
                  </Text>
                  <Text style={[styles.memberSub, { color: theme.colors.muted }]}>Codice: {member.refCode}</Text>
                </View>

                <View style={[styles.roleBadge, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                  <Text style={[styles.roleBadgeText, { color: theme.colors.text }]}>{ROLE_LABEL[member.role]}</Text>
                </View>
              </View>

              <View style={styles.memberKpisRow}>
                <SmallStat label="Prenotazioni" value={String(ownStats?.reservations ?? 0)} />
                <SmallStat label="Ospiti" value={String(ownStats?.guests ?? 0)} />
                <SmallStat label="Team ospiti" value={String(teamGuests)} />
                <SmallStat label="Revenue" value={toMoney(ownStats?.revenue ?? 0)} />
              </View>

              {qrUrl ? (
                <View style={[styles.qrWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                  <Image source={{ uri: qrUrl }} style={styles.qrImage} />
                  <View style={styles.qrTextWrap}>
                    <Text style={[styles.qrTitle, { color: theme.colors.text }]}>QR link tracciato</Text>
                    <Text style={[styles.qrSub, { color: theme.colors.muted }]}>Condividi questo QR o il link per attribuire la prenotazione al PR.</Text>
                    <Text style={[styles.linkPreview, { color: theme.colors.primary }]} numberOfLines={2}>
                      {trackedLink}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Seleziona un evento per generare link e QR.</Text>
              )}

              <View style={styles.memberActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                      opacity: mutationLoading || !selectedEventId ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => void shareTrackedLink(member)}
                  disabled={mutationLoading || !selectedEventId}
                >
                  <Feather name="share-2" size={15} color={theme.colors.text} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Condividi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                      opacity: mutationLoading || !selectedEventId ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => void openWalletLink(member, "apple")}
                  disabled={mutationLoading || !selectedEventId}
                >
                  <Feather name="credit-card" size={15} color={theme.colors.text} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Wallet Apple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                      opacity: mutationLoading || !selectedEventId ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => void openWalletLink(member, "google")}
                  disabled={mutationLoading || !selectedEventId}
                >
                  <Feather name="smartphone" size={15} color={theme.colors.text} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Wallet Google</Text>
                </TouchableOpacity>

                {canManageMember(member) ? (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.card,
                          opacity: mutationLoading ? 0.6 : 1,
                        },
                      ]}
                      onPress={() => void toggleMemberActive(member.id)}
                      disabled={mutationLoading}
                    >
                      <Feather
                        name={member.active ? "pause-circle" : "play-circle"}
                        size={15}
                        color={theme.colors.text}
                      />
                      <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>
                        {member.active ? "Disattiva" : "Riattiva"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        {
                          borderColor: "#ef444455",
                          backgroundColor: "#ef444420",
                          opacity: mutationLoading ? 0.6 : 1,
                        },
                      ]}
                      onPress={() => void deleteMember(member.id)}
                      disabled={mutationLoading}
                    >
                      <Feather name="trash-2" size={15} color="#ef4444" />
                      <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>Elimina</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </View>
          );
        })}

        {!orderedMembers.length ? (
          <View style={[styles.emptyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <Feather name="users" size={18} color={theme.colors.muted} />
            <Text style={[styles.mutedText, { color: theme.colors.muted }]}>
              {isVenueManagement
                ? "Nessun membro autorizzato. Aggiungi il primo responsabile PR del locale."
                : "Nessun membro nel tuo network. Aggiungi il primo PR sotto il tuo team."}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.infoCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Wallet e omaggi</Text>
        <Text style={[styles.infoText, { color: theme.colors.muted }]}>Ogni membro ha smart link, deep link, QR e link wallet Apple/Google con tracking PR. Lo smart link prova ad aprire l'app e in fallback porta allo store.</Text>
      </View>

      {mutationLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Aggiornamento team PR...</Text>
        </View>
      ) : null}
    </ScrollView>
  );

  function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
    return (
      <View style={[styles.metricCard, { borderColor: `${tone}55`, backgroundColor: `${tone}18` }]}>
        <Text style={[styles.metricLabel, { color: tone }]}>{label}</Text>
        <Text style={[styles.metricValue, { color: theme.colors.text }]}>{value}</Text>
      </View>
    );
  }

  function SmallStat({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.smallStat}>
        <Text style={[styles.smallStatLabel, { color: theme.colors.muted }]}>{label}</Text>
        <Text style={[styles.smallStatValue, { color: theme.colors.text }]}>{value}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14,
  },
  centeredWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  centeredText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  hero: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  heroEyebrow: {
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 11,
    fontWeight: "800",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  hierarchyCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  hierarchyTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  hierarchyText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  metricLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "800",
  },
  metricValue: {
    fontSize: 17,
    fontWeight: "900",
  },
  section: {
    gap: 10,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: "800",
  },
  eventChipsRow: {
    gap: 8,
    paddingRight: 12,
  },
  eventChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: 220,
  },
  eventChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  userChipMeta: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  mutedText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  warningCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  warningText: {
    color: "#f59e0b",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  scopePill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scopePillText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  selectedUserCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 3,
  },
  selectedUserHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectedUserTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  selectedUserSub: {
    fontSize: 11,
    fontWeight: "600",
  },
  rolesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "800",
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexDirection: "row",
  },
  primaryButtonText: {
    color: "#0B0B0B",
    fontSize: 13,
    fontWeight: "900",
  },
  topCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 5,
  },
  topLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "800",
  },
  topName: {
    fontSize: 17,
    fontWeight: "900",
  },
  topValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  memberCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  memberHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start",
  },
  memberMainText: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "900",
  },
  memberSub: {
    fontSize: 11,
    fontWeight: "700",
  },
  roleBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  memberKpisRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  smallStat: {
    minWidth: "46%",
    gap: 2,
  },
  smallStatLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  smallStatValue: {
    fontSize: 14,
    fontWeight: "900",
  },
  qrWrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  qrImage: {
    width: 78,
    height: 78,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  qrTextWrap: {
    flex: 1,
    gap: 3,
  },
  qrTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  qrSub: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  linkPreview: {
    fontSize: 11,
    fontWeight: "700",
  },
  memberActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  infoText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
});
