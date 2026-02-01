import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRef } from "react";

export default function RoleButton({ icon, label, description, onPress }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity 
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.95}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${description}`}
    >
      <Animated.View style={[styles.roleButton, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.roleLeft}>
          <View style={styles.roleIconContainer}>
            <Feather name={icon} size={24} color="white" />
          </View>
          <View style={styles.roleText}>
            <Text style={styles.roleLabel}>{label}</Text>
            <Text style={styles.roleDescription}>{description}</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color="white" />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  roleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
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

  roleText: {
    flex: 1,
  },

  roleLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },

  roleDescription: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "500",
  },
});
