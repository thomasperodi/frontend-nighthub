import React, { useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";

import { resolveEventImageUri } from "../utils/media";
export default function EventCard({ item, onPress }: any) {
  const { theme } = useTheme();
  const [fav, setFav] = useState(false);
  const uri = resolveEventImageUri(item.image);

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: theme.colors.card }]} onPress={() => onPress?.(item)}>
      <View style={styles.imageWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <View style={[styles.image, { backgroundColor: theme.colors.card }]} />
        )}
        <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.badgeText, { color: theme.colors.text }]}>{item.tags[0]}</Text>
        </View>

        <TouchableOpacity style={[styles.fav, { backgroundColor: theme.colors.card }]} onPress={() => setFav((s) => !s)} accessibilityRole="button">
          <Feather name={fav ? "heart" : "heart"} size={18} color={fav ? theme.colors.primary : theme.colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.meta, { color: theme.colors.muted }]}>{item.date} · {item.time}</Text>
        <Text style={[styles.location, { color: theme.colors.muted }]} numberOfLines={1}>{item.venue} · {item.city}</Text>

        <View style={{ height: 8 }} />
        <View style={styles.tags}>
          {item.tags.map((t: string) => (
            <View style={[styles.tag, { backgroundColor: theme.colors.primary + "22" }]} key={t}>
              <Text style={[styles.tagText, { color: theme.colors.muted }]}>{t}</Text>
            </View>
          ))}
        </View>

        {item.promos && item.promos.length ? (
          <View style={[styles.promoInline, { backgroundColor: theme.colors.accent + '12' }]}>
            <Text style={[styles.promoInlineText, { color: theme.colors.accent }]} numberOfLines={1}>{item.promos[0].title}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  imageWrap: { width: 140, height: 140, position: "relative" },
  image: {
    width: 140,
    height: 140,
  },
  badge: { position: "absolute", left: 10, top: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  promoInline: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start' },
  promoInlineText: { fontSize: 12, fontWeight: "700" },
  fav: { position: "absolute", right: 10, top: 10, padding: 6, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.08)" },
  info: {
    flex: 1,
    padding: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  meta: {
    fontSize: 13,
    marginBottom: 6,
  },
  location: {
    fontSize: 13,
    marginBottom: 8,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 12,
  },
});