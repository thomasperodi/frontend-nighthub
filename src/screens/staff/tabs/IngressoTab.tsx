import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { useState, useRef, useEffect, useCallback } from "react";
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

type AgeBucket =
  | 'AGE_18_20'
  | 'AGE_21_24'
  | 'AGE_25_29'
  | 'AGE_30_34'
  | 'AGE_35_PLUS'
  | 'UNKNOWN';

type ManualEntryPayload = {
  gender: 'M' | 'F' | 'ALTRO';
  isComplimentary: boolean;
  ageBucket?: AgeBucket;
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

  const errorInfo = (err: any) => {
    const status = err?.response?.status ?? null;
    const data = err?.response?.data ?? null;
    const rawMessage = data?.message ?? err?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.filter(Boolean).join(', ')
      : typeof rawMessage === 'string' && rawMessage.trim().length
        ? rawMessage
        : 'Errore sconosciuto';
    return { status, data, message };
  };

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

  const loadEntryState = useCallback(async () => {
    if (!eventId) return;
    try {
      const [statsDb, entries] = await Promise.all([
        fetchStaffEventStats(eventId),
        listEntries(eventId),
      ]);
      setEventStats(statsDb);
      const counts = entries.reduce(
        (acc, curr) => {
          const quantity = curr.quantity ?? 1;
          if (curr.is_complimentary) {
            acc.omaggi += quantity;
            return acc;
          }

          if (curr.gender === 'M') {
            acc.uomini += quantity;
          } else if (curr.gender === 'F') {
            acc.donne += quantity;
          } else {
            acc.omaggi += quantity;
          }

          return acc;
        },
        { uomini: 0, donne: 0, omaggi: 0 },
      );
      setStats(counts);
    } catch (err) {
      console.error('[staff.ingresso] loadEntryState error', {
        eventId,
        staffId,
        venueId,
        ...(errorInfo(err) as any),
      });
    }
  }, [eventId, staffId, venueId]);

  useEffect(() => {
    void loadEntryState();
  }, [loadEntryState]);

  const ageBucketFromInput = (raw: string): AgeBucket | undefined | 'invalid' => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const age = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(age) || age < 0 || age > 100) return 'invalid';
    if (age <= 20) return 'AGE_18_20';
    if (age <= 24) return 'AGE_21_24';
    if (age <= 29) return 'AGE_25_29';
    if (age <= 34) return 'AGE_30_34';
    return 'AGE_35_PLUS';
  };

  const addEntry = async ({ gender, isComplimentary, ageBucket }: ManualEntryPayload) => {
    if (!eventId) {
      showToast('Imposta prima un evento');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      console.log('[staff.ingresso] addEntry request', {
        eventId,
        staffId,
        venueId,
        gender,
        isComplimentary,
        ageBucket: ageBucket ?? null,
      });

      setStats((prev) => {
        if (isComplimentary) return { ...prev, omaggi: prev.omaggi + 1 };
        if (gender === 'M') return { ...prev, uomini: prev.uomini + 1 };
        if (gender === 'F') return { ...prev, donne: prev.donne + 1 };
        return { ...prev, omaggi: prev.omaggi + 1 };
      });

      const entry_type = isComplimentary
        ? 'free'
        : gender === 'M'
          ? 'male'
          : gender === 'F'
            ? 'female'
            : 'free';

      const { stats: updated } = await recordEntry({
        event_id: eventId,
        staff_id: staffId,
        quantity: 1,
        entry_type,
        gender,
        is_complimentary: isComplimentary,
        age_bucket: ageBucket,
      });

      console.log('[staff.ingresso] addEntry success', {
        eventId,
        totalEntries: updated?.total_entries,
        entriesRevenue: updated?.total_entries_revenue,
      });

      setEventStats(updated);
      showToast(isComplimentary ? 'Omaggio registrato' : 'Ingresso registrato');
    } catch (err) {
      const info = errorInfo(err);
      console.error('[staff.ingresso] addEntry error', {
        eventId,
        staffId,
        venueId,
        gender,
        isComplimentary,
        ageBucket: ageBucket ?? null,
        ...info,
      });
      showToast(info.message || 'Errore salvataggio ingresso');
      void loadEntryState();
    } finally {
      setBusy(false);
    }
  };

  const addEntryWithOptionalAge = (base: Omit<ManualEntryPayload, 'ageBucket'>) => {
    openPrompt({
      title: 'Età (opzionale)',
      placeholder: 'Es. 23 - lascia vuoto per saltare',
      keyboardType: 'numeric',
      onSubmit: (value: string) => {
        const parsed = ageBucketFromInput(value);
        if (parsed === 'invalid') {
          showToast('Età non valida');
          return;
        }
        void addEntry({ ...base, ageBucket: parsed });
      },
    });
  };

  const handleQrScanned = async (data: string) => {
    if (scanBusy) return;
    setScanBusy(true);

    try {
      if (!eventId) {
        showToast('Imposta prima un evento');
        return;
      }

      console.log('[staff.ingresso] qrScan request', {
        eventId,
        staffId,
        venueId,
        qrPreview: String(data ?? '').slice(0, 40),
      });

      const result = await scanEntryQr({
        event_id: eventId,
        qr_data: data,
        staff_id: staffId,
      });

      console.log('[staff.ingresso] qrScan success', {
        eventId,
        alreadyCheckedIn: Boolean(result?.alreadyCheckedIn),
        reservationId: result?.reservation?.id ?? null,
        entryId: result?.entry?.id ?? null,
      });

      if (result?.alreadyCheckedIn) {
        showToast('Ingresso già registrato');
      } else {
        await loadEntryState();
        showToast('Ingresso registrato');
      }
    } catch (err) {
      const info = errorInfo(err);
      console.error('[staff.ingresso] qrScan error', {
        eventId,
        staffId,
        venueId,
        qrPreview: String(data ?? '').slice(0, 40),
        ...info,
      });
      showToast(info.message || 'Errore registrazione ingresso');
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
      <Text style={styles.sectionHint}>Tieni premuto su un pulsante per registrare anche la fascia età</Text>
      <View style={styles.quickRow}>
        <QuickAdd 
          label="Uomo" 
          icon="user" 
          color="#3B82F6"
          onPress={() => void addEntry({ gender: 'M', isComplimentary: false })}
          onLongPress={() => addEntryWithOptionalAge({ gender: 'M', isComplimentary: false })}
        />
        <QuickAdd 
          label="Donna" 
          icon="user" 
          color="#EC4899"
          onPress={() => void addEntry({ gender: 'F', isComplimentary: false })}
          onLongPress={() => addEntryWithOptionalAge({ gender: 'F', isComplimentary: false })}
        />
        <QuickAdd 
          label="Omaggio Uomo" 
          icon="gift" 
          color="#7C3AED"
          onPress={() => void addEntry({ gender: 'M', isComplimentary: true })}
          onLongPress={() => addEntryWithOptionalAge({ gender: 'M', isComplimentary: true })}
        />
        <QuickAdd 
          label="Omaggio Donna" 
          icon="gift" 
          color="#A855F7"
          onPress={() => void addEntry({ gender: 'F', isComplimentary: true })}
          onLongPress={() => addEntryWithOptionalAge({ gender: 'F', isComplimentary: true })}
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

function QuickAdd({ label, icon, color, onPress, onLongPress }: any) {
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
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={320}
      activeOpacity={0.85}
      style={{ flex: 1 }}
    >
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

  sectionHint: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    marginBottom: 12,
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
