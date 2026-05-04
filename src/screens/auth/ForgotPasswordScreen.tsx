import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import GradientBackground from "../../components/GradientBackground";
import PrimaryButton from "../../components/PrimaryButton";
import { useTheme } from "../../theme/ThemeProvider";
import { requestPasswordReset, resetPassword } from "../../services/auth";
import {
  completeSupabasePasswordReset,
  extractSupabaseRecoveryTokensFromUrl,
  isSupabaseForgotPasswordEnabled,
  requestSupabasePasswordReset,
} from "../../services/supabaseAuth";

type RecoveryTokens = {
  accessToken: string;
  refreshToken: string;
};

export default function ForgotPasswordScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const useSupabaseFlow = isSupabaseForgotPasswordEnabled();

  const [identifier, setIdentifier] = useState<string>(route?.params?.prefill ?? "");
  const [token, setToken] = useState<string>(route?.params?.token ?? "");
  const [recoveryTokens, setRecoveryTokens] = useState<RecoveryTokens | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secureNew, setSecureNew] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const normalizedIdentifier = identifier.trim();
  const canRequest = useMemo(() => {
    if (useSupabaseFlow) {
      return /^\S+@\S+\.\S+$/.test(normalizedIdentifier);
    }

    if (!normalizedIdentifier) return false;
    if (normalizedIdentifier.includes("@")) {
      return /^\S+@\S+\.\S+$/.test(normalizedIdentifier);
    }
    return normalizedIdentifier.length >= 3;
  }, [normalizedIdentifier, useSupabaseFlow]);

  const canReset =
    (useSupabaseFlow
      ? !!recoveryTokens?.accessToken && !!recoveryTokens?.refreshToken
      : token.trim().length > 0) &&
    newPassword.length >= 6 &&
    confirmPassword.length >= 6;

  useEffect(() => {
    const fromRouteAccess = String(route?.params?.access_token || "").trim();
    const fromRouteRefresh = String(route?.params?.refresh_token || "").trim();
    const fromRouteType = String(route?.params?.type || "").trim().toLowerCase();

    if (fromRouteAccess && fromRouteRefresh && fromRouteType === "recovery") {
      setRecoveryTokens({ accessToken: fromRouteAccess, refreshToken: fromRouteRefresh });
      setInfo("Link di reset rilevato. Ora puoi impostare la nuova password.");
    }

    const hydrateFromUrl = (url?: string | null) => {
      const parsed = extractSupabaseRecoveryTokensFromUrl(url);
      if (!parsed) return;
      setRecoveryTokens(parsed);
      setInfo("Link di reset rilevato. Ora puoi impostare la nuova password.");
    };

    void (async () => {
      const initialUrl = await Linking.getInitialURL();
      hydrateFromUrl(initialUrl);
    })();

    const subscription = Linking.addEventListener("url", ({ url }: { url: string }) => {
      hydrateFromUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, [route?.params?.access_token, route?.params?.refresh_token, route?.params?.type]);

  const validateRequest = () => {
    if (useSupabaseFlow) {
      if (!/^\S+@\S+\.\S+$/.test(normalizedIdentifier)) {
        return "Con Supabase inserisci un'email valida";
      }
      return null;
    }

    if (!normalizedIdentifier) return "Inserisci email o username";
    if (normalizedIdentifier.includes("@") && !/^\S+@\S+\.\S+$/.test(normalizedIdentifier)) {
      return "Inserisci un'email valida";
    }
    if (!normalizedIdentifier.includes("@") && normalizedIdentifier.length < 3) {
      return "Username minimo 3 caratteri";
    }
    return null;
  };

  const validateReset = () => {
    if (useSupabaseFlow) {
      if (!recoveryTokens?.accessToken || !recoveryTokens?.refreshToken) {
        return "Apri il link ricevuto via email per continuare";
      }
    } else if (!token.trim()) {
      return "Inserisci il codice/token di reset";
    }

    if (newPassword.length < 6) return "La nuova password deve contenere almeno 6 caratteri";
    if (newPassword !== confirmPassword) return "Le password non coincidono";
    return null;
  };

  const handleRequestReset = async () => {
    const validationError = validateRequest();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setInfo(null);
    setIsRequesting(true);

    try {
      if (useSupabaseFlow) {
        await requestSupabasePasswordReset(normalizedIdentifier);
        setInfo("Se l'email esiste su Supabase, riceverai un link di reset password.");
      } else {
        const res = await requestPasswordReset(normalizedIdentifier);
        const message =
          res?.message ||
          "Se l'account esiste, riceverai istruzioni per il reset della password.";

        setInfo(message);

        if (res?.reset_token) {
          setToken(String(res.reset_token));
        }
      }
    } catch (e: any) {
      if (e && e.isAxiosError && !e.response) {
        setError("Impossibile contattare il server. Riprova tra poco.");
      } else {
        setError(e?.response?.data?.message || e?.message || "Errore durante la richiesta reset password.");
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleResetPassword = async () => {
    const validationError = validateReset();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsResetting(true);

    try {
      if (useSupabaseFlow) {
        await completeSupabasePasswordReset({
          accessToken: String(recoveryTokens?.accessToken || ""),
          refreshToken: String(recoveryTokens?.refreshToken || ""),
          newPassword,
        });
      } else {
        await resetPassword(token.trim(), newPassword);
      }

      Alert.alert("Password aggiornata", "Ora puoi accedere con la nuova password.", [
        {
          text: "Vai al login",
          onPress: () => navigation.navigate("Login"),
        },
      ]);
    } catch (e: any) {
      if (e && e.isAxiosError && !e.response) {
        setError("Impossibile contattare il server. Riprova tra poco.");
      } else {
        setError(e?.response?.data?.message || e?.message || "Reset password non riuscito.");
      }
    } finally {
      setIsResetting(false);
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
              { paddingBottom: (insets.bottom || 0) + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Torna al login"
            >
              <Feather name="chevron-left" size={18} color={theme.colors.text} />
              <Text style={[styles.backText, { color: theme.colors.text }]}>Torna al login</Text>
            </TouchableOpacity>

            <View style={styles.heroArea}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Password dimenticata</Text>
              <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Recupera l'accesso in due passaggi</Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}
              {info ? <Text style={[styles.info, { color: theme.colors.muted }]}>{info}</Text> : null}

              <View style={styles.labelRow}>
                <Feather name="user" size={14} color={theme.colors.muted} />
                <Text style={[styles.label, { color: theme.colors.muted }]}>
                  {useSupabaseFlow ? "Email" : "Email o username"}
                </Text>
              </View>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={useSupabaseFlow ? "nome@esempio.com" : "nome@esempio.com o username"}
                placeholderTextColor={theme.colors.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.card,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  },
                ]}
                keyboardType={useSupabaseFlow ? "email-address" : "default"}
                accessibilityLabel={useSupabaseFlow ? "Email" : "Email o username"}
              />

              <PrimaryButton
                title={isRequesting ? "Invio in corso..." : "Invia istruzioni di reset"}
                onPress={handleRequestReset}
                disabled={!canRequest || isRequesting}
                isLoading={isRequesting}
              />

              <View style={styles.separator} />

              {useSupabaseFlow ? (
                <Text style={[styles.info, { color: theme.colors.muted }]}>Apri il link ricevuto via email su questo dispositivo. Quando il link viene rilevato, puoi impostare la nuova password.</Text>
              ) : (
                <>
                  <View style={styles.labelRow}>
                    <Feather name="key" size={14} color={theme.colors.muted} />
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Codice o token di reset</Text>
                  </View>
                  <TextInput
                    value={token}
                    onChangeText={setToken}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Incolla qui il codice/token"
                    placeholderTextColor={theme.colors.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.colors.card,
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    accessibilityLabel="Token reset"
                  />
                </>
              )}

              <View style={styles.labelRow}>
                <Feather name="lock" size={14} color={theme.colors.muted} />
                <Text style={[styles.label, { color: theme.colors.muted }]}>Nuova password</Text>
              </View>
              <View style={styles.passwordWrapper}>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={secureNew}
                  placeholder="Nuova password"
                  placeholderTextColor={theme.colors.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.card,
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  accessibilityLabel="Nuova password"
                />
                <TouchableOpacity
                  style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                  onPress={() => setSecureNew((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={secureNew ? "Mostra nuova password" : "Nascondi nuova password"}
                >
                  <Feather name={secureNew ? "eye-off" : "eye"} size={16} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>

              <View style={styles.labelRow}>
                <Feather name="lock" size={14} color={theme.colors.muted} />
                <Text style={[styles.label, { color: theme.colors.muted }]}>Conferma password</Text>
              </View>
              <View style={styles.passwordWrapper}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={secureConfirm}
                  placeholder="Conferma nuova password"
                  placeholderTextColor={theme.colors.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.card,
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  accessibilityLabel="Conferma nuova password"
                />
                <TouchableOpacity
                  style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                  onPress={() => setSecureConfirm((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={secureConfirm ? "Mostra conferma password" : "Nascondi conferma password"}
                >
                  <Feather name={secureConfirm ? "eye-off" : "eye"} size={16} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>

              <PrimaryButton
                title={isResetting ? "Aggiornamento..." : "Aggiorna password"}
                onPress={handleResetPassword}
                disabled={!canReset || isResetting}
                isLoading={isResetting}
              />
            </View>
          </ScrollView>
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
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 14,
    fontWeight: "700",
  },
  heroArea: {
    marginBottom: 14,
    gap: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 14,
    fontSize: 15,
  },
  separator: {
    height: 1,
    marginVertical: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  passwordWrapper: {
    position: "relative",
  },
  iconBtn: {
    position: "absolute",
    right: 10,
    top: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
  info: {
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
});
