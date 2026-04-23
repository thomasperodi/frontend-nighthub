import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../../../theme/ThemeProvider";
import type { Event } from "../../../types/events";
import type { Reservation } from "../../../types/reservations";
import { fetchEventsByVenue } from "../../../services/events";
import { fetchReservationsByEvent } from "../../../services/reservations";
import { getMyVenuePrMembership, type MyPrNetworkMembership } from "../../../services/prNetwork";
import VenuePrNetworkTab from "../../venue/components/VenuePrNetworkTab";

type Props = {
  venueId?: string | null;
  preferredEventId?: string | null;
  showToast?: (msg: string) => void;
};

function readErrorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message) && message.length > 0) return String(message[0]);
  if (typeof message === "string" && message.trim().length > 0) return message;
  if (typeof error?.message === "string" && error.message.trim().length > 0) return error.message;
  return fallback;
}

export default function PrDashboardTab({ venueId, preferredEventId, showToast }: Props) {
  const { theme } = useTheme();

  const [accessLoading, setAccessLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [myMembership, setMyMembership] = useState<MyPrNetworkMembership["membership"]>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [venueEvents, setVenueEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);

  const loadAccess = useCallback(async () => {
    if (!venueId) {
      setCanAccess(false);
      setAccessLoading(false);
      return;
    }

    setAccessLoading(true);
    setAccessError(null);
    try {
      const result = await getMyVenuePrMembership(venueId);
      setCanAccess(Boolean(result?.can_access_dashboard));
      setCanManageTeam(Boolean(result?.can_manage_team));
      setMyMembership(result?.membership ?? null);
    } catch (error: any) {
      setCanAccess(false);
      setCanManageTeam(false);
      setMyMembership(null);
      setAccessError(readErrorMessage(error, "Non riesco a verificare i permessi PR."));
    } finally {
      setAccessLoading(false);
    }
  }, [venueId]);

  const loadEvents = useCallback(async () => {
    if (!venueId) {
      setVenueEvents([]);
      setSelectedEventId(null);
      return;
    }

    try {
      const events = await fetchEventsByVenue(venueId);
      setVenueEvents(events);
      setSelectedEventId((current) => {
        if (current && events.some((event) => event.id === current)) return current;
        if (preferredEventId && events.some((event) => event.id === preferredEventId)) {
          return preferredEventId;
        }
        return events[0]?.id ?? null;
      });
    } catch (error: any) {
      setVenueEvents([]);
      setSelectedEventId(null);
      setReservationsError(readErrorMessage(error, "Errore nel caricamento eventi del locale."));
    }
  }, [venueId, preferredEventId]);

  const loadReservations = useCallback(async (eventId: string | null) => {
    if (!eventId) {
      setReservations([]);
      setReservationsError(null);
      return;
    }

    setLoadingReservations(true);
    setReservationsError(null);
    try {
      const list = await fetchReservationsByEvent(eventId);
      setReservations(list);
    } catch (error: any) {
      setReservations([]);
      setReservationsError(readErrorMessage(error, "Errore nel caricamento prenotazioni evento."));
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  useEffect(() => {
    void loadAccess();
    void loadEvents();
  }, [loadAccess, loadEvents]);

  useEffect(() => {
    void loadReservations(selectedEventId);
  }, [selectedEventId, loadReservations]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadAccess(),
        loadEvents(),
        loadReservations(selectedEventId),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadAccess, loadEvents, loadReservations, selectedEventId]);

  const managementScope = useMemo(() => {
    if (!canManageTeam) return "none" as const;
    if (!myMembership) return "venue" as const;
    if (myMembership.role === "PR") return "none" as const;
    return "manager" as const;
  }, [canManageTeam, myMembership]);

  if (!venueId) {
    return (
      <View style={styles.centeredWrap}>
        <Feather name="alert-circle" size={22} color={theme.colors.error} />
        <Text style={[styles.centeredText, { color: theme.colors.error }]}>Locale non disponibile per dashboard PR.</Text>
      </View>
    );
  }

  if (accessLoading) {
    return (
      <View style={styles.centeredWrap}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={[styles.centeredText, { color: theme.colors.muted }]}>Verifica permessi dashboard PR...</Text>
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View style={styles.centeredWrap}>
        <Feather name="lock" size={22} color="#f59e0b" />
        <Text style={[styles.centeredText, { color: theme.colors.text }]}>Non hai ancora autorizzazione PR per questo locale.</Text>
        <Text style={[styles.centeredSubtext, { color: theme.colors.muted }]}>
          Chiedi al locale di aggiungerti nel PR network come responsabile, capo squadra o PR.
        </Text>
        {accessError ? (
          <Text style={[styles.centeredSubtext, { color: theme.colors.error }]}>{accessError}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <VenuePrNetworkTab
      venueId={venueId}
      canManageTeam={canManageTeam}
      managementScope={managementScope}
      managerMembershipId={myMembership?.id ?? null}
      managerRole={myMembership?.role ?? null}
      venueEvents={venueEvents}
      selectedEventId={selectedEventId}
      onSelectEventId={(eventId) => setSelectedEventId(eventId)}
      reservations={reservations}
      loading={loadingReservations}
      refreshing={refreshing}
      error={reservationsError}
      onRefresh={handleRefresh}
      onOpenReservations={() => {
        showToast?.("Le prenotazioni evento alimentano i KPI della dashboard PR.");
      }}
    />
  );
}

const styles = StyleSheet.create({
  centeredWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  centeredText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  centeredSubtext: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
});
