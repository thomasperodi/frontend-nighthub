import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";

import GradientBackground from "../../components/GradientBackground";
import PrimaryButton from "../../components/PrimaryButton";


export default function LoginScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const validate = () => {
    setError(null);
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) return "Inserisci un'email valida";
    if (password.length < 6) return "La password deve contenere almeno 6 caratteri";
    return null;
  };

  const { signIn } = useAuth();

  const handleLogin = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await signIn(email, password);
      // Navigation will switch via AuthProvider / RootNavigation
    } catch (e: any) {
      console.error(e);
      // Axios network error doesn't have response
      if (e && e.isAxiosError && !e.response) {
        setError("Impossibile connettersi al server. Verifica che il backend sia in esecuzione e che l'indirizzo API sia raggiungibile dal dispositivo.");
      } else if (e?.response?.data?.message) {
        setError(e.response.data.message);
      } else {
        setError(e?.message || "Errore durante il login. Riprova più tardi.");
      }
    } finally {
      setIsSubmitting(false);
    }
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
              { paddingBottom: (insets.bottom || 0) + (keyboardVisible ? 28 : 170) },
            ]}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            contentInsetAdjustmentBehavior="always"
            showsVerticalScrollIndicator={false}
          >
              <View style={styles.heroArea}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Bentornato 👋</Text>
                <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Accedi in pochi secondi e organizza la tua serata senza stress</Text>
              </View>

              <View style={[styles.valueCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.valueRow}>
                  <Feather name="check-circle" size={16} color={theme.colors.primary} />
                  <Text style={[styles.valueText, { color: theme.colors.text }]}>Prenoti ingressi e tavoli in un attimo</Text>
                </View>
                <View style={styles.valueRow}>
                  <Feather name="check-circle" size={16} color={theme.colors.primary} />
                  <Text style={[styles.valueText, { color: theme.colors.text }]}>Vedi promo e vantaggi reali subito</Text>
                </View>
                <TouchableOpacity
                  style={styles.reviewOnboardingButton}
                  onPress={() => navigation.navigate("Onboarding")}
                  accessibilityRole="button"
                  accessibilityLabel="Rivedi onboarding"
                >
                  <Feather name="play-circle" size={16} color={theme.colors.primary} />
                  <Text style={[styles.reviewOnboardingText, { color: theme.colors.primary }]}>Rivedi come funziona</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.form, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
                {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}

                <Text style={[styles.label, { color: theme.colors.muted }]}>Email</Text>
                <TextInput
                  placeholder="nome@esempio.com"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessible
                  accessibilityLabel="Email"
                />

                <Text style={[styles.label, { marginTop: 8, color: theme.colors.muted }]}>Password</Text>

                <View style={styles.passwordWrapper}>
                  <TouchableOpacity
                    onPress={() => setSecure((s) => !s)}
                    style={[styles.iconAbove, { backgroundColor: theme.colors.card }]}
                    accessibilityRole="button"
                    accessibilityLabel={secure ? "Mostra password" : "Nascondi password"}
                  >
                    <Feather name={secure ? "eye-off" : "eye"} size={18} color={theme.colors.muted} />
                  </TouchableOpacity>

                  <TextInput
                    ref={passwordRef}
                    placeholder="Inserisci la tua password"
                    placeholderTextColor={theme.colors.muted}
                    secureTextEntry={secure}
                    value={password}
                    onChangeText={setPassword}
                    style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    accessible
                    accessibilityLabel="Password"
                  />
                </View>
              </View>

          </ScrollView>

          {!keyboardVisible && (
            <View style={[styles.bottomActionArea, { paddingBottom: Math.max(insets.bottom, 12), borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
              <PrimaryButton
                title={isSubmitting ? "Accedendo..." : "Accedi"}
                onPress={handleLogin}
                disabled={isSubmitting}
                isLoading={isSubmitting}
              />

              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: theme.colors.muted }]}>Non hai un account?</Text>
                <TouchableOpacity onPress={() => navigation.navigate("Register")}> 
                  <Text style={[styles.signup, { color: theme.colors.primary }]}> Crea account cliente</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    padding: 28,
    paddingBottom: 40,
  },
  heroArea: {
    marginTop: 20,
    marginBottom: 12,
  },
  valueCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  form: {
    padding: 18,
    borderRadius: 14,
    marginTop: 4,
    borderWidth: 1,
  },
  bottomActionArea: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 10,
  },
  reviewOnboardingButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingVertical: 2,
  },
  reviewOnboardingText: {
    fontSize: 14,
    fontWeight: "700",
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  passwordWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  iconAbove: {
    position: "absolute",
    right: 12,
    top: 6,
    padding: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
    alignItems: "center",
    flexWrap: "wrap",
  },
  footerText: {
    fontSize: 13,
  },
  signup: {
    fontWeight: "700",
    fontSize: 13,
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
});
