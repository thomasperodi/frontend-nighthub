import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export default function CompactEventCard({ item, onPress }: any) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: theme.colors.card }]} onPress={() => onPress?.(item)}>
      <Image source={{ uri: item.image }} style={styles.thumb} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.meta, { color: theme.colors.muted }]}>{item.date} • {item.venue}</Text>
        {item.promos && item.promos.length ? (
          <View style={[styles.promoMini, { backgroundColor: theme.colors.accent + '12' }]}>
            <Text style={[styles.promoMiniText, { color: theme.colors.accent }]} numberOfLines={1}>{item.promos[0].title}</Text>
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
  promoMini: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  promoMiniText: { fontSize: 12, fontWeight: '700' }
});