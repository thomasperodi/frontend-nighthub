import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet } from "react-native";

export default function GradientBackground({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={["#47c74dff", "#4B1D9C"]}
      style={styles.container}
    >
      {children }
      
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
