import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { getUserPromos, addUserPromo } from "../../services/userPromos";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PromoDetailScreen({ route, navigation }: any) {
  const { promo } = route.params;
  const { theme } = useTheme();
  const [isForYou, setIsForYou] = useState(false);

  const rawDescription = promo?.details || promo?.description || '';

  const audienceLabel = useMemo(() => {
    const targetRuleLine = String(rawDescription)
      .split('\n')
      .map((line: string) => line.trim())
      .find((line: string) => line.toLowerCase().startsWith('[target_rule]'));

    if (!targetRuleLine) return 'Pubblico locale';

    const payload = targetRuleLine.replace(/^\[target_rule\]\s*/i, '');
    const segmentMatch = payload.match(/segment=([^;]+)/i);
    const weeksMatch = payload.match(/weeks=(\d+)/i);
    const segment = segmentMatch?.[1]?.trim()?.toLowerCase();
    const weeks = weeksMatch?.[1] ? Number(weeksMatch[1]) : null;

    if (segment === 'new') return 'Solo nuovi clienti';
    if (segment === 'specific') return 'Solo clienti selezionati';
    if (segment === 'loyal') return weeks ? `Clienti frequenti (${weeks} sett.)` : 'Clienti frequenti';
    if (segment === 'churn') return weeks ? `Clienti assenti (${weeks} sett.)` : 'Clienti assenti';
    return 'Pubblico locale';
  }, [rawDescription]);

  const visibleDescription = useMemo(() => {
    const lines = String(rawDescription)
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean)
      .filter((line: string) => !line.toLowerCase().startsWith('[target_rule]'))
      .filter((line: string) => !line.toLowerCase().startsWith('target '));

    return lines.join('\n').trim() || 'Nessun dettaglio disponibile';
  }, [rawDescription]);

  const isVenuePromo = !promo?._raw?.event_id;
  const scopeLabel = isVenuePromo ? 'Promo locale' : 'Promo evento';
  const discount = promo?.discount || (promo?.discount_type ? `${promo.discount_type}${typeof promo?.discount_value === 'number' ? ` ${promo.discount_value}` : ''}` : 'Offerta');
  const until = promo?.until || '';
  const eventRef = isVenuePromo
    ? (promo?.venueName ? `Valida nel locale ${promo.venueName}` : 'Valida in tutto il locale')
    : (promo?.eventTitle || promo?._raw?.event_id || 'Evento collegato');
  const eventDate = promo?.eventDate || '';

  useEffect(() => {
    (async () => {
      const p = await getUserPromos();
      setIsForYou(p.includes(promo.id));
    })();
  }, [promo.id]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={[styles.topHeader, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity style={[styles.back, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Feather name="arrow-left" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <View style={styles.badgesRow}>
              <View style={[styles.scopeBadge, { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary + '44' }]}>
                <Text style={[styles.scopeBadgeText, { color: theme.colors.primary }]}>{scopeLabel}</Text>
              </View>
              <View style={[styles.scopeBadge, { backgroundColor: theme.colors.accent + '14', borderColor: theme.colors.accent + '44' }]}>
                <Text style={[styles.scopeBadgeText, { color: theme.colors.accent }]}>{audienceLabel}</Text>
              </View>
            </View>
            <Text style={[styles.eventRef, { color: theme.colors.muted }]} numberOfLines={2}>{eventRef}{eventDate ? ` • ${eventDate}` : ''}</Text>
            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>{promo.title}</Text>
          </View>
        </View>

        <View style={styles.inner}>
          {isForYou && (
            <View style={[styles.userBadge, { backgroundColor: theme.colors.primary }]}> 
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Offerta riservata a te</Text>
            </View>
          )}

          <View style={[styles.infoCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
            <View style={styles.infoRow}>
              <Feather name="map-pin" size={16} color={theme.colors.primary} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>{eventRef}</Text>
            </View>
            {!!eventDate && (
              <View style={[styles.infoRow, { marginTop: 8 }]}> 
                <Feather name="calendar" size={16} color={theme.colors.primary} />
                <Text style={[styles.infoText, { color: theme.colors.text }]}>{eventDate}</Text>
              </View>
            )}
          </View>

          <View style={{ height: 12 }} />
          <Text style={[styles.section, { color: theme.colors.text }]}>Dettagli promo</Text>
          <View style={[styles.detailsCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
            <Text style={[styles.desc, { color: theme.colors.muted }]}>{visibleDescription}</Text>
          </View>

          <View style={{ height: 16 }} />

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}
            onPress={() => navigation.navigate('ClientHome', { promoFilter: promo.id })}
            accessibilityRole="button"
          >
            <Text style={[styles.actionText, { color: theme.colors.primary }]}>Vedi eventi con questa promo</Text>
          </TouchableOpacity>

          <View style={{ height: 10 }} />

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isForYou ? theme.colors.card : theme.colors.primary, borderColor: isForYou ? theme.colors.border : theme.colors.primary }]}
            onPress={async () => {
              if (!isForYou) {
                await addUserPromo(promo.id);
                setIsForYou(true);
              }
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.actionText, { color: theme.colors.text }]}>{isForYou ? 'Offerta già salvata' : 'Salva tra le mie offerte'}</Text>
          </TouchableOpacity>

          <Text style={[styles.ctaHint, { color: theme.colors.muted }]}>Salvare l'offerta non crea una prenotazione: la ritrovi solo nella tua area offerte.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1 },
  back: { padding: 8, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4, marginTop: 4 },
  inner: { padding: 18 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  scopeBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  scopeBadgeText: { fontSize: 11, fontWeight: '800' },
  eventRef: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '900', lineHeight: 28 },
  userBadge: { marginTop: 2, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, alignSelf: 'flex-start' },
  infoCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, fontWeight: '700', flex: 1 },
  section: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  detailsCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  desc: { lineHeight: 21, fontSize: 14 },
  actionButton: { paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontWeight: '800', fontSize: 14 },
  ctaHint: { fontSize: 12, lineHeight: 18, marginTop: 10 },
});