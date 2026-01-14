import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";

export interface NavItem {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}

interface BottomNavProps {
  items: NavItem[];
  active: string;
  onChange?: (key: string) => void;
}

export default function BottomNav({ items, active, onChange }: BottomNavProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.safeArea, { backgroundColor: theme.colors.surface }]}
    >
      <View style={[styles.wrap, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <TouchableOpacity 
              key={it.key} 
              style={styles.item} 
              onPress={() => onChange?.(it.key)} 
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={it.label}
            >
              <View style={[styles.iconWrapper, isActive && { backgroundColor: theme.colors.primary + "22" }]}>
                <Feather 
                  name={it.icon} 
                  size={20} 
                  color={isActive ? theme.colors.primary : theme.colors.muted} 
                />
              </View>
              <Text style={[styles.label, { color: isActive ? theme.colors.primary : theme.colors.muted }]}>
                {it.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
  wrap: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderTopWidth: 1,
  },
  item: { alignItems: "center" },
  label: { fontSize: 12, marginTop: 6 },
  iconWrapper: { padding: 8, borderRadius: 10 },
});