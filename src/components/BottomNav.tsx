import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";

export interface NavItem {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  badgeCount?: number;
}

interface BottomNavProps {
  items: NavItem[];
  active: string;
  onChange?: (key: string) => void;
}

export default function BottomNav({ items, active, onChange }: BottomNavProps) {
  const { theme, isDark } = useTheme();
  const shellBackground = isDark ? "rgba(13, 13, 19, 0.88)" : "rgba(255, 255, 255, 0.92)";
  const activeGlow = isDark ? theme.colors.primary + "66" : theme.colors.primary + "33";
  const activeItemBackground = isDark ? "rgba(155, 92, 255, 0.18)" : "rgba(110, 91, 230, 0.14)";

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.safeArea, {
        ...Platform.select({
          ios: {
            shadowColor: isDark ? "#000" : "#A0A0A0",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: isDark ? 0.45 : 0.12,
            shadowRadius: 20,
          },
          android: { elevation: 18 },
        })
      }]}
    >
      <View style={styles.outerPadding}>
        <View style={[styles.wrap, { backgroundColor: shellBackground, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,12,0.08)" }]}>
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <TouchableOpacity
              key={it.key}
              style={[
                styles.item,
                isActive ? { backgroundColor: activeItemBackground, borderColor: theme.colors.primary + "66" } : null,
              ]}
              onPress={() => onChange?.(it.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={it.label}
              activeOpacity={0.7}
            >
              {isActive ? (
                <View style={[styles.activePill, { backgroundColor: theme.colors.primary, shadowColor: activeGlow }]} />
              ) : null}
              <View style={styles.iconWrapper}>
                <Feather
                  name={it.icon}
                  size={22}
                  color={isActive ? theme.colors.primary : theme.colors.muted}
                />
                {it.badgeCount ? (
                  <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                    <Text style={styles.badgeText}>{it.badgeCount > 99 ? "99+" : String(it.badgeCount)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[
                styles.label,
                { color: isActive ? theme.colors.primary : theme.colors.muted },
                isActive && styles.labelActive,
              ]}>
                {it.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  outerPadding: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 26,
    borderWidth: 1,
    gap: 7,
  },
  item: {
    alignItems: "center",
    flex: 1,
    paddingBottom: 6,
    paddingTop: 8,
    position: "relative",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: 62,
  },
  label: { fontSize: 11, marginTop: 4, letterSpacing: 0.2 },
  labelActive: { fontWeight: "700" },
  iconWrapper: {
    padding: 6,
    borderRadius: 14,
    position: "relative",
  },
  activePill: {
    position: "absolute",
    top: -1,
    width: 26,
    height: 3,
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  badge: {
    position: "absolute",
    top: -1,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "800",
  },
});