import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export default function PrimaryButton({ title, onPress, disabled = false, isLoading = false }: any) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.button, { backgroundColor: theme.colors.primary }, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.content}>
        {isLoading ? <ActivityIndicator color="#fff" style={{ marginRight: 10 }} /> : null}
        <Text style={[styles.text, { color: theme.colors.text }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 0,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.7,
  },
});
