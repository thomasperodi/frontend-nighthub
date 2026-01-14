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
      <Feather name="search" size={18} color={theme.colors.muted} />
      <TextInput
        placeholder="Cerca eventi, locali, tag..."
        placeholderTextColor={theme.colors.muted}
        style={[styles.input, { color: theme.colors.text }]}
        value={local}
        onChangeText={setLocal}
        returnKeyType="search"
      />
      <TouchableOpacity style={styles.filterBtn} onPress={onOpenFilters} accessibilityRole="button">
        <Feather name="sliders" size={18} color={theme.colors.muted} />
        <Text style={[styles.filterText, { color: theme.colors.muted }]}>Filtri</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    marginLeft: 8,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
  },
  filterText: {
    marginLeft: 6,
    fontWeight: "600",
  },
});