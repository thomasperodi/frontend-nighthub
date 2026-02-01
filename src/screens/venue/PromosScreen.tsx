import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { Promo } from '../../types/events';
import { fetchPromosByEvent, fetchPromosByVenue, createPromo } from '../../services/promos';

type Props = {
  event?: { id: string; name?: string } | null;
  venueId?: string | null;
};

export default function PromosScreen({ event, venueId }: Props) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'event' | 'customers'>('event');
  const [eventPromos, setEventPromos] = useState<Promo[]>([]);
  const [venuePromos, setVenuePromos] = useState<Promo[]>([]);
  const [isLoadingPromos, setIsLoadingPromos] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'free'>('percentage');
  const [audience, setAudience] = useState<'loyal' | 'churn'>('loyal');

  const loadPromos = async () => {
    try {
      setIsLoadingPromos(true);
      if (event?.id) {
        const list = await fetchPromosByEvent(event.id);
        setEventPromos(list);
      }
      if (venueId) {
        const list = await fetchPromosByVenue(venueId);
        setVenuePromos(list);
      }
    } catch (e) {
      console.warn('loadPromos error', e);
      Alert.alert('Errore', 'Impossibile caricare le promozioni');
    } finally {
      setIsLoadingPromos(false);
    }
  };

  useEffect(() => {
    loadPromos();
  }, [event?.id, venueId]);

  const resetForm = () => {
    setTitle('');
    setDetails('');
    setDiscountValue('');
  };

  const submitEventPromo = async () => {
    if (!event?.id) return Alert.alert('Nessun evento attivo', 'Crea o seleziona un evento');
    try {
      setIsSubmitting(true);
      const created = await createPromo({
        event_id: event.id,
        title: title.trim() || 'Promo Evento',
        details: details.trim(),
        discount_type: discountType,
        discount_value: discountType === 'percentage' || discountType === 'fixed' ? Number(discountValue) || 0 : undefined,
      });
      Alert.alert('Promo', 'Promozione creata con successo');
      resetForm();
      await loadPromos();
      return created;
    } catch (e) {
      console.warn('submitEventPromo error', e);
      Alert.alert('Errore', 'Impossibile creare la promozione');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCustomerPromo = async () => {
    if (!venueId) return Alert.alert('Nessun venue', 'Impossibile creare promo clienti senza venue');
    try {
      setIsSubmitting(true);
      const created = await createPromo({
        venue_id: venueId,
        title: title.trim() || `Promo Clienti (${audience})`,
        details: `${details.trim()} | target: ${audience}`,
        discount_type: discountType,
        discount_value: discountType === 'percentage' || discountType === 'fixed' ? Number(discountValue) || 0 : undefined,
      });
      Alert.alert('Promo', 'Promozione creata con successo');
      resetForm();
      await loadPromos();
      return created;
    } catch (e) {
      console.warn('submitCustomerPromo error', e);
      Alert.alert('Errore', 'Impossibile creare la promozione');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Promozioni</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity onPress={() => setActiveTab('event')} style={[styles.tabBtn, activeTab === 'event' ? styles.tabActive : styles.tabInactive]}>
            <Feather name="tag" size={16} color={activeTab === 'event' ? 'white' : '#9ca3af'} />
            <Text style={[styles.tabText, { color: activeTab === 'event' ? 'white' : theme.colors.muted }]}>Evento</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('customers')} style={[styles.tabBtn, activeTab === 'customers' ? styles.tabActive : styles.tabInactive]}>
            <Feather name="gift" size={16} color={activeTab === 'customers' ? 'white' : '#9ca3af'} />
            <Text style={[styles.tabText, { color: activeTab === 'customers' ? 'white' : theme.colors.muted }]}>Clienti</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={[styles.label, { color: theme.colors.muted }]}>Titolo</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Es: 2x1 cocktails" placeholderTextColor={theme.colors.muted} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]} />

        <Text style={[styles.label, { color: theme.colors.muted }]}>Dettagli</Text>
        <TextInput value={details} onChangeText={setDetails} placeholder="Es: Valida fino a mezzanotte" placeholderTextColor={theme.colors.muted} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]} />

        <Text style={[styles.label, { color: theme.colors.muted }]}>Tipo sconto</Text>
        <View style={styles.row}>
          {(['percentage', 'fixed', 'free'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setDiscountType(t)} style={[styles.pill, discountType === t ? styles.pillActive : styles.pillInactive]}>
              <Text style={[styles.pillText, { color: discountType === t ? 'white' : theme.colors.muted }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {discountType !== 'free' && (
          <>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Valore sconto</Text>
            <TextInput value={discountValue} onChangeText={(t) => setDiscountValue(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={discountType === 'percentage' ? 'Es: 20' : 'Es: 5'} placeholderTextColor={theme.colors.muted} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]} />
          </>
        )}

        {activeTab === 'customers' && (
          <>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Target clienti</Text>
            <View style={styles.row}>
              {(['loyal', 'churn'] as const).map((t) => (
                <TouchableOpacity key={t} onPress={() => setAudience(t)} style={[styles.pill, audience === t ? styles.pillActive : styles.pillInactive]}>
                  <Text style={[styles.pillText, { color: audience === t ? 'white' : theme.colors.muted }]}>{t === 'loyal' ? 'Frequenta da tanto' : 'Non torna da tempo'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity onPress={activeTab === 'event' ? submitEventPromo : submitCustomerPromo} style={[styles.submitBtn, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.submitText}>Crea promo</Text>
        </TouchableOpacity>
      </View>

      {/* Lists */}
      <View style={{ paddingHorizontal: 24 }}>
        {event && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Promo evento attivo</Text>
            {eventPromos.map((p) => (
              <View key={p.id} style={styles.promoRow}>
                <Feather name="tag" size={16} color="#9ca3af" />
                <Text style={[styles.promoText, { color: theme.colors.text }]}>{p.title}</Text>
                <Text style={[styles.promoBadge, { color: '#22c55e' }]}>{p.discount_type === 'percentage' ? `${p.discount_value}%` : p.discount_type === 'fixed' ? `€${p.discount_value}` : 'FREE'}</Text>
              </View>
            ))}
            {eventPromos.length === 0 && (<Text style={[styles.emptyText, { color: theme.colors.muted }]}>Nessuna promo per l'evento</Text>)}
          </>
        )}

        {venueId && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Promo per clienti del locale</Text>
            {venuePromos.map((p) => (
              <View key={p.id} style={styles.promoRow}>
                <Feather name="gift" size={16} color="#9ca3af" />
                <Text style={[styles.promoText, { color: theme.colors.text }]}>{p.title}</Text>
                <Text style={[styles.promoBadge, { color: '#22c55e' }]}>{p.discount_type === 'percentage' ? `${p.discount_value}%` : p.discount_type === 'fixed' ? `€${p.discount_value}` : 'FREE'}</Text>
              </View>
            ))}
            {venuePromos.length === 0 && (<Text style={[styles.emptyText, { color: theme.colors.muted }]}>Nessuna promo clienti</Text>)}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  title: { fontSize: 22, fontWeight: '900' },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  tabActive: { backgroundColor: '#6D5BFF' },
  tabInactive: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tabText: { fontWeight: '700', fontSize: 12 },

  form: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16 },
  pillActive: { backgroundColor: '#6D5BFF' },
  pillInactive: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pillText: { fontWeight: '700', fontSize: 12 },

  submitBtn: { marginTop: 8, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitText: { color: 'white', fontWeight: '800', fontSize: 14 },

  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  promoText: { flex: 1, fontSize: 13, fontWeight: '700' },
  promoBadge: { fontSize: 11, fontWeight: '800' },
  emptyText: { fontSize: 12 },
});
