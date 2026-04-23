import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import {
  fetchVenueTransactions,
  refundVenueOrder,
  refundVenueOrdersBulk,
  type VenueTransaction,
} from '../../services/payments';

function formatMoney(value?: number, currency?: string) {
  const amount = Number(value ?? 0);
  const normalizedCurrency = (currency || 'EUR').toUpperCase();
  if (!Number.isFinite(amount)) return '—';
  return `${normalizedCurrency} ${amount.toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusTone(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') {
    return {
      label: 'Paid',
      color: '#7EE081',
      soft: 'rgba(126,224,129,0.14)',
      border: 'rgba(126,224,129,0.3)',
    };
  }
  if (normalized === 'cancelled') {
    return {
      label: 'Cancelled',
      color: '#FF6B6B',
      soft: 'rgba(255,107,107,0.14)',
      border: 'rgba(255,107,107,0.3)',
    };
  }
  if (normalized === 'failed') {
    return {
      label: 'Failed',
      color: '#F4C95D',
      soft: 'rgba(244,201,93,0.16)',
      border: 'rgba(244,201,93,0.32)',
    };
  }
  return {
    label: 'Created',
    color: '#9CA3AF',
    soft: 'rgba(156,163,175,0.16)',
    border: 'rgba(156,163,175,0.3)',
  };
}

export default function VenueTransactionsScreen() {
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState<VenueTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [bulkRefunding, setBulkRefunding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'cancelled' | 'created' | 'failed'>('all');
  const [refundFilter, setRefundFilter] = useState<'all' | 'refundable' | 'refunded'>('all');
  const [query, setQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const load = useCallback(async (opts?: { refreshing?: boolean }) => {
    try {
      if (opts?.refreshing) setRefreshing(true);
      else setLoading(true);

      setError(null);
      const list = await fetchVenueTransactions(100);
      setTransactions(Array.isArray(list) ? list : []);
      setSelectedOrderIds([]);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Impossibile caricare le transazioni');
      if (!opts?.refreshing) setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return transactions.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      const isRefunded =
        t.refunded_status === 'full' || Number(t.refunded_amount || 0) > 0;
      const isRefundable =
        t.status === 'paid' && Number(t.refundable_remaining || 0) > 0;

      if (refundFilter === 'refundable' && !isRefundable) return false;
      if (refundFilter === 'refunded' && !isRefunded) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        t.id,
        t.event?.name,
        t.user?.name,
        t.user?.email,
        t.user_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [transactions, statusFilter, refundFilter, query]);

  const refundableVisibleIds = useMemo(
    () =>
      filteredTransactions
        .filter(
          (t) => t.status === 'paid' && Number(t.refundable_remaining || 0) > 0,
        )
        .map((t) => t.id),
    [filteredTransactions],
  );

  const selectedVisibleCount = useMemo(
    () => selectedOrderIds.filter((id) => refundableVisibleIds.includes(id)).length,
    [selectedOrderIds, refundableVisibleIds],
  );

  const paidCount = useMemo(
    () => filteredTransactions.filter((t) => t.status === 'paid').length,
    [filteredTransactions],
  );

  const totalGross = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + Number(t.amount_total || 0), 0),
    [filteredTransactions],
  );

  const totalRefunded = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + Number(t.refunded_amount || 0), 0),
    [filteredTransactions],
  );

  const refundableCount = useMemo(
    () => filteredTransactions.filter((t) => t.status === 'paid' && Number(t.refundable_remaining || 0) > 0).length,
    [filteredTransactions],
  );

  const toggleSelect = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  };

  const toggleSelectAllVisible = () => {
    const allSelected = refundableVisibleIds.every((id) => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !refundableVisibleIds.includes(id)));
      return;
    }

    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      refundableVisibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const submitRefundForOrders = async (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    setBulkRefunding(true);

    let success = 0;
    let failed = 0;

    try {
      const response = await refundVenueOrdersBulk({
        orderIds,
        reason: 'requested_by_customer',
      });

      success = response.success;
      failed = response.failed;
    } catch (e: any) {
      setBulkRefunding(false);
      Alert.alert(
        'Errore',
        e?.response?.data?.message || e?.message || 'Impossibile rimborsare',
      );
      return;
    }

    setBulkRefunding(false);
    setSelectedOrderIds([]);
    setSelectionMode(false);
    await load({ refreshing: true });

    if (failed === 0) {
      Alert.alert('Rimborsi completati', `${success} rimborsi eseguiti con successo.`);
      return;
    }

    Alert.alert('Rimborso parziale', `Completati: ${success} • Falliti: ${failed}`);
  };

  const onRefund = (transaction: VenueTransaction) => {
    const amount =
      Number(transaction.refundable_remaining || 0) > 0
        ? Number(transaction.refundable_remaining || 0)
        : Number(transaction.ticket_amount || 0);

    Alert.alert(
      'Conferma rimborso',
      `Rimborso solo biglietto (fee escluse): ${formatMoney(amount, transaction.currency)}. Vuoi continuare?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimborsa',
          style: 'destructive',
          onPress: async () => {
            try {
              setRefundingOrderId(transaction.id);
              await refundVenueOrder({ orderId: transaction.id, reason: 'requested_by_customer' });
              Alert.alert('Rimborso inviato', 'Operazione completata con successo.');
              await load({ refreshing: true });
            } catch (e: any) {
              Alert.alert('Errore', e?.response?.data?.message || e?.message || 'Impossibile rimborsare');
            } finally {
              setRefundingOrderId(null);
            }
          },
        },
      ],
    );
  };

  const onBulkRefund = () => {
    const refundableSelected = selectedOrderIds.filter((id) => refundableVisibleIds.includes(id));
    if (refundableSelected.length === 0) return;

    Alert.alert(
      'Conferma rimborso multiplo',
      `Vuoi rimborsare ${refundableSelected.length} transazioni selezionate?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimborsa tutte',
          style: 'destructive',
          onPress: () => {
            void submitRefundForOrders(refundableSelected);
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refreshing: true })} />}
    >
      <View style={styles.heroShell}>
        <View style={styles.heroGlow} />
        <View style={[styles.heroCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroEyebrowRow}>
              <View style={styles.livePulseWrap}>
                <View style={styles.livePulseDot} />
              </View>
              <Text style={[styles.heroEyebrow, { color: theme.colors.muted }]}>FINANCE CONTROL</Text>
            </View>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[styles.heroIconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => load({ refreshing: true })}
                disabled={loading || refreshing || bulkRefunding}
              >
                <Feather name="refresh-cw" size={16} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.heroToggleButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={() => {
                  setSelectionMode((prev) => !prev);
                  setSelectedOrderIds([]);
                }}
                disabled={loading || refreshing || bulkRefunding}
              >
                <Text style={[styles.heroToggleButtonText, { color: theme.colors.text }]}>{selectionMode ? 'Fine' : 'Seleziona'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Transazioni</Text>
          <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>
            Monitora incassi, stato ordini e rimborsi in un unico pannello operativo. {filteredTransactions.length} risultati con i filtri attivi.
          </Text>

          <View style={styles.heroStatsGrid}>
            <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
              <Text style={[styles.kpiLabel, { color: theme.colors.muted }]}>Pagati</Text>
              <Text style={[styles.kpiValue, { color: theme.colors.text }]}>{paidCount}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
              <Text style={[styles.kpiLabel, { color: theme.colors.muted }]}>Incassato</Text>
              <Text style={[styles.kpiValue, { color: theme.colors.text }]}>{formatMoney(totalGross, transactions[0]?.currency)}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
              <Text style={[styles.kpiLabel, { color: theme.colors.muted }]}>Rimborsato</Text>
              <Text style={[styles.kpiValue, { color: theme.colors.text }]}>{formatMoney(totalRefunded, transactions[0]?.currency)}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
              <Text style={[styles.kpiLabel, { color: theme.colors.muted }]}>Rimborsabili</Text>
              <Text style={[styles.kpiValue, { color: theme.colors.text }]}>{refundableCount}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={theme.colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cerca evento, cliente o ID ordine"
            placeholderTextColor={theme.colors.muted}
            style={[styles.searchInput, { color: theme.colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x-circle" size={16} color={theme.colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filtersRow}>
          {[
            { key: 'all', label: 'Tutti' },
            { key: 'paid', label: 'Pagati' },
            { key: 'cancelled', label: 'Annullati' },
            { key: 'failed', label: 'Falliti' },
          ].map((item) => {
            const active = statusFilter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setStatusFilter(item.key as 'all' | 'paid' | 'cancelled' | 'failed' | 'created')}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? 'white' : theme.colors.text }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filtersRow}>
          {[
            { key: 'all', label: 'Tutti i rimborsi' },
            { key: 'refundable', label: 'Rimborsabili' },
            { key: 'refunded', label: 'Gia rimborsati' },
          ].map((item) => {
            const active = refundFilter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setRefundFilter(item.key as 'all' | 'refundable' | 'refunded')}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? 'white' : theme.colors.text }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {selectionMode ? (
        <View style={[styles.multiBar, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
          <Text style={[styles.multiBarText, { color: theme.colors.text }]}>{selectedVisibleCount} selezionate</Text>
          <View style={styles.multiActions}>
            <TouchableOpacity
              style={[styles.multiBtn, { borderColor: theme.colors.border }]}
              onPress={toggleSelectAllVisible}
              disabled={bulkRefunding}
            >
              <Text style={[styles.multiBtnText, { color: theme.colors.text }]}>Tutte</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.multiRefundBtn,
                { backgroundColor: theme.colors.primary },
                selectedVisibleCount === 0 || bulkRefunding ? { opacity: 0.55 } : null,
              ]}
              onPress={onBulkRefund}
              disabled={selectedVisibleCount === 0 || bulkRefunding}
            >
              {bulkRefunding ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.multiRefundBtnText}>Rimborsa selezionate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.muted, { color: theme.colors.muted }]}>Caricamento transazioni...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Feather name="alert-circle" size={34} color={theme.colors.error} />
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => load()}
          >
            <Text style={styles.retryText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.centerBox}>
          <Feather name="credit-card" size={34} color={theme.colors.muted} />
          <Text style={[styles.muted, { color: theme.colors.muted }]}>Nessuna transazione con i filtri attivi</Text>
        </View>
      ) : (
        filteredTransactions.map((t) => {
          const isFullyRefunded = t.refunded_status === 'full';
          const canRefund = t.status === 'paid' && Number(t.refundable_remaining || 0) > 0;
          const selected = selectedOrderIds.includes(t.id);
          const tone = getStatusTone(t.status);

          return (
            <View
              key={t.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  {selectionMode && canRefund ? (
                    <TouchableOpacity
                      style={[
                        styles.checkCircle,
                        {
                          borderColor: selected ? theme.colors.primary : theme.colors.border,
                          backgroundColor: selected ? theme.colors.primary : 'transparent',
                        },
                      ]}
                      onPress={() => toggleSelect(t.id)}
                      disabled={bulkRefunding}
                    >
                      {selected ? <Feather name="check" size={14} color="white" /> : null}
                    </TouchableOpacity>
                  ) : null}

                  <View style={[styles.orderIconWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Feather name="credit-card" size={15} color={theme.colors.text} />
                  </View>

                  <Text style={[styles.eventName, { color: theme.colors.text }]} numberOfLines={1}>
                    {t.event?.name || 'Evento'}
                  </Text>
                </View>

                <View style={[styles.badge, { backgroundColor: tone.soft, borderColor: tone.border }]}> 
                  <Text style={[styles.badgeText, { color: tone.color }]}>{tone.label}</Text>
                </View>
              </View>

              <Text style={[styles.meta, { color: theme.colors.muted }]}>Ordine {t.id.slice(0, 8)} • {formatDate(t.paid_at || t.created_at)}</Text>
              <Text style={[styles.meta, { color: theme.colors.muted }]}>Cliente: {t.user?.name || t.user?.email || t.user_id}</Text>

              <View style={[styles.amountStrip, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
                <View style={styles.amountRow}>
                  <Text style={[styles.meta, { color: theme.colors.muted }]}>Totale</Text>
                  <Text style={[styles.amount, { color: theme.colors.text }]}>{formatMoney(t.amount_total, t.currency)}</Text>
                </View>
                <View style={styles.amountRow}>
                  <Text style={[styles.meta, { color: theme.colors.muted }]}>Quantita</Text>
                  <Text style={[styles.metaStrong, { color: theme.colors.text }]}>x{t.quantity}</Text>
                </View>
                <View style={styles.amountRow}>
                  <Text style={[styles.meta, { color: theme.colors.muted }]}>Quota biglietto</Text>
                  <Text style={[styles.metaStrong, { color: theme.colors.text }]}>{formatMoney(t.ticket_amount, t.currency)}</Text>
                </View>
              </View>

              <View style={styles.refundRow}>
                <View style={styles.refundTextWrap}>
                  <Text style={[styles.meta, { color: theme.colors.muted }]}>Rimborsato: {formatMoney(t.refunded_amount, t.currency)}</Text>
                  <Text style={[styles.meta, { color: theme.colors.muted }]}>Residuo biglietto: {formatMoney(t.refundable_remaining, t.currency)}</Text>
                </View>

                {canRefund ? (
                  <TouchableOpacity
                    style={[
                      styles.refundBtn,
                      { backgroundColor: theme.colors.primary },
                      refundingOrderId === t.id || bulkRefunding ? { opacity: 0.6 } : null,
                    ]}
                    onPress={() => onRefund(t)}
                    disabled={refundingOrderId === t.id || bulkRefunding || selectionMode}
                  >
                    {refundingOrderId === t.id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.refundBtnText}>{selectionMode ? 'Seleziona sopra' : 'Rimborsa'}</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noRefundPill}>
                    <Text style={styles.noRefundText}>{isFullyRefunded ? 'Rimborsato' : 'Non rimborsabile'}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingBottom: 132,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 14,
  },
  heroShell: {
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: 10,
    right: 16,
    width: 130,
    height: 130,
    borderRadius: 999,
    opacity: 0.15,
    backgroundColor: '#67B7FF',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    gap: 16,
    overflow: 'hidden',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  livePulseWrap: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(103,183,255,0.35)',
    backgroundColor: 'rgba(103,183,255,0.18)',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#67B7FF',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroToggleButton: {
    borderWidth: 1,
    borderRadius: 999,
    height: 42,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroToggleButtonText: {
    fontSize: 12,
    fontWeight: '800',
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
    maxWidth: '94%',
  },
  heroStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
    minHeight: 90,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  sectionBlock: {
    gap: 10,
  },
  searchWrap: {
    borderRadius: 18,
    paddingHorizontal: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 11,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  multiBar: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  multiBarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  multiActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multiBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  multiBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  multiRefundBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 138,
    alignItems: 'center',
  },
  multiRefundBtnText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '900',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 56,
    paddingHorizontal: 28,
    gap: 10,
  },
  muted: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  error: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  retryText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
  },
  card: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountStrip: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 7,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amount: {
    fontSize: 18,
    fontWeight: '900',
  },
  metaStrong: {
    fontSize: 12,
    fontWeight: '800',
  },
  refundRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  refundTextWrap: {
    flex: 1,
    gap: 2,
  },
  refundBtn: {
    borderRadius: 12,
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  refundBtnText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 12,
  },
  noRefundPill: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  noRefundText: {
    color: '#9ca3af',
    fontWeight: '800',
    fontSize: 11,
  },
});
