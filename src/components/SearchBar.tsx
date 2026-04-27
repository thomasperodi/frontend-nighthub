import React, { useState, useEffect } from "react";
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";

type SearchBarProps = {
  value: string;
  onChange: (nextValue: string) => void;
  onOpenFilters?: () => void;
  placeholder?: string;
  activeFilterCount?: number;
};

export default function SearchBar({
  value,
  onChange,
  onOpenFilters,
  placeholder = "Cerca eventi, locali, tag...",
  activeFilterCount = 0,
}: SearchBarProps) {
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
        accessibilityLabel="Ricerca eventi e locali"
        accessibilityHint="Inserisci almeno tre caratteri per affinare i risultati"
        placeholder={placeholder}
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
          accessibilityLabel="Cancella ricerca"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={14} color={theme.colors.muted} />
        </TouchableOpacity>
      )}
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <TouchableOpacity
        style={styles.filterBtn}
        onPress={onOpenFilters}
        accessibilityRole="button"
        accessibilityLabel="Apri filtri"
        accessibilityHint={activeFilterCount > 0 ? `${activeFilterCount} filtri attivi` : "Nessun filtro attivo"}
        activeOpacity={0.7}
      >
        <Feather name="sliders" size={16} color={theme.colors.primary} />
        {activeFilterCount > 0 ? (
          <View style={[styles.filterBadge, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.filterBadgeText}>{activeFilterCount > 99 ? "99+" : String(activeFilterCount)}</Text>
          </View>
        ) : null}
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
    minWidth: 32,
    minHeight: 32,
    paddingLeft: 4,
    paddingRight: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
});