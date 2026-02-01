import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { createEvent, fetchEventById, updateEvent } from '../../services/events';
import { uploadEventPoster } from '../../services/media';
import { resolveEventImageUri } from '../../utils/media';

function isValidISODate(value: string) {
  // Accept YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function isValidTime(value: string) {
  // Accept HH:MM or HH:MM:SS
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value.trim());
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDateYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function nextWeekdayAfterToday(targetDay: 5 | 6): Date {
  // 5 = Friday, 6 = Saturday. Must be strictly after today.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const current = today.getDay(); // 0=Sun..6=Sat
  let delta = (targetDay - current + 7) % 7;
  if (delta === 0) delta = 7;

  const d = new Date(today);
  d.setDate(d.getDate() + delta);
  return d;
}

function formatTimeHHMM(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseTimeHHMM(value: string): Date {
  // Uses today's date in local time; we only care about HH:MM for the picker
  const [h, m] = value.split(':').map((x) => parseInt(x, 10));
  const now = new Date();
  now.setHours(Number.isFinite(h) ? h : 0);
  now.setMinutes(Number.isFinite(m) ? m : 0);
  now.setSeconds(0);
  now.setMilliseconds(0);
  return now;
}

function PickerSheet(props: {
  isIOS: boolean;
  theme: any;
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!props.isIOS) return null;

  return (
    <Modal
      transparent
      visible={props.visible}
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <View style={styles.modalBackdrop}>
        {/* Tap area ABOVE the sheet.
            Keeping this separate avoids accidental close/reopen flicker while scrolling the iOS spinner. */}
        <Pressable style={{ flex: 1 }} onPress={props.onClose} />

        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: props.theme.colors.surface,
              borderColor: props.theme.colors.border,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: props.theme.colors.text }]}>{props.title}</Text>
            <TouchableOpacity
              onPress={props.onClose}
              style={[styles.modalIconBtn, { borderColor: props.theme.colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Chiudi"
            >
              <Feather name="x" size={18} color={props.theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 6 }}>
            {props.children}
          </View>

          <TouchableOpacity
            onPress={props.onClose}
            style={[styles.modalDoneBtn, { backgroundColor: props.theme.colors.primary }]}
            accessibilityRole="button"
          >
            <Text style={styles.modalDoneText}>Fatto</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

type GenderFilter = 'ALL' | 'M' | 'F' | 'ALTRO';
type DiscountType = 'percentage' | 'fixed' | 'free';
type PromoStatus = 'active' | 'inactive' | 'expired';

type PriceRuleDraft = {
  id: string;
  label: string;
  gender: GenderFilter;
  start_time: string;
  end_time: string;
  price: string;
};

type PromoDraft = {
  id: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  status: PromoStatus;
};

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function CreateEventScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const isIOS = Platform.OS === 'ios';

  const editEventId: string | null = route?.params?.eventId ?? null;
  const isEdit = Boolean(editEventId);

  const venueId = user?.venue_id ?? null;

  const [name, setName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('21:00');
  const [endTime, setEndTime] = useState('03:00');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [description, setDescription] = useState('');

  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [posterCleared, setPosterCleared] = useState(false);

  const [priceRules, setPriceRules] = useState<PriceRuleDraft[]>([]);
  const [promos, setPromos] = useState<PromoDraft[]>([]);

  const [pricesOpen, setPricesOpen] = useState(false);
  const [promosOpen, setPromosOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !editEventId) return;

    const loadExisting = async () => {
      try {
        setLoadingExisting(true);
        setError(null);
        const existing = await fetchEventById(editEventId);
        if (!existing) {
          setError('Evento non trovato');
          return;
        }

        const normalizeTime = (t?: string) => {
          if (!t) return '';
          const s = String(t);
          // Accept HH:MM[:SS]
          if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
          return s;
        };

        setName(existing.name ?? '');
        setDate(String(existing.date ?? '').slice(0, 10));
        setStartTime(normalizeTime(existing.start_time) || '21:00');
        setEndTime(normalizeTime(existing.end_time) || '03:00');
        setDescription(existing.description ?? '');

        const img = existing.image ? String(existing.image) : null;
        setPosterUri(img);
        setPosterDataUrl(null);
        setPosterCleared(false);

        setPriceRules(
          (existing.entry_prices ?? []).map((p: any) => ({
            id: String(p.id ?? uid()),
            label: String(p.label ?? ''),
            gender: (String(p.gender ?? 'ALL').toUpperCase() as any) === 'M'
              ? 'M'
              : (String(p.gender ?? 'ALL').toUpperCase() as any) === 'F'
                ? 'F'
                : (String(p.gender ?? 'ALL').toUpperCase() as any) === 'ALTRO'
                  ? 'ALTRO'
                  : 'ALL',
            start_time: normalizeTime(p.start_time) ?? '',
            end_time: normalizeTime(p.end_time) ?? '',
            price: p.price !== undefined && p.price !== null ? String(p.price) : '',
          })),
        );

        setPromos(
          (existing.promos ?? []).map((pr: any) => ({
            id: String(pr.id ?? uid()),
            title: String(pr.title ?? ''),
            description: String(pr.description ?? ''),
            discount_type:
              pr.discount_type === 'fixed' || pr.discount_type === 'free' ? pr.discount_type : 'percentage',
            discount_value: pr.discount_value !== undefined && pr.discount_value !== null ? String(pr.discount_value) : '',
            status: pr.status === 'inactive' || pr.status === 'expired' ? pr.status : 'active',
          })),
        );
      } catch (e: any) {
        const statusCode = e?.response?.status;
        const msg = e?.response?.data?.message || e?.message || 'Errore caricamento evento';
        setError(statusCode ? `${msg} (${statusCode})` : msg);
      } finally {
        setLoadingExisting(false);
      }
    };

    void loadExisting();
  }, [isEdit, editEventId]);

  const canSubmit = useMemo(() => {
    if (!venueId) return false;
    if (!name.trim()) return false;
    if (!isValidISODate(date)) return false;
    if (startTime.trim() && !isValidTime(startTime)) return false;
    if (endTime.trim() && !isValidTime(endTime)) return false;

    for (const r of priceRules) {
      if (!r.price.trim()) continue;
      const n = Number(r.price);
      if (!Number.isFinite(n) || n < 0) return false;
      if (r.start_time.trim() && !isValidTime(r.start_time)) return false;
      if (r.end_time.trim() && !isValidTime(r.end_time)) return false;
    }

    for (const p of promos) {
      if (!p.title.trim()) return false;
      if (p.discount_type !== 'free') {
        const n = Number(p.discount_value);
        if (!Number.isFinite(n)) return false;
      }
    }

    return true;
  }, [venueId, name, date, startTime, endTime, priceRules, promos]);

  const pickPoster = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Permesso galleria negato: abilitalo per selezionare la locandina.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: false,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setPosterUri(asset.uri);
      setPosterDataUrl(null);
      setPosterCleared(false);
    } catch (e: any) {
      setError(e?.message || 'Errore selezione immagine');
    }
  };

  const addPriceRule = () => {
    setPriceRules((prev) => [
      ...prev,
      {
        id: uid(),
        label: '',
        gender: 'ALL',
        start_time: '',
        end_time: '',
        price: '',
      },
    ]);
  };

  const addPromo = () => {
    setPromos((prev) => [
      ...prev,
      {
        id: uid(),
        title: '',
        description: '',
        discount_type: 'percentage',
        discount_value: '',
        status: 'active',
      },
    ]);
  };

  const effectivePricesOpen = pricesOpen || priceRules.length > 0;
  const effectivePromosOpen = promosOpen || promos.length > 0;

  const applyTimePreset = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const setNextWeekendDate = (target: 'fri' | 'sat') => {
    const d = nextWeekdayAfterToday(target === 'fri' ? 5 : 6);
    setDate(formatDateYYYYMMDD(d));
    setShowDatePicker(false);
  };

  const submit = async () => {
    if (!venueId) {
      setError('Venue ID mancante: non puoi creare eventi senza locale associato.');
      return;
    }

    const trimmedName = name.trim();
    const trimmedDate = date.trim();
    const trimmedStart = startTime.trim();
    const trimmedEnd = endTime.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) return setError('Nome evento obbligatorio');
    if (!isValidISODate(trimmedDate)) return setError('Data non valida (usa YYYY-MM-DD)');
    if (trimmedStart && !isValidTime(trimmedStart)) return setError('Ora inizio non valida (HH:MM o HH:MM:SS)');
    if (trimmedEnd && !isValidTime(trimmedEnd)) return setError('Ora fine non valida (HH:MM o HH:MM:SS)');

    for (const r of priceRules) {
      if (!r.price.trim()) continue;
      const n = Number(r.price);
      if (!Number.isFinite(n) || n < 0) return setError('Prezzo non valido in una fascia');
      if (r.start_time.trim() && !isValidTime(r.start_time)) return setError('Ora inizio non valida in una fascia prezzi');
      if (r.end_time.trim() && !isValidTime(r.end_time)) return setError('Ora fine non valida in una fascia prezzi');
    }

    for (const p of promos) {
      if (!p.title.trim()) return setError('Titolo promo obbligatorio');
      if (p.discount_type !== 'free') {
        const n = Number(p.discount_value);
        if (!Number.isFinite(n)) return setError('Valore sconto non valido');
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      let image: string | null | undefined;
      if (posterCleared) {
        image = null;
      } else if (posterUri) {
        // If it's already a stored path (e.g. "events/..."), keep it.
        if (!posterUri.startsWith('file:') && !posterUri.startsWith('content:')) {
          image = posterUri;
        } else {
          // Upload poster as multipart/form-data to backend, then store only the returned path.
          image = await uploadEventPoster({
            uri: posterUri,
          });
        }
      } else {
        image = undefined;
      }

      const entry_prices = priceRules
        .filter((r) => r.price.trim())
        .map((r) => ({
          label: r.label.trim() || undefined,
          gender: r.gender === 'ALL' ? undefined : r.gender,
          start_time: r.start_time.trim() || undefined,
          end_time: r.end_time.trim() || undefined,
          price: Number(r.price),
        }));

      const promos_payload = promos.map((p) => ({
        title: p.title.trim(),
        description: p.description.trim() || undefined,
        discount_type: p.discount_type,
        discount_value: p.discount_type === 'free' ? undefined : Number(p.discount_value),
        status: p.status,
      }));

      const basePayload: any = {
        venue_id: venueId,
        name: trimmedName,
        description: trimmedDescription || undefined,
        // Store only the Supabase storage path (or null to clear)
        image,
        date: trimmedDate,
        start_time: trimmedStart || undefined,
        end_time: trimmedEnd || undefined,
        // Status is automatic (Programmato/Live/Chiuso based on times)
        status: 'DRAFT',
      };

      if (isEdit && editEventId) {
        await updateEvent(editEventId, {
          ...basePayload,
          // In edit mode we always send arrays (even empty) so users can clear them.
          entry_prices,
          promos: promos_payload,
        });
      } else {
        await createEvent({
          ...basePayload,
          entry_prices: entry_prices.length ? entry_prices : undefined,
          promos: promos_payload.length ? promos_payload : undefined,
        });
      }

      navigation.goBack();
    } catch (e: any) {
      const statusCode = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Errore creazione evento';
      setError(statusCode ? `${msg} (${statusCode})` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>{isEdit ? 'Modifica Evento' : 'Crea Evento'}</Text>
          <View style={{ width: 40 }} />
        </View>

        {loadingExisting ? (
          <View style={styles.banner}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.bannerText}>Caricamento evento…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.banner}>
            <Feather name="alert-triangle" size={16} color="#f59e0b" />
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Dettagli</Text>

          <Text style={[styles.label, { color: theme.colors.muted }]}>Locandina</Text>
          <View style={styles.posterRow}>
            <TouchableOpacity onPress={pickPoster} style={styles.posterBtn}>
              <Feather name="image" size={18} color="white" />
              <Text style={styles.posterBtnText}>{posterUri ? 'Cambia' : 'Seleziona'}</Text>
            </TouchableOpacity>
            {posterUri ? (
              <TouchableOpacity
                onPress={() => {
                  setPosterUri(null);
                  setPosterDataUrl(null);
                  setPosterCleared(true);
                }}
                style={styles.posterRemove}
              >
                <Feather name="trash-2" size={16} color="#ef4444" />
              </TouchableOpacity>
            ) : null}
          </View>

          {posterUri ? (
            <Image
              source={{
                uri:
                  posterUri.startsWith('file:') || posterUri.startsWith('content:')
                    ? posterUri
                    : resolveEventImageUri(posterUri) ?? posterUri,
              }}
              style={styles.posterPreview}
              resizeMode="cover"
            />
          ) : null}

          <Text style={[styles.label, { color: theme.colors.muted }]}>Nome evento</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Es. Serata Techno"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={[styles.input, { color: theme.colors.text }]}
            autoCapitalize="sentences"
          />

          <Text style={[styles.label, { color: theme.colors.muted }]}>Data (YYYY-MM-DD)</Text>
          <View style={styles.pickerRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                value={date}
                editable={!loadingExisting && !submitting}
                onChangeText={setDate}
                placeholder="2026-01-25"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={[styles.input, { color: theme.colors.text, opacity: 0.95 }]}
              />
            </View>
            <View style={{ width: 10 }} />
            <TouchableOpacity onPress={() => setShowDatePicker((v) => !v)} style={styles.pickerBtn}>
              <Feather name="calendar" size={18} color="white" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: theme.colors.muted }]}>Preset date (prossimo weekend)</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity onPress={() => setNextWeekendDate('fri')} style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>Prossimo Ven</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNextWeekendDate('sat')} style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>Prossimo Sab</Text>
            </TouchableOpacity>
          </View>

          {isIOS ? (
            <PickerSheet
              isIOS={isIOS}
              theme={theme}
              visible={showDatePicker}
              title="Seleziona la data"
              onClose={() => setShowDatePicker(false)}
            >
              <DateTimePicker
                value={isValidISODate(date) ? new Date(`${date}T12:00:00`) : new Date()}
                mode="date"
                display="spinner"
                themeVariant={theme.mode}
                textColor={theme.colors.text as any}
                accentColor={theme.colors.primary as any}
                onChange={(_, selectedDate) => {
                  if (selectedDate) setDate(formatDateYYYYMMDD(selectedDate));
                }}
              />
            </PickerSheet>
          ) : showDatePicker ? (
            <DateTimePicker
              value={isValidISODate(date) ? new Date(`${date}T12:00:00`) : new Date()}
              mode="date"
              display="default"
              onChange={(event: any, selectedDate) => {
                // Android shows a native dialog; close on both set and dismiss.
                setShowDatePicker(false);
                if (event?.type === 'set' && selectedDate) setDate(formatDateYYYYMMDD(selectedDate));
              }}
            />
          ) : null}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.colors.muted }]}>Ora inizio (HH:MM)</Text>
              <View style={styles.pickerRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={startTime}
                    editable={!loadingExisting && !submitting}
                    onChangeText={setStartTime}
                    placeholder="21:00"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={[styles.input, { color: theme.colors.text, opacity: 0.95 }]}
                  />
                </View>
                <View style={{ width: 10 }} />
                <TouchableOpacity onPress={() => setShowStartPicker((v) => !v)} style={styles.pickerBtn}>
                  <Feather name="clock" size={18} color="white" />
                </TouchableOpacity>
              </View>

              {isIOS ? (
                <PickerSheet
                  isIOS={isIOS}
                  theme={theme}
                  visible={showStartPicker}
                  title="Ora inizio"
                  onClose={() => setShowStartPicker(false)}
                >
                  <DateTimePicker
                    value={isValidTime(startTime) ? parseTimeHHMM(startTime) : new Date()}
                    mode="time"
                    is24Hour
                    display="spinner"
                    themeVariant={theme.mode}
                    textColor={theme.colors.text as any}
                    accentColor={theme.colors.primary as any}
                    onChange={(_, selectedDate) => {
                      if (selectedDate) setStartTime(formatTimeHHMM(selectedDate));
                    }}
                  />
                </PickerSheet>
              ) : showStartPicker ? (
                <DateTimePicker
                  value={isValidTime(startTime) ? parseTimeHHMM(startTime) : new Date()}
                  mode="time"
                  is24Hour
                  display="default"
                  onChange={(event: any, selectedDate) => {
                    setShowStartPicker(false);
                    if (event?.type === 'set' && selectedDate) setStartTime(formatTimeHHMM(selectedDate));
                  }}
                />
              ) : null}
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.colors.muted }]}>Ora fine (HH:MM)</Text>
              <View style={styles.pickerRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={endTime}
                    editable={!loadingExisting && !submitting}
                    onChangeText={setEndTime}
                    placeholder="03:00"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={[styles.input, { color: theme.colors.text, opacity: 0.95 }]}
                  />
                </View>
                <View style={{ width: 10 }} />
                <TouchableOpacity onPress={() => setShowEndPicker((v) => !v)} style={styles.pickerBtn}>
                  <Feather name="clock" size={18} color="white" />
                </TouchableOpacity>
              </View>

              {isIOS ? (
                <PickerSheet
                  isIOS={isIOS}
                  theme={theme}
                  visible={showEndPicker}
                  title="Ora fine"
                  onClose={() => setShowEndPicker(false)}
                >
                  <DateTimePicker
                    value={isValidTime(endTime) ? parseTimeHHMM(endTime) : new Date()}
                    mode="time"
                    is24Hour
                    display="spinner"
                    themeVariant={theme.mode}
                    textColor={theme.colors.text as any}
                    accentColor={theme.colors.primary as any}
                    onChange={(_, selectedDate) => {
                      if (selectedDate) setEndTime(formatTimeHHMM(selectedDate));
                    }}
                  />
                </PickerSheet>
              ) : showEndPicker ? (
                <DateTimePicker
                  value={isValidTime(endTime) ? parseTimeHHMM(endTime) : new Date()}
                  mode="time"
                  is24Hour
                  display="default"
                  onChange={(event: any, selectedDate) => {
                    setShowEndPicker(false);
                    if (event?.type === 'set' && selectedDate) setEndTime(formatTimeHHMM(selectedDate));
                  }}
                />
              ) : null}
            </View>
          </View>

          <Text style={[styles.label, { color: theme.colors.muted }]}>Preset rapidi</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity onPress={() => applyTimePreset('21:00', '03:00')} style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>21→03</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => applyTimePreset('22:00', '04:00')} style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>22→04</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => applyTimePreset('23:00', '05:00')} style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>23→05</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: theme.colors.muted }]}>Stato</Text>
          <Text style={[styles.hint, { color: theme.colors.muted, marginTop: 2 }]}>Automatico: Programmato / Live / Chiuso in base a data e orari.</Text>

          <Text style={[styles.label, { color: theme.colors.muted }]}>Descrizione</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Descrizione dell'evento..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={[styles.input, styles.textArea, { color: theme.colors.text }]}
            multiline
          />

          <View style={styles.divider} />

          <TouchableOpacity
            onPress={() => setPricesOpen((v) => !v)}
            activeOpacity={0.85}
            style={styles.sectionToggleRow}
          >
            <View style={styles.sectionToggleLeft}>
              <Feather name={effectivePricesOpen ? 'chevron-down' : 'chevron-right'} size={18} color={theme.colors.muted} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>Prezzi ingresso</Text>
              <Text style={[styles.sectionMeta, { color: theme.colors.muted }]}>
                {priceRules.length ? `${priceRules.length} fasce` : 'Opzionale'}
              </Text>
            </View>
            <TouchableOpacity onPress={addPriceRule} style={styles.smallBtn}>
              <Feather name="plus" size={16} color="white" />
              <Text style={styles.smallBtnText}>Aggiungi</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {effectivePricesOpen ? (
            <>
              {priceRules.length === 0 ? (
                <Text style={[styles.hint, { color: theme.colors.muted }]}>
                  Definisci fasce prezzi per sesso e/orario.
                </Text>
              ) : null}

              {priceRules.map((r, idx) => (
                <View key={r.id} style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>Fascia {idx + 1}</Text>
                <TouchableOpacity
                  onPress={() => setPriceRules((prev) => prev.filter((x) => x.id !== r.id))}
                >
                  <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: theme.colors.muted }]}>Etichetta</Text>
              <TextInput
                value={r.label}
                onChangeText={(v) =>
                  setPriceRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, label: v } : x)))
                }
                placeholder="Es. Early bird"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={[styles.input, { color: theme.colors.text }]}
              />

              <Text style={[styles.label, { color: theme.colors.muted }]}>Sesso</Text>
              <View style={styles.pillRow}>
                {(['ALL', 'M', 'F', 'ALTRO'] as GenderFilter[]).map((g) => {
                  const active = r.gender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() =>
                        setPriceRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, gender: g } : x)))
                      }
                      style={[
                        styles.pill,
                        active && {
                          borderColor: theme.colors.primary,
                          backgroundColor: 'rgba(109,91,255,0.18)',
                        },
                      ]}
                    >
                      <Text style={[styles.pillText, active && { color: theme.colors.primary }]}>
                        {g === 'ALL' ? 'Tutti' : g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.colors.muted }]}>Da (HH:MM)</Text>
                  <TextInput
                    value={r.start_time}
                    onChangeText={(v) =>
                      setPriceRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, start_time: v } : x)))
                    }
                    placeholder=""
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={[styles.input, { color: theme.colors.text }]}
                    autoCapitalize="none"
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.colors.muted }]}>A (HH:MM)</Text>
                  <TextInput
                    value={r.end_time}
                    onChangeText={(v) =>
                      setPriceRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, end_time: v } : x)))
                    }
                    placeholder=""
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={[styles.input, { color: theme.colors.text }]}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: theme.colors.muted }]}>Prezzo (€)</Text>
              <TextInput
                value={r.price}
                onChangeText={(v) =>
                  setPriceRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, price: v } : x)))
                }
                placeholder="20"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={[styles.input, { color: theme.colors.text }]}
                keyboardType="numeric"
              />
            </View>
              ))}
            </>
          ) : (
            <Text style={[styles.hint, { color: theme.colors.muted }]}>Se non ti serve, puoi saltare questa sezione.</Text>
          )}

          <View style={styles.divider} />

          <TouchableOpacity
            onPress={() => setPromosOpen((v) => !v)}
            activeOpacity={0.85}
            style={styles.sectionToggleRow}
          >
            <View style={styles.sectionToggleLeft}>
              <Feather name={effectivePromosOpen ? 'chevron-down' : 'chevron-right'} size={18} color={theme.colors.muted} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>Promozioni</Text>
              <Text style={[styles.sectionMeta, { color: theme.colors.muted }]}>
                {promos.length ? `${promos.length} promo` : 'Opzionale'}
              </Text>
            </View>
            <TouchableOpacity onPress={addPromo} style={styles.smallBtn}>
              <Feather name="plus" size={16} color="white" />
              <Text style={styles.smallBtnText}>Aggiungi</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {effectivePromosOpen ? (
            <>
              {promos.length === 0 ? (
                <Text style={[styles.hint, { color: theme.colors.muted }]}>Opzionale: aggiungi promo legate all'evento.</Text>
              ) : null}

              {promos.map((p, idx) => (
                <View key={p.id} style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>Promo {idx + 1}</Text>
                <TouchableOpacity onPress={() => setPromos((prev) => prev.filter((x) => x.id !== p.id))}>
                  <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: theme.colors.muted }]}>Titolo</Text>
              <TextInput
                value={p.title}
                onChangeText={(v) => setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, title: v } : x)))}
                placeholder="Es. Ingresso Donna -50%"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={[styles.input, { color: theme.colors.text }]}
              />

              <Text style={[styles.label, { color: theme.colors.muted }]}>Descrizione</Text>
              <TextInput
                value={p.description}
                onChangeText={(v) => setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, description: v } : x)))}
                placeholder="Dettagli promo..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={[styles.input, styles.textArea, { color: theme.colors.text }]}
                multiline
              />

              <Text style={[styles.label, { color: theme.colors.muted }]}>Tipo sconto</Text>
              <View style={styles.pillRow}>
                {(['percentage', 'fixed', 'free'] as DiscountType[]).map((t) => {
                  const active = p.discount_type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() =>
                        setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, discount_type: t } : x)))
                      }
                      style={[
                        styles.pill,
                        active && {
                          borderColor: theme.colors.primary,
                          backgroundColor: 'rgba(109,91,255,0.18)',
                        },
                      ]}
                    >
                      <Text style={[styles.pillText, active && { color: theme.colors.primary }]}>
                        {t === 'percentage' ? '%' : t === 'fixed' ? '€' : 'Gratis'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {p.discount_type !== 'free' ? (
                <>
                  <Text style={[styles.label, { color: theme.colors.muted }]}>Valore sconto</Text>
                  <TextInput
                    value={p.discount_value}
                    onChangeText={(v) => setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, discount_value: v } : x)))}
                    placeholder={p.discount_type === 'percentage' ? '50' : '10'}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={[styles.input, { color: theme.colors.text }]}
                    keyboardType="numeric"
                  />
                </>
              ) : null}

              <Text style={[styles.label, { color: theme.colors.muted }]}>Stato</Text>
              <View style={styles.pillRow}>
                {(['active', 'inactive', 'expired'] as PromoStatus[]).map((s) => {
                  const active = p.status === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: s } : x)))}
                      style={[
                        styles.pill,
                        active && {
                          borderColor: theme.colors.primary,
                          backgroundColor: 'rgba(109,91,255,0.18)',
                        },
                      ]}
                    >
                      <Text style={[styles.pillText, active && { color: theme.colors.primary }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
              ))}
            </>
          ) : (
            <Text style={[styles.hint, { color: theme.colors.muted }]}>Puoi aggiungerle dopo: non sono obbligatorie.</Text>
          )}

          {!venueId ? (
            <Text style={[styles.hint, { color: theme.colors.muted }]}>Serve un account con locale associato.</Text>
          ) : null}
        </View>
        </ScrollView>

        <View style={[styles.footer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
          <TouchableOpacity
            disabled={!canSubmit || submitting || loadingExisting}
            onPress={submit}
            style={[
              styles.footerBtn,
              { backgroundColor: theme.colors.primary },
              (!canSubmit || submitting || loadingExisting) && { opacity: 0.5 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Feather name="check" size={18} color="white" />
                <Text style={styles.footerBtnText}>{isEdit ? 'Salva modifiche' : 'Crea evento'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: { fontSize: 22, fontWeight: '900' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    marginBottom: 14,
  },
  bannerText: { color: '#f59e0b', fontSize: 12, fontWeight: '800', flex: 1 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: { fontSize: 14, fontWeight: '900', marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontWeight: '700',
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center' },
  pickerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(109,91,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(109,91,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerInline: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  pickerDoneBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pickerDoneText: { color: 'white', fontWeight: '900' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  modalTitle: { fontSize: 14, fontWeight: '900' },
  modalIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modalDoneBtn: {
    marginTop: 10,
    marginHorizontal: 6,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneText: { color: 'white', fontWeight: '900' },
  row: { flexDirection: 'row', marginTop: 4 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  quickBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  quickBtnText: { color: 'white', fontWeight: '900', fontSize: 12 },
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  posterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  posterBtnText: { color: 'white', fontWeight: '900' },
  posterRemove: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPreview: {
    marginTop: 10,
    width: '100%',
    height: 210,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statusRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  statusPill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statusText: { color: 'white', fontWeight: '900', fontSize: 12 },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 18,
    marginBottom: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sectionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  sectionToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sectionMeta: { fontSize: 12, fontWeight: '800' },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(109,91,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(109,91,255,0.35)',
  },
  smallBtnText: { color: 'white', fontWeight: '900', fontSize: 12 },
  ruleCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  ruleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ruleTitle: { fontWeight: '900', fontSize: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pillText: { color: 'white', fontWeight: '900', fontSize: 12 },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  footerBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  footerBtnText: { color: 'white', fontWeight: '900' },
  hint: { marginTop: 10, fontSize: 12, fontWeight: '700' },
});
