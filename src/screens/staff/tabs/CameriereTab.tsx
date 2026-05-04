import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../../theme/ThemeProvider";
import { fetchVenuePricing } from "../../../services/venues";
import {
  addTablePayment,
  createTableBottleOrder,
  getWaiterTables,
  settleTable,
  type WaiterTable,
} from "../../../services/staff";
import type { VenuePricing } from "../../../types/events";

export default function CameriereTab({ openPrompt, showToast, userId, eventId, venueId }: any) {
  const { theme } = useTheme();
  const [tavoli, setTavoli] = useState<WaiterTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importiSaldati, setImportiSaldati] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogoBottiglie, setCatalogoBottiglie] = useState<VenuePricing['bottle_price_list']>([]);
  const [bottleModalVisible, setBottleModalVisible] = useState(false);
  const [selectedTableForBottle, setSelectedTableForBottle] = useState<string | null>(null);
  const [selectedBottleKey, setSelectedBottleKey] = useState<string | null>(null);
  const [selectedBottleQuantity, setSelectedBottleQuantity] = useState('1');

  const refreshTables = useCallback(async () => {
    if (!eventId || !userId) {
      setTavoli([]);
      setError(null);
      setLoading(false);
      return;
    }

    const data = await getWaiterTables(String(userId), String(eventId), {
      onlyBooked: true,
      venueId: venueId ? String(venueId) : undefined,
    });

    setTavoli(data);
    setImportiSaldati(prev => {
      const next = { ...prev };
      data.forEach(t => {
        if (t.is_saldato && next[t.id] === undefined) {
          next[t.id] = Number(t.pagato_totale || 0);
        }
      });
      return next;
    });
    setError(null);
  }, [eventId, userId, venueId]);

  const refreshBottleCatalog = useCallback(async () => {
    if (!venueId) {
      setCatalogoBottiglie([]);
      return;
    }

    const pricing = await fetchVenuePricing(String(venueId));
    setCatalogoBottiglie(Array.isArray(pricing.bottle_price_list) ? pricing.bottle_price_list : []);
  }, [venueId]);

  const tavoliPrenotati = tavoli.filter(t => Number(t.prenotati ?? 0) > 0);

  const tavoliFiltrati = tavoliPrenotati.filter(t => {
    const q = searchQuery.toLowerCase();
    const tableName = (t.table_name ?? '').toLowerCase();
    const zona = (t.zona ?? '').toLowerCase();
    const nome = (t.nome ?? '').toLowerCase();
    return nome.includes(q) || tableName.includes(q) || zona.includes(q);
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        if (mounted) {
          await Promise.all([refreshTables(), refreshBottleCatalog()]);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Errore nel caricamento dei tavoli");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [refreshBottleCatalog, refreshTables]);

  const aggiungiBudget = (id: string) => {
    openPrompt({
      title: 'Aggiungi budget',
      placeholder: 'Inserisci l\'importo',
      keyboardType: 'decimal-pad',
      onSubmit: async (importo: string) => {
        if (importo) {
          const parsed = parseFloat(importo);
          if (!isNaN(parsed) && parsed > 0) {
            try {
              // Optimistic update
              setTavoli(prev => prev.map(t => 
                t.id === id ? { 
                  ...t, 
                  pagato_totale: Number(t.pagato_totale || 0) + parsed,
                  stato_pagamento: 'parziale'
                } : t
              ));
              
              await addTablePayment(id, parsed, userId, eventId);
              showToast(`+€${parsed.toFixed(2)}`);
              
              // Refresh data
              await refreshTables();
            } catch (e: any) {
              showToast(e?.message || "Errore nell'aggiunta del pagamento");
              // Rollback
              await refreshTables();
            }
          }
        }
      }
    });
  };

  const aggiungiBottiglia = (id: string) => {
    if (!catalogoBottiglie.length) {
      showToast('Configura prima le bottiglie nel tab prezzi del locale');
      return;
    }

    setSelectedTableForBottle(id);
    setSelectedBottleKey(catalogoBottiglie[0]?.key ?? null);
    setSelectedBottleQuantity('1');
    setBottleModalVisible(true);
  };

  const confermaBottiglia = async () => {
    if (!selectedTableForBottle || !selectedBottleKey) {
      showToast('Seleziona una bottiglia');
      return;
    }

    const quantity = selectedBottleQuantity ? parseInt(selectedBottleQuantity, 10) : 1;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      showToast('Quantita non valida');
      return;
    }

    const selectedBottle = catalogoBottiglie.find((item) => item.key === selectedBottleKey);
    if (!selectedBottle) {
      showToast('Bottiglia non disponibile');
      return;
    }

    try {
      await createTableBottleOrder(selectedTableForBottle, {
        bottle_key: selectedBottle.key,
        quantity,
        auto_settle: true,
      });
      setBottleModalVisible(false);
      showToast(`Bottiglia richiesta • €${(selectedBottle.price * quantity).toFixed(2)}`);
      await refreshTables();
    } catch (e: any) {
      showToast(e?.message || "Errore nella richiesta bottiglia");
      await refreshTables();
    }
  };

  const saldaTavolo = (id: string) => {
    const tavolo = tavoli.find(t => t.id === id);
    const importoAttuale = Number(tavolo?.pagato_totale || 0);
    const perTesta = Number(tavolo?.per_testa || 0);
    const entrati = Number(tavolo?.entrati || 0);
    const minimoSpesa = Number(tavolo?.costo_minimo ?? 0);
    const budgetAtteso = perTesta * entrati;
    const totaleDaPagare = Math.max(budgetAtteso, minimoSpesa > 0 ? minimoSpesa : 0);
    const importoMancante = Math.max(0, totaleDaPagare - importoAttuale);
    const importoFinale = importoAttuale + importoMancante;
    const messaggioConferma = importoMancante > 0
      ? `Verranno aggiunti automaticamente €${importoMancante.toFixed(2)} per chiudere il tavolo. Totale saldo: €${importoFinale.toFixed(2)}.`
      : `Saldare il tavolo con €${importoFinale.toFixed(2)}?`;
    
    Alert.alert(
      "Conferma saldo",
      messaggioConferma,
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Conferma", 
          onPress: async () => {
            try {
              // Salva l'importo al momento del saldo
              setImportiSaldati(prev => ({ ...prev, [id]: importoFinale }));
              
              // Optimistic update
              setTavoli(prev => prev.map(t => 
                t.id === id
                  ? {
                      ...t,
                      pagato_totale: importoFinale,
                      is_saldato: true,
                      stato_pagamento: 'saldato'
                    }
                  : t
              ));

              if (importoMancante > 0) {
                await addTablePayment(id, importoMancante, userId, eventId);
              }
              
              await settleTable(id);
              showToast(importoMancante > 0 ? `Tavolo saldato (+€${importoMancante.toFixed(2)})` : "Tavolo saldato");
              
              // Refresh data
              await refreshTables();
            } catch (e: any) {
              showToast(e?.message || "Errore nel saldo del tavolo");
              // Rollback
              await refreshTables();
            }
          }
        }
      ]
    );
  };

  const getTotals = () => {
    const attivi = tavoliPrenotati.filter(t => !t.is_saldato);
    const totBudget = attivi.reduce((sum, t) => sum + Number(t.pagato_totale || 0), 0);
    const bottiglieInCorso = tavoliPrenotati.reduce(
      (sum, t) => sum + (t.bottle_orders ?? []).filter(order => order.status !== 'delivered').length,
      0,
    );
    return { attivi: attivi.length, totBudget, bottiglieInCorso };
  };

  const totals = getTotals();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6D5BFF" />
        <Text style={styles.loadingText}>Caricamento tavoli...</Text>
      </View>
    );
  }

  if (!eventId) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#f59e0b" />
        <Text style={styles.errorText}>Nessun evento LIVE selezionato</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Servizio Tavoli</Text>
          <Text style={styles.subtitle}>Gestione ordini</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{totals.attivi}</Text>
          <Text style={styles.totalBadgeLabel}>attivi</Text>
        </View>
      </View>

      {/* Stats budget */}
      <View style={styles.budgetSummary}>
        <View style={styles.budgetRow}>
          <Feather name="dollar-sign" size={24} color="#4ECDC4" />
          <View style={{ flex: 1 }}>
            <Text style={styles.budgetSummaryLabel}>Budget totale attivo</Text>
            <Text style={styles.budgetSummaryValue}>€{totals.totBudget.toFixed(2)}</Text>
            <Text style={styles.bottleSummaryText}>{totals.bottiglieInCorso} bottiglie in lavorazione</Text>
          </View>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="rgba(255,255,255,0.6)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca tavolo..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
      </View>

      {tavoliPrenotati.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>Nessun tavolo prenotato</Text>
        </View>
      ) : tavoliFiltrati.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="search" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>Nessun tavolo trovato</Text>
        </View>
      ) : (
        tavoliFiltrati.map(t => {
          const perTesta = Number(t.per_testa || 0);
          const minSpend = Number(t.costo_minimo ?? 0);
          const budgetAtteso = perTesta * t.entrati;
          const pagatoTotale = Number(t.pagato_totale || 0);
          const mancante = Math.max(0, budgetAtteso - pagatoTotale);
          const mancanteMinimo = minSpend > 0 ? Math.max(0, minSpend - pagatoTotale) : 0;
          const statoCompleto = t.entrati >= t.prenotati;
          const isSaldato = t.is_saldato || false;
          const tableLabel = String(t.table_name ?? '').trim();
          const zonaLabel = String(t.zona ?? '').trim();
          const primaryTitle = tableLabel || String(t.nome ?? '').trim() || 'Tavolo';
          const bottleOrders = t.bottle_orders ?? [];
          const pendingBottleOrders = bottleOrders.filter(order => order.status !== 'delivered');
          
          // Calcola importo saldato e aggiunte successive
          const importoSaldato = importiSaldati[t.id] || 0;
          const aggiuntoDopoSaldo = isSaldato && importoSaldato > 0 ? pagatoTotale - importoSaldato : 0;

          return (
            <View key={t.id} style={[styles.tableCard, isSaldato && styles.tableCardPaid]}>
              <View style={styles.tableHeader}>
                <View style={styles.tableMainInfo}>
                  <View style={styles.tavoloRow}>
                    <View style={styles.tavoloNumberCircle}>
                      <Text style={styles.tavoloNumber}>{t.numero || '?'}</Text>
                    </View>
                    <View>
                      <Text style={styles.tableTitle}>{primaryTitle}</Text>
                      <View style={styles.personeRow}>
                        <Feather name="users" size={14} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.tableInfo}>
                          {t.entrati}/{t.prenotati} {statoCompleto ? '✓' : 'persone'}
                        </Text>
                      </View>
                      {zonaLabel ? (
                        <Text style={styles.zonaText}>
                          📍 Zona: {zonaLabel}
                        </Text>
                      ) : null}
                      {minSpend > 0 ? (
                        <Text style={styles.minSpendText}>
                          Minimo spesa: €{minSpend} {mancanteMinimo > 0 ? `• Manca €${mancanteMinimo.toFixed(2)}` : '• Raggiunto'}
                        </Text>
                      ) : (
                        <Text style={styles.minSpendText}>Nessun minimo spesa</Text>
                      )}
                    </View>
                  </View>
                </View>
                {!isSaldato && (
                  <View style={styles.budgetBadge}>
                    <Text style={styles.budgetAmount}>€{pagatoTotale.toFixed(2)}</Text>
                    {mancante > 0 && (
                      <Text style={styles.mancaText}>Manca: €{mancante.toFixed(2)}</Text>
                    )}
                  </View>
                )}
              </View>

              {isSaldato && (
                <View style={styles.paidSummaryContainer}>
                  <View style={styles.paidSummaryHeader}>
                    <View style={styles.paidBadge}>
                      <Feather name="check" size={14} color="#22c55e" />
                      <Text style={styles.paidText}>Saldato</Text>
                    </View>
                    <Text style={styles.paidTotalAmount}>€{pagatoTotale.toFixed(2)}</Text>
                  </View>

                  {importoSaldato > 0 && (
                    <View style={styles.paidBreakdownRow}>
                      <View style={styles.paidBreakdownItem}>
                        <Text style={styles.saldatoLabel}>Importo saldato</Text>
                        <Text style={styles.saldatoAmount}>€{importoSaldato.toFixed(2)}</Text>
                      </View>

                      {aggiuntoDopoSaldo > 0 && (
                        <View style={styles.paidBreakdownItemRight}>
                          <Text style={styles.aggiuntoLabel}>Aggiunte dopo saldo</Text>
                          <Text style={styles.aggiuntoAmount}>+€{aggiuntoDopoSaldo.toFixed(2)}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.budgetInfo}>
                <Text style={styles.budgetInfoText}>
                  €{perTesta.toFixed(2)}/persona × {t.entrati} = €{budgetAtteso.toFixed(2)}
                </Text>
              </View>

              {bottleOrders.length > 0 && (
                <View style={styles.bottleOrdersContainer}>
                  <View style={styles.bottleOrdersHeader}>
                    <Text style={styles.bottleOrdersTitle}>Bottiglie richieste</Text>
                    <Text style={styles.bottleOrdersCount}>{pendingBottleOrders.length} aperte</Text>
                  </View>
                  {bottleOrders.map(order => {
                    const isDelivered = order.status === 'delivered';
                    const statusLabel =
                      order.status === 'requested'
                        ? 'Richiesta'
                        : order.status === 'preparing'
                          ? 'In preparazione'
                          : 'Uscita';

                    return (
                      <View key={order.id} style={[styles.bottleOrderRow, isDelivered && styles.bottleOrderRowDelivered]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bottleOrderName}>{order.quantity}× {order.bottle_name}</Text>
                          <Text style={styles.bottleOrderMeta}>€{order.unit_price.toFixed(2)} cad. • Totale €{order.total_price.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.bottleStatusBadge, order.status === 'requested' ? styles.bottleStatusRequested : order.status === 'preparing' ? styles.bottleStatusPreparing : styles.bottleStatusDelivered]}>
                          <Text style={styles.bottleStatusText}>{statusLabel}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.tableActions}>
                <TouchableOpacity 
                  style={[styles.tableButton, styles.bottleButton]}
                  onPress={() => aggiungiBottiglia(t.id)}
                >
                  <Feather name="package" size={18} color="white" />
                  <Text style={styles.tableButtonText}>Aggiungi bottiglia</Text>
                </TouchableOpacity>

                <View style={styles.tableActionsRow}>
                <TouchableOpacity 
                  style={[styles.tableButton, styles.moneyButton, isSaldato && styles.paidTableMoneyButton]}
                  onPress={() => aggiungiBudget(t.id)}
                >
                  <Feather name="plus-circle" size={18} color="white" />
                  <Text style={styles.tableButtonText}>Aggiungi budget</Text>
                </TouchableOpacity>

                {!isSaldato && (
                  <TouchableOpacity 
                    style={[styles.tableButton, styles.payButton]}
                    onPress={() => saldaTavolo(t.id)}
                  >
                    <Feather name="check-circle" size={18} color="white" />
                    <Text style={styles.tableButtonText}>Salda tavolo</Text>
                  </TouchableOpacity>
                )}
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>

    <Modal
      visible={bottleModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setBottleModalVisible(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setBottleModalVisible(false)}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleziona bottiglia</Text>
            <TouchableOpacity onPress={() => setBottleModalVisible(false)}>
              <Feather name="x" size={18} color="white" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>Il prezzo viene preso dal catalogo del locale.</Text>

          <ScrollView style={styles.modalBottleList} contentContainerStyle={styles.modalBottleListContent}>
            {catalogoBottiglie.map((item) => {
              const active = item.key === selectedBottleKey;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.modalBottleOption, active && styles.modalBottleOptionActive]}
                  onPress={() => setSelectedBottleKey(item.key)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalBottleLabel}>{item.label}</Text>
                    <Text style={styles.modalBottlePrice}>€{Number(item.price ?? 0).toFixed(2)}</Text>
                  </View>
                  {active && <Feather name="check-circle" size={18} color="#22c55e" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.modalQuantityRow}>
            <Text style={styles.modalQuantityLabel}>Quantita</Text>
            <TextInput
              value={selectedBottleQuantity}
              onChangeText={(text) => setSelectedBottleQuantity(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              style={styles.modalQuantityInput}
              placeholder="1"
              placeholderTextColor="rgba(255,255,255,0.35)"
            />
          </View>

          <TouchableOpacity style={styles.modalConfirmButton} onPress={() => void confermaBottiglia()}>
            <Feather name="package" size={16} color="white" />
            <Text style={styles.modalConfirmText}>Invia alla cambusa</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    padding: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },

  title: { 
    fontSize: 32, 
    fontWeight: "900", 
    color: "white",
  },

  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },

  totalBadge: {
    backgroundColor: "#6D5BFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
    minWidth: 70,
  },

  totalBadgeText: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
  },

  totalBadgeLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    marginTop: 2,
  },

  budgetSummary: {
    backgroundColor: "rgba(78, 205, 196, 0.15)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(78, 205, 196, 0.3)",
  },

  budgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  budgetSummaryLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },

  budgetSummaryValue: {
    color: "#4ECDC4",
    fontSize: 28,
    fontWeight: "900",
  },

  bottleSummaryText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  tableCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  tableCardPaid: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
  },

  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  tableMainInfo: {
    flex: 1,
    paddingRight: 12,
  },

  tavoloRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  tavoloNumberCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6D5BFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6D5BFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },

  tavoloNumber: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },

  tableTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },

  personeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  tableInfo: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },

  budgetBadge: {
    alignItems: "flex-end",
    flexShrink: 0,
    minWidth: 96,
  },

  budgetAmount: {
    color: "#22c55e",
    fontSize: 28,
    fontWeight: "900",
  },

  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  paidText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "700",
  },

  tableActions: {
    gap: 10,
  },

  tableActionsRow: {
    flexDirection: "row",
    gap: 12,
  },

  tableButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },

  tableButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 14,
  },

  moneyButton: {
    backgroundColor: "#3B82F6",
  },

  bottleButton: {
    backgroundColor: "#8B5CF6",
  },

  paidTableMoneyButton: {
    backgroundColor: "#1D4ED8",
    borderWidth: 1,
    borderColor: "#93C5FD",
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.4,
  },

  payButton: {
    backgroundColor: "#22c55e",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },

  loadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    marginTop: 16,
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },

  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },

  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    marginTop: 16,
  },

  zonaText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 2,
  },

  budgetInfo: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },

  budgetInfoText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
  },

  minSpendText: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },

  mancaText: {
    color: "#f59e0b",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },

  searchInput: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 12,
  },

  saldatoDetail: {
    marginBottom: 4,
  },

  paidSummaryContainer: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  paidSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  paidTotalAmount: {
    color: "#22c55e",
    fontSize: 24,
    fontWeight: "900",
  },

  paidBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  paidBreakdownItem: {
    flex: 1,
  },

  paidBreakdownItemRight: {
    flex: 1,
    alignItems: "flex-end",
  },

  saldatoLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },

  saldatoAmount: {
    color: "#22c55e",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },

  aggiuntoDetail: {
    marginBottom: 4,
  },

  aggiuntoLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },

  aggiuntoAmount: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },

  bottleOrdersContainer: {
    backgroundColor: "rgba(139,92,246,0.14)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.32)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },

  bottleOrdersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  bottleOrdersTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },

  bottleOrdersCount: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
  },

  bottleOrderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  bottleOrderRowDelivered: {
    opacity: 0.72,
  },

  bottleOrderName: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },

  bottleOrderMeta: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    marginTop: 2,
  },

  bottleStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  bottleStatusRequested: {
    backgroundColor: "rgba(251,191,36,0.18)",
  },

  bottleStatusPreparing: {
    backgroundColor: "rgba(59,130,246,0.18)",
  },

  bottleStatusDelivered: {
    backgroundColor: "rgba(34,197,94,0.18)",
  },

  bottleStatusText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
  },

  totaleDetail: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 6,
    marginTop: 4,
  },

  totaleLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxHeight: "80%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  modalTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },

  modalSubtitle: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 14,
  },

  modalBottleList: {
    maxHeight: 280,
  },

  modalBottleListContent: {
    gap: 10,
  },

  modalBottleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  modalBottleOptionActive: {
    borderColor: "rgba(34,197,94,0.65)",
    backgroundColor: "rgba(34,197,94,0.1)",
  },

  modalBottleLabel: {
    color: "white",
    fontSize: 15,
    fontWeight: "800",
  },

  modalBottlePrice: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
  },

  modalQuantityRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  modalQuantityLabel: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },

  modalQuantityInput: {
    minWidth: 92,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "white",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
  },

  modalConfirmButton: {
    marginTop: 18,
    backgroundColor: "#8B5CF6",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  modalConfirmText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },
});
