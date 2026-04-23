import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { useEffect, useMemo, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { fetchVenueAnalytics } from "../../services/venues";
import { Event, EventStats, VenueAnalytics } from "../../types/events";

type Props = {
  venueId?: string | null;
  selectedEvent?: Event | null;
  eventStats?: EventStats | null;
};

const toNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
}

const normalizeStatus = (status?: string) => String(status ?? '').trim().toUpperCase();

const getStatusPalette = (status?: string) => {
  const normalized = normalizeStatus(status);
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

const formatMoney = (value: number) => `€${value.toFixed(2)}`;

const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

const safePct = (current: number, baseline: number) => {
  if (!baseline) return current > 0 ? 100 : 0;
  return ((current - baseline) / baseline) * 100;
};

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const formatDateLong = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' });
};

const statusTone = (delta: number) => {
  if (delta >= 5) return '#7EE081';
  if (delta <= -5) return '#FF6B6B';
  return '#F4C95D';
};

const formatCompactNumber = (value: number) => {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(Math.round(value));
};

export default function ReportsScreen({ venueId, selectedEvent, eventStats }: Props) {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<VenueAnalytics | null>(null);

  const totals = analytics?.overview;

  const live = useMemo(() => {
    const entriesRevenue = toNumber(eventStats?.total_entries_revenue);
    const bar = toNumber(eventStats?.total_bar);
    const clo = toNumber(eventStats?.total_cloakroom);
    const tab = toNumber(eventStats?.total_tables);
    const entries = eventStats?.total_entries ?? 0;
    const revenue = entriesRevenue + bar + clo + tab;
    const avg = entries > 0 ? revenue / entries : 0;
    return { entriesRevenue, bar, clo, tab, entries, revenue, avg };
  }, [eventStats]);

  const events = analytics?.events ?? [];

  const byEvent = useMemo(() => events.slice(0, 8), [events]);

  const selectedEventPalette = useMemo(
    () => getStatusPalette(selectedEvent?.status),
    [selectedEvent?.status],
  );

  const focusEvent = useMemo(() => {
    if (selectedEvent?.id) {
      const current = events.find((event) => event.event_id === selectedEvent.id);
      if (current) return current;
    }
    return events[0] ?? null;
  }, [events, selectedEvent?.id]);

  const weekdayBenchmark = useMemo(() => {
    if (!analytics || !selectedEvent?.date) return null;
    const weekday = new Date(selectedEvent.date).toLocaleDateString('it-IT', { weekday: 'short' });
    const normalized = weekday.slice(0, 3).replace('.', '');
    return analytics.revenue.weekdayBenchmarks.find((item) => item.label.toLowerCase() === normalized.toLowerCase()) ?? null;
  }, [analytics, selectedEvent?.date]);

  const selectedComparison = useMemo(() => {
    if (!focusEvent || !analytics) return null;
    const avg = analytics.revenue.averagePerClosedEvent;
    const revenueVsAverage = safePct(focusEvent.totalRevenue, avg.revenue);
    const presencesVsAverage = safePct(focusEvent.totalPresences, avg.presences);
    const revenueVsWeekday = weekdayBenchmark ? safePct(focusEvent.totalRevenue, weekdayBenchmark.avgRevenue) : null;
    const presencesVsWeekday = weekdayBenchmark ? safePct(focusEvent.totalPresences, weekdayBenchmark.avgPresences) : null;
    const revenueRanking = [...analytics.events].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const rank = revenueRanking.findIndex((event) => event.event_id === focusEvent.event_id) + 1;
    return {
      revenueVsAverage,
      presencesVsAverage,
      revenueVsWeekday,
      presencesVsWeekday,
      rank,
      totalCompared: analytics.events.length,
    };
  }, [analytics, focusEvent, weekdayBenchmark]);

  const focusMixComparison = useMemo(() => {
    if (!analytics || !focusEvent) return [];
    const avg = analytics.revenue.averagePerClosedEvent;
    return [
      { label: 'Ingressi', focusValue: focusEvent.entriesRevenue, averageValue: avg.entriesRevenue },
      { label: 'Bar', focusValue: focusEvent.barRevenue, averageValue: avg.barRevenue },
      { label: 'Guardaroba', focusValue: focusEvent.cloakroomRevenue, averageValue: avg.cloakroomRevenue },
      { label: 'Tavoli', focusValue: focusEvent.tablesRevenue, averageValue: avg.tablesRevenue },
    ].map((item) => ({
      ...item,
      deltaPct: safePct(item.focusValue, item.averageValue),
    }));
  }, [analytics, focusEvent]);

  const selectedForecast = useMemo(() => {
    if (!selectedEvent || !focusEvent) return null;
    const weekday = new Date(selectedEvent.date).toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3).replace('.', '').toLowerCase();
    const closedEvents = events.filter((event) => event.status === 'CLOSED' && event.event_id !== focusEvent.event_id);
    const comparable = closedEvents.filter((event) => {
      const label = new Date(event.date).toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3).replace('.', '').toLowerCase();
      return label === weekday;
    });
    const baseline = (comparable.length >= 2 ? comparable : closedEvents).slice(0, 5);
    if (!baseline.length) return null;

    const predictedRevenueBase = average(baseline.map((event) => event.totalRevenue));
    const predictedEntriesBase = average(baseline.map((event) => event.totalEntries));
    const predictedPresencesBase = average(baseline.map((event) => event.totalPresences));

    if (normalizeStatus(selectedEvent.status) !== 'LIVE') {
      return {
        predictedRevenue: predictedRevenueBase,
        predictedEntries: predictedEntriesBase,
        predictedPresences: predictedPresencesBase,
        confidence: baseline.length >= 4 ? 'Alta' : baseline.length >= 2 ? 'Media' : 'Bassa',
        basis: comparable.length >= 2 ? 'Eventi dello stesso giorno' : 'Ultimi eventi chiusi',
      };
    }

    if (!selectedEvent.start_time || !selectedEvent.end_time) {
      return {
        predictedRevenue: Math.max(live.revenue, predictedRevenueBase),
        predictedEntries: Math.max(live.entries, predictedEntriesBase),
        predictedPresences: Math.max(live.entries, predictedPresencesBase),
        confidence: 'Media',
        basis: 'Storico comparabile',
      };
    }

    const start = new Date(`${selectedEvent.date}T${selectedEvent.start_time}`);
    const end = new Date(`${selectedEvent.date}T${selectedEvent.end_time}`);
    const now = new Date();
    const totalMs = Math.max(1, end.getTime() - start.getTime());
    const elapsedMs = Math.min(Math.max(0, now.getTime() - start.getTime()), totalMs);
    const progress = Math.max(0.18, Math.min(1, elapsedMs / totalMs));
    const paceRevenue = live.revenue / progress;
    const paceEntries = live.entries / progress;
    const projectedRevenue = Math.max(live.revenue, paceRevenue * 0.55 + predictedRevenueBase * 0.45);
    const projectedEntries = Math.max(live.entries, paceEntries * 0.55 + predictedEntriesBase * 0.45);
    const projectedPresences = Math.max(live.entries, projectedEntries + (predictedPresencesBase - predictedEntriesBase));

    return {
      predictedRevenue: projectedRevenue,
      predictedEntries: projectedEntries,
      predictedPresences: projectedPresences,
      confidence: baseline.length >= 4 ? 'Alta' : 'Media',
      basis: 'Pace live + storico comparabile',
    };
  }, [events, focusEvent, live.entries, live.revenue, selectedEvent]);

  const audienceHighlights = useMemo(() => {
    if (!analytics) return [] as Array<{ label: string; value: string; hint: string; accent: string }>;
    const genderTop = (analytics.audience.genderSplit[0]?.label ?? 'N/D').toUpperCase();
    const ageTop = (analytics.audience.ageBuckets[0]?.label ?? 'N/D');
    return [
      {
        label: 'Età media',
        value: analytics.audience.averageAge ? `${analytics.audience.averageAge} anni` : 'N/D',
        hint: `Cluster più forte ${ageTop}`,
        accent: '#7EE081',
      },
      {
        label: 'Mix dominante',
        value: genderTop,
        hint: analytics.audience.genderSplit[0] ? `${analytics.audience.genderSplit[0].share}% del pubblico` : 'Distribuzione non disponibile',
        accent: '#FF6B6B',
      },
      {
        label: 'Clienti di ritorno',
        value: `${analytics.audience.repeatRate}%`,
        hint: `${analytics.audience.repeatCustomers}/${analytics.audience.uniqueCustomers} clienti unici`,
        accent: '#67B7FF',
      },
      {
        label: 'Stay medio',
        value: `${analytics.overview.avgStayMinutes} min`,
        hint: 'Tempo medio di permanenza nel locale',
        accent: '#F4C95D',
      },
    ];
  }, [analytics]);

  const revenueTrendData = useMemo(
    () =>
      [...events]
        .slice(0, 6)
        .reverse()
        .map((event) => ({
          label: formatDate(event.date).split(' ')[0] ?? formatDate(event.date),
          value: event.totalRevenue,
          meta: `${event.totalPresences} presenze`,
        })),
    [events],
  );

  const bookingWeekdayData = useMemo(
    () => (analytics?.bookings.byEventWeekday ?? []).slice(0, 7),
    [analytics],
  );

  const bookingHourData = useMemo(
    () => (analytics?.bookings.byBookingHour ?? []).slice(0, 6),
    [analytics],
  );

  const ageBucketData = useMemo(
    () => (analytics?.audience.ageBuckets ?? []).slice(0, 6),
    [analytics],
  );

  const channelMixData = useMemo(
    () => analytics?.revenue.channelMix ?? [],
    [analytics],
  );

  const load = async () => {
    if (!venueId) {
      setError('Venue ID mancante');
      setAnalytics(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const nextAnalytics = await fetchVenueAnalytics(venueId);
      setAnalytics(nextAnalytics);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.message || 'Errore nel caricamento report';
      setError(status ? `${msg} (${status})` : msg);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [venueId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
              <Text style={[styles.heroEyebrow, { color: theme.colors.muted }]}>REPORT CONTROL</Text>
            </View>
            <TouchableOpacity style={[styles.heroIconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={onRefresh}>
              <Feather name="refresh-cw" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
            {selectedEvent?.name ?? 'Analytics Hub'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>
            {selectedEvent
              ? `${formatDate(selectedEvent.date)} • ${selectedEventPalette.label.toUpperCase()} snapshot`
              : 'Monitora incassi, comportamento cliente, trend storico e forecast dal medesimo pannello.'}
          </Text>

          <View style={styles.heroStatsGrid}>
            <KpiCard label="Revenue live" value={formatMoney(live.revenue)} caption="serata selezionata" icon="dollar-sign" color="#7EE081" theme={theme} />
            <KpiCard label="Ingressi live" value={String(live.entries)} caption="persone registrate" icon="users" color="#FF6B6B" theme={theme} />
            <KpiCard label="Media ingresso" value={formatMoney(live.avg)} caption="spesa per ingresso" icon="activity" color="#67B7FF" theme={theme} />
            <KpiCard label="Eventi analizzati" value={String(analytics?.historical.totalEvents ?? 0)} caption="storico venue" icon="calendar" color="#8B7BFF" theme={theme} />
          </View>
        </View>
      </View>

      {!venueId ? (
        <View style={styles.centerBox}>
          <Feather name="alert-circle" size={36} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>Venue ID mancante</Text>
        </View>
      ) : loading && !analytics ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.subtleText, { color: theme.colors.muted }]}>Caricamento report...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Feather name="alert-circle" size={36} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
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
            <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Serata selezionata</Text>
            <View style={[styles.nextActionCard, { backgroundColor: theme.colors.surface, borderColor: selectedEventPalette.border }]}>
              <View style={[styles.nextActionAccent, { backgroundColor: selectedEventPalette.color }]} />
              <View style={styles.nextActionTimeWrap}>
                <Text style={[styles.nextActionTime, { color: selectedEventPalette.color }]}>{live.entries}</Text>
                <Text style={[styles.nextActionTimeLabel, { color: theme.colors.muted }]}>ingressi</Text>
              </View>
              <View style={styles.nextActionBody}>
                <Text style={[styles.nextActionTitle, { color: theme.colors.text }]}>
                  {selectedEvent?.name ?? 'Nessuna serata selezionata'}
                </Text>
                <Text style={[styles.nextActionText, { color: theme.colors.muted }]}>
                  {selectedEvent
                    ? `${formatDate(selectedEvent.date)} • Ingresso ${formatMoney(live.entriesRevenue)} • Bar ${formatMoney(live.bar)} • Tavoli ${formatMoney(live.tab)}`
                    : 'Seleziona un evento dalla Home per vedere il dettaglio live della serata.'}
                </Text>
              </View>
              <View style={[styles.nextActionChip, { backgroundColor: selectedEventPalette.soft, borderColor: selectedEventPalette.border }]}>
                <Text style={[styles.nextActionChipText, { color: selectedEventPalette.color }]}>{selectedEventPalette.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Executive snapshot</Text>
            <View style={styles.metricGrid}>
              <MetricStrip label="Incasso totale" value={formatMoney(totals?.totalRevenue ?? 0)} accent="#7EE081" theme={theme} />
              <MetricStrip label="Presenze totali" value={String(totals?.totalPresences ?? 0)} accent="#FF6B6B" theme={theme} />
              <MetricStrip label="Media per presenza" value={formatMoney(totals?.avgRevenuePerPresence ?? 0)} accent="#67B7FF" theme={theme} />
              <MetricStrip label="Prenotazioni" value={String(totals?.totalReservations ?? 0)} accent="#8B7BFF" theme={theme} />
              <MetricStrip label="Coperti tavoli" value={String(totals?.totalTableGuests ?? 0)} accent="#F4C95D" theme={theme} />
              <MetricStrip label="Media per evento" value={formatMoney(totals?.avgRevenuePerEvent ?? 0)} accent="#94A3B8" theme={theme} />
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Visual dashboard</Text>

            <View style={[styles.chartCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Trend incassi ultimi eventi</Text>
              <Text style={[styles.chartSubtitle, { color: theme.colors.muted }]}>Capisci subito se il locale sta accelerando o rallentando.</Text>
              {revenueTrendData.length ? (
                <ColumnChart data={revenueTrendData} color="#7EE081" theme={theme} valueFormatter={(value) => formatCompactNumber(value)} />
              ) : (
                <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>Servono almeno alcuni eventi per generare il trend.</Text>
              )}
            </View>

            <View style={[styles.chartCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Mix ricavi per canale</Text>
              <Text style={[styles.chartSubtitle, { color: theme.colors.muted }]}>Dove si concentra davvero l'incasso: ingressi, bar, guardaroba o tavoli.</Text>
              {channelMixData.length ? (
                <HorizontalBars
                  data={channelMixData.map((item, index) => ({
                    label: item.label,
                    value: item.value,
                    share: item.share,
                    color: ['#7EE081', '#67B7FF', '#F4C95D', '#8B7BFF'][index % 4],
                    meta: formatMoney(item.value),
                  }))}
                  theme={theme}
                  valueFormatter={(value) => `${value.toFixed(1)}%`}
                />
              ) : (
                <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>Mix ricavi non disponibile.</Text>
              )}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Audience intelligence</Text>
            <View style={styles.metricGrid}>
              {audienceHighlights.map((item) => (
                <MetricStrip
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  accent={item.accent}
                  caption={item.hint}
                  theme={theme}
                />
              ))}
            </View>
            <View style={[styles.listCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Orario di ingresso per età</Text>
              <View style={styles.genderGrid}>
                {(analytics?.audience.genderSplit ?? []).slice(0, 4).map((item) => (
                  <View key={item.label} style={[styles.genderCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.genderCardLabel, { color: theme.colors.muted }]}>{item.label}</Text>
                    <Text style={[styles.genderCardValue, { color: theme.colors.text }]}>{item.count ?? 0}</Text>
                    <Text style={[styles.genderCardHint, { color: theme.colors.muted }]}>{item.share ?? 0}% pubblico</Text>
                  </View>
                ))}
              </View>
              {analytics?.audience.ageEntryWindows?.length ? (
                analytics.audience.ageEntryWindows.slice(0, 5).map((item) => (
                  <View key={item.label} style={styles.insightRow}>
                    <View>
                      <Text style={[styles.insightTitle, { color: theme.colors.text }]}>{item.label}</Text>
                      <Text style={[styles.insightHint, { color: theme.colors.muted }]}>{item.count} accessi tracciati</Text>
                    </View>
                    <View style={styles.insightRight}>
                      <Text style={[styles.insightValue, { color: theme.colors.text }]}>{item.avgEntryHour ?? 'N/D'}</Text>
                      <Text style={[styles.insightHint, { color: theme.colors.muted }]}>picco {item.peakEntryHour ?? 'N/D'}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>Dati età/orario ancora insufficienti.</Text>
              )}
            </View>

            <View style={[styles.chartCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Fasce età più presenti</Text>
              <Text style={[styles.chartSubtitle, { color: theme.colors.muted }]}>Chi compone il pubblico e dove si concentra il volume.</Text>
              {ageBucketData.length ? (
                <HorizontalBars
                  data={ageBucketData.map((item, index) => ({
                    label: item.label,
                    value: item.share ?? 0,
                    color: ['#FF6B6B', '#F4C95D', '#67B7FF', '#7EE081', '#8B7BFF', '#94A3B8'][index % 6],
                    meta: `${item.count ?? 0} clienti`,
                  }))}
                  theme={theme}
                  valueFormatter={(value) => `${value.toFixed(1)}%`}
                />
              ) : (
                <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>Distribuzione età non disponibile.</Text>
              )}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Booking behavior</Text>
            <View style={styles.metricGrid}>
              <MetricStrip label="Giorno evento top" value={analytics?.bookings.bestEventWeekday?.label ?? 'N/D'} accent="#7EE081" caption={analytics?.bookings.bestEventWeekday ? `${analytics.bookings.bestEventWeekday.count} prenotazioni` : 'Storico insufficiente'} theme={theme} />
              <MetricStrip label="Giorno di booking top" value={analytics?.bookings.bestBookingWeekday?.label ?? 'N/D'} accent="#FF6B6B" caption={analytics?.bookings.bestBookingWeekday ? `${analytics.bookings.bestBookingWeekday.count} prenotazioni` : 'Storico insufficiente'} theme={theme} />
              <MetricStrip label="Ora booking top" value={analytics?.bookings.bestBookingHour?.label ?? 'N/D'} accent="#67B7FF" caption={analytics?.bookings.bestBookingHour ? `${analytics.bookings.bestBookingHour.count} prenotazioni` : 'Storico insufficiente'} theme={theme} />
              <MetricStrip label="Lead medio" value={`${analytics?.bookings.avgLeadDays ?? 0} gg`} accent="#8B7BFF" caption="anticipo medio rispetto alla serata" theme={theme} />
            </View>

            <View style={[styles.chartCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Domanda per giorno evento</Text>
              <Text style={[styles.chartSubtitle, { color: theme.colors.muted }]}>Mostra i giorni che raccolgono più prenotazioni nel tempo.</Text>
              {bookingWeekdayData.length ? (
                <HorizontalBars
                  data={bookingWeekdayData.map((item, index) => ({
                    label: item.label,
                    value: item.share ?? 0,
                    color: ['#7EE081', '#67B7FF', '#8B7BFF', '#F4C95D', '#FF6B6B', '#94A3B8', '#9CA3AF'][index % 7],
                    meta: `${item.count ?? 0} prenotazioni`,
                  }))}
                  theme={theme}
                  valueFormatter={(value) => `${value.toFixed(1)}%`}
                />
              ) : (
                <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>Storico prenotazioni per giorno non disponibile.</Text>
              )}
            </View>

            <View style={[styles.chartCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Ore più forti per booking</Text>
              <Text style={[styles.chartSubtitle, { color: theme.colors.muted }]}>Quando il cliente converte di più durante la giornata.</Text>
              {bookingHourData.length ? (
                <ColumnChart
                  data={bookingHourData.map((item) => ({
                    label: item.label,
                    value: item.count ?? 0,
                    meta: `${item.share ?? 0}%`,
                  }))}
                  color="#67B7FF"
                  theme={theme}
                  valueFormatter={(value) => formatCompactNumber(value)}
                />
              ) : (
                <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>Storico orario booking non disponibile.</Text>
              )}
            </View>
          </View>

          {focusEvent && selectedComparison && (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Confronto evento vs storico</Text>
              <View style={[styles.listCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
                <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>{focusEvent.name}</Text>
                <Text style={[styles.insightHint, { color: theme.colors.muted }]}>{formatDateLong(focusEvent.date)} • rank {selectedComparison.rank}/{selectedComparison.totalCompared} per incasso</Text>
                <ComparisonRow label="Revenue vs media locale" value={selectedComparison.revenueVsAverage} theme={theme} />
                <ComparisonRow label="Presenze vs media locale" value={selectedComparison.presencesVsAverage} theme={theme} />
                {selectedComparison.revenueVsWeekday !== null && (
                  <ComparisonRow label="Revenue vs stesso giorno settimana" value={selectedComparison.revenueVsWeekday} theme={theme} />
                )}
                {selectedComparison.presencesVsWeekday !== null && (
                  <ComparisonRow label="Presenze vs stesso giorno settimana" value={selectedComparison.presencesVsWeekday} theme={theme} />
                )}
              </View>
            </View>
          )}

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Revenue mix e forecast</Text>
            <View style={[styles.listCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Incassi divisi e benchmark</Text>
              {focusMixComparison.map((item) => (
                <InsightBarRow key={item.label} label={item.label} current={item.focusValue} average={item.averageValue} deltaPct={item.deltaPct} theme={theme} />
              ))}
              {selectedForecast && (
                <View style={[styles.forecastCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.forecastEyebrow, { color: theme.colors.muted }]}>FORECAST</Text>
                  <Text style={[styles.forecastTitle, { color: theme.colors.text }]}>{selectedForecast.basis}</Text>
                  <View style={styles.forecastGrid}>
                    <MiniStat label="Revenue stimato" value={formatMoney(selectedForecast.predictedRevenue)} theme={theme} />
                    <MiniStat label="Ingressi stimati" value={String(Math.round(selectedForecast.predictedEntries))} theme={theme} />
                    <MiniStat label="Presenze stimate" value={String(Math.round(selectedForecast.predictedPresences))} theme={theme} />
                    <MiniStat label="Confidenza" value={selectedForecast.confidence} theme={theme} />
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Ultimi eventi</Text>
            <View style={[styles.listCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              {byEvent.length === 0 ? (
                <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>Nessun evento disponibile.</Text>
              ) : (
                byEvent.map((e) => {
                  const palette = getStatusPalette(e.status);
                  return (
                    <View key={e.event_id} style={styles.eventRow}>
                      <View style={[styles.eventIconWrap, { backgroundColor: `${palette.color}16`, borderColor: `${palette.color}30` }]}>
                        <Feather name="calendar" size={16} color={palette.color} />
                      </View>
                      <View style={styles.eventRowMain}>
                        <Text style={[styles.eventRowTitle, { color: theme.colors.text }]}>{e.name}</Text>
                        <Text style={[styles.eventRowSub, { color: theme.colors.muted }]}>{formatDate(e.date)} • età media {e.averageAge ? `${e.averageAge}` : 'N/D'}</Text>
                      </View>
                      <View style={styles.eventRowRight}>
                        <Text style={[styles.eventRowValue, { color: theme.colors.text }]}>{formatMoney(e.totalRevenue)}</Text>
                        <Text style={[styles.eventRowSub, { color: theme.colors.muted }]}>{e.totalPresences} presenze</Text>
                      </View>
                      <View style={[styles.eventStatusBadge, { backgroundColor: `${palette.color}18`, borderColor: `${palette.color}30` }]}>
                        <Text style={[styles.eventStatusText, { color: palette.color }]}>{palette.label}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function KpiCard({ label, value, icon, color, caption, theme }: any) {
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

function MetricStrip({ label, value, accent, caption, theme }: any) {
  return (
    <View style={[styles.metricStrip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.metricStripAccent, { backgroundColor: accent }]} />
      <Text style={[styles.metricStripLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.metricStripValue, { color: theme.colors.text }]}>{value}</Text>
      {caption ? <Text style={[styles.metricStripCaption, { color: theme.colors.muted }]}>{caption}</Text> : null}
    </View>
  );
}

function ComparisonRow({ label, value, theme }: { label: string; value: number; theme: any }) {
  const tone = statusTone(value);
  return (
    <View style={styles.insightRow}>
      <Text style={[styles.insightTitle, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[styles.insightValue, { color: tone }]}>{formatPercent(value)}</Text>
    </View>
  );
}

function InsightBarRow({ label, current, average, deltaPct, theme }: { label: string; current: number; average: number; deltaPct: number; theme: any }) {
  const width = average > 0 ? Math.min(100, (current / average) * 100) : 100;
  const tone = statusTone(deltaPct);
  return (
    <View style={styles.barRow}>
      <View style={styles.barRowHeader}>
        <Text style={[styles.insightTitle, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[styles.insightValue, { color: tone }]}>{formatPercent(deltaPct)}</Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: theme.colors.card }]}>
        <View style={[styles.barFill, { width: `${Math.max(8, width)}%`, backgroundColor: tone }]} />
      </View>
      <View style={styles.barRowHeader}>
        <Text style={[styles.insightHint, { color: theme.colors.muted }]}>evento {formatMoney(current)}</Text>
        <Text style={[styles.insightHint, { color: theme.colors.muted }]}>media {formatMoney(average)}</Text>
      </View>
    </View>
  );
}

function MiniStat({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={[styles.miniStatCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.miniStatLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.miniStatValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

function ColumnChart({ data, color, theme, valueFormatter }: { data: Array<{ label: string; value: number; meta?: string }>; color: string; theme: any; valueFormatter: (value: number) => string }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <View style={styles.chartColumnsWrap}>
      {data.map((item, index) => (
        <View key={`${item.label}-${index}`} style={styles.chartColumn}>
          <View style={[styles.chartTrack, { backgroundColor: theme.colors.card }]}> 
            <View style={[styles.chartBar, { backgroundColor: color, height: Math.max(14, (item.value / maxValue) * 128) }]} />
          </View>
          <Text style={[styles.chartLabel, { color: theme.colors.muted }]}>{item.label}</Text>
          <Text style={[styles.chartValue, { color: theme.colors.text }]}>{valueFormatter(item.value)}</Text>
          {item.meta ? <Text style={[styles.chartMeta, { color: theme.colors.muted }]}>{item.meta}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function HorizontalBars({ data, theme, valueFormatter }: { data: Array<{ label: string; value: number; color: string; meta?: string; share?: number }>; theme: any; valueFormatter: (value: number) => string }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <View style={styles.horizontalBarsWrap}>
      {data.map((item, index) => (
        <View key={`${item.label}-${index}`} style={styles.horizontalBarRow}>
          <View style={styles.horizontalBarHeader}>
            <Text style={[styles.insightTitle, { color: theme.colors.text }]}>{item.label}</Text>
            <Text style={[styles.insightValue, { color: item.color }]}>{valueFormatter(item.value)}</Text>
          </View>
          <View style={[styles.horizontalBarTrack, { backgroundColor: theme.colors.card }]}> 
            <View style={[styles.horizontalBarFill, { backgroundColor: item.color, width: `${Math.max(8, (item.value / maxValue) * 100)}%` }]} />
          </View>
          {item.meta ? <Text style={[styles.insightHint, { color: theme.colors.muted }]}>{item.meta}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingBottom: 120,
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
  centerBox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 72,
    gap: 16,
  },
  subtleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
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
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  kpiCard: {
    width: '48%',
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  kpiCaption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
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
  nextActionChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  nextActionChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
  metricStripCaption: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  listCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  chartCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  chartSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  chartColumnsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  chartTrack: {
    width: '100%',
    maxWidth: 28,
    height: 132,
    justifyContent: 'flex-end',
    borderRadius: 999,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 999,
  },
  chartLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  chartValue: {
    fontSize: 10,
    fontWeight: '800',
  },
  chartMeta: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  horizontalBarsWrap: {
    gap: 10,
  },
  horizontalBarRow: {
    gap: 6,
  },
  horizontalBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  horizontalBarTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  horizontalBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  genderCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  genderCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  genderCardValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  genderCardHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  insightHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  insightRight: {
    alignItems: 'flex-end',
  },
  insightValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  barRow: {
    gap: 8,
    paddingVertical: 6,
  },
  barRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  forecastCard: {
    marginTop: 8,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  forecastEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  forecastTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  forecastGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniStatCard: {
    width: '48%',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  miniStatValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  eventRowMain: {
    flex: 1,
    gap: 2,
  },
  eventRowRight: {
    alignItems: 'flex-end',
    minWidth: 88,
  },
  eventRowTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  eventRowSub: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  eventRowValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  eventStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  eventStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  emptyInlineText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});
