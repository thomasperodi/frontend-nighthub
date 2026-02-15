import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert, Modal, TextInput, Platform, Keyboard, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { fetchActiveEventForVenue } from "../../services/events";

// Import Tab Components
import IngressoTab from "./tabs/IngressoTab";
import GuardarobaTab from "./tabs/GuardarobaTab";
import ImmagineTab from "./tabs/ImmagineTab";
import CameriereTab from "./tabs/CameriereTab";
import BarTab from "./tabs/BarTab";

// Import Utilities
import RoleButton from "./utils/RoleButton";
import PromptModal from "./utils/PromptModal";
import Toast from "./utils/Toast";

type StaffRole =
  | "ingresso"
  | "guardaroba"
  | "immagine"
  | "cameriere"
  | "bar"
  | null;

export default function StaffHomeScreen() {
  const { theme } = useTheme();
  const { signOut, user } = useAuth();
  const [role, setRole] = useState<StaffRole>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [venueName, setVenueName] = useState('Locale');
  const [eventId, setEventId] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');
  const [promptConfig, setPromptConfig] = useState<any>({ visible: false, title: '', placeholder: '', keyboardType: 'default', onSubmit: (v: string) => {} });
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugPayload, setDebugPayload] = useState<any>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2200);
  }, []);

  const openPrompt = useCallback((config: any) => {
    setPromptConfig({ visible: true, ...config });
  }, []);

  // Carica o crea automaticamente l'evento LIVE per il venue dell'utente staff
  useEffect(() => {
    const venueId = user?.venue_id;
    let mounted = true;

    if (!venueId) {
      setEventId('');
      setEventName('');
      setEventError('Il tuo account non ha un locale associato');
      setDebugPayload({ step: 'no_venue', userId: user?.id ?? null });
      return () => {
        mounted = false;
      };
    }
    setLoadingEvent(true);
    setEventError(null);
    const startedAt = Date.now();
    console.log('[staff] load venue events start', {
      venueId,
      userId: user?.id,
      now: new Date().toISOString(),
    });
    setDebugPayload({
      step: 'start',
      venueId,
      userId: user?.id,
      now: new Date().toISOString(),
    });

    void (async () => {
      try {
        const active = await fetchActiveEventForVenue(venueId);
        const ms = Date.now() - startedAt;

        console.log('[staff] active event resolve', {
          venueId,
          ms,
          found: !!active,
          id: active?.id,
          name: active?.name,
          status: (active as any)?.status,
          date: (active as any)?.date,
          start_time: (active as any)?.start_time,
          end_time: (active as any)?.end_time,
        });

        if (!mounted) return;

        setDebugPayload({
          step: 'active_event_resolve',
          venueId,
          ms,
          found: !!active,
          active,
        });

        if (!active) {
          setEventId('');
          setEventName('');
          setEventError('Nessun evento LIVE trovato per questo locale');
          setDebugPayload((p: any) => ({ ...p, step: 'no_live' }));
          return;
        }

        // Usa l'ID dell'evento LIVE come eventId per tutta la staff area
        setEventId(active.id);
        setEventName(active.name ?? '');
        setEventError(null);
        setDebugPayload((p: any) => ({
          ...p,
          step: 'selected_live',
          selected: {
            eventId: active?.id,
            name: active?.name,
            status: (active as any)?.status,
            date: (active as any)?.date,
            start_time: (active as any)?.start_time,
            end_time: (active as any)?.end_time,
          },
        }));
      } catch (err: any) {
        const errDebug = {
          message: err?.message,
          status: err?.response?.status,
          data: err?.response?.data,
        };
        console.error('[staff] fetchActiveEventForVenue error', errDebug);
        if (!mounted) return;
        setDebugPayload({ step: 'error', venueId, ...errDebug });
        setEventId('');
        setEventName('');
        setEventError('Impossibile recuperare la lista eventi del locale');
      } finally {
        if (mounted) setLoadingEvent(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.venue_id]);

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Sei sicuro di voler uscire dal tuo account?",
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
              // signOut gestisce automaticamente il reindirizzamento tramite AuthProvider
            } catch (err) {
              console.error('Logout error:', err);
              showToast('Errore durante il logout');
              setIsLoggingOut(false);
            }
          }
        }
      ]
    );
  };

  /* ======================
     SCELTA RUOLO
  ====================== */

  if (!role) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {isLoggingOut && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }]}>
            <View style={{ backgroundColor: theme.colors.background, padding: 24, borderRadius: 16, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600', marginBottom: 16 }}>Disconnessione in corso...</Text>
            </View>
          </View>
        )}
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.venueNameText, { color: theme.colors.text }]}>{venueName}</Text>
            <Feather name="users" size={32} color="#6D5BFF" />
            <Text style={[styles.title, { color: theme.colors.text }]}>Seleziona il tuo ruolo</Text>
            <Text style={[styles.subtitle, { color: theme.colors.text }]}>Scegli la tua postazione di lavoro</Text>
            
          </View>

          <View style={styles.roleGrid}>
            <RoleButton 
              icon="log-in" 
              label="Ingresso" 
              description="Gestisci accessi"
              onPress={() => setRole("ingresso")} 
            />
            <RoleButton 
              icon="archive" 
              label="Guardaroba" 
              description="Gestisci capi"
              onPress={() => setRole("guardaroba")} 
            />
            <RoleButton 
              icon="star" 
              label="Immagine" 
              description="Tavoli & PR"
              onPress={() => setRole("immagine")} 
            />
            <RoleButton 
              icon="users" 
              label="Cameriere" 
              description="Servizio tavoli"
              onPress={() => setRole("cameriere")} 
            />
            <RoleButton 
              icon="coffee" 
              label="Bar" 
              description="Vendite rapide"
              onPress={() => setRole("bar")} 
            />
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity 
            style={[styles.logoutButtonFloating, { flex: 1 }]}
            onPress={handleLogout}
            disabled={isLoggingOut}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Logout dal tuo account"
          >
            <Feather name="log-out" size={20} color="white" />
            <Text style={styles.logoutButtonFloatingText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ======================
     DASHBOARD PER RUOLO
  ====================== */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Event auto-bind */}
      <Pressable
        onLongPress={() => setDebugVisible(true)}
        style={{ padding: 16, gap: 8 }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>
          Evento corrente (LIVE)
        </Text>
        <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 16}}>
          {loadingEvent ? 'Caricamento...' : eventName || (eventId ? 'Evento attivo' : 'Nessun evento LIVE trovato')}
        </Text>
        {eventError && (
          <Text style={{ color: '#f87171', fontSize: 12 }}>
            {eventError}
          </Text>
        )}
        <Text style={{ color: theme.colors.text, fontSize: 11, opacity: 0.6 }}>
          Long press qui per debug
        </Text>
      </Pressable>

      <Modal
        visible={debugVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDebugVisible(false)}
      >
        <Pressable
          onPress={() => setDebugVisible(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            padding: 18,
            justifyContent: 'center',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: 16,
              padding: 14,
              maxHeight: '80%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 16 }}>Debug Staff</Text>
              <TouchableOpacity onPress={() => setDebugVisible(false)}>
                <Feather name="x" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text selectable style={{ color: theme.colors.text, fontSize: 12, lineHeight: 18 }}>
                {JSON.stringify(
                  {
                    venueId: user?.venue_id,
                    eventId,
                    eventName,
                    eventError,
                    debug: debugPayload,
                  },
                  null,
                  2,
                )}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {role === "ingresso" && (
        <IngressoTab
          showToast={showToast}
          openPrompt={openPrompt}
          eventId={eventId}
          staffId={user?.id}
          venueId={user?.venue_id}
        />
      )}
      {role === "guardaroba" && (
        <GuardarobaTab
          showToast={showToast}
          eventId={eventId}
          staffId={user?.id}
        />
      )}
      {role === "immagine" && (
        <ImmagineTab 
          openPrompt={openPrompt} 
          showToast={showToast} 
          eventId={eventId}
          venueId={user?.venue_id}
        />
      )}
      {role === "cameriere" && (
        <CameriereTab 
          openPrompt={openPrompt} 
          showToast={showToast}
          userId={user?.id}
          eventId={eventId}
          venueId={user?.venue_id}
        />
      )}
      {role === "bar" && (
        <BarTab
          openPrompt={openPrompt}
          showToast={showToast}
          eventId={eventId}
          staffId={user?.id}
        />
      )}

      <View style={styles.bottomButtonsContainer}>
        <TouchableOpacity 
          style={styles.changeRoleButton} 
          onPress={() => setRole(null)}
          accessibilityRole="button"
          accessibilityLabel="Cambia ruolo"
        >
          <Feather name="refresh-ccw" size={18} color="white" />
          <Text style={styles.changeRoleText}>Cambia ruolo</Text>
        </TouchableOpacity>
      </View>

      <PromptModal
        visible={promptConfig.visible}
        title={promptConfig.title}
        placeholder={promptConfig.placeholder}
        keyboardType={promptConfig.keyboardType}
        onCancel={() => setPromptConfig((p: any) => ({ ...p, visible: false }))}
        onSubmit={(value: string) => {
          setPromptConfig((p: any) => ({ ...p, visible: false }));
          promptConfig.onSubmit && promptConfig.onSubmit(value);
        }}
      />

      <Toast message={toastMsg} visible={!!toastMsg} />
    </SafeAreaView>
  );
}

/* ======================
   STILI
====================== */

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20,
  },
  
  header: {
    alignItems: "center",
    marginBottom: 32,
  },

  venueNameText: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    opacity: 0.8,
  },

  title: { 
    fontSize: 28, 
    fontWeight: "900", 
    marginTop: 16,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
    opacity: 0.7,
  },

  roleGrid: {
    width: '100%',
    marginTop: 8,
  },

  roleButton: {
    width: "100%",
    minHeight: 84,
    backgroundColor: "#6D5BFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: "#6D5BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },

  modalInput: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 16,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },

  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },

  modalCancel: {
    backgroundColor: 'transparent',
  },

  modalConfirm: {
    backgroundColor: '#6D5BFF',
  },

  modalBtnText: {
    color: '#111827',
    fontWeight: '700',
  },

  modalConfirmText: {
    color: 'white',
    fontWeight: '900',
  },

  toast: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 1000,
  },

  toastText: {
    color: 'white',
    fontWeight: '700',
  },

  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 0,
  },

  roleLabel: {
    color: "white",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 2,
    textAlign: "left",
  },

  roleDescription: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    textAlign: "left",
  },

  roleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  roleText: {
    flex: 1,
  },

  changeRole: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(139,123,255,0.9)",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  changeRoleText: {
    color: "white",
    fontWeight: "800",
    fontSize: 14,
  },

  roleContainer: {
  },

  roleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },

  roleTitle: { 
    fontSize: 32, 
    fontWeight: "900", 
    color: "white",
  },

  roleSubtitle: {
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

  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
    marginTop: 8,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  /* ======================
     PERMESSI FOTOCAMERA
  ====================== */

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

  /* ======================
     SCANNER QR
  ====================== */

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

  /* ======================
     STATS CARDS
  ====================== */

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

  /* ======================
     AGGIUNTA RAPIDA
  ====================== */

  quickRow: {
    flexDirection: "row",
    gap: 12,
  },

  quickAdd: {
    flex: 1,
    minHeight: 120,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: 'center',
  },

  quickAddIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  quickAddPlus: {
    fontSize: 24,
    fontWeight: "900",
    color: "white",
    marginBottom: 4,
  },

  quickAddLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "700",
  },

  /* ======================
     GUARDAROBA
  ====================== */

  giantButton: {
    width: "100%",
    maxWidth: 320,
    aspectRatio: 1,
    backgroundColor: "#6D5BFF",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6D5BFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },

  giantPlus: {
    fontSize: 28,
    fontWeight: "900",
    color: "white",
    marginTop: 16,
  },

  giantSub: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginTop: 8,
  },

  recentList: {
    marginTop: 32,
    width: "100%",
  },

  recentTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },

  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },

  recentText: {
    flex: 1,
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },

  recentTime: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },

  /* ======================
     TAVOLI
  ====================== */

  tableCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },

  tableCardPaid: {
    opacity: 0.6,
  },

  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  tableTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },

  tableProgress: {
    gap: 8,
  },

  progressBar: {
    width: 150,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 3,
  },

  tableInfo: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },

  tableNumberBadge: {
    backgroundColor: "#6D5BFF",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },

  tableNumber: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },

  tableActions: {
    flexDirection: "row",
    gap: 12,
  },

  tableButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },

  tableButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 14,
  },

  confirmButton: {
    backgroundColor: "#22c55e",
  },

  assignButton: {
    backgroundColor: "#6D5BFF",
  },

  moneyButton: {
    backgroundColor: "#3B82F6",
  },

  payButton: {
    backgroundColor: "#22c55e",
  },

  /* ======================
     CAMERIERE - BUDGET
  ====================== */

  budgetBadge: {
    alignItems: "flex-end",
  },

  budgetAmount: {
    color: "#22c55e",
    fontSize: 24,
    fontWeight: "900",
  },

  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    backgroundColor: "rgba(34,197,94,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  paidText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "700",
  },

  /* ======================
     BAR
  ====================== */

  barStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  barStatItem: {
    flex: 1,
    alignItems: "center",
  },

  barStatValue: {
    color: "white",
    fontSize: 32,
    fontWeight: "900",
  },

  barStatLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },

  barStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 20,
  },

  priceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  priceButton: {
    width: "48%",
    minHeight: 120,
    backgroundColor: "#6D5BFF",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    shadowColor: "#6D5BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  priceValue: {
    color: "white",
    fontSize: 32,
    fontWeight: "900",
  },

  priceLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "600",
  },

  customPriceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(109,91,255,0.15)",
    borderWidth: 2,
    borderColor: "#6D5BFF",
    borderStyle: "dashed",
    paddingVertical: 18,
    borderRadius: 18,
    marginTop: 14,
  },

  customPriceText: {
    color: "#6D5BFF",
    fontSize: 16,
    fontWeight: "800",
  },

  /* ======================
     LOGOUT BUTTONS
  ====================== */

  bottomButtonsContainer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  logoutButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 14,
  },

  changeRoleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(139,123,255,0.9)",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#6D5BFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: 220,
  },

  logoutButtonFloating: {
    position: "absolute",
    bottom: 30,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  logoutButtonFloatingText: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },

  
});