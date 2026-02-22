import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRef } from "react";
import { useTheme } from "../../../theme/ThemeProvider";

export default function RoleButton({ icon, label, description, onPress, disabled = false }: any) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity 
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={disabled ? 1 : 0.95}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${description}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
    >
      <Animated.View
        style={[
          styles.roleButton,
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        <View style={styles.roleLeft}>
          <View style={[styles.roleIconContainer, disabled && styles.roleIconContainerDisabled]}>
            <Feather name={icon} size={24} color="white" />
          </View>
          <View style={styles.roleText}>
            <Text style={[styles.roleLabel, { color: theme.colors.text }]}>{label}</Text>
            <Text style={[styles.roleDescription, { color: theme.colors.text }]}>{description}</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={theme.colors.text} style={{ opacity: 0.75 }} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  roleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },

  roleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#6D5BFF",
    justifyContent: "center",
    alignItems: "center",
  },

  roleIconContainerDisabled: {
    backgroundColor: "#8b8b8b",
  },

  roleText: {
    flex: 1,
  },

  roleLabel: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },

  roleDescription: {
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.75,
  },
});
