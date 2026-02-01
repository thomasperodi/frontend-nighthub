import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fetchVenues, createVenue, updateVenue, deleteVenue } from '../../services/venues';
import { Venue } from '../../types/events';
import PrimaryButton from '../../components/PrimaryButton';

export default function VenuesScreen() {
  const { theme } = useTheme();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const load = async () => {
    try {
      setLoading(true);
      const list = await fetchVenues();
      setVenues(list);
    } catch (e) {
      console.warn('load venues', e);
      Alert.alert('Errore', 'Impossibile caricare i locali');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async () => {
    if (!name.trim()) return Alert.alert('Nome richiesto');
    try {
      setSubmitting(true);
      const created = await createVenue({ name: name.trim(), city: city.trim() });
      setName(''); setCity('');
      await load();
      Alert.alert('Locale creato', `Locale ${created.name} creato con successo`);
    } catch (e) {
      console.warn('create venue', e);
      Alert.alert('Errore', 'Impossibile creare il locale');
    } finally { setSubmitting(false); }
  };

  const onDelete = (id: string) => {
    Alert.alert('Conferma eliminazione', 'Sei sicuro di voler eliminare questo locale?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await deleteVenue(id); await load(); Alert.alert('Eliminato', 'Locale eliminato.'); } catch (e) { console.warn(e); Alert.alert('Errore', 'Eliminazione fallita'); }
      } }
    ]);
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Gestione Locali</Text>

      <View style={{ marginTop: 12 }}>
        <TextInput placeholder="Nome locale" value={name} onChangeText={setName} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]} />
        <TextInput placeholder="Città" value={city} onChangeText={setCity} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]} />
        <PrimaryButton title="Crea locale" onPress={onCreate} isLoading={submitting} />
      </View>

      <View style={{ marginTop: 20, flex: 1 }}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={venues}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.venueName, { color: theme.colors.text }]}>{item.name}</Text>
                  <Text style={[styles.venueCity, { color: theme.colors.muted }]}>{item.city || '—'}</Text>
                </View>
                <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel={`Elimina ${item.name}`}>
                  <Text style={{ color: '#ef4444', fontWeight: '800' }}>Elimina</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '900' },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 10, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  venueName: { fontSize: 16, fontWeight: '800' },
  venueCity: { fontSize: 12 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 8 }
});