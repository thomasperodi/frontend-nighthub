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
import { fetchEventById } from '../services/events';
import type { Event, EventTablePricing } from '../types/events';
import type { VenueTable } from '../types/tables';

type ZoneConfig = {
  id: string;
  label: string;
  per_testa?: number | null;
  costo_minimo?: number | null;
  persone_max?: number | null;
  hasEventOverride?: boolean;
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
    const key = `${String(row.id)}-${label.toLowerCase()}`;
    map.set(key, {
      id: row.id,
      label,
      per_testa: asNumber(row.per_testa),
      costo_minimo: asNumber(row.costo_minimo),
      persone_max: row.persone_max ?? null,
      hasEventOverride: false,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function toEventPricingZones(rows: EventTablePricing[]): ZoneConfig[] {
  const map = new Map<string, ZoneConfig>();

  for (const row of rows) {
    const label = String(row.label ?? row.zona ?? row.nome ?? '').trim() || 'Senza zona';
    const key = String(row.venue_table_id);
    if (!key.length) continue;

    map.set(key, {
      id: row.venue_table_id,
      label,
      per_testa: asNumber(row.per_testa),
      costo_minimo: asNumber(row.costo_minimo),
      persone_max:
        row.persone_max === null || row.persone_max === undefined
          ? null
          : Number(row.persone_max),
      hasEventOverride: Boolean(row.has_override),
    });
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `€ ${value.toFixed(2)}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
  event?: Event | null;
  eventId: string;
  defaultDate?: string; // YYYY-MM-DD or ISO
  userId: string;
  venueId?: string;
};

export default function CreateReservationModal({
  visible,
  onClose,
  onCreated,
  event,
  eventId,
  defaultDate,
  userId,
  venueId,
}: Props) {
  const { theme } = useTheme();
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [guestsCount, setGuestsCount] = useState<string>('');
  const [tableName, setTableName] = useState<string>('');
  const [usingEventPricing, setUsingEventPricing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedZoneId(null);
    setGuestsCount('');
    setTableName('');
    setUsingEventPricing(false);
  };

  useEffect(() => {
    if (!visible) return;
    if (!venueId) {
      setZones([]);
      setUsingEventPricing(false);
      return;
    }

    (async () => {
      try {
        setLoadingTables(true);
        let eventPricing: EventTablePricing[] =
          Array.isArray(event?.table_pricing) ? event.table_pricing : [];

        if (!eventPricing.length && eventId) {
          try {
            const detail = await fetchEventById(eventId);
            eventPricing = Array.isArray(detail?.table_pricing)
              ? detail.table_pricing
              : [];
          } catch {
            // fallback to venue tables below
          }
        }

        if (eventPricing.length > 0) {
          const zonesFromEvent = toEventPricingZones(eventPricing);
          setZones(zonesFromEvent);
          setUsingEventPricing(true);
          const firstId = zonesFromEvent[0]?.id ?? null;
          setSelectedZoneId((prev) =>
            prev && zonesFromEvent.some((z) => z.id === prev) ? prev : firstId,
          );
          return;
        }

        const list = await listVenueTables(venueId);
        const safeList = Array.isArray(list) ? list : [];
        const availableZones = toZones(safeList);
        setZones(availableZones);
        setUsingEventPricing(false);
        setSelectedZoneId((prev) =>
          prev && availableZones.some((z) => z.id === prev) ? prev : availableZones[0]?.id ?? null,
        );
      } catch {
        setZones([]);
        setSelectedZoneId(null);
        setUsingEventPricing(false);
      } finally {
        setLoadingTables(false);
      }
    })();
  }, [visible, venueId, eventId, event?.table_pricing]);

  const guestsValue = useMemo(() => {
    const n = Number(guestsCount);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  }, [guestsCount]);

  const selectedZone = useMemo(() => {
    if (!selectedZoneId) return null;
    return zones.find((z) => z.id === selectedZoneId) ?? null;
  }, [selectedZoneId, zones]);

  const computedTotalPreview = useMemo(() => {
    if (!selectedZone || !guestsValue) return null;
    const perHead = selectedZone.per_testa ?? null;
    const min = selectedZone.costo_minimo ?? null;

    if (perHead === null) {
      return min;
    }

    const byGuests = perHead * guestsValue;
    if (min === null) return byGuests;
    return Math.max(byGuests, min);
  }, [selectedZone, guestsValue]);

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

    if (!selectedZone) {
      Alert.alert('Dati non validi', 'Zona non valida.');
      return;
    }

    if (selectedZone.persone_max && guests > selectedZone.persone_max) {
      Alert.alert('Dati non validi', `Massimo ${selectedZone.persone_max} persone per la zona selezionata.`);
      return;
    }

    const computedTotal = computedTotalPreview ?? undefined;

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
              <Text style={[styles.helperTop, { color: theme.colors.muted }]}>
                {usingEventPricing
                  ? 'Listino evento attivo: vedi solo zone disponibili per questa serata.'
                  : 'Listino standard del locale.'}
              </Text>
              {loadingTables ? (
                <Text style={{ color: theme.colors.muted, fontWeight: '700' }}>Caricamento zone…</Text>
              ) : zones.length === 0 ? (
                <View style={[styles.emptyZoneBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                  <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Nessuna zona disponibile</Text>
                  <Text style={{ color: theme.colors.muted, marginTop: 4, fontSize: 12 }}>
                    Per questo evento non risultano tavoli prenotabili.
                  </Text>
                </View>
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
                        <View style={styles.zoneTitleRow}>
                          <Text style={{ color: theme.colors.text, fontWeight: '800', flex: 1 }}>{z.label}</Text>
                          {z.hasEventOverride ? (
                            <View style={[styles.overrideBadge, { backgroundColor: 'rgba(212,178,79,0.18)', borderColor: 'rgba(212,178,79,0.45)' }]}>
                              <Text style={styles.overrideBadgeText}>Override evento</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ color: theme.colors.muted, marginTop: 4, fontSize: 12 }}>
                          Per testa: {formatMoney(z.per_testa)} • Minimo: {formatMoney(z.costo_minimo)} • Max: {z.persone_max ?? '—'}
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

              <View style={[styles.totalBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                <Text style={[styles.totalLabel, { color: theme.colors.muted }]}>Spesa attuale stimata</Text>
                <Text style={[styles.totalValue, { color: theme.colors.text }]}>{formatMoney(computedTotalPreview)}</Text>
              </View>

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
                disabled={submitting || !selectedZone || !guestsValue}
                style={[
                  styles.submit,
                  { backgroundColor: theme.colors.primary },
                  (submitting || !selectedZone || !guestsValue) && { opacity: 0.6 },
                ]}
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
  helperTop: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  label: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 10, fontSize: 14 },
  emptyZoneBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  tablePick: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10,
  },
  zoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overrideBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overrideBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#f0d785',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  totalValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
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
