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

type ZoneConfig = {
  id: string;
  label: string;
  per_testa?: number | null;
  costo_minimo?: number | null;
  persone_max?: number | null;
};

function normalizeZoneLabel(table: VenueTable): string {
  const z = String(table.zona ?? '').trim();
  if (z.length) return z;
  const n = String(table.nome ?? '').trim();
  return n.length ? n : 'Senza zona';
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toZones(rows: VenueTable[]): ZoneConfig[] {
  const map = new Map<string, ZoneConfig>();
  for (const row of rows) {
    const label = normalizeZoneLabel(row);
    const key = label.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        id: row.id,
        label,
        per_testa: asNumber(row.per_testa),
        costo_minimo: asNumber(row.costo_minimo),
        persone_max: row.persone_max ?? null,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

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
  const zones = useMemo(() => toZones(tables), [tables]);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [guestsCount, setGuestsCount] = useState<string>('');
  const [tableName, setTableName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedZoneId(null);
    setGuestsCount('');
    setTableName('');
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
        const safeList = list || [];
        setTables(safeList);
        const availableZones = toZones(safeList);
        setSelectedZoneId((prev) => prev ?? availableZones[0]?.id ?? null);
      } catch {
        setTables([]);
        setSelectedZoneId(null);
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

    if (!selectedZoneId) {
      Alert.alert('Dati non validi', 'Seleziona una zona.');
      return;
    }

    const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
    if (!selectedZone) {
      Alert.alert('Dati non validi', 'Zona non valida.');
      return;
    }

    if (selectedZone.persone_max && guests > selectedZone.persone_max) {
      Alert.alert('Dati non validi', `Massimo ${selectedZone.persone_max} persone per la zona selezionata.`);
      return;
    }

    const computedTotal = (() => {
      if (selectedZone.per_testa === null || selectedZone.per_testa === undefined) {
        return selectedZone.costo_minimo ?? undefined;
      }
      const byGuest = selectedZone.per_testa * guests;
      if (selectedZone.costo_minimo === null || selectedZone.costo_minimo === undefined) {
        return byGuest;
      }
      return Math.max(byGuest, selectedZone.costo_minimo);
    })();

    try {
      setSubmitting(true);
      await createReservation({
        user_id: userId,
        event_id: eventId,
        type: 'table',
        guests,
        venue_zone_id: selectedZoneId,
        venue_table_id: selectedZoneId,
        table_name: tableName.trim() || undefined,
        status: 'pending',
        total_amount: computedTotal,
      });

      Alert.alert('Richiesta creata', 'Richiesta tavolo inviata. Il locale confermerà la prenotazione.');
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
              <Text style={[styles.label, { color: theme.colors.muted }]}>Zona</Text>
              {loadingTables ? (
                <Text style={{ color: theme.colors.muted, fontWeight: '700' }}>Caricamento zone…</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {zones.map((z) => {
                    const active = selectedZoneId === z.id;
                    return (
                      <TouchableOpacity
                        key={z.id}
                        onPress={() => setSelectedZoneId(z.id)}
                        style={[
                          styles.tablePick,
                          {
                            borderColor: active ? theme.colors.primary : theme.colors.border,
                            backgroundColor: theme.colors.card,
                          },
                        ]}
                      >
                        <Text style={{ color: theme.colors.text, fontWeight: '800' }}>{z.label}</Text>
                        <Text style={{ color: theme.colors.muted, marginTop: 4, fontSize: 12 }}>
                          Per testa: {z.per_testa !== null && z.per_testa !== undefined ? `€${z.per_testa}` : '—'} • Minimo: {z.costo_minimo !== null && z.costo_minimo !== undefined ? `€${z.costo_minimo}` : '—'} • Max: {z.persone_max ?? '—'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
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

              <Text style={[styles.label, { color: theme.colors.muted }]}>Nome tavolo (opzionale)</Text>
              <TextInput
                value={tableName}
                onChangeText={(t) => setTableName(t.replace(/^\s+/, '').slice(0, 60))}
                placeholder="Es: Compleanno Marta"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Text style={[styles.helperText, { color: theme.colors.muted }]}>{tableName.length}/60</Text>

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
  helperText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 4,
  },
  submit: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: { color: 'white', fontWeight: '900' },
});
