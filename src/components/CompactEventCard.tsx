import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { resolveEventImageUri } from "../utils/media";

export default function CompactEventCard({ item, onPress }: any) {
  const { theme } = useTheme();
  const uri = resolveEventImageUri(item.image);
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: theme.colors.card }]} onPress={() => onPress?.(item)}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: theme.colors.card }]} />
      )}
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.meta, { color: theme.colors.muted }]}>{item.date} • {item.venue}</Text>
        {item.promos && item.promos.length ? (
          <View style={styles.promoWrap}>
            {item.promos.slice(0, 2).map((promo: any) => (
              <View key={promo.id} style={[styles.promoMini, { backgroundColor: theme.colors.accent + '12' }]}>
                <Text style={[styles.promoMiniText, { color: theme.colors.accent }]} numberOfLines={1}>{promo.title}</Text>
              </View>
            ))}
            {item.promos.length > 2 ? (
              <View style={[styles.promoMini, { backgroundColor: theme.colors.accent + '12' }]}>
                <Text style={[styles.promoMiniText, { color: theme.colors.accent }]}>+{item.promos.length - 2}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderRadius: 10, padding: 8, marginBottom: 10 },
  thumb: { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  content: { flex: 1 },
  title: { fontWeight: "700" },
  meta: { fontSize: 12 },
  promoWrap: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  promoMini: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  promoMiniText: { fontSize: 12, fontWeight: '700' }
});