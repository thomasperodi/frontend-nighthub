import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet, FlatList, TextInput, Switch, Keyboard, ScrollView, KeyboardAvoidingView, Platform, ToastAndroid, Alert } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

const DEFAULT_ZONES = [
  { id: 'z1', name: 'Indoor', available: 6, seatsPerTable: 4, maxPeople: 12, minSpendPerTable: 200 },
  { id: 'z2', name: 'Outdoor', available: 4, seatsPerTable: 6, minSpendPerTable: 300 },
  { id: 'z3', name: 'VIP', available: 2, seatsPerTable: 8, maxPeople: 8, minSpendPerTable: 500 },
];

function makeTablesForZone(zoneId: string) {
  // simple mocked tables for demo purposes
  return Array.from({ length: 6 }).map((_, i) => ({ id: `${zoneId}-t${i + 1}`, name: `Tav ${i + 1}`, seats: 2 + (i % 3) }));
}

export default function TableBookingModal({ visible, onClose, event, onBooked }: any) {
  const { theme } = useTheme();
  const [zone, setZone] = useState(DEFAULT_ZONES[0]);
  const [availability, setAvailability] = useState<Record<string, number>>(Object.fromEntries(DEFAULT_ZONES.map(z => [z.id, z.available])));
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [people, setPeople] = useState<string>('');
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteExternal, setInviteExternal] = useState<boolean>(false);
  const [invitees, setInvitees] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [acceptMinSpend, setAcceptMinSpend] = useState<boolean>(false);
  const [reservationPreview, setReservationPreview] = useState<any | null>(null);
  const [lastReservation, setLastReservation] = useState<any | null>(null);
  const [bookingFinished, setBookingFinished] = useState<boolean>(false);

  const chooseZone = (z: any) => {
    setZone(z);
    setSelectedTable(null);
    setError(null);
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

    if ((zone as any).maxPeople && count > (zone as any).maxPeople) {
      setError(`Massimo ${ (zone as any).maxPeople } persone per la zona ${zone.name}.`);
      return false;
    }

    setError(null);
    return true;
  }; 

  const confirm = () => {
    setError(null);
    const seatsPerTable = zone.seatsPerTable || 4;
    const peopleCount = Number(people);
    if (!Number.isInteger(peopleCount) || peopleCount < 1) {
      setError('Inserisci almeno 1 persona.');
      return;
    }
    const neededTables = Math.ceil(peopleCount / seatsPerTable);
    const av = availability[zone.id] ?? 0;
    if (neededTables > av) {
      setError(`Non ci sono abbastanza tavoli disponibili in ${zone.name} (servono ${neededTables}, disponibili ${av}).`);
      return;
    }

    // allocate table ids (mock)
    const assignedTables = Array.from({ length: neededTables }).map((_, i) => `${zone.id}-auto-${Date.now()}-${i}`);

    // enforce minimum spend check using zone data if present
    const minSpendPerTable = (zone as any).minSpendPerTable ?? 0;
    const totalMin = minSpendPerTable * neededTables;
    if (minSpendPerTable > 0 && !acceptMinSpend) {
      setError(`Il minimo spesa per questa selezione è ${totalMin}€ (${minSpendPerTable}€/tavolo). Attiva il toggle per accettare.`);
      return;
    }

    const reservation = {
      id: `r_${Date.now()}`,
      type: 'table',
      eventId: event.id,
      eventTitle: event.title,
      zoneId: zone.id,
      zoneName: zone.name,
      tableCount: neededTables,
      assignedTables,
      seats: peopleCount,
      invitees,
      minSpendPerTable,
      totalMin,
      createdAt: new Date().toISOString(),
      qrToken: `QR_${Math.random().toString(36).slice(2, 10)}`,
      status: 'pending',
      promoAppliedId: null,
    };

    // show preview/confirmation to user before finalizing
    setReservationPreview(reservation);
  };

  const cancelPreview = () => {
    setReservationPreview(null);
  };

  const finalizeBooking = () => {
    if (!reservationPreview) return;

    // decrease availability locally
    setAvailability((prev) => ({ ...prev, [reservationPreview.zoneId]: (prev[reservationPreview.zoneId] || 0) - reservationPreview.tableCount }));

    setLastReservation(reservationPreview);
    setReservationPreview(null);
    setBookingFinished(true);

    // notify parent
    onBooked?.(reservationPreview);

    // show confirmation toast (Android) or alert (iOS)
    if (Platform.OS === 'android') {
      ToastAndroid.show('Prenotazione tavolo confermata!', ToastAndroid.SHORT);
    } else {
      Alert.alert('Prenotazione confermata', 'Il tuo tavolo è stato prenotato.');
    }
  };

  // direct confirm availability check
  const isConfirmEnabled = () => {
    const seatsPerTable = zone.seatsPerTable || 4;
    const peopleCount = Number(people);
    if (!Number.isInteger(peopleCount) || peopleCount < 1) return false;
    const neededTables = Math.ceil(peopleCount / seatsPerTable);
    const av = availability[zone.id] ?? 0;
    if (neededTables > av) return false;
    const minSpendPerTable = (zone as any).minSpendPerTable ?? 0;
    if (minSpendPerTable > 0 && !acceptMinSpend) return false;
    return true;
  };

  const finalizeDirectBooking = () => {
    if (!isConfirmEnabled()) {
      setError('Rivedi i dati: numero persone o minimo spesa non accettato.');
      return;
    }

    const seatsPerTable = zone.seatsPerTable || 4;
    const peopleCount = Number(people);
    const neededTables = Math.ceil(peopleCount / seatsPerTable);

    const assignedTables = Array.from({ length: neededTables }).map((_, i) => `${zone.id}-auto-${Date.now()}-${i}`);
    const minSpendPerTable = (zone as any).minSpendPerTable ?? 0;
    const totalMin = minSpendPerTable * neededTables;

    const reservation = {
      id: `r_${Date.now()}`,
      type: 'table',
      eventId: event.id,
      eventTitle: event.title,
      zoneId: zone.id,
      zoneName: zone.name,
      tableCount: neededTables,
      assignedTables,
      seats: peopleCount,
      invitees,
      minSpendPerTable,
      totalMin,
      createdAt: new Date().toISOString(),
      qrToken: `QR_${Math.random().toString(36).slice(2, 10)}`,
      status: 'reserved',
      promoAppliedId: null,
    };

    // decrease availability locally
    setAvailability((prev) => ({ ...prev, [zone.id]: (prev[zone.id] || 0) - neededTables }));

    setLastReservation(reservation);
    setReservationPreview(null);
    setBookingFinished(true);

    // notify parent
    onBooked?.(reservation);
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

                {/* STEP 1: Zone Selection */}
                <View style={{ marginTop: 20 }}>
                  <Text style={[{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }]}>Step 1: Scegli la zona</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
                    {DEFAULT_ZONES.map((z) => (
                      <TouchableOpacity key={z.id} onPress={() => chooseZone(z)} style={[styles.zoneBtn, { borderColor: z.id === zone.id ? theme.colors.primary : theme.colors.border, backgroundColor: z.id === zone.id ? theme.colors.primary : theme.colors.card, marginRight: 8 }]}>
                        <Text style={{ color: z.id === zone.id ? theme.colors.surface : theme.colors.text, fontWeight: '700', fontSize: 13 }}>{z.name}</Text>
                        <Text style={{ color: z.id === zone.id ? theme.colors.surface : theme.colors.muted, fontSize: 10, marginTop: 4 }}>
                          {(availability[z.id] ?? z.available)} tavoli
                        </Text>
                        {z.minSpendPerTable ? <Text style={{ color: z.id === zone.id ? theme.colors.surface : theme.colors.muted, fontSize: 9, marginTop: 2 }}>min {z.minSpendPerTable}€</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* STEP 2: People & Details */}
                <View style={{ marginTop: 20 }}>
                  <Text style={[{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }]}>Step 2: Persone e dettagli</Text>
                  
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

                  {zone.maxPeople ? <Text style={{ color: theme.colors.muted, fontSize: 11, marginBottom: 12 }}>Massimo {zone.maxPeople} persone in questa zona</Text> : null}

                  {error ? <Text style={{ color: '#ff6b6b', marginBottom: 12, fontWeight: '600' }}>⚠ {error}</Text> : null}
                </View>

                {/* STEP 3: Invitees */}
                <View style={{ marginTop: 20 }}>
                  <Text style={[{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }]}>Step 3: Invita amici (opzionale)</Text>
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

                {/* STEP 4: Min Spend */}
                {zone.minSpendPerTable ? (
                  <View style={{ marginTop: 20, backgroundColor: theme.colors.card, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: theme.colors.primary }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 13 }}>Minimo spesa: {zone.minSpendPerTable}€/tavolo</Text>
                        <Text style={{ color: theme.colors.muted, fontSize: 11, marginTop: 4 }}>È richiesto un consumo minimo a questo tavolo</Text>
                      </View>
                      <Switch value={acceptMinSpend} onValueChange={setAcceptMinSpend} trackColor={{ true: theme.colors.primary, false: theme.colors.border }} />
                    </View>
                  </View>
                ) : null}

                {/* Summary Preview */}
                {reservationPreview && (
                  <View style={{ marginTop: 20, backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12 }}>
                    <Text style={{ color: theme.colors.surface, fontWeight: '700', fontSize: 13 }}>Riepilogo prenotazione ✓</Text>
                    <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 8 }}>📍 {reservationPreview.zoneName}</Text>
                    <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 4 }}>👥 {reservationPreview.seats} persone</Text>
                    <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 4 }}>🪑 {reservationPreview.tableCount} tavolo{reservationPreview.tableCount > 1 ? 'i' : ''}</Text>
                    {reservationPreview.totalMin ? <Text style={{ color: theme.colors.surface, fontSize: 12, marginTop: 4, fontWeight: '600' }}>💰 Min spesa: {reservationPreview.totalMin}€</Text> : null}
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
                  <TouchableOpacity onPress={finalizeBooking} style={{ padding: 12, backgroundColor: theme.colors.primary, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>✓ Conferma prenotazione</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelPreview} style={{ padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.muted, fontWeight: '600' }}>Indietro</Text>
                  </TouchableOpacity>
                </View>
              ) : bookingFinished ? (
                <TouchableOpacity onPress={() => { setBookingFinished(false); onClose?.(); }} style={{ padding: 12, backgroundColor: theme.colors.primary, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>Chiudi</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity disabled={!isConfirmEnabled()} onPress={confirm} style={[{ padding: 12, backgroundColor: theme.colors.primary, borderRadius: 8, alignItems: 'center' }, !isConfirmEnabled() && { opacity: 0.5 }]}>
                    <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>Conferma prenotazione</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onClose} style={{ padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, alignItems: 'center' }}>
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
  tableRow: { 
    padding: 12, 
    borderRadius: 10, 
    borderWidth: 1 
  }
});