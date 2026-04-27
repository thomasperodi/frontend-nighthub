import React, { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import type { HomeFilters } from "../types/ui";

type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
  onApply: (nextFilters: HomeFilters) => void;
  initial: HomeFilters;
  categories: string[];
  promoTypes: string[];
  enablePromoFilters?: boolean;
};

const normalize = (value: string) => value.trim().toLowerCase();

export default function FilterModal({
  visible,
  onClose,
  onApply,
  initial,
  categories,
  promoTypes: promoTypeOptions,
  enablePromoFilters = true,
}: FilterModalProps) {
  const { theme, isDark } = useTheme();
  const [selected, setSelected] = useState<string[]>(initial?.categories || []);
  const [onlyMyPromos, setOnlyMyPromos] = useState<boolean>(initial?.onlyMyPromos || false);
  const [promoTypes, setPromoTypes] = useState<string[]>(initial?.promoTypes || []);

  const normalizedCategoryOptions = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter((item) => {
      const key = normalize(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories]);

  const normalizedPromoTypeOptions = useMemo(() => {
    const seen = new Set<string>();
    return promoTypeOptions.filter((item) => {
      const key = normalize(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [promoTypeOptions]);

  useEffect(() => {
    if (!visible) return;
    setSelected(initial?.categories || []);
    setOnlyMyPromos(initial?.onlyMyPromos || false);
    setPromoTypes(initial?.promoTypes || []);
  }, [initial?.categories, initial?.onlyMyPromos, initial?.promoTypes, visible]);

  const activeCount = useMemo(() => {
    const promoCount = enablePromoFilters ? promoTypes.length + (onlyMyPromos ? 1 : 0) : 0;
    return selected.length + promoCount;
  }, [enablePromoFilters, onlyMyPromos, promoTypes.length, selected.length]);

  const resetFilters = () => {
    setSelected([]);
    setOnlyMyPromos(false);
    setPromoTypes([]);
  };

  const togglePromoType = (t: string) => setPromoTypes((s) => s.includes(t) ? s.filter(x=>x!==t) : [...s, t]);

  const toggle = (t: string) => {
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  };

  const apply = () => {
    onApply?.({ categories: selected, onlyMyPromos, promoTypes });
    onClose?.();
  };

  const hasActiveFilters = activeCount > 0;
  const hasCategoryOptions = normalizedCategoryOptions.length > 0;
  const hasPromoTypeOptions = normalizedPromoTypeOptions.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.56)' : 'rgba(7,12,20,0.24)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,12,0.08)' }] }>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(12,12,12,0.14)' }]} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Filtri</Text>
              <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
                {hasActiveFilters ? `${activeCount} filtri attivi` : 'Seleziona cosa vuoi vedere prima'}
              </Text>
            </View>

            <View style={styles.headerActions}>
              {hasActiveFilters ? (
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={resetFilters}
                  style={[styles.resetButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,12,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,12,0.08)' }]}
                >
                  <Feather name="rotate-ccw" size={14} color={theme.colors.text} />
                  <Text style={[styles.resetButtonText, { color: theme.colors.text }]}>Reset</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,12,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,12,0.08)' }]}
              >
                <Feather name="x" size={16} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,12,0.025)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,12,0.08)' }]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Categorie</Text>
                  <Text style={[styles.sectionDescription, { color: theme.colors.muted }]}>Affina la home in base al mood della serata.</Text>
                </View>
                <View style={[styles.counterPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,12,0.05)' }]}>
                  <Text style={[styles.counterPillText, { color: theme.colors.text }]}>{selected.length}</Text>
                </View>
              </View>

              <View style={styles.chips}>
                {hasCategoryOptions ? normalizedCategoryOptions.map((category) => (
                  <TouchableOpacity
                    key={category}
                    activeOpacity={0.82}
                    onPress={() => toggle(category)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selected.includes(category) }}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected.includes(category) ? theme.colors.primary + '66' : theme.colors.border,
                        backgroundColor: selected.includes(category) ? theme.colors.primary + '18' : isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: theme.colors.text }]}>{category}</Text>
                  </TouchableOpacity>
                )) : (
                  <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Nessuna categoria disponibile con i dati correnti.</Text>
                )}
              </View>
            </View>

            {enablePromoFilters ? (
              <>
                <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,12,0.025)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,12,0.08)' }]}>
                  <View style={styles.sectionHeader}>
                    <View>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Promozioni</Text>
                      <Text style={[styles.sectionDescription, { color: theme.colors.muted }]}>Mostra solo le offerte che contano per te.</Text>
                    </View>
                    <View style={[styles.counterPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,12,0.05)' }]}>
                      <Text style={[styles.counterPillText, { color: theme.colors.text }]}>{promoTypes.length + (onlyMyPromos ? 1 : 0)}</Text>
                    </View>
                  </View>

                  <View style={[styles.switchRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,12,0.08)' }]}>
                    <View style={styles.switchCopy}>
                      <Text style={[styles.switchTitle, { color: theme.colors.text }]}>Solo promo per te</Text>
                      <Text style={[styles.switchSubtitle, { color: theme.colors.muted }]}>Nasconde le promo generiche e lascia solo quelle personalizzate.</Text>
                    </View>
                    <Switch value={onlyMyPromos} onValueChange={setOnlyMyPromos} thumbColor={isDark ? undefined : theme.colors.primary} trackColor={{ true: theme.colors.primary, false: theme.colors.border }} />
                  </View>

                  <Text style={[styles.fieldLabel, { color: theme.colors.muted }]}>Tipologia promo</Text>
                  <View style={styles.chips}>
                    {hasPromoTypeOptions ? normalizedPromoTypeOptions.map((promoType) => (
                      <TouchableOpacity
                        key={promoType}
                        activeOpacity={0.82}
                        onPress={() => togglePromoType(promoType)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: promoTypes.includes(promoType) }}
                        style={[
                          styles.chip,
                          {
                            borderColor: promoTypes.includes(promoType) ? theme.colors.primary + '66' : theme.colors.border,
                            backgroundColor: promoTypes.includes(promoType) ? theme.colors.primary + '18' : isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                          },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: theme.colors.text }]}>{promoType}</Text>
                      </TouchableOpacity>
                    )) : <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Nessuna promozione disponibile negli eventi caricati.</Text>}
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={[styles.actions, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,12,0.08)' }]}>
            <TouchableOpacity
              activeOpacity={0.82}
              style={[styles.cancel, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,12,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,12,0.08)' }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: theme.colors.text }]}>Chiudi</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.82} style={[styles.apply, { backgroundColor: theme.colors.primary }]} onPress={apply}>
              <Text style={[styles.applyText, { color: theme.colors.text }]}>Mostra risultati</Text>
              {hasActiveFilters ? <Text style={[styles.applyMeta, { color: theme.colors.text }]}>{activeCount} attivi</Text> : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: "86%",
  },
  handleWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
  },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  content: {
    flexGrow: 0,
  },
  contentContainer: {
    paddingBottom: 12,
    gap: 12,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  sectionDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  counterPill: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  counterPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  switchRow: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  switchSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  fieldLabel: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  cancel: {
    flex: 0.9,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "700",
  },
  apply: {
    flex: 1.3,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { fontSize: 14, fontWeight: "800" },
  applyMeta: { marginTop: 2, fontSize: 11, fontWeight: "600", opacity: 0.8 },
});