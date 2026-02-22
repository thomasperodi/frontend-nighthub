import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";
import { deleteAccountApi } from "../../services/auth";
import { createVenueStripeOnboardingLink, fetchVenueById, fetchVenueStripeConnectStatus, StripeConnectStatus } from "../../services/venues";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

export default function ProfileScreen() {
  const { theme, toggleTheme, isDark } = useTheme();
  const { signOut, user } = useAuth();

  const [venueName, setVenueName] = useState<string>('—');
  const [venueLoading, setVenueLoading] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const venueId = user?.venue_id ?? null;

  const loadVenue = useCallback(async () => {
    if (!venueId) {
      setVenueName('—');
      setVenueError(null);
      return;
    }
    try {
      setVenueLoading(true);
      setVenueError(null);
      const v = await fetchVenueById(venueId);
      setVenueName(v?.name || '—');
    } catch (e: any) {
      console.warn('load venue', e);
      setVenueName('—');
      setVenueError(e?.response?.data?.message || 'Impossibile caricare il nome del locale');
    } finally {
      setVenueLoading(false);
    }
  }, [venueId]);

  const loadStripeStatus = useCallback(async () => {
    if (!venueId) {
      setStripeStatus(null);
      setStripeError(null);
      return;
    }
    try {
      setStripeLoading(true);
      setStripeError(null);
      const status = await fetchVenueStripeConnectStatus(venueId);
      setStripeStatus(status);
    } catch (e: any) {
      setStripeStatus(null);
      setStripeError(e?.response?.data?.message || 'Impossibile caricare lo stato Stripe');
    } finally {
      setStripeLoading(false);
    }
  }, [venueId]);

  const connectStripe = async () => {
    if (!venueId || stripeConnecting || signingOut || deleting) return;
    try {
      setStripeConnecting(true);
      setStripeError(null);

      const appBase = process.env.EXPO_PUBLIC_APP_BASE_URL || 'https://nighthub.app';
      const payload = await createVenueStripeOnboardingLink({
        venueId,
        email: user?.email,
        refresh_url: `${appBase}/stripe/connect/refresh?venue_id=${venueId}`,
        return_url: `${appBase}/stripe/connect/return?venue_id=${venueId}`,
      });

      if (!payload?.onboarding_url) {
        throw new Error('Link onboarding non disponibile');
      }

      await Linking.openURL(payload.onboarding_url);
      Alert.alert(
        'Onboarding Stripe aperto',
        'Completa i dati su Stripe, poi torna qui e premi "Aggiorna stato".',
      );
    } catch (e: any) {
      Alert.alert('Stripe', e?.response?.data?.message || e?.message || 'Errore apertura onboarding Stripe');
    } finally {
      setStripeConnecting(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadVenue();
      void loadStripeStatus();
    }, [loadVenue, loadStripeStatus]),
  );

  const onLogout = async () => {
    if (signingOut || deleting) return;
    Alert.alert('Esci', 'Vuoi uscire dall\'account?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          try {
            setSigningOut(true);
            await signOut();
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const confirmDelete = () => {
    if (signingOut || deleting) return;
    Alert.alert(
      'Elimina account',
      'Sei sicuro di voler eliminare il tuo account? Questa azione è irreversibile.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: deleteAccount },
      ]
    );
  };

  const deleteAccount = async () => {
    try {
      setDeleting(true);
      await deleteAccountApi();
      Alert.alert('Account eliminato', 'Il tuo account è stato eliminato con successo.');
      await signOut();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Errore', err?.response?.data?.message || 'Impossibile eliminare l\'account. Riprova.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}> 
        <View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Impostazioni</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Account e preferenze</Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          accessibilityRole="button"
          accessibilityLabel="Cambia tema"
          style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
        >
          <Feather name={isDark ? 'moon' : 'sun'} size={18} color={theme.colors.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={[styles.profileCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.avatar, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <Feather name="user" size={18} color={theme.colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileTitle, { color: theme.colors.text }]}>{user?.email || '—'}</Text>
            <View style={styles.badgesRow}>
              <View style={[styles.badge, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              >
                <Text style={[styles.badgeText, { color: theme.colors.muted }]}>{(user?.role || 'utente').toUpperCase()}</Text>
              </View>

            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="home" size={16} color={theme.colors.muted} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Locale</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Nome locale</Text>
            <View style={styles.rowRight}>
              {venueLoading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
              <Text style={[styles.value, { color: theme.colors.text }]} numberOfLines={1}>
                {venueName}
              </Text>
            </View>
          </View>
          {venueError ? (
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.error, { color: theme.colors.error }]}>{venueError}</Text>
              <TouchableOpacity onPress={() => void loadVenue()} style={styles.linkBtn} accessibilityRole="button">
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>Riprova</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="credit-card" size={16} color={theme.colors.muted} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Stripe pagamenti ticket</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Stato</Text>
            <View style={styles.rowRight}>
              {stripeLoading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
              <Text style={[styles.value, { color: theme.colors.text }]}> 
                {stripeStatus?.connected
                  ? stripeStatus.charges_enabled && stripeStatus.payouts_enabled
                    ? 'Attivo'
                    : 'In verifica'
                  : 'Non collegato'}
              </Text>
            </View>
          </View>

          <View style={[styles.rowBetween, { marginTop: 8 }]}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Account ID</Text>
            <Text style={[styles.value, { color: theme.colors.text }]} numberOfLines={1}>
              {stripeStatus?.stripe_account_id || '—'}
            </Text>
          </View>

          {stripeStatus?.requirements_due?.length ? (
            <Text style={[styles.error, { color: theme.colors.muted, marginTop: 10 }]}>Campi mancanti: {stripeStatus.requirements_due.join(', ')}</Text>
          ) : null}

          {stripeError ? (
            <Text style={[styles.error, { color: theme.colors.error, marginTop: 10 }]}>{stripeError}</Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, marginTop: 0, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, (stripeConnecting || deleting || signingOut) && { opacity: 0.6 }]}
              onPress={connectStripe}
              disabled={stripeConnecting || deleting || signingOut}
              accessibilityRole="button"
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                  <Feather name="link" size={16} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Collega / completa Stripe</Text>
                  <Text style={[styles.actionSub, { color: theme.colors.muted }]}>Autonomia locale</Text>
                </View>
              </View>
              {stripeConnecting ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Feather name="external-link" size={16} color={theme.colors.muted} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignSelf: 'center' }]}
              onPress={() => void loadStripeStatus()}
              disabled={stripeLoading || stripeConnecting}
            >
              <Feather name="refresh-cw" size={16} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="shield" size={16} color={theme.colors.muted} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account</Text>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, (signingOut || deleting) && { opacity: 0.6 }]}
            onPress={onLogout}
            disabled={signingOut || deleting}
            accessibilityRole="button"
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(155,92,255,0.12)' }]}>
                <Feather name="log-out" size={16} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Esci</Text>
                <Text style={[styles.actionSub, { color: theme.colors.muted }]}>Termina la sessione</Text>
              </View>
            </View>
            {signingOut ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Feather name="chevron-right" size={18} color={theme.colors.muted} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, (signingOut || deleting) && { opacity: 0.6 }]}
            onPress={confirmDelete}
            disabled={signingOut || deleting}
            accessibilityRole="button"
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Feather name="trash-2" size={16} color={theme.colors.error} />
              </View>
              <View>
                <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Elimina account</Text>
                <Text style={[styles.actionSub, { color: theme.colors.muted }]}>Azione irreversibile</Text>
              </View>
            </View>
            {deleting ? <ActivityIndicator size="small" color={theme.colors.error} /> : <Feather name="chevron-right" size={18} color={theme.colors.muted} />}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profileTitle: { fontSize: 15, fontWeight: '900' },
  badgesRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },

  section: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '900' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '62%' },
  label: { fontSize: 12, fontWeight: '800' },
  value: { fontSize: 13, fontWeight: '900' },

  error: { fontSize: 12, fontWeight: '700' },
  linkBtn: { paddingVertical: 8 },
  linkText: { fontSize: 12, fontWeight: '900' },

  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 10 },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon: { width: 34, height: 34, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '900' },
  actionSub: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
