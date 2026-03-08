import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { VenueTable } from "../../types/tables";
import {
  deleteVenueTable,
  listVenueTables,
  upsertVenueTablesBulk,
  updateVenueTable,
} from "../../services/tables";

type Props = {
  venueId?: string | null;
};

type ZoneConfig = {
  id: string;
  label: string;
  per_testa?: number | null;
  costo_minimo?: number | null;
  persone_max?: number | null;
  sourceIds: string[];
};

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLabel(row: VenueTable): string {
  const zona = String(row.zona ?? "").trim();
  if (zona.length) return zona;
  const nome = String(row.nome ?? "").trim();
  return nome.length ? nome : "Senza zona";
}

function toZoneConfigs(rows: VenueTable[]): ZoneConfig[] {
  const map = new Map<string, ZoneConfig>();

  for (const row of rows) {
    const label = normalizeLabel(row);
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
      sourceIds: [row.id],
    };

    if (!map.has(key)) {
      map.set(key, next);
      continue;
    }

    const prev = map.get(key)!;
    prev.sourceIds.push(row.id);

    const prevScore =
      (prev.per_testa !== null && prev.per_testa !== undefined ? 1 : 0) +
      (prev.costo_minimo !== null && prev.costo_minimo !== undefined ? 1 : 0) +
      (prev.persone_max !== null && prev.persone_max !== undefined ? 1 : 0);
    const nextScore =
      (next.per_testa !== null && next.per_testa !== undefined ? 1 : 0) +
      (next.costo_minimo !== null && next.costo_minimo !== undefined ? 1 : 0) +
      (next.persone_max !== null && next.persone_max !== undefined ? 1 : 0);

    if (nextScore > prevScore) {
      prev.id = next.id;
      prev.per_testa = next.per_testa;
      prev.costo_minimo = next.costo_minimo;
      prev.persone_max = next.persone_max;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function formatMoney(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return `€${value.toFixed(2)}`;
}

export default function VenueTablesScreen({ venueId }: Props) {
  const { theme } = useTheme();

  const [rows, setRows] = useState<VenueTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ZoneConfig | null>(null);

  const [zoneName, setZoneName] = useState("");
  const [perTesta, setPerTesta] = useState("");
  const [costoMinimo, setCostoMinimo] = useState("");
  const [personeMax, setPersoneMax] = useState("");

  const zones = useMemo(() => toZoneConfigs(rows), [rows]);

  const totals = useMemo(() => {
    const configuredPrice = zones.filter((z) => z.per_testa !== null && z.per_testa !== undefined).length;
    const configuredMinimum = zones.filter((z) => z.costo_minimo !== null && z.costo_minimo !== undefined).length;
    return {
      count: zones.length,
      configuredPrice,
      configuredMinimum,
    };
  }, [zones]);

  const resetModal = () => {
    setEditing(null);
    setZoneName("");
    setPerTesta("");
    setCostoMinimo("");
    setPersoneMax("");
  };

  const closeModal = () => {
    Keyboard.dismiss();
    setModalOpen(false);
    resetModal();
  };

  const load = async () => {
    if (!venueId) {
      setRows([]);
      setError("Venue ID non trovato");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listVenueTables(venueId);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || "Impossibile caricare le zone";
      setError(status ? `${msg} (${status})` : msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  React.useEffect(() => {
    void load();
  }, [venueId]);

  const openCreate = () => {
    resetModal();
    setModalOpen(true);
  };

  const openEdit = (zone: ZoneConfig) => {
    setEditing(zone);
    setZoneName(zone.label);
    setPerTesta(zone.per_testa !== null && zone.per_testa !== undefined ? String(zone.per_testa) : "");
    setCostoMinimo(zone.costo_minimo !== null && zone.costo_minimo !== undefined ? String(zone.costo_minimo) : "");
    setPersoneMax(zone.persone_max !== null && zone.persone_max !== undefined ? String(zone.persone_max) : "");
    setModalOpen(true);
  };

  const parseDecimal = (value: string): number | null => {
    const clean = (value || "").trim().replace(",", ".");
    if (!clean) return null;
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
  };

  const parseIntOrNull = (value: string): number | null => {
    const clean = (value || "").trim();
    if (!clean) return null;
    const n = Number(clean);
    return Number.isInteger(n) ? n : null;
  };

  const saveZone = async () => {
    if (!venueId) return;

    const label = zoneName.trim();
    if (!label) {
      Alert.alert("Dati non validi", "Il nome zona è obbligatorio.");
      return;
    }

    const duplicate = zones.find(
      (z) =>
        z.label.toLowerCase() === label.toLowerCase() &&
        (!editing || z.id !== editing.id),
    );
    if (duplicate) {
      Alert.alert("Zona già presente", `Esiste già la zona "${duplicate.label}".`);
      return;
    }

    const perHead = parseDecimal(perTesta);
    if (perHead !== null && perHead < 0) {
      Alert.alert("Dati non validi", "Costo a persona deve essere >= 0.");
      return;
    }

    const minimum = parseDecimal(costoMinimo);
    if (minimum !== null && minimum < 0) {
      Alert.alert("Dati non validi", "Minimo spesa deve essere >= 0.");
      return;
    }

    const maxPeople = parseIntOrNull(personeMax);
    if (maxPeople !== null && maxPeople < 1) {
      Alert.alert("Dati non validi", "Max persone deve essere >= 1.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editing) {
        await updateVenueTable(venueId, editing.id, {
          nome: label,
          zona: label,
          per_testa: perHead ?? undefined,
          costo_minimo: minimum ?? undefined,
          persone_max: maxPeople ?? undefined,
        });
      } else {
        await upsertVenueTablesBulk(venueId, [
          {
            nome: label,
            zona: label,
            per_testa: perHead ?? undefined,
            costo_minimo: minimum ?? undefined,
            persone_max: maxPeople ?? undefined,
          },
        ]);
      }

      const updated = await listVenueTables(venueId);
      setRows(Array.isArray(updated) ? updated : []);
      closeModal();
      Alert.alert("Salvato", editing ? "Zona aggiornata" : "Zona creata");
    } catch (e: any) {
      Alert.alert("Errore", e?.message || "Impossibile salvare la zona");
    } finally {
      setSaving(false);
    }
  };

  const deleteZone = async (zone: ZoneConfig) => {
    if (!venueId) return;

    Alert.alert(
      "Eliminare zona?",
      `${zone.label}\n\nSaranno rimossi tutti i record duplicati della stessa zona (${zone.sourceIds.length}).`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            try {
              for (const id of zone.sourceIds) {
                await deleteVenueTable(venueId, id);
              }
              setRows((prev) => prev.filter((r) => !zone.sourceIds.includes(r.id)));
            } catch (e: any) {
              Alert.alert("Errore", e?.message || "Impossibile eliminare la zona");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Zone del locale</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Totale zone: {totals.count} • Con prezzo: {totals.configuredPrice} • Con minimo: {totals.configuredMinimum}</Text>
        </View>

        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
          <Feather name={refreshing || loading ? "loader" : "refresh-cw"} size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.banner}>
          <Feather name="alert-triangle" size={16} color="#f59e0b" />
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Caricamento…</Text>
        </View>
      ) : zones.length === 0 ? (
        <View style={styles.center}>
          <Feather name="layers" size={28} color={theme.colors.muted} />
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Nessuna zona configurata. Crea la prima zona (es. Console Privé, Pista, Terrazza).</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
            onPress={openCreate}
          >
            <Text style={styles.primaryBtnText}>Crea zona</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={openCreate}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>Nuova zona</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: "rgba(255,255,255,0.18)" }]}
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Feather name="rotate-ccw" size={16} color="#fff" />
              <Text style={styles.secondaryBtnText}>{refreshing ? "Aggiorno…" : "Aggiorna"}</Text>
            </TouchableOpacity>
          </View>

          {zones.map((z) => (
            <View key={z.label.toLowerCase()} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.zoneTitleRow}>
                    <Feather name="map-pin" size={14} color="#a78bfa" />
                    <Text style={styles.zoneTitle}>{z.label}</Text>
                  </View>
                  <Text style={styles.zoneMeta}>Per testa: {formatMoney(z.per_testa)} • Minimo: {formatMoney(z.costo_minimo)} • Max: {z.persone_max ?? "—"}</Text>
                  {z.sourceIds.length > 1 ? (
                    <Text style={styles.zoneWarning}>Sono presenti {z.sourceIds.length} record unificati per questa zona.</Text>
                  ) : null}
                </View>

                <View style={styles.rowButtons}>
                  <TouchableOpacity onPress={() => openEdit(z)} style={styles.editBtn}>
                    <Feather name="edit-3" size={16} color={theme.colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteZone(z)} style={styles.trashBtn}>
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 14 : 0}
            style={styles.keyboardAvoid}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{editing ? "Modifica zona" : "Crea zona"}</Text>
                <TouchableOpacity
                  onPress={closeModal}
                >
                  <Feather name="x" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                <Text style={styles.helper}>Qui configuri solo zone del locale, non tavoli fisici. Esempi: Console Privé, Pista, Terrazza.</Text>

                <Field
                  label="Nome zona"
                  value={zoneName}
                  onChange={setZoneName}
                  placeholder="es. Console Privé"
                  autoCapitalize="words"
                />

                <View style={styles.row2}>
                  <Field
                    label="Costo a persona"
                    value={perTesta}
                    onChange={setPerTesta}
                    keyboardType="decimal-pad"
                    placeholder="es. 20"
                    style={{ flex: 1 }}
                  />
                  <Field
                    label="Minimo spesa"
                    value={costoMinimo}
                    onChange={setCostoMinimo}
                    keyboardType="decimal-pad"
                    placeholder="es. 200"
                    style={{ flex: 1 }}
                  />
                </View>

                <Field
                  label="Max persone"
                  value={personeMax}
                  onChange={setPersoneMax}
                  keyboardType="number-pad"
                  placeholder="es. 10"
                />

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.colors.primary }, saving && { opacity: 0.7 }]}
                  onPress={saveZone}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  ) : (
                    <Feather name="check" size={16} color="#fff" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.saveBtnText}>{saving ? "Salvo…" : editing ? "Salva zona" : "Crea zona"}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Annulla</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  style?: any;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "700" },
  iconBtn: { padding: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    marginBottom: 14,
  },
  bannerText: { color: "#f59e0b", fontSize: 12, fontWeight: "800", flex: 1 },

  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
  mutedText: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    flex: 1,
  },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  secondaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  zoneCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  zoneHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  zoneTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  zoneTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  zoneMeta: { color: "#d1d5db", fontSize: 12, fontWeight: "700", marginTop: 6 },
  zoneWarning: { color: "#fbbf24", fontSize: 11, fontWeight: "700", marginTop: 6 },

  rowButtons: { flexDirection: "row", gap: 8 },
  editBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  trashBtn: { padding: 10, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  keyboardAvoid: { width: "100%" },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    borderWidth: 1,
    maxHeight: "86%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "900" },

  helper: { color: "#d1d5db", fontSize: 12, fontWeight: "700", marginBottom: 10 },
  field: { marginBottom: 12 },
  fieldLabel: { color: "#9ca3af", fontSize: 12, fontWeight: "900", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#fff",
    fontWeight: "800",
  },
  row2: { flexDirection: "row", gap: 10 },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "900" },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  cancelBtnText: { color: "#d1d5db", fontWeight: "800" },
});
