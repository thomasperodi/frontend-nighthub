import React from "react";
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export default function FeaturedCarousel({ data, onPress }: any) {
  const { theme } = useTheme();
  if (!data || !data.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Offerte per te</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(i: any) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        renderItem={({ item }: any) => (
          <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} style={[styles.card, { backgroundColor: theme.colors.card }]} onPress={() => onPress?.(item)}>
            <Image source={{ uri: item.image }} style={styles.image} />
            <View style={styles.info}>
              <Text style={[styles.promoTitle, { color: theme.colors.text }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.promoMeta, { color: theme.colors.muted }]}>{item.discount} • fino al {item.until}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  title: { fontWeight: "700", fontSize: 16, marginLeft: 12, marginBottom: 8 },
  card: { width: 280, borderRadius: 12, overflow: "hidden", marginRight: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.02)" },
  image: { width: "100%", height: 150, resizeMode: 'cover' },
  info: { padding: 10 },
  promoTitle: { fontSize: 14, fontWeight: "800", marginBottom: 6 },
  promoMeta: { fontSize: 12 },
});