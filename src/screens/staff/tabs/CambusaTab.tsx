import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  dispatchBottleOrder,
  listBottleOrders,
  prepareBottleOrder,
  type TableBottleOrder,
} from "../../../services/staff";

type CambusaTabProps = {
  showToast: (message: string) => void;
  eventId?: string;
  venueId?: string;
};

const getStatusMeta = (status: TableBottleOrder["status"]) => {
  if (status === "preparing") {
    return {
      label: "In preparazione",
      icon: "loader" as const,
      color: "#60A5FA",
      backgroundColor: "rgba(96,165,250,0.16)",
    };
  }

  if (status === "delivered") {
    return {
      label: "Uscita confermata",
      icon: "check-circle" as const,
      color: "#22C55E",
      backgroundColor: "rgba(34,197,94,0.16)",
    };
  }

  return {
    label: "Da preparare",
    icon: "clock" as const,
    color: "#F59E0B",
    backgroundColor: "rgba(245,158,11,0.16)",
  };
};

export default function CambusaTab({ showToast, eventId, venueId }: CambusaTabProps) {
  const [orders, setOrders] = useState<TableBottleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshOrders = useCallback(async () => {
    if (!eventId) {
      setOrders([]);
      setError(null);
      setLoading(false);
      return;
    }

    const data = await listBottleOrders(eventId, { venueId });
    setOrders(data);
    setError(null);
  }, [eventId, venueId]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        setLoading(true);
        await refreshOrders();
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || "Errore nel caricamento della cambusa");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshOrders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter(order => {
      const tableName = String(order.table?.table_name ?? "").toLowerCase();
      const tableZone = String(order.table?.zona ?? "").toLowerCase();
      const tableNome = String(order.table?.nome ?? "").toLowerCase();
      const bottleName = String(order.bottle_name ?? "").toLowerCase();
      const numero = String(order.table?.numero ?? "").toLowerCase();

      return (
        bottleName.includes(q) ||
        tableName.includes(q) ||
        tableZone.includes(q) ||
        tableNome.includes(q) ||
        numero.includes(q)
      );
    });
  }, [orders, searchQuery]);

  const stats = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        if (order.status === "requested") acc.requested += 1;
        if (order.status === "preparing") acc.preparing += 1;
        if (order.status === "delivered") acc.delivered += 1;
        acc.totalValue += order.total_price;
        return acc;
      },
      { requested: 0, preparing: 0, delivered: 0, totalValue: 0 },
    );
  }, [orders]);

  const handlePrepare = async (orderId: string) => {
    try {
      setOrders(prev =>
        prev.map(order =>
          order.id === orderId
            ? { ...order, status: "preparing", prepared_at: new Date().toISOString() }
            : order,
        ),
      );
      await prepareBottleOrder(orderId);
      showToast("Ordine preso in carico");
      await refreshOrders();
    } catch (e: any) {
      showToast(e?.message || "Errore nella presa in carico");
      await refreshOrders();
    }
  };

  const handleDispatch = (order: TableBottleOrder) => {
    Alert.alert(
      "Conferma uscita",
      `Segnare ${order.quantity}× ${order.bottle_name} come uscita per il tavolo ${order.table?.table_name || order.table?.nome || order.table?.numero || ""}?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Conferma",
          onPress: async () => {
            try {
              await dispatchBottleOrder(order.id);
              showToast("Bottiglia uscita dalla cambusa");
              await refreshOrders();
            } catch (e: any) {
              showToast(e?.message || "Errore nella conferma uscita");
              await refreshOrders();
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text style={styles.loadingText}>Caricamento richieste cambusa...</Text>
      </View>
    );
  }

  if (!eventId) {
    return (
      <View style={styles.stateContainer}>
        <Feather name="alert-circle" size={48} color="#F59E0B" />
        <Text style={styles.stateText}>Nessun evento LIVE selezionato</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateContainer}>
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.stateText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cambusa</Text>
          <Text style={styles.subtitle}>Preparazione e uscita bottiglie</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeNumber}>{stats.requested + stats.preparing}</Text>
          <Text style={styles.summaryBadgeLabel}>aperte</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{stats.requested}</Text>
            <Text style={styles.statLabel}>Da preparare</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValueBlue}>{stats.preparing}</Text>
            <Text style={styles.statLabel}>In preparazione</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValueGreen}>€{stats.totalValue.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Valore totale</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="rgba(255,255,255,0.6)" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          placeholder="Cerca tavolo o bottiglia"
          placeholderTextColor="rgba(255,255,255,0.4)"
        />
        {!!searchQuery && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
      </View>

      {filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="package" size={56} color="rgba(255,255,255,0.28)" />
          <Text style={styles.emptyText}>Nessuna richiesta bottiglie</Text>
        </View>
      ) : (
        filteredOrders.map(order => {
          const meta = getStatusMeta(order.status);
          const primaryTitle =
            String(order.table?.table_name ?? "").trim() ||
            String(order.table?.nome ?? "").trim() ||
            "Tavolo";

          return (
            <View key={order.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.tableNumberCircle}>
                    <Text style={styles.tableNumberText}>{order.table?.numero ?? "?"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{primaryTitle}</Text>
                    <Text style={styles.cardSubtitle}>
                      {order.table?.zona ? `Zona ${order.table.zona}` : "Zona non assegnata"}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: meta.backgroundColor }]}> 
                  <Feather name={meta.icon} size={14} color={meta.color} />
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>

              <View style={styles.bottleCard}>
                <Text style={styles.bottleName}>{order.quantity}× {order.bottle_name}</Text>
                <Text style={styles.bottleMeta}>€{order.unit_price.toFixed(2)} cad. • Totale €{order.total_price.toFixed(2)}</Text>
                {!!order.note && <Text style={styles.noteText}>{order.note}</Text>}
              </View>

              <View style={styles.orderMetaRow}>
                <Text style={styles.orderMetaText}>
                  Persone: {order.table?.entrati ?? 0}/{order.table?.prenotati ?? 0}
                </Text>
                <Text style={styles.orderMetaText}>
                  Tavolo {order.is_table_saldato ? "saldato" : "non saldato"}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                {order.status === "requested" && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.prepareButton]}
                    onPress={() => handlePrepare(order.id)}
                  >
                    <Feather name="tool" size={16} color="white" />
                    <Text style={styles.actionButtonText}>Prendi in carico</Text>
                  </TouchableOpacity>
                )}

                {order.status !== "delivered" && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.dispatchButton]}
                    onPress={() => handleDispatch(order)}
                  >
                    <Feather name="send" size={16} color="white" />
                    <Text style={styles.actionButtonText}>Conferma uscita</Text>
                  </TouchableOpacity>
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
  container: {
    flexGrow: 1,
    padding: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    gap: 12,
  },

  title: {
    color: "white",
    fontSize: 32,
    fontWeight: "900",
  },

  subtitle: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 14,
    marginTop: 4,
  },

  summaryBadge: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    minWidth: 78,
  },

  summaryBadgeNumber: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
  },

  summaryBadgeLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
  },

  summaryCard: {
    backgroundColor: "rgba(15,23,42,0.72)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.2)",
    marginBottom: 20,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },

  statBlock: {
    flex: 1,
    gap: 6,
  },

  statValue: {
    color: "#F59E0B",
    fontSize: 24,
    fontWeight: "900",
  },

  statValueBlue: {
    color: "#60A5FA",
    fontSize: 24,
    fontWeight: "900",
  },

  statValueGreen: {
    color: "#4ADE80",
    fontSize: 24,
    fontWeight: "900",
  },

  statLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    fontWeight: "700",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 20,
  },

  searchInput: {
    flex: 1,
    color: "white",
    fontSize: 14,
    paddingVertical: 12,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    gap: 14,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  cardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  tableNumberCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1D4ED8",
    justifyContent: "center",
    alignItems: "center",
  },

  tableNumberText: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
  },

  cardTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },

  cardSubtitle: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 12,
    marginTop: 4,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },

  bottleCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 14,
  },

  bottleName: {
    color: "white",
    fontSize: 17,
    fontWeight: "900",
  },

  bottleMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 4,
  },

  noteText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic",
  },

  orderMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  orderMetaText: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 12,
    fontWeight: "700",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },

  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  prepareButton: {
    backgroundColor: "#2563EB",
  },

  dispatchButton: {
    backgroundColor: "#16A34A",
  },

  actionButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },

  loadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    marginTop: 14,
  },

  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },

  stateText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
  },

  emptyContainer: {
    paddingVertical: 72,
    alignItems: "center",
  },

  emptyText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 16,
    marginTop: 14,
  },
});