import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  Switch,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { listVenueTables } from "../services/tables";
import type { VenueTable } from "../types/tables";
import { fetchBookedTableIdsByEvent } from "../services/reservations";

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function zoneLabel(zona?: string | null): string {
  const trimmed = (zona ?? '').trim();
  return trimmed.length ? trimmed : 'Senza zona';
}

export default function TableBookingModal({ visible, onClose, event, onBooked }: any) {
  const { theme } = useTheme();
  const [loadingTables, setLoadingTables] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [bookedTableIds, setBookedTableIds] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<VenueTable | null>(null);
  const [people, setPeople] = useState<string>('');
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteExternal, setInviteExternal] = useState<boolean>(false);
  const [invitees, setInvitees] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [acceptMinSpend, setAcceptMinSpend] = useState<boolean>(false);
  const [reservationPreview, setReservationPreview] = useState<any | null>(null);
  const [lastReservation, setLastReservation] = useState<any | null>(null);
  const [bookingFinished, setBookingFinished] = useState<boolean>(false);

  const venueId: string | undefined =
    event?.venue_id ?? event?.venue?.id ?? event?.venueId ?? undefined;

  const eventId: string | undefined = event?.id ?? event?.event_id ?? undefined;

  const bookedSet = useMemo(() => new Set(bookedTableIds), [bookedTableIds]);

  const isTableAvailableNow = async (tableId: string): Promise<boolean> => {
    if (!eventId) return false;
    try {
      const bookedIds = await fetchBookedTableIdsByEvent(eventId);
      const booked = new Set(Array.isArray(bookedIds) ? bookedIds : []);
      return !booked.has(tableId);
    } catch {
      // In caso di errore rete, blocco la prenotazione per evitare overbooking.
      return false;
    }
  };

  const zones = useMemo(() => {
    const uniq = new Set<string>();
    for (const t of tables) uniq.add(zoneLabel(t.zona));
    return Array.from(uniq).sort((a, b) => a.localeCompare(b));
  }, [tables]);

  const tablesByZone = useMemo(() => {
    const map = new Map<string, VenueTable[]>();
    for (const t of tables) {
      const z = zoneLabel(t.zona);
      const list = map.get(z) ?? [];
      list.push(t);
      map.set(z, list);
    }
    for (const [z, list] of map.entries()) {
      list.sort((a, b) => {
        const an = a.numero ?? 999999;
        const bn = b.numero ?? 999999;
        if (an !== bn) return an - bn;
        return (a.nome ?? '').localeCompare(b.nome ?? '');
      });
      map.set(z, list);
    }
    return map;
  }, [tables]);

  const visibleTables = useMemo(() => {
    const z = selectedZone || zones[0] || '';
    if (!z) return [];
    return tablesByZone.get(z) ?? [];
  }, [selectedZone, zones, tablesByZone]);

  const reloadAvailability = async () => {
    if (!venueId) {
      setTables([]);
      setBookedTableIds([]);
      setSelectedZone('');
      setError('Evento senza venue_id: impossibile caricare i tavoli.');
      return;
    }

    if (!eventId) {
      setTables([]);
      setBookedTableIds([]);
      setSelectedZone('');
      setError('Evento non valido: manca event_id.');
      return;
    }

    try {
      setLoadingTables(true);
      setError(null);

      const [tablesRes, reservationsRes] = await Promise.allSettled([
        listVenueTables(venueId),
        fetchBookedTableIdsByEvent(eventId),
      ]);

      const allTables: VenueTable[] =
        tablesRes.status === 'fulfilled' && Array.isArray(tablesRes.value) ? tablesRes.value : [];

      const booked: string[] =
        reservationsRes.status === 'fulfilled' && Array.isArray(reservationsRes.value) ? reservationsRes.value : [];
      const bookedIdSet = new Set(booked);
      const availableTables = allTables.filter((t) => !bookedIdSet.has(t.id));

      setBookedTableIds(booked);
      setTables(availableTables);

      // Se il tavolo selezionato diventa non disponibile, lo deseleziono.
      if (selectedTable && bookedIdSet.has(selectedTable.id)) {
        setSelectedTable(null);
        setAcceptMinSpend(false);
      }

      const z0 = zoneLabel(availableTables?.[0]?.zona ?? null);
      setSelectedZone((prev) => prev || z0);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Errore nel caricamento tavoli';
      setError(status ? `${msg} (${status})` : msg);
      setTables([]);
      setBookedTableIds([]);
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    if (!visible) return;

    // reset UI when opening
    setError(null);
    setReservationPreview(null);
    setBookingFinished(false);
    setLastReservation(null);
    setSelectedTable(null);
    setAcceptMinSpend(false);
    setSubmitting(false);
    setBookedTableIds([]);

    void reloadAvailability();
  }, [visible, venueId, eventId]);

  const chooseZone = (z: string) => {
    setSelectedZone(z);
    setSelectedTable(null);
    setError(null);
    setAcceptMinSpend(false);
  };

  const addInvite = () => {
    if (!inviteName.trim()) return;
    setInvitees((s) => [...s, { name: inviteName.trim(), external: inviteExternal }]);
    setInviteName('');
    setInviteExternal(false);
  };

  const removeInvite = (idx:number) => setInvitees((s) => s.filter((_,i) => i!==idx));

  const validatePeople = () => {
    Keyboard.dismiss();
    const count = Number(people);
    if (!Number.isInteger(count) || count < 1) {
      setError('Inserisci almeno 1 persona.');
      return false;
    }

    if (selectedTable?.persone_max && count > selectedTable.persone_max) {
      setError(`Massimo ${selectedTable.persone_max} persone per questo tavolo.`);
      return false;
    }

    setError(null);
    return true;
  }; 

  const confirm = () => {
    setError(null);
    const peopleCount = Number(people);
    if (!Number.isInteger(peopleCount) || peopleCount < 1) {
      setError('Inserisci almeno 1 persona.');
      return;
    }

    if (!selectedTable) {
      setError('Seleziona un tavolo per continuare.');
      return;
    }

    if (bookedSet.has(selectedTable.id)) {
      setError('Questo tavolo è già prenotato per questa serata. Selezionane un altro.');
      void reloadAvailability();
      return;
    }

    if (selectedTable.persone_max && peopleCount > selectedTable.persone_max) {
      setError(`Massimo ${selectedTable.persone_max} persone per questo tavolo.`);
      return;
    }

    const minSpend = asNumber(selectedTable.costo_minimo) ?? 0;
    if (minSpend > 0 && !acceptMinSpend) {
      setError(`Il minimo spesa per questo tavolo è ${minSpend}€. Attiva il toggle per accettare.`);
      return;
    }

    const perTesta = asNumber(selectedTable.per_testa);
    const totalAmount = perTesta !== null ? perTesta * peopleCount : undefined;

    const labelNumero = selectedTable.numero ? `Tavolo ${selectedTable.numero}` : selectedTable.nome;
    const z = zoneLabel(selectedTable.zona);

    const reservation = {
      type: 'table',
      event_id: event?.id ?? event?.event_id,
      guests: peopleCount,
      venue_table_id: selectedTable.id,
      status: 'pending',
      total_amount: totalAmount,
      meta: {
        zona: z,
        table_label: labelNumero,
        numero: selectedTable.numero ?? null,
        per_testa: perTesta,
        costo_minimo: minSpend || null,
      },
      invitees,
    };

    // show preview/confirmation to user before finalizing
    setReservationPreview(reservation);
  };

  const cancelPreview = () => {
    setReservationPreview(null);
  };

  const finalizeBooking = async () => {
    if (!reservationPreview || submitting) return;
    if (!reservationPreview.event_id) {
      setError('Evento non valido: manca event_id.');
      return;
    }

    const tableId: string | undefined = reservationPreview?.venue_table_id;
    if (tableId) {
      const ok = await isTableAvailableNow(tableId);
      if (!ok) {
        setError('Questo tavolo è già prenotato per questa serata. Selezionane un altro.');
        await reloadAvailability();
        setReservationPreview(null);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      // notify parent and wait for persistence
      await Promise.resolve(onBooked?.(reservationPreview));

      setLastReservation(reservationPreview);
      setReservationPreview(null);
      setBookingFinished(true);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Errore nella prenotazione';
      setError(status ? `${msg} (${status})` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  // direct confirm availability check
  const isConfirmEnabled = () => {
    const peopleCount = Number(people);
    if (!Number.isInteger(peopleCount) || peopleCount < 1) return false;

    if (!selectedTable) return false;
    if (selectedTable.persone_max && peopleCount > selectedTable.persone_max) return false;

    const minSpend = asNumber(selectedTable.costo_minimo) ?? 0;
    if (minSpend > 0 && !acceptMinSpend) return false;
    return true;
  };

  const finalizeDirectBooking = async () => {
    if (!isConfirmEnabled()) {
      setError('Rivedi i dati: numero persone o minimo spesa non accettato.');
      return;
    }
    if (submitting) return;
    const peopleCount = Number(people);

    if (!selectedTable) {
      setError('Seleziona un tavolo.');
      return;
    }

    if (bookedSet.has(selectedTable.id)) {
      setError('Questo tavolo è già prenotato per questa serata. Selezionane un altro.');
      await reloadAvailability();
      return;
    }

    // Ultimo check prima di inviare (evita overbooking in caso di concorrenza)
    const ok = await isTableAvailableNow(selectedTable.id);
    if (!ok) {
      setError('Questo tavolo è già prenotato per questa serata. Selezionane un altro.');
      await reloadAvailability();
      return;
    }

    const minSpend = asNumber(selectedTable.costo_minimo) ?? 0;
    const perTesta = asNumber(selectedTable.per_testa);
    const totalAmount = perTesta !== null ? perTesta * peopleCount : undefined;

    const labelNumero = selectedTable.numero ? `Tavolo ${selectedTable.numero}` : selectedTable.nome;
    const z = zoneLabel(selectedTable.zona);

    const reservation = {
      type: 'table',
      event_id: event?.id ?? event?.event_id,
      guests: peopleCount,
      venue_table_id: selectedTable.id,
      status: 'confirmed',
      total_amount: totalAmount,
      meta: {
        zona: z,
        table_label: labelNumero,
        numero: selectedTable.numero ?? null,
        per_testa: perTesta,
        costo_minimo: minSpend || null,
      },
      invitees,
    };

    if (!reservation.event_id) {
      setError('Evento non valido: manca event_id.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await Promise.resolve(onBooked?.(reservation));

      setLastReservation(reservation);
      setReservationPreview(null);
      setBookingFinished(true);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Errore nella prenotazione';
      setError(status ? `${msg} (${status})` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <Pressable style={{ flex: 1 }} onPress={() => { Keyboard.dismiss(); onClose?.(); }} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]} onStartShouldSetResponder={() => true }>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled" scrollEnabled={true}>
                <View style={styles.headerRow}>
                  <TouchableOpacity onPress={() => onClose?.()} style={{ padding: 8, marginLeft: -8 }}>
                    <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
                  <Text style={[styles.title, { color: theme.colors.text }]}>Prenota un tavolo</Text>
                  <View style={{ width: 40 }} />
                </View>

                {loadingTables ? (
                  <View style={{ paddingVertical: 18, alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.muted, fontWeight: '700' }}>Caricamento tavoli…</Text>
                  </View>
                ) : null}

                {!loadingTables && !venueId ? (
                  <Text style={{ color: '#ff6b6b', fontWeight: '700', marginTop: 10 }}>
                    ⚠ Evento senza venue: impossibile prenotare tavoli.
                  </Text>
                ) : null}

                {!loadingTables && venueId && eventId && tables.length === 0 ? (
                  <Text style={{ color: theme.colors.muted, fontWeight: '700', marginTop: 10 }}>
                    Nessun tavolo disponibile per questa serata.
                  </Text>
                ) : null}

                {!loadingTables && venueId && eventId && bookedTableIds.length > 0 ? (
                  <Text style={{ color: theme.colors.muted, fontSize: 11, marginTop: 6, fontWeight: '700' }}>
                    Tavoli già prenotati: {bookedTableIds.length}
                  </Text>
                ) : null}

                {/* STEP 1: Zone Selection */}
                <View style={{ marginTop: 20 }}>
                  <Text style={[{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }]}>Step 1: Scegli la zona</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
                    {zones.map((z) => {
                      const active = z === (selectedZone || zones[0]);
                      const count = (tablesByZone.get(z)?.length ?? 0);
                      if (count === 0) return null;
                      return (
                        <TouchableOpacity
                          key={z}
                          onPress={() => chooseZone(z)}
                          style={[
                            styles.zoneBtn,
                            {
                              borderColor: active ? theme.colors.primary : theme.colors.border,
                              backgroundColor: active ? theme.colors.primary : theme.colors.card,
                              marginRight: 8,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? theme.colors.surface : theme.colors.text,
                              fontWeight: '800',
                              fontSize: 13,
                            }}
                          >
                            {z}
                          </Text>
                          <Text style={{ color: active ? theme.colors.surface : theme.colors.muted, fontSize: 10, marginTop: 4 }}>
                            {count} tavoli
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* STEP 2: Table Selection */}
                <View style={{ marginTop: 16 }}>
                  <Text style={[{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }]}>Step 2: Scegli il tavolo</Text>
                  <FlatList
                    data={visibleTables}
                    keyExtractor={(t) => t.id}
                    scrollEnabled={false}
                    renderItem={({ item: t }) => {
                      const active = selectedTable?.id === t.id;
                      const perTesta = asNumber(t.per_testa);
                      const minSpend = asNumber(t.costo_minimo);
                      return (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedTable(t);
                            setError(null);
                            setAcceptMinSpend(false);
                          }}
                          style={[
                            styles.tableCard,
                            {
                              borderColor: active ? theme.colors.primary : theme.colors.border,
                              backgroundColor: theme.colors.card,
                            },
                          ]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 14 }}>
                              {t.numero ? `Tavolo ${t.numero}` : t.nome}
                            </Text>
                            {active ? (
                              <Text style={{ color: theme.colors.primary, fontWeight: '900' }}>Selezionato</Text>
                            ) : null}
                          </View>

                          <View style={{ height: 6 }} />
                          <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                            {t.nome}
                            {t.persone_max ? ` • max ${t.persone_max} persone` : ''}
                          </Text>

                          {(perTesta !== null || minSpend !== null) ? (
                            <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 4 }}>
                              {perTesta !== null ? `€ ${perTesta} / persona` : ''}
                              {perTesta !== null && minSpend !== null ? ' • ' : ''}
                              {minSpend !== null ? `minimo € ${minSpend}` : ''}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>

                {/* STEP 3: People & Details */}
                <View style={{ marginTop: 20 }}>
                  <Text style={[{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }]}>Step 3: Persone e dettagli</Text>
                  
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: theme.colors.muted, fontSize: 12, marginBottom: 6 }}>Numero di persone</Text>
                    <TextInput
                      keyboardType="number-pad"
                      value={people}
                      onChangeText={(t) => setPeople(t.replace(/\D/g, ''))}
                      style={{ borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 8, padding: 12, color: theme.colors.text, fontSize: 16 }}
                      placeholder="Es: 4"
                      placeholderTextColor={theme.colors.muted}
                      onSubmitEditing={() => Keyboard.dismiss()}
                      onEndEditing={() => validatePeople()}
                      blurOnSubmit={true}
                      selectionColor={theme.colors.primary}
                    />
                  </View>

                  {selectedTable?.persone_max ? (
                    <Text style={{ color: theme.colors.muted, fontSize: 11, marginBottom: 12 }}>
                      Massimo {selectedTable.persone_max} persone per questo tavolo
                    </Text>
                  ) : null}

                  {selectedTable && (asNumber(selectedTable.costo_minimo) ?? 0) > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                        Accetto minimo spesa (€ {asNumber(selectedTable.costo_minimo)})
                      </Text>
                      <Switch value={acceptMinSpend} onValueChange={setAcceptMinSpend} />
                    </View>
                  ) : null}

                  {error ? <Text style={{ color: '#ff6b6b', marginBottom: 12, fontWeight: '600' }}>⚠ {error}</Text> : null}
                </View>

                {/* STEP 4: Invitees */}
                <View style={{ marginTop: 20 }}>
                  <Text style={[{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }]}>Step 4: Invita amici (opzionale)</Text>
                  <View style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', gap: 8 }}>
                    <TextInput 
                      placeholder="username o telefono" 
                      placeholderTextColor={theme.colors.muted} 
                      value={inviteName} 
                      onChangeText={setInviteName} 
                      style={{ flex: 1, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 8, padding: 10, color: theme.colors.text, fontSize: 14 }} 
                    />
                    <TouchableOpacity onPress={addInvite} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: theme.colors.primary, borderRadius: 8 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 13 }}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: theme.colors.card, borderRadius: 6, marginBottom: 12 }}>
                    <Text style={{ color: theme.colors.muted, fontSize: 11 }}>Utente esterno</Text>
                    <Switch value={inviteExternal} onValueChange={setInviteExternal} trackColor={{ true: theme.colors.primary, false: theme.colors.border }} />
                  </View>

                  {invitees.length > 0 ? (
                    <View style={{ backgroundColor: theme.colors.card, borderRadius: 8, padding: 10, marginBottom: 12 }}>
                      {invitees.map((inv, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: idx < invitees.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                          <View>
                            <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 13 }}>{inv.name}</Text>
                            <Text style={{ color: theme.colors.muted, fontSize: 10 }}>{inv.external ? 'Esterno' : 'Registrato'}</Text>
                          </View>
                          <TouchableOpacity onPress={() => removeInvite(idx)}><Text style={{ color: theme.colors.primary, fontWeight: '600' }}>✕</Text></TouchableOpacity>
                        </View>
                      ))}
                      <Text style={{ color: theme.colors.muted, fontSize: 10, marginTop: 8 }}>Totale invitati: {invitees.length}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Summary Preview */}
                {reservationPreview && (
                  <View style={{ marginTop: 20, backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12 }}>
                    <Text style={{ color: theme.colors.surface, fontWeight: '700', fontSize: 13 }}>Riepilogo prenotazione ✓</Text>
                    <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 8 }}>📍 {reservationPreview.meta?.zona ?? '-'}</Text>
                    <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 4 }}>🪑 {reservationPreview.meta?.table_label ?? '-'}</Text>
                    <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 4 }}>👥 {reservationPreview.guests} persone</Text>
                    {typeof reservationPreview.meta?.per_testa === 'number' ? (
                      <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 4 }}>
                        💶 € {reservationPreview.meta.per_testa} / persona
                      </Text>
                    ) : null}
                    {reservationPreview.meta?.costo_minimo ? (
                      <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 4, fontWeight: '700' }}>
                        💰 Minimo: € {reservationPreview.meta.costo_minimo}
                      </Text>
                    ) : null}
                    {typeof reservationPreview.total_amount === 'number' ? (
                      <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 4, fontWeight: '700' }}>
                        Totale stimato: € {reservationPreview.total_amount}
                      </Text>
                    ) : null}
                  </View>
                )}

                {/* Success Message */}
                {bookingFinished && !reservationPreview && (
                  <View style={{ marginTop: 20, backgroundColor: '#10b981', borderRadius: 8, padding: 12, alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>✓ Prenotazione confermata!</Text>
                    <Text style={{ color: 'white', fontSize: 11, marginTop: 6 }}>La tua prenotazione è stata salvata</Text>
                  </View>
                )}
            </ScrollView>

            <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12, paddingHorizontal: 4, gap: 8 }}>
              {reservationPreview ? (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    disabled={submitting}
                    onPress={finalizeBooking}
                    style={[
                      { padding: 12, backgroundColor: theme.colors.primary, borderRadius: 8, alignItems: 'center' },
                      submitting && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                      {submitting ? 'Salvataggio…' : '✓ Conferma prenotazione'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={submitting}
                    onPress={cancelPreview}
                    style={[
                      { padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, alignItems: 'center' },
                      submitting && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={{ color: theme.colors.muted, fontWeight: '600' }}>Indietro</Text>
                  </TouchableOpacity>
                </View>
              ) : bookingFinished ? (
                <TouchableOpacity onPress={() => { setBookingFinished(false); onClose?.(); }} style={{ padding: 12, backgroundColor: theme.colors.primary, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>Chiudi</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    disabled={!isConfirmEnabled() || submitting}
                    onPress={confirm}
                    style={[
                      { padding: 12, backgroundColor: theme.colors.primary, borderRadius: 8, alignItems: 'center' },
                      (!isConfirmEnabled() || submitting) && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>Conferma prenotazione</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={submitting}
                    onPress={onClose}
                    style={[
                      { padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, alignItems: 'center' },
                      submitting && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={{ color: theme.colors.muted, fontWeight: '600' }}>Annulla</Text>
                  </TouchableOpacity>
                </View>
              )} 
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal> 
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  sheet: { 
    padding: 18, 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16, 
    maxHeight: '90%',
    minHeight: 200
  },
  title: { 
    fontSize: 18, 
    fontWeight: '800' 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 12 
  },
  zoneBtn: { 
    padding: 12, 
    borderRadius: 10, 
    borderWidth: 2, 
    marginRight: 8, 
    alignItems: 'flex-start', 
    minWidth: 100 
  },
  tableCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
});