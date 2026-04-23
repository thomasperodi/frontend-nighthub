import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { listVenueTables } from "../services/tables";
import { listFriendGroups, listFriends } from "../services/friends";
import type { EventTablePricing } from "../types/events";
import type { VenueTable } from "../types/tables";
import { Feather } from "@expo/vector-icons";

type ZoneConfig = {
  id: string;
  label: string;
  per_testa?: number | null;
  costo_minimo?: number | null;
  persone_max?: number | null;
  hasEventOverride?: boolean;
};

type InviteFriend = {
  id: string;
  name: string;
  avatar: string;
};

type InviteGroup = {
  id: string;
  name: string;
  members: string[];
};

const GROUP_PROPOSAL_META_PREFIX = "[grp-meta]";

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeZoneLabel(table: VenueTable): string {
  const z = String(table.zona ?? "").trim();
  if (z.length) return z;
  const n = String(table.nome ?? "").trim();
  return n.length ? n : "Senza zona";
}

function formatMoney(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return `€ ${value.toFixed(2)}`;
}

function buildGroupProposalNote({
  zoneLabel,
  estimatedTotal,
  userNote,
}: {
  zoneLabel: string;
  estimatedTotal?: number | null;
  userNote?: string;
}) {
  const encodedZone = encodeURIComponent(zoneLabel);
  const encodedTotal =
    estimatedTotal === null || estimatedTotal === undefined || !Number.isFinite(estimatedTotal)
      ? ""
      : String(estimatedTotal.toFixed(2));
  const header = `${GROUP_PROPOSAL_META_PREFIX}z=${encodedZone};t=${encodedTotal}`;
  const plainNote = String(userNote ?? "").trim();
  if (!plainNote) return header;
  return `${header}\n${plainNote}`.slice(0, 240);
}

function pickZoneConfigs(rows: VenueTable[]): ZoneConfig[] {
  const map = new Map<string, ZoneConfig>();

  for (const row of rows) {
    const label = normalizeZoneLabel(row);
    const key = label.toLowerCase();

    const next: ZoneConfig = {
      id: row.id,
      label,
      per_testa: asNumber(row.per_testa),
      costo_minimo: asNumber(row.costo_minimo),
      persone_max:
        row.persone_max === null || row.persone_max === undefined
          ? null
          : Number(row.persone_max),
    };

    if (!map.has(key)) {
      map.set(key, next);
      continue;
    }

    const prev = map.get(key)!;
    const prevScore =
      (prev.per_testa !== null && prev.per_testa !== undefined ? 1 : 0) +
      (prev.costo_minimo !== null && prev.costo_minimo !== undefined ? 1 : 0) +
      (prev.persone_max !== null && prev.persone_max !== undefined ? 1 : 0);
    const nextScore =
      (next.per_testa !== null && next.per_testa !== undefined ? 1 : 0) +
      (next.costo_minimo !== null && next.costo_minimo !== undefined ? 1 : 0) +
      (next.persone_max !== null && next.persone_max !== undefined ? 1 : 0);

    if (nextScore > prevScore) map.set(key, next);
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function pickEventTablePricingZones(rows: EventTablePricing[]): ZoneConfig[] {
  const map = new Map<string, ZoneConfig>();

  for (const row of rows) {
    const label = String(row.label ?? row.zona ?? row.nome ?? "").trim() || "Senza zona";
    const key = label.toLowerCase();

    const next: ZoneConfig = {
      id: row.venue_table_id,
      label,
      per_testa: asNumber(row.per_testa),
      costo_minimo: asNumber(row.costo_minimo),
      persone_max:
        row.persone_max === null || row.persone_max === undefined
          ? null
          : Number(row.persone_max),
      hasEventOverride: Boolean(row.has_override),
    };

    if (!map.has(key)) {
      map.set(key, next);
      continue;
    }

    const prev = map.get(key)!;
    const prevScore =
      (prev.hasEventOverride ? 10 : 0) +
      (prev.per_testa !== null && prev.per_testa !== undefined ? 1 : 0) +
      (prev.costo_minimo !== null && prev.costo_minimo !== undefined ? 1 : 0) +
      (prev.persone_max !== null && prev.persone_max !== undefined ? 1 : 0);
    const nextScore =
      (next.hasEventOverride ? 10 : 0) +
      (next.per_testa !== null && next.per_testa !== undefined ? 1 : 0) +
      (next.costo_minimo !== null && next.costo_minimo !== undefined ? 1 : 0) +
      (next.persone_max !== null && next.persone_max !== undefined ? 1 : 0);

    if (nextScore > prevScore) map.set(key, next);
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export default function TableBookingModal({ visible, onClose, event, onBooked }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingInviteContacts, setLoadingInviteContacts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [people, setPeople] = useState<string>("");
  const [tableName, setTableName] = useState<string>("");
  const [inviteFriends, setInviteFriends] = useState<InviteFriend[]>([]);
  const [inviteGroups, setInviteGroups] = useState<InviteGroup[]>([]);
  const [selectedFriendInviteIds, setSelectedFriendInviteIds] = useState<string[]>([]);
  const [selectedGroupInviteIds, setSelectedGroupInviteIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const venueId: string | undefined =
    event?.venue_id ?? event?.venue?.id ?? event?.venueId ?? undefined;
  const eventId: string | undefined = event?.id ?? event?.event_id ?? undefined;

  const selectedZone = useMemo(() => {
    if (!selectedZoneId) return null;
    return zones.find((z) => z.id === selectedZoneId) ?? null;
  }, [selectedZoneId, zones]);

  const guestsValue = useMemo(() => {
    const n = Number(people);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  }, [people]);

  const estimatedTotal = useMemo(() => {
    const guests = guestsValue;
    if (!selectedZone || !guests) return null;

    const perHead = selectedZone.per_testa;
    const minimum = selectedZone.costo_minimo;

    if (perHead === null || perHead === undefined) {
      return minimum ?? null;
    }

    const computed = perHead * guests;
    if (minimum === null || minimum === undefined) return computed;
    return Math.max(computed, minimum);
  }, [selectedZone, guestsValue]);

  const exceedsSelectedZoneMax = useMemo(() => {
    if (!selectedZone || !guestsValue) return false;
    if (selectedZone.persone_max === null || selectedZone.persone_max === undefined) return false;
    return guestsValue > selectedZone.persone_max;
  }, [selectedZone, guestsValue]);

  const canSubmit = Boolean(
    !loadingZones &&
      !submitting &&
      selectedZone &&
      guestsValue &&
      !exceedsSelectedZoneMax,
  );

  const isGroupProposalMode = selectedGroupInviteIds.length > 0;

  const selectedGroups = useMemo(
    () => inviteGroups.filter((group) => selectedGroupInviteIds.includes(group.id)),
    [inviteGroups, selectedGroupInviteIds],
  );

  const invitedFriendIds = useMemo(() => {
    const groupMemberIds = selectedGroupInviteIds.flatMap((groupId) => {
      const group = inviteGroups.find((g) => g.id === groupId);
      return group?.members ?? [];
    });
    return Array.from(new Set([...selectedFriendInviteIds, ...groupMemberIds]));
  }, [inviteGroups, selectedFriendInviteIds, selectedGroupInviteIds]);

  const invitedFriends = useMemo(
    () => inviteFriends.filter((friend) => invitedFriendIds.includes(friend.id)),
    [inviteFriends, invitedFriendIds],
  );

  const noteLabel = isGroupProposalMode ? "Messaggio al gruppo (opzionale)" : "Nome tavolo (opzionale)";
  const notePlaceholder = isGroupProposalMode ? "Es: Chi c'e per questo tavolo?" : "Es: Compleanno Giulia";
  const eventName = event?.name ?? event?.title ?? "Evento NightHub";
  const eventVenue = event?.venue?.name ?? event?.venue_name ?? "Location da confermare";
  const eventDate = event?.date ?? "Data in aggiornamento";
  const eventTime = event?.start_time ?? event?.time ?? "Orario in aggiornamento";
  const zoneCardWidth = Math.min(Math.max(width * 0.44, 170), 220);
  const hasEventSpecificPricing = useMemo(
    () => zones.some((zone) => zone.hasEventOverride),
    [zones],
  );

  const reset = () => {
    setZones([]);
    setSelectedZoneId(null);
    setPeople("");
    setTableName("");
    setSelectedFriendInviteIds([]);
    setSelectedGroupInviteIds([]);
    setError(null);
    setSubmitting(false);
  };

  const reloadInviteContacts = async () => {
    try {
      setLoadingInviteContacts(true);
      const [friendsRes, groupsRes] = await Promise.all([listFriends(), listFriendGroups()]);

      setInviteFriends(
        friendsRes.map((friend) => ({
          id: friend.id,
          name: friend.name || friend.username || "Utente",
          avatar: friend.avatar || "👤",
        })),
      );

      setInviteGroups(
        groupsRes.map((group) => ({
          id: group.id,
          name: group.name,
          members: group.members.map((member) => member.user.id),
        })),
      );
    } catch {
      setInviteFriends([]);
      setInviteGroups([]);
    } finally {
      setLoadingInviteContacts(false);
    }
  };

  const reloadZones = async () => {
    if (!venueId) {
      setZones([]);
      setSelectedZoneId(null);
      setError("Locale non disponibile per questo evento.");
      return;
    }

    try {
      setLoadingZones(true);
      setError(null);

      const eventPricing = Array.isArray(event?.table_pricing)
        ? (event.table_pricing as EventTablePricing[])
        : [];

      if (eventPricing.length > 0) {
        const parsedZones = pickEventTablePricingZones(eventPricing);
        setZones(parsedZones);
        setSelectedZoneId((prev) => prev ?? parsedZones[0]?.id ?? null);
        return;
      }

      const rows = await listVenueTables(venueId);
      const parsedZones = pickZoneConfigs(Array.isArray(rows) ? rows : []);
      setZones(parsedZones);
      setSelectedZoneId((prev) => prev ?? parsedZones[0]?.id ?? null);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message || e?.message || "Errore nel caricamento zone";
      setError(status ? `${msg} (${status})` : msg);
      setZones([]);
      setSelectedZoneId(null);
    } finally {
      setLoadingZones(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setPeople("");
    setTableName("");
    setError(null);
    setSubmitting(false);
    void reloadZones();
    void reloadInviteContacts();
  }, [visible, venueId, eventId]);

  const validate = (): number | null => {
    const guests = Number(people);
    if (!Number.isInteger(guests) || guests < 1) {
      setError("Inserisci almeno 1 persona.");
      return null;
    }

    if (!selectedZone) {
      setError("Seleziona una zona.");
      return null;
    }

    if (
      selectedZone.persone_max !== null &&
      selectedZone.persone_max !== undefined &&
      guests > selectedZone.persone_max
    ) {
      setError(`Massimo ${selectedZone.persone_max} persone per questa zona.`);
      return null;
    }

    setError(null);
    return guests;
  };

  const submit = async () => {
    Keyboard.dismiss();
    if (submitting) return;

    if (!eventId) {
      setError("Evento non valido.");
      return;
    }

    const guests = validate();
    if (!guests || !selectedZone) return;

    try {
      setSubmitting(true);
      setError(null);

      if (isGroupProposalMode) {
        await Promise.resolve(
          onBooked?.({
            mode: "group-proposal",
            venue_id: venueId,
            guests,
            group_ids: selectedGroupInviteIds,
            note: buildGroupProposalNote({
              zoneLabel: selectedZone.label,
              estimatedTotal,
              userNote: tableName.trim() || undefined,
            }),
          }),
        );
      } else {
        const reservation = {
          type: "table",
          event_id: eventId,
          guests,
          venue_zone_id: selectedZone.id,
          venue_table_id: selectedZone.id,
          status: "pending",
          total_amount: estimatedTotal ?? undefined,
          table_name: tableName.trim() || undefined,
          meta: {
            zona: selectedZone.label,
            booking_mode: "zone_request",
            invited_friend_ids: invitedFriendIds,
            invited_groups: [],
          },
        };

        await Promise.resolve(onBooked?.(reservation));
      }

      onClose?.();
      reset();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message || e?.message || "Errore nella prenotazione";
      setError(status ? `${msg} (${status})` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaView
        style={[styles.overlay, { backgroundColor: theme.colors.surface }]}
        edges={["top", "left", "right", "bottom"]}
      >

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, width: "100%" }}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <ScrollView contentContainerStyle={{ paddingBottom: 20 + Math.max(insets.bottom, 0) }} keyboardShouldPersistTaps="handled">
              <View style={[styles.dragHandle, { backgroundColor: `${theme.colors.border}AA` }]} />

              <View style={styles.headerRow}>
                <TouchableOpacity
                  onPress={() => onClose?.()}
                  style={[
                    styles.iconBtn,
                    {
                      borderColor: `${theme.colors.border}99`,
                      backgroundColor: `${theme.colors.card}CC`,
                    },
                  ]}
                >
                  <Feather name="x" size={17} color={theme.colors.text} />
                </TouchableOpacity>

                <View style={styles.headerTitleWrap}>
                  <Text style={[styles.title, { color: theme.colors.text }]}>Prenotazione tavolo</Text>
                  <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Compila e invia la richiesta in pochi passaggi</Text>
                </View>

                <View
                  style={[
                    styles.iconBtn,
                    {
                      borderColor: `${theme.colors.border}99`,
                      backgroundColor: `${theme.colors.card}CC`,
                    },
                  ]}
                >
                  <Feather name="calendar" size={16} color={theme.colors.primary} />
                </View>
              </View>

              <View
                style={[
                  styles.eventCard,
                  {
                    borderColor: `${theme.colors.border}88`,
                    backgroundColor: `${theme.colors.card}DD`,
                  },
                ]}
              >
                <View style={[styles.eventGlow, { backgroundColor: `${theme.colors.primary}22` }]} />
                <View style={styles.eventBadge}>
                  <Feather name="star" size={11} color={theme.colors.primary} />
                  <Text style={[styles.eventBadgeText, { color: theme.colors.primary }]}>VIP ACCESS</Text>
                </View>
                <Text style={[styles.eventName, { color: theme.colors.text }]} numberOfLines={1}>{eventName}</Text>
                <View style={styles.eventMetaRow}>
                  <View style={styles.eventMetaItem}>
                    <Feather name="map-pin" size={12} color={theme.colors.primary} />
                    <Text style={[styles.eventMetaText, { color: theme.colors.muted }]} numberOfLines={1}>{eventVenue}</Text>
                  </View>
                  <View style={[styles.eventDot, { backgroundColor: `${theme.colors.border}AA` }]} />
                  <View style={styles.eventMetaItem}>
                    <Feather name="clock" size={12} color={theme.colors.primary} />
                    <Text style={[styles.eventMetaText, { color: theme.colors.muted }]} numberOfLines={1}>{eventDate} • {eventTime}</Text>
                  </View>
                </View>
              </View>

              {!loadingZones && hasEventSpecificPricing ? (
                <View style={[styles.pricingAlert, { borderColor: `${theme.colors.primary}44`, backgroundColor: `${theme.colors.primary}14` }]}>
                  <Feather name="zap" size={14} color={theme.colors.primary} />
                  <Text style={[styles.pricingAlertText, { color: theme.colors.text }]}>Per questo evento ci sono prezzi tavolo dedicati su alcune zone.</Text>
                </View>
              ) : null}

              {loadingZones ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.muted, fontWeight: "700" }}>Caricamento zone…</Text>
                </View>
              ) : null}

              {!loadingZones && zones.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={{ color: theme.colors.muted, fontWeight: "700", textAlign: "center" }}>
                    Nessuna zona configurata dal locale per questo evento.
                  </Text>
                  <TouchableOpacity
                    onPress={() => void reloadZones()}
                    style={[styles.retryBtn, { borderColor: theme.colors.border }]}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Ricarica</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {!loadingZones && zones.length > 0 ? (
                <>
                  <View style={styles.sectionTopRow}>
                    <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Zona tavolo</Text>
                    <View style={styles.scrollHintWrap}>
                      <Text style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700" }}>Scorri per vedere tutte</Text>
                      <Feather name="chevrons-right" size={14} color={theme.colors.muted} />
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.zoneScrollContent}
                  >
                    {zones.map((z) => {
                      const active = z.id === selectedZoneId;
                      return (
                        <TouchableOpacity
                          key={z.id}
                          onPress={() => {
                            setSelectedZoneId(z.id);
                            setError(null);
                          }}
                          style={[
                            styles.zoneCard,
                            {
                              width: zoneCardWidth,
                              borderColor: active ? theme.colors.primary : `${theme.colors.border}99`,
                              backgroundColor: active ? `${theme.colors.primary}14` : `${theme.colors.card}CC`,
                            },
                          ]}
                        >
                          <View style={styles.zoneHeaderRow}>
                            <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 15 }} numberOfLines={1}>{z.label}</Text>
                            <View style={styles.zoneHeaderBadges}>
                              {z.hasEventOverride ? (
                                <View style={[styles.eventPricingPill, { backgroundColor: `${theme.colors.primary}20`, borderColor: `${theme.colors.primary}40` }]}>
                                  <Text style={[styles.eventPricingPillText, { color: theme.colors.primary }]}>Evento</Text>
                                </View>
                              ) : null}
                              {active ? (
                                <View style={[styles.zoneActiveDot, { backgroundColor: theme.colors.primary }]}>
                                  <Feather name="check" size={12} color={theme.colors.text} />
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <Text style={{ color: theme.colors.muted, marginTop: 8, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                            Minimo
                          </Text>
                          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900", marginTop: 2 }}>
                            {formatMoney(z.costo_minimo)}
                          </Text>
                          <Text style={{ color: theme.colors.muted, marginTop: 8, fontSize: 12 }}>
                            Per testa: {formatMoney(z.per_testa)}
                          </Text>
                          <Text style={{ color: theme.colors.muted, marginTop: 4, fontSize: 12 }}>
                            Max: {z.persone_max ?? "—"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Quante persone siete?</Text>
                  <TextInput
                    value={people}
                    onChangeText={(t) => setPeople(t.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="Inserisci il numero (es. 4)"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
                  />

                  {selectedZone?.persone_max ? (
                    <Text style={{ color: exceedsSelectedZoneMax ? "#ef4444" : theme.colors.muted, marginTop: 6, fontSize: 12, fontWeight: "700" }}>
                      Max per questa zona: {selectedZone.persone_max}
                    </Text>
                  ) : null}

                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>{noteLabel}</Text>
                  <TextInput
                    value={tableName}
                    onChangeText={(t) => setTableName(t.replace(/^\s+/, "").slice(0, 60))}
                    placeholder={notePlaceholder}
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
                    autoCapitalize={isGroupProposalMode ? "sentences" : "words"}
                    autoCorrect={false}
                  />
                  <Text style={{ color: theme.colors.muted, marginTop: 6, fontSize: 11, fontWeight: "700", textAlign: "right" }}>
                    {tableName.length}/60
                  </Text>

                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Invita amici</Text>
                  {loadingInviteContacts ? (
                    <View style={styles.centerBox}>
                      <ActivityIndicator color={theme.colors.primary} />
                      <Text style={{ color: theme.colors.muted, fontWeight: "700" }}>Carico contatti…</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 8 }}>
                        Scegli amici singoli o gruppi. Se selezioni un gruppo, verra creata una proposta con votazione.
                      </Text>
                      <Text style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 10 }}>
                        {isGroupProposalMode
                          ? "I membri vedono la proposta nella chat gruppo e nella tab Attivita, con stato aggiornato in tempo reale."
                          : "Dopo l'invio, gli amici ricevono una notifica e trovano l'invito nella tab Amici."}
                      </Text>

                      {inviteGroups.length > 0 ? (
                        <>
                          <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 13, marginBottom: 8 }}>Gruppi</Text>
                          <View style={styles.inviteChipsWrap}>
                            {inviteGroups.map((group) => {
                              const active = selectedGroupInviteIds.includes(group.id);
                              return (
                                <TouchableOpacity
                                  key={group.id}
                                  onPress={() => {
                                    setSelectedFriendInviteIds([]);
                                    setSelectedGroupInviteIds((prev) =>
                                      prev.includes(group.id)
                                        ? prev.filter((id) => id !== group.id)
                                        : [...prev, group.id],
                                    );
                                  }}
                                  style={[
                                    styles.inviteChip,
                                    {
                                      borderColor: active ? theme.colors.primary : theme.colors.border,
                                      backgroundColor: active ? theme.colors.primary + "22" : theme.colors.card,
                                    },
                                  ]}
                                >
                                  <Text style={{ color: active ? theme.colors.primary : theme.colors.text, fontWeight: "800", fontSize: 12 }}>
                                    {group.name} ({group.members.length})
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </>
                      ) : null}

                      {inviteFriends.length > 0 ? (
                        <>
                          <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 13, marginTop: 12, marginBottom: 8 }}>Singoli</Text>
                          <View style={styles.inviteChipsWrap}>
                            {inviteFriends.map((friend) => {
                              const active = selectedFriendInviteIds.includes(friend.id);
                              return (
                                <TouchableOpacity
                                  key={friend.id}
                                  onPress={() => {
                                    setSelectedGroupInviteIds([]);
                                    setSelectedFriendInviteIds((prev) =>
                                      prev.includes(friend.id)
                                        ? prev.filter((id) => id !== friend.id)
                                        : [...prev, friend.id],
                                    );
                                  }}
                                  style={[
                                    styles.inviteChip,
                                    {
                                      borderColor: active ? theme.colors.primary : theme.colors.border,
                                      backgroundColor: active ? theme.colors.primary + "22" : theme.colors.card,
                                    },
                                  ]}
                                >
                                  <Text style={{ color: active ? theme.colors.primary : theme.colors.text, fontWeight: "800", fontSize: 12 }}>
                                    {friend.avatar} {friend.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </>
                      ) : null}
                    </>
                  )}

                  <View style={[styles.summaryBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
                    <View style={styles.summaryRow}>
                      <Text style={{ color: theme.colors.muted, fontWeight: "700" }}>Zona</Text>
                      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{selectedZone?.label ?? "—"}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={{ color: theme.colors.muted, fontWeight: "700" }}>Persone</Text>
                      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{guestsValue ?? "—"}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={{ color: theme.colors.muted, fontWeight: "700" }}>Totale stimato</Text>
                      <Text style={{ color: theme.colors.primary, fontWeight: "900", fontSize: 18 }}>
                        {estimatedTotal !== null ? formatMoney(estimatedTotal) : "—"}
                      </Text>
                    </View>
                    {isGroupProposalMode ? (
                      <>
                        <Text style={{ color: theme.colors.muted, marginTop: 2 }}>
                          Gruppi coinvolti: {selectedGroups.length}
                        </Text>
                        {selectedGroups.length > 0 ? (
                          <Text style={{ color: theme.colors.muted, marginTop: 2 }} numberOfLines={2}>
                            {selectedGroups.map((group) => group.name).join(", ")}
                          </Text>
                        ) : null}
                        <Text style={{ color: theme.colors.muted, marginTop: 2 }}>
                          Membri da aggiornare: {invitedFriendIds.length}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={{ color: theme.colors.muted, marginTop: 2 }}>
                          Invitati: {invitedFriendIds.length}
                        </Text>
                        {invitedFriends.length > 0 ? (
                          <Text style={{ color: theme.colors.muted, marginTop: 2 }} numberOfLines={2}>
                            {invitedFriends.map((f) => f.name).join(", ")}
                          </Text>
                        ) : null}
                      </>
                    )}
                    {!!tableName.trim() && (
                      <Text style={{ color: theme.colors.muted, marginTop: 2 }}>
                        {isGroupProposalMode ? "Messaggio: " : "Nome tavolo: "}
                        {tableName.trim()}
                      </Text>
                    )}
                    <Text style={{ color: theme.colors.muted, marginTop: 2 }}>
                      {isGroupProposalMode
                        ? "Il gruppo vota prima di procedere con la prenotazione effettiva."
                        : "Il tavolo esatto viene assegnato dal locale in conferma."}
                    </Text>
                    {(isGroupProposalMode || invitedFriendIds.length > 0) ? (
                      <Text style={{ color: theme.colors.primary, marginTop: 6, fontWeight: "700" }}>
                        {isGroupProposalMode
                          ? "Chi crea e chi vota puo seguire l'andamento dalla chat del gruppo e dalla tab Attivita."
                          : "Gli invitati potranno confermare o rifiutare direttamente dalla tab Amici."}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.ctaWrap}>
                    <TouchableOpacity
                      onPress={submit}
                      disabled={!canSubmit}
                      style={[
                        styles.submitBtn,
                        { backgroundColor: theme.colors.primary },
                        !canSubmit && { opacity: 0.55 },
                      ]}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color={theme.colors.text} />
                      ) : (
                        <Feather name="check-circle" size={18} color={theme.colors.text} />
                      )}
                      <Text style={[styles.submitText, { color: theme.colors.text }]}> 
                        {submitting
                          ? "Invio..."
                          : isGroupProposalMode
                            ? selectedGroups.length > 1
                              ? "Crea proposte nei gruppi"
                              : "Crea proposta nel gruppo"
                            : invitedFriendIds.length > 0
                              ? "Invia richiesta e avvisa gli amici"
                              : "Invia richiesta tavolo"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => onClose?.()}
                      style={[
                        styles.secondaryBtn,
                        {
                          borderColor: `${theme.colors.border}CC`,
                          backgroundColor: `${theme.colors.card}D9`,
                        },
                      ]}
                    >
                      <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Annulla</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  sheet: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1,
    maxHeight: "100%",
  },
  dragHandle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  title: { fontSize: 16, fontWeight: "900" },
  subtitle: { marginTop: 2, fontSize: 11, fontWeight: "700" },
  eventCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    overflow: "hidden",
  },
  eventGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 999,
    right: -30,
    top: -20,
  },
  eventBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  eventName: {
    fontSize: 22,
    fontWeight: "900",
  },
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  eventMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  eventMetaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  sectionTopRow: {
    marginTop: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scrollHintWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  centerBox: {
    paddingVertical: 18,
    alignItems: "center",
    gap: 10,
  },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "900",
  },
  zoneScrollContent: {
    gap: 10,
    paddingRight: 4,
    paddingBottom: 2,
  },
  zoneCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
  },
  zoneHeaderBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zoneHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pricingAlert: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pricingAlertText: { fontSize: 12, fontWeight: "800", flex: 1 },
  eventPricingPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  eventPricingPillText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  zoneActiveDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontWeight: "800",
  },
  inviteChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inviteChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  summaryBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ctaWrap: {
    marginTop: 14,
    gap: 10,
  },
  submitBtn: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitText: { fontWeight: "900", fontSize: 14 },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  errorText: { marginTop: 12, color: "#ef4444", fontWeight: "700" },
});
