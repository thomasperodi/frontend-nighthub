import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { resolveEventImageUri } from "../utils/media";

export default function TileEventCard({ item, onPress }: any) {
  const { theme } = useTheme();
  const uri = resolveEventImageUri(item.image);
  return (
    <TouchableOpacity style={[styles.wrap, { backgroundColor: theme.colors.card }]} onPress={() => onPress?.(item)}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <View style={[styles.image, { backgroundColor: theme.colors.card }]} />
      )}
      <View style={styles.overlay}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.meta, { color: theme.colors.muted }]}>{item.date} • {item.time}</Text>
        {item.promos && item.promos.length ? (
          <View style={styles.promoWrap}>
            {item.promos.slice(0, 2).map((promo: any) => (
              <View key={promo.id} style={[styles.promoInline, { backgroundColor: theme.colors.accent + '22' }]}>
                <Text style={[styles.promoStripText, { color: theme.colors.accent }]} numberOfLines={1}>{promo.title}</Text>
              </View>
            ))}
            {item.promos.length > 2 ? (
              <View style={[styles.promoInline, { backgroundColor: theme.colors.accent + '22' }]}>
                <Text style={[styles.promoStripText, { color: theme.colors.accent }]}>+{item.promos.length - 2}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, margin: 6, borderRadius: 12, overflow: "hidden" },
  image: { width: "100%", height: 140 },
  overlay: { padding: 10 },
  title: { fontSize: 14, fontWeight: "800", marginBottom: 6 },
  meta: { fontSize: 12 },
  promoWrap: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  promoInline: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  promoStripText: { fontSize: 12, fontWeight: '700' },
});