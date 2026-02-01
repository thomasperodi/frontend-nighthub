import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import BottomNav, { NavItem } from "../../components/BottomNav";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { fetchEventsByVenue, fetchEventStats } from "../../services/events";
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

import { Event, EventStats } from "../../types/events";
import type { Reservation } from "../../types/reservations";

export default function VenueHomeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [currentTab, setCurrentTab] = useState("dashboard");
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

  const loadReservationsForSelectedEvent = async (opts?: { refreshing?: boolean }) => {
    const eventId = selectedEventId;
    if (!eventId) {
      setSelectedEventReservations([]);
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
      setSelectedReservationsError(status ? `${msg} (${status})` : msg);
      setSelectedEventReservations([]);
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
          fetchEventStats(effectiveSelectedEventId),
          fetchReservationsByEvent(effectiveSelectedEventId),
          wantsHostessTables ? listHostessTables({ eventId: effectiveSelectedEventId, venueId }) : Promise.resolve([]),
        ]);

        const [statsRes, reservationsRes, tablesRes] = settled;

        if (requestSeq.current !== seq) return;

        if (statsRes.status === 'fulfilled') {
          setEventStats(statsRes.value);
        } else {
          console.error('fetchEventStats error', statsRes.reason);
          setError((prev) => prev ?? 'Impossibile caricare le statistiche evento');
          setEventStats({
            event_id: effectiveSelectedEventId,
            total_entries: 0,
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
    if (currentTab !== 'reservations') return;
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
    const bar = toNumber(eventStats?.total_bar);
    const tables = toNumber(eventStats?.total_tables);
    const cloakroom = toNumber(eventStats?.total_cloakroom);
    return bar + tables + cloakroom;
  };


  const getTablesStats = () => {
    const completi = hostessTables.filter(t => toNumber(t.entrati) >= toNumber(t.prenotati)).length;
    const totalePersone = hostessTables.reduce((sum, t) => sum + toNumber(t.entrati), 0);
    return { completi, totalePersone, totale: hostessTables.length };
  };

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
    setCurrentTab(key);
  };

const renderDashboard = () => (
  <ScrollView 
    contentContainerStyle={{ paddingBottom: 120 }}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
  >
    {loading && !liveEvent ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6D5BFF" />
        <Text style={styles.loadingText}>Caricamento dati...</Text>
      </View>
    ) : error && !liveEvent ? (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryText}>Riprova</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <>
        {error && (
          <View style={styles.inlineErrorBanner}>
            <Feather name="alert-triangle" size={16} color="#f59e0b" />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.venueName, { color: theme.colors.text }]}>
              {venueName ?? (user?.venue_id ? 'Locale' : 'Dashboard')}
            </Text>
            {(() => {
              if (liveEvent) {
                return (
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>{liveEvent.name}</Text>
                  </View>
                );
              }
              const selected = getSelectedEvent();
              if (selected) {
                const st = normalizeEventStatus(selected.status);
                return (
                  <View style={styles.liveRow}>
                    <View style={[styles.liveDot, { backgroundColor: '#9ca3af' }]} />
                    <Text style={[styles.liveText, { color: '#9ca3af' }]}>
                      {st ? `${st} • ` : ''}{selected.name}
                    </Text>
                  </View>
                );
              }
              return (
                <View style={styles.liveRow}>
                  <View style={[styles.liveDot, { backgroundColor: '#9ca3af' }]} />
                  <Text style={[styles.liveText, { color: '#9ca3af' }]}>Nessun evento</Text>
                </View>
              );
            })()}
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={() => setCurrentTab("profile")}>
            <Feather name="settings" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {liveEvent && (
          <>
            {/* KPI REVENUE */}
            <View style={styles.kpiSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Incassi</Text>
              <View style={styles.kpiGrid}>
                <KpiCard 
                  label="Totale" 
                  value={`€${getTotalRevenue().toFixed(2)}`}
                  icon="dollar-sign" 
                  color="#4ECDC4"
                />
                <KpiCard 
                  label="Bar" 
                  value={`€${toNumber(eventStats?.total_bar).toFixed(2)}`}
                  icon="coffee" 
                  color="#3B82F6"
                />
                <KpiCard 
                  label="Tavoli" 
                  value={`€${toNumber(eventStats?.total_tables).toFixed(2)}`}
                  icon="grid" 
                  color="#8B5CF6"
                />
                <KpiCard 
                  label="Guardaroba" 
                  value={`€${toNumber(eventStats?.total_cloakroom).toFixed(2)}`}
                  icon="archive" 
                  color="#F59E0B"
                />
              </View>
            </View>

            {/* KPI INGRESSO E TAVOLI */}
            <View style={styles.kpiSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Occupazione</Text>
              <View style={styles.kpiGrid}>
                <KpiCard 
                  label="Ingressi" 
                  value={(eventStats?.total_entries || 0).toString()}
                  icon="users" 
                  color="#22c55e"
                />
                <KpiCard 
                  label="Tavoli Attivi" 
                  value={getTablesStats().totale.toString()}
                  icon="grid" 
                  color="#6D5BFF"
                />
                <KpiCard 
                  label="Tavoli Completi" 
                  value={getTablesStats().completi.toString()}
                  icon="check-circle" 
                  color="#10b981"
                />
                <KpiCard 
                  label="Persone AI Tavoli" 
                  value={getTablesStats().totalePersone.toString()}
                  icon="user-check" 
                  color="#06b6d4"
                />
              </View>
            </View>

            {/* AZIONI RAPIDE */}
            {/* <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Azioni rapide</Text>
            <View style={styles.actionsGrid}>
              <ActionButton 
                icon="log-in" 
                label="Ingressi" 
                onPress={() => navigation.navigate("ScanEntry")} 
                color="#22c55e"
              />
              <ActionButton 
                icon="archive" 
                label="Guardaroba" 
                onPress={() => navigation.navigate("Wardrobe")} 
                color="#F59E0B"
              />
              <ActionButton 
                icon="coffee" 
                label="Bar" 
                onPress={() => navigation.navigate("BarSales")} 
                color="#3B82F6"
              />
              <ActionButton 
                icon="grid" 
                label="Tavoli" 
                onPress={() => navigation.navigate("Tables")} 
                color="#8B5CF6"
              />
              <ActionButton 
                icon="plus" 
                label="Nuovo Evento" 
                onPress={() => setCurrentTab("events")} 
                color="#6D5BFF"
              />
              <ActionButton 
                icon="tag" 
                label="Promo Evento" 
                onPress={() => setCurrentTab("promos")} 
                color="#0ea5e9"
              />
              <ActionButton 
                icon="gift" 
                label="Promo Clienti" 
                onPress={() => setCurrentTab("promos")} 
                color="#14b8a6"
              />
            </View> */}

            {/* PRENOTAZIONI */}
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Prenotazioni tavoli</Text>
            <View style={styles.reservationsCard}>
              {(() => {
                const tableRes = eventReservations.filter((r) => r.type === 'table');
                const totalGuests = tableRes.reduce((s, r) => s + (r.guests || 0), 0);
                const selected = getSelectedEvent();
                return (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.resSummaryText}>
                    {selected ? `${formatEventDate(selected.date)} • ${selected.name}` : 'Evento selezionato'}
                  </Text>
                  <Text style={styles.resSummarySubText}>
                    Prenotazioni: {tableRes.length} • Ospiti: {totalGuests}
                  </Text>
                </View>
                <TouchableOpacity style={styles.smallButton} onPress={() => setCurrentTab('reservations')}>
                  <Text style={styles.smallButtonText}>Vedi</Text>
                </TouchableOpacity>
              </View>
                );
              })()}

              {eventReservations
                .filter((r) => r.type === 'table')
                .slice(0, 3)
                .map((r) => {
                  const label =
                    r.venue_table?.numero
                      ? `Tavolo ${r.venue_table.numero}`
                      : r.venue_table?.nome
                        ? r.venue_table.nome
                        : 'Tavolo';
                  const zone = r.venue_table?.zona ? ` • ${r.venue_table.zona}` : '';
                  const time = r.created_at ? ` • ${new Date(r.created_at).toLocaleTimeString().slice(0, 5)}` : '';
                  return (
                <View key={r.id} style={styles.resRow}>
                  <Feather name="calendar" size={16} color="#9ca3af" />
                  <Text style={styles.resRowText}>{label}{zone} • {r.guests} ospiti{time}</Text>
                  <Text style={[styles.statusBadge, r.status === 'confirmed' ? styles.badgeConfirmed : r.status === 'pending' ? styles.badgePending : styles.badgeCancelled]}>{r.status}</Text>
                </View>
                  );
                })}

              {eventReservations.filter((r) => r.type === 'table').length === 0 && (
                <Text style={[styles.noEventText, { marginTop: 8 }]}>Nessuna prenotazione al momento</Text>
              )}
            </View>

            {/* EVENTO */}
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Evento</Text>
            {(() => {
              const selected = getSelectedEvent();
              if (!selected) return null;
              const st = normalizeEventStatus(selected.status);
              const dot = st === 'LIVE' ? '#22c55e' : st === 'DRAFT' ? '#f59e0b' : '#9ca3af';
              return (
                <View style={styles.eventCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{selected.name}</Text>
                    <Text style={styles.eventSubtitle}>{formatEventDate(selected.date)}</Text>
                    <View style={styles.eventStatus}>
                      <View style={[styles.statusDot, { backgroundColor: dot }]} />
                      <Text style={[styles.eventStatusText, { color: dot }]}>{st || '—'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.eventButton} onPress={() => setCurrentTab("events")}>
                    <Feather name="chevron-right" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              );
            })()}
          </>
        )}

        {!liveEvent && !loading && (
          <View style={styles.noEventContainer}>
            <Feather name="calendar" size={64} color="rgba(255,255,255,0.3)" />
            {venueEvents.length > 0 ? (
              <>
                <Text style={styles.noEventTitle}>Nessun evento live</Text>
                <Text style={styles.noEventText}>
                  Seleziona un evento per vedere prenotazioni e dettagli.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.createEventButton, { flex: 1 }]}
                    onPress={() => setCurrentTab('reservations')}
                  >
                    <Feather name="bookmark" size={20} color="white" />
                    <Text style={styles.createEventText}>Prenotazioni</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.createEventButton, { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)' }]}
                    onPress={() => setCurrentTab('events')}
                  >
                    <Feather name="calendar" size={20} color="white" />
                    <Text style={styles.createEventText}>Eventi</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.noEventTitle}>Nessun evento</Text>
                <Text style={styles.noEventText}>Crea un nuovo evento per iniziare</Text>
                <TouchableOpacity style={styles.createEventButton} onPress={() => setCurrentTab("events")}>
                  <Feather name="plus" size={20} color="white" />
                  <Text style={styles.createEventText}>Nuovo evento</Text>
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
    <ReportScreen venueId={user?.venue_id} liveEvent={liveEvent} eventStats={eventStats} />
  </>
);

const renderPromos = () => (
  <>
    <PromosScreen event={liveEvent} venueId={user?.venue_id} />
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

  function KpiCard({ label, value, icon, color }: any) {
    return (
      <View style={styles.kpiCard}>
        <View style={[styles.kpiIconBg, { backgroundColor: `${color}20` }]}>
          <Feather name={icon} size={20} color={color} />
        </View>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
    );
  }

  function ActionButton({ icon, label, onPress, color }: any) {
    return (
      <TouchableOpacity style={[styles.actionButton, { backgroundColor: color }]} onPress={onPress}>
        <Feather name={icon} size={24} color="white" />
        <Text style={styles.actionLabel}>{label}</Text>
      </TouchableOpacity>
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
            <Text style={[styles.moreTitle, { color: theme.colors.text }]}>Altro</Text>
            <TouchableOpacity onPress={() => setMoreOpen(false)} style={styles.moreCloseBtn}>
              <Feather name="x" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.moreRow, { borderColor: theme.colors.border }]}
            onPress={() => { setMoreOpen(false); setCurrentTab('promos'); }}
          >
            <Feather name="tag" size={18} color={theme.colors.text} />
            <Text style={[styles.moreRowText, { color: theme.colors.text }]}>Promozioni</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.moreRow, { borderColor: theme.colors.border }]}
            onPress={() => { setMoreOpen(false); setCurrentTab('analytics'); }}
          >
            <Feather name="bar-chart-2" size={18} color={theme.colors.text} />
            <Text style={[styles.moreRowText, { color: theme.colors.text }]}>Report</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.moreRow, { borderColor: theme.colors.border }]}
            onPress={() => { setMoreOpen(false); setCurrentTab('profile'); }}
          >
            <Feather name="user" size={18} color={theme.colors.text} />
            <Text style={[styles.moreRowText, { color: theme.colors.text }]}>Profilo</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>

    <BottomNav items={businessItems} active={currentTab === 'promos' || currentTab === 'analytics' || currentTab === 'profile' ? 'more' : currentTab} onChange={handleBottomNavChange} />

    {/* Table Booking Modal */}
    {(getSelectedEvent() ?? liveEvent) && user?.id && (
      <CreateReservationModal
        visible={bookingVisible}
        onClose={() => setBookingVisible(false)}
        eventId={(getSelectedEvent() ?? liveEvent)!.id}
        defaultDate={(getSelectedEvent() ?? liveEvent)!.date}
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
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10, paddingHorizontal: 24 },
  mutedText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  headerReservations: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reservationsSubtitle: { fontSize: 12, fontWeight: '700' },
  iconBtnSmall: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  eventChipsRow: { paddingHorizontal: 24, paddingBottom: 12, gap: 10 },
  eventChip: {
    width: 220,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  eventChipActive: { backgroundColor: 'rgba(109,91,255,0.20)', borderColor: 'rgba(109,91,255,0.45)' },
  eventChipTitle: { color: '#fff', fontWeight: '900', fontSize: 13 },
  eventChipTitleActive: { color: '#fff' },
  eventChipMeta: { color: '#9ca3af', fontWeight: '800', fontSize: 11, marginTop: 4 },
  eventChipMetaActive: { color: '#e5e7eb' },
  inlineErrorBanner: {
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
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
  /* Header */
  header: { 
    padding: 24, 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  venueName: { 
    fontSize: 28, 
    fontWeight: "900",
  },
  liveRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginTop: 8,
    gap: 6,
  },
  liveDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: "#22c55e",
  },
  liveText: { 
    color: "#22c55e", 
    fontSize: 13, 
    fontWeight: "600",
  },
  profileButton: { 
    padding: 10, 
    borderRadius: 12, 
    backgroundColor: "rgba(255,255,255,0.08)" 
  },

  /* KPI Section */
  kpiSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  kpiIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiValue: { 
    color: "white", 
    fontSize: 18, 
    fontWeight: "800",
  },
  kpiLabel: { 
    color: "#9ca3af", 
    fontSize: 12, 
    fontWeight: "600",
    marginTop: 4,
  },

  /* Section Title */
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: "800",
    marginHorizontal: 24,
    marginBottom: 16,
  },

  /* Actions Grid */
  actionsGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    paddingHorizontal: 18,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: { 
    width: "48%",
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionLabel: { 
    color: "white", 
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
  },

  /* Event Card */
  eventCard: { 
    marginHorizontal: 24, 
    backgroundColor: "rgba(109, 91, 255, 0.12)",
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    marginBottom: 24,
  },

  /* Reservations Preview */
  reservationsCard: {
    marginHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 24,
  },
  resSummaryText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
  },
  resSummarySubText: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
  smallButton: {
    backgroundColor: '#6D5BFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  smallButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  resIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  resRowText: {
    color: 'white',
    fontSize: 12,
    flex: 1,
  },
  resRowSubText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
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

  resFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(109,91,255,0.22)',
    borderColor: 'rgba(109,91,255,0.40)',
  },
  filterChipText: {
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  eventTitle: { 
    color: "white", 
    fontSize: 17, 
    fontWeight: "800",
  },
  eventSubtitle: { 
    color: "#d1d5db", 
    marginTop: 6,
    fontSize: 13,
    fontWeight: "500",
  },
  eventStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventStatusText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "700",
  },
  eventButton: { 
    backgroundColor: "rgba(139, 92, 246, 0.4)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  eventButtonText: { 
    color: "white", 
    fontWeight: "700",
    fontSize: 13,
  },

  /* No Event State */
  noEventContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 16,
  },
  noEventTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  noEventText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
  createEventButton: {
    backgroundColor: "#6D5BFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
  },
  createEventText: {
    color: "white",
    fontWeight: "800",
    fontSize: 14,
  },

  /* More sheet */
  moreBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  moreSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  moreTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  moreCloseBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
    gap: 16,
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
    gap: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 15,
    textAlign: "center",
    fontWeight: "500",
  },
  retryButton: {
    backgroundColor: "#6D5BFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },

  placeholder: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    gap: 12,
  },
  placeholderTitle: { 
    fontSize: 20, 
    fontWeight: "800", 
    marginTop: 16 
  },
  placeholderText: { 
    fontSize: 14 
  },
});