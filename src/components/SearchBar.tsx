import React, { useState, useEffect } from "react";
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";

export default function SearchBar({ value, onChange, onOpenFilters }: any) {
  const { theme } = useTheme();
  const [local, setLocal] = useState(value || "");

  useEffect(() => {
    setLocal(value || "");
  }, [value]);

  useEffect(() => {
    const id = setTimeout(() => onChange && onChange(local), 300);
    return () => clearTimeout(id);
  }, [local]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Feather name="search" size={17} color={theme.colors.muted} />
      <TextInput
        placeholder="Cerca eventi, locali, tag..."
        placeholderTextColor={theme.colors.muted + "BB"}
        style={[styles.input, { color: theme.colors.text }]}
        value={local}
        onChangeText={setLocal}
        returnKeyType="search"
      />
      {local.length > 0 && (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => setLocal("")}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={14} color={theme.colors.muted} />
        </TouchableOpacity>
      )}
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <TouchableOpacity style={styles.filterBtn} onPress={onOpenFilters} accessibilityRole="button" activeOpacity={0.7}>
        <Feather name="sliders" size={16} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  clearBtn: {
    padding: 2,
  },
  divider: {
    width: 1,
    height: 18,
  },
  filterBtn: {
    paddingLeft: 4,
    paddingRight: 2,
  },
});