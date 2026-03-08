import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  TextInput,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { listVenueTables } from "../services/tables";
import type { VenueTable } from "../types/tables";

type ZoneConfig = {
  id: string;
  label: string;
  per_testa?: number | null;
  costo_minimo?: number | null;
  persone_max?: number | null;
};

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeZoneLabel(table: VenueTable): string {
  const z = String(table.zona ?? "").trim();
  if (z.length) return z;
  const n = String(table.nome ?? "").trim();
  return n.length ? n : "Senza zona";
}

function formatMoney(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return `€ ${value.toFixed(2)}`;
}

function pickZoneConfigs(rows: VenueTable[]): ZoneConfig[] {
  const map = new Map<string, ZoneConfig>();

  for (const row of rows) {
    const label = normalizeZoneLabel(row);
    const key = label.toLowerCase();

    const next: ZoneConfig = {
      id: row.id,
      label,
      per_testa: asNumber(row.per_testa),
      costo_minimo: asNumber(row.costo_minimo),
      persone_max:
        row.persone_max === null || row.persone_max === undefined
          ? null
          : Number(row.persone_max),
    };

    if (!map.has(key)) {
      map.set(key, next);
      continue;
    }

    const prev = map.get(key)!;
    const prevScore =
      (prev.per_testa !== null && prev.per_testa !== undefined ? 1 : 0) +
      (prev.costo_minimo !== null && prev.costo_minimo !== undefined ? 1 : 0) +
      (prev.persone_max !== null && prev.persone_max !== undefined ? 1 : 0);
    const nextScore =
      (next.per_testa !== null && next.per_testa !== undefined ? 1 : 0) +
      (next.costo_minimo !== null && next.costo_minimo !== undefined ? 1 : 0) +
      (next.persone_max !== null && next.persone_max !== undefined ? 1 : 0);

    if (nextScore > prevScore) map.set(key, next);
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export default function TableBookingModal({ visible, onClose, event, onBooked }: any) {
  const { theme } = useTheme();
  const [loadingZones, setLoadingZones] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [people, setPeople] = useState<string>("");
  const [tableName, setTableName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const venueId: string | undefined =
    event?.venue_id ?? event?.venue?.id ?? event?.venueId ?? undefined;
  const eventId: string | undefined = event?.id ?? event?.event_id ?? undefined;

  const selectedZone = useMemo(() => {
    if (!selectedZoneId) return null;
    return zones.find((z) => z.id === selectedZoneId) ?? null;
  }, [selectedZoneId, zones]);

  const guestsValue = useMemo(() => {
    const n = Number(people);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  }, [people]);

  const estimatedTotal = useMemo(() => {
    const guests = guestsValue;
    if (!selectedZone || !guests) return null;

    const perHead = selectedZone.per_testa;
    const minimum = selectedZone.costo_minimo;

    if (perHead === null || perHead === undefined) {
      return minimum ?? null;
    }

    const computed = perHead * guests;
    if (minimum === null || minimum === undefined) return computed;
    return Math.max(computed, minimum);
  }, [selectedZone, guestsValue]);

  const exceedsSelectedZoneMax = useMemo(() => {
    if (!selectedZone || !guestsValue) return false;
    if (selectedZone.persone_max === null || selectedZone.persone_max === undefined) return false;
    return guestsValue > selectedZone.persone_max;
  }, [selectedZone, guestsValue]);

  const canSubmit = Boolean(
    !loadingZones &&
      !submitting &&
      selectedZone &&
      guestsValue &&
      !exceedsSelectedZoneMax,
  );

  const reset = () => {
    setZones([]);
    setSelectedZoneId(null);
    setPeople("");
    setTableName("");
    setError(null);
    setSubmitting(false);
  };

  const reloadZones = async () => {
    if (!venueId) {
      setZones([]);
      setSelectedZoneId(null);
      setError("Locale non disponibile per questo evento.");
      return;
    }

    try {
      setLoadingZones(true);
      setError(null);
      const rows = await listVenueTables(venueId);
      const parsedZones = pickZoneConfigs(Array.isArray(rows) ? rows : []);
      setZones(parsedZones);
      setSelectedZoneId((prev) => prev ?? parsedZones[0]?.id ?? null);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message || e?.message || "Errore nel caricamento zone";
      setError(status ? `${msg} (${status})` : msg);
      setZones([]);
      setSelectedZoneId(null);
    } finally {
      setLoadingZones(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setPeople("");
    setTableName("");
    setError(null);
    setSubmitting(false);
    void reloadZones();
  }, [visible, venueId, eventId]);

  const validate = (): number | null => {
    const guests = Number(people);
    if (!Number.isInteger(guests) || guests < 1) {
      setError("Inserisci almeno 1 persona.");
      return null;
    }

    if (!selectedZone) {
      setError("Seleziona una zona.");
      return null;
    }

    if (
      selectedZone.persone_max !== null &&
      selectedZone.persone_max !== undefined &&
      guests > selectedZone.persone_max
    ) {
      setError(`Massimo ${selectedZone.persone_max} persone per questa zona.`);
      return null;
    }

    setError(null);
    return guests;
  };

  const submit = async () => {
    Keyboard.dismiss();
    if (submitting) return;

    if (!eventId) {
      setError("Evento non valido.");
      return;
    }

    const guests = validate();
    if (!guests || !selectedZone) return;

    const reservation = {
      type: "table",
      event_id: eventId,
      guests,
      venue_zone_id: selectedZone.id,
      venue_table_id: selectedZone.id,
      status: "pending",
      total_amount: estimatedTotal ?? undefined,
      table_name: tableName.trim() || undefined,
      meta: {
        zona: selectedZone.label,
        booking_mode: "zone_request",
      },
    };

    try {
      setSubmitting(true);
      setError(null);
      await Promise.resolve(onBooked?.(reservation));
      onClose?.();
      reset();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message || e?.message || "Errore nella prenotazione";
      setError(status ? `${msg} (${status})` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            Keyboard.dismiss();
            onClose?.();
          }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ width: "100%" }}
        >
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => onClose?.()} style={{ padding: 8, marginLeft: -8 }}>
                  <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: "700" }}>✕</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.colors.text }]}>Richiedi un tavolo</Text>
                <View style={{ width: 40 }} />
              </View>

              <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Scegli la zona e invia la richiesta. Il locale confermerà il tavolo.</Text>

              {loadingZones ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.muted, fontWeight: "700" }}>Caricamento zone…</Text>
                </View>
              ) : null}

              {!loadingZones && zones.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={{ color: theme.colors.muted, fontWeight: "700", textAlign: "center" }}>
                    Nessuna zona configurata dal locale per questo evento.
                  </Text>
                  <TouchableOpacity
                    onPress={() => void reloadZones()}
                    style={[styles.retryBtn, { borderColor: theme.colors.border }]}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Ricarica</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {!loadingZones && zones.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Zona</Text>
                  <View style={{ gap: 8 }}>
                    {zones.map((z) => {
                      const active = z.id === selectedZoneId;
                      return (
                        <TouchableOpacity
                          key={z.id}
                          onPress={() => {
                            setSelectedZoneId(z.id);
                            setError(null);
                          }}
                          style={[
                            styles.zoneCard,
                            {
                              borderColor: active ? theme.colors.primary : theme.colors.border,
                              backgroundColor: theme.colors.card,
                            },
                          ]}
                        >
                          <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 14 }}>{z.label}</Text>
                          <Text style={{ color: theme.colors.muted, marginTop: 4, fontSize: 12 }}>
                            Per testa: {formatMoney(z.per_testa)} • Minimo: {formatMoney(z.costo_minimo)} • Max: {z.persone_max ?? "—"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Numero persone</Text>
                  <TextInput
                    value={people}
                    onChangeText={(t) => setPeople(t.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="Es: 4"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
                  />



                  {selectedZone?.persone_max ? (
                    <Text style={{ color: exceedsSelectedZoneMax ? "#ef4444" : theme.colors.muted, marginTop: 6, fontSize: 12, fontWeight: "700" }}>
                      Max per questa zona: {selectedZone.persone_max}
                    </Text>
                  ) : null}

                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Nome tavolo (opzionale)</Text>
                  <TextInput
                    value={tableName}
                    onChangeText={(t) => setTableName(t.replace(/^\s+/, "").slice(0, 60))}
                    placeholder="Es: Compleanno Giulia"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  <Text style={{ color: theme.colors.muted, marginTop: 6, fontSize: 11, fontWeight: "700", textAlign: "right" }}>
                    {tableName.length}/60
                  </Text>

                  <View style={[styles.summaryBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
                    <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Riepilogo</Text>
                    <Text style={{ color: theme.colors.muted, marginTop: 4 }}>
                      Zona: {selectedZone?.label ?? "—"} • Totale stimato: {estimatedTotal !== null ? formatMoney(estimatedTotal) : "—"}
                    </Text>
                    {!!tableName.trim() && (
                      <Text style={{ color: theme.colors.muted, marginTop: 2 }}>
                        Nome tavolo: {tableName.trim()}
                      </Text>
                    )}
                    <Text style={{ color: theme.colors.muted, marginTop: 2 }}>
                      Il tavolo esatto viene assegnato dal locale in conferma.
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={submit}
                    disabled={!canSubmit}
                    style={[
                      styles.submitBtn,
                      { backgroundColor: theme.colors.primary },
                      !canSubmit && { opacity: 0.55 },
                    ]}
                  >
                    <Text style={styles.submitText}>
                      {submitting ? "Invio..." : "Invia richiesta tavolo"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 18, fontWeight: "900" },
  subtitle: { marginTop: 6, fontSize: 13, fontWeight: "700" },
  centerBox: {
    paddingVertical: 18,
    alignItems: "center",
    gap: 10,
  },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "900",
  },
  zoneCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontWeight: "800",
  },
  quickGuestsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickGuestChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  submitBtn: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  errorText: { marginTop: 12, color: "#ef4444", fontWeight: "700" },
});
