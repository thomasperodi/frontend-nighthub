import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useState, useRef, useEffect } from "react";
import { recordCloakroomSale, fetchStaffEventStats, listCloakroomSales } from "../../../services/staff";
import { EventStats } from "../../../types/events";

type Props = {
  showToast: (msg: string) => void;
  eventId: string;
  staffId?: string;
};

export default function GuardarobaTab({ showToast, eventId, staffId }: Props) {
  const [count, setCount] = useState(0);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [recenti, setRecenti] = useState<Array<{ id: number; time: Date }>>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!eventId) return;
    // carica stats + storico per popolare contatore giacche
    void (async () => {
      try {
        const [statsDb, sales] = await Promise.all([
          fetchStaffEventStats(eventId),
          listCloakroomSales(eventId),
        ]);
        setEventStats(statsDb);
        // ogni record rappresenta un capo (default ticket per capo)
        setCount(sales.length);
      } catch (err) {
        // silent
      }
    })();
  }, [eventId]);

  const handleAdd = async () => {
    if (!eventId) {
      showToast('Imposta prima un evento');
      return;
    }
    const newId = count + 1;
    setCount(newId);
    setRecenti(prev => [{ id: newId, time: new Date() }, ...prev.slice(0, 4)]);
    showToast('Capo registrato');

    try {
      const { stats } = await recordCloakroomSale({
        event_id: eventId,
        staff_id: staffId,
        amount: 3, // default ticket per capo
      });
      setEventStats(stats);
    } catch (err) {
      showToast('Errore salvataggio guardaroba');
    }

    // Animazioni
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true })
    ]).start();

    floatAnim.setValue(0);
    fadeAnim.setValue(1);
    Animated.parallel([
      Animated.timing(floatAnim, { toValue: -60, duration: 1000, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 1000, useNativeDriver: true })
    ]).start();
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Ora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m fa`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h fa`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Guardaroba</Text>
          <Text style={styles.subtitle}>Gestione capi</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{count}</Text>
          <Text style={styles.totalBadgeLabel}>capi</Text>
        </View>
      </View>

      {/* Lista ultimi capi con scroll */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {recenti.length > 0 ? (
          <View style={styles.recentList}>
            <Text style={styles.recentTitle}>
              <Feather name="clock" size={16} color="white" /> Ultimi registrati
            </Text>
            {recenti.map((item) => (
              <View key={item.id} style={styles.recentItem}>
                <View style={styles.recentIcon}>
                  <Feather name="check-circle" size={20} color="#22c55e" />
                </View>
                <Text style={styles.recentText}>Capo #{item.id}</Text>
                <Text style={styles.recentTime}>{getTimeAgo(item.time)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>Nessun capo registrato</Text>
            <Text style={styles.emptySubtext}>Usa il pulsante in basso per iniziare</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottone fisso in basso */}
      <View style={styles.fixedButtonContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%' }}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAdd}
            activeOpacity={0.85}
          >
            <Feather name="plus-circle" size={44} color="white" />
            <View style={styles.buttonTextContainer}>
              <Text style={styles.addButtonText}>Aggiungi capo</Text>
              <Text style={styles.addButtonSubtext}>Tocca per registrare</Text>
            </View>
            
            {/* Floating animation */}
            <Animated.View 
              style={[
                styles.floatingIndicator,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: floatAnim }]
                }
              ]}
            >
              <Text style={styles.floatingText}>+1</Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
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

  scrollContainer: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 20,
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
  },

  emptySubtext: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginTop: 8,
  },

  fixedButtonContainer: {
    paddingTop: 16,
    paddingBottom: 100,
  },

  addButton: {
    backgroundColor: "#6D5BFF",
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    shadowColor: "#6D5BFF",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'visible',
    minHeight: 100,
  },

  buttonTextContainer: {
    flex: 1,
  },

  addButtonText: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },

  addButtonSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },

  floatingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
  },

  floatingText: {
    fontSize: 48,
    fontWeight: '900',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  recentList: {
    width: "100%",
  },

  recentTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 16,
  },

  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  recentText: {
    flex: 1,
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  recentTime: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
  },
});
