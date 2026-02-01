import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { CreateVenueTableInput, VenueTable } from "../../types/tables";
import {
  deleteVenueTable,
  listVenueTables,
  upsertVenueTablesBulk,
  updateVenueTable,
} from "../../services/tables";

type Props = {
  venueId?: string | null;
};

type Mode = "single" | "bulk" | "edit";

function normalizeZoneLabel(value: any): string {
  const key = (typeof value === "string" ? value : "").trim();
  return key.length ? key : "Senza zona";
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatMoney(value: any): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return `€${n.toFixed(2)}`;
}

function groupByZone(tables: VenueTable[]): Array<{ zoneLabel: string; tables: VenueTable[] }> {
  const map = new Map<string, VenueTable[]>();
  for (const t of tables) {
    const key = (t.zona || "").trim() || "Senza zona";
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }

  const zones = Array.from(map.entries()).map(([zoneLabel, zoneTables]) => {
    const sorted = [...zoneTables].sort((a, b) => {
      const an = a.numero ?? Number.POSITIVE_INFINITY;
      const bn = b.numero ?? Number.POSITIVE_INFINITY;
      if (an !== bn) return an - bn;
      return (a.nome || "").localeCompare(b.nome || "");
    });
    return { zoneLabel, tables: sorted };
  });

  zones.sort((a, b) => a.zoneLabel.localeCompare(b.zoneLabel));
  return zones;
}

export default function VenueTablesScreen({ venueId }: Props) {
  const { theme } = useTheme();

  const [tables, setTables] = useState<VenueTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("bulk");
  const [editing, setEditing] = useState<VenueTable | null>(null);

  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);

  // Single form
  const [singleNome, setSingleNome] = useState("");
  const [singleZona, setSingleZona] = useState("");
  const [singleNumero, setSingleNumero] = useState("");
  const [singlePerTesta, setSinglePerTesta] = useState("");
  const [singleMinimo, setSingleMinimo] = useState("");
  const [singleMaxPersone, setSingleMaxPersone] = useState("");

  // Bulk form
  const [bulkZona, setBulkZona] = useState("");
  const [bulkStart, setBulkStart] = useState("1");
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkPerTesta, setBulkPerTesta] = useState("");
  const [bulkMinimo, setBulkMinimo] = useState("");
  const [bulkMaxPersone, setBulkMaxPersone] = useState("");
  const [bulkOverwrite, setBulkOverwrite] = useState(false);

  const [saving, setSaving] = useState(false);

  const zoneLabels = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tables) {
      const label = normalizeZoneLabel((t as any)?.zona);
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tables]);

  const filteredTables = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const zoneKey = zoneFilter ? normalizeZoneLabel(zoneFilter) : null;

    return tables.filter((t) => {
      if (zoneKey) {
        const label = normalizeZoneLabel((t as any)?.zona);
        if (label !== zoneKey) return false;
      }

      if (!q) return true;
      const n = t.numero !== null && t.numero !== undefined ? String(t.numero) : "";
      const name = (t.nome || "").toLowerCase();
      const zone = normalizeZoneLabel((t as any)?.zona).toLowerCase();
      return name.includes(q) || zone.includes(q) || n.includes(q);
    });
  }, [tables, query, zoneFilter]);

  const zones = useMemo(() => groupByZone(filteredTables), [filteredTables]);

  const existingNumbers = useMemo(() => {
    const set = new Set<number>();
    for (const t of tables) {
      if (typeof t.numero === "number") set.add(t.numero);
    }
    return set;
  }, [tables]);

  const nextNumber = useMemo(() => {
    if (existingNumbers.size === 0) return 1;
    return Math.max(...Array.from(existingNumbers.values())) + 1;
  }, [existingNumbers]);
  const totals = useMemo(() => {
    const count = tables.length;
    const withZone = tables.filter((t) => (t.zona || "").trim().length > 0).length;
    const withNumero = tables.filter((t) => typeof t.numero === "number").length;
    return { count, withZone, withNumero };
  }, [tables]);

  const load = async () => {
    if (!venueId) {
      setError("Venue ID non trovato");
      setTables([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listVenueTables(venueId);
      setTables(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMessage = e?.response?.data?.message;
      const message = serverMessage || e?.message || "Impossibile caricare i tavoli";
      setError(status ? `${message} (${status})` : message);
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
    load();
  }, [venueId]);

  const resetModal = () => {
    setMode("bulk");
    setEditing(null);
    setSingleNome("");
    setSingleZona("");
    setSingleNumero("");
    setSinglePerTesta("");
    setSingleMinimo("");
    setSingleMaxPersone("");

    setBulkZona("");
    setBulkStart(String(nextNumber));
    setBulkCount("10");
    setBulkPerTesta("");
    setBulkMinimo("");
    setBulkMaxPersone("");
    setBulkOverwrite(false);
    setZoneFilter(null);
  };

  const openAddModal = () => {
    setEditing(null);
    setMode("bulk");
    setBulkStart(String(nextNumber));
    setBulkOverwrite(false);
    setModalOpen(true);
  };

  const openEditModal = (table: VenueTable) => {
    setEditing(table);
    setMode("edit");
    setSingleNome(String(table.nome || ""));
    setSingleZona(String(table.zona || ""));
    setSingleNumero(
      table.numero !== null && table.numero !== undefined ? String(table.numero) : "",
    );
    setSinglePerTesta(
      table.per_testa !== null && table.per_testa !== undefined ? String(table.per_testa) : "",
    );
    setSingleMinimo(
      table.costo_minimo !== null && table.costo_minimo !== undefined
        ? String(table.costo_minimo)
        : "",
    );
    setSingleMaxPersone(
      table.persone_max !== null && table.persone_max !== undefined
        ? String(table.persone_max)
        : "",
    );
    setModalOpen(true);
  };

  function parseIntOrNull(v: string): number | null {
    const n = parseInt((v || "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  }

  function parseMoneyOrNull(v: string): number | null {
    return toNumber((v || "").trim());
  }

  // Nota UX: qui gestiamo solo la configurazione dei tavoli.
  // KPI operativi (incasso/persone) sono nella sezione Prenotazioni.

  const buildSinglePayload = (): (CreateVenueTableInput & { nome: string }) | null => {
    const numero = parseIntOrNull(singleNumero);
    if (!numero || numero < 1) return null;

    const zona = singleZona.trim();
    const nomeBase = (singleNome || "").trim();
    const nome = nomeBase.length ? nomeBase : `Tavolo ${numero}`;

    const per_testa = parseMoneyOrNull(singlePerTesta);
    const costo_minimo = parseMoneyOrNull(singleMinimo);
    const persone_max = parseIntOrNull(singleMaxPersone);

    const payload: CreateVenueTableInput = {
      nome,
      zona: zona.length ? zona : undefined,
      numero,
      per_testa: per_testa ?? undefined,
      costo_minimo: costo_minimo ?? undefined,
      persone_max: persone_max ?? undefined,
    };

    return payload;
  };

  const buildBulkPayload = (): CreateVenueTableInput[] | null => {
    const start = parseIntOrNull(bulkStart);
    const count = parseIntOrNull(bulkCount);
    if (!start || start < 1) return null;
    if (!count || count < 1 || count > 200) return null;

    const zona = bulkZona.trim();
    const per_testa = parseMoneyOrNull(bulkPerTesta);
    const costo_minimo = parseMoneyOrNull(bulkMinimo);
    const persone_max = parseIntOrNull(bulkMaxPersone);

    const payload: CreateVenueTableInput[] = [];
    for (let i = 0; i < count; i++) {
      const numero = start + i;
      payload.push({
        nome: `Tavolo ${numero}`,
        zona: zona.length ? zona : undefined,
        numero,
        per_testa: per_testa ?? undefined,
        costo_minimo: costo_minimo ?? undefined,
        persone_max: persone_max ?? undefined,
      });
    }

    return payload;
  };

  const hasBulkConflicts = (start: number, count: number): boolean => {
    for (let i = 0; i < count; i++) {
      const n = start + i;
      if (existingNumbers.has(n)) return true;
    }
    return false;
  };

  const findNextFreeStart = (count: number): number => {
    let candidate = nextNumber;
    // In case there are gaps, ensure the whole range is free
    while (hasBulkConflicts(candidate, count)) candidate += 1;
    return candidate;
  };

  const onSave = async () => {
    if (!venueId) return;

    if (mode === "edit") {
      if (!editing) return;
      const nome = (singleNome || "").trim();
      const zona = singleZona.trim();
      const numero = parseIntOrNull(singleNumero);
      if (!nome) {
        Alert.alert("Dati non validi", "Il nome del tavolo è obbligatorio.");
        return;
      }

      if (!numero || numero < 1) {
        Alert.alert("Dati non validi", "Inserisci un numero tavolo valido (>= 1)."
        );
        return;
      }

      if (existingNumbers.has(numero) && numero !== editing.numero) {
        Alert.alert(
          "Numero già usato",
          `Esiste già un tavolo con numero ${numero}. Scegli un altro numero.`,
        );
        return;
      }

      try {
        setSaving(true);
        await updateVenueTable(venueId, editing.id, {
          nome,
          zona: zona.length ? zona : undefined,
          numero,
          per_testa: parseMoneyOrNull(singlePerTesta) ?? undefined,
          costo_minimo: parseMoneyOrNull(singleMinimo) ?? undefined,
          persone_max: parseIntOrNull(singleMaxPersone) ?? undefined,
        });
        const updated = await listVenueTables(venueId);
        setTables(updated);
        setModalOpen(false);
        resetModal();
        Alert.alert("Salvato", "Tavolo aggiornato");
      } catch (e: any) {
        Alert.alert("Errore", e?.message || "Impossibile aggiornare il tavolo");
      } finally {
        setSaving(false);
      }
      return;
    }

    const payload = mode === "single" ? buildSinglePayload() : buildBulkPayload();
    if (!payload) {
      Alert.alert(
        "Dati non validi",
        mode === "single"
          ? "Inserisci un numero tavolo valido (>= 1)."
          : "Controlla numero iniziale e quantità (1-200).",
      );
      return;
    }

    const tablesPayload = Array.isArray(payload) ? payload : [payload];

    // Bulk: avoid unintended overwrites due to unique(venue_id, numero)
    if (mode === "bulk") {
      const start = parseIntOrNull(bulkStart) ?? 0;
      const count = parseIntOrNull(bulkCount) ?? 0;
      if (start > 0 && count > 0) {
        const conflicts = hasBulkConflicts(start, count);
        if (conflicts && !bulkOverwrite) {
          const suggested = findNextFreeStart(count);
          Alert.alert(
            "Numeri già esistenti",
            `Alcuni numeri in ${start}→${start + count - 1} esistono già e verrebbero aggiornati (es. cambiando zona).\n\nVuoi spostare automaticamente l'inizio a ${suggested} oppure sovrascrivere?`,
            [
              { text: "Annulla", style: "cancel" },
              {
                text: `Sposta a ${suggested}`,
                onPress: () => setBulkStart(String(suggested)),
              },
              {
                text: "Sovrascrivi",
                style: "destructive",
                onPress: () => setBulkOverwrite(true),
              },
            ],
          );
          return;
        }
      }
    }

    try {
      setSaving(true);
      setError(null);
      const updated = await upsertVenueTablesBulk(venueId, tablesPayload);
      setTables(updated);
      setModalOpen(false);
      resetModal();
      Alert.alert("Salvato", `Tavoli aggiornati: ${tablesPayload.length}`);
    } catch (e: any) {
      Alert.alert("Errore", e?.message || "Impossibile salvare i tavoli");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (table: VenueTable) => {
    if (!venueId) return;

    Alert.alert(
      "Eliminare tavolo?",
      `${table.nome}${table.numero ? ` (N° ${table.numero})` : ""}`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteVenueTable(venueId, table.id);
              setTables((prev) => prev.filter((t) => t.id !== table.id));
            } catch (e: any) {
              Alert.alert("Errore", e?.message || "Impossibile eliminare il tavolo");
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
          <Text style={[styles.title, { color: theme.colors.text }]}>Tavoli</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Totale: {totals.count} • Numerati: {totals.withNumero} • Con zona: {totals.withZone}</Text>
        </View>

        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
          <Feather name="refresh-cw" size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.banner}>
          <Feather name="alert-triangle" size={16} color="#f59e0b" />
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {loading && tables.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Caricamento…</Text>
        </View>
      ) : tables.length === 0 ? (
        <View style={styles.center}>
          <Feather name="grid" size={28} color={theme.colors.muted} />
          <Text style={[styles.mutedText, { color: theme.colors.muted }]}>Nessun tavolo salvato. Aggiungili per velocizzare le prenotazioni.</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
            onPress={openAddModal}
          >
            <Text style={styles.primaryBtnText}>Aggiungi tavoli</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {zoneLabels.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.zoneChipsRow}
            >
              <TouchableOpacity
                onPress={() => setZoneFilter(null)}
                style={[
                  styles.zoneChip,
                  !zoneFilter && styles.zoneChipActive,
                  { borderColor: theme.colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.zoneChipText,
                    { color: !zoneFilter ? "#fff" : theme.colors.text },
                  ]}
                >
                  Tutte ({tables.length})
                </Text>
              </TouchableOpacity>

              {zoneLabels.map((z) => {
                const active = normalizeZoneLabel(zoneFilter) === z.label;
                return (
                  <TouchableOpacity
                    key={z.label}
                    onPress={() => setZoneFilter(z.label)}
                    style={[
                      styles.zoneChip,
                      active && styles.zoneChipActive,
                      { borderColor: theme.colors.border },
                    ]}
                  >
                    <Text style={[styles.zoneChipText, { color: active ? "#fff" : theme.colors.text }]}>
                      {z.label} ({z.count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={theme.colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cerca per numero, nome o zona"
              placeholderTextColor={theme.colors.muted}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery("")}
                style={styles.clearBtn}
              >
                <Feather name="x" size={16} color={theme.colors.text} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={openAddModal}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>Aggiungi</Text>
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
            <View key={z.zoneLabel} style={styles.zoneBlock}>
              <View style={styles.zoneHeader}>
                <Text style={styles.zoneTitle}>{z.zoneLabel}</Text>
                <Text style={styles.zoneCount}>{z.tables.length} tavoli</Text>
              </View>

              {z.tables.map((t) => (
                <View key={t.id} style={styles.tableRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tableName}>
                      {t.numero ? `#${t.numero} ` : ""}{t.nome}
                    </Text>
                    <Text style={styles.tableMeta}>
                      Per testa: {formatMoney(t.per_testa)} • Min: {formatMoney(t.costo_minimo)} • Max: {t.persone_max ?? "—"}
                    </Text>
                  </View>

                  <View style={styles.rowButtons}>
                    <TouchableOpacity onPress={() => openEditModal(t)} style={styles.editBtn}>
                      <Feather name="edit-3" size={16} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(t)} style={styles.trashBtn}>
                      <Feather name="trash-2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {mode === "edit" ? "Modifica tavolo" : "Aggiungi tavoli"}
              </Text>
              <TouchableOpacity onPress={() => { setModalOpen(false); resetModal(); }}>
                <Feather name="x" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {mode !== "edit" ? (
              <View style={styles.modeRow}>
                <TouchableOpacity
                  onPress={() => setMode("bulk")}
                  style={[styles.modeChip, mode === "bulk" && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, mode === "bulk" && styles.modeChipTextActive]}>Rapido</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMode("single")}
                  style={[styles.modeChip, mode === "single" && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, mode === "single" && styles.modeChipTextActive]}>Singolo</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {mode === "bulk" ? (
                <>
                  <Text style={styles.helper}>Crea tanti tavoli numerati in pochi secondi (es. 1→30) e li salva nel DB.</Text>

                  <View style={styles.notice}>
                    <Feather name="info" size={14} color={theme.colors.muted} />
                    <Text style={[styles.noticeText, { color: theme.colors.muted }]}>I numeri devono essere unici nel locale. Di default “Rapido” parte dal prossimo numero libero ({nextNumber}).</Text>
                  </View>

                  <Field label="Zona (opzionale)" value={bulkZona} onChange={setBulkZona} placeholder="Privé / Sala / Terrazza…" />

                  <View style={styles.row2}>
                    <Field
                      label="Numero iniziale"
                      value={bulkStart}
                      onChange={setBulkStart}
                      keyboardType="number-pad"
                      placeholder="1"
                      style={{ flex: 1 }}
                    />
                    <Field
                      label="Quanti"
                      value={bulkCount}
                      onChange={setBulkCount}
                      keyboardType="number-pad"
                      placeholder="10"
                      style={{ flex: 1 }}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => setBulkOverwrite((p) => !p)}
                    style={[styles.toggleRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                  >
                    <View style={[styles.toggleDot, { backgroundColor: bulkOverwrite ? theme.colors.primary : "transparent", borderColor: theme.colors.border }]} />
                    <Text style={[styles.toggleText, { color: theme.colors.text }]}>Sovrascrivi numeri esistenti</Text>
                    <Text style={[styles.toggleHint, { color: theme.colors.muted }]}>Off = aggiunta sicura</Text>
                  </TouchableOpacity>

                  <View style={styles.row2}>
                    <Field
                      label="Costo a persona"
                      value={bulkPerTesta}
                      onChange={setBulkPerTesta}
                      keyboardType="decimal-pad"
                      placeholder="es. 20"
                      style={{ flex: 1 }}
                    />
                    <Field
                      label="Minimo spesa (opz.)"
                      value={bulkMinimo}
                      onChange={setBulkMinimo}
                      keyboardType="decimal-pad"
                      placeholder="es. 200"
                      style={{ flex: 1 }}
                    />
                  </View>

                  <Field
                    label="Max persone (opzionale)"
                    value={bulkMaxPersone}
                    onChange={setBulkMaxPersone}
                    keyboardType="number-pad"
                    placeholder="es. 10"
                  />

                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>Anteprima</Text>
                    <Text style={styles.previewText}>
                      {(() => {
                        const start = parseIntOrNull(bulkStart) ?? 0;
                        const count = parseIntOrNull(bulkCount) ?? 0;
                        const end = start && count ? start + count - 1 : 0;
                        const zoneLabel = bulkZona.trim() || "Senza zona";
                        return `Zona: ${zoneLabel} • Tavoli: ${start || "?"} → ${end || "?"}`;
                      })()}
                    </Text>
                    <Text style={styles.previewText}>I valori di prezzo/capienza servono per le Prenotazioni.</Text>
                  </View>
                </>
              ) : mode === "single" ? (
                <>
                  <Text style={styles.helper}>Aggiungi (o aggiorna) un singolo tavolo per numero.</Text>

                  <Field label="Zona (opzionale)" value={singleZona} onChange={setSingleZona} placeholder="Privé / Sala…" />

                  <View style={styles.row2}>
                    <Field
                      label="Numero tavolo"
                      value={singleNumero}
                      onChange={setSingleNumero}
                      keyboardType="number-pad"
                      placeholder="es. 12"
                      style={{ flex: 1 }}
                    />
                    <Field
                      label="Max persone (opz.)"
                      value={singleMaxPersone}
                      onChange={setSingleMaxPersone}
                      keyboardType="number-pad"
                      placeholder="es. 10"
                      style={{ flex: 1 }}
                    />
                  </View>

                  <View style={styles.row2}>
                    <Field
                      label="Costo a persona"
                      value={singlePerTesta}
                      onChange={setSinglePerTesta}
                      keyboardType="decimal-pad"
                      placeholder="es. 20"
                      style={{ flex: 1 }}
                    />
                    <Field
                      label="Minimo spesa (opz.)"
                      value={singleMinimo}
                      onChange={setSingleMinimo}
                      keyboardType="decimal-pad"
                      placeholder="es. 200"
                      style={{ flex: 1 }}
                    />
                  </View>

                  <Field
                    label="Nome (opzionale)"
                    value={singleNome}
                    onChange={setSingleNome}
                    placeholder="Se vuoto: Tavolo {numero}"
                  />

                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>Suggerimento</Text>
                    <Text style={styles.previewText}>
                      Imposta per-testa e/o minimo per velocizzare i calcoli in Prenotazioni.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.helper}>Modifica i dati del tavolo e salva.</Text>

                  <Field label="Nome" value={singleNome} onChange={setSingleNome} placeholder="Nome tavolo" />
                  <Field label="Zona (opzionale)" value={singleZona} onChange={setSingleZona} placeholder="Privé / Sala…" />

                  <View style={styles.row2}>
                    <Field
                      label="Numero tavolo"
                      value={singleNumero}
                      onChange={setSingleNumero}
                      keyboardType="number-pad"
                      placeholder="es. 12"
                      style={{ flex: 1 }}
                    />
                    <Field
                      label="Max persone (opz.)"
                      value={singleMaxPersone}
                      onChange={setSingleMaxPersone}
                      keyboardType="number-pad"
                      placeholder="es. 10"
                      style={{ flex: 1 }}
                    />
                  </View>

                  <View style={styles.row2}>
                    <Field
                      label="Costo a persona"
                      value={singlePerTesta}
                      onChange={setSinglePerTesta}
                      keyboardType="decimal-pad"
                      placeholder="es. 20"
                      style={{ flex: 1 }}
                    />
                    <Field
                      label="Minimo spesa (opz.)"
                      value={singleMinimo}
                      onChange={setSingleMinimo}
                      keyboardType="decimal-pad"
                      placeholder="es. 200"
                      style={{ flex: 1 }}
                    />
                  </View>

                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>Suggerimento</Text>
                    <Text style={styles.previewText}>
                      Se aggiorni prezzi/capienza, l'effetto si vede nelle Prenotazioni.
                    </Text>
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }, saving && { opacity: 0.7 }]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} /> : <Feather name="check" size={16} color="#fff" style={{ marginRight: 8 }} />}
                <Text style={styles.saveBtnText}>{saving ? "Salvo…" : mode === "edit" ? "Salva modifiche" : "Salva"}</Text>
              </TouchableOpacity>

              <Text style={styles.smallNote}>Tip: la modalità “Rapido” è pensata per inserire tutti i tavoli del locale in 30 secondi.</Text>
            </ScrollView>
          </View>
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
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
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

  kpiGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  kpiValue: { fontSize: 18, fontWeight: "900" },
  kpiLabel: { fontSize: 12, fontWeight: "900", marginTop: 4 },
  kpiHint: { fontSize: 11, fontWeight: "700", marginTop: 4, opacity: 0.9 },

  zoneChipsRow: {
    paddingBottom: 10,
    gap: 8,
  },
  zoneChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  zoneChipActive: {
    backgroundColor: "rgba(109,91,255,0.35)",
    borderColor: "rgba(109,91,255,0.55)",
  },
  zoneChipText: { fontWeight: "900" },

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

  zoneBlock: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  zoneHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  zoneTitle: { color: "#fff", fontSize: 14, fontWeight: "900" },
  zoneCount: { color: "#9ca3af", fontSize: 12, fontWeight: "800" },

  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  tableName: { color: "#fff", fontSize: 13, fontWeight: "900" },
  tableMeta: { color: "#d1d5db", fontSize: 12, fontWeight: "600", marginTop: 4 },
  trashBtn: { padding: 10, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    borderWidth: 1,
    maxHeight: "88%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "900" },

  modeRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
  },
  modeChipActive: { backgroundColor: "rgba(109,91,255,0.20)", borderColor: "rgba(109,91,255,0.45)" },
  modeChipText: { color: "#d1d5db", fontWeight: "900" },
  modeChipTextActive: { color: "#fff" },

  helper: { color: "#d1d5db", fontSize: 12, fontWeight: "700", marginBottom: 10 },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 12,
  },
  noticeText: { fontSize: 12, fontWeight: "700", flex: 1 },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  toggleDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  toggleText: { fontWeight: "900", flex: 1 },
  toggleHint: { fontWeight: "800", fontSize: 11 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontWeight: "800" },
  clearBtn: { padding: 6, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)" },

  rowButtons: { flexDirection: "row", gap: 8 },
  editBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

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

  previewBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginTop: 4,
    marginBottom: 14,
  },
  previewTitle: { color: "#fff", fontWeight: "900", marginBottom: 4 },
  previewText: { color: "#d1d5db", fontWeight: "700" },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 6,
  },
  saveBtnText: { color: "#fff", fontWeight: "900" },

  smallNote: { color: "#9ca3af", fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 10 },
});
