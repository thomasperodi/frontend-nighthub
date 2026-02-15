import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { useState, useRef, useEffect } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { recordEntry, fetchStaffEventStats, listEntries, scanEntryQr } from "../../../services/staff";
import { EventStats } from "../../../types/events";

type Props = {
  showToast: (msg: string) => void;
  openPrompt: (cfg: any) => void;
  eventId: string;
  staffId?: string;
  venueId?: string;
};

export default function IngressoTab({ showToast, openPrompt, eventId, staffId, venueId }: Props) {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState({ uomini: 0, donne: 0, omaggi: 0 });
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: any;
    if (scanning) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
    return () => anim && anim.stop();
  }, [scanning]);

  useEffect(() => {
    if (!eventId) return;
    // carica stats + storico per popolare i contatori
    void (async () => {
      try {
        const [statsDb, entries] = await Promise.all([
          fetchStaffEventStats(eventId),
          listEntries(eventId),
        ]);
        setEventStats(statsDb);
        const counts = entries.reduce(
          (acc, curr) => {
            const t = curr.entry_type;
            if (t === 'male') acc.uomini += curr.quantity ?? 1;
            else if (t === 'female') acc.donne += curr.quantity ?? 1;
            else if (t === 'free') acc.omaggi += curr.quantity ?? 1;
            else acc.omaggi += curr.quantity ?? 1; // default unknown as free
            return acc;
          },
          { uomini: 0, donne: 0, omaggi: 0 },
        );
        setStats(counts);
      } catch (err) {
        // silent
      }
    })();
  }, [eventId]);

  const addEntry = async (type: 'uomini' | 'donne' | 'omaggi') => {
    if (!eventId) {
      showToast('Imposta prima un evento');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      setStats(prev => ({ ...prev, [type]: prev[type] + 1 }));
      const entry_type = type === 'uomini' ? 'male' : type === 'donne' ? 'female' : 'free';
      const { stats: updated } = await recordEntry({
        event_id: eventId,
        staff_id: staffId,
        quantity: 1,
        entry_type,
      });
      setEventStats(updated);
      showToast(type === 'omaggi' ? 'Omaggio registrato' : 'Ingresso registrato');
    } catch (err) {
      showToast('Errore salvataggio ingresso');
    } finally {
      setBusy(false);
    }
  };

  const handleQrScanned = async (data: string) => {
    if (scanBusy) return;
    setScanBusy(true);

    try {
      if (!eventId) {
        showToast('Imposta prima un evento');
        return;
      }

      const result = await scanEntryQr({
        event_id: eventId,
        qr_data: data,
        staff_id: staffId,
      });

      if (result?.alreadyCheckedIn) {
        showToast('Ingresso già registrato');
      } else {
        showToast('Ingresso registrato');
      }
    } catch {
      showToast('Errore registrazione ingresso');
    } finally {
      setScanBusy(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <View style={styles.permissionCard}>
          <Feather name="camera" size={64} color="#6D5BFF" />
          <Text style={styles.permissionTitle}>Fotocamera richiesta</Text>
          <Text style={styles.permissionText}>
            Per scansionare i QR code è necessario l'accesso alla fotocamera
          </Text>
          <TouchableOpacity onPress={requestPermission} style={styles.primaryButton}>
            <Feather name="check" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Consenti accesso</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (scanning) {
    return (
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => {
            setScanning(false);
            void handleQrScanned(data);
          }}
        >
          <View style={styles.scanOverlay}>
            <Animated.View style={[styles.scanFrame, { transform: [{ scale: pulse }] }]} />
            <Text style={styles.scanInstruction}>
              Inquadra il QR code del biglietto
            </Text>
          </View>
        </CameraView>
        
        <TouchableOpacity
          style={styles.closeScan}
          onPress={() => setScanning(false)}
        >
          <Feather name="x" size={28} color="white" />
        </TouchableOpacity>
      </View>
    );
  }

  const totale = stats.uomini + stats.donne + stats.omaggi;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ingresso</Text>
          <Text style={styles.subtitle}>Gestione accessi</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{totale}</Text>
          <Text style={styles.totalBadgeLabel}>totale</Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard icon="user" label="Uomini" count={stats.uomini} color="#3B82F6" />
        <StatCard icon="user" label="Donne" count={stats.donne} color="#EC4899" />
        <StatCard icon="gift" label="Omaggi" count={stats.omaggi} color="#8B5CF6" />
      </View>

      {/* Scansiona QR */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => setScanning(true)}
      >
        <Feather name="camera" size={28} color="white" />
        <Text style={styles.scanText}>Scansiona QR Code</Text>
      </TouchableOpacity>

      {/* Aggiunta rapida */}
      <Text style={styles.sectionTitle}>Aggiunta rapida</Text>
      <View style={styles.quickRow}>
        <QuickAdd 
          label="Uomo" 
          icon="user" 
          color="#3B82F6"
          onPress={() => addEntry('uomini')} 
        />
        <QuickAdd 
          label="Donna" 
          icon="user" 
          color="#EC4899"
          onPress={() => addEntry('donne')} 
        />
        <QuickAdd 
          label="Omaggio" 
          icon="gift" 
          color="#8B5CF6"
          onPress={() => addEntry('omaggi')} 
        />
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, count, color }: any) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Feather name={icon} size={20} color={color} />
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAdd({ label, icon, color, onPress }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    // Scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      })
    ]).start();

    // Pulse animation
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.15,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start();

    // Float up animation for +1
    floatAnim.setValue(0);
    fadeAnim.setValue(1);
    Animated.parallel([
      Animated.timing(floatAnim, {
        toValue: -40,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();

    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={{ flex: 1 }}>
      <Animated.View style={[
        styles.quickAdd, 
        { 
          transform: [{ scale: scaleAnim }],
          backgroundColor: color,
        }
      ]}>
        <Animated.View style={[
          styles.quickAddIcon, 
          { 
            backgroundColor: 'rgba(255,255,255,0.25)',
            transform: [{ scale: pulseAnim }]
          }
        ]}>
          <Feather name={icon} size={32} color="white" />
        </Animated.View>
        <View style={styles.quickAddContent}>
          <Text style={styles.quickAddPlus}>+1</Text>
          <Text style={styles.quickAddLabel}>{label}</Text>
        </View>

        {/* Floating +1 animation */}
        <Animated.View 
          style={[
            styles.floatingCounter,
            {
              opacity: fadeAnim,
              transform: [{ translateY: floatAnim }]
            }
          ]}
        >
          <Text style={styles.floatingCounterText}>+1</Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
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

  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    alignItems: "center",
  },

  statCount: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
    marginVertical: 8,
  },

  statLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
  },

  scanButton: {
    backgroundColor: "#6D5BFF",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
    shadowColor: "#6D5BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  scanText: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
  },

  scanOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: "white",
    borderRadius: 24,
    backgroundColor: "transparent",
  },

  scanInstruction: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 32,
    textAlign: "center",
    paddingHorizontal: 32,
  },

  closeScan: {
    position: "absolute",
    top: 60,
    right: 24,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 16,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
    marginTop: 8,
  },

  quickRow: {
    flexDirection: "column",
    gap: 14,
  },

  quickAdd: {
    minHeight: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'visible',
  },

  quickAddIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  quickAddContent: {
    flex: 1,
  },

  quickAddPlus: {
    fontSize: 28,
    fontWeight: "900",
    color: "white",
    marginBottom: 2,
  },

  quickAddLabel: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 16,
    fontWeight: "700",
  },

  floatingCounter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
  },

  floatingCounterText: {
    fontSize: 36,
    fontWeight: '900',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  permissionCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    maxWidth: 340,
  },

  permissionTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 20,
    marginBottom: 8,
  },

  permissionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },

  primaryButton: {
    backgroundColor: "#6D5BFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#6D5BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  primaryButtonText: { 
    color: "white", 
    fontWeight: "800",
    fontSize: 16,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
});
