import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useTheme } from "../../../theme/ThemeProvider";
import { listHostessTables, updateHostessTableEntrati, assignHostessTableNumber, type HostessTable } from "../../../services/hostess";

export default function ImmagineTab({ openPrompt, showToast, eventId, venueId }: any) {
  const { theme } = useTheme();
  const [tavoli, setTavoli] = useState<HostessTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const tavoliPrenotati = tavoli.filter(t => Number(t.prenotati ?? 0) > 0);

  const tavoliFiltrati = tavoliPrenotati.filter(t =>
    (t.nome ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!eventId || !venueId) {
          if (mounted) {
            setTavoli([]);
            setError(null);
            setLoading(false);
          }
          return;
        }
        setLoading(true);
        const data = await listHostessTables({
          eventId: String(eventId),
          venueId: String(venueId),
          onlyBooked: true,
        });
        if (mounted) setTavoli(data);
      } catch (e: any) {
        setError(e?.message || "Errore nel caricamento dei tavoli");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [eventId, venueId]);

  const confermaIngresso = async (id: string | number, increment: number = 1) => {
    // Optimistic update
    setTavoli(prev => prev.map(t => {
      if (t.id === id) {
        const nuovoValore = Number(t.entrati ?? 0) + increment;
        if (nuovoValore >= 0) {
          return { ...t, entrati: nuovoValore };
        }
      }
      return t;
    }));
    try {
      await updateHostessTableEntrati(String(id), increment);
      showToast(increment > 0 ? `+${increment} persona/e` : `-1 persona`);
    } catch (e) {
      // rollback on error
      setTavoli(prev => prev.map(t => {
        if (t.id === id) {
          return { ...t, entrati: Number(t.entrati ?? 0) - increment };
        }
        return t;
      }));
      showToast("Errore aggiornamento ingressi");
    }
  };

  const aggiungiTutti = async (id: string | number) => {
    const target = tavoli.find(t => t.id === id);
    if (!target) return;
    const mancanti = Number(target.prenotati ?? 0) - Number(target.entrati ?? 0);
    if (mancanti <= 0) return;
    // optimistic
    setTavoli(prev => prev.map(t => t.id === id ? { ...t, entrati: Number(t.prenotati ?? 0) } : t));
    try {
      await updateHostessTableEntrati(String(id), mancanti);
      showToast(`Aggiunte ${mancanti} persone`);
    } catch (e) {
      // rollback
      setTavoli(prev => prev.map(t => t.id === id ? { ...t, entrati: Number(target.entrati ?? 0) } : t));
      showToast("Errore aggiornamento ingressi");
    }
  };

  const assegnaTavolo = (id: string | number) => {
    openPrompt({
      title: 'Assegna tavolo',
      placeholder: 'Numero del tavolo',
      keyboardType: 'number-pad',
      onSubmit: (numero: string) => {
        if (numero) {
          const parsed = parseInt(numero, 10);
          // optimistic
          setTavoli(prev => prev.map(t => t.id === id ? { ...t, numero: parsed } : t));
          assignHostessTableNumber(String(id), parsed)
            .then(() => showToast('Tavolo assegnato'))
            .catch(() => showToast('Errore assegnazione tavolo'));
        }
      }
    });
  };

  const getTavoliStats = () => {
    const completi = tavoli.filter(t => t.entrati >= t.prenotati).length;
    const totalePersone = tavoli.reduce((sum, t) => sum + Number(t.entrati ?? 0), 0);
    return { completi, totalePersone };
  };

  const stats = getTavoliStats();

  if (!eventId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Feather name="alert-circle" size={48} color="#f59e0b" />
        <Text style={{ color: 'white', marginTop: 12, textAlign: 'center' }}>
          Nessun evento LIVE selezionato
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tavoli & PR</Text>
          <Text style={styles.subtitle}>Gestione prenotazioni</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{tavoliPrenotati.length}</Text>
          <Text style={styles.totalBadgeLabel}>tavoli</Text>
        </View>
      </View>

      {/* Stats rapide */}
      <View style={styles.statsRow}>
        <View style={styles.miniStatCard}>
          <Feather name="check-circle" size={20} color="#22c55e" />
          <Text style={styles.miniStatValue}>{stats.completi}</Text>
          <Text style={styles.miniStatLabel}>Completi</Text>
        </View>
        <View style={styles.miniStatCard}>
          <Feather name="users" size={20} color="#3B82F6" />
          <Text style={styles.miniStatValue}>{stats.totalePersone}</Text>
          <Text style={styles.miniStatLabel}>Persone</Text>
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

      {loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color="#6D5BFF" />
          <Text style={{ color: 'white', opacity: 0.8 }}>Caricamento...</Text>
        </View>
      )}
      {error && (
        <Text style={{ color: '#EF4444' }}>{error}</Text>
      )}
      {tavoliPrenotati.length === 0 && !loading && !error && (
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>Nessun tavolo prenotato</Text>
        </View>
      )}
      {tavoliFiltrati.length === 0 && !loading && !error && tavoliPrenotati.length > 0 && (
        <View style={styles.emptyContainer}>
          <Feather name="search" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>Nessun tavolo trovato</Text>
        </View>
      )}
      {tavoliFiltrati.map(t => {
        const isComplete = t.entrati >= t.prenotati;
        const perHead = t.per_testa ?? 0;
        const current = perHead * t.entrati;
        const target = perHead * t.prenotati;
        
        return (
          <View key={t.id} style={[styles.tableCard, isComplete && styles.tableCardComplete]}>
            <View style={styles.tableHeader}>
              <View style={{ flex: 1, marginRight: 70 }}>
                <View style={styles.tableNameRow}>
                  <Text style={styles.tableTitle}>{t.nome}</Text>
                  {isComplete && (
                    <View style={styles.completeBadge}>
                      <Feather name="check" size={14} color="#22c55e" />
                      <Text style={styles.completeText}>Completo</Text>
                    </View>
                  )}
                </View>
                <View style={styles.tableInfoRow}>
                  {t.zona && (
                    <View style={styles.zoneBadge}>
                      <Feather name="map" size={14} color="#93C5FD" />
                      <Text style={styles.zoneText}>{t.zona}</Text>
                    </View>
                  )}
                  <Text style={styles.tableInfo}>
                    {t.entrati}/{t.prenotati} persone
                  </Text>
                  <Text style={styles.tableInfo}>
                    €{current}/{target} • €{perHead} a testa
                  </Text>
                </View>
              </View>
              
              {/* {t.numero && (
                <View style={styles.tableNumberBadge}>
                  <Feather name="hash" size={16} color="white" />
                  <Text style={styles.tableNumber}>{t.numero}</Text>
                </View>
              )} */}
            </View>

            <View style={styles.tableActionsGrid}>
              {/* Prima riga */}
              <View style={styles.tableActionsRow}>
                <TouchableOpacity 
                  style={[styles.tableButton, styles.removeButton]}
                  onPress={() => confermaIngresso(t.id, -1)}
                  disabled={t.entrati === 0}
                >
                  <Feather name="minus" size={18} color="white" />
                  <Text style={styles.tableButtonText}>-1</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.tableButton, styles.addOneButton]}
                  onPress={() => confermaIngresso(t.id, 1)}
                >
                  <Feather name="plus" size={18} color="white" />
                  <Text style={styles.tableButtonText}>+1</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.tableButton, styles.addAllButton]}
                  onPress={() => aggiungiTutti(t.id)}
                >
                  <Feather name="users" size={18} color="white" />
                  <Text style={styles.tableButtonText}>Tutti</Text>
                </TouchableOpacity>
              </View>

              {/* Seconda riga */}
              <TouchableOpacity 
                style={[styles.tableButton, styles.assignButton, { flex: 1 }]}
                onPress={() => assegnaTavolo(t.id)}
              >
                <Feather name="map-pin" size={18} color="white" />
                <Text style={styles.tableButtonText}>
                  {t.numero ? `Tavolo #${t.numero}` : "Assegna tavolo"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
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

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  miniStatCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },

  miniStatValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
  },

  miniStatLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
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
    position: "relative" as const,
  },

  tableCardComplete: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },

  tableHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  tableNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  tableTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
  },

  completeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  completeText: {
    color: "#22c55e",
    fontSize: 11,
    fontWeight: "700",
  },

  tableProgress: {
    gap: 8,
  },

  progressBar: {
    width: "100%",
    maxWidth: 180,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#6D5BFF",
    borderRadius: 4,
  },

  tableInfo: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "600",
  },

  tableInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  zoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  zoneText: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "700",
  },

  tableNumberBadge: {
    backgroundColor: "#6D5BFF",
    minWidth: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    shadowColor: "#6D5BFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  tableNumber: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },

  tableActionsGrid: {
    gap: 10,
  },

  tableActionsRow: {
    flexDirection: "row",
    gap: 10,
  },

  tableButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
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

  removeButton: {
    backgroundColor: "#EF4444",
  },

  addOneButton: {
    backgroundColor: "#22c55e",
  },

  addAllButton: {
    backgroundColor: "#8B5CF6",
  },

  confirmButton: {
    backgroundColor: "#22c55e",
  },

  buttonDisabled: {
    backgroundColor: "rgba(255,255,255,0.15)",
    opacity: 0.5,
  },

  assignButton: {
    backgroundColor: "#6D5BFF",
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
});
