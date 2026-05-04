import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { fetchActiveEventForVenue } from "../../services/events";
import { getMyVenuePrMembership } from "../../services/prNetwork";

// Import Tab Components
import IngressoTab from "./tabs/IngressoTab";
import GuardarobaTab from "./tabs/GuardarobaTab";
import ImmagineTab from "./tabs/ImmagineTab";
import CameriereTab from "./tabs/CameriereTab";
import CambusaTab from "./tabs/CambusaTab";
import BarTab from "./tabs/BarTab";
import PrDashboardTab from "./tabs/PrDashboardTab";

// Import Utilities
import RoleButton from "./utils/RoleButton";
import PromptModal from "./utils/PromptModal";
import Toast from "./utils/Toast";

type StaffRole =
  | "ingresso"
  | "guardaroba"
  | "immagine"
  | "cameriere"
  | "cambusa"
  | "pr_dashboard"
  | "bar"
  | null;

const ROLE_OPTIONS: Array<{
  key: Exclude<StaffRole, null>;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description: string;
  requiresLiveEvent?: boolean;
  requiresPrAccess?: boolean;
}> = [
  {
    key: "ingresso",
    icon: "log-in",
    label: "Ingresso",
    description: "Gestisci accessi",
    requiresLiveEvent: true,
  },
  {
    key: "guardaroba",
    icon: "archive",
    label: "Guardaroba",
    description: "Gestisci capi",
    requiresLiveEvent: true,
  },
  {
    key: "immagine",
    icon: "star",
    label: "Immagine",
    description: "Tavoli & PR",
    requiresLiveEvent: true,
  },
  {
    key: "cameriere",
    icon: "users",
    label: "Cameriere",
    description: "Servizio tavoli",
    requiresLiveEvent: true,
  },
  {
    key: "cambusa",
    icon: "package",
    label: "Cambusa",
    description: "Bottiglie in preparazione",
    requiresLiveEvent: true,
  },
  {
    key: "bar",
    icon: "coffee",
    label: "Bar",
    description: "Vendite rapide",
    requiresLiveEvent: true,
  },
  {
    key: "pr_dashboard",
    icon: "git-branch",
    label: "PR Dashboard",
    description: "Gestisci team PR locale",
    requiresPrAccess: true,
  },
];

const ROLE_LABELS: Record<Exclude<StaffRole, null>, string> = {
  ingresso: "Ingresso",
  guardaroba: "Guardaroba",
  immagine: "Tavoli & PR",
  cameriere: "Cameriere",
  cambusa: "Cambusa",
  bar: "Bar",
  pr_dashboard: "PR Dashboard",
};

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
  const [prAccessLoading, setPrAccessLoading] = useState(false);
  const [prDashboardEnabled, setPrDashboardEnabled] = useState(false);
  const hasLiveEvent = !!eventId;
  const canSelectRole = hasLiveEvent && !loadingEvent;

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

  useEffect(() => {
    const venueId = user?.venue_id;
    let mounted = true;

    if (!venueId) {
      setPrDashboardEnabled(false);
      setPrAccessLoading(false);
      return () => {
        mounted = false;
      };
    }

    setPrAccessLoading(true);
    void (async () => {
      try {
        const access = await getMyVenuePrMembership(venueId);
        if (!mounted) return;
        setPrDashboardEnabled(Boolean(access?.can_access_dashboard));
      } catch {
        if (!mounted) return;
        setPrDashboardEnabled(false);
      } finally {
        if (mounted) setPrAccessLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.venue_id]);

  const isRoleDisabled = useCallback(
    (item: (typeof ROLE_OPTIONS)[number]) => {
      if (item.requiresPrAccess) {
        return !user?.venue_id || prAccessLoading || !prDashboardEnabled;
      }
      if (item.requiresLiveEvent) {
        return !canSelectRole;
      }
      return false;
    },
    [canSelectRole, prAccessLoading, prDashboardEnabled, user?.venue_id],
  );

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

          <View style={[styles.eventStatusCard, { backgroundColor: theme.colors.card }]}> 
            <View style={styles.eventStatusHeader}>
              <Feather name="radio" size={16} color={canSelectRole ? "#22c55e" : "#f59e0b"} />
              <Text style={[styles.eventStatusTitle, { color: theme.colors.text }]}>Evento corrente</Text>
            </View>
            <Text style={[styles.eventStatusMain, { color: hasLiveEvent ? "#22c55e" : theme.colors.text }]}>
              {loadingEvent ? "Caricamento evento LIVE..." : eventName || "Nessun evento LIVE trovato"}
            </Text>
            {!!eventError && <Text style={styles.eventStatusError}>{eventError}</Text>}
            {!loadingEvent && !hasLiveEvent && (
              <Text style={[styles.eventStatusHint, { color: theme.colors.text }]}>Serve un evento LIVE per aprire le postazioni.</Text>
            )}
          </View>

          <View style={styles.roleGrid}>
            {ROLE_OPTIONS.map((item) => (
              <RoleButton
                key={item.key}
                icon={item.icon}
                label={item.label}
                description={item.description}
                disabled={isRoleDisabled(item)}
                onPress={() => setRole(item.key)}
              />
            ))}
          </View>

          {!prAccessLoading && !prDashboardEnabled && (
            <Text style={[styles.roleHintText, { color: theme.colors.text }]}>
              La voce PR Dashboard si abilita quando il tuo utente e autorizzato nel network PR del locale.
            </Text>
          )}
        </ScrollView>

        <View style={styles.selectionFooter}>
          <TouchableOpacity 
            style={[styles.logoutButtonFloating, isLoggingOut && styles.logoutButtonDisabled]}
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
      <View style={[styles.roleTopBar, { borderBottomColor: theme.colors.border }]}> 
        <TouchableOpacity
          style={styles.roleTopBarAction}
          onPress={() => setRole(null)}
          accessibilityRole="button"
          accessibilityLabel="Torna alla selezione ruoli"
        >
          <Feather name="chevron-left" size={18} color={theme.colors.text} />
          <Text style={[styles.roleTopBarActionText, { color: theme.colors.text }]}>Ruoli</Text>
        </TouchableOpacity>

        <View style={styles.roleTopBarCenter}>
          <Text style={[styles.roleTopBarTitle, { color: theme.colors.text }]}>{ROLE_LABELS[role]}</Text>
          <Text style={[styles.roleTopBarSubtitle, { color: theme.colors.text }]}>Area operativa</Text>
        </View>

        <TouchableOpacity
          style={styles.roleTopBarAction}
          onPress={handleLogout}
          disabled={isLoggingOut}
          accessibilityRole="button"
          accessibilityLabel="Logout dal tuo account"
        >
          <Feather name="log-out" size={18} color="#EF4444" />
          <Text style={styles.roleTopBarLogout}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Pressable onLongPress={() => setDebugVisible(true)} style={[styles.eventLiveCard, { backgroundColor: theme.colors.card }]}> 
        <View style={styles.eventLiveHeader}>
          <Text style={[styles.eventLiveTitle, { color: theme.colors.text }]}>Evento LIVE</Text>
          <Feather name="info" size={15} color={theme.colors.text} style={{ opacity: 0.6 }} />
        </View>
        <Text style={[styles.eventLiveName, { color: hasLiveEvent ? theme.colors.primary : theme.colors.text }]}>
          {loadingEvent ? 'Caricamento...' : eventName || 'Nessun evento LIVE trovato'}
        </Text>
        {!!eventError && <Text style={styles.eventLiveError}>{eventError}</Text>}
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

      <View style={styles.roleContent}>
        {role === "ingresso" && (
          <IngressoTab
            showToast={showToast}
            openPrompt={openPrompt}
            eventId={eventId}
            staffId={user?.id}
            venueId={user?.venue_id ?? undefined}
          />
        )}
        {role === "guardaroba" && (
          <GuardarobaTab
            showToast={showToast}
            eventId={eventId}
            staffId={user?.id}
            venueId={user?.venue_id ?? undefined}
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
        {role === "cambusa" && (
          <CambusaTab
            showToast={showToast}
            eventId={eventId}
            venueId={user?.venue_id ?? undefined}
          />
        )}
        {role === "bar" && (
          <BarTab
            openPrompt={openPrompt}
            showToast={showToast}
            eventId={eventId}
            staffId={user?.id}
            venueId={user?.venue_id ?? undefined}
          />
        )}
        {role === "pr_dashboard" && (
          <PrDashboardTab
            venueId={user?.venue_id ?? undefined}
            preferredEventId={eventId || null}
            showToast={showToast}
          />
        )}
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
    flexGrow: 1,
    padding: 20,
    paddingBottom: 28,
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

  eventStatusCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  eventStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },

  eventStatusTitle: {
    fontSize: 13,
    fontWeight: "700",
    opacity: 0.8,
  },

  eventStatusMain: {
    fontSize: 16,
    fontWeight: "800",
  },

  eventStatusHint: {
    fontSize: 12,
    marginTop: 6,
    opacity: 0.7,
  },

  eventStatusError: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "600",
  },

  roleGrid: {
    width: '100%',
    marginTop: 8,
  },

  roleHintText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.75,
    textAlign: "center",
    lineHeight: 18,
  },

  selectionFooter: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    alignItems: "center",
  },

  roleTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  roleTopBarAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 72,
  },

  roleTopBarActionText: {
    fontSize: 13,
    fontWeight: "700",
  },

  roleTopBarLogout: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "800",
  },

  roleTopBarCenter: {
    alignItems: "center",
  },

  roleTopBarTitle: {
    fontSize: 16,
    fontWeight: "900",
  },

  roleTopBarSubtitle: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 2,
  },

  eventLiveCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },

  eventLiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  eventLiveTitle: {
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.75,
  },

  eventLiveName: {
    fontSize: 15,
    fontWeight: "800",
  },

  eventLiveError: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },

  roleContent: {
    flex: 1,
    paddingBottom: 14,
  },

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

  logoutButtonFloating: {
    width: "100%",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#DC2626",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#7f1d1d",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  logoutButtonDisabled: {
    opacity: 0.7,
  },

  logoutButtonFloatingText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});