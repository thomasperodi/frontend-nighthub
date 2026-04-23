import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { Event, Promo } from '../../types/events';
import { fetchPromosByEvent, fetchPromosByVenue, createPromo } from '../../services/promos';
import { fetchEventsByVenue } from '../../services/events';

type Props = {
  event?: { id: string; name?: string } | null;
  venueId?: string | null;
};

type DiscountType = 'percentage' | 'fixed' | 'free';
type CustomerSegment = 'specific' | 'new' | 'loyal' | 'churn';

const DISCOUNT_LABELS: Record<DiscountType, string> = {
  percentage: 'Percentuale',
  fixed: 'Importo fisso',
  free: 'Gratis',
};

export default function PromosScreen({ event, venueId }: Props) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'event' | 'customers'>('event');
  const [selectedEventId, setSelectedEventId] = useState<string>(event?.id ?? '');
  const [venueEvents, setVenueEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [eventPromos, setEventPromos] = useState<Promo[]>([]);
  const [venuePromos, setVenuePromos] = useState<Promo[]>([]);
  const [isLoadingPromos, setIsLoadingPromos] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');

  const [customerSegment, setCustomerSegment] = useState<CustomerSegment>('new');
  const [specificCustomers, setSpecificCustomers] = useState('');
  const [loyalWeeks, setLoyalWeeks] = useState('3');
  const [churnWeeks, setChurnWeeks] = useState('5');

  const loadVenueEvents = async () => {
    if (!venueId) {
      setVenueEvents([]);
      return;
    }
    try {
      setIsLoadingEvents(true);
      const list = await fetchEventsByVenue(venueId);
      setVenueEvents(list);
      if (!selectedEventId && list.length > 0) {
        setSelectedEventId(list[0].id);
      }
    } catch (e) {
      console.warn('loadVenueEvents error', e);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const loadPromos = async () => {
    try {
      setIsLoadingPromos(true);
      if (selectedEventId) {
        const list = await fetchPromosByEvent(selectedEventId);
        setEventPromos(list);
      } else {
        setEventPromos([]);
      }
      if (venueId) {
        const list = await fetchPromosByVenue(venueId);
        setVenuePromos(list);
      } else {
        setVenuePromos([]);
      }
    } catch (e) {
      console.warn('loadPromos error', e);
      Alert.alert('Errore', 'Impossibile caricare le promozioni');
    } finally {
      setIsLoadingPromos(false);
    }
  };

  useEffect(() => {
    if (event?.id) {
      setSelectedEventId(event.id);
    }
  }, [event?.id]);

  useEffect(() => {
    loadVenueEvents();
  }, [venueId]);

  useEffect(() => {
    loadPromos();
  }, [selectedEventId, venueId]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDiscountValue('');
    setSpecificCustomers('');
  };

  const formatDiscount = (promo: Promo) => {
    if (promo.discount_type === 'percentage') return `${promo.discount_value ?? 0}%`;
    if (promo.discount_type === 'fixed') return `€${promo.discount_value ?? 0}`;
    return 'FREE';
  };

  const getSegmentRuleForDescription = () => {
    switch (customerSegment) {
      case 'specific': {
        const targets = specificCustomers
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        return {
          ruleText: `Target clienti specifici: ${targets.join(', ')}`,
          metaText: `segment=specific;customers=${targets.join('|')}`,
        };
      }
      case 'new':
        return {
          ruleText: 'Target nuovi clienti: mai entrati nel locale',
          metaText: 'segment=new',
        };
      case 'loyal': {
        const weeks = Math.max(1, Number(loyalWeeks) || 1);
        return {
          ruleText: `Target clienti frequenti: almeno una visita nelle ultime ${weeks} settimane`,
          metaText: `segment=loyal;weeks=${weeks}`,
        };
      }
      case 'churn': {
        const weeks = Math.max(1, Number(churnWeeks) || 1);
        return {
          ruleText: `Target clienti assenti: nessuna visita da almeno ${weeks} settimane`,
          metaText: `segment=churn;weeks=${weeks}`,
        };
      }
    }
  };

  const extractTargetLine = (promo: Promo) => {
    const raw = (promo.description ?? promo.details ?? '').trim();
    if (!raw) return null;
    const line = raw
      .split('\n')
      .find((row) => row.toLowerCase().startsWith('target'));
    return line ?? null;
  };

  const getPromoScope = (promo: Promo) => {
    const targetLine = extractTargetLine(promo);
    if (!targetLine) return 'Evento';
    if (targetLine.toLowerCase().includes('specific')) return 'Specifici';
    if (targetLine.toLowerCase().includes('new')) return 'Nuovi';
    if (targetLine.toLowerCase().includes('loyal')) return 'Frequenti';
    if (targetLine.toLowerCase().includes('churn')) return 'Riattivazione';
    return 'Clienti';
  };

  const submitEventPromo = async () => {
    if (!selectedEventId) return Alert.alert('Nessun evento selezionato', 'Seleziona un evento prima di creare la promo');
    try {
      setIsSubmitting(true);
      const created = await createPromo({
        event_id: selectedEventId,
        title: title.trim() || 'Promo Evento',
        description: description.trim() || undefined,
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

    if (customerSegment === 'specific') {
      const targets = specificCustomers
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (targets.length === 0) {
        return Alert.alert('Clienti specifici', 'Inserisci almeno un cliente (username o ID), separati da virgola.');
      }
    }

    if ((customerSegment === 'loyal' && (Number(loyalWeeks) || 0) < 1) || (customerSegment === 'churn' && (Number(churnWeeks) || 0) < 1)) {
      return Alert.alert('Soglia settimane', 'Inserisci un numero di settimane maggiore o uguale a 1.');
    }

    const rule = getSegmentRuleForDescription();
    const composedDescription = [description.trim(), rule.ruleText, `[target_rule] ${rule.metaText}`]
      .filter(Boolean)
      .join('\n');

    const defaultTitleBySegment: Record<CustomerSegment, string> = {
      specific: 'Promo Clienti Specifici',
      new: 'Promo Nuovi Clienti',
      loyal: 'Promo Clienti Frequenti',
      churn: 'Promo Riattivazione',
    };

    try {
      setIsSubmitting(true);
      const created = await createPromo({
        venue_id: venueId,
        title: title.trim() || defaultTitleBySegment[customerSegment],
        description: composedDescription,
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
    <SafeAreaView style={[styles.safeRoot, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={[styles.keyboardRoot, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            style={{ backgroundColor: theme.colors.background }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroShell}>
              <View style={[styles.heroGlow, { backgroundColor: activeTab === 'event' ? '#FF6B6B' : '#8B7BFF' }]} />
              <View style={[styles.heroCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.heroHeaderRow}>
                  <View style={styles.heroEyebrowRow}>
                    <View
                      style={[
                        styles.livePulseWrap,
                        {
                          backgroundColor: activeTab === 'event' ? 'rgba(255,107,107,0.14)' : 'rgba(139,123,255,0.14)',
                          borderColor: activeTab === 'event' ? 'rgba(255,107,107,0.28)' : 'rgba(139,123,255,0.3)',
                        },
                      ]}
                    >
                      <View style={[styles.livePulseDot, { backgroundColor: activeTab === 'event' ? '#FF6B6B' : '#8B7BFF' }]} />
                    </View>
                    <Text style={[styles.heroEyebrow, { color: theme.colors.muted }]}>PROMO CONTROL</Text>
                  </View>
                </View>

                <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Promozioni</Text>
                <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>Crea promo evento o campagne clienti con una regia operativa unica.</Text>

                <View style={styles.heroStatsGrid}>
                  <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={[styles.kpiIconBg, { backgroundColor: '#FF6B6B1F', borderColor: '#FF6B6B35' }]}>
                      <Feather name="tag" size={18} color="#FF6B6B" />
                    </View>
                    <Text style={[styles.kpiLabel, { color: '#FF6B6B' }]}>Event promo</Text>
                    <Text style={[styles.kpiValue, { color: theme.colors.text }]}>{eventPromos.length}</Text>
                  </View>

                  <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={[styles.kpiIconBg, { backgroundColor: '#8B7BFF1F', borderColor: '#8B7BFF35' }]}>
                      <Feather name="users" size={18} color="#8B7BFF" />
                    </View>
                    <Text style={[styles.kpiLabel, { color: '#8B7BFF' }]}>Clienti promo</Text>
                    <Text style={[styles.kpiValue, { color: theme.colors.text }]}>{venuePromos.length}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Promo mode</Text>
              <View style={styles.tabRow}>
                <TouchableOpacity
                  onPress={() => setActiveTab('event')}
                  style={[
                    styles.tabBtn,
                    activeTab === 'event'
                      ? { backgroundColor: '#FF6B6B20', borderColor: '#FF6B6B50' }
                      : { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                  ]}
                >
                  <Feather name="tag" size={16} color={activeTab === 'event' ? '#FF6B6B' : theme.colors.muted} />
                  <Text style={[styles.tabText, { color: activeTab === 'event' ? '#FF6B6B' : theme.colors.muted }]}>Evento</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveTab('customers')}
                  style={[
                    styles.tabBtn,
                    activeTab === 'customers'
                      ? { backgroundColor: '#8B7BFF20', borderColor: '#8B7BFF50' }
                      : { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                  ]}
                >
                  <Feather name="users" size={16} color={activeTab === 'customers' ? '#8B7BFF' : theme.colors.muted} />
                  <Text style={[styles.tabText, { color: activeTab === 'customers' ? '#8B7BFF' : theme.colors.muted }]}>Clienti</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Compose promotion</Text>
              <View style={[styles.form, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
                {activeTab === 'event' && (
                  <>
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Evento di riferimento</Text>
                    {isLoadingEvents ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color={theme.colors.primary} />
                        <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Caricamento eventi...</Text>
                      </View>
                    ) : venueEvents.length > 0 ? (
                      <View style={styles.rowWrap}>
                        {venueEvents.map((evt) => {
                          const isSelected = selectedEventId === evt.id;
                          return (
                            <TouchableOpacity
                              key={evt.id}
                              onPress={() => setSelectedEventId(evt.id)}
                              style={[
                                styles.eventChip,
                                isSelected
                                  ? { backgroundColor: '#FF6B6B16', borderColor: '#FF6B6B42' }
                                  : { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                              ]}
                            >
                              <Text style={[styles.eventChipTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                {evt.name}
                              </Text>
                              <Text style={[styles.eventChipMeta, { color: theme.colors.muted }]}> {evt.date}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Nessun evento disponibile per questo locale.</Text>
                    )}
                  </>
                )}

                <Text style={[styles.label, { color: theme.colors.muted }]}>Titolo</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="Es: 2x1 cocktails" placeholderTextColor={theme.colors.muted} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]} />

                <Text style={[styles.label, { color: theme.colors.muted }]}>Dettagli</Text>
                <TextInput value={description} onChangeText={setDescription} placeholder="Es: Valida fino a mezzanotte" placeholderTextColor={theme.colors.muted} style={[styles.input, styles.textAreaInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]} multiline />

                <Text style={[styles.label, { color: theme.colors.muted }]}>Tipo sconto</Text>
                <View style={styles.rowWrap}>
                  {(['percentage', 'fixed', 'free'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setDiscountType(t)}
                      style={[
                        styles.pill,
                        discountType === t
                          ? { backgroundColor: '#67B7FF22', borderColor: '#67B7FF50' }
                          : { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                      ]}
                    >
                      <Text style={[styles.pillText, { color: discountType === t ? '#67B7FF' : theme.colors.muted }]}>{DISCOUNT_LABELS[t]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {discountType !== 'free' && (
                  <>
                    <Text style={[styles.label, { color: theme.colors.muted }]}>Valore sconto</Text>
                    <TextInput value={discountValue} onChangeText={(t) => setDiscountValue(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={discountType === 'percentage' ? 'Es: 20' : 'Es: 5'} placeholderTextColor={theme.colors.muted} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]} />
                  </>
                )}

                {activeTab === 'customers' && (
                  <>
                    <Text style={[styles.label, { color: theme.colors.muted }]}>A chi è dedicata la promo?</Text>
                    <View style={styles.rowWrap}>
                      {([
                        { key: 'specific', label: 'Clienti specifici', desc: 'Selezioni manualmente i clienti' },
                        { key: 'new', label: 'Nuovi clienti', desc: 'Chi non è mai entrato nel locale' },
                        { key: 'loyal', label: 'Clienti frequenti', desc: 'Chi torna spesso' },
                        { key: 'churn', label: 'Clienti assenti', desc: 'Chi non torna da tempo' },
                      ] as Array<{ key: CustomerSegment; label: string; desc: string }>).map((segment) => (
                        <TouchableOpacity
                          key={segment.key}
                          onPress={() => setCustomerSegment(segment.key)}
                          style={[
                            styles.segmentCard,
                            customerSegment === segment.key
                              ? { borderColor: '#8B7BFF66', backgroundColor: '#8B7BFF16' }
                              : { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                          ]}
                        >
                          <Text style={[styles.segmentTitle, { color: theme.colors.text }]}>{segment.label}</Text>
                          <Text style={[styles.segmentDesc, { color: theme.colors.muted }]}>{segment.desc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {customerSegment === 'specific' && (
                      <>
                        <Text style={[styles.label, { color: theme.colors.muted }]}>Clienti (username o ID)</Text>
                        <TextInput
                          value={specificCustomers}
                          onChangeText={setSpecificCustomers}
                          placeholder="Es: @mario, 93fa... , @giulia"
                          placeholderTextColor={theme.colors.muted}
                          style={[styles.input, styles.textAreaInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
                          multiline
                        />
                        <Text style={[styles.helper, { color: theme.colors.muted }]}>Separa più clienti con una virgola.</Text>
                      </>
                    )}

                    {customerSegment === 'loyal' && (
                      <>
                        <Text style={[styles.label, { color: theme.colors.muted }]}>Finestra "frequenti" (settimane)</Text>
                        <View style={[styles.counterRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                          <TouchableOpacity style={[styles.counterBtn, { borderColor: theme.colors.border }]} onPress={() => setLoyalWeeks(String(Math.max(1, (Number(loyalWeeks) || 1) - 1)))}>
                            <Feather name="minus" size={16} color={theme.colors.text} />
                          </TouchableOpacity>
                          <Text style={[styles.counterValue, { color: theme.colors.text }]}>{Math.max(1, Number(loyalWeeks) || 1)} settimane</Text>
                          <TouchableOpacity style={[styles.counterBtn, { borderColor: theme.colors.border }]} onPress={() => setLoyalWeeks(String((Number(loyalWeeks) || 1) + 1))}>
                            <Feather name="plus" size={16} color={theme.colors.text} />
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.helper, { color: theme.colors.muted }]}>Esempio: 3 = cliente che è entrato almeno una volta nelle ultime 3 settimane.</Text>
                      </>
                    )}

                    {customerSegment === 'churn' && (
                      <>
                        <Text style={[styles.label, { color: theme.colors.muted }]}>Soglia "assenti" (settimane)</Text>
                        <View style={[styles.counterRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                          <TouchableOpacity style={[styles.counterBtn, { borderColor: theme.colors.border }]} onPress={() => setChurnWeeks(String(Math.max(1, (Number(churnWeeks) || 1) - 1)))}>
                            <Feather name="minus" size={16} color={theme.colors.text} />
                          </TouchableOpacity>
                          <Text style={[styles.counterValue, { color: theme.colors.text }]}>{Math.max(1, Number(churnWeeks) || 1)} settimane</Text>
                          <TouchableOpacity style={[styles.counterBtn, { borderColor: theme.colors.border }]} onPress={() => setChurnWeeks(String((Number(churnWeeks) || 1) + 1))}>
                            <Feather name="plus" size={16} color={theme.colors.text} />
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.helper, { color: theme.colors.muted }]}>Esempio: 5 = cliente che non entra da almeno 5 settimane.</Text>
                      </>
                    )}

                  </>
                )}

                <TouchableOpacity
                  onPress={activeTab === 'event' ? submitEventPromo : submitCustomerPromo}
                  disabled={isSubmitting}
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: activeTab === 'event' ? '#FF6B6B' : '#8B7BFF',
                      opacity: isSubmitting ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={styles.submitText}>{isSubmitting ? 'Creazione in corso...' : activeTab === 'event' ? 'Crea promo evento' : 'Crea promo clienti'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionEyebrow, { color: theme.colors.muted }]}>Promotion list</Text>
              <View style={styles.listSection}>
                {isLoadingPromos && (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Caricamento promozioni...</Text>
                  </View>
                )}

                {event && (
                  <View style={styles.groupBlock}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Promo evento attivo</Text>
                    {eventPromos.map((p) => (
                      <View key={p.id} style={[styles.promoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={styles.promoRow}>
                          <View style={[styles.promoIconWrap, { backgroundColor: '#FF6B6B1A', borderColor: '#FF6B6B38' }]}>
                            <Feather name="tag" size={16} color="#FF6B6B" />
                          </View>
                          <View style={styles.promoTextBlock}>
                            <Text style={[styles.promoText, { color: theme.colors.text }]}>{p.title}</Text>
                            <Text style={[styles.promoScope, { color: theme.colors.muted }]}>Scope: Evento</Text>
                          </View>
                          <Text style={[styles.promoBadge, { color: '#FF6B6B' }]}>{formatDiscount(p)}</Text>
                        </View>
                      </View>
                    ))}
                    {eventPromos.length === 0 && (<Text style={[styles.emptyText, { color: theme.colors.muted }]}>Nessuna promo per l'evento</Text>)}
                  </View>
                )}

                {venueId && (
                  <View style={styles.groupBlock}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Promo per clienti del locale</Text>
                    {venuePromos.map((p) => {
                      const targetLine = extractTargetLine(p);
                      return (
                        <View key={p.id} style={[styles.promoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                          <View style={styles.promoRow}>
                            <View style={[styles.promoIconWrap, { backgroundColor: '#8B7BFF1A', borderColor: '#8B7BFF38' }]}>
                              <Feather name="gift" size={16} color="#8B7BFF" />
                            </View>
                            <View style={styles.promoTextBlock}>
                              <Text style={[styles.promoText, { color: theme.colors.text }]}>{p.title}</Text>
                              <Text style={[styles.promoScope, { color: theme.colors.muted }]}>Scope: {getPromoScope(p)}</Text>
                            </View>
                            <Text style={[styles.promoBadge, { color: '#8B7BFF' }]}>{formatDiscount(p)}</Text>
                          </View>
                          {!!targetLine && <Text style={[styles.targetLine, { color: theme.colors.muted }]}>{targetLine}</Text>}
                        </View>
                      );
                    })}
                    {venuePromos.length === 0 && (<Text style={[styles.emptyText, { color: theme.colors.muted }]}>Nessuna promo clienti</Text>)}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeRoot: { flex: 1 },
  keyboardRoot: { flex: 1 },
  scrollContent: { paddingBottom: 132, paddingHorizontal: 18, paddingTop: 12, gap: 18, flexGrow: 1 },
  heroShell: { position: 'relative' },
  heroGlow: {
    position: 'absolute',
    top: 8,
    right: 14,
    width: 132,
    height: 132,
    borderRadius: 999,
    opacity: 0.14,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    gap: 18,
    overflow: 'hidden',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  livePulseWrap: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    maxWidth: '92%',
  },
  heroStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    width: '48%',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    minHeight: 108,
    gap: 8,
  },
  kpiIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sectionBlock: { gap: 12 },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tabRow: { flexDirection: 'row', gap: 10 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabText: { fontWeight: '800', fontSize: 12 },
  form: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, borderWidth: 1, borderRadius: 22 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 10, marginBottom: 12, fontSize: 14 },
  textAreaInput: { minHeight: 84, textAlignVertical: 'top' },
  eventChip: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, minWidth: 140, maxWidth: '100%' },
  eventChipTitle: { fontSize: 12, fontWeight: '800' },
  eventChipMeta: { marginTop: 3, fontSize: 11, fontWeight: '600' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  pillText: { fontWeight: '800', fontSize: 12 },
  segmentCard: { width: '100%', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  segmentTitle: { fontSize: 13, fontWeight: '800' },
  segmentDesc: { marginTop: 3, fontSize: 11, fontWeight: '600' },
  counterRow: { borderWidth: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  counterValue: { fontSize: 14, fontWeight: '800' },
  helper: { marginTop: -6, marginBottom: 12, fontSize: 11, fontWeight: '500' },

  submitBtn: { marginTop: 8, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  submitText: { color: '#0B0B0B', fontWeight: '900', fontSize: 14 },

  listSection: { gap: 14 },
  groupBlock: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  promoCard: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 8 },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTextBlock: { flex: 1, gap: 2 },
  promoText: { fontSize: 13, fontWeight: '800' },
  promoScope: { fontSize: 11, fontWeight: '700' },
  promoBadge: { fontSize: 11, fontWeight: '900' },
  targetLine: { fontSize: 11, fontWeight: '600', marginLeft: 42 },
  emptyText: { fontSize: 12 },
});
