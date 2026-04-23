import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';

import { useTheme } from '../../theme/ThemeProvider';
import {
  listMyPrVenueMemberships,
  type MyPrVenueMembership,
} from '../../services/prNetwork';
import PrDashboardTab from '../staff/tabs/PrDashboardTab';

type RouteParams = {
  venueId?: string;
};

function roleLabel(role: MyPrVenueMembership['role']) {
  if (role === 'RESPONSABILE') return 'Responsabile';
  if (role === 'CAPO_SQUADRA') return 'Capo squadra';
  return 'PR';
}

function readErrorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message) && message.length > 0) return String(message[0]);
  if (typeof message === 'string' && message.trim().length > 0) return message;
  if (typeof error?.message === 'string' && error.message.trim().length > 0) return error.message;
  return fallback;
}

export default function PrDashboardScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const params = (route.params ?? {}) as RouteParams;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<MyPrVenueMembership[]>([]);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listMyPrVenueMemberships();
      setMemberships(list);
      setSelectedMembershipId((current) => {
        if (current && list.some((item) => item.membership_id === current)) {
          return current;
        }
        if (params.venueId) {
          const byVenue = list.find((item) => item.venue_id === params.venueId);
          if (byVenue) return byVenue.membership_id;
        }
        return list[0]?.membership_id ?? null;
      });
    } catch (err: any) {
      setMemberships([]);
      setSelectedMembershipId(null);
      setError(readErrorMessage(err, 'Impossibile caricare le tue assegnazioni PR.'));
    } finally {
      setLoading(false);
    }
  }, [params.venueId]);

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  const selectedMembership = useMemo(
    () => memberships.find((item) => item.membership_id === selectedMembershipId) ?? memberships[0] ?? null,
    [memberships, selectedMembershipId],
  );

  const selectedAccessText = useMemo(() => {
    if (!selectedMembership) return '';
    if (!selectedMembership.can_manage_team) {
      return 'Accesso monitoraggio: puoi vedere KPI e link tracciati.';
    }
    if (selectedMembership.role === 'RESPONSABILE' || selectedMembership.role === 'CAPO_SQUADRA') {
      return 'Accesso gestione team: puoi aggiungere PR nel tuo network.';
    }
    return 'Accesso monitoraggio: puoi vedere KPI e link tracciati.';
  }, [selectedMembership]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={styles.centeredWrap}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.centeredText, { color: theme.colors.muted }]}>Caricamento dashboard PR...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedMembership) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={styles.centeredWrap}>
          <Feather name="lock" size={22} color={theme.colors.muted} />
          <Text style={[styles.centeredText, { color: theme.colors.text }]}>Nessuna membership PR attiva trovata.</Text>
          <Text style={[styles.centeredSubtext, { color: theme.colors.muted }]}>
            Chiedi al locale di assegnarti come PR, capo squadra o responsabile.
          </Text>
          {error ? <Text style={[styles.centeredSubtext, { color: theme.colors.error }]}>{error}</Text> : null}
          <TouchableOpacity
            onPress={() => void loadMemberships()}
            style={[styles.retryButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
          >
            <Feather name="refresh-cw" size={14} color={theme.colors.text} />
            <Text style={[styles.retryButtonText, { color: theme.colors.text }]}>Riprova</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <View style={styles.topWrap}>
        <View style={[styles.heroCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.eyebrow, { color: theme.colors.muted }]}>PR dashboard</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Il tuo accesso PR per locale</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Gerarchia operativa: Locale {"->"} Responsabili PR {"->"} PR.</Text>
          <Text style={[styles.accessHint, { color: theme.colors.text }]}>{selectedAccessText}</Text>
          <View style={styles.heroActionsRow}>
            <TouchableOpacity
              onPress={() => void loadMemberships()}
              style={[styles.retryButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
            >
              <Feather name="refresh-cw" size={14} color={theme.colors.text} />
              <Text style={[styles.retryButtonText, { color: theme.colors.text }]}>Aggiorna accessi</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.venueChipsRow}
        >
          {memberships.map((membership) => {
            const active = membership.membership_id === selectedMembership.membership_id;
            return (
              <TouchableOpacity
                key={membership.membership_id}
                style={[
                  styles.venueChip,
                  {
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    backgroundColor: active ? `${theme.colors.primary}20` : theme.colors.card,
                  },
                ]}
                onPress={() => setSelectedMembershipId(membership.membership_id)}
              >
                <Text style={[styles.venueChipTitle, { color: active ? theme.colors.primary : theme.colors.text }]}>
                  {membership.venue_name}
                </Text>
                <Text style={[styles.venueChipSub, { color: theme.colors.muted }]}> 
                  {roleLabel(membership.role)} • {membership.ref_code}
                </Text>
                <Text style={[styles.venueChipMeta, { color: theme.colors.muted }]}>
                  {membership.can_manage_team ? 'Gestione team attiva' : 'Solo monitoraggio'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {error ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text> : null}
      </View>

      <PrDashboardTab venueId={selectedMembership.venue_id} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  accessHint: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  heroActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  venueChipsRow: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 12,
  },
  venueChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 170,
  },
  venueChipTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  venueChipSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
  venueChipMeta: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centeredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  centeredText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  centeredSubtext: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
});
