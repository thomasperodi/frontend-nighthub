import React, { useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

const CATEGORIES = ["Musica", "Dj set", "Live", "Latino", "Elettronica", "House"];

// derive promo types from events
import { MOCK_EVENTS } from "../data/mockEvents";
const PROMO_TYPES = Array.from(new Set(MOCK_EVENTS.flatMap(e => (e.promos || []).map((p:any) => p.title))));

export default function FilterModal({ visible, onClose, onApply, initial, enablePromoFilters = true }: any) {
  const { theme, isDark } = useTheme();
  const [selected, setSelected] = useState<string[]>(initial?.categories || []);
  const [onlyMyPromos, setOnlyMyPromos] = useState<boolean>(initial?.onlyMyPromos || false);
  const [promoTypes, setPromoTypes] = useState<string[]>(initial?.promoTypes || []);

  const togglePromoType = (t: string) => setPromoTypes((s) => s.includes(t) ? s.filter(x=>x!==t) : [...s, t]);

  const toggle = (t: string) => {
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  };

  const apply = () => {
    onApply?.({ categories: selected, onlyMyPromos, promoTypes });
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)' }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }] }>
          <Text style={[styles.title, { color: theme.colors.text }]}>Filtra eventi</Text>
          <ScrollView style={{ maxHeight: 240 }}>
            <Text style={[styles.section, { color: theme.colors.muted }]}>Categorie</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => toggle(c)}
                  style={[styles.chip, { borderColor: theme.colors.border }, selected.includes(c) && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } ]}
                >
                  <Text style={[styles.chipText, { color: theme.colors.text }, selected.includes(c) && { color: theme.colors.text }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {enablePromoFilters ? (
              <>
                <View style={{ marginTop: 12 }}>
                  <Text style={[{ color: theme.colors.muted, marginBottom: 8 }]}>Filtra per tipo di promozione</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {PROMO_TYPES.length ? PROMO_TYPES.map((p) => (
                      <TouchableOpacity key={p} onPress={() => togglePromoType(p)} style={[styles.chip, { borderColor: theme.colors.border }, promoTypes.includes(p) && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } ]}>
                        <Text style={[{ color: theme.colors.text }]}>{p}</Text>
                      </TouchableOpacity>
                    )) : <Text style={{ color: theme.colors.muted }}>Nessuna promozione tra gli eventi</Text>}
                  </View>
                </View>

                <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[{ color: theme.colors.text, fontWeight: '700' }]}>Solo eventi con le mie promozioni</Text>
                  <Switch value={onlyMyPromos} onValueChange={setOnlyMyPromos} thumbColor={isDark ? undefined : theme.colors.primary} trackColor={{ true: theme.colors.primary, false: theme.colors.border }} />
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onClose}><Text style={[styles.cancelText, { color: theme.colors.muted }]}>Annulla</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.apply, { backgroundColor: theme.colors.primary }]} onPress={apply}><Text style={[styles.applyText, { color: theme.colors.text }]}>Applica</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { padding: 18, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  title: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  section: { marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#9B5CFF", borderColor: "#9B5CFF" },
  chipText: {  },
  actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  cancel: { paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 },
  cancelText: {  },
  apply: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  applyText: { fontWeight: "700" },
});