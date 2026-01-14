import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export default function GradientBackground({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const colors = theme.colors.gradient || ["#FFFFFF", "#F3F4F8"];

  return (
    <LinearGradient
      colors={colors as unknown as readonly [string, string, ...string[]]}
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
