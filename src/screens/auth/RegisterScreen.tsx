import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../../components/GradientBackground";
import PrimaryButton from "../../components/PrimaryButton";
import { useTheme } from "../../theme/ThemeProvider";
import { register } from "../../services/auth";
import { useAuth } from "../../providers/AuthProvider";

type GenderValue = "M" | "F" | "ALTRO";

const GENDER_OPTIONS: { label: string; value: GenderValue }[] = [
  { label: "Uomo", value: "M" },
  { label: "Donna", value: "F" },
];

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const [year, month, day] = value.split("-").map(Number);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(value: string): string {
  if (!isValidIsoDate(value)) return value;
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export default function RegisterScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const isFirstLaunch = route?.params?.firstLaunch === true;
  const canShowLoginActions = !isFirstLaunch;

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date(2000, 0, 1));
  const [gender, setGender] = useState<GenderValue | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [secure, setSecure] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const canSubmit = useMemo(() => {
    return (
      name.trim().length >= 2 &&
      username.trim().length >= 3 &&
      /^\S+@\S+\.\S+$/.test(email.trim()) &&
      !!gender &&
      password.length >= 6 &&
      confirmPassword.length >= 6
    );
  }, [name, username, email, gender, password, confirmPassword]);

  const validate = (): string | null => {
    if (name.trim().length < 2) return "Inserisci nome e cognome";
    if (username.trim().length < 3) return "Username minimo 3 caratteri";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Inserisci un'email valida";
    if (!gender) return "Seleziona il sesso";
    if (birthDate.trim() && !isValidIsoDate(birthDate.trim())) return "Data di nascita non valida (formato YYYY-MM-DD)";
    if (phone.trim() && digitsOnly(phone).length < 6) return "Numero di telefono non valido";
    if (password.length < 6) return "La password deve contenere almeno 6 caratteri";
    if (password !== confirmPassword) return "Le password non coincidono";
    return null;
  };

  const handleRegister = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await register({
        email: email.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        password,
        role: "client",
        name: name.trim(),
        phone: phone.trim() ? `+39${digitsOnly(phone)}` : undefined,
        sesso: gender!,
        ...(birthDate.trim() ? { birth_date: birthDate.trim() } : {}),
      });

      await signIn(email.trim().toLowerCase(), password);
    } catch (e: any) {
      if (e && e.isAxiosError && !e.response) {
        setError("Impossibile connettersi al server. Verifica che il backend sia attivo e raggiungibile.");
      } else {
        setError(e?.response?.data?.message || e?.message || "Registrazione non riuscita. Riprova.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBirthDatePicker = () => {
    const initialDate = isValidIsoDate(birthDate)
      ? new Date(`${birthDate}T12:00:00`)
      : new Date(2000, 0, 1);
    setPickerDate(initialDate);
    setShowBirthDatePicker(true);
  };

  const confirmBirthDate = () => {
    setBirthDate(formatDateYYYYMMDD(pickerDate));
    setShowBirthDatePicker(false);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: (insets.bottom || 0) + (keyboardVisible ? 28 : 185) },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentInsetAdjustmentBehavior="always"
            showsVerticalScrollIndicator={false}
          >
              {canShowLoginActions ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel="Torna al login"
                >
                  <View style={[styles.backIconWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Feather name="chevron-left" size={18} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.backText, { color: theme.colors.text }]}>Login</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.heroBlock}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Crea account cliente</Text>
                <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Pochi campi e sei dentro</Text>
              </View>

              <View style={[styles.form, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
                <View style={styles.formHeader}>
                  <Text style={[styles.formTitle, { color: theme.colors.text }]}>I tuoi dati</Text>
                </View>

                {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}

                <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}14` }]}>
                      <Feather name="user" size={16} color={theme.colors.primary} />
                    </View>
                    <View style={styles.sectionHeaderTextBlock}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Informazioni principali</Text>
                    </View>
                  </View>

                  <View style={styles.labelRow}>
                    <Feather name="type" size={14} color={theme.colors.muted} />
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Nome e cognome</Text>
                  </View>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Mario Rossi"
                    placeholderTextColor={theme.colors.muted}
                    autoComplete="name"
                    textContentType="name"
                    style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => usernameRef.current?.focus()}
                    accessibilityLabel="Nome e cognome"
                  />

                  <View style={styles.labelRow}>
                    <Feather name="at-sign" size={14} color={theme.colors.muted} />
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Username</Text>
                  </View>
                  <TextInput
                    ref={usernameRef}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    placeholder="mariorossi"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => emailRef.current?.focus()}
                    accessibilityLabel="Username"
                  />

                  <View style={styles.labelRow}>
                    <Feather name="mail" size={14} color={theme.colors.muted} />
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Email</Text>
                  </View>
                  <TextInput
                    ref={emailRef}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    placeholder="nome@esempio.com"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => phoneRef.current?.focus()}
                    accessibilityLabel="Email"
                  />

                  <View style={styles.labelRow}>
                    <Feather name="users" size={14} color={theme.colors.muted} />
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Sesso</Text>
                  </View>
                  <View style={styles.genderRow}>
                    {GENDER_OPTIONS.map((option) => {
                      const selected = gender === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.genderChip,
                            {
                              borderColor: selected ? theme.colors.primary : theme.colors.border,
                              backgroundColor: selected ? `${theme.colors.primary}22` : theme.colors.surface,
                            },
                          ]}
                          onPress={() => setGender(option.value)}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Seleziona ${option.label}`}
                        >
                          <Text style={{ color: selected ? theme.colors.primary : theme.colors.text, fontWeight: "700" }}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}14` }]}>
                      <Feather name="calendar" size={16} color={theme.colors.primary} />
                    </View>
                    <View style={styles.sectionHeaderTextBlock}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Dettagli opzionali</Text>
                    </View>
                  </View>

                  <View style={styles.labelRow}>
                    <Feather name="phone" size={14} color={theme.colors.muted} />
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Telefono (opzionale)</Text>
                  </View>
                  <View style={styles.phoneRow}>
                    <View
                      style={[
                        styles.phonePrefix,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.phonePrefixText, { color: theme.colors.text }]}>+39</Text>
                    </View>
                    <TextInput
                      ref={phoneRef}
                      value={phone}
                      onChangeText={(text) => setPhone(digitsOnly(text))}
                      keyboardType="number-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      placeholder="3331234567"
                      placeholderTextColor={theme.colors.muted}
                      style={[
                        styles.phoneInput,
                        {
                          backgroundColor: theme.colors.surface,
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      accessibilityLabel="Telefono"
                    />
                  </View>

                  <View style={styles.labelRow}>
                    <Feather name="gift" size={14} color={theme.colors.muted} />
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Data di nascita (opzionale)</Text>
                  </View>
                  <TouchableOpacity
                    onPress={openBirthDatePicker}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Seleziona data di nascita"
                    style={[
                      styles.datePickerButton,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    ]}
                  >
                    <View>
                      <Text
                        style={{
                          color: birthDate ? theme.colors.text : theme.colors.muted,
                          fontSize: 15,
                          fontWeight: birthDate ? "700" : "500",
                        }}
                      >
                        {birthDate ? formatDateForDisplay(birthDate) : "Seleziona data"}
                      </Text>
                    </View>
                    <View style={[styles.datePickerIconWrap, { backgroundColor: `${theme.colors.primary}14` }]}>
                      <Feather name="calendar" size={18} color={theme.colors.primary} />
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}14` }]}>
                      <Feather name="lock" size={16} color={theme.colors.primary} />
                    </View>
                    <View style={styles.sectionHeaderTextBlock}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Sicurezza account</Text>
                    </View>
                  </View>

                  <View style={styles.labelRow}>
                    <Feather name="key" size={14} color={theme.colors.muted} />
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Password</Text>
                  </View>
                  <View style={styles.passwordWrapper}>
                    <TouchableOpacity
                      onPress={() => setSecure((s) => !s)}
                      style={[styles.eyeButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                      accessibilityRole="button"
                      accessibilityLabel={secure ? "Mostra password" : "Nascondi password"}
                    >
                      <Feather name={secure ? "eye-off" : "eye"} size={18} color={theme.colors.muted} />
                    </TouchableOpacity>
                    <TextInput
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={secure}
                      autoComplete="password-new"
                      textContentType="newPassword"
                      placeholder="Almeno 6 caratteri"
                      placeholderTextColor={theme.colors.muted}
                      style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                      accessibilityLabel="Password"
                    />
                  </View>

                  <View style={styles.labelRow}>
                    <Feather name="shield" size={14} color={theme.colors.muted} />
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Conferma password</Text>
                  </View>
                  <View style={styles.passwordWrapper}>
                    <TouchableOpacity
                      onPress={() => setSecureConfirm((s) => !s)}
                      style={[styles.eyeButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                      accessibilityRole="button"
                      accessibilityLabel={secureConfirm ? "Mostra conferma password" : "Nascondi conferma password"}
                    >
                      <Feather name={secureConfirm ? "eye-off" : "eye"} size={18} color={theme.colors.muted} />
                    </TouchableOpacity>
                    <TextInput
                      ref={confirmPasswordRef}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={secureConfirm}
                      autoComplete="password-new"
                      textContentType="newPassword"
                      placeholder="Ripeti la password"
                      placeholderTextColor={theme.colors.muted}
                      style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                      returnKeyType="done"
                      onSubmitEditing={handleRegister}
                      accessibilityLabel="Conferma password"
                    />
                  </View>
                </View>
              </View>

          </ScrollView>

          {!keyboardVisible && (
            <View style={[styles.bottomActionArea, { paddingBottom: Math.max(insets.bottom, 12), borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
              <PrimaryButton
                title={isSubmitting ? "Creazione account..." : "Crea account"}
                onPress={handleRegister}
                disabled={!canSubmit || isSubmitting}
                isLoading={isSubmitting}
                accessibilityHint="Crea il tuo account cliente"
              />

              {canShowLoginActions ? (
                <View style={styles.footerRow}>
                  <Text style={[styles.footerText, { color: theme.colors.muted }]}>Hai già un account?</Text>
                  <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={[styles.footerAction, { color: theme.colors.primary }]}> Accedi</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

            <Modal
              visible={showBirthDatePicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowBirthDatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <TouchableOpacity
                  style={styles.modalBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowBirthDatePicker(false)}
                />

                <View
                  style={[
                    styles.pickerSheet,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      paddingBottom: Math.max(insets.bottom, 12),
                    },
                  ]}
                >
                  <View style={styles.pickerHeader}>
                    <TouchableOpacity
                      style={[styles.sheetButton, { borderColor: theme.colors.border }]}
                      onPress={() => setShowBirthDatePicker(false)}
                    >
                      <Text style={[styles.sheetButtonText, { color: theme.colors.muted }]}>Annulla</Text>
                    </TouchableOpacity>
                    <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Data di nascita</Text>
                    <TouchableOpacity
                      style={[styles.sheetButton, { borderColor: theme.colors.border }]}
                      onPress={confirmBirthDate}
                    >
                      <Text style={[styles.sheetButtonText, { color: theme.colors.primary }]}>Conferma</Text>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    locale="it-IT"
                    themeVariant={theme.mode}
                    textColor={theme.colors.text as any}
                    accentColor={theme.colors.primary as any}
                    maximumDate={new Date()}
                    onChange={(_event: any, selectedDate?: Date) => {
                      if (selectedDate) {
                        setPickerDate(selectedDate);
                      }
                    }}
                  />
                </View>
              </View>
            </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 42,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 16,
    gap: 8,
  },
  backIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBlock: {
    gap: 6,
    marginBottom: 14,
  },
  backText: {
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  formHeader: {
    marginBottom: 2,
  },
  formTitle: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderTextBlock: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  bottomActionArea: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    marginTop: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    fontSize: 15,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  phonePrefix: {
    minWidth: 62,
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  phonePrefixText: {
    fontSize: 15,
    fontWeight: "700",
  },
  phoneInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  datePickerButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  datePickerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  pickerSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 14,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sheetButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 82,
    alignItems: "center",
  },
  sheetButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  genderRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  passwordWrapper: {
    position: "relative",
  },
  eyeButton: {
    position: "absolute",
    right: 10,
    top: 6,
    zIndex: 2,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  footerRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  footerText: {
    fontSize: 13,
  },
  footerAction: {
    fontSize: 13,
    fontWeight: "700",
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
});
