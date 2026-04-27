import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  isLoading = false,
  accessibilityHint,
  testID,
}: PrimaryButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.colors.primary },
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      <View style={styles.content}>
        {isLoading ? <ActivityIndicator color="#fff" style={{ marginRight: 10 }} /> : null}
        <Text style={styles.text}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
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
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
