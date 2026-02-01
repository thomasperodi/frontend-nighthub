import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { createReservation } from '../services/reservations';
import { listVenueTables } from '../services/tables';
import type { VenueTable } from '../types/tables';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
  eventId: string;
  defaultDate?: string; // YYYY-MM-DD or ISO
  userId: string;
  venueId?: string;
};

export default function CreateReservationModal({
  visible,
  onClose,
  onCreated,
  eventId,
  defaultDate,
  userId,
  venueId,
}: Props) {
  const { theme } = useTheme();
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [guestsCount, setGuestsCount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedTableId(null);
    setGuestsCount('');
  };

  useEffect(() => {
    if (!visible) return;
    if (!venueId) {
      setTables([]);
      return;
    }

    (async () => {
      try {
        setLoadingTables(true);
        const list = await listVenueTables(venueId);
        setTables(list || []);
      } catch {
        setTables([]);
      } finally {
        setLoadingTables(false);
      }
    })();
  }, [visible, venueId]);

  const submit = async () => {
    const guests = Number(guestsCount);

    if (!Number.isFinite(guests) || guests <= 0) {
      Alert.alert('Dati non validi', 'Inserisci un numero ospiti valido.');
      return;
    }

    if (!selectedTableId) {
      Alert.alert('Dati non validi', 'Seleziona un tavolo.');
      return;
    }

    try {
      setSubmitting(true);
      await createReservation({
        user_id: userId,
        event_id: eventId,
        type: 'table',
        guests,
        venue_table_id: selectedTableId,
        status: 'pending',
      });

      Alert.alert('Prenotazione creata', 'La prenotazione è stata salvata.');
      await Promise.resolve(onCreated?.());
      reset();
      onClose();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Errore nella creazione prenotazione';
      Alert.alert('Errore', status ? `${msg} (${status})` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%' }}
        >
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Nuova prenotazione</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={18} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, { color: theme.colors.muted }]}>Tavolo</Text>
              {loadingTables ? (
                <Text style={{ color: theme.colors.muted, fontWeight: '700' }}>Caricamento tavoli…</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {tables.slice(0, 12).map((t) => {
                    const active = selectedTableId === t.id;
                    const label = t.numero ? `Tavolo ${t.numero}` : t.nome;
                    const zone = t.zona ? ` • ${t.zona}` : '';
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setSelectedTableId(t.id)}
                        style={[
                          styles.tablePick,
                          {
                            borderColor: active ? theme.colors.primary : theme.colors.border,
                            backgroundColor: theme.colors.card,
                          },
                        ]}
                      >
                        <Text style={{ color: theme.colors.text, fontWeight: '800' }}>{label}{zone}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {tables.length > 12 ? (
                    <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                      Mostrati i primi 12 tavoli. Usa la schermata Tavoli per gestirli.
                    </Text>
                  ) : null}
                </View>
              )}

              <Text style={[styles.label, { color: theme.colors.muted }]}>Numero ospiti</Text>
              <TextInput
                value={guestsCount}
                onChangeText={(t) => setGuestsCount(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="Es: 4"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
              />

              <TouchableOpacity
                onPress={submit}
                disabled={submitting}
                style={[styles.submit, { backgroundColor: theme.colors.primary }, submitting && { opacity: 0.6 }]}
              >
                <Text style={styles.submitText}>{submitting ? 'Salvataggio…' : 'Crea prenotazione'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '900' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  label: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 10, fontSize: 14 },
  tablePick: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10,
  },
  submit: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: { color: 'white', fontWeight: '900' },
});
