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

type StatusFilter = 'pending' | 'confirmed';

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
  if (n === null) return 'EUR --';
  return `EUR ${n.toFixed(2)}`;
}

function expectedAmountForReservation(
  r: Reservation,
  opts?: {
    guestsOverride?: number;
    perHeadOverride?: number | null;
    minSpendOverride?: number | null;
    ignoreExplicitTotal?: boolean;
  },
): number | null {
  const guests =
    typeof opts?.guestsOverride === 'number'
      ? opts.guestsOverride
      : typeof r.guests === 'number'
        ? r.guests
        : 0;
  if (guests <= 0) return null;

  const explicit = toNumberSafe(r.total_amount);

  if (!opts?.ignoreExplicitTotal && explicit !== null) return explicit;

  const perHead =
    opts?.perHeadOverride !== undefined
      ? opts.perHeadOverride
      : toNumberSafe(r.venue_table?.per_testa);
  const minSpend =
    opts?.minSpendOverride !== undefined
      ? opts.minSpendOverride
      : toNumberSafe(r.venue_table?.costo_minimo);

  let computed: number | null = null;
  if (perHead !== null) computed = perHead * guests;

  if (minSpend !== null) {
    if (computed === null) return minSpend;
    return Math.max(computed, minSpend);
  }

  // Fallback when only explicit total is known: keep per-person ratio for quick edits.
  if (explicit !== null && r.guests > 0) {
    return (explicit / r.guests) * guests;
  }

  return computed;
}

function guestIdentity(r: Reservation): string {
  return (
    (r.user?.name && r.user.name.trim().length ? r.user.name : null) ??
    (r.user?.email && r.user.email.trim().length ? r.user.email : null) ??
    (r.user?.phone && r.user.phone.trim().length ? r.user.phone : null) ??
    (r.user_id ? `Utente ${r.user_id.slice(0, 6)}` : 'Utente')
  );
}

function reservationZone(r: Reservation): string {
  return String(r.venue_table?.zona ?? r.venue_table?.nome ?? 'Senza zona');
}

function waitingMinutes(r: Reservation): number | null {
  if (!r.created_at) return null;
  const ts = Date.parse(r.created_at);
  if (Number.isNaN(ts)) return null;
  const diff = Math.floor((Date.now() - ts) / 60000);
  return diff >= 0 ? diff : null;
}

export default function VenueReservationsTab(props: Props) {
  const { theme } = useTheme();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [query, setQuery] = useState('');
  const [actionReservationId, setActionReservationId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localReservations, setLocalReservations] = useState<Reservation[]>(
    props.selectedEventReservations ?? [],
  );
  const [tableDrafts, setTableDrafts] = useState<Record<string, string>>({});
  const [guestsDrafts, setGuestsDrafts] = useState<Record<string, number>>({});

  useEffect(() => {
    setLocalReservations(props.selectedEventReservations ?? []);
    setTableDrafts({});
    setGuestsDrafts({});
    setExpandedId(null);
  }, [props.selectedEventReservations, props.selectedEventId]);

  const selected = useMemo(() => {
    if (!props.selectedEventId) return null;
    return props.venueEvents.find((e) => e.id === props.selectedEventId) ?? null;
  }, [props.selectedEventId, props.venueEvents]);

  const sortedEvents = useMemo(() => {
    return [...(props.venueEvents ?? [])].sort(
      (a, b) => (parseEventDateMs(b.date) ?? 0) - (parseEventDateMs(a.date) ?? 0),
    );
  }, [props.venueEvents]);

  const pricingByVenueTableId = useMemo(() => {
    const out = new Map<string, { perHead: number | null; minSpend: number | null }>();
    const rows = Array.isArray(selected?.table_pricing) ? selected.table_pricing : [];

    rows.forEach((row) => {
      if (!row?.venue_table_id) return;
      out.set(row.venue_table_id, {
        perHead: toNumberSafe(row.per_testa),
        minSpend: toNumberSafe(row.costo_minimo),
      });
    });

    return out;
  }, [selected]);

  const getReservationPricing = (reservation: Reservation) => {
    const fromEvent = reservation.venue_table_id
      ? pricingByVenueTableId.get(reservation.venue_table_id)
      : undefined;

    const perHead = fromEvent?.perHead ?? toNumberSafe(reservation.venue_table?.per_testa);
    const minSpend = fromEvent?.minSpend ?? toNumberSafe(reservation.venue_table?.costo_minimo);
    return { perHead, minSpend };
  };

  const tableReservations = useMemo(() => {
    return (localReservations ?? []).filter(
      (r) => r.type === 'table' && (r.status === 'pending' || r.status === 'confirmed'),
    );
  }, [localReservations]);

  const pendingCount = useMemo(
    () => tableReservations.filter((r) => r.status === 'pending').length,
    [tableReservations],
  );
  const confirmedCount = useMemo(
    () => tableReservations.filter((r) => r.status === 'confirmed').length,
    [tableReservations],
  );

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tableReservations
      .filter((r) => r.status === statusFilter)
      .filter((r) => {
        if (!q) return true;
        const who = guestIdentity(r);
        const zone = reservationZone(r);
        const tableNumber = r.venue_table?.numero ? `tavolo ${r.venue_table.numero}` : '';
        const tableName = String(r.table_name ?? '');
        return `${who} ${zone} ${tableNumber} ${tableName}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b.created_at ? Date.parse(b.created_at) : 0;
        return ta - tb;
      });
  }, [query, statusFilter, tableReservations]);

  const pendingVisible = useMemo(
    () => filteredAndSorted.filter((r) => r.status === 'pending'),
    [filteredAndSorted],
  );

  const pendingGuestsVisible = useMemo(
    () => pendingVisible.reduce((sum, r) => sum + (r.guests || 0), 0),
    [pendingVisible],
  );

  const pendingRevenueVisible = useMemo(
    () =>
      pendingVisible.reduce((sum, r) => {
        const pricing = getReservationPricing(r);
        return (
          sum +
          (expectedAmountForReservation(r, {
            perHeadOverride: pricing.perHead,
            minSpendOverride: pricing.minSpend,
          }) ??
            0)
        );
      }, 0),
    [pendingVisible, pricingByVenueTableId],
  );

  const runBackgroundRefresh = () => {
    Promise.resolve(props.onRefresh()).catch(() => undefined);
  };

  const patchLocalReservation = (id: string, patch: Partial<Reservation>) => {
    setLocalReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const mergeServerReservation = (id: string, serverReservation: Reservation | null) => {
    if (!serverReservation) return;
    setLocalReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...serverReservation } : r)),
    );
  };

  const confirmReservation = async (id: string) => {
    const previous = localReservations.find((r) => r.id === id);
    if (!previous) return;

    try {
      setActionReservationId(id);
      patchLocalReservation(id, { status: 'confirmed' });

      const updated = await updateReservation(id, { status: 'confirmed' });
      mergeServerReservation(id, updated);
      runBackgroundRefresh();
    } catch (e: any) {
      patchLocalReservation(id, previous);
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
          const previousById = new Map(
            pendingVisible
              .filter((r) => ids.includes(r.id))
              .map((r) => [r.id, r] as const),
          );

          try {
            setActionReservationId('bulk-confirm');
            setLocalReservations((prev) =>
              prev.map((r) =>
                ids.includes(r.id) ? { ...r, status: 'confirmed' } : r,
              ),
            );

            const settled = await Promise.allSettled(
              ids.map((id) => updateReservation(id, { status: 'confirmed' })),
            );

            const failedIds: string[] = [];
            settled.forEach((s, index) => {
              const reservationId = ids[index];
              if (s.status === 'fulfilled') {
                mergeServerReservation(reservationId, s.value);
                return;
              }
              failedIds.push(reservationId);
            });

            if (failedIds.length) {
              setLocalReservations((prev) =>
                prev.map((r) => previousById.get(r.id) ?? r),
              );
            }

            const ok = settled.filter((s) => s.status === 'fulfilled').length;
            const ko = settled.length - ok;
            runBackgroundRefresh();

            if (ko > 0) {
              Alert.alert('Conferma parziale', `Confermate ${ok} richieste, ${ko} non riuscite.`);
            }
          } catch (e: any) {
            setLocalReservations((prev) => prev.map((r) => previousById.get(r.id) ?? r));
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
    Alert.alert('Annullare prenotazione?', 'La prenotazione verra annullata.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Annulla',
        style: 'destructive',
        onPress: async () => {
          const previous = localReservations.find((r) => r.id === id);
          if (!previous) return;

          try {
            setActionReservationId(id);
            patchLocalReservation(id, { status: 'cancelled' });
            const updated = await cancelReservation(id);
            mergeServerReservation(id, updated);
            runBackgroundRefresh();
          } catch (e: any) {
            patchLocalReservation(id, previous);
            const msg = e?.response?.data?.message || e?.message || 'Impossibile annullare la prenotazione';
            Alert.alert('Errore', String(msg));
          } finally {
            setActionReservationId(null);
          }
        },
      },
    ]);
  };

  const saveQueuedEdits = async (reservation: Reservation) => {
    const currentGuests = reservation.guests || 1;
    const draftGuests = Math.max(
      1,
      Math.floor(guestsDrafts[reservation.id] ?? currentGuests),
    );
    const currentTableName = String(reservation.table_name ?? '').trim();
    const draftTableName = String(tableDrafts[reservation.id] ?? currentTableName).trim();
    const nextTableName = draftTableName.length ? draftTableName : null;
    const pricing = getReservationPricing(reservation);
    const recalculatedAmount = expectedAmountForReservation(reservation, {
      guestsOverride: draftGuests,
      perHeadOverride: pricing.perHead,
      minSpendOverride: pricing.minSpend,
      ignoreExplicitTotal: true,
    });
    const normalizedRecalculatedAmount =
      recalculatedAmount === null ? undefined : Number(recalculatedAmount.toFixed(2));

    const payload: { guests?: number; table_name?: string | null; total_amount?: number } = {};
    if (draftGuests !== currentGuests) payload.guests = draftGuests;
    if ((nextTableName ?? '') !== currentTableName) payload.table_name = nextTableName;
    if (draftGuests !== currentGuests && normalizedRecalculatedAmount !== undefined) {
      payload.total_amount = normalizedRecalculatedAmount;
    }
    if (Object.keys(payload).length === 0) return;

    const previousGuests = currentGuests;
    const previousTableName = reservation.table_name ?? null;

    try {
      setActionReservationId(reservation.id);
      patchLocalReservation(reservation.id, {
        guests: payload.guests ?? currentGuests,
        table_name: payload.table_name !== undefined ? payload.table_name : previousTableName,
        total_amount:
          payload.total_amount !== undefined
            ? payload.total_amount
            : reservation.total_amount,
      });

      const updated = await updateReservation(reservation.id, payload);
      mergeServerReservation(reservation.id, updated);
      setGuestsDrafts((prev) => ({
        ...prev,
        [reservation.id]: payload.guests ?? currentGuests,
      }));
      setTableDrafts((prev) => ({
        ...prev,
        [reservation.id]: payload.table_name === undefined
          ? currentTableName
          : payload.table_name ?? '',
      }));
      runBackgroundRefresh();
    } catch (e: any) {
      patchLocalReservation(reservation.id, {
        guests: previousGuests,
        table_name: previousTableName,
      });
      setGuestsDrafts((prev) => ({
        ...prev,
        [reservation.id]: previousGuests,
      }));
      setTableDrafts((prev) => ({
        ...prev,
        [reservation.id]: String(previousTableName ?? ''),
      }));
      const msg = e?.response?.data?.message || e?.message || 'Impossibile salvare le modifiche';
      Alert.alert('Errore', String(msg));
    } finally {
      setActionReservationId(null);
    }
  };

  const renderQueueCard = (r: Reservation) => {
    const who = guestIdentity(r);
    const zone = reservationZone(r);
    const waitMins = waitingMinutes(r);
    const isLate = r.status === 'pending' && (waitMins ?? 0) >= 45;
    const tableLabel = r.venue_table?.numero ? `Tavolo ${r.venue_table.numero}` : 'Da assegnare';
    const customTableName = String(r.table_name ?? '').trim();
    const currentGuests = r.guests || 1;
    const draftGuests = Math.max(1, Math.floor(guestsDrafts[r.id] ?? currentGuests));
    const draftTableRaw = String(tableDrafts[r.id] ?? customTableName);
    const draftTableName = draftTableRaw.trim();
    const nextDraftTableName = draftTableName.length ? draftTableName : null;
    const hasGuestChanges = draftGuests !== currentGuests;
    const hasTableChanges = (nextDraftTableName ?? '') !== customTableName;
    const hasUnsavedChanges = hasGuestChanges || hasTableChanges;
    const expanded = expandedId === r.id;
    const pricing = getReservationPricing(r);
    const amount = expectedAmountForReservation(r, {
      perHeadOverride: pricing.perHead,
      minSpendOverride: pricing.minSpend,
    });
    const liveDraftAmount = expectedAmountForReservation(r, {
      guestsOverride: draftGuests,
      perHeadOverride: pricing.perHead,
      minSpendOverride: pricing.minSpend,
      ignoreExplicitTotal: true,
    });
    const amountToShow = expanded ? liveDraftAmount ?? amount : amount;
    const isBusy = actionReservationId === r.id || actionReservationId === 'bulk-confirm';

    const cardBorderColor =
      expanded && r.status === 'pending'
        ? '#d4b24f'
        : isLate
          ? '#ef4444'
          : theme.colors.border;

    return (
      <View
        key={r.id}
        style={[
          styles.queueCard,
          {
            borderColor: cardBorderColor,
            backgroundColor: expanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
          },
        ]}
      >
        {expanded ? <View style={[styles.activeRail, { backgroundColor: '#d4b24f' }]} /> : null}

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.queueMainRow}
          onPress={() =>
            setExpandedId((prev) => {
              const next = prev === r.id ? null : r.id;
              if (next === r.id) {
                setTableDrafts((drafts) => ({
                  ...drafts,
                  [r.id]: customTableName,
                }));
                setGuestsDrafts((drafts) => ({
                  ...drafts,
                  [r.id]: currentGuests,
                }));
              }
              return next;
            })
          }
        >
          <View style={styles.infoCol}>
            <View style={styles.nameRow}>
              <Text style={[styles.guestName, { color: theme.colors.text }]} numberOfLines={1}>
                {who}
              </Text>
              <View style={[styles.guestBadge, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                <Feather name="users" size={10} color={theme.colors.muted} />
                <Text style={[styles.guestBadgeText, { color: theme.colors.text }]}>
                  {expanded ? draftGuests : r.guests || 0}
                </Text>
              </View>
              {isLate ? (
                <View style={styles.latePill}>
                  <Text style={styles.latePillText}>In ritardo</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: theme.colors.muted }]} numberOfLines={1}>
                {zone}
              </Text>
              <View style={[styles.dot, { backgroundColor: theme.colors.border }]} />
              <Text style={styles.moneyText} numberOfLines={1}>
                {formatMoney(amountToShow)} EST
              </Text>
            </View>

            <View style={styles.metaRowSecondary}>
              <Text style={[styles.secondaryMetaText, { color: theme.colors.muted }]} numberOfLines={1}>
                {customTableName || tableLabel}
              </Text>
              {waitMins !== null ? (
                <Text style={[styles.secondaryMetaText, { color: isLate ? '#ef4444' : theme.colors.muted }]}>
                  In attesa da {waitMins} min
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.actionsCol}>
            {isBusy ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.iconAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                  onPress={() => cancelReservationById(r.id)}
                >
                  <Feather name="x" size={17} color="#ef4444" />
                </TouchableOpacity>
                {r.status === 'pending' ? (
                  <TouchableOpacity
                    style={[styles.iconActionPrimary, { backgroundColor: '#d4b24f' }]}
                    onPress={() => confirmReservation(r.id)}
                  >
                    <Feather name="check" size={17} color="#121212" />
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </TouchableOpacity>

        {expanded ? (
          <View style={[styles.expandedPanel, { borderTopColor: theme.colors.border }]}>
            <View style={styles.expandedGrid}>
              <View style={styles.expandedCell}>
                <Text style={[styles.expandedLabel, { color: theme.colors.muted }]}>Zona richiesta</Text>
                <Text style={[styles.expandedValue, { color: theme.colors.text }]} numberOfLines={1}>
                  {zone}
                </Text>
              </View>

              <View style={styles.expandedCell}>
                <Text style={[styles.expandedLabel, { color: theme.colors.muted }]}>Spesa attuale</Text>
                <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{formatMoney(amountToShow)}</Text>
              </View>

              <View style={styles.expandedCell}>
                <Text style={[styles.expandedLabel, { color: theme.colors.muted }]}>Tavolo assegnato</Text>
                <Text style={[styles.expandedValue, { color: theme.colors.text }]} numberOfLines={1}>
                  {customTableName || tableLabel}
                </Text>
              </View>
            </View>

            <View style={[styles.quickActionsPanel, { borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.02)' }]}>
              <Text style={[styles.quickActionsTitle, { color: theme.colors.text }]}>Modifiche last-minute</Text>

              <View style={styles.quickGuestsRow}>
                <Text style={[styles.quickLabel, { color: theme.colors.muted }]}>Ospiti</Text>
                <View style={styles.quickStepperWrap}>
                  <TouchableOpacity
                    onPress={() =>
                      setGuestsDrafts((prev) => ({
                        ...prev,
                        [r.id]: Math.max(1, draftGuests - 1),
                      }))
                    }
                    disabled={isBusy || draftGuests <= 1}
                    style={[
                      styles.quickStepperBtn,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                        opacity: isBusy || draftGuests <= 1 ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Feather name="minus" size={14} color={theme.colors.text} />
                  </TouchableOpacity>

                  <Text style={[styles.quickGuestsValue, { color: theme.colors.text }]}>{draftGuests}</Text>

                  <TouchableOpacity
                    onPress={() =>
                      setGuestsDrafts((prev) => ({
                        ...prev,
                        [r.id]: draftGuests + 1,
                      }))
                    }
                    disabled={isBusy}
                    style={[
                      styles.quickStepperBtn,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                        opacity: isBusy ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Feather name="plus" size={14} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.quickTableRow}>
                <Text style={[styles.quickLabel, { color: theme.colors.muted }]}>Nome tavolo</Text>
                <View style={[styles.quickTableInputWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                  <Feather name="edit-3" size={14} color={theme.colors.muted} />
                  <TextInput
                    value={draftTableRaw}
                    onChangeText={(value) =>
                      setTableDrafts((prev) => ({
                        ...prev,
                        [r.id]: value,
                      }))
                    }
                    editable={!isBusy}
                    placeholder="Es. Privé 3"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.quickTableInput, { color: theme.colors.text }]}
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                </View>
              </View>

              {hasUnsavedChanges ? (
                <Text style={[styles.quickUnsavedText, { color: '#f0d785' }]}>Modifiche non salvate</Text>
              ) : (
                <Text style={[styles.quickSavedText, { color: theme.colors.muted }]}>Nessuna modifica in sospeso</Text>
              )}

              <View style={styles.quickTableActions}>
                <TouchableOpacity
                  onPress={() => {
                    setGuestsDrafts((prev) => ({
                      ...prev,
                      [r.id]: currentGuests,
                    }));
                    setTableDrafts((prev) => ({
                      ...prev,
                      [r.id]: customTableName,
                    }));
                  }}
                  disabled={isBusy}
                  style={[
                    styles.quickGhostBtn,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.card, opacity: isBusy ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.quickGhostBtnText, { color: theme.colors.text }]}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => saveQueuedEdits(r)}
                  disabled={isBusy || !hasUnsavedChanges}
                  style={[
                    styles.quickPrimaryBtn,
                    { backgroundColor: '#d4b24f', opacity: isBusy || !hasUnsavedChanges ? 0.65 : 1 },
                  ]}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color="#151515" />
                  ) : (
                    <Feather name="save" size={14} color="#151515" />
                  )}
                  <Text style={styles.quickPrimaryBtnText}>Salva modifiche</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const showEmptyEventState = sortedEvents.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={[styles.bgGlowTop, { backgroundColor: 'rgba(212,178,79,0.08)' }]} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={() => props.onRefresh({ refreshing: true })} />}
      >
        <View style={[styles.headerShell, { borderBottomColor: theme.colors.border, backgroundColor: 'rgba(10,12,16,0.88)' }]}>
          <View style={styles.headerTop}>
            <View style={styles.liveWrap}>
              <View style={styles.liveDotOuter}>
                <View style={styles.liveDotInner} />
              </View>
              <Text style={[styles.liveLabel, { color: theme.colors.text }]}>Coda live</Text>
            </View>

            <TouchableOpacity
              style={[styles.roundIconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
              onPress={props.onGoToEvents}
            >
              <Feather name="calendar" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.eventName, { color: theme.colors.text }]} numberOfLines={1}>
            {selected ? selected.name : 'Seleziona un evento'}
          </Text>
          <Text style={[styles.eventDate, { color: theme.colors.muted }]} numberOfLines={1}>
            {selected ? formatEventDate(selected.date) : 'Scegli un evento dalla lista qui sotto'}
          </Text>

          <View style={[styles.segmentShell, { borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.04)' }]}>
            <TouchableOpacity
              onPress={() => setStatusFilter('pending')}
              style={[
                styles.segmentBtn,
                statusFilter === 'pending'
                  ? { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: statusFilter === 'pending' ? theme.colors.text : theme.colors.muted },
                ]}
              >
                Coda ({pendingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStatusFilter('confirmed')}
              style={[
                styles.segmentBtn,
                statusFilter === 'confirmed'
                  ? { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: statusFilter === 'confirmed' ? theme.colors.text : theme.colors.muted },
                ]}
              >
                Confermate ({confirmedCount})
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.segmentHint, { color: theme.colors.muted }]}>
            {statusFilter === 'pending'
              ? 'Richieste da gestire: apri una card per modifiche rapide su ospiti e tavolo.'
              : 'Prenotazioni confermate: puoi ancora aggiornare tavolo e numero ospiti.'}
          </Text>
        </View>

        {showEmptyEventState ? (
          <View style={styles.emptyBlock}>
            <Feather name="calendar" size={24} color={theme.colors.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Nessun evento disponibile.</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#d4b24f' }]} onPress={props.onGoToEvents}>
              <Text style={styles.primaryBtnText}>Vai agli eventi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRow}>
            {sortedEvents.map((e) => {
              const active = e.id === props.selectedEventId;
              return (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => props.onSelectEventId(e.id)}
                  style={[
                    styles.eventChip,
                    {
                      borderColor: active ? '#d4b24f' : theme.colors.border,
                      backgroundColor: active ? 'rgba(212,178,79,0.14)' : theme.colors.card,
                    },
                  ]}
                >
                  <Text style={[styles.eventChipTitle, { color: active ? '#f9e9b3' : theme.colors.text }]} numberOfLines={1}>
                    {e.name}
                  </Text>
                  <Text style={[styles.eventChipDate, { color: active ? '#f0d785' : theme.colors.muted }]} numberOfLines={1}>
                    {formatEventDate(e.date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.toolsRow}>
          <View style={[styles.searchBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <Feather name="user" size={16} color={theme.colors.muted} />
            <TextInput
              placeholder="Cerca ospite, zona o tavolo..."
              placeholderTextColor={theme.colors.muted}
              value={query}
              onChangeText={setQuery}
              style={[styles.searchInput, { color: theme.colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Feather name="x" size={16} color={theme.colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.quickAddBtn,
              {
                borderColor: theme.colors.border,
                backgroundColor: props.selectedEventId ? '#d4b24f' : theme.colors.card,
              },
            ]}
            onPress={props.onOpenCreateReservation}
            disabled={!props.selectedEventId}
          >
            <Feather
              name="plus"
              size={16}
              color={props.selectedEventId ? '#151515' : theme.colors.muted}
            />
            <Text
              style={[
                styles.quickAddText,
                { color: props.selectedEventId ? '#151515' : theme.colors.muted },
              ]}
            >
              Nuova
            </Text>
          </TouchableOpacity>
        </View>

        {statusFilter === 'pending' && pendingVisible.length > 0 ? (
          <View style={[styles.bulkCard, { borderColor: theme.colors.border, backgroundColor: 'rgba(212,178,79,0.12)' }]}>
            <Text style={[styles.bulkTitle, { color: theme.colors.text }]}>Coda da confermare</Text>
            <Text style={[styles.bulkMeta, { color: theme.colors.muted }]}>
              {pendingVisible.length} richieste - {pendingGuestsVisible} ospiti - {formatMoney(pendingRevenueVisible)}
            </Text>
            <TouchableOpacity
              onPress={confirmAllPending}
              disabled={actionReservationId === 'bulk-confirm'}
              style={[styles.bulkBtn, { backgroundColor: '#d4b24f', opacity: actionReservationId === 'bulk-confirm' ? 0.6 : 1 }]}
            >
              {actionReservationId === 'bulk-confirm' ? (
                <ActivityIndicator size="small" color="#141414" />
              ) : (
                <Feather name="check" size={16} color="#141414" />
              )}
              <Text style={styles.bulkBtnText}>Conferma tutte</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!props.selectedEventId ? (
          <View style={styles.emptyBlock}>
            <Feather name="info" size={22} color={theme.colors.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Seleziona un evento per aprire la coda operativa.</Text>
          </View>
        ) : props.loading ? (
          <View style={styles.emptyBlock}>
            <ActivityIndicator size="large" color="#d4b24f" />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Caricamento prenotazioni...</Text>
          </View>
        ) : props.error ? (
          <View style={[styles.errorBox, { borderColor: '#ef4444' }]}>
            <Feather name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{props.error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { borderColor: theme.colors.border }]} onPress={() => props.onRefresh()}>
              <Text style={[styles.retryText, { color: theme.colors.text }]}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : filteredAndSorted.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Feather name="inbox" size={22} color={theme.colors.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Nessuna prenotazione per i filtri attuali.</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            <View style={[styles.resultBar, { borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.03)' }]}>
              <Text style={[styles.resultBarText, { color: theme.colors.muted }]}>
                {filteredAndSorted.length} prenotazioni mostrate
              </Text>
            </View>
            {filteredAndSorted.map(renderQueueCard)}
          </View>
        )}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgGlowTop: {
    position: 'absolute',
    top: -140,
    left: -50,
    right: -50,
    height: 340,
    borderRadius: 260,
  },
  scrollContent: {
    paddingBottom: 26,
  },
  headerShell: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDotOuter: {
    width: 12,
    height: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,178,79,0.35)',
  },
  liveDotInner: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: '#d4b24f',
  },
  liveLabel: {
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '900',
  },
  roundIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventName: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '800',
  },
  eventDate: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  segmentShell: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    flexDirection: 'row',
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  segmentHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
  },
  eventRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  eventChip: {
    width: 180,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  eventChipTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  eventChipDate: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
  },
  toolsRow: {
    marginTop: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  quickAddBtn: {
    minWidth: 96,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
  },
  quickAddText: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  bulkCard: {
    marginTop: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
  },
  bulkTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  bulkMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  bulkBtn: {
    marginTop: 9,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  bulkBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#131313',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  listWrap: {
    marginTop: 10,
    paddingHorizontal: 16,
    gap: 9,
  },
  resultBar: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  resultBarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  queueCard: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  activeRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  queueMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guestName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  guestBadge: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  guestBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  latePill: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  latePillText: {
    fontSize: 9,
    color: '#ef4444',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metaRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaRowSecondary: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  secondaryMetaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '45%',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 4,
  },
  moneyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#82d77a',
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionPrimary: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedPanel: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  expandedGrid: {
    flexDirection: 'row',
    gap: 9,
  },
  expandedCell: {
    flex: 1,
  },
  expandedLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  expandedValue: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  quickActionsPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  quickActionsTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  quickGuestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  quickStepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickStepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGuestsValue: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  quickTableRow: {
    gap: 6,
  },
  quickUnsavedText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  quickSavedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  quickTableInputWrap: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickTableInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  quickTableActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickGhostBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
  },
  quickGhostBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  quickPrimaryBtn: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    flexDirection: 'row',
    gap: 6,
  },
  quickPrimaryBtnText: {
    color: '#151515',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  emptyBlock: {
    paddingHorizontal: 16,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: {
    color: '#151515',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  errorBox: {
    marginTop: 14,
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  errorText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    fontWeight: '800',
    fontSize: 12,
  },
  footerSpacer: {
    height: 110,
  },
});