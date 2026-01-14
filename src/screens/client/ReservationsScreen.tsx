import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { getReservations } from "../../services/reservations";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ReservationsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [list, setList] = useState<any[]>([]);

  const load = async () => {
    const r = await getReservations();
    setList(r);
  };

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }] }>
      <View style={{ padding: 18 }}>
        <Text style={[{ fontSize: 18, fontWeight: '800', color: theme.colors.text }]}>Le tue prenotazioni</Text>
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('ReservationDetail', { id: item.id })} style={[styles.row, { borderColor: theme.colors.border }]}>
            <View>
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{item.eventTitle}</Text>
              <Text style={{ color: theme.colors.muted }}>{item.zoneName} • {item.tableName}</Text>
            </View>
            <View style={{ justifyContent: 'center' }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{item.status}</Text>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ padding: 18 }}
        ListEmptyComponent={() => (
          <View style={{ padding: 18 }}>
            <Text style={{ color: theme.colors.muted }}>Nessuna prenotazione trovata.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { padding: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});