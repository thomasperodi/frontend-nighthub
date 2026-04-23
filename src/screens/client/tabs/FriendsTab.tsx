import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, FlatList, Alert, SectionList, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, AppState, type AppStateStatus } from "react-native";
import { Feather } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../../theme/ThemeProvider";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  acceptFriendRequest,
  addFriendGroupMember,
  bookGroupTableProposal,
  cancelGroupTableProposal,
  createFriendGroup,
  createGroupTableProposal,
  deleteFriendGroup,
  listGroupTableProposals,
  listFriendGroups,
  listFriendRequests,
  listFriends,
  removeFriend,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  type FriendListItem,
  voteGroupTableProposal,
} from "../../../services/friends";
import { fetchVenues } from "../../../services/venues";
import { fetchEventsByVenue } from "../../../services/events";
import type { Event as AppEvent } from "../../../types/events";
import { listVenueTables } from "../../../services/tables";
import type { VenueTable } from "../../../types/tables";
import {
  fetchReservations,
  fetchReservationById,
  listIncomingTableInvitations,
  respondToTableInvitation,
  type IncomingTableInvitation,
} from "../../../services/reservations";
import { useAuth } from "../../../providers/AuthProvider";
import type { Reservation, ReservationInvitationStatus } from "../../../types/reservations";
// Mock data - Amici


type FriendItem = {
  id: string;
  name: string;
  online: boolean;
  currentVenue: string | null;
  status: string | null;
  avatar: string;
  lastSeen: string | null;
};

type FriendRequestItem = {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  sentAt: string;
};

type TableInvitationItem = IncomingTableInvitation & {
  id: string;
};

type DirectInviteActivityItem = {
  id: string;
  reservationId: string;
  createdAt: string;
  reservationStatus: Reservation["status"];
  guests: number;
  tableName?: string | null;
  zoneLabel?: string | null;
  totalAmount?: number | null;
  event: {
    id?: string;
    name: string;
    date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
  };
  venue: { id?: string; name: string; city?: string | null };
  invitees: Array<{
    userId: string;
    name: string;
    status: ReservationInvitationStatus;
  }>;
  inviteStats: { accepted: number; declined: number; pending: number };
};

type ActivityFeedItem =
  | { kind: "proposal"; id: string; createdAt: string; proposal: GroupTableProposal }
  | { kind: "directInvite"; id: string; createdAt: string; invite: DirectInviteActivityItem }
  | { kind: "incomingInvite"; id: string; createdAt: string; invite: TableInvitationItem };

type PriorityFeedItem =
  | { kind: "invite"; id: string; invite: TableInvitationItem }
  | { kind: "request"; id: string; request: FriendRequestItem };

type UserSearchItem = {
  id: string;
  name: string;
  avatar: string;
  isFriend: boolean;
  hasPendingRequest: boolean;
  isSelf: boolean;
  mutualFriendsCount: number;
  mutualFriendProfiles: Array<{ id: string; name: string; avatar: string }>;
  mutualFriendsIds: string[];
};

type GroupItem = {
  id: string;
  name: string;
  avatar: string;
  ownerId: string;
  members: string[];
  memberProfiles: Array<{ id: string; name: string; avatar: string }>;
  color: string;
  createdAt: Date;
};

type ProposalVote = "yes" | "no" | "pending";

type GroupTableProposal = {
  id: string;
  groupId: string;
  createdByUserId: string;
  createdByName: string;
  createdByAvatar: string;
  venueId: string;
  venueName: string;
  eventName: string;
  eventDate: string;
  eventStartTime?: string;
  eventEndTime?: string;
  createdAt: string;
  guests: number;
  note?: string;
  zoneLabel?: string;
  estimatedTotal?: number;
  userNote?: string;
  votes: Array<{
    userId: string;
    name: string;
    avatar: string;
    vote: ProposalVote;
  }>;
  status: "voting" | "ready" | "booked" | "cancelled";
  voteStats: { yes: number; no: number; pending: number };
  bookedReservationId?: string;
};

type AppVenue = {
  id: string;
  name: string;
  city?: string | null;
};

type ZoneConfig = {
  id: string;
  label: string;
  perHead?: number | null;
  minimum?: number | null;
  maxPeople?: number | null;
};

type ProposalNoteMeta = {
  zoneLabel?: string;
  estimatedTotal?: number;
  userNote?: string;
};

const GROUP_PROPOSAL_META_PREFIX = "[grp-meta]";
const FRIEND_PRESENCE_REFRESH_MS = 30 * 1000;

const formatShortDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
};

const formatEventDateTime = (dateValue?: string | null, startTime?: string | null, endTime?: string | null) => {
  if (!dateValue) return "Data evento non disponibile";
  const raw = String(dateValue).trim();

  const date = new Date(raw);
  const dateLabel = !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("it-IT", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : raw;

  const normalizeTime = (value?: string | null) => {
    if (!value) return "";
    const time = String(value).trim();
    const match = time.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return "";
    const hh = match[1].padStart(2, "0");
    return `${hh}:${match[2]}`;
  };

  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  if (start && end) return `${dateLabel} • ${start}-${end}`;
  if (start) return `${dateLabel} • ${start}`;
  return dateLabel;
};

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatMoney = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return `€ ${value.toFixed(2)}`;
};

const formatInvitationStatus = (status: TableInvitationItem["invitation_status"]) => {
  if (status === "accepted") return "Ci sei";
  if (status === "declined") return "Hai rifiutato";
  return "In attesa";
};

const formatReservationStatus = (status: TableInvitationItem["reservation_status"]) => {
  if (status === "confirmed") return "Confermato dal locale";
  if (status === "cancelled") return "Annullato";
  if (status === "completed") return "Completato";
  return "In attesa del locale";
};

const formatProposalStatus = (status: GroupTableProposal["status"]) => {
  if (status === "booked") return "Prenotato";
  if (status === "ready") return "Pronto";
  if (status === "cancelled") return "Annullato";
  return "In votazione";
};

const formatDirectInviteStatus = (status: Reservation["status"]) => {
  if (status === "confirmed") return "Confermato dal locale";
  if (status === "cancelled") return "Annullato";
  if (status === "completed") return "Completato";
  return "In votazione";
};

const normalizeZoneLabel = (table: VenueTable): string => {
  const zone = String(table.zona ?? "").trim();
  if (zone.length) return zone;
  const name = String(table.nome ?? "").trim();
  return name.length ? name : "Senza zona";
};

const pickZoneConfigs = (rows: VenueTable[]): ZoneConfig[] => {
  const byLabel = new Map<string, ZoneConfig>();

  for (const row of rows) {
    const label = normalizeZoneLabel(row);
    const key = label.toLowerCase();
    const next: ZoneConfig = {
      id: row.id,
      label,
      perHead: asNumber(row.per_testa),
      minimum: asNumber(row.costo_minimo),
      maxPeople:
        row.persone_max === null || row.persone_max === undefined
          ? null
          : Number(row.persone_max),
    };

    if (!byLabel.has(key)) {
      byLabel.set(key, next);
      continue;
    }

    const prev = byLabel.get(key)!;
    const score = (candidate: ZoneConfig) =>
      (candidate.perHead !== null && candidate.perHead !== undefined ? 1 : 0) +
      (candidate.minimum !== null && candidate.minimum !== undefined ? 1 : 0) +
      (candidate.maxPeople !== null && candidate.maxPeople !== undefined ? 1 : 0);

    if (score(next) > score(prev)) byLabel.set(key, next);
  }

  return Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const buildProposalNote = ({
  zoneLabel,
  estimatedTotal,
  userNote,
}: {
  zoneLabel: string;
  estimatedTotal?: number | null;
  userNote?: string;
}) => {
  const encodedZone = encodeURIComponent(zoneLabel);
  const encodedTotal =
    estimatedTotal === null || estimatedTotal === undefined || !Number.isFinite(estimatedTotal)
      ? ""
      : String(estimatedTotal.toFixed(2));

  const header = `${GROUP_PROPOSAL_META_PREFIX}z=${encodedZone};t=${encodedTotal}`;
  const plainNote = String(userNote ?? "").trim();
  if (!plainNote) return header;
  return `${header}\n${plainNote}`.slice(0, 240);
};

const parseProposalNote = (note?: string | null): ProposalNoteMeta => {
  const raw = String(note ?? "").trim();
  if (!raw) return {};
  if (!raw.startsWith(GROUP_PROPOSAL_META_PREFIX)) return { userNote: raw };

  const [metaPart, ...rest] = raw.split("\n");
  const compact = metaPart.replace(GROUP_PROPOSAL_META_PREFIX, "");
  const tokens = compact.split(";").map((token) => token.trim()).filter(Boolean);
  const map = new Map(tokens.map((token) => {
    const [key, value] = token.split("=");
    return [key, value ?? ""] as const;
  }));

  const zoneEncoded = map.get("z");
  const zoneLabel = zoneEncoded ? decodeURIComponent(zoneEncoded) : undefined;
  const totalRaw = map.get("t");
  const parsedTotal = totalRaw ? Number(totalRaw) : NaN;
  const userNote = rest.join("\n").trim() || undefined;

  return {
    zoneLabel,
    estimatedTotal: Number.isFinite(parsedTotal) ? parsedTotal : undefined,
    userNote,
  };
};

const isImageUrl = (value?: string | null) => {
  const uri = String(value ?? "").trim();
  return /^https?:\/\//i.test(uri);
};

const formatFriendLastSeen = (minutes?: number | null) => {
  if (minutes === null || minutes === undefined) return "di recente";
  if (minutes <= 1) return "ora";
  if (minutes < 60) return `${minutes} min fa`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 ora fa" : `${hours} ore fa`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? "ieri" : `${days} gg fa`;
  }

  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 sett fa" : `${weeks} sett fa`;
};

const createFallbackFriendItem = ({
  id,
  name,
  avatar = "",
  online = false,
  currentVenue = null,
  status = null,
  lastSeen = "di recente",
}: {
  id: string;
  name: string;
  avatar?: string;
  online?: boolean;
  currentVenue?: string | null;
  status?: string | null;
  lastSeen?: string | null;
}): FriendItem => ({
  id,
  name,
  avatar,
  online,
  currentVenue,
  status,
  lastSeen,
});

const mapFriendApiToItem = (friend: FriendListItem): FriendItem => ({
  id: friend.id,
  name: friend.name || friend.username || "Utente",
  online: Boolean(friend.online),
  currentVenue: friend.current_venue || null,
  status: friend.status || (friend.online ? "Attivo ora" : null),
  avatar: friend.avatar || "",
  lastSeen: formatFriendLastSeen(friend.last_seen_minutes_ago),
});

interface FriendsTabProps {
  onPendingRequestsChange?: (count: number) => void;
}

export default function FriendsTab({ onPendingRequestsChange }: FriendsTabProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const insets = useSafeAreaInsets();
  const bottomListInset = Math.max(insets.bottom, 16) + 96;
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>([]);
  const [tableInvitations, setTableInvitations] = useState<TableInvitationItem[]>([]);
  const [usersToAdd, setUsersToAdd] = useState<UserSearchItem[]>([]);
  const [outgoingFriendRequestUserIds, setOutgoingFriendRequestUserIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingGroupProposals, setLoadingGroupProposals] = useState(false);
  const [respondingInvitationId, setRespondingInvitationId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"friends" | "groups" | "activity">("friends");
  const [searchText, setSearchText] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [friendDirectoryQuery, setFriendDirectoryQuery] = useState("");
  const [createGroupFriendQuery, setCreateGroupFriendQuery] = useState("");
  const [inviteFriendQuery, setInviteFriendQuery] = useState("");
  const [visibleOnlineCount, setVisibleOnlineCount] = useState(20);
  const [visibleOfflineCount, setVisibleOfflineCount] = useState(30);
  const [visibleCreateGroupFriendsCount, setVisibleCreateGroupFriendsCount] = useState(24);
  const [visibleInviteFriendsCount, setVisibleInviteFriendsCount] = useState(24);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [groupProposals, setGroupProposals] = useState<GroupTableProposal[]>([]);
  const [directInviteActivities, setDirectInviteActivities] = useState<DirectInviteActivityItem[]>([]);
  const [venues, setVenues] = useState<AppVenue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [selectedVenueForProposal, setSelectedVenueForProposal] = useState<string | null>(null);
  const [proposalZones, setProposalZones] = useState<ZoneConfig[]>([]);
  const [selectedProposalZoneId, setSelectedProposalZoneId] = useState<string | null>(null);
  const [loadingProposalZones, setLoadingProposalZones] = useState(false);
  const [proposalGuests, setProposalGuests] = useState("4");
  const [proposalNote, setProposalNote] = useState("");
  const [venueEvents, setVenueEvents] = useState<AppEvent[]>([]);
  const [loadingVenueEvents, setLoadingVenueEvents] = useState(false);
  const [selectedEventIdForProposal, setSelectedEventIdForProposal] = useState<string | null>(null);

  const syncPendingBadgeCount = useCallback((requestCount: number, invitations: TableInvitationItem[]) => {
    const pendingInvitations = invitations.filter((item) => item.invitation_status === "pending").length;
    onPendingRequestsChange?.(requestCount + pendingInvitations);
  }, [onPendingRequestsChange]);

  const refreshFriendsPresence = useCallback(async () => {
    try {
      const friendsRes = await listFriends();
      setFriends(friendsRes.map(mapFriendApiToItem));
    } catch {
      // Ignore transient refresh errors and keep the last known presence snapshot.
    }
  }, []);

  const mapDirectInviteActivities = useCallback((reservations: Reservation[], friendMap: Map<string, string>) => {
    return reservations
      .filter((reservation) => reservation.type === "table" && reservation.status !== "cancelled")
      .map((reservation): DirectInviteActivityItem | null => {
        const meta = reservation.meta;
        const invites = Array.isArray(meta?.table_invites)
          ? meta.table_invites.filter((invite) => invite.source === "direct")
          : [];
        if (invites.length === 0) return null;

        const inviteStats = invites.reduce(
          (acc, invite) => {
            if (invite.status === "accepted") acc.accepted += 1;
            else if (invite.status === "declined") acc.declined += 1;
            else acc.pending += 1;
            return acc;
          },
          { accepted: 0, declined: 0, pending: 0 },
        );

        return {
          id: `direct-${reservation.id}`,
          reservationId: reservation.id,
          createdAt: reservation.created_at || reservation.updated_at || new Date().toISOString(),
          reservationStatus: reservation.status,
          guests: reservation.guests,
          tableName: reservation.table_name ?? null,
          zoneLabel: reservation.meta?.zone_label || (reservation.meta as any)?.zona || null,
          totalAmount:
            reservation.total_amount === null || reservation.total_amount === undefined
              ? null
              : Number(reservation.total_amount),
          event: {
            id: reservation.event?.id,
            name: reservation.event?.name || "Evento",
            date: reservation.event?.date,
            start_time: reservation.event?.start_time,
            end_time: reservation.event?.end_time,
          },
          venue: {
            id: reservation.venue?.id || reservation.event?.venue_id,
            name: reservation.venue?.name || reservation.event?.venue?.name || "Locale",
            city: reservation.venue?.city || reservation.event?.venue?.city || null,
          },
          invitees: invites.map((invite) => ({
            userId: invite.user_id,
            name: friendMap.get(invite.user_id) || "Amico invitato",
            status: invite.status,
          })),
          inviteStats,
        } satisfies DirectInviteActivityItem;
      })
      .filter((value): value is DirectInviteActivityItem => value !== null)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, []);

  const normalizeGroupMembers = (group: any): string[] => {
    const memberIds = (group?.members ?? []).flatMap((member: any) => {
      if (typeof member === "string") return [member];
      const directId = member?.id;
      const userId = member?.user?.id;
      return [directId, userId].filter(Boolean);
    });

    const ownerId = group?.owner_id || group?.ownerId;
    const all = [...memberIds, ownerId].filter(Boolean).map((id) => String(id));
    return Array.from(new Set(all));
  };

  const mapGroupMemberProfiles = (group: any) => {
    const fromMembers = (group?.members ?? [])
      .map((member: any) => {
        const userInfo = member?.user || member;
        const id = userInfo?.id;
        if (!id) return null;
        return {
          id: String(id),
          name: userInfo?.name || userInfo?.username || "Utente",
          avatar: userInfo?.avatar || "",
        };
      })
      .filter(Boolean) as Array<{ id: string; name: string; avatar: string }>;

    const dedup = new Map<string, { id: string; name: string; avatar: string }>();
    fromMembers.forEach((m) => dedup.set(m.id, m));
    return Array.from(dedup.values());
  };

  const isCurrentUserInGroup = (group: GroupItem | null | undefined) => {
    if (!group || !user?.id) return false;
    const currentUserId = String(user.id);
    return group.ownerId === currentUserId || group.members.includes(currentUserId);
  };

  const closeGroupSubModals = () => {
    setShowInviteModal(false);
    setShowVenueModal(false);
  };

  useEffect(() => {
    if (selectedGroup) return;
    closeGroupSubModals();
    setSelectedVenueForProposal(null);
    setProposalZones([]);
    setSelectedProposalZoneId(null);
    setProposalGuests("4");
    setProposalNote("");
    setVenueEvents([]);
    setSelectedEventIdForProposal(null);
  }, [selectedGroup]);

  const selectedProposalZone = useMemo(
    () => proposalZones.find((zone) => zone.id === selectedProposalZoneId) ?? null,
    [proposalZones, selectedProposalZoneId],
  );

  const proposalGuestsValue = useMemo(() => {
    const numeric = Number(proposalGuests);
    if (!Number.isInteger(numeric) || numeric < 2) return null;
    return numeric;
  }, [proposalGuests]);

  const proposalEstimatedTotal = useMemo(() => {
    if (!selectedProposalZone || !proposalGuestsValue) return null;
    const perHead = selectedProposalZone.perHead;
    const minimum = selectedProposalZone.minimum;

    if (perHead === null || perHead === undefined) return minimum ?? null;
    const calculated = perHead * proposalGuestsValue;
    if (minimum === null || minimum === undefined) return calculated;
    return Math.max(calculated, minimum);
  }, [proposalGuestsValue, selectedProposalZone]);

  const exceedsSelectedZoneMax = useMemo(() => {
    if (!selectedProposalZone || !proposalGuestsValue) return false;
    if (selectedProposalZone.maxPeople === null || selectedProposalZone.maxPeople === undefined) return false;
    return proposalGuestsValue > selectedProposalZone.maxPeople;
  }, [proposalGuestsValue, selectedProposalZone]);

  const onlineFriends = useMemo(() => friends.filter((f) => f.online), [friends]);
  const offlineFriends = useMemo(() => friends.filter((f) => !f.online), [friends]);
  const normalizedFriendDirectoryQuery = friendDirectoryQuery.trim().toLowerCase();

  const filteredOnlineFriends = useMemo(
    () => onlineFriends.filter((friend) => friend.name.toLowerCase().includes(normalizedFriendDirectoryQuery)),
    [onlineFriends, normalizedFriendDirectoryQuery],
  );

  const filteredOfflineFriends = useMemo(
    () => offlineFriends.filter((friend) => friend.name.toLowerCase().includes(normalizedFriendDirectoryQuery)),
    [offlineFriends, normalizedFriendDirectoryQuery],
  );

  useEffect(() => {
    setVisibleOnlineCount(20);
    setVisibleOfflineCount(30);
  }, [normalizedFriendDirectoryQuery, onlineFriends.length, offlineFriends.length]);

  useEffect(() => {
    setVisibleCreateGroupFriendsCount(24);
  }, [createGroupFriendQuery, friends.length, showCreateGroupModal]);

  useEffect(() => {
    setVisibleInviteFriendsCount(24);
  }, [inviteFriendQuery, selectedGroup?.id, friends.length, showInviteModal]);

  const visibleOnlineFriends = useMemo(
    () => filteredOnlineFriends.slice(0, visibleOnlineCount),
    [filteredOnlineFriends, visibleOnlineCount],
  );

  const visibleOfflineFriends = useMemo(
    () => filteredOfflineFriends.slice(0, visibleOfflineCount),
    [filteredOfflineFriends, visibleOfflineCount],
  );

  useEffect(() => {
    const loadAll = async () => {
      setLoadingFriends(true);
      setLoadingRequests(true);
      setLoadingInvitations(true);
      setLoadingGroups(true);

      try {
        const [friendsRes, requestsRes, invitationsRes, groupsRes, reservationsRes] = await Promise.all([
          listFriends(),
          listFriendRequests(),
          listIncomingTableInvitations(),
          listFriendGroups(),
          fetchReservations(),
        ]);

        setLoadingVenues(true);
        try {
          const venuesRes = await fetchVenues();
          setVenues(venuesRes.map((venue) => ({ id: venue.id, name: venue.name, city: venue.city })));
        } catch {
          setVenues([]);
        } finally {
          setLoadingVenues(false);
        }

        setFriends(
          friendsRes.map(mapFriendApiToItem)
        );

        const friendNameMap = new Map(
          friendsRes.map((friend) => [friend.id, friend.name || friend.username || "Utente"] as const),
        );

        setFriendRequests(
          requestsRes.incoming.map((req) => ({
            id: req.id,
            userId: req.from_user.id,
            name: req.from_user.name || req.from_user.username || "Utente",
            avatar: req.from_user.avatar || "",
            sentAt: "Nuova",
          }))
        );

        setOutgoingFriendRequestUserIds(
          requestsRes.outgoing
            .map((req) => String(req.to_user?.id || ""))
            .filter(Boolean),
        );

        setTableInvitations(
          invitationsRes.map((invitation) => ({
            ...invitation,
            id: invitation.reservation_id,
          })),
        );

        syncPendingBadgeCount(requestsRes.incoming.length, invitationsRes.map((invitation) => ({
          ...invitation,
          id: invitation.reservation_id,
        })));

        setGroups(
          groupsRes.map((g) => ({
            id: g.id,
            name: g.name,
            avatar: "",
            ownerId: String((g as any).owner_id || ""),
            members: normalizeGroupMembers(g),
            memberProfiles: mapGroupMemberProfiles(g),
            color: "#6D5BFF",
            createdAt: new Date(),
          }))
        );

        setDirectInviteActivities(mapDirectInviteActivities(reservationsRes, friendNameMap));
      } catch {
        setFriends([]);
        setFriendRequests([]);
        setOutgoingFriendRequestUserIds([]);
        setTableInvitations([]);
        setGroups([]);
        setDirectInviteActivities([]);
        onPendingRequestsChange?.(0);
      } finally {
        setLoadingFriends(false);
        setLoadingRequests(false);
        setLoadingInvitations(false);
        setLoadingGroups(false);
      }
    };

    loadAll();
  }, [mapDirectInviteActivities, onPendingRequestsChange, syncPendingBadgeCount]);

  useEffect(() => {
    let disposed = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stopRefresh = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const runRefresh = () => {
      if (disposed) return;
      void refreshFriendsPresence();
    };

    const startRefresh = () => {
      stopRefresh();
      runRefresh();
      intervalId = setInterval(runRefresh, FRIEND_PRESENCE_REFRESH_MS);
    };

    if (AppState.currentState === "active") {
      startRefresh();
    }

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        startRefresh();
        return;
      }

      stopRefresh();
    });

    return () => {
      disposed = true;
      stopRefresh();
      subscription.remove();
    };
  }, [refreshFriendsPresence]);

  useEffect(() => {
    const loadSearch = async () => {
      const q = searchText.trim();
      if (q.length < 2) return;
      setLoadingSearch(true);
      try {
        const results = await searchUsers(q);
        const friendIds = new Set(friends.map((friend) => String(friend.id)));
        const pendingIds = new Set(outgoingFriendRequestUserIds.map((id) => String(id)));
        const currentUserId = String(user?.id || "");
        setUsersToAdd(
          results.map((u: any) => {
            const rawIds = Array.isArray(u?.mutual_friends_ids)
              ? u.mutual_friends_ids
              : Array.isArray(u?.mutualFriendsIds)
                ? u.mutualFriendsIds
                : [];

            const rawProfiles = Array.isArray(u?.mutual_friends)
              ? u.mutual_friends
              : Array.isArray(u?.mutualFriends)
                ? u.mutualFriends
                : [];

            const mutualFriendProfiles = rawProfiles
              .map((mf: any) => ({
                id: String(mf?.id || ""),
                name: String(mf?.name || mf?.username || "Utente"),
                avatar: String(mf?.avatar || ""),
              }))
              .filter((mf: any) => mf.id.length > 0);

            const mutualFriendsIds = Array.from(new Set([
              ...rawIds.map((id: any) => String(id)).filter(Boolean),
              ...mutualFriendProfiles.map((mf: any) => mf.id),
            ]));

            const mutualFriendsCountRaw = Number(u?.mutual_friends_count ?? u?.mutualFriendsCount ?? NaN);
            const mutualFriendsCount = Number.isFinite(mutualFriendsCountRaw)
              ? Math.max(0, mutualFriendsCountRaw)
              : Math.max(mutualFriendsIds.length, mutualFriendProfiles.length);

            return {
              id: String(u.id),
              name: u.name || u.username || "Utente",
              avatar: u.avatar || "",
              isFriend: friendIds.has(String(u.id)),
              hasPendingRequest: pendingIds.has(String(u.id)),
              isSelf: currentUserId.length > 0 && String(u.id) === currentUserId,
              mutualFriendsCount,
              mutualFriendProfiles,
              mutualFriendsIds,
            } satisfies UserSearchItem;
          })
        );
      } catch {
        // ignore search errors
      } finally {
        setLoadingSearch(false);
      }
    };

    loadSearch();
  }, [friends, outgoingFriendRequestUserIds, searchText, user?.id]);

  const searchedUsers = useMemo(() => {
    return usersToAdd.filter(user =>
      user.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [searchText, usersToAdd]);

  const getMutualFriends = (userId: string) => {
    const user = usersToAdd.find(u => u.id === userId);
    if (!user) return [];

    if (user.mutualFriendProfiles.length > 0) {
      return user.mutualFriendProfiles.map((profile) =>
        createFallbackFriendItem({
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar,
        })
      );
    }

    return friends.filter(f => user.mutualFriendsIds?.includes(f.id));
  };

  const getMutualFriendsCount = (userId: string) => {
    const user = usersToAdd.find((candidate) => candidate.id === userId);
    if (!user) return 0;
    return Math.max(user.mutualFriendsCount, getMutualFriends(userId).length);
  };

  const getGroupMembers = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    const profileMap = new Map(group.memberProfiles.map((member) => [member.id, member]));
    friends.forEach((friend) => {
      if (!profileMap.has(friend.id) && group.members.includes(friend.id)) {
        profileMap.set(friend.id, { id: friend.id, name: friend.name, avatar: friend.avatar });
      }
    });
    const groupFriends = Array.from(profileMap.values()).map((member) =>
      createFallbackFriendItem({
        id: member.id,
        name: member.name,
        avatar: member.avatar,
      })
    );
    const ownerAlreadyVisible = groupFriends.some((friend) => friend.id === group.ownerId);
    if (!ownerAlreadyVisible && group.ownerId === String(user?.id)) {
      return [
        createFallbackFriendItem({
          id: String(user?.id),
          name: "Tu",
        }),
        ...groupFriends,
      ];
    }
    return groupFriends;
  }, [groups, friends, user?.id]);

  const getGroupMemberCount = useCallback((group: GroupItem) => {
    return getGroupMembers(group.id).length;
  }, [getGroupMembers]);

  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group] as const)),
    [groups],
  );

  const getGroupProposals = useCallback((groupId: string) =>
    groupProposals
      .filter((proposal) => proposal.groupId === groupId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [groupProposals],
  );

  const selectedGroupMembersData = useMemo(
    () => (selectedGroup?.id ? getGroupMembers(selectedGroup.id) : []),
    [selectedGroup?.id, getGroupMembers],
  );

  const selectedGroupProposals = useMemo(
    () => (selectedGroup?.id ? getGroupProposals(selectedGroup.id).filter((proposal) => proposal.status !== "cancelled") : []),
    [selectedGroup?.id, getGroupProposals],
  );

  const selectedGroupIsOwner = useMemo(
    () => !!selectedGroup && selectedGroup.ownerId === String(user?.id),
    [selectedGroup, user?.id],
  );

  const mapProposal = useCallback((proposal: any): GroupTableProposal => {
    const parsedMeta = parseProposalNote(proposal.note);
    return {
    id: proposal.id,
    groupId: proposal.group_id,
    createdByUserId: String(proposal.created_by_user?.id || ""),
    createdByName: proposal.created_by_user?.name || proposal.created_by_user?.username || "Utente",
    createdByAvatar: proposal.created_by_user?.avatar || "",
    venueId: proposal.venue?.id,
    venueName: proposal.venue?.name || "Locale",
    eventName: proposal.event?.name || "Evento",
    eventDate: proposal.event?.date || "",
    eventStartTime: proposal.event?.start_time || "",
    eventEndTime: proposal.event?.end_time || "",
    createdAt: proposal.created_at,
    guests: proposal.guests,
    note: proposal.note || undefined,
    zoneLabel: parsedMeta.zoneLabel,
    estimatedTotal: parsedMeta.estimatedTotal,
    userNote: parsedMeta.userNote,
    status: proposal.status,
    voteStats: proposal.vote_stats || { yes: 0, no: 0, pending: 0 },
    bookedReservationId: proposal.booked_reservation?.id,
    votes: (proposal.votes || []).map((vote: any) => ({
      userId: vote.user_id,
      name: vote.user?.name || vote.user?.username || "Utente",
      avatar: vote.user?.avatar || "",
      vote: vote.vote,
    })),
  };
  }, []);

  useEffect(() => {
    const loadProposalZones = async () => {
      if (!showVenueModal || !selectedVenueForProposal) {
        setProposalZones([]);
        setSelectedProposalZoneId(null);
        return;
      }

      setLoadingProposalZones(true);
      try {
        const rows = await listVenueTables(selectedVenueForProposal);
        const zones = pickZoneConfigs(Array.isArray(rows) ? rows : []);
        setProposalZones(zones);
        setSelectedProposalZoneId((prev) => prev ?? zones[0]?.id ?? null);
      } catch {
        setProposalZones([]);
        setSelectedProposalZoneId(null);
      } finally {
        setLoadingProposalZones(false);
      }
    };

    void loadProposalZones();
  }, [selectedVenueForProposal, showVenueModal]);

  useEffect(() => {
    const loadVenueEvents = async () => {
      if (!showVenueModal || !selectedVenueForProposal) {
        setVenueEvents([]);
        setSelectedEventIdForProposal(null);
        return;
      }
      setLoadingVenueEvents(true);
      try {
        const events = await fetchEventsByVenue(selectedVenueForProposal);
        const upcoming = (Array.isArray(events) ? events : [])
          .filter((e) => e.status !== "CLOSED")
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        setVenueEvents(upcoming);
        setSelectedEventIdForProposal((prev) => prev ?? upcoming[0]?.id ?? null);
      } catch {
        setVenueEvents([]);
        setSelectedEventIdForProposal(null);
      } finally {
        setLoadingVenueEvents(false);
      }
    };
    void loadVenueEvents();
  }, [selectedVenueForProposal, showVenueModal]);

  const refreshGroupProposals = useCallback(async (groupId: string) => {
    try {
      const response = await listGroupTableProposals(groupId);
      const reconciled = await Promise.all(
        response.map(async (rawProposal) => {
          const proposal = mapProposal(rawProposal);
          if (proposal.status !== "booked" || !proposal.bookedReservationId) return proposal;
          try {
            const reservation = await fetchReservationById(proposal.bookedReservationId);
            const reservationStatus = String((reservation as any)?.status || "").toLowerCase();
            if (!reservation || reservationStatus === "cancelled") {
              return { ...proposal, status: "cancelled" as const };
            }
            return proposal;
          } catch {
            return proposal;
          }
        }),
      );

      setGroupProposals((prev) => {
        const withoutGroup = prev.filter((proposal) => proposal.groupId !== groupId);
        return [...withoutGroup, ...reconciled.filter((proposal) => proposal.status !== "cancelled")];
      });
    } catch {
      setGroupProposals((prev) => prev.filter((proposal) => proposal.groupId !== groupId));
    }
  }, [mapProposal]);

  const refreshAllGroupProposals = useCallback(async () => {
    if (groups.length === 0) {
      setGroupProposals([]);
      return;
    }

    setLoadingGroupProposals(true);
    try {
      const responses = await Promise.all(
        groups.map(async (group) => ({
          groupId: group.id,
          proposals: await listGroupTableProposals(group.id),
        })),
      );

      const nextProposals = responses.flatMap(({ proposals }) =>
        proposals
          .map((proposal) => mapProposal(proposal))
          .filter((proposal) => proposal.status !== "cancelled"),
      );

      setGroupProposals(nextProposals);
    } catch {
      setGroupProposals([]);
    } finally {
      setLoadingGroupProposals(false);
    }
  }, [groups, mapProposal]);

  useEffect(() => {
    if (!selectedGroup?.id) return;
    void refreshGroupProposals(selectedGroup.id);
  }, [refreshGroupProposals, selectedGroup?.id]);

  useEffect(() => {
    void refreshAllGroupProposals();
  }, [refreshAllGroupProposals]);

  useEffect(() => {
    if (activeTab !== "activity") return;
    void refreshAllGroupProposals();
  }, [activeTab, refreshAllGroupProposals]);

  const handleCreateGroupProposal = async () => {
    if (!selectedGroup) {
      Alert.alert("Errore", "Seleziona un gruppo prima di proporre un tavolo");
      return;
    }

    if (!selectedVenueForProposal) {
      Alert.alert("Errore", "Seleziona un locale");
      return;
    }

    const guests = Number(proposalGuests);
    if (!Number.isInteger(guests) || guests < 2) {
      Alert.alert("Errore", "Inserisci un numero valido di persone (minimo 2)");
      return;
    }

    if (!selectedProposalZone) {
      Alert.alert("Errore", "Seleziona una zona del locale");
      return;
    }

    if (exceedsSelectedZoneMax) {
      Alert.alert("Errore", `Numero persone oltre il massimo per ${selectedProposalZone.label}`);
      return;
    }

    const venue = venues.find((v) => v.id === selectedVenueForProposal);
    if (!venue) {
      Alert.alert("Errore", "Locale non valido");
      return;
    }

    try {
      const created = await createGroupTableProposal(selectedGroup.id, {
        venue_id: venue.id,
        ...(selectedEventIdForProposal ? { event_id: selectedEventIdForProposal } : {}),
        guests,
        note: buildProposalNote({
          zoneLabel: selectedProposalZone.label,
          estimatedTotal: proposalEstimatedTotal,
          userNote: proposalNote,
        }),
      });

      setGroupProposals((prev) => [mapProposal(created), ...prev.filter((proposal) => proposal.id !== created.id)]);
      setSelectedVenueForProposal(null);
      setProposalZones([]);
      setSelectedProposalZoneId(null);
      setProposalGuests("4");
      setProposalNote("");
      setVenueEvents([]);
      setSelectedEventIdForProposal(null);
      setShowVenueModal(false);
      Alert.alert("Proposta creata", "Il gruppo può votare subito: ci sono / non ci sono.");
    } catch {
      Alert.alert("Errore", "Impossibile creare la proposta tavolo");
    }
  };

  const handleVoteProposal = async (groupId: string, proposalId: string, vote: "yes" | "no") => {
    try {
      const updated = await voteGroupTableProposal(groupId, proposalId, { vote });
      const mapped = mapProposal(updated);
      setGroupProposals((prev) =>
        prev.map((proposal) => (proposal.id === proposalId ? mapped : proposal)),
      );
    } catch {
      Alert.alert("Errore", "Impossibile inviare il voto");
    }
  };

  const handleBookFromProposal = async (groupId: string, proposalId: string) => {
    const proposal = groupProposals.find((p) => p.id === proposalId);
    if (!proposal) return;
    const stats = proposal.voteStats;
    if (stats.yes === 0) {
      Alert.alert("Voti insufficienti", "Servono almeno un voto 'ci sono' per procedere.");
      return;
    }

    Alert.alert(
      "Prenotazione tavolo",
      `Procedo con ${stats.yes} partecipanti confermati per ${proposal.venueName}?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Prenota",
          onPress: async () => {
            try {
              const result = await bookGroupTableProposal(groupId, proposalId);
              await refreshGroupProposals(groupId);
              Alert.alert(
                "Tavolo prenotato",
                `Prenotazione inviata. Partecipanti confermati: ${result.booked_guests ?? stats.yes}`,
              );
            } catch {
              Alert.alert("Errore", "Impossibile prenotare dal risultato dei voti");
            }
          },
        },
      ],
    );
  };

  const handleCancelGroupProposal = async (groupId: string, proposalId: string) => {
    Alert.alert(
      "Annullare proposta",
      "Vuoi annullare questa proposta tavolo?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Annulla proposta",
          style: "destructive",
          onPress: async () => {
            try {
              const updated = await cancelGroupTableProposal(groupId, proposalId);
              const mapped = mapProposal(updated);
              if (mapped.status === "cancelled") {
                setGroupProposals((prev) => prev.filter((proposal) => proposal.id !== proposalId));
              } else {
                setGroupProposals((prev) => prev.map((proposal) => (proposal.id === proposalId ? mapped : proposal)));
              }
            } catch (e: any) {
              const msg = e?.response?.data?.message || e?.message || "Impossibile annullare la proposta";
              Alert.alert("Errore", String(msg));
            }
          },
        },
      ],
    );
  };

  const openProposalGroup = useCallback((groupId: string) => {
    const group = groupsById.get(groupId);
    if (!group) {
      Alert.alert("Gruppo non disponibile", "Non riesco ad aprire il gruppo collegato a questa proposta.");
      return;
    }
    setSelectedGroup(group);
  }, [groupsById]);

  const handleSendFriendRequest = async (userId: number | string, userName: string) => {
    const targetId = String(userId);
    const targetUser = usersToAdd.find((userItem) => userItem.id === targetId);

    if (targetUser?.isSelf) {
      Alert.alert("Operazione non disponibile", "Questo profilo è già il tuo account.");
      return;
    }
    if (targetUser?.isFriend) {
      Alert.alert("Già amici", `${userName} è già tra i tuoi amici.`);
      return;
    }
    if (targetUser?.hasPendingRequest) {
      Alert.alert("Richiesta già inviata", `Hai già inviato una richiesta a ${userName}.`);
      return;
    }

    try {
      await sendFriendRequest({ user_id: targetId });
      Alert.alert("Richiesta inviata", `Richiesta inviata a ${userName}!`, [
        {
          text: "OK",
          onPress: () => {
            setUsersToAdd(prev => prev.map(u =>
              u.id === targetId ? { ...u, hasPendingRequest: true } : u
            ));
            setOutgoingFriendRequestUserIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
            setSelectedProfile(null);
          }
        }
      ]);
    } catch {
      Alert.alert("Errore", "Impossibile inviare la richiesta");
    }
  };

  const openFriendProfile = (friend: FriendItem) => {
    setSelectedProfile({
      id: friend.id,
      name: friend.name,
      avatar: friend.avatar,
      isFriend: true,
    });
  };

  const openRequestProfile = (request: FriendRequestItem) => {
    setSelectedProfile({
      id: request.id,
      name: request.name,
      avatar: request.avatar,
      isFriend: false,
      requestId: request.id,
    });
  };

  const handleAcceptFriendRequest = async (requestId: number | string, userName: string) => {
    const normalizedRequestId = String(requestId);
    try {
      await acceptFriendRequest(normalizedRequestId);
      setFriendRequests(prev => {
        const next = prev.filter(r => r.id !== normalizedRequestId);
        const pendingInvitations = tableInvitations.filter((item) => item.invitation_status === "pending").length;
        onPendingRequestsChange?.(next.length + pendingInvitations);
        return next;
      });
      setFriends(prev => [...prev, createFallbackFriendItem({ id: normalizedRequestId, name: userName })]);
      Alert.alert("Amico aggiunto", `${userName} è ora un tuo amico!`);
    } catch {
      Alert.alert("Errore", "Impossibile accettare la richiesta");
    }
  };

  const handleRejectFriendRequest = async (requestId: number | string, userName: string) => {
    const normalizedRequestId = String(requestId);
    try {
      await rejectFriendRequest(normalizedRequestId);
      setFriendRequests(prev => {
        const next = prev.filter(r => r.id !== normalizedRequestId);
        const pendingInvitations = tableInvitations.filter((item) => item.invitation_status === "pending").length;
        onPendingRequestsChange?.(next.length + pendingInvitations);
        return next;
      });
      Alert.alert("Richiesta rifiutata", `Hai rifiutato la richiesta di ${userName}`);
    } catch {
      Alert.alert("Errore", "Impossibile rifiutare la richiesta");
    }
  };

  const handleRespondToTableInvitation = async (
    reservationId: string,
    response: "accepted" | "declined",
  ) => {
    if (respondingInvitationId === reservationId) return;

    try {
      setRespondingInvitationId(reservationId);
      const updated = await respondToTableInvitation(reservationId, response);
      const nextInvitations = tableInvitations.map((item) =>
        item.reservation_id === reservationId
          ? { ...updated, id: updated.reservation_id }
          : item,
      );
      setTableInvitations(nextInvitations);
      const pendingInvitations = nextInvitations.filter((item) => item.invitation_status === "pending").length;
      onPendingRequestsChange?.(friendRequests.length + pendingInvitations);

      Alert.alert(
        response === "accepted" ? "Invito confermato" : "Invito rifiutato",
        response === "accepted"
          ? "Il tuo amico e stato avvisato che ci sei."
          : "Il tuo amico e stato avvisato che non ci sei.",
      );
    } catch {
      Alert.alert("Errore", "Impossibile aggiornare la risposta all'invito");
    } finally {
      setRespondingInvitationId(null);
    }
  };

  const handleCreateGroup = async () => {
    const uniqueInvitedIds = Array.from(new Set(selectedGroupMembers.map((id) => String(id))));
    if (!newGroupNameTrimmed) {
      Alert.alert("Errore", "Inserisci un nome gruppo");
      return;
    }
    if (uniqueInvitedIds.length < 1) {
      Alert.alert("Errore", "Il gruppo deve avere almeno 2 membri: tu + almeno 1 amico");
      return;
    }
    try {
      const created = await createFriendGroup({
        name: newGroupNameTrimmed,
        member_ids: uniqueInvitedIds,
      });

      setGroups((prev) => [
        {
          id: created.id,
          name: created.name,
          avatar: "",
          ownerId: String(created.owner_id || user?.id || ""),
          members: normalizeGroupMembers(created),
          memberProfiles: mapGroupMemberProfiles(created),
          color: "#6D5BFF",
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setNewGroupName("");
      setSelectedGroupMembers([]);
      setShowCreateGroupModal(false);
      Alert.alert("Gruppo creato", `"${newGroupNameTrimmed}" è stato creato!`);
    } catch {
      Alert.alert("Errore", "Impossibile creare il gruppo");
    }
  };

  const handleAddMemberToGroup = async (friendId: number | string, friendName: string) => {
    if (!selectedGroup) {
      Alert.alert("Errore", "Apri prima un gruppo");
      closeGroupSubModals();
      return;
    }

    const memberId = String(friendId);
    if (selectedGroup.members.includes(memberId)) {
      Alert.alert("Avviso", `${friendName} è già nel gruppo`);
      return;
    }
    try {
      await addFriendGroupMember(String(selectedGroup.id), memberId);
      const friend = friends.find((f) => f.id === memberId);
      const updatedGroups = groups.map(g => 
        g.id === selectedGroup.id 
          ? {
              ...g,
              members: Array.from(new Set([...g.members, memberId])),
              memberProfiles: Array.from(
                new Map(
                  [
                    ...g.memberProfiles,
                    {
                      id: memberId,
                      name: friend?.name || friendName,
                      avatar: friend?.avatar || "",
                    },
                  ].map((member) => [member.id, member]),
                ).values(),
              ),
            }
          : g
      );
      setGroups(updatedGroups);
      setSelectedGroup({
        ...selectedGroup,
        members: Array.from(new Set([...selectedGroup.members, memberId])),
        memberProfiles: Array.from(
          new Map(
            [
              ...(selectedGroup.memberProfiles || []),
              {
                id: memberId,
                name: friend?.name || friendName,
                avatar: friend?.avatar || "",
              },
            ].map((member: any) => [member.id, member]),
          ).values(),
        ),
      });
      Alert.alert("Aggiunto", `${friendName} è stato aggiunto al gruppo`);
    } catch {
      Alert.alert("Errore", "Impossibile aggiungere al gruppo");
    }
  };

  const handleDeleteSelectedGroup = () => {
    if (!selectedGroup) return;
    if (!selectedGroupIsOwner) {
      Alert.alert("Operazione non disponibile", "Solo chi ha creato il gruppo può eliminarlo.");
      return;
    }

    Alert.alert(
      "Eliminare gruppo",
      `Vuoi eliminare definitivamente "${selectedGroup.name}"?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina gruppo",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteFriendGroup(String(selectedGroup.id));
              setGroups((prev) => prev.filter((group) => group.id !== selectedGroup.id));
              setGroupProposals((prev) => prev.filter((proposal) => proposal.groupId !== selectedGroup.id));
              closeGroupSubModals();
              setSelectedGroup(null);
              Alert.alert("Gruppo eliminato", "Il gruppo è stato rimosso con successo.");
            } catch {
              Alert.alert("Errore", "Impossibile eliminare il gruppo");
            }
          },
        },
      ],
    );
  };

  const renderFriendCard = ({ item, section }: any) => {
    if (section?.type === "tableInvites") {
      const eventLabel = formatEventDateTime(item.event?.date, item.event?.start_time, item.event?.end_time);
      const isPendingResponse = item.invitation_status === "pending" && item.can_respond;
      const isResponding = respondingInvitationId === item.reservation_id;

      return (
        <View style={styles.invitationCard}>
          <View style={styles.invitationHeaderRow}>
            <View style={styles.invitationIconWrap}>
              <Feather name="coffee" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.invitationMainInfo}>
              <Text style={styles.invitationTitle}>Invito tavolo da {item.inviter.name}</Text>
              <Text style={styles.invitationSubtitle}>{item.venue?.name || "Locale"} • {eventLabel}</Text>
            </View>
          </View>

          <View style={styles.invitationMetaWrap}>
            <Text style={styles.invitationMetaText}>Stato invito: {formatInvitationStatus(item.invitation_status)}</Text>
            <Text style={styles.invitationMetaText}>Stato prenotazione: {formatReservationStatus(item.reservation_status)}</Text>
            <Text style={styles.invitationMetaText}>Zona: {item.zone_label || "Da assegnare"}</Text>
            <Text style={styles.invitationMetaText}>Persone previste: {item.guests}</Text>
            {item.total_amount !== null && item.total_amount !== undefined ? (
              <Text style={styles.invitationMetaText}>Totale stimato: {formatMoney(Number(item.total_amount))}</Text>
            ) : null}
            {!!item.table_name && (
              <Text style={styles.invitationMetaText}>Nome tavolo: {item.table_name}</Text>
            )}
            {item.invited_group_names.length > 0 ? (
              <Text style={styles.invitationMetaText}>Gruppi coinvolti: {item.invited_group_names.join(", ")}</Text>
            ) : null}
          </View>

          {isPendingResponse ? (
            <View style={styles.invitationActionsRow}>
              <TouchableOpacity
                style={[styles.invitationActionButton, styles.invitationDeclineButton]}
                activeOpacity={0.85}
                disabled={isResponding}
                onPress={() => handleRespondToTableInvitation(item.reservation_id, "declined")}
              >
                <Feather name="x" size={16} color="white" />
                <Text style={styles.invitationActionText}>{isResponding ? "Invio..." : "Non ci sono"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.invitationActionButton, styles.invitationAcceptButton]}
                activeOpacity={0.85}
                disabled={isResponding}
                onPress={() => handleRespondToTableInvitation(item.reservation_id, "accepted")}
              >
                <Feather name="check" size={16} color="white" />
                <Text style={styles.invitationActionText}>{isResponding ? "Invio..." : "Ci sono"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.invitationFooterRow}>
              <Text style={styles.invitationFootnote}>
                {item.reservation_status === "cancelled"
                  ? "La prenotazione e stata annullata."
                  : item.invitation_status === "accepted"
                    ? "Hai gia confermato la tua presenza."
                    : item.invitation_status === "declined"
                      ? "Hai gia rifiutato questo invito."
                      : "In attesa di aggiornamenti."}
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (section?.type === "requests") {
      return (
        <TouchableOpacity
          style={styles.requestCard}
          activeOpacity={0.8}
          onPress={() => openRequestProfile(item)}
        >
          <View style={styles.requestContent}>
            {isImageUrl(item.avatar) ? (
              <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}><Feather name="user" size={18} color={theme.colors.muted} /></View>
            )}
            <View style={styles.requestInfo}>
              <Text style={styles.requestName}>{item.name}</Text>
              <Text style={styles.requestTime}>{item.sentAt}</Text>
            </View>
          </View>
          <View style={styles.requestActions}>
            <TouchableOpacity 
              style={[styles.actionButtonSmall, styles.acceptButton]}
              onPress={() => handleAcceptFriendRequest(item.id, item.name)}
            >
              <Feather name="check" size={18} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButtonSmall, styles.rejectButton]}
              onPress={() => handleRejectFriendRequest(item.id, item.name)}
            >
              <Feather name="x" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.friendCard, !section?.isOnline && styles.friendCardOffline]}
        activeOpacity={0.7}
        onPress={() => openFriendProfile(item)}
      >
        <View style={styles.friendContent}>
          <View style={styles.avatarContainer}>
            {isImageUrl(item.avatar) ? (
              <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}><Feather name="user" size={18} color={theme.colors.muted} /></View>
            )}
            {item.online && <View style={styles.onlineBadge} />}
          </View>

          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{item.name}</Text>
            {item.online ? (
              <View style={styles.statusRow}>
                <Feather
                  name={item.currentVenue ? "map-pin" : "activity"}
                  size={13}
                  color={item.currentVenue ? theme.colors.primary : theme.colors.muted}
                />
                <Text
                  style={item.currentVenue ? styles.venueText : styles.statusText}
                  numberOfLines={1}
                >
                  {item.currentVenue || item.status || "Attivo ora"}
                </Text>
              </View>
            ) : (
              <Text style={styles.offlineText}>Visto {item.lastSeen}</Text>
            )}
          </View>
        </View>
        <View style={styles.friendCardAction}>
          <Feather name="chevron-right" size={18} color={theme.colors.text} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section?.type === "friends" && (
        <View style={[styles.sectionDot, section.isOnline ? styles.dotOnline : styles.dotOffline]} />
      )}
      {section?.type === "requests" && (
        <View style={[styles.sectionDot, styles.dotRequest]} />
      )}
      {section?.type === "tableInvites" && (
        <View style={[styles.sectionDot, styles.dotInvite]} />
      )}
    </View>
  );

  const renderSectionFooter = ({ section }: any) => {
    if (section?.type !== "friends" || !section?.hiddenCount) return null;

    const batchSize = section.isOnline ? 20 : 30;
    const nextBatch = Math.min(section.hiddenCount, batchSize);

    return (
      <TouchableOpacity
        style={styles.sectionLoadMoreButton}
        activeOpacity={0.85}
        onPress={() => {
          if (section.isOnline) {
            setVisibleOnlineCount((prev) => prev + 20);
            return;
          }
          setVisibleOfflineCount((prev) => prev + 30);
        }}
      >
        <Text style={styles.sectionLoadMoreText}>Mostra altri {nextBatch} amici</Text>
      </TouchableOpacity>
    );
  };

  const renderGroupCard = ({ item }: any) => {
    const memberCount = getGroupMemberCount(item);
    const activeProposalCount = getGroupProposals(item.id).filter((proposal) => proposal.status !== "cancelled").length;

    return (
      <TouchableOpacity
        style={[styles.groupCard, { borderColor: item.color + "55" }]}
        onPress={() => setSelectedGroup(item)}
      >
        <View style={[styles.groupIconContainer, { backgroundColor: item.color + "20" }]}>
          {isImageUrl(item.avatar) ? (
            <Image source={{ uri: item.avatar }} style={styles.groupImage} />
          ) : (
            <MaterialCommunityIcons name="account-group" size={24} color={theme.colors.primary} />
          )}
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <View style={styles.groupCardMetaRow}>
            <Text style={styles.groupMembers}>{memberCount} membri</Text>
            {activeProposalCount > 0 ? (
              <View style={styles.groupActiveBadge}>
                <Text style={styles.groupActiveBadgeText}>{activeProposalCount} proposte attive</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.groupMiniMembersRow}>
            {getGroupMembers(item.id).slice(0, 3).map((member: any) => (
              isImageUrl(member.avatar) ? (
                <Image key={`${item.id}-${member.id}`} source={{ uri: member.avatar }} style={styles.groupMiniMemberImage} />
              ) : (
                <View key={`${item.id}-${member.id}`} style={styles.groupMiniMemberFallback}><Feather name="user" size={11} color={theme.colors.muted} /></View>
              )
            ))}
            {memberCount > 3 && (
              <Text style={styles.groupMiniMemberMore}>+{memberCount - 3}</Text>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={theme.colors.muted} />
      </TouchableOpacity>
    );
  };

  const renderSearchResult = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.searchResultCard}
      onPress={() => setSelectedProfile(item)}
    >
      <View style={styles.searchResultContent}>
        {isImageUrl(item.avatar) ? (
          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}><Feather name="user" size={18} color={theme.colors.muted} /></View>
        )}
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName}>{item.name}</Text>
          <View style={styles.searchResultMetaRow}>
            <Text style={styles.mutualCount}>
              {getMutualFriendsCount(item.id)} amici in comune
            </Text>
            {item.isSelf ? (
              <View style={[styles.searchResultBadge, styles.searchResultBadgeNeutral]}>
                <Text style={styles.searchResultBadgeNeutralText}>Tu</Text>
              </View>
            ) : item.isFriend ? (
              <View style={[styles.searchResultBadge, styles.searchResultBadgeFriend]}>
                <Text style={styles.searchResultBadgeFriendText}>Già amico</Text>
              </View>
            ) : item.hasPendingRequest ? (
              <View style={[styles.searchResultBadge, styles.searchResultBadgePending]}>
                <Text style={styles.searchResultBadgePendingText}>Richiesta inviata</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={theme.colors.muted} />
    </TouchableOpacity>
  );

  const renderMutualFriend = ({ item }: any) => (
    <View style={styles.mutualFriendCard}>
      {isImageUrl(item.avatar) ? (
        <Image source={{ uri: item.avatar }} style={styles.mutualAvatarImage} />
      ) : (
        <View style={styles.mutualAvatarFallback}><Feather name="user" size={20} color={theme.colors.muted} /></View>
      )}
      <Text style={styles.mutualName} numberOfLines={2}>{item.name}</Text>
    </View>
  );

  const renderGroupMember = ({ item }: any) => (
    <View style={styles.groupMemberCard}>
      {isImageUrl(item.avatar) ? (
        <Image source={{ uri: item.avatar }} style={styles.groupMemberAvatarImage} />
      ) : (
        <View style={styles.groupMemberAvatarFallback}><Feather name="user" size={20} color={theme.colors.muted} /></View>
      )}
      <Text style={styles.groupMemberName}>{item.name}</Text>
    </View>
  );

  const getProposalStatusAppearance = (status: GroupTableProposal["status"]) => {
    if (status === "booked") {
      return {
        label: "Prenotato",
        icon: "check-circle",
        color: "#2DB983",
        backgroundColor: isDark ? "rgba(45,185,131,0.16)" : "rgba(45,185,131,0.12)",
        borderColor: "rgba(45,185,131,0.34)",
      };
    }
    if (status === "ready") {
      return {
        label: "Pronto",
        icon: "zap",
        color: "#D49B16",
        backgroundColor: isDark ? "rgba(212,155,22,0.16)" : "rgba(212,155,22,0.12)",
        borderColor: "rgba(212,155,22,0.34)",
      };
    }
    if (status === "cancelled") {
      return {
        label: "Annullato",
        icon: "slash",
        color: theme.colors.error,
        backgroundColor: theme.colors.error + "14",
        borderColor: theme.colors.error + "36",
      };
    }
    return {
      label: "In votazione",
      icon: "users",
      color: theme.colors.primary,
      backgroundColor: theme.colors.primary + "14",
      borderColor: theme.colors.primary + "32",
    };
  };

  const getVoteLabel = (vote: ProposalVote) => {
    if (vote === "yes") return "Ci sono";
    if (vote === "no") return "Non ci sono";
    return "In attesa";
  };

  const renderProposalCardContent = (
    proposal: GroupTableProposal,
    options?: { showGroupName?: boolean; manageGroup?: GroupItem | null },
  ) => {
    const linkedGroup = options?.manageGroup ?? groupsById.get(proposal.groupId) ?? null;
    const showOpenGroupAction = !!linkedGroup && !options?.manageGroup;
    const stats = proposal.voteStats;
    const myVote = proposal.votes.find((vote) => vote.userId === user?.id)?.vote ?? "pending";
    const canManage = proposal.createdByUserId === String(user?.id) || linkedGroup?.ownerId === String(user?.id);
    const isMine = proposal.createdByUserId === String(user?.id);
    const statusAppearance = getProposalStatusAppearance(proposal.status);
    const yesFlex = Math.max(0, stats.yes);
    const noFlex = Math.max(0, stats.no);
    const pendingFlex = Math.max(0, stats.pending);
    const voteTotal = Math.max(1, stats.yes + stats.no + stats.pending);
    const yesPct = Math.round((stats.yes / voteTotal) * 100);
    const noPct = Math.round((stats.no / voteTotal) * 100);
    const pendingPct = Math.round((stats.pending / voteTotal) * 100);
    const perPerson = proposal.estimatedTotal && proposal.guests > 0
      ? proposal.estimatedTotal / proposal.guests
      : null;
    const needsMyVote = myVote === "pending" && proposal.status === "voting";

    return (
      <>
        {/* ── Header ────────────────────────────────────────── */}
        <View style={styles.proposalHeroTopRow}>
          <View style={styles.proposalHeroCopy}>
            {options?.showGroupName ? (
              <Text style={styles.activityProposalGroup}>{linkedGroup?.name || "Gruppo"}</Text>
            ) : null}
            <Text style={styles.proposalHeroTitle}>{proposal.venueName}</Text>
            <View style={styles.proposalEventChipRow}>
              <Feather name="calendar" size={12} color={theme.colors.muted} />
              <Text style={styles.proposalEventChipText} numberOfLines={1}>
                {proposal.eventName}
              </Text>
              <Text style={styles.proposalEventChipSep}>·</Text>
              <Text style={styles.proposalEventChipDate} numberOfLines={1}>
                {formatEventDateTime(proposal.eventDate, proposal.eventStartTime, proposal.eventEndTime)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.activityProposalStatusPill,
              { backgroundColor: statusAppearance.backgroundColor, borderColor: statusAppearance.borderColor },
            ]}
          >
            <Feather name={statusAppearance.icon as any} size={12} color={statusAppearance.color} />
            <Text style={[styles.activityProposalStatusText, { color: statusAppearance.color }]}>
              {statusAppearance.label}
            </Text>
          </View>
        </View>

        {/* ── Meta chips ────────────────────────────────────── */}
        <View style={styles.proposalMetaChipsRow}>
          <View style={styles.proposalMetaChip}>
            <Feather name="map-pin" size={12} color={theme.colors.primary} />
            <Text style={styles.proposalMetaChipText}>{proposal.zoneLabel || "Zona TBD"}</Text>
          </View>
          <View style={styles.proposalMetaChip}>
            <Feather name="users" size={12} color={theme.colors.primary} />
            <Text style={styles.proposalMetaChipText}>{proposal.guests} persone</Text>
          </View>
          {!!proposal.estimatedTotal && (
            <View style={styles.proposalMetaChip}>
              <Feather name="credit-card" size={12} color={theme.colors.primary} />
              <Text style={styles.proposalMetaChipText}>{formatMoney(proposal.estimatedTotal)}</Text>
            </View>
          )}
          {!!perPerson && (
            <View style={[styles.proposalMetaChip, styles.proposalMetaChipAccent]}>
              <Text style={styles.proposalMetaChipAccentText}>{formatMoney(perPerson)} / pers.</Text>
            </View>
          )}
        </View>

        {/* ── Note ──────────────────────────────────────────── */}
        {!!proposal.userNote ? (
          <Text style={styles.proposalInlineNote}>"{proposal.userNote}"</Text>
        ) : null}

        {/* ── Vote CTA banner (only when user hasn't voted) ─ */}
        {needsMyVote ? (
          <View style={styles.proposalVoteCTABanner}>
            <Feather name="alert-circle" size={14} color="#D49B16" />
            <Text style={styles.proposalVoteCTAText}>Non hai ancora votato — fallo prima che il gruppo si muova senza di te.</Text>
          </View>
        ) : null}

        {/* ── Vote bar ──────────────────────────────────────── */}
        <View style={[styles.voteBarTrack, { marginTop: 12 }]}>
          <View style={[styles.voteBarYes, { flex: yesFlex }]} />
          <View style={[styles.voteBarNo, { flex: noFlex }]} />
          <View style={[styles.voteBarPending, { flex: pendingFlex }]} />
        </View>

        {/* ── Stats pills row ───────────────────────────────── */}
        <View style={styles.proposalStatsPillsRow}>
          <View style={[styles.proposalStatPill, styles.proposalStatPillYes]}>
            <Text style={styles.proposalStatPillValue}>{stats.yes}</Text>
            <Text style={styles.proposalStatPillLabel}>Ci sono</Text>
            <Text style={styles.proposalStatPillPct}>{yesPct}%</Text>
          </View>
          <View style={[styles.proposalStatPill, styles.proposalStatPillNo]}>
            <Text style={styles.proposalStatPillValue}>{stats.no}</Text>
            <Text style={styles.proposalStatPillLabel}>Non ci sono</Text>
            <Text style={styles.proposalStatPillPct}>{noPct}%</Text>
          </View>
          <View style={[styles.proposalStatPill, styles.proposalStatPillPending]}>
            <Text style={styles.proposalStatPillValue}>{stats.pending}</Text>
            <Text style={styles.proposalStatPillLabel}>In attesa</Text>
            <Text style={styles.proposalStatPillPct}>{pendingPct}%</Text>
          </View>
        </View>

        {/* ── Vote action buttons ───────────────────────────── */}
        {(proposal.status === "voting" || proposal.status === "ready") ? (
          <View style={styles.voteActionsRowGlobal}>
            <TouchableOpacity
              style={[
                styles.voteActionButton,
                styles.voteActionButtonYes,
                myVote === "yes" && styles.voteActionActiveYes,
                needsMyVote && styles.voteActionButtonYesPrimary,
              ]}
              onPress={() => handleVoteProposal(proposal.groupId, proposal.id, "yes")}
            >
              <Feather name="check" size={16} color={myVote === "yes" ? "#fff" : theme.colors.text} />
              <View style={styles.voteActionCopy}>
                <Text style={[styles.voteActionText, myVote === "yes" && { color: "#fff" }]}>Ci sono</Text>
                {needsMyVote ? (
                  <Text style={[styles.voteActionSubtext, { color: "rgba(255,255,255,0.7)" }]}>Confermo la presenza</Text>
                ) : null}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.voteActionButton, styles.voteActionButtonNo, myVote === "no" && styles.voteActionActiveNo]}
              onPress={() => handleVoteProposal(proposal.groupId, proposal.id, "no")}
            >
              <Feather name="x" size={16} color={myVote === "no" ? theme.colors.error : theme.colors.text} />
              <View style={styles.voteActionCopy}>
                <Text style={styles.voteActionText}>Non ci sono</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── My vote badge (when not in voting) ──────────── */}
        {proposal.status !== "voting" && proposal.status !== "ready" ? (
          <View style={[styles.proposalMyVoteBadge, myVote === "yes" ? styles.proposalMyVoteBadgeYes : myVote === "no" ? styles.proposalMyVoteBadgeNo : styles.proposalMyVoteBadgePending]}>
            <Text style={styles.proposalMyVoteBadgeText}>Il tuo voto: {getVoteLabel(myVote)}</Text>
          </View>
        ) : null}

        {/* ── Members roster ───────────────────────────────── */}
        <View style={styles.proposalRosterSection}>
          <Text style={styles.proposalRosterTitle}>Risposte del gruppo</Text>
          <View style={styles.proposalRosterGrid}>
            {proposal.votes.map((memberVote) => {
              const vote = memberVote.vote;
              const initial = (memberVote.name || "?")[0].toUpperCase();
              return (
                <View
                  key={`${proposal.id}-${memberVote.userId}`}
                  style={[
                    styles.proposalRosterItem,
                    vote === "yes" && styles.proposalRosterItemYes,
                    vote === "no" && styles.proposalRosterItemNo,
                  ]}
                >
                  <View style={[
                    styles.proposalRosterAvatar,
                    vote === "yes" ? styles.proposalRosterAvatarYes : vote === "no" ? styles.proposalRosterAvatarNo : styles.proposalRosterAvatarPending,
                  ]}>
                    {isImageUrl(memberVote.avatar) ? (
                      <Image source={{ uri: memberVote.avatar }} style={styles.proposalRosterAvatarImage} />
                    ) : (
                      <Text style={styles.proposalRosterAvatarInitial}>{initial}</Text>
                    )}
                  </View>
                  <Text style={styles.proposalRosterName} numberOfLines={1}>{memberVote.name}</Text>
                  <Text style={[
                    styles.proposalRosterVoteLabel,
                    vote === "yes" && { color: "#2DB983" },
                    vote === "no" && { color: theme.colors.error },
                  ]}>{getVoteLabel(vote)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Footer actions ───────────────────────────────── */}
        <View style={styles.activityProposalActions}>
          {showOpenGroupAction ? (
            <TouchableOpacity style={styles.activityProposalSecondaryButton} onPress={() => openProposalGroup(proposal.groupId)}>
              <Feather name="users" size={16} color={theme.colors.text} />
              <Text style={styles.activityProposalSecondaryText}>Apri gruppo</Text>
            </TouchableOpacity>
          ) : null}
          {canManage && (proposal.status === "voting" || proposal.status === "ready") ? (
            <TouchableOpacity style={styles.activityProposalSecondaryButton} onPress={() => handleCancelGroupProposal(proposal.groupId, proposal.id)}>
              <Feather name="slash" size={16} color={theme.colors.text} />
              <Text style={styles.activityProposalSecondaryText}>Annulla</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Book button ──────────────────────────────────── */}
        {proposal.status === "ready" && canManage ? (
          <TouchableOpacity style={styles.bookFromVotesButton} onPress={() => handleBookFromProposal(proposal.groupId, proposal.id)}>
            <Feather name="check-circle" size={18} color="white" />
            <Text style={styles.bookFromVotesText}>Prenota dai voti</Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  };

  const activityProposals = useMemo(
    () => groupProposals
      .filter((proposal) => proposal.status !== "cancelled")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [groupProposals],
  );

  const visibleTableInvitations = useMemo(
    () => tableInvitations.filter((item) => item.reservation_status !== "cancelled"),
    [tableInvitations],
  );

  const activeFriendsTabInvitations = useMemo(
    () => visibleTableInvitations.filter((item) => {
      const isDirectSingleInvite = item.invited_group_names.length === 0;
      if (!isDirectSingleInvite) return true;
      return item.invitation_status === "pending" && item.reservation_status === "pending" && item.can_respond;
    }),
    [visibleTableInvitations],
  );

  const activityFeed = useMemo<ActivityFeedItem[]>(() => {
    const proposalItems = activityProposals.map((proposal) => ({
      kind: "proposal" as const,
      id: `proposal-${proposal.id}`,
      createdAt: proposal.createdAt,
      proposal,
    }));
    const directInviteItems = directInviteActivities.map((invite) => ({
      kind: "directInvite" as const,
      id: invite.id,
      createdAt: invite.createdAt,
      invite,
    }));

    const incomingInviteItems = visibleTableInvitations.map((invite) => ({
      kind: "incomingInvite" as const,
      id: `incoming-${invite.reservation_id}`,
      createdAt: invite.invited_at,
      invite,
    }));

    return [...proposalItems, ...directInviteItems, ...incomingInviteItems].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [activityProposals, directInviteActivities, visibleTableInvitations]);

  const renderActivityProposalCard = ({ item }: { item: GroupTableProposal }) => {
    return (
      <View style={styles.activityProposalCard}>
        {renderProposalCardContent(item, { showGroupName: true })}
      </View>
    );
  };

  const renderDirectInviteActivityCard = ({ item }: { item: DirectInviteActivityItem }) => {
    return (
      <View style={styles.activityProposalCard}>
        <View style={styles.activityProposalHeader}>
          <View style={styles.activityProposalTitleWrap}>
            <Text style={styles.activityProposalGroup}>Invito diretto</Text>
            <Text style={styles.activityProposalTitle}>Richiesta tavolo inviata a {item.invitees.length} {item.invitees.length === 1 ? "amico" : "amici"}</Text>
          </View>
          <View style={styles.activityProposalStatusPill}>
            <Text style={styles.activityProposalStatusText}>{formatDirectInviteStatus(item.reservationStatus)}</Text>
          </View>
        </View>

        <Text style={styles.activityProposalMeta}>Serata: {item.event.name}</Text>
        <Text style={styles.activityProposalMeta}>Quando: {formatEventDateTime(item.event.date, item.event.start_time, item.event.end_time)}</Text>
        <Text style={styles.activityProposalMeta}>Locale: {item.venue.name}</Text>
        <Text style={styles.activityProposalMeta}>Zona: {item.zoneLabel || "Da assegnare"}</Text>
        <Text style={styles.activityProposalMeta}>Persone previste: {item.guests}</Text>
        {item.totalAmount !== null && item.totalAmount !== undefined ? (
          <Text style={styles.activityProposalMeta}>Totale stimato: {formatMoney(item.totalAmount)}</Text>
        ) : null}
        {!!item.tableName && <Text style={styles.activityProposalMeta}>Nome tavolo: {item.tableName}</Text>}

        <Text style={styles.activityProposalContextText}>
          Risposte ricevute: {item.inviteStats.accepted} ci sono, {item.inviteStats.declined} no, {item.inviteStats.pending} in attesa.
        </Text>

        <View style={styles.proposalMembersWrap}>
          {item.invitees.map((invitee) => (
            <View
              key={`${item.reservationId}-${invitee.userId}`}
              style={[
                styles.proposalMemberCard,
                invitee.status === "accepted" && styles.proposalMemberCardYes,
                invitee.status === "declined" && styles.proposalMemberCardNo,
              ]}
            >
              <Text style={styles.proposalMemberName}>{invitee.name}</Text>
              <Text style={styles.proposalMemberVote}>
                {invitee.status === "accepted"
                  ? "Ci sono"
                  : invitee.status === "declined"
                    ? "Non ci sono"
                    : "In attesa"}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderIncomingInviteActivityCard = ({ item }: { item: TableInvitationItem }) => {
    const eventLabel = formatEventDateTime(item.event?.date, item.event?.start_time, item.event?.end_time);
    const isPendingResponse = item.invitation_status === "pending" && item.can_respond;
    const isResponding = respondingInvitationId === item.reservation_id;

    return (
      <View style={styles.activityProposalCard}>
        <View style={styles.activityProposalHeader}>
          <View style={styles.activityProposalTitleWrap}>
            <Text style={styles.activityProposalGroup}>Invito ricevuto</Text>
            <Text style={styles.activityProposalTitle}>Tavolo proposto da {item.inviter.name}</Text>
          </View>
          <View style={styles.activityProposalStatusPill}>
            <Text style={styles.activityProposalStatusText}>
              {isPendingResponse ? "In votazione" : formatInvitationStatus(item.invitation_status)}
            </Text>
          </View>
        </View>

        <Text style={styles.activityProposalMeta}>Locale: {item.venue?.name || "Locale"}</Text>
        <Text style={styles.activityProposalMeta}>Quando: {eventLabel}</Text>
        <Text style={styles.activityProposalMeta}>Zona: {item.zone_label || "Da assegnare"}</Text>
        <Text style={styles.activityProposalMeta}>Persone previste: {item.guests}</Text>
        {item.total_amount !== null && item.total_amount !== undefined ? (
          <Text style={styles.activityProposalMeta}>Totale stimato: {formatMoney(Number(item.total_amount))}</Text>
        ) : null}
        {!!item.table_name && <Text style={styles.activityProposalMeta}>Nome tavolo: {item.table_name}</Text>}

        <Text style={styles.activityProposalContextText}>
          {isPendingResponse
            ? "Rispondi qui o nella tab Amici."
            : item.reservation_status === "cancelled"
              ? "La prenotazione e stata annullata."
              : `Stato prenotazione: ${formatReservationStatus(item.reservation_status)}.`}
        </Text>

        {isPendingResponse ? (
          <View style={styles.voteActionsRowGlobal}>
            <TouchableOpacity
              style={[styles.voteActionButton, styles.voteActionActiveNo]}
              disabled={isResponding}
              onPress={() => handleRespondToTableInvitation(item.reservation_id, "declined")}
            >
              <Text style={styles.voteActionText}>{isResponding ? "Invio..." : "Non ci sono"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteActionButton, styles.voteActionActiveYes]}
              disabled={isResponding}
              onPress={() => handleRespondToTableInvitation(item.reservation_id, "accepted")}
            >
              <Text style={styles.voteActionText}>{isResponding ? "Invio..." : "Ci sono"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderActivityItem = ({ item }: { item: ActivityFeedItem }) => {
    if (item.kind === "proposal") {
      return renderActivityProposalCard({ item: item.proposal });
    }
    if (item.kind === "directInvite") {
      return renderDirectInviteActivityCard({ item: item.invite });
    }
    return renderIncomingInviteActivityCard({ item: item.invite });
  };

  const friendsSections = useMemo(
    () => [
      ...(activeFriendsTabInvitations.length > 0
        ? [{
            title: `Inviti tavolo (${activeFriendsTabInvitations.length})`,
            data: activeFriendsTabInvitations,
            type: "tableInvites" as const,
          }]
        : []),
      ...(friendRequests.length > 0
        ? [{
            title: `Richieste  (${friendRequests.length})`,
            data: friendRequests,
            type: "requests" as const,
          }]
        : []),
      ...(filteredOnlineFriends.length > 0
        ? [{
            title: `Online (${filteredOnlineFriends.length})`,
            data: visibleOnlineFriends,
            type: "friends" as const,
            isOnline: true,
            hiddenCount: Math.max(0, filteredOnlineFriends.length - visibleOnlineFriends.length),
          }]
        : []),
      ...(filteredOfflineFriends.length > 0
        ? [{
            title: `Offline (${filteredOfflineFriends.length})`,
            data: visibleOfflineFriends,
            type: "friends" as const,
            isOnline: false,
            hiddenCount: Math.max(0, filteredOfflineFriends.length - visibleOfflineFriends.length),
          }]
        : []),
    ],
        [activeFriendsTabInvitations, friendRequests, filteredOnlineFriends, visibleOnlineFriends, filteredOfflineFriends, visibleOfflineFriends],
  );

  const pendingRequestsCount = friendRequests.length;
  const pendingInvitesCount = tableInvitations.filter((item) => item.invitation_status === "pending").length;
  const activeGroupCount = groups.length;
  const newGroupNameTrimmed = newGroupName.trim();
  const canCreateGroup = newGroupNameTrimmed.length >= 2 && selectedGroupMembers.length >= 1;
  const groupsWithOpenProposalCount = useMemo(
    () => new Set(groupProposals.filter((proposal) => proposal.status !== "cancelled").map((proposal) => proposal.groupId)).size,
    [groupProposals],
  );

  const priorityItems = useMemo<PriorityFeedItem[]>(
    () => [
      ...activeFriendsTabInvitations.map((invite) => ({ kind: "invite" as const, id: `invite-${invite.reservation_id}`, invite })),
      ...friendRequests.map((request) => ({ kind: "request" as const, id: `request-${request.id}`, request })),
    ],
    [activeFriendsTabInvitations, friendRequests],
  );

  const liveActivityHighlights = useMemo(() => activityFeed.slice(0, 8), [activityFeed]);

  const availableFriendsForSelectedGroup = useMemo(
    () => friends.filter((friend) => !selectedGroup?.members.includes(friend.id)),
    [friends, selectedGroup],
  );

  const filteredCreateGroupFriends = useMemo(() => {
    const q = createGroupFriendQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((friend) => friend.name.toLowerCase().includes(q));
  }, [friends, createGroupFriendQuery]);

  const visibleCreateGroupFriends = useMemo(
    () => filteredCreateGroupFriends.slice(0, visibleCreateGroupFriendsCount),
    [filteredCreateGroupFriends, visibleCreateGroupFriendsCount],
  );

  const filteredInviteFriends = useMemo(() => {
    const q = inviteFriendQuery.trim().toLowerCase();
    if (!q) return availableFriendsForSelectedGroup;
    return availableFriendsForSelectedGroup.filter((friend) => friend.name.toLowerCase().includes(q));
  }, [availableFriendsForSelectedGroup, inviteFriendQuery]);

  const visibleInviteFriends = useMemo(
    () => filteredInviteFriends.slice(0, visibleInviteFriendsCount),
    [filteredInviteFriends, visibleInviteFriendsCount],
  );

  const suggestedUsers = useMemo(() => usersToAdd.slice(0, 16), [usersToAdd]);

  const renderPriorityCard = ({ item }: { item: PriorityFeedItem }) => {
    if (item.kind === "request") {
      const request = item.request;
      return (
        <View style={styles.priorityCard}>
          <LinearGradient
            colors={isDark ? ["rgba(155,92,255,0.18)", "rgba(18,18,28,0.96)"] : ["rgba(110,91,230,0.12)", "rgba(255,255,255,0.96)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.priorityCardSurface}
          >
            <View style={styles.priorityCardHeader}>
              {isImageUrl(request.avatar) ? (
                <Image source={{ uri: request.avatar }} style={styles.priorityCardAvatar} />
              ) : (
                <View style={styles.priorityCardAvatarFallback}>
                  <Feather name="user" size={18} color={theme.colors.muted} />
                </View>
              )}
              <View style={styles.priorityCardCopy}>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>Richiesta</Text>
                </View>
                <Text style={styles.priorityCardTitle}>{request.name} vuole aggiungerti</Text>
                <Text style={styles.priorityCardSubtitle}>Apri il profilo o rispondi subito da qui.</Text>
              </View>
            </View>

            <View style={styles.priorityActions}>
              <TouchableOpacity
                style={[styles.prioritySecondaryAction, styles.priorityDeclineAction]}
                activeOpacity={0.85}
                onPress={() => handleRejectFriendRequest(request.id, request.name)}
              >
                <Feather name="x" size={16} color={theme.colors.text} />
                <Text style={styles.prioritySecondaryActionText}>Rifiuta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.priorityPrimaryAction}
                activeOpacity={0.85}
                onPress={() => handleAcceptFriendRequest(request.id, request.name)}
              >
                <Feather name="check" size={16} color="white" />
                <Text style={styles.priorityPrimaryActionText}>Accetta</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      );
    }

    const invite = item.invite;
    const eventLabel = formatEventDateTime(invite.event?.date, invite.event?.start_time, invite.event?.end_time);
    const isResponding = respondingInvitationId === invite.reservation_id;

    return (
      <View style={styles.priorityCard}>
        <LinearGradient
          colors={isDark ? ["rgba(96,220,181,0.18)", "rgba(16,18,26,0.96)"] : ["rgba(96,220,181,0.12)", "rgba(255,255,255,0.96)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.priorityCardSurface}
        >
          <View style={styles.priorityCardHeader}>
            <View style={[styles.priorityIconWrap, { backgroundColor: theme.colors.accent + "20" }]}>
              <Feather name="coffee" size={18} color={theme.colors.accent} />
            </View>
            <View style={styles.priorityCardCopy}>
              <View style={styles.priorityBadgeAlt}>
                <Text style={styles.priorityBadgeAltText}>Invito tavolo</Text>
              </View>
              <Text style={styles.priorityCardTitle}>Invito da {invite.inviter.name}</Text>
              <Text style={styles.priorityCardSubtitle}>{invite.venue?.name || "Locale"} • {eventLabel}</Text>
            </View>
          </View>

          <View style={styles.priorityMetaRow}>
            <View style={styles.priorityMetaPill}>
              <Text style={styles.priorityMetaPillText}>{invite.zone_label || "Zona da definire"}</Text>
            </View>
            <View style={styles.priorityMetaPill}>
              <Text style={styles.priorityMetaPillText}>{invite.guests} persone</Text>
            </View>
          </View>

          {invite.invitation_status === "pending" && invite.can_respond ? (
            <View style={styles.priorityActions}>
              <TouchableOpacity
                style={[styles.prioritySecondaryAction, styles.priorityDeclineAction]}
                activeOpacity={0.85}
                disabled={isResponding}
                onPress={() => handleRespondToTableInvitation(invite.reservation_id, "declined")}
              >
                <Feather name="x" size={16} color={theme.colors.text} />
                <Text style={styles.prioritySecondaryActionText}>{isResponding ? "Invio..." : "Non ci sono"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.priorityPrimaryAction}
                activeOpacity={0.85}
                disabled={isResponding}
                onPress={() => handleRespondToTableInvitation(invite.reservation_id, "accepted")}
              >
                <Feather name="check" size={16} color="white" />
                <Text style={styles.priorityPrimaryActionText}>{isResponding ? "Invio..." : "Ci sono"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.priorityFooterNoteWrap}>
              <Text style={styles.priorityFooterNote}>{formatInvitationStatus(invite.invitation_status)} • {formatReservationStatus(invite.reservation_status)}</Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  const renderLiveActivityCard = ({ item }: { item: ActivityFeedItem }) => {
    const iconName = item.kind === "proposal" ? "message-circle" : item.kind === "directInvite" ? "send" : "bell";
    const accentColor = item.kind === "proposal"
      ? theme.colors.primary
      : item.kind === "directInvite"
        ? theme.colors.accent
        : "#68D7AF";

    const title = item.kind === "proposal"
      ? groupsById.get(item.proposal.groupId)?.name || "Proposta gruppo"
      : item.kind === "directInvite"
        ? "Invito diretto inviato"
        : `Invito da ${item.invite.inviter.name}`;

    const body = item.kind === "proposal"
      ? `${item.proposal.venueName} • ${formatProposalStatus(item.proposal.status)}`
      : item.kind === "directInvite"
        ? `${item.invite.venue.name} • ${item.invite.inviteStats.accepted} conferme`
        : `${item.invite.venue?.name || "Locale"} • ${formatInvitationStatus(item.invite.invitation_status)}`;

    return (
      <TouchableOpacity
        style={styles.liveCard}
        activeOpacity={0.88}
        onPress={() => setActiveTab(item.kind === "incomingInvite" ? "friends" : "activity")}
      >
        <View style={[styles.liveCardIconWrap, { backgroundColor: accentColor + "18", borderColor: accentColor + "36" }]}>
          <Feather name={iconName as any} size={16} color={accentColor} />
        </View>
        <Text style={styles.liveCardTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.liveCardText} numberOfLines={2}>{body}</Text>
        <View style={styles.liveCardFooter}>
          <Text style={styles.liveCardFooterText} numberOfLines={1}>{formatShortDateTime(item.createdAt) || "Adesso"}</Text>
          <Feather name="arrow-up-right" size={14} color={theme.colors.text} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderTopChrome = () => (
    <>
      <TouchableOpacity style={styles.searchHeroCard} activeOpacity={0.9} onPress={() => setShowSearchModal(true)}>
        <LinearGradient
          colors={isDark ? ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.02)"] : ["rgba(255,255,255,0.88)", "rgba(255,255,255,0.72)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.searchHeroSurface}
        >
          <View style={styles.searchHeroIconWrap}>
            <Feather name="search" size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.searchHeroCopy}>
            <Text style={styles.searchHeroLabel}>Cerca e aggiungi</Text>
            <Text style={styles.searchHeroValue} numberOfLines={1}>{searchText.trim() ? searchText : "Username, nome o contatto"}</Text>
          </View>
          <Feather name="arrow-right" size={18} color={theme.colors.text} />
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.statCard} activeOpacity={0.85} onPress={() => setActiveTab("friends")}>
          <View style={[styles.statIconWrap, { backgroundColor: theme.colors.primary + "20" }]}>
            <Feather name="users" size={18} color={theme.colors.primary} />
          </View>
          <Text style={styles.statValue}>{friends.length}</Text>
          <Text style={styles.statLabel}>Rete</Text>
          <Text style={styles.statCaption}>{onlineFriends.length} online</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} activeOpacity={0.85} onPress={() => setActiveTab("friends")}>
          <View style={[styles.statIconWrap, { backgroundColor: theme.colors.accent + "20" }]}>
            <Feather name="bell" size={18} color={theme.colors.accent} />
          </View>
          <Text style={styles.statValue}>{pendingRequestsCount + pendingInvitesCount}</Text>
          <Text style={styles.statLabel}>Da gestire</Text>
          <Text style={styles.statCaption}>{pendingInvitesCount} inviti, {pendingRequestsCount} richieste</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} activeOpacity={0.85} onPress={() => setActiveTab("groups")}>
          <View style={[styles.statIconWrap, { backgroundColor: "#68D7AF22" }]}>
            <MaterialCommunityIcons name="account-group" size={20} color="#3DBE8E" />
          </View>
          <Text style={styles.statValue}>{activeGroupCount}</Text>
          <Text style={styles.statLabel}>Gruppi</Text>
          <Text style={styles.statCaption}>{groupsWithOpenProposalCount} con proposte attive</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabsShell}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "friends" && styles.tabActive]}
          onPress={() => setActiveTab("friends")}
        >
          <Text style={[styles.tabText, activeTab === "friends" && styles.tabTextActive]}>Amici</Text>
          <View style={[styles.tabCountBadge, activeTab === "friends" && styles.tabCountBadgeActive]}>
            <Text style={[styles.tabCountText, activeTab === "friends" && styles.tabCountTextActive]}>{pendingRequestsCount + pendingInvitesCount}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "groups" && styles.tabActive]}
          onPress={() => setActiveTab("groups")}
        >
          <Text style={[styles.tabText, activeTab === "groups" && styles.tabTextActive]}>Gruppi</Text>
          <View style={[styles.tabCountBadge, activeTab === "groups" && styles.tabCountBadgeActive]}>
            <Text style={[styles.tabCountText, activeTab === "groups" && styles.tabCountTextActive]}>{groups.length}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "activity" && styles.tabActive]}
          onPress={() => setActiveTab("activity")}
        >
          <Text style={[styles.tabText, activeTab === "activity" && styles.tabTextActive]}>Attività</Text>
          <View style={[styles.tabCountBadge, activeTab === "activity" && styles.tabCountBadgeActive]}>
            <Text style={[styles.tabCountText, activeTab === "activity" && styles.tabCountTextActive]}>{activityFeed.length}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ["#080910", "#151126", "#090A10"] : ["#F4F1FF", "#EEF5FF", "#F8F8FC"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {activeTab === "friends" ? (
        loadingFriends || loadingRequests || loadingInvitations ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomListInset + 24 }]}
          >
            {renderTopChrome()}
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.emptyTitle}>Caricamento rete</Text>
              <Text style={styles.emptyText}>Sto sincronizzando amici, richieste e inviti tavolo</Text>
            </View>
          </ScrollView>
        ) : (
          <SectionList
            sections={friendsSections as any}
            keyExtractor={(item, index) => item.id.toString() + index}
            renderItem={({ item, section }) => renderFriendCard({ item, section })}
            renderSectionHeader={renderSectionHeader}
            ListHeaderComponent={
              <View>
                {renderTopChrome()}
                <View style={styles.overviewSection}>
                  <View style={styles.inlineSectionHeader}>
                    <View>
                      <Text style={styles.inlineSectionEyebrow}>Priorità</Text>
                      <Text style={styles.inlineSectionTitle}>Inviti e richieste</Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => setActiveTab("friends")}>
                      <Text style={styles.inlineSectionAction}>Apri tutto</Text>
                    </TouchableOpacity>
                  </View>

                  {priorityItems.length > 0 ? (
                    <FlatList
                      data={priorityItems}
                      renderItem={renderPriorityCard}
                      keyExtractor={(item) => item.id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.priorityRail}
                    />
                  ) : (
                    <View style={styles.compactEmptyCard}>
                      <View style={styles.compactEmptyIcon}>
                        <Feather name="check-circle" size={18} color="#68D7AF" />
                      </View>
                      <Text style={styles.compactEmptyTitle}>Inbox pulita</Text>
                      <Text style={styles.compactEmptyText}>Non hai richieste o inviti urgenti da gestire in questo momento.</Text>
                    </View>
                  )}
                </View>

                <View style={styles.overviewSection}>
                  <View style={styles.inlineSectionHeader}>
                    <View>
                      <Text style={styles.inlineSectionEyebrow}>Tempo reale</Text>
                      <Text style={styles.inlineSectionTitle}>Live activity</Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => setActiveTab("activity")}>
                      <Text style={styles.inlineSectionAction}>Vai al feed</Text>
                    </TouchableOpacity>
                  </View>

                  {liveActivityHighlights.length > 0 ? (
                    <FlatList
                      data={liveActivityHighlights}
                      renderItem={renderLiveActivityCard}
                      keyExtractor={(item) => item.id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.liveRail}
                    />
                  ) : (
                    <View style={styles.compactEmptyCard}>
                      <View style={styles.compactEmptyIcon}>
                        <Feather name="radio" size={18} color={theme.colors.primary} />
                      </View>
                      <Text style={styles.compactEmptyTitle}>Nessuna attività in evidenza</Text>
                      <Text style={styles.compactEmptyText}>Le nuove proposte gruppo e gli inviti diretti compariranno qui.</Text>
                    </View>
                  )}
                </View>

                <View style={styles.inlineSectionHeader}>
                  <View>
                    <Text style={styles.inlineSectionEyebrow}>Network</Text>
                    <Text style={styles.inlineSectionTitle}>La tua rete</Text>
                  </View>
                  <Text style={styles.inlineSectionActionMuted}>{filteredOnlineFriends.length + filteredOfflineFriends.length} visibili</Text>
                </View>

                <View style={styles.friendsFilterBar}>
                  <Feather name="search" size={16} color={theme.colors.muted} />
                  <TextInput
                    style={styles.friendsFilterInput}
                    value={friendDirectoryQuery}
                    onChangeText={setFriendDirectoryQuery}
                    placeholder="Cerca tra i tuoi amici"
                    placeholderTextColor={theme.colors.muted}
                  />
                  {friendDirectoryQuery.trim().length > 0 ? (
                    <TouchableOpacity onPress={() => setFriendDirectoryQuery("")}> 
                      <Feather name="x" size={16} color={theme.colors.muted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            }
            renderSectionFooter={renderSectionFooter}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="users" size={48} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>Nessun amico ancora</Text>
                <Text style={styles.emptyText}>Apri la ricerca e aggiungi i primi contatti per iniziare.</Text>
              </View>
            }
            scrollEnabled={true}
            style={styles.friendsList}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomListInset + 80 }]}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={6}
            removeClippedSubviews={true}
          />
        )
      ) : activeTab === "groups" ? (
        <View style={styles.groupsContainer}>
          <FlatList
            data={groups}
            renderItem={renderGroupCard}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[styles.groupsList, { paddingBottom: bottomListInset + 24 }]}
            style={styles.groupsListContainer}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={6}
            removeClippedSubviews={true}
            ListHeaderComponent={
              <View>
                {renderTopChrome()}
                <View style={styles.heroSummaryCard}>
                  <LinearGradient
                    colors={isDark ? ["rgba(155,92,255,0.18)", "rgba(18,18,28,0.92)"] : ["rgba(110,91,230,0.12)", "rgba(255,255,255,0.96)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroSummarySurface}
                  >
                    <Text style={styles.heroSummaryEyebrow}>Cerchie</Text>
                    <Text style={styles.heroSummaryTitle}>Gestisci gruppi, membri e proposte tavolo</Text>
                    <Text style={styles.heroSummaryText}>Quando i gruppi aumentano, qui resta tutto leggibile: membri visibili, badge attivi e accesso rapido alle proposte.</Text>
                    <View style={styles.heroSummaryStatsRow}>
                      <View style={styles.heroSummaryStat}>
                        <Text style={styles.heroSummaryStatValue}>{groups.length}</Text>
                        <Text style={styles.heroSummaryStatLabel}>Gruppi</Text>
                      </View>
                      <View style={styles.heroSummaryStat}>
                        <Text style={styles.heroSummaryStatValue}>{groupsWithOpenProposalCount}</Text>
                        <Text style={styles.heroSummaryStatLabel}>Con votazioni</Text>
                      </View>
                      <View style={styles.heroSummaryStat}>
                        <Text style={styles.heroSummaryStatValue}>{friends.length}</Text>
                        <Text style={styles.heroSummaryStatLabel}>Amici invitabili</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                <TouchableOpacity
                  style={styles.createGroupButton}
                  activeOpacity={0.9}
                  onPress={() => setShowCreateGroupModal(true)}
                >
                  <View style={styles.createGroupButtonIconWrap}>
                    <MaterialCommunityIcons name="account-group-outline" size={20} color="white" />
                  </View>
                  <View style={styles.createGroupButtonCopy}>
                    <Text style={styles.createGroupButtonText}>Nuovo gruppo</Text>
                    <Text style={styles.createGroupButtonSubtitle}>Invita amici e avvia le votazioni tavolo</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="white" />
                </TouchableOpacity>
              </View>
            }
            ListEmptyComponent={
              loadingGroups ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.emptyTitle}>Caricamento gruppi</Text>
                  <Text style={styles.emptyText}>Un attimo e ti mostro le tue cerchie attive.</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="account-group-outline" size={52} color={theme.colors.border} />
                  <Text style={styles.emptyTitle}>Crea il tuo primo gruppo</Text>
                  <Text style={styles.emptyText}>Invita amici, lancia proposte e tieni traccia delle risposte senza perdere contesto.</Text>
                </View>
              )
            }
          />
        </View>
      ) : (
        <FlatList
          data={activityFeed}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.activityList, { paddingBottom: bottomListInset + 24 }]}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={6}
          removeClippedSubviews={true}
          ListHeaderComponent={
            <View>
              {renderTopChrome()}
              <View style={styles.heroSummaryCard}>
                <LinearGradient
                  colors={isDark ? ["rgba(104,215,175,0.16)", "rgba(18,18,28,0.92)"] : ["rgba(104,215,175,0.12)", "rgba(255,255,255,0.96)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroSummarySurface}
                >
                  <Text style={styles.heroSummaryEyebrow}>Feed operativo</Text>
                  <Text style={styles.heroSummaryTitle}>Tutte le attività tavolo in una timeline unica</Text>
                  <Text style={styles.heroSummaryText}>Proposte gruppo, inviti ricevuti e inviti diretti inviati restano ordinati e leggibili anche quando il volume cresce.</Text>
                  <View style={styles.heroSummaryStatsRow}>
                    <View style={styles.heroSummaryStat}>
                      <Text style={styles.heroSummaryStatValue}>{activityFeed.length}</Text>
                      <Text style={styles.heroSummaryStatLabel}>Eventi feed</Text>
                    </View>
                    <View style={styles.heroSummaryStat}>
                      <Text style={styles.heroSummaryStatValue}>{pendingInvitesCount}</Text>
                      <Text style={styles.heroSummaryStatLabel}>In attesa</Text>
                    </View>
                    <View style={styles.heroSummaryStat}>
                      <Text style={styles.heroSummaryStatValue}>{activityProposals.length}</Text>
                      <Text style={styles.heroSummaryStatLabel}>Proposte</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </View>
          }
          ListEmptyComponent={
            loadingGroups || loadingGroupProposals ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.emptyTitle}>Caricamento attività</Text>
                <Text style={styles.emptyText}>Sto sincronizzando chat gruppo, inviti e votazioni.</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="message-circle" size={48} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>Nessuna attività tavolo</Text>
                <Text style={styles.emptyText}>Qui compariranno proposte gruppo, inviti diretti e aggiornamenti sulle risposte.</Text>
              </View>
            )
          }
        />
      )}

      {/* Search Modal */}
      <Modal
        visible={showSearchModal && !selectedProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cerca amici</Text>
              <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                <Feather name="x" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarContainer}>
              <Feather name="search" size={20} color={theme.colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cerca amici o username..."
                placeholderTextColor={theme.colors.muted}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <Feather name="x" size={20} color={theme.colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            {loadingSearch ? (
              <View style={styles.noResultsContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.noResultsText}>Ricerca in corso...</Text>
              </View>
            ) : searchedUsers.length > 0 ? (
              <View style={styles.resultsContainer}>
                <FlatList
                  data={searchedUsers}
                  renderItem={renderSearchResult}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={true}
                  contentContainerStyle={styles.searchList}
                />
              </View>
            ) : searchText.length > 0 ? (
              <View style={styles.noResultsContainer}>
                <Feather name="search" size={48} color={theme.colors.border} />
                <Text style={styles.noResultsText}>Nessun risultato</Text>
              </View>
            ) : (
              <View style={styles.suggestedContainer}>
                <Text style={styles.suggestedTitle}>Persone consigliate</Text>
                {suggestedUsers.length > 0 ? (
                  <FlatList
                    data={suggestedUsers}
                    renderItem={renderSearchResult}
                    keyExtractor={(item) => item.id.toString()}
                    scrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.searchList}
                  />
                ) : (
                  <View style={styles.noProposalCard}>
                    <Text style={styles.noMutualText}>Inizia a digitare per cercare nuovi amici.</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Profile Modal */}
      <Modal
        visible={!!selectedProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedProfile(null)}
      >
        <SafeAreaView style={styles.profileModalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={[styles.profileModalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.profileHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setSelectedProfile(null)}
              >
                <Feather name="chevron-left" size={28} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>Profilo</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.profileCard}>
              {isImageUrl(selectedProfile?.avatar) ? (
                <Image source={{ uri: selectedProfile?.avatar }} style={styles.profileAvatarImage} />
              ) : (
                <View style={styles.profileAvatarFallback}><Feather name="user" size={34} color={theme.colors.muted} /></View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{selectedProfile?.name}</Text>
                <View style={styles.mutualBadge}>
                  <Feather name="users" size={14} color={theme.colors.primary} />
                  <Text style={styles.mutualBadgeText}>
                    {getMutualFriendsCount(selectedProfile?.id)} amici in comune
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.mutualSection}>
              <Text style={styles.mutualSectionTitle}>Amici in comune</Text>
              {getMutualFriends(selectedProfile?.id).length > 0 ? (
                <FlatList
                  data={getMutualFriends(selectedProfile?.id)}
                  renderItem={renderMutualFriend}
                  keyExtractor={(item) => item.id.toString()}
                  numColumns={3}
                  scrollEnabled={false}
                  columnWrapperStyle={styles.mutualGrid}
                  contentContainerStyle={styles.mutualListContent}
                />
              ) : (
                <View style={styles.noMutualContainer}>
                  <Text style={styles.noMutualText}>Nessun amico in comune</Text>
                </View>
              )}
            </View>

            <View style={styles.profileAction}>
              {selectedProfile?.requestId ? (
                <View style={styles.requestInlineActions}>
                  <TouchableOpacity 
                    style={[styles.actionButtonLarge, styles.acceptButton]}
                    onPress={() => handleAcceptFriendRequest(selectedProfile.requestId, selectedProfile.name)}
                  >
                    <Feather name="check" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Accetta</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionButtonLarge, styles.rejectButton]}
                    onPress={() => handleRejectFriendRequest(selectedProfile.requestId, selectedProfile.name)}
                  >
                    <Feather name="x" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Rifiuta</Text>
                  </TouchableOpacity>
                </View>
              ) : selectedProfile?.isFriend ? (
                <TouchableOpacity 
                  style={[styles.actionButtonLarge, styles.removeFriendButton]}
                  onPress={() => {
                    Alert.alert(
                      "Rimuovere amico",
                      `Vuoi rimuovere ${selectedProfile?.name}?`,
                      [
                        { text: "Annulla", style: "cancel" },
                        {
                          text: "Rimuovi",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await removeFriend(String(selectedProfile?.id));
                              setFriends((prev) => prev.filter((f) => f.id !== selectedProfile?.id));
                              setSelectedProfile(null);
                            } catch {
                              Alert.alert("Errore", "Impossibile rimuovere l'amico");
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Feather name="user-x" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Rimuovi amico</Text>
                </TouchableOpacity>
              ) : selectedProfile?.hasPendingRequest ? (
                <View style={[styles.actionButtonLarge, styles.alreadyFriendButton]}>
                  <Feather name="clock" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Richiesta già inviata</Text>
                </View>
              ) : selectedProfile?.isSelf ? (
                <View style={[styles.actionButtonLarge, styles.alreadyFriendButton]}>
                  <Feather name="user-check" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Questo sei tu</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.actionButtonLarge, styles.addFriendLargeButton]}
                  onPress={() => handleSendFriendRequest(selectedProfile?.id, selectedProfile?.name)}
                >
                  <Feather name="user-plus" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Aggiungi amico</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={showCreateGroupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCreateGroupModal(false);
          setCreateGroupFriendQuery("");
        }}
      >
        <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom", "left", "right"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardWrap}
          >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuovo Gruppo</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateGroupModal(false);
                  setCreateGroupFriendQuery("");
                }}
              >
                <Feather name="x" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInlineSummary}>
              <Text style={styles.modalInlineSummaryTitle}>Composizione</Text>
              <Text style={styles.modalInlineSummaryText}>Tu più {selectedGroupMembers.length} amici selezionati. Il gruppo sarà pronto per inviti e votazioni.</Text>
            </View>

            <View style={styles.flexFill}>
              <FlatList
                data={visibleCreateGroupFriends}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.friendSelectCard,
                      selectedGroupMembers.includes(item.id) && styles.friendSelectCardActive
                    ]}
                    onPress={() => setSelectedGroupMembers(prev =>
                      prev.includes(item.id)
                        ? prev.filter(id => id !== item.id)
                        : [...prev, item.id]
                    )}
                  >
                    <View style={styles.friendSelectContent}>
                      {isImageUrl(item.avatar) ? (
                        <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.avatarPlaceholder}><Feather name="user" size={18} color={theme.colors.muted} /></View>
                      )}
                      <Text style={styles.friendSelectName}>{item.name}</Text>
                    </View>
                    {selectedGroupMembers.includes(item.id) && (
                      <View style={styles.checkBox}>
                        <Feather name="check" size={16} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.friendSelectList}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  <View style={styles.createGroupHeaderFields}>
                    <Text style={styles.formLabel}>Nome del gruppo</Text>
                    <TextInput
                      style={styles.groupNameInput}
                      placeholder="Es: Crew Universitaria"
                      placeholderTextColor={theme.colors.muted}
                      value={newGroupName}
                      onChangeText={(text) => setNewGroupName(text.slice(0, 36))}
                      maxLength={36}
                    />
                    <View style={styles.createGroupMetaRow}>
                      <Text style={styles.formHint}>Minimo 2 caratteri</Text>
                      <Text style={styles.formHint}>{newGroupNameTrimmed.length}/36</Text>
                    </View>

                    <Text style={[styles.formLabel, { marginTop: 20 }]}>Seleziona amici</Text>
                    <View style={styles.createGroupSelectedBadge}>
                      <Feather name="users" size={14} color={theme.colors.primary} />
                      <Text style={styles.createGroupSelectedBadgeText}>{selectedGroupMembers.length} selezionati</Text>
                    </View>

                    <View style={[styles.friendsFilterBar, styles.modalFriendsFilterBar]}>
                      <Feather name="search" size={16} color={theme.colors.muted} />
                      <TextInput
                        style={styles.friendsFilterInput}
                        value={createGroupFriendQuery}
                        onChangeText={setCreateGroupFriendQuery}
                        placeholder="Filtra amici da aggiungere"
                        placeholderTextColor={theme.colors.muted}
                      />
                      {createGroupFriendQuery.trim().length > 0 ? (
                        <TouchableOpacity onPress={() => setCreateGroupFriendQuery("")}> 
                          <Feather name="x" size={16} color={theme.colors.muted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                }
                ListEmptyComponent={
                  <View style={styles.noProposalCard}>
                    <Text style={styles.noMutualText}>Prima aggiungi almeno un amico, poi potrai creare gruppi.</Text>
                  </View>
                }
                ListFooterComponent={
                  <>
                    {filteredCreateGroupFriends.length > visibleCreateGroupFriends.length ? (
                      <TouchableOpacity
                        style={styles.sectionLoadMoreButton}
                        activeOpacity={0.85}
                        onPress={() => setVisibleCreateGroupFriendsCount((prev) => prev + 24)}
                      >
                        <Text style={styles.sectionLoadMoreText}>
                          Mostra altri {Math.min(filteredCreateGroupFriends.length - visibleCreateGroupFriends.length, 24)} amici
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    <View style={styles.createGroupFooter}>
                      <TouchableOpacity
                        style={[styles.createButton, !canCreateGroup && styles.createButtonDisabled]}
                        onPress={handleCreateGroup}
                        disabled={!canCreateGroup}
                      >
                        <Feather name="plus" size={20} color="white" />
                        <Text style={styles.createButtonText}>Crea Gruppo</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                }
              />
            </View>
          </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Group Detail Modal */}
      <Modal
        visible={!!selectedGroup && !showInviteModal && !showVenueModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          closeGroupSubModals();
          setSelectedGroup(null);
        }}
      >
        <SafeAreaView style={styles.profileModalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={[styles.profileModalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.profileHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => {
                  closeGroupSubModals();
                  setSelectedGroup(null);
                }}
              >
                <Feather name="chevron-left" size={28} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>{selectedGroup?.name}</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={[styles.profileCard, { backgroundColor: (selectedGroup?.color || "#6D5BFF") + "15" }]}>
              <View style={[styles.groupIconLarge, { backgroundColor: (selectedGroup?.color || "#6D5BFF") + "30" }]}>
                {isImageUrl(selectedGroup?.avatar) ? (
                  <Image source={{ uri: selectedGroup?.avatar }} style={styles.groupImageLarge} />
                ) : (
                  <MaterialCommunityIcons name="account-group" size={36} color={theme.colors.primary} />
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{selectedGroup?.name}</Text>
                <Text style={styles.groupMembersCount}>{selectedGroupMembersData.length} membri</Text>
                <View style={styles.groupDetailChipsRow}>
                  <View style={styles.groupDetailChip}>
                    <Text style={styles.groupDetailChipText}>{selectedGroupProposals.length} proposte aperte</Text>
                  </View>
                  <View style={styles.groupDetailChip}>
                    <Text style={styles.groupDetailChipText}>{availableFriendsForSelectedGroup.length} amici invitabili</Text>
                  </View>
                  {selectedGroupIsOwner ? (
                    <View style={[styles.groupDetailChip, styles.groupDetailChipOwner]}>
                      <Text style={styles.groupDetailChipOwnerText}>Sei il creator</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.groupDetailIntroCardWrap}>
              <LinearGradient
                colors={isDark ? ["rgba(155,92,255,0.14)", "rgba(255,255,255,0.03)"] : ["rgba(110,91,230,0.10)", "rgba(255,255,255,0.80)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.groupDetailIntroCard}
              >
                <Text style={styles.groupDetailIntroTitle}>Panoramica gruppo</Text>
                <Text style={styles.groupDetailIntroText}>
                  Qui trovi membri, votazioni e azioni principali del gruppo in una vista più ordinata anche quando le proposte aumentano.
                </Text>
              </LinearGradient>
            </View>

            <ScrollView
              style={styles.flexFill}
              contentContainerStyle={styles.groupDetailScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.mutualSectionCompact}>
                <Text style={styles.mutualSectionTitle}>Membri</Text>
                {selectedGroupMembersData.length > 9 ? (
                  <Text style={styles.groupSectionHint}>La griglia resta completa anche per gruppi numerosi.</Text>
                ) : null}
                <View style={styles.groupMembersWrap}>
                  {selectedGroupMembersData.map((member) => (
                    <View key={member.id} style={styles.groupMemberCard}>
                      {isImageUrl(member.avatar) ? (
                        <Image source={{ uri: member.avatar }} style={styles.groupMemberAvatarImage} />
                      ) : (
                        <View style={styles.groupMemberAvatarFallback}><Feather name="user" size={20} color={theme.colors.muted} /></View>
                      )}
                      <Text style={styles.groupMemberName}>{member.name}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.groupProposalSection}>
                <Text style={styles.mutualSectionTitle}>Chat proposte tavolo</Text>
                {selectedGroupProposals.length > 3 ? (
                  <Text style={styles.groupSectionHint}>Le proposte più recenti restano in alto con stato, voti e azione successiva.</Text>
                ) : null}
                {selectedGroupProposals.length === 0 ? (
                  <View style={styles.noProposalCard}>
                    <Text style={styles.noMutualText}>Nessuna proposta attiva. Scrivi la prima proposta al gruppo.</Text>
                  </View>
                ) : (
                  <View style={styles.groupProposalList}>
                    {selectedGroupProposals.map((proposal) => {
                      const isMine = proposal.createdByUserId === String(user?.id);

                      return (
                        <View
                          key={proposal.id}
                          style={[styles.chatRow, isMine ? styles.chatRowMine : styles.chatRowOther]}
                        >
                          <View style={[styles.chatBubble, isMine ? styles.chatBubbleMine : styles.chatBubbleOther]}>
                            <View style={styles.chatHeaderRow}>
                              <View style={styles.chatAuthorRow}>
                                {isImageUrl(proposal.createdByAvatar) ? (
                                  <Image source={{ uri: proposal.createdByAvatar }} style={styles.chatAuthorImage} />
                                ) : (
                                  <View style={styles.chatAuthorFallback}><Feather name="user" size={14} color={theme.colors.muted} /></View>
                                )}
                                <View>
                                  <Text style={styles.chatAuthorName}>{proposal.createdByName}</Text>
                                  <Text style={styles.chatAuthorMeta}>{formatShortDateTime(proposal.createdAt)}</Text>
                                </View>
                              </View>
                            </View>

                            {renderProposalCardContent(proposal, { manageGroup: selectedGroup })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.groupActionsContainer}>
                <TouchableOpacity 
                  style={[styles.groupActionButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    if (!selectedGroup) {
                      Alert.alert("Errore", "Apri prima un gruppo");
                      return;
                    }
                    setShowInviteModal(true);
                  }}
                >
                  <Feather name="user-plus" size={20} color="white" />
                  <Text style={styles.groupActionText}>Invita amici</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.groupActionButton, { backgroundColor: theme.colors.accent }]}
                  onPress={() => {
                    if (!selectedGroup) {
                      Alert.alert("Errore", "Apri prima un gruppo");
                      return;
                    }
                    if (!isCurrentUserInGroup(selectedGroup)) {
                      Alert.alert("Errore", "Solo i membri del gruppo possono proporre un tavolo");
                      return;
                    }
                    setSelectedVenueForProposal(null);
                    setProposalZones([]);
                    setSelectedProposalZoneId(null);
                    setProposalGuests("4");
                    setProposalNote("");
                    setShowVenueModal(true);
                  }}
                >
                  <Feather name="message-circle" size={20} color="white" />
                  <Text style={styles.groupActionText}>Nuova proposta</Text>
                </TouchableOpacity>
              </View>

              {selectedGroupIsOwner ? (
                <View style={styles.groupDangerZone}>
                  <Text style={styles.groupDangerTitle}>Gestione gruppo</Text>
                  <Text style={styles.groupDangerText}>Se questo gruppo non serve più, puoi eliminarlo direttamente da qui.</Text>
                  <TouchableOpacity style={styles.groupDangerButton} onPress={handleDeleteSelectedGroup}>
                    <Feather name="trash-2" size={18} color="white" />
                    <Text style={styles.groupDangerButtonText}>Elimina gruppo</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowInviteModal(false);
          setInviteFriendQuery("");
        }}
      >
        <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invita amici</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteFriendQuery("");
                }}
              >
                <Feather name="x" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInlineSummary}>
              <Text style={styles.modalInlineSummaryTitle}>Persone disponibili</Text>
              <Text style={styles.modalInlineSummaryText}>{availableFriendsForSelectedGroup.length} amici possono ancora entrare in questo gruppo.</Text>
            </View>

            <View style={[styles.friendsFilterBar, styles.modalFriendsFilterBar, { marginHorizontal: 20, marginTop: 8 }]}> 
              <Feather name="search" size={16} color={theme.colors.muted} />
              <TextInput
                style={styles.friendsFilterInput}
                value={inviteFriendQuery}
                onChangeText={setInviteFriendQuery}
                placeholder="Filtra amici invitabili"
                placeholderTextColor={theme.colors.muted}
              />
              {inviteFriendQuery.trim().length > 0 ? (
                <TouchableOpacity onPress={() => setInviteFriendQuery("")}> 
                  <Feather name="x" size={16} color={theme.colors.muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={visibleInviteFriends}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.inviteCard}
                  onPress={() => handleAddMemberToGroup(item.id, item.name)}
                >
                  <View style={styles.friendContent}>
                    {isImageUrl(item.avatar) ? (
                      <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder}><Feather name="user" size={18} color={theme.colors.muted} /></View>
                    )}
                    <Text style={styles.searchResultName}>{item.name}</Text>
                  </View>
                  <Feather name="plus" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.inviteList}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={6}
              ListEmptyComponent={
                <View style={styles.noProposalCard}>
                  <Text style={styles.noMutualText}>Tutti i tuoi amici sono già nel gruppo, oppure non hai ancora contatti da invitare.</Text>
                </View>
              }
              ListFooterComponent={
                filteredInviteFriends.length > visibleInviteFriends.length ? (
                  <TouchableOpacity
                    style={styles.sectionLoadMoreButton}
                    activeOpacity={0.85}
                    onPress={() => setVisibleInviteFriendsCount((prev) => prev + 24)}
                  >
                    <Text style={styles.sectionLoadMoreText}>
                      Mostra altri {Math.min(filteredInviteFriends.length - visibleInviteFriends.length, 24)} amici
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Venue Proposal Modal */}
      <Modal
        visible={showVenueModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowVenueModal(false);
        }}
      >
        <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom", "left", "right"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardWrap}
          >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Proponi un tavolo</Text>
              <TouchableOpacity onPress={() => setShowVenueModal(false)}>
                <Feather name="x" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInlineSummary}>
              <Text style={styles.modalInlineSummaryTitle}>Workflow</Text>
              <Text style={styles.modalInlineSummaryText}>Configuri il tavolo, il gruppo vota, poi da qui puoi procedere alla prenotazione finale.</Text>
            </View>

            <ScrollView
              style={styles.flexFill}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
            <View style={styles.createGroupForm}>
              <View style={styles.proposalIntroCard}>
                <Text style={styles.proposalIntroEyebrow}>Sondaggio gruppo</Text>
                <Text style={styles.proposalIntroTitle}>Costruisci una proposta chiara prima del voto</Text>
                <Text style={styles.proposalIntroText}>Scegli locale, evento, zona e persone. Il gruppo voterà in base a questi dettagli.</Text>
              </View>

              {/* Step 1: Venue */}
              <View style={styles.proposalStepCard}>
                <View style={styles.proposalStepHeader}>
                  <View style={styles.proposalStepBadge}><Text style={styles.proposalStepBadgeText}>1</Text></View>
                  <View style={styles.proposalStepCopy}>
                    <Text style={styles.formLabel}>Seleziona locale</Text>
                    <Text style={styles.proposalStepText}>Parti dal posto in cui vuoi andare con il gruppo.</Text>
                  </View>
                </View>
                {loadingVenues ? (
                  <View style={styles.inlineLoadingRow}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={styles.inlineLoadingText}>Carico locali...</Text>
                  </View>
                ) : venues.length === 0 ? (
                  <View style={styles.noProposalCard}>
                    <Text style={styles.noMutualText}>Nessun locale disponibile al momento.</Text>
                  </View>
                ) : null}
                <View style={styles.venueList}>
                  {venues.map((item) => {
                    const active = selectedVenueForProposal === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.venueCard,
                          active && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + "15" },
                        ]}
                        onPress={() => {
                          if (selectedVenueForProposal !== item.id) {
                            setSelectedEventIdForProposal(null);
                            setVenueEvents([]);
                            setProposalZones([]);
                            setSelectedProposalZoneId(null);
                          }
                          setSelectedVenueForProposal(item.id);
                        }}
                      >
                        <View style={styles.venueIconContainer}>
                          <Feather name="map-pin" size={20} color={theme.colors.primary} />
                        </View>
                        <View style={styles.venueInfo}>
                          <Text style={styles.venueName}>{item.name}</Text>
                          <Text style={styles.venuePrice}>{item.city || ""}</Text>
                        </View>
                        {active ? (
                          <Feather name="check-circle" size={20} color={theme.colors.primary} />
                        ) : (
                          <Feather name="circle" size={20} color={theme.colors.muted} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Step 2: Event (visible only after venue selected) */}
              {!!selectedVenueForProposal && (
                <View style={styles.proposalStepCard}>
                  <View style={styles.proposalStepHeader}>
                    <View style={styles.proposalStepBadge}><Text style={styles.proposalStepBadgeText}>2</Text></View>
                    <View style={styles.proposalStepCopy}>
                      <Text style={styles.formLabel}>Seleziona evento</Text>
                      <Text style={styles.proposalStepText}>Scegli la serata specifica in programma per questo locale.</Text>
                    </View>
                  </View>
                  {loadingVenueEvents ? (
                    <View style={styles.inlineLoadingRow}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text style={styles.inlineLoadingText}>Carico eventi...</Text>
                    </View>
                  ) : venueEvents.length === 0 ? (
                    <View style={styles.noProposalCard}>
                      <Text style={styles.noMutualText}>Nessun evento trovato per questo locale — verrà usata la serata più vicina disponibile.</Text>
                    </View>
                  ) : (
                    <View style={styles.venueList}>
                      {venueEvents.map((evt) => {
                        const active = selectedEventIdForProposal === evt.id;
                        const dateLabel = evt.date
                          ? new Date(evt.date + "T00:00:00").toLocaleDateString("it-IT", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })
                          : "";
                        const isLive = (evt.status ?? "").toUpperCase() === "LIVE";
                        return (
                          <TouchableOpacity
                            key={evt.id}
                            style={[
                              styles.venueCard,
                              active && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + "15" },
                            ]}
                            onPress={() => setSelectedEventIdForProposal(evt.id)}
                          >
                            <View style={styles.venueIconContainer}>
                              <Feather name="calendar" size={18} color={isLive ? "#2DB983" : theme.colors.primary} />
                            </View>
                            <View style={styles.venueInfo}>
                              <Text style={styles.venueName}>{evt.name}</Text>
                              <Text style={styles.venuePrice}>
                                {dateLabel}
                                {isLive ? " · LIVE ora" : ""}
                              </Text>
                            </View>
                            {active ? (
                              <Feather name="check-circle" size={20} color={theme.colors.primary} />
                            ) : (
                              <Feather name="circle" size={20} color={theme.colors.muted} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Step 3: Zone + Guests */}
              <View style={styles.proposalStepCard}>
                <View style={styles.proposalStepHeader}>
                  <View style={styles.proposalStepBadge}><Text style={styles.proposalStepBadgeText}>3</Text></View>
                  <View style={styles.proposalStepCopy}>
                    <Text style={styles.formLabel}>Zona e capienza</Text>
                    <Text style={styles.proposalStepText}>Scegli l'area del locale e imposta una stima realistica delle persone.</Text>
                  </View>
                </View>
                {loadingProposalZones ? (
                  <View style={styles.inlineLoadingRow}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={styles.inlineLoadingText}>Carico zone del locale...</Text>
                  </View>
                ) : proposalZones.length === 0 ? (
                  <View style={styles.noProposalCard}>
                    <Text style={styles.noMutualText}>Nessuna zona configurata per questo locale.</Text>
                  </View>
                ) : (
                  <View style={styles.zoneListWrap}>
                    {proposalZones.map((zone) => {
                      const active = selectedProposalZoneId === zone.id;
                      return (
                        <TouchableOpacity
                          key={zone.id}
                          style={[
                            styles.zoneCard,
                            active && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + "15" },
                          ]}
                          onPress={() => setSelectedProposalZoneId(zone.id)}
                        >
                          <View style={styles.zoneCardTopRow}>
                            <Text style={styles.zoneCardTitle}>{zone.label}</Text>
                            <Feather
                              name={active ? "check-circle" : "circle"}
                              size={18}
                              color={active ? theme.colors.primary : theme.colors.muted}
                            />
                          </View>
                          <Text style={styles.zoneCardMeta}>
                            Per testa: {formatMoney(zone.perHead)} • Minimo: {formatMoney(zone.minimum)} • Max: {zone.maxPeople ?? "—"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <Text style={[styles.formLabel, { marginTop: 14 }]}>Persone previste</Text>
                <TextInput
                  style={styles.groupNameInput}
                  keyboardType="number-pad"
                  value={proposalGuests}
                  onChangeText={(text) => setProposalGuests(text.replace(/[^0-9]/g, ""))}
                  placeholder="Es: 6"
                  placeholderTextColor={theme.colors.muted}
                />

                {selectedProposalZone?.maxPeople ? (
                  <Text
                    style={[
                      styles.zoneHint,
                      { color: exceedsSelectedZoneMax ? theme.colors.error : theme.colors.muted },
                    ]}
                  >
                    Max per zona: {selectedProposalZone.maxPeople}
                  </Text>
                ) : null}

                <View style={styles.pricePreviewCard}>
                  <Text style={styles.pricePreviewLabel}>Prezzo stimato tavolo</Text>
                  <Text style={styles.pricePreviewValue}>{formatMoney(proposalEstimatedTotal)}</Text>
                </View>
              </View>

              {/* Step 4: Message + Preview */}
              <View style={styles.proposalStepCard}>
                <View style={styles.proposalStepHeader}>
                  <View style={styles.proposalStepBadge}><Text style={styles.proposalStepBadgeText}>4</Text></View>
                  <View style={styles.proposalStepCopy}>
                    <Text style={styles.formLabel}>Messaggio al gruppo</Text>
                    <Text style={styles.proposalStepText}>Aggiungi contesto utile: motivo, timing o priorità. Facoltativo.</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.groupNameInput, { minHeight: 80, textAlignVertical: "top" }]}
                  value={proposalNote}
                  onChangeText={(text) => setProposalNote(text.slice(0, 120))}
                  placeholder="Es: Tavolo front stage, arrivo entro le 23:30"
                  placeholderTextColor={theme.colors.muted}
                  multiline
                />

                <View style={styles.proposalPreviewPanel}>
                  <Text style={styles.proposalPreviewTitle}>Anteprima sondaggio</Text>
                  <Text style={styles.proposalPreviewMain}>
                    {venues.find((venue) => venue.id === selectedVenueForProposal)?.name || "Locale da scegliere"}
                  </Text>
                  <Text style={styles.proposalPreviewMeta}>
                    {selectedEventIdForProposal
                      ? (venueEvents.find((e) => e.id === selectedEventIdForProposal)?.name ?? "Evento selezionato")
                      : "Evento automatico"}
                    {" · "}{selectedProposalZone?.label || "Zona da scegliere"}
                  </Text>
                  <Text style={styles.proposalPreviewMeta}>
                    {proposalGuestsValue || 0} persone • {formatMoney(proposalEstimatedTotal)} stimati
                  </Text>
                  <Text style={styles.proposalPreviewHint}>
                    Il gruppo vedrà luogo, evento, costo e pulsanti di voto.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateGroupProposal}
              >
                <Feather name="send" size={18} color="white" />
                <Text style={styles.createButtonText}>Crea proposta e avvia voti</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.8,
  },

  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 4,
    maxWidth: 260,
    lineHeight: 18,
  },

  addButton: {
    backgroundColor: theme.colors.primary,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.35 : 0.22,
    shadowRadius: 20,
    elevation: 9,
  },

  searchHeroCard: {
    marginHorizontal: 20,
    marginTop: 8,
  },

  searchHeroSurface: {
    minHeight: 62,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  searchHeroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },

  searchHeroCopy: {
    flex: 1,
  },

  searchHeroLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  searchHeroValue: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 4,
  },

  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  statValue: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
  },

  statLabel: {
    fontSize: 12,
    color: theme.colors.text,
    marginTop: 4,
    fontWeight: "700",
  },

  statCaption: {
    fontSize: 10,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 14,
  },

  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  friendsList: {
    flex: 1,
  },

  overviewSection: {
    marginBottom: 22,
  },

  inlineSectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },

  inlineSectionEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },

  inlineSectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.4,
  },

  inlineSectionAction: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  inlineSectionActionMuted: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  friendsFilterBar: {
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  modalFriendsFilterBar: {
    marginTop: 10,
    marginBottom: 8,
  },

  friendsFilterInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 10,
  },

  sectionLoadMoreButton: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary + "44",
    backgroundColor: theme.colors.primary + "16",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionLoadMoreText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  priorityRail: {
    paddingRight: 12,
    gap: 12,
  },

  liveRail: {
    paddingRight: 12,
    gap: 12,
  },

  priorityCard: {
    width: 310,
  },

  priorityCardSurface: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    padding: 16,
    minHeight: 186,
  },

  priorityCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  priorityCardAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.card,
  },

  priorityCardAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  priorityIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  priorityCardCopy: {
    flex: 1,
  },

  priorityBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary + "20",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },

  priorityBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  priorityBadgeAlt: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent + "22",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },

  priorityBadgeAltText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.accent,
  },

  priorityCardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    lineHeight: 24,
  },

  priorityCardSubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 6,
    lineHeight: 18,
  },

  priorityMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  priorityMetaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.06)",
  },

  priorityMetaPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.text,
  },

  priorityActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  priorityPrimaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  priorityPrimaryActionText: {
    fontSize: 13,
    fontWeight: "900",
    color: "white",
  },

  prioritySecondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(12,12,12,0.08)",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
  },

  priorityDeclineAction: {
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.06)",
  },

  prioritySecondaryActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
  },

  priorityFooterNoteWrap: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.06)",
  },

  priorityFooterNote: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  liveCard: {
    width: 222,
    minHeight: 172,
    borderRadius: 22,
    padding: 16,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  liveCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  liveCardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 14,
  },

  liveCardText: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 8,
    lineHeight: 18,
  },

  liveCardFooter: {
    marginTop: "auto",
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  liveCardFooterText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  compactEmptyCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  compactEmptyIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  compactEmptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },

  compactEmptyText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: 6,
    lineHeight: 18,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
  },

  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  dotOnline: {
    backgroundColor: theme.colors.accent,
  },

  dotOffline: {
    backgroundColor: theme.colors.muted,
  },

  dotRequest: {
    backgroundColor: theme.colors.primary,
  },

  dotInvite: {
    backgroundColor: theme.colors.accent,
  },

  friendCard: {
    flexDirection: "row",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  friendCardOffline: {
    opacity: 0.82,
  },

  friendContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  avatarContainer: {
    position: "relative",
  },

  avatar: {
    fontSize: 32,
  },

  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.card,
  },

  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  onlineBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
    borderWidth: 2,
    borderColor: theme.colors.background,
    position: "absolute",
    bottom: 0,
    right: 0,
  },

  friendInfo: {
    flex: 1,
  },

  friendName: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },

  venueText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "700",
  },

  statusText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "500",
  },

  offlineText: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: "600",
  },

  friendCardAction: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  actions: {
    flexDirection: "row",
    gap: 8,
  },

  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  requestCard: {
    flexDirection: "row",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  invitationCard: {
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
  },

  invitationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  invitationIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },

  invitationMainInfo: {
    flex: 1,
  },

  invitationTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
  },

  invitationSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: 4,
  },

  invitationMetaWrap: {
    marginTop: 12,
    gap: 6,
  },

  invitationMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  invitationActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  invitationActionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  invitationAcceptButton: {
    backgroundColor: theme.colors.accent,
  },

  invitationDeclineButton: {
    backgroundColor: theme.colors.error,
  },

  invitationActionText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },

  invitationFooterRow: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },

  invitationFootnote: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
  },

  requestContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  requestInfo: {
    flex: 1,
  },

  requestName: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },

  requestTime: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: "500",
  },

  requestActions: {
    flexDirection: "row",
    gap: 8,
  },

  actionButtonSmall: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  acceptButton: {
    backgroundColor: theme.colors.accent,
  },

  rejectButton: {
    backgroundColor: theme.colors.error,
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 16,
  },

  emptyText: {
    fontSize: 14,
    color: theme.colors.muted,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flex: 0.9,
    paddingBottom: 30,
  },

  keyboardWrap: {
    width: "100%",
    flex: 1,
    justifyContent: "flex-end",
  },

  flexFill: {
    flex: 1,
  },

  modalScrollContent: {
    paddingBottom: 28,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.4,
  },

  modalInlineSummary: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  modalInlineSummaryTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  modalInlineSummaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: 6,
  },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderRadius: 18,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    gap: 10,
  },

  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    paddingVertical: 14,
    fontWeight: "600",
  },

  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },

  resultsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.muted,
    marginBottom: 12,
    marginTop: 8,
  },

  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  noResultsText: {
    fontSize: 16,
    color: theme.colors.muted,
    marginTop: 16,
  },

  suggestedContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },

  suggestedTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 12,
  },

  searchResultCard: {
    flexDirection: "row",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  searchResultContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  searchResultInfo: {
    flex: 1,
  },

  searchResultMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  searchResultName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  mutualCount: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: "600",
  },

  searchResultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },

  searchResultBadgeFriend: {
    backgroundColor: theme.colors.accent + "18",
    borderColor: theme.colors.accent + "44",
  },

  searchResultBadgeFriendText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.accent,
  },

  searchResultBadgePending: {
    backgroundColor: theme.colors.primary + "18",
    borderColor: theme.colors.primary + "44",
  },

  searchResultBadgePendingText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  searchResultBadgeNeutral: {
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(12,12,12,0.05)",
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.1)",
  },

  searchResultBadgeNeutralText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.muted,
  },

  profileModalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  profileModalContent: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },

  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.84)",
    justifyContent: "center",
    alignItems: "center",
  },

  profileHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
  },

  profileCard: {
    flexDirection: "row",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginVertical: 20,
    alignItems: "center",
    gap: 20,
  },

  profileAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.card,
  },

  profileAvatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  profileInfo: {
    flex: 1,
    gap: 12,
  },

  profileName: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
  },

  mutualBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary + "33",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    alignSelf: "flex-start",
  },

  mutualBadgeText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  mutualSection: {
    flex: 1,
    paddingHorizontal: 20,
  },

  mutualSectionCompact: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  groupDetailScrollContent: {
    paddingBottom: 24,
  },

  groupDetailChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  groupDetailChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  groupDetailChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.text,
  },

  groupDetailChipOwner: {
    backgroundColor: theme.colors.primary + "18",
    borderColor: theme.colors.primary + "38",
  },

  groupDetailChipOwnerText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  groupDetailIntroCardWrap: {
    paddingHorizontal: 20,
    marginTop: -4,
    marginBottom: 12,
  },

  groupDetailIntroCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  groupDetailIntroTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.text,
  },

  groupDetailIntroText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: 6,
  },

  groupSectionHint: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
    marginBottom: 10,
    lineHeight: 18,
  },

  mutualSectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 16,
  },

  mutualGrid: {
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  mutualListContent: {
    paddingBottom: 20,
  },

  mutualFriendCard: {
    flex: 0.31,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  mutualAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    backgroundColor: theme.colors.card,
  },

  mutualAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  mutualName: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
    lineHeight: 16,
  },

  noMutualContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },

  noMutualText: {
    fontSize: 14,
    color: theme.colors.muted,
  },

  profileAction: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  actionButtonLarge: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },

  addFriendLargeButton: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  alreadyFriendButton: {
    backgroundColor: theme.colors.accent,
    opacity: 0.92,
  },

  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },

  requestInlineActions: {
    flexDirection: "row",
    gap: 12,
  },

  removeFriendButton: {
    backgroundColor: theme.colors.error,
    shadowColor: theme.colors.error,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  tabsShell: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 6,
    marginBottom: 4,
    gap: 10,
  },

  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  tabActive: {
    backgroundColor: theme.colors.primary + "18",
    borderColor: theme.colors.primary + "44",
  },

  tabText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.muted,
  },

  tabTextActive: {
    color: theme.colors.text,
  },

  tabCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(12,12,12,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  tabCountBadgeActive: {
    backgroundColor: theme.colors.primary,
  },

  tabCountText: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.muted,
  },

  tabCountTextActive: {
    color: "white",
  },

  activityList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 14,
  },

  heroSummaryCard: {
    marginBottom: 16,
  },

  heroSummarySurface: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  heroSummaryEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 8,
  },

  heroSummaryTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.text,
    lineHeight: 30,
  },

  heroSummaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: 8,
    lineHeight: 19,
  },

  heroSummaryStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  heroSummaryStat: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  heroSummaryStatValue: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
  },

  heroSummaryStatLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
    marginTop: 4,
  },

  activityProposalCard: {
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 22,
    padding: 16,
  },

  proposalHeroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  proposalHeroCopy: {
    flex: 1,
    gap: 4,
  },

  proposalHeroTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
    lineHeight: 24,
  },

  proposalHeroSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
    lineHeight: 18,
  },

  proposalEventChipRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },

  proposalEventChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text,
    flexShrink: 1,
  },

  proposalEventChipSep: {
    fontSize: 12,
    color: theme.colors.muted,
  },

  proposalEventChipDate: {
    fontSize: 11,
    color: theme.colors.muted,
    flexShrink: 1,
  },

  proposalMetaChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },

  proposalMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + "12",
    borderWidth: 1,
    borderColor: theme.colors.primary + "24",
  },

  proposalMetaChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text,
  },

  proposalMetaChipAccent: {
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
  },

  proposalMetaChipAccentText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  proposalInlineNote: {
    fontSize: 13,
    fontStyle: "italic",
    color: theme.colors.muted,
    marginTop: 8,
    paddingHorizontal: 2,
    lineHeight: 18,
  },

  proposalVoteCTABanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: isDark ? "rgba(212,155,22,0.14)" : "rgba(212,155,22,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,155,22,0.32)",
  },

  proposalVoteCTAText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#D49B16",
    lineHeight: 18,
  },

  proposalStatsPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  proposalStatPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },

  proposalStatPillYes: {
    backgroundColor: "rgba(45,185,131,0.10)",
    borderColor: "rgba(45,185,131,0.28)",
  },

  proposalStatPillNo: {
    backgroundColor: theme.colors.error + "10",
    borderColor: theme.colors.error + "28",
  },

  proposalStatPillPending: {
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
  },

  proposalStatPillValue: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    lineHeight: 22,
  },

  proposalStatPillLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: 1,
  },

  proposalStatPillPct: {
    fontSize: 10,
    fontWeight: "500",
    color: theme.colors.muted,
    marginTop: 1,
  },

  voteActionButtonYesPrimary: {
    backgroundColor: "#2DB983",
    borderColor: "#2DB983",
    flex: 2,
  },

  proposalMyVoteBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
  },

  proposalMyVoteBadgeYes: {
    backgroundColor: "rgba(45,185,131,0.10)",
    borderColor: "rgba(45,185,131,0.28)",
  },

  proposalMyVoteBadgeNo: {
    backgroundColor: theme.colors.error + "10",
    borderColor: theme.colors.error + "28",
  },

  proposalMyVoteBadgePending: {
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
  },

  proposalMyVoteBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  proposalRosterGrid: {
    gap: 6,
    marginTop: 8,
  },

  proposalRosterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
  },

  proposalRosterItemYes: {
    backgroundColor: "rgba(45,185,131,0.07)",
  },

  proposalRosterItemNo: {
    backgroundColor: theme.colors.error + "08",
  },

  proposalRosterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  proposalRosterAvatarYes: {
    backgroundColor: "rgba(45,185,131,0.20)",
  },

  proposalRosterAvatarNo: {
    backgroundColor: theme.colors.error + "20",
  },

  proposalRosterAvatarPending: {
    backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
  },

  proposalRosterAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },

  proposalRosterAvatarInitial: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
  },

  proposalRosterName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
  },

  proposalRosterVoteLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  proposalHeroCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.68)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.06)",
    gap: 12,
  },

  proposalHeroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  proposalHeroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: theme.colors.primary + "10",
  },

  proposalHeroMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
  },

  proposalSummaryGrid: {
    flexDirection: "row",
    gap: 8,
  },

  proposalSummaryCard: {
    flex: 1,
    minHeight: 94,
    borderRadius: 16,
    padding: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.06)",
    justifyContent: "space-between",
  },

  proposalSummaryCardPositive: {
    backgroundColor: theme.colors.accent + "14",
    borderColor: theme.colors.accent + "34",
  },

  proposalSummaryCardNegative: {
    backgroundColor: theme.colors.error + "14",
    borderColor: theme.colors.error + "34",
  },

  proposalSummaryCardNeutral: {
    backgroundColor: theme.colors.primary + "12",
    borderColor: theme.colors.primary + "28",
  },

  proposalSummaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  proposalSummaryValue: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 8,
  },

  proposalSummaryHint: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
    marginTop: 8,
  },

  proposalNoteCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(12,12,12,0.03)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.06)",
  },

  proposalNoteLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  proposalNoteText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
    marginTop: 6,
    lineHeight: 18,
  },

  proposalDecisionBlock: {
    marginTop: 14,
    borderRadius: 20,
    padding: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.06)",
  },

  proposalDecisionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
  },

  proposalDecisionText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: 6,
    lineHeight: 18,
  },

  proposalVoteMetricRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },

  proposalVoteMetricCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: "center",
  },

  proposalVoteMetricYes: {
    backgroundColor: theme.colors.accent + "14",
    borderColor: theme.colors.accent + "30",
  },

  proposalVoteMetricNo: {
    backgroundColor: theme.colors.error + "14",
    borderColor: theme.colors.error + "30",
  },

  proposalVoteMetricPending: {
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(12,12,12,0.04)",
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  proposalVoteMetricValue: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
  },

  proposalVoteMetricLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 4,
    textAlign: "center",
  },

  proposalVoteMetricPercent: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
    marginTop: 4,
  },

  activityProposalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  activityProposalTitleWrap: {
    flex: 1,
    gap: 4,
  },

  activityProposalGroup: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
  },

  activityProposalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
    lineHeight: 22,
  },

  activityProposalStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.primary + "18",
    borderWidth: 1,
    borderColor: theme.colors.primary + "40",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  activityProposalStatusText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  activityProposalMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: 4,
  },

  activityProposalContextText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
  },

  activityProposalActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },

  activityProposalSecondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.76)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  activityProposalSecondaryText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
  },

  groupsContainer: {
    flex: 1,
  },

  groupsListContainer: {
    flex: 1,
  },

  groupsList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },

  groupCard: {
    flexDirection: "row",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    alignItems: "center",
    gap: 12,
  },

  groupIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  groupImage: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
  },

  groupInfo: {
    flex: 1,
  },

  groupName: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
  },

  groupMembers: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: "700",
  },

  groupCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },

  groupActiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.primary + "16",
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
  },

  groupActiveBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  groupMiniMembersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },

  groupMiniMemberImage: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.card,
  },

  groupMiniMemberFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  groupMiniMemberMore: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.muted,
  },

  createGroupButton: {
    marginBottom: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  createGroupButtonIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  createGroupButtonCopy: {
    flex: 1,
  },

  createGroupButtonFloating: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  createGroupButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },

  createGroupButtonSubtitle: {
    marginTop: 2,
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "700",
  },

  createGroupForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  createGroupHeaderFields: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },

  createGroupFooter: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 22,
  },

  formLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 8,
  },

  createGroupMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  formHint: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
  },

  createGroupSelectedBadge: {
    marginTop: 2,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.primary + "16",
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
  },

  createGroupSelectedBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  groupNameInput: {
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },

  friendSelectList: {
    paddingVertical: 8,
  },

  friendSelectCard: {
    flexDirection: "row",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  friendSelectCardActive: {
    backgroundColor: theme.colors.primary + "22",
    borderColor: theme.colors.primary,
  },

  friendSelectContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  friendSelectName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  createButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  createButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },

  createButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },

  groupIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  groupImageLarge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
  },

  groupMembersCount: {
    fontSize: 14,
    color: theme.colors.muted,
    marginTop: 4,
  },

  groupMemberCard: {
    flex: 0.31,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  groupMembersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  groupMemberAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    backgroundColor: theme.colors.card,
  },

  groupMemberAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  groupMemberName: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
  },

  groupActionsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },

  groupDangerZone: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 18,
    padding: 16,
    backgroundColor: theme.colors.error + "14",
    borderWidth: 1,
    borderColor: theme.colors.error + "36",
  },

  groupDangerTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
  },

  groupDangerText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: 6,
  },

  groupDangerButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: theme.colors.error,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  groupDangerButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "white",
  },

  groupProposalSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  noProposalCard: {
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 18,
    padding: 14,
  },

  groupProposalList: {
    paddingBottom: 4,
    gap: 12,
  },

  proposalCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
  },

  chatRow: {
    width: "100%",
    marginBottom: 10,
  },

  chatRowMine: {
    alignItems: "flex-end",
  },

  chatRowOther: {
    alignItems: "flex-start",
  },

  chatBubble: {
    width: "92%",
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },

  chatBubbleMine: {
    backgroundColor: theme.colors.primary + "18",
    borderColor: theme.colors.primary + "66",
  },

  chatBubbleOther: {
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
  },

  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  chatAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },

  chatAuthorAvatar: {
    fontSize: 20,
  },

  chatAuthorImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
  },

  chatAuthorFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  chatAuthorName: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
  },

  chatAuthorMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: 2,
  },

  proposalStatus: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  proposalMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
    marginTop: 2,
  },

  voteBarTrack: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: theme.colors.border,
  },

  voteBarYes: {
    backgroundColor: theme.colors.accent,
    height: "100%",
  },

  voteBarNo: {
    backgroundColor: theme.colors.error,
    height: "100%",
  },

  voteBarPending: {
    backgroundColor: theme.colors.muted,
    height: "100%",
  },

  voteLegendRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  voteLegendItem: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
  },

  proposalVotes: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 10,
  },

  voteActionsRowGlobal: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },

  voteActionCopy: {
    flex: 1,
    alignItems: "flex-start",
  },

  proposalMembersWrap: {
    marginTop: 10,
    gap: 8,
  },

  proposalRosterSection: {
    marginTop: 16,
  },

  proposalRosterTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },

  proposalMemberCard: {
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 14,
    padding: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  proposalMemberCardYes: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + "16",
  },

  proposalMemberCardNo: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error + "14",
  },

  proposalMemberCardPending: {
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(12,12,12,0.03)",
  },

  proposalMemberIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 10,
  },

  proposalMemberDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  proposalMemberDotYes: {
    backgroundColor: theme.colors.accent,
  },

  proposalMemberDotNo: {
    backgroundColor: theme.colors.error,
  },

  proposalMemberDotPending: {
    backgroundColor: theme.colors.muted,
  },

  proposalMemberName: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text,
  },

  proposalMemberVote: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "700",
    marginTop: 2,
  },

  voteActionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.82)",
    flexDirection: "row",
    gap: 10,
  },

  voteActionButtonYes: {
    borderColor: theme.colors.accent + "22",
  },

  voteActionButtonNo: {
    borderColor: theme.colors.error + "22",
  },

  voteActionActiveYes: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + "22",
  },

  voteActionActiveNo: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error + "22",
  },

  voteActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
  },

  voteActionSubtext: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
    marginTop: 2,
  },

  bookFromVotesButton: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  bookFromVotesText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },

  cancelProposalButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)",
  },

  cancelProposalText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },

  groupActionButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  groupActionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  inviteList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  inviteCard: {
    flexDirection: "row",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  venueList: {
    paddingHorizontal: 0,
    paddingVertical: 8,
  },

  venueCard: {
    flexDirection: "row",
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },

  venueIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + "22",
    justifyContent: "center",
    alignItems: "center",
  },

  venueInfo: {
    flex: 1,
    marginHorizontal: 12,
  },

  venueName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  venuePrice: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },

  proposalIntroCard: {
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 18,
    padding: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    marginBottom: 12,
  },

  proposalIntroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  proposalIntroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 6,
  },

  proposalIntroText: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: "600",
    lineHeight: 18,
  },

  proposalStepCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.06)",
    marginBottom: 14,
  },

  proposalStepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },

  proposalStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  proposalStepBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "white",
  },

  proposalStepCopy: {
    flex: 1,
  },

  proposalStepText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: -2,
  },

  proposalPreviewPanel: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: theme.colors.primary + "10",
    borderWidth: 1,
    borderColor: theme.colors.primary + "22",
  },

  proposalPreviewTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  proposalPreviewMain: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 8,
  },

  proposalPreviewMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 6,
  },

  proposalPreviewHint: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: 8,
  },

  inlineLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  inlineLoadingText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  zoneListWrap: {
    gap: 10,
    marginBottom: 12,
  },

  zoneCard: {
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 16,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    padding: 12,
  },

  zoneCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  zoneCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },

  zoneCardMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.muted,
  },

  zoneHint: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },

  pricePreviewCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)",
    borderRadius: 16,
    padding: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.84)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  pricePreviewLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  pricePreviewValue: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
  },

  searchList: {
    paddingBottom: 16,
  },
});
