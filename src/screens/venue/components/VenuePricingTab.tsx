import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { DEFAULT_BAR_MENU } from '../../../constants/barMenu';
import { fetchVenuePricing, updateVenuePricing } from '../../../services/venues';

type Props = {
  venueId?: string;
};

type PriceRow = {
  key: string;
  label: string;
  value: string;
};

const DEFAULT_BAR_KEYS = new Set(DEFAULT_BAR_MENU.map((item) => item.key));

export default function VenuePricingTab({ venueId }: Props) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cloakroomPrice, setCloakroomPrice] = useState('3.00');
  const [newBarLabel, setNewBarLabel] = useState('');
  const [newBarPrice, setNewBarPrice] = useState('');
  const [barRows, setBarRows] = useState<PriceRow[]>(
    DEFAULT_BAR_MENU.map((item) => ({
      key: item.key,
      label: item.label,
      value: item.defaultPrice.toFixed(2),
    })),
  );

  const canSave = useMemo(
    () => !!venueId && !loading && !saving,
    [venueId, loading, saving],
  );

  const loadPricing = async () => {
    if (!venueId) {
      setLoading(false);
      setError('Locale non trovato');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNotice(null);

      const pricing = await fetchVenuePricing(venueId);
      setCloakroomPrice(Number(pricing.cloakroom_unit_price ?? 3).toFixed(2));

      const pricingList = pricing.bar_price_list ?? [];
      const byKey = new Map(pricingList.map((item) => [String(item.key), item]));

      const defaultRows = DEFAULT_BAR_MENU.map((item) => {
        const matched = byKey.get(item.key);
        return {
          key: item.key,
          label: matched?.label || item.label,
          value: Number(matched?.price ?? item.defaultPrice).toFixed(2),
        };
      });

      const customRows = pricingList
        .filter((item) => !DEFAULT_BAR_KEYS.has(String(item.key) as any))
        .map((item) => ({
          key: String(item.key),
          label: item.label || String(item.key),
          value: Number(item.price ?? 0).toFixed(2),
        }));

      setBarRows([...defaultRows, ...customRows]);
    } catch (e: any) {
      setError(e?.message || 'Errore caricamento prezzi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPricing();
  }, [venueId]);

  const onChangeBarValue = (key: string, text: string) => {
    const sanitized = text.replace(/[^0-9.,]/g, '').replace(',', '.');
    setBarRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, value: sanitized } : row)),
    );
  };

  const normalizePrice = (value: string) => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : '0.00';
  };

  const sanitizeBarKey = (label: string) =>
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30);

  const addBarItem = () => {
    const label = newBarLabel.trim();
    const parsedPrice = Number(newBarPrice.replace(',', '.'));

    if (!label) {
      setError('Inserisci il nome della voce bar');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Prezzo nuova voce non valido');
      return;
    }

    const baseKey = sanitizeBarKey(label) || 'voce_bar';
    const existing = new Set(barRows.map((row) => row.key));
    let uniqueKey = baseKey;
    let i = 1;
    while (existing.has(uniqueKey)) {
      uniqueKey = `${baseKey}_${i}`;
      i += 1;
    }

    setBarRows((prev) => [
      ...prev,
      {
        key: uniqueKey,
        label,
        value: parsedPrice.toFixed(2),
      },
    ]);
    setNewBarLabel('');
    setNewBarPrice('');
    setError(null);
    setNotice(null);
  };

  const removeBarItem = (key: string) => {
    if (barRows.length <= 1) {
      setError('Deve rimanere almeno una voce bar');
      return;
    }
    setBarRows((prev) => prev.filter((row) => row.key !== key));
    setError(null);
    setNotice(null);
  };

  const barAverage = useMemo(() => {
    if (!barRows.length) return '0.00';
    const total = barRows.reduce((acc, row) => {
      const parsed = Number(row.value.replace(',', '.'));
      return acc + (Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
    }, 0);
    return (total / barRows.length).toFixed(2);
  }, [barRows]);

  const handleSave = async () => {
    if (!venueId) {
      setError('Locale non trovato');
      return;
    }

    const cloakroomParsed = Number(cloakroomPrice.replace(',', '.'));
    if (!Number.isFinite(cloakroomParsed) || cloakroomParsed < 0) {
      setError('Prezzo guardaroba non valido');
      return;
    }

    const bar_price_list = barRows.map((row) => {
      const parsed = Number(row.value.replace(',', '.'));
      return {
        key: row.key,
        label: row.label,
        price: Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : Number.NaN,
      };
    });

    if (bar_price_list.some((row) => !Number.isFinite(row.price) || row.price < 0)) {
      setError('Uno o più prezzi bar non sono validi');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const updated = await updateVenuePricing(venueId, {
        cloakroom_unit_price: Number(cloakroomParsed.toFixed(2)),
        bar_price_list,
      });

      setCloakroomPrice(Number(updated.cloakroom_unit_price).toFixed(2));
      const byKey = new Map(
        (updated.bar_price_list ?? []).map((item) => [String(item.key), Number(item.price)]),
      );
      setBarRows((prev) =>
        prev.map((row) => ({
          ...row,
          value: Number(byKey.get(row.key) ?? 0).toFixed(2),
        })),
      );

      setNotice('Prezzi aggiornati');
    } catch (e: any) {
      setError(e?.message || 'Errore salvataggio prezzi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loaderText, { color: theme.colors.muted }]}>Caricamento prezzi...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.hero,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            },
          ]}
        >
          <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.primary + '1f' }]}>
            <Feather name="dollar-sign" size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Gestione prezzi locale</Text>
            <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>Aggiorna in modo rapido guardaroba e listino bar per lo staff.</Text>
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}> 
          <View style={styles.sectionHeader}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Guardaroba</Text>
            <Text style={[styles.sectionBadge, { color: theme.colors.primary, borderColor: theme.colors.primary + '66' }]}>Prezzo per capo</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Inserisci il costo unitario. Verrà usato in cassa e nei report.</Text>
          <View style={styles.inputRow}>
            <Text style={[styles.euro, { color: theme.colors.text }]}>€</Text>
            <TextInput
              value={cloakroomPrice}
              onFocus={() => setFocusedField('cloakroom')}
              onBlur={() => {
                setFocusedField(null);
                setCloakroomPrice((prev) => normalizePrice(prev));
              }}
              onChangeText={(text) => setCloakroomPrice(text.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                {
                  borderColor: focusedField === 'cloakroom' ? theme.colors.primary : theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              placeholder="0.00"
              placeholderTextColor={theme.colors.muted}
            />
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}> 
          <View style={styles.sectionHeader}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Bar</Text>
            <Text style={[styles.sectionBadge, { color: theme.colors.primary, borderColor: theme.colors.primary + '66' }]}>Media € {barAverage}</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Listino rapido usato dallo staff per ordini e consumazioni.</Text>

          <View style={[styles.addRowCard, { borderColor: theme.colors.border }]}> 
            <TextInput
              value={newBarLabel}
              onChangeText={setNewBarLabel}
              placeholder="Nome nuova voce (es. Gin Tonic)"
              placeholderTextColor={theme.colors.muted}
              style={[styles.newLabelInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
            />
            <View style={styles.newPriceWrap}>
              <Text style={[styles.euroSmall, { color: theme.colors.text }]}>€</Text>
              <TextInput
                value={newBarPrice}
                onChangeText={(text) => setNewBarPrice(text.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                onBlur={() => {
                  if (!newBarPrice.trim()) return;
                  setNewBarPrice((prev) => normalizePrice(prev));
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.colors.muted}
                style={[styles.newPriceInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              />
              <TouchableOpacity
                onPress={addBarItem}
                style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Feather name="plus" size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {barRows.map((row) => (
            <View key={row.key} style={[styles.menuRow, { borderColor: theme.colors.border }]}> 
              <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{row.label}</Text>
              <View style={styles.menuInputWrap}>
                <Text style={[styles.euroSmall, { color: theme.colors.text }]}>€</Text>
                <TextInput
                  value={row.value}
                  onFocus={() => setFocusedField(row.key)}
                  onBlur={() => {
                    setFocusedField(null);
                    setBarRows((prev) =>
                      prev.map((item) =>
                        item.key === row.key ? { ...item, value: normalizePrice(item.value) } : item,
                      ),
                    );
                  }}
                  onChangeText={(text) => onChangeBarValue(row.key, text)}
                  keyboardType="decimal-pad"
                  style={[
                    styles.menuInput,
                    {
                      borderColor: focusedField === row.key ? theme.colors.primary : theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.muted}
                />
                <TouchableOpacity
                  onPress={() => removeBarItem(row.key)}
                  style={[styles.removeBtn, { borderColor: theme.colors.border }]}
                >
                  <Feather name="x" size={14} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {!!error && (
          <View style={[styles.msgRow, styles.errorBox]}>
            <Feather name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!!notice && !error && (
          <View style={[styles.msgRow, styles.okBox]}>
            <Feather name="check-circle" size={16} color="#22c55e" />
            <Text style={styles.okText}>{notice}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveBtn,
            {
              backgroundColor: canSave ? theme.colors.primary : theme.colors.muted,
              opacity: canSave ? 1 : 0.85,
            },
          ]}
          onPress={handleSave}
          disabled={!canSave}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Feather name="save" size={16} color="white" />
          )}
          <Text style={styles.saveBtnText}>{saving ? 'Salvataggio in corso...' : 'Salva prezzi'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  euro: {
    fontSize: 18,
    fontWeight: '900',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addRowCard: {
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  newLabelInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  newPriceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newPriceInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  menuInputWrap: {
    width: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  euroSmall: {
    fontSize: 14,
    fontWeight: '800',
  },
  menuInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  okBox: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  okText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
  },
  saveBtnText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
  },
});
