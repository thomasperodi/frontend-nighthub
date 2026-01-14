import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";

export default function EventsScreen({ navigation }: any) {
  const { theme } = useTheme();

  const events = [
    { id: "1", name: "Friday Students Night", date: "10 Maggio" },
    { id: "2", name: "Saturday Clubbing", date: "11 Maggio" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Eventi</Text>
        <TouchableOpacity onPress={() => navigation.navigate("CreateEvent")}>
          <Feather name="plus" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>{item.date}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "800" },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: "white", fontWeight: "700" },
  cardSubtitle: { color: "#CFC6FF", marginTop: 4 },
});
