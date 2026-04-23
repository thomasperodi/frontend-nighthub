import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, useRef, useEffect } from "react";
import { recordBarSale, fetchStaffEventStats, listBarSales } from "../../../services/staff";
import { fetchVenuePricing } from "../../../services/venues";
import { EventStats } from "../../../types/events";
import { DEFAULT_BAR_MENU } from "../../../constants/barMenu";

const DEFAULT_PRICES = DEFAULT_BAR_MENU.map((item) => ({
  key: item.key,
  label: item.label,
  price: item.defaultPrice,
  icon: item.icon,
  color: item.color,
}));

const PriceCard = ({ item, onPress }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true })
    ]).start();
    onPress();
  };

  const getBackgroundColor = (color: string) => {
    // Converte il colore hex in rgba con bassa opacità
    return color + "1A"; // 1A = 10% opacity in hex
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={{ width: "48%" }}>
      <Animated.View 
        style={[
          styles.priceButton, 
          { 
            transform: [{ scale: scaleAnim }],
            backgroundColor: getBackgroundColor(item.color),
            borderWidth: 1.5,
            borderColor: item.color + "40" // 25% opacity per il border
          }
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: item.color + "20" }]}>
          <MaterialCommunityIcons name={item.icon as any} size={40} color={item.color} />
        </View>
        <Text style={styles.priceLabel}>{item.label}</Text>
        <Text style={styles.priceAmount}>€{item.price}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

type Props = {
  openPrompt: (cfg: any) => void;
  showToast: (msg: string) => void;
  eventId: string;
  staffId?: string;
  venueId?: string;
};

export default function BarTab({ openPrompt, showToast, eventId, staffId, venueId }: Props) {
  const [vendite, setVendite] = useState(0);
  const [totale, setTotale] = useState(0);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const eventIdRef = useRef(eventId);
  const saleQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!venueId) {
      setPrices(DEFAULT_PRICES);
      return;
    }

    void (async () => {
      try {
        const pricing = await fetchVenuePricing(venueId);
        const byKey = new Map(
          (pricing?.bar_price_list ?? []).map((row) => [String(row.key), Number(row.price)]),
        );
        setPrices(
          DEFAULT_PRICES.map((item) => ({
            ...item,
            price: Number.isFinite(byKey.get(item.key))
              ? Number(byKey.get(item.key))
              : item.price,
          })),
        );
      } catch {
        setPrices(DEFAULT_PRICES);
      }
    })();
  }, [venueId]);

  // Carica dati pregressi
  useEffect(() => {
    if (!eventId) {
      setVendite(0);
      setTotale(0);
      setEventStats(null);
      return;
    }
    void (async () => {
      try {
        const [sales, stats] = await Promise.all([
          listBarSales(eventId),
          fetchStaffEventStats(eventId),
        ]);
        setVendite(sales.length);
        const totalAmount = sales.reduce((acc, s) => acc + Number(s.amount ?? 0), 0);
        setTotale(totalAmount);
        setEventStats(stats);
      } catch (err) {
        // silent
      }
    })();
  }, [eventId]);

  useEffect(() => {
    eventIdRef.current = eventId;
    saleQueueRef.current = Promise.resolve();
  }, [eventId]);

  const aggiungiVendita = (price: number) => {
    if (!eventId) {
      showToast('Imposta prima un evento');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      showToast('Importo non valido');
      return;
    }

    const currentEventId = eventId;
    const currentStaffId = staffId;

    // Aggiorna UI subito (non bloccare i tap mentre aspetti il network)
    setVendite(prev => prev + 1);
    setTotale(prev => prev + price);
    // Niente toast di conferma: deve rimanere subito disponibile il prossimo tap

    // Metti in coda la chiamata: viene eseguita in sequenza
    saleQueueRef.current = saleQueueRef.current.then(async () => {
      try {
        const { stats } = await recordBarSale({
          event_id: currentEventId,
          staff_id: currentStaffId,
          amount: price,
        });

        // Se nel frattempo è cambiato evento, ignora aggiornamenti
        if (eventIdRef.current !== currentEventId) return;

        setEventStats(stats);
      } catch (err) {
        if (eventIdRef.current !== currentEventId) return;

        // Revert dell'aggiornamento ottimistico per questa vendita
        setVendite(prev => Math.max(0, prev - 1));
        setTotale(prev => Math.max(0, prev - price));
        showToast('Errore salvataggio vendita');
      }
    });
  };

  const prezzoPersonalizzato = () => {
    openPrompt({
      title: 'Prezzo personalizzato',
      placeholder: 'Inserisci l\'importo',
      keyboardType: 'decimal-pad',
      onSubmit: (amount: string) => {
        if (amount) {
          const parsedAmount = parseFloat(amount.replace(',', '.'));
          aggiungiVendita(parsedAmount);
        }
      }
    });
  };

  const resetaGiornata = () => {
    Alert.alert(
      "Ripristina contatori",
      "Resettare i contatori della giornata?",
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Conferma", 
          onPress: () => {
            setVendite(0);
            setTotale(0);
            showToast("Contatori resettati");
          }
        }
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: "rgba(255, 107, 107, 0.2)" }]}>
            <Feather name="shopping-cart" size={28} color="#FF6B6B" />
          </View>
          <Text style={styles.statLabel}>Vendite</Text>
          <Text style={styles.statValue}>{vendite}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: "rgba(78, 205, 196, 0.2)" }]}>
            <Feather name="trending-up" size={28} color="#4ECDC4" />
          </View>
          <Text style={styles.statLabel}>Totale</Text>
          <Text style={[styles.statValue, { color: "#4ECDC4" }]}>€{totale.toFixed(2)}</Text>
          
        </View>
      </View>

      {/* Price Grid */}
      <Text style={styles.sectionTitle}>
        <Feather name="grid" size={18} color="white" /> Aggiungi ordine
      </Text>
      <View style={styles.priceGrid}>
        {prices.map((item) => (
          <PriceCard 
            key={item.key} 
            item={item} 
            onPress={() => aggiungiVendita(item.price)} 
          />
        ))}
      </View>

      {/* Custom Price Button */}
      <TouchableOpacity
        style={[styles.actionButton, styles.customButton]}
        onPress={prezzoPersonalizzato}
      >
        <View style={styles.actionContent}>
          <Feather name="edit-3" size={24} color="white" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Prezzo personalizzato</Text>
            <Text style={styles.actionSubtitle}>Inserisci importo manuale</Text>
          </View>
          <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
        </View>
      </TouchableOpacity>

      {/* Recent Sales Summary */}
      {totale > 0 && vendite > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            <Feather name="bar-chart-2" size={16} color="white" /> Riepilogo
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Scontrino medio</Text>
            <Text style={styles.summaryValue}>€{(totale / vendite).toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Totale incasso</Text>
            <Text style={[styles.summaryValue, styles.totalValue]}>€{totale.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {/* Reset Button */}
      <TouchableOpacity
        style={[styles.actionButton, styles.resetButton]}
        onPress={resetaGiornata}
      >
        <Feather name="refresh-cw" size={22} color="white" />
        <Text style={styles.resetLabel}>Ripristina contatori</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },

  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },

  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  statIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  statLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },

  statValue: {
    color: "white",
    fontSize: 32,
    fontWeight: "900",
  },

  sectionTitle: {
    color: "white",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 16,
  },

  priceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },

  priceButton: {
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 145,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },

  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },

  priceLabel: {
    color: "white",
    fontSize: 15,
    fontWeight: "800",
  },

  priceAmount: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
  },

  actionButton: {
    width: "100%",
    marginBottom: 14,
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },

  customButton: {
    backgroundColor: "#7C3AED",
  },

  actionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },

  actionLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },

  actionSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },

  resetButton: {
    backgroundColor: "#EF4444",
    gap: 12,
    justifyContent: "center",
    marginTop: 6,
  },

  resetLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },

  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  summaryTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 16,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },

  summaryLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "600",
  },

  summaryValue: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
  },

  totalValue: {
    color: "#4ECDC4",
    fontSize: 24,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 8,
  },
});
