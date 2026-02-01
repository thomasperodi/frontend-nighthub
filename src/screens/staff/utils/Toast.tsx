import { Animated, View, Text, StyleSheet } from "react-native";
import { useRef, useEffect } from "react";

export default function Toast({ message, visible }: any) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let t: any;
    if (visible && message) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      t = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(), 2000);
    }
    return () => clearTimeout(t);
  }, [visible, message]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]}> 
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "#333",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    zIndex: 999,
  },

  toastText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
