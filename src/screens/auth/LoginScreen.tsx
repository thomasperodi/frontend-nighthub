import { View, Text, TextInput, StyleSheet } from "react-native";
import { useState } from "react";
import GradientBackground from "../../components/GradientBackground";
import PrimaryButton from "../../components/PrimaryButton";

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <GradientBackground>
      <View style={styles.container}>
        <Text style={styles.title}>Bentornato</Text>
        <Text style={styles.subtitle}>
          Accedi e gestisci la tua serata
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#C9B8FF"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#C9B8FF"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        <PrimaryButton
          title="Accedi"
          onPress={() => navigation.navigate("SelectRole")}
        />
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 32,
  },
  title: {
    color: "white",
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#E0D7FF",
    fontSize: 15,
    marginBottom: 32,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "white",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
});
