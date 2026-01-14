import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert, Modal, TextInput, Platform, Keyboard, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useState, useRef, useEffect, useCallback } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";

type StaffRole =
  | "ingresso"
  | "guardaroba"
  | "immagine"
  | "cameriere"
  | "bar"
  | null;

export default function StaffHomeScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [role, setRole] = useState<StaffRole>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [promptConfig, setPromptConfig] = useState<any>({ visible: false, title: '', placeholder: '', keyboardType: 'default', onSubmit: (v: string) => {} });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2200);
  }, []);

  const openPrompt = useCallback((config: any) => {
    setPromptConfig({ visible: true, ...config });
  }, []);


  /* ======================
     SCELTA RUOLO
  ====================== */

  if (!role) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
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
      </SafeAreaView>
    );
  }

  /* ======================
     DASHBOARD PER RUOLO
  ====================== */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {role === "ingresso" && <IngressoScreen showToast={showToast} openPrompt={openPrompt} />}
      {role === "guardaroba" && <GuardarobaScreen showToast={showToast} />}
      {role === "immagine" && <ImmagineScreen openPrompt={openPrompt} showToast={showToast} />}
      {role === "cameriere" && <CameriereScreen openPrompt={openPrompt} showToast={showToast} />}
      {role === "bar" && <BarScreen openPrompt={openPrompt} showToast={showToast} />}

      {/* Cambia ruolo */}
      <TouchableOpacity 
        style={styles.changeRole} 
        onPress={() => {
          Alert.alert(
            "Cambia ruolo",
            "Vuoi tornare alla selezione del ruolo?",
            [
              { text: "Annulla", style: "cancel" },
              { text: "Conferma", onPress: () => setRole(null) }
            ]
          );
        }}
        accessibilityRole="button"
        accessibilityLabel="Cambia ruolo"
      >
        <Feather name="refresh-ccw" size={18} color="white" />
        <Text style={styles.changeRoleText}>Cambia ruolo</Text>
      </TouchableOpacity>

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
   COMPONENTI
====================== */

function RoleButton({ icon, label, description, onPress }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity 
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.95}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${description}`}
    >
      <Animated.View style={[styles.roleButton, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.roleLeft}>
          <View style={styles.roleIconContainer}>
            <Feather name={icon} size={24} color="white" />
          </View>
          <View style={styles.roleText}>
            <Text style={styles.roleLabel}>{label}</Text>
            <Text style={styles.roleDescription}>{description}</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color="white" />
      </Animated.View>
    </TouchableOpacity>
  );
}

function PromptModal({ visible, title, placeholder, keyboardType = 'default', onCancel, onSubmit }: any) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            keyboardType={keyboardType}
            style={styles.modalInput}
            placeholderTextColor="rgba(0,0,0,0.45)"
            autoFocus
          />

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={() => { setValue(''); onCancel(); }} style={[styles.modalBtn, styles.modalCancel]}>
              <Text style={styles.modalBtnText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onSubmit(value)} style={[styles.modalBtn, styles.modalConfirm]}>
              <Text style={styles.modalConfirmText}>Conferma</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function Toast({ message, visible }: any) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let t: any;
    if (visible && message) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      t = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(), 2000);
    }
    return () => clearTimeout(t);
  }, [visible, message]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]}> 
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

/* ======================
   SCHERMATE RUOLO
====================== */

function IngressoScreen({ showToast, openPrompt }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState({ uomini: 0, donne: 0, omaggi: 0 });
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

  const addEntry = (type: 'uomini' | 'donne' | 'omaggi') => {
    setStats(prev => ({ ...prev, [type]: prev[type] + 1 }));
    showToast(type === 'omaggi' ? 'Omaggio aggiunto' : 'Ingresso registrato');
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
            showToast('QR scansionato');
            Alert.alert("QR Scansionato", `Codice: ${data}`, [
              { text: "OK" }
            ]);
            // 👉 VALIDAZIONE INGRESSO
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
    <ScrollView contentContainerStyle={styles.roleContainer}>
      <View style={styles.roleHeader}>
        <View>
          <Text style={styles.roleTitle}>Ingresso</Text>
          <Text style={styles.roleSubtitle}>Gestione accessi</Text>
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

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      })
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={[styles.quickAdd, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.quickAddIcon, { backgroundColor: color }]}>
          <Feather name={icon} size={24} color="white" />
        </View>
        <Text style={styles.quickAddPlus}>+1</Text>
        <Text style={styles.quickAddLabel}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function GuardarobaScreen({ showToast }: any) {
  const [count, setCount] = useState(0);

  const handleAdd = () => {
    setCount(prev => prev + 1);
    showToast('Capo registrato');
  };

  return (
    <View style={styles.roleContainer}>
      <View style={styles.roleHeader}>
        <View>
          <Text style={styles.roleTitle}>Guardaroba</Text>
          <Text style={styles.roleSubtitle}>Gestione capi</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{count}</Text>
          <Text style={styles.totalBadgeLabel}>capi</Text>
        </View>
      </View>

      <View style={styles.center}>
        <TouchableOpacity
          style={styles.giantButton}
          onPress={handleAdd}
          activeOpacity={0.8}
        >
          <Feather name="plus-circle" size={80} color="white" />
          <Text style={styles.giantPlus}>Aggiungi capo</Text>
          <Text style={styles.giantSub}>Tocca per registrare</Text>
        </TouchableOpacity>

        {/* Lista ultimi capi */}
        {count > 0 && (
          <View style={styles.recentList}>
            <Text style={styles.recentTitle}>Ultimi registrati</Text>
            <View style={styles.recentItem}>
              <Feather name="check-circle" size={20} color="#22c55e" />
              <Text style={styles.recentText}>Capo #{count}</Text>
              <Text style={styles.recentTime}>Ora</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function ImmagineScreen({ openPrompt, showToast }: any) {
  const [tavoli, setTavoli] = useState([
    { id: 1, nome: "Rossi", prenotati: 6, entrati: 4, numero: null, stato: "attesa" },
    { id: 2, nome: "Bianchi", prenotati: 8, entrati: 8, numero: 12, stato: "completo" },
    { id: 3, nome: "Verdi", prenotati: 4, entrati: 2, numero: 5, stato: "parziale" },
  ]);

  const confermaIngresso = (id: number) => {
    setTavoli(prev => prev.map(t => 
      t.id === id ? { ...t, entrati: Math.min(t.entrati + 1, t.prenotati) } : t
    ));
  };

  const assegnaTavolo = (id: number) => {
    openPrompt({
      title: 'Assegna tavolo',
      placeholder: 'Numero del tavolo',
      keyboardType: 'number-pad',
      onSubmit: (numero: string) => {
        if (numero) {
          setTavoli(prev => prev.map(t => t.id === id ? { ...t, numero: parseInt(numero) } : t));
          showToast('Tavolo assegnato');
        }
      }
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.roleContainer}>
      <View style={styles.roleHeader}>
        <View>
          <Text style={styles.roleTitle}>Tavoli & PR</Text>
          <Text style={styles.roleSubtitle}>Gestione prenotazioni</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{tavoli.length}</Text>
          <Text style={styles.totalBadgeLabel}>tavoli</Text>
        </View>
      </View>

      {tavoli.map(t => (
        <View key={t.id} style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <View>
              <Text style={styles.tableTitle}>{t.nome}</Text>
              <View style={styles.tableProgress}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(t.entrati / t.prenotati) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.tableInfo}>
                  {t.entrati}/{t.prenotati} persone
                </Text>
              </View>
            </View>
            
            {t.numero && (
              <View style={styles.tableNumberBadge}>
                <Text style={styles.tableNumber}>{t.numero}</Text>
              </View>
            )}
          </View>

          <View style={styles.tableActions}>
            <TouchableOpacity 
              style={[styles.tableButton, styles.confirmButton]}
              onPress={() => confermaIngresso(t.id)}
              disabled={t.entrati >= t.prenotati}
            >
              <Feather name="user-plus" size={18} color="white" />
              <Text style={styles.tableButtonText}>Conferma (+1)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tableButton, styles.assignButton]}
              onPress={() => assegnaTavolo(t.id)}
            >
              <Feather name="map-pin" size={18} color="white" />
              <Text style={styles.tableButtonText}>
                {t.numero ? `Tavolo ${t.numero}` : "Assegna"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function CameriereScreen({ openPrompt, showToast }: any) {
  const [tavoli, setTavoli] = useState([
    { id: 1, tavolo: 12, persone: 6, budget: 250, saldato: false },
    { id: 2, tavolo: 5, persone: 4, budget: 180, saldato: false },
  ]);

  const aggiungiBudget = (id: number) => {
    openPrompt({
      title: 'Aggiungi budget',
      placeholder: 'Inserisci l\'importo',
      keyboardType: 'decimal-pad',
      onSubmit: (importo: string) => {
        if (importo) {
          setTavoli(prev => prev.map(t => t.id === id ? { ...t, budget: t.budget + parseFloat(importo) } : t));
          showToast('Budget aggiornato');
        }
      }
    });
  };
  const saldaTavolo = (id: number) => {
    Alert.alert(
      "Conferma saldo",
      "Segnare il tavolo come saldato?",
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Conferma", 
          onPress: () => setTavoli(prev => prev.map(t => 
            t.id === id ? { ...t, saldato: true } : t
          ))
        }
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.roleContainer}>
      <View style={styles.roleHeader}>
        <View>
          <Text style={styles.roleTitle}>Servizio Tavoli</Text>
          <Text style={styles.roleSubtitle}>Gestione ordini</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{tavoli.filter(t => !t.saldato).length}</Text>
          <Text style={styles.totalBadgeLabel}>attivi</Text>
        </View>
      </View>

      {tavoli.map(t => (
        <View key={t.id} style={[styles.tableCard, t.saldato && styles.tableCardPaid]}>
          <View style={styles.tableHeader}>
            <View>
              <Text style={styles.tableTitle}>Tavolo {t.tavolo}</Text>
              <Text style={styles.tableInfo}>
                <Feather name="users" size={14} /> {t.persone} persone
              </Text>
            </View>
            
            <View style={styles.budgetBadge}>
              <Text style={styles.budgetAmount}>€{t.budget}</Text>
              {t.saldato && (
                <View style={styles.paidBadge}>
                  <Feather name="check" size={14} color="#22c55e" />
                  <Text style={styles.paidText}>Saldato</Text>
                </View>
              )}
            </View>
          </View>

          {!t.saldato && (
            <View style={styles.tableActions}>
              <TouchableOpacity 
                style={[styles.tableButton, styles.moneyButton]}
                onPress={() => aggiungiBudget(t.id)}
              >
                <Feather name="plus" size={18} color="white" />
                <Text style={styles.tableButtonText}>Aggiungi</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tableButton, styles.payButton]}
                onPress={() => saldaTavolo(t.id)}
              >
                <Feather name="check-circle" size={18} color="white" />
                <Text style={styles.tableButtonText}>Salda</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function BarScreen({ openPrompt, showToast }: any) {
  const [vendite, setVendite] = useState(0);
  const [totale, setTotale] = useState(0);
  const prices = [
    { value: 3, label: "Birra" },
    { value: 5, label: "Cocktail" },
    { value: 10, label: "Premium" },
    { value: 20, label: "Bottiglia" },
  ];

  const registraVendita = (prezzo: number) => {
    setVendite(prev => prev + 1);
    setTotale(prev => prev + prezzo);
    showToast(`Vendita: €${prezzo}`);
  };

  return (
    <View style={styles.roleContainer}>
      <View style={styles.roleHeader}>
        <View>
          <Text style={styles.roleTitle}>Bar</Text>
          <Text style={styles.roleSubtitle}>Vendite rapide</Text>
        </View>
      </View>

      {/* Stats vendite */}
      <View style={styles.barStats}>
        <View style={styles.barStatItem}>
          <Text style={styles.barStatValue}>{vendite}</Text>
          <Text style={styles.barStatLabel}>Vendite</Text>
        </View>
        <View style={styles.barStatDivider} />
        <View style={styles.barStatItem}>
          <Text style={styles.barStatValue}>€{totale}</Text>
          <Text style={styles.barStatLabel}>Totale</Text>
        </View>
      </View>

      {/* Griglia prezzi */}
      <Text style={styles.sectionTitle}>Seleziona importo</Text>
      <View style={styles.priceGrid}>
        {prices.map(p => (
          <TouchableOpacity
            key={p.value}
            style={styles.priceButton}
            onPress={() => registraVendita(p.value)}
            activeOpacity={0.8}
          >
            <Feather name="shopping-bag" size={28} color="white" />
            <Text style={styles.priceValue}>€{p.value}</Text>
            <Text style={styles.priceLabel}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Importo personalizzato */}
      <TouchableOpacity 
        style={styles.customPriceButton}
        onPress={() => {
          openPrompt({
            title: 'Importo personalizzato',
            placeholder: 'Inserisci l\'importo',
            keyboardType: 'decimal-pad',
            onSubmit: (importo: string) => {
              if (importo) registraVendita(parseFloat(importo));
            }
          });
        }}
        accessibilityRole="button"
      >
        <Feather name="edit-3" size={20} color="#6D5BFF" />
        <Text style={styles.customPriceText}>Importo personalizzato</Text>
      </TouchableOpacity>
    </View>
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
    fontSize: 15,
  },

  roleContainer: { 
    flexGrow: 1, 
    padding: 20,
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
});