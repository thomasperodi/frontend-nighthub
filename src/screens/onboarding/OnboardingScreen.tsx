import { View, Text, StyleSheet } from "react-native";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import GradientBackground from "../../components/GradientBackground";
import PrimaryButton from "../../components/PrimaryButton";

export default function OnboardingScreen({ navigation }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <GradientBackground>
      <View style={styles.container}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text style={styles.title}>Controlla la notte</Text>
          <Text style={styles.subtitle}>
            Organizza ingressi, promo e tavoli.  
            Prima, durante e dopo la serata.
          </Text>

          <PrimaryButton
            title="Inizia"
            onPress={() => navigation.navigate("Login")}
          />
        </Animated.View>
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
    fontSize: 34,
    fontWeight: "700",
    marginBottom: 16,
  },
  subtitle: {
    color: "#E0D7FF",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 40,
  },
});
