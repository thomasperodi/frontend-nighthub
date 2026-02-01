import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";


import GoogleIcon from '../../../assets/svg/GoogleIcon.svg';

import GradientBackground from "../../components/GradientBackground";
import PrimaryButton from "../../components/PrimaryButton";


export default function LoginScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      // TODO: integrare Google Sign-In (expo-auth-session / react-native-google-signin)
      await new Promise((res) => setTimeout(res, 800));
      // navigation.navigate("ClientHome");
      // navigation.navigate("VenueHome");
      navigation.navigate("StaffHome");
    } catch (e) {
      setError("Impossibile accedere con Google.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate("ForgotPassword");
  };


  return (
    <GradientBackground>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Bentornato</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Accedi e gestisci la tua serata</Text>

          <View style={[styles.form, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
            {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}

            <Text style={[styles.label, { color: theme.colors.muted }]}>Email</Text>
            <TextInput
              placeholder="nome@esempio.com"
              placeholderTextColor={theme.colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
              returnKeyType="next"
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
                placeholder="Inserisci la tua password"
                placeholderTextColor={theme.colors.muted}
                secureTextEntry={secure}
                value={password}
                onChangeText={setPassword}
                style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
                returnKeyType="done"
                accessible
                accessibilityLabel="Password"
              />
            </View>

            {/* <TouchableOpacity onPress={handleForgotPassword} accessibilityRole="button">
              <Text style={[styles.forgotText, { color: theme.colors.muted }]}>Password dimenticata?</Text>
            </TouchableOpacity> */}

            <PrimaryButton
              title={isSubmitting ? "Accedendo..." : "Accedi"}
              onPress={handleLogin}
              disabled={isSubmitting}
              isLoading={isSubmitting}
            />

            {/* <Text style={[styles.or, { color: theme.colors.muted }]}>— oppure —</Text>

            <TouchableOpacity
              style={[styles.googleButton, isSubmitting && { opacity: 0.7 }, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={handleGoogleSignIn}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Accedi con Google"
            >
              {isSubmitting ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <View style={styles.googleContent}>
                  <Text style={[styles.googleText, { color: theme.colors.text }]}>Accedi con Google</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.colors.muted }]}>Non hai un account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Register")}> 
                <Text style={[styles.signup, { color: theme.colors.text }]}> Crea uno</Text>
              </TouchableOpacity>
            </View> */}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },
  form: {
    padding: 18,
    borderRadius: 14,
    marginTop: 12,
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
  forgotText: {
    alignSelf: "flex-end",
    marginBottom: 18,
    fontSize: 13,
  },
  or: {
    textAlign: "center",
    marginVertical: 14,
  },
  googleButton: {
    backgroundColor: "white",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },

  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },

  pingButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#6D5BFF',
    borderRadius: 8,
  },

  pingText: {
    color: 'white',
    fontWeight: '800',
  },

  debugText: {
    fontSize: 12,
  },
  googleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  googleText: {
    color: "#000",
    fontWeight: "700",
    marginLeft: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  footerText: {
    color: "#E0D7FF",
  },
  signup: {
    color: "white",
    fontWeight: "700",
  },
  error: {
    color: "#FF7A7A",
    marginBottom: 10,
  },
});
