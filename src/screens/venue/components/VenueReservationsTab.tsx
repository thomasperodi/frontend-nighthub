import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import type { Event } from '../../../types/events';
import type { Reservation } from '../../../types/reservations';
import { cancelReservation, updateReservation } from '../../../services/reservations';

type VisibleStatus = Extract<Reservation['status'], 'pending' | 'confirmed'>;
type StatusFilter = 'all' | VisibleStatus;

type Props = {
  venueEvents: Event[];
  selectedEventId: string | null;
  onSelectEventId: (id: string) => void;

  selectedEventReservations: Reservation[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: (opts?: { refreshing?: boolean }) => void | Promise<void>;

  onOpenCreateReservation: () => void;
  onGoToEvents: () => void;
};

function normalizeEventStatus(s?: unknown) {
  return String(s ?? '').trim().toUpperCase();
}

function parseEventDateMs(d?: string) {
  const ms = Date.parse(d ?? '');
  return Number.isNaN(ms) ? null : ms;
}

function formatEventDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
}

function toNumberSafe(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatMoney(value: any): string {
  const n = toNumberSafe(value);
  if (n === null) return '—';
  return `€${n.toFixed(2)}`;
}

function expectedAmountForReservation(r: Reservation): number | null {
  const explicit = toNumberSafe(r.total_amount);
  if (explicit !== null) return explicit;

  const guests = typeof r.guests === 'number' ? r.guests : 0;
  if (guests <= 0) return null;

  const perHead = toNumberSafe(r.venue_table?.per_testa);
  const minSpend = toNumberSafe(r.venue_table?.costo_minimo);

  let computed: number | null = null;
  if (perHead !== null) computed = perHead * guests;

  if (minSpend !== null) {
    if (computed === null) return minSpend;
    return Math.max(computed, minSpend);
  }

  return computed;
}

function formatReservationStatus(s?: string) {
  if (s === 'confirmed') return 'Confermata';
  if (s === 'pending') return 'In attesa';
  if (s === 'cancelled') return 'Annullata';
  if (s === 'completed') return 'Completata';
  return s ? String(s) : '—';
}

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconBg, { backgroundColor: `${color}20` }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.kpiLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function VenueReservationsTab(props: Props) {
  const { theme } = useTheme();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [query, setQuery] = useState('');
  const [actionReservationId, setActionReservationId] = useState<string | null>(null);
  const [showConfirmedSection, setShowConfirmedSection] = useState(false);

  useEffect(() => {
    setShowConfirmedSection(statusFilter === 'confirmed');
  }, [statusFilter, props.selectedEventId]);

  const selected = useMemo(() => {
    if (!props.selectedEventId) return null;
    return props.venueEvents.find((e) => e.id === props.selectedEventId) ?? null;
  }, [props.selectedEventId, props.venueEvents]);

  const sortedEvents = useMemo(() => {
    return [...(props.venueEvents ?? [])].sort(
      (a, b) => (parseEventDateMs(b.date) ?? 0) - (parseEventDateMs(a.date) ?? 0)
    );
  }, [props.venueEvents]);

  const tableReservationsAll = useMemo(() => {
    return (props.selectedEventReservations ?? []).filter((r) => r.type === 'table');
  }, [props.selectedEventReservations]);

  // Mostra i dati SOLO per prenotazioni in attesa o confermate
  const tableReservations = useMemo(() => {
    return tableReservationsAll.filter((r) => r.status === 'pending' || r.status === 'confirmed');
  }, [tableReservationsAll]);

  const counts = useMemo(() => {
    const base = { all: tableReservations.length, pending: 0, confirmed: 0 } as const;
    const agg = { ...base } as any;
    for (const r of tableReservations) {
      if (r.status in agg) agg[r.status] += 1;
    }
    return agg as { all: number; pending: number; confirmed: number };
  }, [tableReservations]);

  const totalGuests = useMemo(() => {
    return tableReservations.reduce((s, r) => s + (r.guests || 0), 0);
  }, [tableReservations]);

  const expectedRevenue = useMemo(() => {
    return tableReservations.reduce((sum, r) => sum + (expectedAmountForReservation(r) ?? 0), 0);
  }, [tableReservations]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = tableReservations.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      if (!q) return true;

      const label =
        r.venue_table?.numero ? `tavolo ${r.venue_table.numero}` : r.venue_table?.nome ? String(r.venue_table.nome) : 'tavolo';
      const zone = r.venue_table?.zona ? String(r.venue_table.zona) : '';
      const who =
        (r.user?.name && r.user.name.trim().length ? r.user.name : null) ??
        (r.user?.email && r.user.email.trim().length ? r.user.email : null) ??
        (r.user?.phone && r.user.phone.trim().length ? r.user.phone : null) ??
        (r.user_id ? `utente ${r.user_id.slice(0, 6)}` : 'utente');

      const hay = `${label} ${zone} ${who}`.toLowerCase();
      return hay.includes(q);
    });

    const statusOrder: Record<VisibleStatus, number> = {
      pending: 0,
      confirmed: 1,
    };

    return list.sort((a, b) => {
      const sa = statusOrder[a.status as VisibleStatus] ?? 99;
      const sb = statusOrder[b.status as VisibleStatus] ?? 99;
      if (sa !== sb) return sa - sb;

      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    });
  }, [tableReservations, statusFilter, query]);

  const pendingVisible = useMemo(
    () => filteredAndSorted.filter((r) => r.status === 'pending'),
    [filteredAndSorted],
  );

  const confirmedVisible = useMemo(
    () => filteredAndSorted.filter((r) => r.status === 'confirmed'),
    [filteredAndSorted],
  );

  const pendingGuestsVisible = useMemo(
    () => pendingVisible.reduce((sum, r) => sum + (r.guests || 0), 0),
    [pendingVisible],
  );

  const pendingRevenueVisible = useMemo(
    () => pendingVisible.reduce((sum, r) => sum + (expectedAmountForReservation(r) ?? 0), 0),
    [pendingVisible],
  );

  const canRenderConfirmedSection = statusFilter === 'all' || statusFilter === 'confirmed';
  const shouldShowConfirmedList = statusFilter === 'confirmed' || showConfirmedSection;

  const confirmReservation = async (id: string) => {
    try {
      setActionReservationId(id);
      await updateReservation(id, { status: 'confirmed' });
      await props.onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Impossibile confermare la prenotazione';
      Alert.alert('Errore', String(msg));
    } finally {
      setActionReservationId(null);
    }
  };

  const confirmAllPending = async () => {
    const ids = pendingVisible.map((r) => r.id);
    if (ids.length === 0) return;

    Alert.alert('Conferma rapida', `Confermare ${ids.length} richieste in attesa?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Conferma tutte',
        onPress: async () => {
          try {
            setActionReservationId('bulk-confirm');
            const settled = await Promise.allSettled(
              ids.map((id) => updateReservation(id, { status: 'confirmed' })),
            );

            const ok = settled.filter((s) => s.status === 'fulfilled').length;
            const ko = settled.length - ok;
            await props.onRefresh();

            if (ko > 0) {
              Alert.alert('Conferma parziale', `Confermate ${ok} richieste, ${ko} non riuscite.`);
            }
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Errore nella conferma multipla';
            Alert.alert('Errore', String(msg));
          } finally {
            setActionReservationId(null);
          }
        },
      },
    ]);
  };

  const cancelReservationById = async (id: string) => {
    Alert.alert('Annullare prenotazione?', 'La prenotazione verrà annullata.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Annulla',
        style: 'destructive',
        onPress: async () => {
          try {
            setActionReservationId(id);
            await cancelReservation(id);
            await props.onRefresh();
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Impossibile annullare la prenotazione';
            Alert.alert('Errore', String(msg));
          } finally {
            setActionReservationId(null);
          }
        },
      },
    ]);
  };

  const badgeStyle = (s?: string) => {
    if (s === 'confirmed') return [styles.statusBadge, styles.badgeConfirmed];
    if (s === 'pending') return [styles.statusBadge, styles.badgePending];
    if (s === 'completed') return [styles.statusBadge, styles.badgeCompleted];
    return [styles.statusBadge, styles.badgeCancelled];
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Richieste tavoli per zona</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={1}>
            {selected ? `${formatEventDate(selected.date)} • ${selected.name}` : 'Seleziona un evento'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={props.onOpenCreateReservation}
          style={[styles.iconBtn, { opacity: props.selectedEventId ? 1 : 0.45, borderColor: theme.colors.border }]}
          disabled={!props.selectedEventId}
        >
          <Feather name="plus" size={18} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={props.onGoToEvents}
          style={[styles.iconBtn, { borderColor: theme.colors.border }]}
        >
          <Feather name="calendar" size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {sortedEvents.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventChipsRow}>
          {sortedEvents.map((e) => {
            const active = e.id === props.selectedEventId;
            const st = normalizeEventStatus(e.status);
            return (
              <TouchableOpacity
                key={e.id}
                onPress={() => props.onSelectEventId(e.id)}
                style={[styles.eventChip, { borderColor: theme.colors.border }, active && styles.eventChipActive]}
              >
                <Text style={[styles.eventChipTitle, { color: theme.colors.text }, active && styles.eventChipTitleActive]} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={[styles.eventChipMeta, { color: theme.colors.muted }, active && styles.eventChipMetaActive]} numberOfLines={1}>
                  {formatEventDate(e.date)}{st ? ` • ${st}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Feather name="calendar" size={28} color={theme.colors.muted} />
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Nessun evento. Creane uno per gestire le prenotazioni.</Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]} onPress={props.onGoToEvents}>
            <Text style={styles.primaryBtnText}>Vai agli eventi</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={() => props.onRefresh({ refreshing: true })} />}
      >
        {!props.selectedEventId ? (
          <View style={styles.center}>
            <Feather name="info" size={22} color={theme.colors.muted} />
            <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Seleziona un evento per vedere le prenotazioni.</Text>
          </View>
        ) : props.loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Caricamento prenotazioni…</Text>
          </View>
        ) : props.error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={26} color="#ef4444" />
            <Text style={styles.errorText}>{props.error}</Text>
            <TouchableOpacity style={[styles.retryButton, { borderColor: theme.colors.border }]} onPress={() => props.onRefresh()}>
              <Text style={[styles.retryText, { color: theme.colors.text }]}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Riepilogo</Text>
              <TouchableOpacity
                onPress={props.onOpenCreateReservation}
                disabled={!props.selectedEventId}
                style={[styles.smallCta, { backgroundColor: theme.colors.primary, opacity: props.selectedEventId ? 1 : 0.5 }]}
              >
                <Feather name="plus" size={16} color="white" />
                <Text style={styles.smallCtaText}>Nuova</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.kpiGrid, { marginBottom: 10 }]}>
              <KpiCard label="Prenotazioni" value={String(tableReservations.length)} icon="bookmark" color="#6D5BFF" />
              <KpiCard label="Ospiti" value={String(totalGuests)} icon="users" color="#22c55e" />
              <KpiCard label="Incasso previsto" value={formatMoney(expectedRevenue)} icon="trending-up" color="#f59e0b" />
              <KpiCard label="In attesa" value={String(counts.pending)} icon="clock" color="#a78bfa" />
            </View>

            <Text style={[styles.hint, { color: theme.colors.muted }]}>
              Le richieste arrivano per zona. Il locale conferma il tavolo assegnato direttamente in cassa/sala.
            </Text>

            <View style={[styles.filtersRow, { marginTop: 10 }]}>
              {(
                [
                  { key: 'all' as const, label: `Tutte (${counts.all})` },
                  { key: 'pending' as const, label: `In attesa (${counts.pending})` },
                  { key: 'confirmed' as const, label: `Confermate (${counts.confirmed})` },
                ] satisfies Array<{ key: StatusFilter; label: string }>
              ).map((chip) => {
                const active = statusFilter === chip.key;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    onPress={() => setStatusFilter(chip.key)}
                    style={[styles.filterChip, { borderColor: theme.colors.border }, active && [styles.filterChipActive, { borderColor: theme.colors.primary }]]}
                  >
                    <Text style={[styles.filterChipText, { color: active ? theme.colors.primary : theme.colors.text }]}> {chip.label} </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.searchRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
              <Feather name="search" size={16} color={theme.colors.muted} />
              <TextInput
                placeholder="Cerca cliente o zona…"
                placeholderTextColor={theme.colors.muted}
                value={query}
                onChangeText={setQuery}
                style={[styles.searchInput, { color: theme.colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                  <Feather name="x" size={16} color={theme.colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            {pendingVisible.length > 0 ? (
              <View style={[styles.pendingPanel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
                <View style={styles.pendingPanelTop}>
                  <Text style={[styles.pendingPanelTitle, { color: theme.colors.text }]}>Coda da confermare</Text>
                  <Text style={[styles.pendingPanelMeta, { color: theme.colors.muted }]}> 
                    {pendingVisible.length} richieste • {pendingGuestsVisible} ospiti • {formatMoney(pendingRevenueVisible)}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={confirmAllPending}
                  disabled={actionReservationId === 'bulk-confirm'}
                  style={[
                    styles.pendingPanelBtn,
                    { backgroundColor: theme.colors.primary, opacity: actionReservationId === 'bulk-confirm' ? 0.6 : 1 },
                  ]}
                >
                  {actionReservationId === 'bulk-confirm' ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Feather name="check-circle" size={16} color="white" />
                  )}
                  <Text style={styles.pendingPanelBtnText}>Conferma tutte le richieste visibili</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {tableReservations.length === 0 ? (
              <View style={[styles.center, { paddingVertical: 18 }]}> 
                <Feather name="bookmark" size={22} color={theme.colors.muted} />
                <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Nessuna prenotazione tavolo in attesa o confermata per questo evento.</Text>
              </View>
            ) : filteredAndSorted.length === 0 ? (
              <Text style={[styles.noResultsText, { color: theme.colors.muted }]}>Nessuna prenotazione per i filtri selezionati.</Text>
            ) : (
              <View style={{ marginTop: 6 }}>
                {pendingVisible.length > 0 ? (
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>In attesa ({pendingVisible.length})</Text>
                ) : null}

                {pendingVisible.map((r) => {
                  const zoneName = r.venue_table?.zona ?? r.venue_table?.nome ?? 'Senza zona';
                  const label = `Zona ${zoneName}`;
                  const assigned = r.venue_table?.numero ? ` • Tavolo ${r.venue_table.numero}` : '';
                  const time = r.created_at ? ` • ${new Date(r.created_at).toLocaleTimeString().slice(0, 5)}` : '';
                  const who =
                    (r.user?.name && r.user.name.trim().length ? r.user.name : null) ??
                    (r.user?.email && r.user.email.trim().length ? r.user.email : null) ??
                    (r.user?.phone && r.user.phone.trim().length ? r.user.phone : null) ??
                    (r.user_id ? `Utente ${r.user_id.slice(0, 6)}` : 'Utente');

                  const amount = expectedAmountForReservation(r);
                  const isBusy = actionReservationId === r.id;
                  const customTableName = String(r.table_name ?? '').trim();

                  return (
                    <View key={r.id} style={[styles.resRow, styles.resRowPending, { borderColor: theme.colors.border }]}> 
                      <View style={styles.resHeaderRow}>
                        <View style={styles.resTitleWrap}>
                          <View style={[styles.resIconWrap, styles.resIconWrapPending]}>
                            <Feather name="clock" size={16} color="#f59e0b" />
                          </View>
                          <Text style={[styles.resRowText, { color: theme.colors.text }]} numberOfLines={1}>
                            {label}{assigned}
                          </Text>
                        </View>
                        <Text style={badgeStyle(r.status)}>{formatReservationStatus(r.status)}</Text>
                      </View>

                      <View style={styles.resBodyBlock}>
                        <Text style={[styles.resRowText, { color: theme.colors.text }]} numberOfLines={1}>
                          {r.guests} ospiti{time}
                        </Text>
                        <Text style={[styles.resRowSubText, { color: theme.colors.muted }]} numberOfLines={1}>
                          {who} • {amount === null ? '—' : formatMoney(amount)}
                        </Text>
                        {customTableName ? (
                          <Text style={[styles.resRowNameTag, { color: theme.colors.primary }]} numberOfLines={1}>
                            Nome tavolo: {customTableName}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.pendingActionsRow}>
                        {isBusy ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <>
                            <TouchableOpacity onPress={() => confirmReservation(r.id)} style={styles.pendingPrimaryActionBtn}>
                              <Feather name="check" size={15} color="white" />
                              <Text style={styles.actionConfirmText}>Conferma richiesta</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => cancelReservationById(r.id)} style={styles.pendingSecondaryActionBtn}>
                              <Feather name="x" size={15} color="white" />
                              <Text style={styles.actionRejectText}>Rifiuta</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}

                {confirmedVisible.length > 0 && canRenderConfirmedSection ? (
                  <View style={[styles.sectionHeaderRow, { marginTop: pendingVisible.length ? 14 : 0 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 0 }]}>Confermate ({confirmedVisible.length})</Text>
                    {statusFilter === 'all' ? (
                      <TouchableOpacity
                        onPress={() => setShowConfirmedSection((prev) => !prev)}
                        style={[styles.toggleConfirmedBtn, { borderColor: theme.colors.border }]}
                      >
                        <Text style={[styles.toggleConfirmedBtnText, { color: theme.colors.text }]}>
                          {shouldShowConfirmedList ? 'Nascondi' : 'Mostra'}
                        </Text>
                        <Feather name={shouldShowConfirmedList ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.text} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {confirmedVisible.map((r) => {
                  if (!shouldShowConfirmedList) return null;

                  const zoneName = r.venue_table?.zona ?? r.venue_table?.nome ?? 'Senza zona';
                  const label = `Zona ${zoneName}`;
                  const assigned = r.venue_table?.numero ? ` • Tavolo ${r.venue_table.numero}` : '';
                  const time = r.created_at ? ` • ${new Date(r.created_at).toLocaleTimeString().slice(0, 5)}` : '';
                  const who =
                    (r.user?.name && r.user.name.trim().length ? r.user.name : null) ??
                    (r.user?.email && r.user.email.trim().length ? r.user.email : null) ??
                    (r.user?.phone && r.user.phone.trim().length ? r.user.phone : null) ??
                    (r.user_id ? `Utente ${r.user_id.slice(0, 6)}` : 'Utente');

                  const amount = expectedAmountForReservation(r);
                  const isBusy = actionReservationId === r.id;
                  const customTableName = String(r.table_name ?? '').trim();

                  return (
                    <View key={r.id} style={[styles.resRow, { borderColor: theme.colors.border }]}> 
                      <View style={styles.resIconWrap}>
                        <Feather name="grid" size={16} color="#9ca3af" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resRowText, { color: theme.colors.text }]} numberOfLines={1}>
                          {label}{assigned} • {r.guests} ospiti{time}
                        </Text>
                        <Text style={[styles.resRowSubText, { color: theme.colors.muted }]} numberOfLines={1}>
                          {who} • {amount === null ? '—' : formatMoney(amount)}
                        </Text>
                        {customTableName ? (
                          <Text style={[styles.resRowNameTag, { color: theme.colors.primary }]} numberOfLines={1}>
                            Nome tavolo: {customTableName}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.rightCol}>
                        <Text style={badgeStyle(r.status)}>{formatReservationStatus(r.status)}</Text>

                        <View style={styles.actionsRow}>
                          {isBusy ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <TouchableOpacity onPress={() => cancelReservationById(r.id)} style={styles.actionRejectBtnCompact}>
                              <Feather name="x" size={15} color="white" />
                              <Text style={styles.actionRejectText}>Annulla</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventChipsRow: {
    paddingVertical: 4,
    paddingRight: 8,
    gap: 10,
  },
  eventChip: {
    width: 180,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  eventChipActive: {
    backgroundColor: 'rgba(109, 91, 255, 0.12)',
  },
  eventChipTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  eventChipTitleActive: {
    color: '#6D5BFF',
  },
  eventChipMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  eventChipMetaActive: {
    color: '#6D5BFF',
  },

  card: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  smallCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallCtaText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  kpiCard: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  kpiIconBg: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: 'white',
  },
  kpiLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  hint: {
    fontSize: 12,
  },
  pendingPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  pendingPanelTop: {
    marginBottom: 8,
  },
  pendingPanelTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  pendingPanelMeta: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  pendingPanelBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pendingPanelBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: 'rgba(109, 91, 255, 0.10)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  clearBtn: {
    padding: 6,
  },

  resRow: {
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  resRowPending: {
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  resIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resIconWrapPending: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  resHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  resTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  resBodyBlock: {
    marginLeft: 38,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 2,
    opacity: 0.95,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  toggleConfirmedBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleConfirmedBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resRowText: {
    fontSize: 13,
    fontWeight: '700',
  },
  resRowSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  resRowNameTag: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 18,
  },
  pendingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  quickActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    padding: 2,
  },
  actionConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22c55e',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionConfirmText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 11,
  },
  actionRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionRejectText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 11,
  },
  pendingPrimaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pendingSecondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionRejectBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
  },
  badgeConfirmed: {
    backgroundColor: '#22c55e',
  },
  badgePending: {
    backgroundColor: '#f59e0b',
  },
  badgeCancelled: {
    backgroundColor: '#ef4444',
  },
  badgeCompleted: {
    backgroundColor: '#0ea5e9',
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    gap: 10,
  },
  mutedText: {
    fontSize: 13,
    textAlign: 'center',
  },
  primaryBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: {
    color: 'white',
    fontWeight: '700',
  },

  errorContainer: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    color: 'white',
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    fontWeight: '700',
  },

  noResultsText: {
    fontSize: 12,
    marginTop: 10,
  },
});
