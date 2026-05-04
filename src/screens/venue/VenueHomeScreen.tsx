import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { NavItem } from "../../components/BottomNav";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { fetchEventsByVenue, fetchEventStats, fetchEventById } from "../../services/events";
import { fetchReservationsByEvent } from "../../services/reservations";
import { listHostessTables } from "../../services/hostess";
import { fetchVenueById } from "../../services/venues";

import EventsScreen from "./EventsScreen";
import ReportScreen from "./ReportsScreen"
import PromosScreen from "./PromosScreen";
import CreateReservationModal from "../../components/CreateReservationModal";
import ProfileScreen from "./ProfileScreen";
import VenueTablesScreen from "./VenueTablesScreen";
import VenueReservationsTab from "./components/VenueReservationsTab";
import VenueTransactionsScreen from "./VenueTransactionsScreen";
import VenuePricingTab from "./components/VenuePricingTab";
import VenuePrNetworkTab from "./components/VenuePrNetworkTab";

import { Event, EventStats } from "../../types/events";
import type { Reservation } from "../../types/reservations";

export default function VenueHomeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  type VenueTab =
    | 'dashboard'
    | 'reservations'
    | 'events'
    | 'tables'
    | 'pr_team'
    | 'promos'
    | 'analytics'
    | 'transactions'
    | 'profile'
    | 'pricing';

  const MORE_TABS = new Set<VenueTab>(['promos', 'analytics', 'transactions', 'profile', 'pricing', 'pr_team']);

  const [currentTab, setCurrentTab] = useState<VenueTab>("dashboard");
  const [moreOpen, setMoreOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestSeq = useRef(0);

  const normalizeEventStatus = (s?: unknown) => String(s ?? '').trim().toUpperCase();
  const parseEventDateMs = (d?: string) => {
    const ms = Date.parse(d ?? '');
    return Number.isNaN(ms) ? null : ms;
  };
  const formatEventDate = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
  };
  const formatClockTime = (value?: string) => {
    if (!value) return '--:--';
    const [hours = '--', minutes = '--'] = value.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

  const getStatusPalette = (status?: unknown) => {
    const normalized = normalizeEventStatus(status);
    if (normalized === 'LIVE') {
      return {
        label: 'Live',
        color: '#FF6B6B',
        soft: 'rgba(255,107,107,0.14)',
        border: 'rgba(255,107,107,0.28)',
      };
    }
    if (normalized === 'DRAFT') {
      return {
        label: 'Draft',
        color: '#F4C95D',
        soft: 'rgba(244,201,93,0.14)',
        border: 'rgba(244,201,93,0.3)',
      };
    }
    if (normalized === 'CLOSED') {
      return {
        label: 'Closed',
        color: '#94A3B8',
        soft: 'rgba(148,163,184,0.14)',
        border: 'rgba(148,163,184,0.24)',
      };
    }
    return {
      label: 'Offline',
      color: '#9CA3AF',
      soft: 'rgba(156,163,175,0.14)',
      border: 'rgba(156,163,175,0.2)',
    };
  };

  const toNumberSafe = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.');
      const parsed = parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const formatMoney = (value: any): string => {
    const n = toNumberSafe(value);
    if (n === null) return '—';
    return `€${n.toFixed(2)}`;
  };
  
  // Dashboard state
  const [liveEvent, setLiveEvent] = useState<Event | null>(null);
  const [venueEvents, setVenueEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventReservations, setSelectedEventReservations] = useState<Reservation[]>([]);
  const [selectedReservationsLoading, setSelectedReservationsLoading] = useState(false);
  const [selectedReservationsRefreshing, setSelectedReservationsRefreshing] = useState(false);
  const [selectedReservationsError, setSelectedReservationsError] = useState<string | null>(null);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [eventStats, setEventStats] = useState<EventStats>({
    event_id: '',
    total_entries: 0,
    total_entries_revenue: 0,
    total_bar: 0,
    total_cloakroom: 0,
    total_tables: 0,
  });
  const [hostessTables, setHostessTables] = useState<any[]>([]);
  const [eventReservations, setEventReservations] = useState<Reservation[]>([]);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetDashboardState = () => {
    setEventStats({
      event_id: '',
      total_entries: 0,
      total_entries_revenue: 0,
      total_bar: 0,
      total_cloakroom: 0,
      total_tables: 0,
    });
    setHostessTables([]);
    setEventReservations([]);
  };

  const pickDefaultEventId = (events: Event[]): string | null => {
    if (events.length === 0) return null;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const live = events
      .filter((e) => normalizeEventStatus(e.status) === 'LIVE')
      .sort((a, b) => (parseEventDateMs(b.date) ?? 0) - (parseEventDateMs(a.date) ?? 0))[0];
    if (live?.id) return live.id;

    const upcoming = events
      .filter((e) => {
        const ms = parseEventDateMs(e.date);
        if (ms === null) return false;
        const st = normalizeEventStatus(e.status);
        if (st === 'CLOSED') return false;
        return ms >= todayMs;
      })
      .sort((a, b) => (parseEventDateMs(a.date) ?? Number.POSITIVE_INFINITY) - (parseEventDateMs(b.date) ?? Number.POSITIVE_INFINITY))[0];
    if (upcoming?.id) return upcoming.id;

    const latest = [...events].sort((a, b) => (parseEventDateMs(b.date) ?? 0) - (parseEventDateMs(a.date) ?? 0))[0];
    return latest?.id ?? null;
  };

  const getSelectedEvent = (): Event | null => {
    if (!selectedEventId) return null;
    return venueEvents.find((e) => e.id === selectedEventId) ?? null;
  };

  const selectedEvent = useMemo(() => getSelectedEvent(), [selectedEventId, venueEvents]);

  const loadReservationsForSelectedEvent = async (opts?: { refreshing?: boolean }) => {
    const eventId = selectedEventId;
    if (!eventId) {
      setSelectedEventReservations([]);
      setSelectedReservationsError(null);
      return;
    }

    try {
      if (opts?.refreshing) setSelectedReservationsRefreshing(true);
      else setSelectedReservationsLoading(true);
      setSelectedReservationsError(null);

      const list = await fetchReservationsByEvent(eventId);
      setSelectedEventReservations(Array.isArray(list) ? list : []);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.message || 'Impossibile caricare le prenotazioni';
      const isConnectivityIssue =
        !e?.response ||
        typeof msg === 'string' &&
          (msg.toLowerCase().includes('network error') ||
            msg.toLowerCase().includes('server has closed the connection') ||
            msg.toLowerCase().includes('database server'));
      const suffix = isConnectivityIssue
        ? ' Problema temporaneo di rete/database: mantengo i dati correnti finche il server non torna disponibile.'
        : '';
      setSelectedReservationsError(
        `${status ? `${msg} (${status})` : msg}${suffix}`,
      );

      if (!isConnectivityIssue) {
        setSelectedEventReservations([]);
      }
    } finally {
      setSelectedReservationsLoading(false);
      setSelectedReservationsRefreshing(false);
    }
  };

  const loadDashboardData = async () => {
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      setError(null);

      if (!user?.venue_id) {
        setError("Venue ID non trovato");
        setLiveEvent(null);
        resetDashboardState();
        return;
      }

      const venueId = user.venue_id;

      // Venue info (best-effort)
      try {
        const v = await fetchVenueById(venueId);
        if (requestSeq.current === seq) setVenueName(v?.name ?? null);
      } catch {
        // ignore
      }

      // 1) Fetch ALL events for this venue (also pre-live)
      let events: Event[] = [];
      try {
        events = await fetchEventsByVenue(venueId);
      } catch (e: any) {
        const status = e?.response?.status;
        const msg = e?.message || 'Errore nel caricamento eventi';
        setError(status ? `${msg} (${status})` : msg);
        setVenueEvents([]);
        setSelectedEventId(null);
        setLiveEvent(null);
        resetDashboardState();
        return;
      }

      if (requestSeq.current !== seq) return;
      setVenueEvents(Array.isArray(events) ? events : []);

      const liveEvents = (Array.isArray(events) ? events : [])
        .filter((e) => normalizeEventStatus(e.status) === 'LIVE')
        .sort((a, b) => (parseEventDateMs(b.date) ?? 0) - (parseEventDateMs(a.date) ?? 0));
      const live = liveEvents[0] ?? null;
      setLiveEvent(live);

      const effectiveSelectedEventId = (() => {
        const current = selectedEventId;
        const exists = current ? events.some((e) => e.id === current) : false;
        return exists ? (current as string) : (pickDefaultEventId(events) as string | null);
      })();
      setSelectedEventId(effectiveSelectedEventId);

      // 2) Fetch data for selected event (works also pre-live)
      if (effectiveSelectedEventId) {
        const wantsHostessTables = Boolean(live?.id && live.id === effectiveSelectedEventId);

        const settled = await Promise.allSettled([
          fetchEventById(effectiveSelectedEventId),
          fetchEventStats(effectiveSelectedEventId),
          fetchReservationsByEvent(effectiveSelectedEventId),
          wantsHostessTables ? listHostessTables({ eventId: effectiveSelectedEventId, venueId }) : Promise.resolve([]),
        ]);

        const [eventDetailRes, statsRes, reservationsRes, tablesRes] = settled;

        if (requestSeq.current !== seq) return;

        if (eventDetailRes.status === 'fulfilled' && eventDetailRes.value) {
          const eventDetail = eventDetailRes.value;
          setVenueEvents((prev) =>
            prev.map((evt) => (evt.id === eventDetail.id ? { ...evt, ...eventDetail } : evt)),
          );
          if (live?.id === eventDetail.id) {
            setLiveEvent((prev) => (prev?.id === eventDetail.id ? { ...prev, ...eventDetail } : prev));
          }
        }

        if (statsRes.status === 'fulfilled') {
          setEventStats(statsRes.value);
        } else {
          console.error('fetchEventStats error', statsRes.reason);
          setError((prev) => prev ?? 'Impossibile caricare le statistiche evento');
          setEventStats({
            event_id: effectiveSelectedEventId,
            total_entries: 0,
            total_entries_revenue: 0,
            total_bar: 0,
            total_cloakroom: 0,
            total_tables: 0,
          });
        }

        if (reservationsRes.status === 'fulfilled') {
          setEventReservations(reservationsRes.value);
        } else {
          console.error('fetchReservationsByEvent error', reservationsRes.reason);
          setError((prev) => prev ?? 'Impossibile caricare le prenotazioni');
          setEventReservations([]);
        }

        if (tablesRes.status === 'fulfilled') {
          setHostessTables(Array.isArray(tablesRes.value) ? tablesRes.value : []);
        } else {
          console.error('listHostessTables error', tablesRes.reason);
          // Questo endpoint è /staff/*: potrebbe essere vietato per ruolo VENUE.
          setError((prev) => prev ?? 'Impossibile caricare i tavoli (permessi mancanti?)');
          setHostessTables([]);
        }
      } else {
        // Evita di mostrare dati "stale" dell'ultimo evento caricato
        resetDashboardState();
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      if (requestSeq.current === seq) setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab !== 'reservations' && currentTab !== 'pr_team') return;
    if (!selectedEventId) return;
    void loadReservationsForSelectedEvent();
  }, [currentTab, selectedEventId]);

  useEffect(() => {
    loadDashboardData();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [user?.venue_id]);

  useEffect(() => {
    // se cambio tab, evito refresh inutili
    if (currentTab !== 'dashboard') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } else {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => loadDashboardData(), 30000);
      }
    }
  }, [currentTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Helper per convertire in modo sicuro i valori numerici
  const toNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const getTotalRevenue = (): number => {
    const entryRevenue = toNumber(eventStats?.total_entries_revenue);
    const bar = toNumber(eventStats?.total_bar);
    const tables = toNumber(eventStats?.total_tables);
    const cloakroom = toNumber(eventStats?.total_cloakroom);
    return entryRevenue + bar + tables + cloakroom;
  };


  const getTablesStats = () => {
    const completi = hostessTables.filter(t => toNumber(t.entrati) >= toNumber(t.prenotati)).length;
    const totalePersone = hostessTables.reduce((sum, t) => sum + toNumber(t.entrati), 0);
    return { completi, totalePersone, totale: hostessTables.length };
  };

  const selectedEventPalette = getStatusPalette(selectedEvent?.status);
  const tablesStats = useMemo(() => getTablesStats(), [hostessTables]);
  const tableReservations = useMemo(
    () => eventReservations.filter((reservation) => reservation.type === 'table'),
    [eventReservations],
  );
  const pendingReservationsCount = useMemo(
    () => tableReservations.filter((reservation) => reservation.status === 'pending').length,
    [tableReservations],
  );
  const confirmedReservationsCount = useMemo(
    () => tableReservations.filter((reservation) => reservation.status === 'confirmed').length,
    [tableReservations],
  );
  const unattendedTablesCount = Math.max(tablesStats.totale - tablesStats.completi, 0);
  const activeIssuesCount = [pendingReservationsCount > 0, unattendedTablesCount > 0, Boolean(error)].filter(Boolean).length;
  const nextAction = useMemo(() => {
    if (!selectedEvent) {
      return {
        time: '--:--',
        label: 'Nessuna azione pianificata',
        detail: 'Seleziona o crea un evento per attivare il controllo operativo.',
      };
    }

    if (selectedEvent.start_time) {
      return {
        time: formatClockTime(selectedEvent.start_time),
        label: selectedEvent.access_mode === 'PRE_SALE' ? 'Controllo pre-sale' : 'Apertura ingressi',
        detail: selectedEvent.access_mode === 'PRE_SALE'
          ? 'Verifica prezzi e capienza prima del picco di affluenza.'
          : 'Monitora ingressi e tavoli all’avvio della serata.',
      };
    }

    return {
      time: formatEventDate(selectedEvent.date),
      label: 'Allineamento dashboard',
      detail: 'Controlla prenotazioni, tavoli e flussi prima dell’apertura.',
    };
  }, [selectedEvent]);

  const businessItems: NavItem[] = [
    { key: "dashboard", icon: "home", label: "Home" },
    { key: "reservations", icon: "bookmark", label: "Prenotazioni" },
    { key: "events", icon: "calendar", label: "Eventi" },
    { key: "tables", icon: "grid", label: "Tavoli" },
    { key: "more", icon: "more-horizontal", label: "Altro" },
  ];

  const handleBottomNavChange = (key: string) => {
    if (key === 'more') {
      setMoreOpen(true);
      return;
    }
    setCurrentTab(key as VenueTab);
  };

  const openTabFromMore = (tab: VenueTab) => {
    setMoreOpen(false);
    setCurrentTab(tab);
  };

const renderDashboard = () => (
  <ScrollView
    style={styles.dashboardScroll}
    contentContainerStyle={styles.dashboardContent}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
  >
    <View style={styles.heroShell}>
      <View style={[styles.heroGlow, { backgroundColor: selectedEventPalette.color }]} />
      <View style={[styles.heroCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroEyebrowRow}>
            <View style={[styles.livePulseWrap, { backgroundColor: selectedEventPalette.soft, borderColor: selectedEventPalette.border }]}>
              <View style={[styles.livePulseDot, { backgroundColor: selectedEventPalette.color }]} />
            </View>
            <Text style={[styles.heroEyebrow, { color: theme.colors.muted }]}>
              {selectedEvent ? `${selectedEventPalette.label.toUpperCase()} CONTROL` : 'VENUE CONTROL'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.heroIconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => setCurrentTab('profile')}
          >
            <Feather name="settings" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
          {selectedEvent?.name ?? venueName ?? 'Venue Dashboard'}
        </Text>
        <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>
          {selectedEvent
            ? `${formatEventDate(selectedEvent.date)} • ${selectedEvent.access_mode === 'PRE_SALE' ? 'Pre-sale attiva' : 'Monitor operativo serata'}`
            : venueEvents.length > 0
              ? 'Controlla gli eventi programmati e apri il flusso operativo.'
              : 'Configura il primo evento e usa la dashboard per coordinare prenotazioni e tavoli.'}
        </Text>

        <View style={styles.heroStatsGrid}>
          <KpiCard
            label="Ingressi live"
            value={String(eventStats?.total_entries || 0)}
            caption="persone registrate"
            icon="users"
            color="#FF6B6B"
          />
          <KpiCard
            label="Revenue live"
            value={formatMoney(getTotalRevenue())}
            caption="incasso complessivo"
            icon="dollar-sign"
            color="#7EE081"
          />
          <KpiCard
            label="Tavoli attivi"
            value={String(tablesStats.totale)}
            caption={`${tablesStats.completi} completi`}
            icon="grid"
            color="#8B7BFF"
          />
          <KpiCard
            label="Pending"
            value={String(pendingReservationsCount)}
            caption="prenotazioni da gestire"
            icon="clock"
            color="#F4C95D"
          />
        </View>
      </View>
    </View>

    {loading && !selectedEvent ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.muted }]}>Caricamento dati...</Text>
      </View>
    ) : error && !selectedEvent ? (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color={theme.colors.error} />
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={onRefresh}>
          <Text style={styles.retryText}>Riprova</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <>
        {error && (
          <View style={[styles.inlineErrorBanner, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.24)' }]}>
            <Feather name="alert-triangle" size={16} color="#f59e0b" />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Operational triage</Text>
            <View style={styles.sectionCounterRow}>
              <View style={[styles.counterDot, { backgroundColor: activeIssuesCount > 0 ? '#FF6B6B' : '#7EE081' }]} />
              <Text style={[styles.sectionCounterText, { color: theme.colors.muted }]}>{activeIssuesCount} attivi</Text>
            </View>
          </View>

          <TriageCard
            title={`${pendingReservationsCount} prenotazioni in attesa`}
            subtitle={pendingReservationsCount > 0 ? 'Richiedono conferma o revisione rapida.' : 'Nessuna conferma bloccata al momento.'}
            badgeLabel={pendingReservationsCount > 0 ? 'Review' : 'Clear'}
            icon="bookmark"
            color="#FF6B6B"
            onPress={() => setCurrentTab('reservations')}
          />
          <TriageCard
            title={`${unattendedTablesCount} tavoli da completare`}
            subtitle={tablesStats.totale > 0 ? 'Controlla i tavoli con ingressi ancora incompleti.' : 'Nessun tavolo hostess attivo per questo evento.'}
            badgeLabel={tablesStats.totale > 0 ? 'Assign' : 'Idle'}
            icon="grid"
            color="#F4C95D"
            onPress={() => setCurrentTab('tables')}
          />
          <TriageCard
            title={`${confirmedReservationsCount} confermate`}
            subtitle={selectedEvent ? `${formatEventDate(selectedEvent.date)} • ${selectedEvent.name}` : 'Seleziona un evento per aprire il dettaglio.'}
            badgeLabel="Event"
            icon="calendar"
            color="#8B7BFF"
            onPress={() => setCurrentTab('events')}
          />
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Next scheduled action</Text>
          <View style={[styles.nextActionCard, { backgroundColor: theme.colors.surface, borderColor: selectedEventPalette.border }]}>
            <View style={[styles.nextActionAccent, { backgroundColor: selectedEventPalette.color }]} />
            <View style={styles.nextActionTimeWrap}>
              <Text style={[styles.nextActionTime, { color: selectedEventPalette.color }]}>{nextAction.time}</Text>
              <Text style={[styles.nextActionTimeLabel, { color: theme.colors.muted }]}>focus</Text>
            </View>
            <View style={styles.nextActionBody}>
              <Text style={[styles.nextActionTitle, { color: theme.colors.text }]}>{nextAction.label}</Text>
              <Text style={[styles.nextActionText, { color: theme.colors.muted }]}>{nextAction.detail}</Text>
            </View>
            <TouchableOpacity
              style={[styles.nextActionButton, { backgroundColor: selectedEventPalette.color }]}
              onPress={() => setCurrentTab(selectedEvent ? 'events' : 'reservations')}
            >
              <Feather name="check" size={18} color="#0B0B0B" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Quick actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              icon="user-plus"
              label="Nuova prenotazione"
              onPress={() => {
                if (!selectedEventId) {
                  setCurrentTab('events');
                  return;
                }
                setBookingVisible(true);
              }}
            />
            <QuickActionCard icon="bookmark" label="Prenotazioni" onPress={() => setCurrentTab('reservations')} />
            <QuickActionCard icon="calendar" label="Eventi" onPress={() => setCurrentTab('events')} />
            <QuickActionCard icon="bar-chart-2" label="Report" onPress={() => setCurrentTab('analytics')} />
            <QuickActionCard icon="users" label="PR Team" onPress={() => setCurrentTab('pr_team')} />
          </View>
        </View>

        {selectedEvent ? (
          <>
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeadingRow}>
                <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Revenue channels</Text>
                <TouchableOpacity onPress={() => setCurrentTab('transactions')}>
                  <Text style={[styles.sectionLink, { color: theme.colors.text }]}>Transazioni</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.metricGrid}>
                <MetricStrip label="Ingresso" value={formatMoney(eventStats?.total_entries_revenue)} accent="#7EE081" />
                <MetricStrip label="Bar" value={formatMoney(eventStats?.total_bar)} accent="#67B7FF" />
                <MetricStrip label="Tavoli" value={formatMoney(eventStats?.total_tables)} accent="#8B7BFF" />
                <MetricStrip label="Guardaroba" value={formatMoney(eventStats?.total_cloakroom)} accent="#F4C95D" />
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeadingRow}>
                <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Table reservations</Text>
                <TouchableOpacity onPress={() => setCurrentTab('reservations')}>
                  <Text style={[styles.sectionLink, { color: theme.colors.text }]}>Apri elenco</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.reservationsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.resSummaryHeader}>
                  <View style={styles.resSummaryBlock}>
                    <Text style={[styles.resSummaryText, { color: theme.colors.text }]}>
                      {`${formatEventDate(selectedEvent.date)} • ${selectedEvent.name}`}
                    </Text>
                    <Text style={[styles.resSummarySubText, { color: theme.colors.muted }]}>
                      Prenotazioni: {tableReservations.length} • Ospiti: {tableReservations.reduce((sum, reservation) => sum + (reservation.guests || 0), 0)}
                    </Text>
                  </View>
                  <TouchableOpacity style={[styles.smallButton, { backgroundColor: selectedEventPalette.color }]} onPress={() => setCurrentTab('reservations')}>
                    <Text style={styles.smallButtonText}>Vedi</Text>
                  </TouchableOpacity>
                </View>

                {tableReservations.slice(0, 3).map((reservation) => {
                  const label = reservation.venue_table?.numero
                    ? `Tavolo ${reservation.venue_table.numero}`
                    : reservation.venue_table?.nome
                      ? reservation.venue_table.nome
                      : 'Tavolo';
                  const zone = reservation.venue_table?.zona ? ` • ${reservation.venue_table.zona}` : '';
                  const time = reservation.created_at ? ` • ${new Date(reservation.created_at).toLocaleTimeString().slice(0, 5)}` : '';
                  const badgeStyle = reservation.status === 'confirmed'
                    ? styles.badgeConfirmed
                    : reservation.status === 'pending'
                      ? styles.badgePending
                      : styles.badgeCancelled;

                  return (
                    <View key={reservation.id} style={styles.resRow}>
                      <View style={[styles.resIconWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <Feather name="calendar" size={16} color={theme.colors.text} />
                      </View>
                      <View style={styles.resContent}>
                        <Text style={[styles.resRowText, { color: theme.colors.text }]}>{label}{zone}</Text>
                        <Text style={[styles.resRowSubText, { color: theme.colors.muted }]}>{reservation.guests} ospiti{time}</Text>
                      </View>
                      <Text style={[styles.statusBadge, badgeStyle]}>{reservation.status}</Text>
                    </View>
                  );
                })}

                {tableReservations.length === 0 && (
                  <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>Nessuna prenotazione tavolo per l’evento selezionato.</Text>
                )}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Event spotlight</Text>
              <View style={[styles.eventCard, { backgroundColor: theme.colors.surface, borderColor: selectedEventPalette.border }]}>
                <View style={[styles.eventBadge, { backgroundColor: selectedEventPalette.soft, borderColor: selectedEventPalette.border }]}>
                  <View style={[styles.statusDot, { backgroundColor: selectedEventPalette.color }]} />
                  <Text style={[styles.eventBadgeText, { color: selectedEventPalette.color }]}>{selectedEventPalette.label}</Text>
                </View>
                <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{selectedEvent.name}</Text>
                <Text style={[styles.eventSubtitle, { color: theme.colors.muted }]}>
                  {formatEventDate(selectedEvent.date)}
                  {selectedEvent.start_time ? ` • ${formatClockTime(selectedEvent.start_time)}` : ''}
                </Text>
                <Text style={[styles.eventDescription, { color: theme.colors.muted }]}>
                  {selectedEvent.access_mode === 'PRE_SALE'
                    ? 'Evento gestito con pre-sale: monitora capienza, pricing e accessi.'
                    : 'Flusso standard attivo: controlla ingressi, tavoli e conferme live.'}
                </Text>
                <View style={styles.eventActionRow}>
                  <TouchableOpacity style={[styles.eventPrimaryButton, { backgroundColor: selectedEventPalette.color }]} onPress={() => setCurrentTab('events')}>
                    <Text style={styles.eventPrimaryButtonText}>Gestisci evento</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.eventSecondaryButton, { borderColor: theme.colors.border }]} onPress={() => setCurrentTab('pricing')}>
                    <Text style={[styles.eventSecondaryButtonText, { color: theme.colors.text }]}>Prezzi</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        ) : !loading && (
          <View style={[styles.noEventContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.noEventIconWrap}>
              <Feather name="calendar" size={28} color={theme.colors.text} />
            </View>
            {venueEvents.length > 0 ? (
              <>
                <Text style={[styles.noEventTitle, { color: theme.colors.text }]}>Nessun evento attivo</Text>
                <Text style={[styles.noEventText, { color: theme.colors.muted }]}>Apri le prenotazioni o vai negli eventi per scegliere quale monitorare.</Text>
                <View style={styles.emptyActionsRow}>
                  <TouchableOpacity style={[styles.emptyPrimaryButton, { backgroundColor: theme.colors.primary }]} onPress={() => setCurrentTab('reservations')}>
                    <Text style={styles.emptyPrimaryButtonText}>Prenotazioni</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.emptySecondaryButton, { borderColor: theme.colors.border }]} onPress={() => setCurrentTab('events')}>
                    <Text style={[styles.emptySecondaryButtonText, { color: theme.colors.text }]}>Eventi</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.noEventTitle, { color: theme.colors.text }]}>Nessun evento configurato</Text>
                <Text style={[styles.noEventText, { color: theme.colors.muted }]}>Crea il primo evento per attivare dashboard, prenotazioni e pricing operativo.</Text>
                <TouchableOpacity style={[styles.emptyPrimaryButton, { backgroundColor: theme.colors.primary }]} onPress={() => setCurrentTab('events')}>
                  <Text style={styles.emptyPrimaryButtonText}>Nuovo evento</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </>
    )}
  </ScrollView>
);

const renderReservations = () => (
  <VenueReservationsTab
    venueEvents={venueEvents}
    selectedEventId={selectedEventId}
    onSelectEventId={setSelectedEventId}
    selectedEventReservations={selectedEventReservations}
    loading={selectedReservationsLoading}
    refreshing={selectedReservationsRefreshing}
    error={selectedReservationsError}
    onRefresh={loadReservationsForSelectedEvent}
    onOpenCreateReservation={() => {
      if (!selectedEventId) return;
      setBookingVisible(true);
    }}
    onGoToEvents={() => setCurrentTab('events')}
  />
);

const renderEvents = () => (
  <>
    <EventsScreen
      venueId={user?.venue_id}
      onSelectEvent={(e) => {
        setSelectedEventId(e.id);
        setCurrentTab('reservations');
      }}
    />
  </>
);

const renderAnalytics = () => (
  <>
    {/* <Feather name="bar-chart-2" size={48} color={theme.colors.muted} />
    <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>Report & Analisi</Text>
    <Text style={[styles.placeholderText, { color: theme.colors.muted }]}>
      Visualizza statistiche e report dettagliati
    </Text> */}
    <ReportScreen venueId={user?.venue_id} selectedEvent={selectedEvent} eventStats={eventStats} />
  </>
);

const renderPromos = () => (
  <>
    <PromosScreen event={selectedEvent ?? liveEvent} venueId={user?.venue_id} />
  </>
);

const renderTables = () => (
  <>
    <VenueTablesScreen venueId={user?.venue_id} />
  </>
);

const renderProfile = () => (
  <>
    {/* <Feather name="user" size={48} color={theme.colors.muted} />
    <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>Profilo Locale</Text>
    <Text style={[styles.placeholderText, { color: theme.colors.muted }]}>
      Gestisci le informazioni e impostazioni del locale
    </Text> */}
    <ProfileScreen />
  </>
);

const renderTransactions = () => (
  <>
    <VenueTransactionsScreen />
  </>
);

const renderPricing = () => (
  <>
    <VenuePricingTab venueId={user?.venue_id ?? undefined} />
  </>
);

const renderPrTeam = () => (
  <>
    <VenuePrNetworkTab
      venueId={user?.venue_id ?? undefined}
      managementScope="venue"
      venueEvents={venueEvents}
      selectedEventId={selectedEventId}
      onSelectEventId={setSelectedEventId}
      reservations={selectedEventReservations}
      loading={selectedReservationsLoading}
      refreshing={selectedReservationsRefreshing}
      error={selectedReservationsError}
      onRefresh={() => loadReservationsForSelectedEvent({ refreshing: true })}
      onOpenReservations={() => setCurrentTab('reservations')}
    />
  </>
);

  function KpiCard({ label, value, icon, color, caption }: any) {
    return (
      <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[styles.kpiIconBg, { backgroundColor: `${color}1F`, borderColor: `${color}35` }]}>
          <Feather name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.kpiLabel, { color }]}>{label}</Text>
        <Text style={[styles.kpiValue, { color: theme.colors.text }]}>{value}</Text>
        <Text style={[styles.kpiCaption, { color: theme.colors.muted }]}>{caption}</Text>
      </View>
    );
  }

  function QuickActionCard({ icon, label, onPress }: any) {
    return (
      <TouchableOpacity style={[styles.quickActionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={onPress}>
        <View style={[styles.quickActionIconWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Feather name={icon} size={20} color={theme.colors.text} />
        </View>
        <Text style={[styles.quickActionLabel, { color: theme.colors.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  function TriageCard({ title, subtitle, badgeLabel, icon, color, onPress }: any) {
    return (
      <TouchableOpacity style={[styles.triageCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={onPress}>
        <View style={styles.triageContentRow}>
          <View style={[styles.triageIconWrap, { backgroundColor: `${color}16`, borderColor: `${color}28` }]}>
            <Feather name={icon} size={18} color={color} />
          </View>
          <View style={styles.triageTextBlock}>
            <Text style={[styles.triageTitle, { color: theme.colors.text }]}>{title}</Text>
            <Text style={[styles.triageSubtitle, { color: theme.colors.muted }]}>{subtitle}</Text>
          </View>
        </View>
        <View style={[styles.triageBadge, { backgroundColor: `${color}16`, borderColor: `${color}28` }]}>
          <Text style={[styles.triageBadgeText, { color }]}>{badgeLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function MetricStrip({ label, value, accent }: any) {
    return (
      <View style={[styles.metricStrip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={[styles.metricStripAccent, { backgroundColor: accent }]} />
        <Text style={[styles.metricStripLabel, { color: theme.colors.muted }]}>{label}</Text>
        <Text style={[styles.metricStripValue, { color: theme.colors.text }]}>{value}</Text>
      </View>
    );
  }

return (
  <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
    {/* Renderizza il contenuto in base al tab attivo */}
    {currentTab === "dashboard" && renderDashboard()}
    {currentTab === "reservations" && renderReservations()}
    {currentTab === "events" && renderEvents()}
    {currentTab === "tables" && renderTables()}
    {currentTab === "promos" && renderPromos()}
    {currentTab === "analytics" && renderAnalytics()}
    {currentTab === "transactions" && renderTransactions()}
    {currentTab === "pricing" && renderPricing()}
    {currentTab === "pr_team" && renderPrTeam()}
    {currentTab === "profile" && renderProfile()}

    <Modal
      visible={moreOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setMoreOpen(false)}
    >
      <Pressable style={styles.moreBackdrop} onPress={() => setMoreOpen(false)}>
        <Pressable style={[styles.moreSheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => {}}>
          <View style={styles.moreHeader}>
            <View style={styles.moreHeadingWrap}>
              <Text style={[styles.moreEyebrow, { color: theme.colors.muted }]}>Navigation hub</Text>
              <Text style={[styles.moreTitle, { color: theme.colors.text }]}>Altro</Text>
            </View>
            <TouchableOpacity onPress={() => setMoreOpen(false)} style={styles.moreCloseBtn}>
              <Feather name="x" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.moreSubtitle, { color: theme.colors.muted }]}>Apri le aree secondarie del gestionale senza uscire dal flusso operativo della serata.</Text>

          <TouchableOpacity
            style={[styles.moreRow, { borderColor: theme.colors.border }]}
            onPress={() => openTabFromMore('promos')}
          >
            <Feather name="tag" size={18} color={theme.colors.text} />
            <Text style={[styles.moreRowText, { color: theme.colors.text }]}>Promozioni</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.moreRow, { borderColor: theme.colors.border }]}
            onPress={() => openTabFromMore('analytics')}
          >
            <Feather name="bar-chart-2" size={18} color={theme.colors.text} />
            <Text style={[styles.moreRowText, { color: theme.colors.text }]}>Report</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.moreRow, { borderColor: theme.colors.border }]}
            onPress={() => openTabFromMore('transactions')}
          >
            <Feather name="credit-card" size={18} color={theme.colors.text} />
            <Text style={[styles.moreRowText, { color: theme.colors.text }]}>Transazioni</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.moreRow, { borderColor: theme.colors.border }]}
            onPress={() => openTabFromMore('pricing')}
          >
            <Feather name="sliders" size={18} color={theme.colors.text} />
            <Text style={[styles.moreRowText, { color: theme.colors.text }]}>Prezzi</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.moreRow, { borderColor: theme.colors.border }]}
            onPress={() => openTabFromMore('pr_team')}
          >
            <Feather name="users" size={18} color={theme.colors.text} />
            <Text style={[styles.moreRowText, { color: theme.colors.text }]}>PR Team</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.moreRow, { borderColor: theme.colors.border }]}
            onPress={() => openTabFromMore('profile')}
          >
            <Feather name="user" size={18} color={theme.colors.text} />
            <Text style={[styles.moreRowText, { color: theme.colors.text }]}>Profilo</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>

    <BottomNav items={businessItems} active={MORE_TABS.has(currentTab) ? 'more' : currentTab} onChange={handleBottomNavChange} />

    {/* Table Booking Modal */}
    {(selectedEvent ?? liveEvent) && user?.id && (
      <CreateReservationModal
        visible={bookingVisible}
        onClose={() => setBookingVisible(false)}
        event={selectedEvent ?? liveEvent}
        eventId={(selectedEvent ?? liveEvent)!.id}
        defaultDate={(selectedEvent ?? liveEvent)!.date}
        userId={user.id}
        venueId={user?.venue_id ?? undefined}
          onCreated={async () => {
            // Aggiorna in automatico la lista prenotazioni (tab Prenotazioni)
            await loadReservationsForSelectedEvent({ refreshing: true });

            // Best-effort: aggiorna anche dashboard/metriche, se serve
            await onRefresh();
          }}
      />
    )}
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  dashboardScroll: { flex: 1 },
  dashboardContent: {
    paddingBottom: 132,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 18,
  },
  heroShell: {
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: 8,
    right: 14,
    width: 132,
    height: 132,
    borderRadius: 999,
    opacity: 0.14,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    gap: 18,
    overflow: 'hidden',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 12,
  },
  livePulseWrap: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  heroIconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    maxWidth: '92%',
  },
  heroStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  inlineErrorBanner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineErrorText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  counterDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  sectionCounterText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '800',
  },
  kpiCard: {
    width: "48%",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    minHeight: 128,
    gap: 10,
  },
  kpiIconBg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  kpiValue: {
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  kpiCaption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  triageCard: {
    flexDirection: "row", 
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
  },
  triageContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  triageIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  triageTextBlock: {
    flex: 1,
    gap: 3,
  },
  triageTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  triageSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  triageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  triageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nextActionCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  nextActionAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  nextActionTimeWrap: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    minWidth: 76,
  },
  nextActionTime: {
    fontSize: 18,
    fontWeight: '900',
  },
  nextActionTimeLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  nextActionBody: {
    flex: 1,
    gap: 4,
  },
  nextActionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  nextActionText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  nextActionButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: '48%',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    gap: 10,
  },
  quickActionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 16,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricStrip: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  metricStripAccent: {
    width: 28,
    height: 4,
    borderRadius: 999,
  },
  metricStripLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricStripValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },

  reservationsCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  resSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resSummaryBlock: {
    flex: 1,
    gap: 4,
  },
  resSummaryText: {
    fontWeight: '800',
    fontSize: 14,
  },
  resSummarySubText: {
    fontWeight: '700',
    fontSize: 12,
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  smallButtonText: {
    color: '#0B0B0B',
    fontWeight: '700',
    fontSize: 12,
  },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  resContent: {
    flex: 1,
    gap: 2,
  },
  resRowText: {
    fontSize: 13,
    fontWeight: '700',
  },
  resRowSubText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    textTransform: 'capitalize',
  },
  badgeConfirmed: { backgroundColor: '#22c55e20', color: '#22c55e' },
  badgePending: { backgroundColor: '#f59e0b20', color: '#f59e0b' },
  badgeCancelled: { backgroundColor: '#ef444420', color: '#ef4444' },
  emptyInlineText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  eventCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: 10,
  },
  eventBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  eventBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  eventTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  eventSubtitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  eventDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  eventActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  eventPrimaryButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventPrimaryButtonText: {
    color: '#0B0B0B',
    fontSize: 13,
    fontWeight: '900',
  },
  eventSecondaryButton: {
    minWidth: 96,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  eventSecondaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  noEventContainer: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  noEventIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noEventTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  noEventText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  emptyPrimaryButton: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  emptySecondaryButton: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySecondaryButtonText: {
    fontWeight: '800',
    fontSize: 13,
  },

  moreBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  moreSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    borderWidth: 1,
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  moreHeadingWrap: {
    gap: 4,
  },
  moreEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  moreTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  moreSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  moreCloseBtn: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  moreRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },

  /* Loading & Error */
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 72,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 72,
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 8,
  },
  retryText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },

});