import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { useAuth } from "../../../providers/AuthProvider";
import { deleteAccountApi } from "../../../services/auth";
import { listMyPrVenueMemberships } from "../../../services/prNetwork";
import appConfig from "../../../../app.json";

interface ProfileTabProps {
  navigation: any;
}

export default function ProfileTab({ navigation }: ProfileTabProps) {
  const { theme } = useTheme();
  const { signOut, user } = useAuth();
  const displayEmail = user?.email || "email@example.com";
  const displayName = user?.email?.split("@")[0] || "Utente";
  const appVersion = appConfig?.expo?.version || "1.0.0";
  const [prVenueId, setPrVenueId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const memberships = await listMyPrVenueMemberships();
        if (!mounted) return;
        const activeMembership = memberships.find((membership) => membership.is_active) ?? null;
        setPrVenueId(activeMembership?.venue_id ?? null);
      } catch {
        if (!mounted) return;
        setPrVenueId(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const confirmSignOut = () => {
    Alert.alert("Esci", "Vuoi terminare la sessione su questo dispositivo?", [
      { text: "Annulla", style: "cancel" },
      { text: "Esci", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Elimina account', 'Sei sicuro di voler eliminare il tuo account? Questa azione è irreversibile.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive', onPress: async () => {
          try {
            await deleteAccountApi();
            Alert.alert('Account eliminato', 'Il tuo account è stato eliminato con successo.');
            await signOut();
          } catch (err: any) {
            console.error(err);
            Alert.alert('Errore', err?.response?.data?.message || 'Impossibile eliminare l\'account. Riprova.');
          }
        }
      }
    ]);
  };

  const accountItems = [
    {
      icon: 'calendar' as const,
      label: 'Le mie prenotazioni',
      description: 'Storico e stato dei tuoi ingressi e tavoli',
      onPress: () => navigation.navigate('Reservations'),
      color: theme.colors.primary,
    },
    ...(prVenueId
      ? [
          {
            icon: 'git-branch' as const,
            label: 'Dashboard PR',
            description: 'QR personale, scansioni e ingressi del tuo team',
            onPress: () => navigation.navigate('PrDashboard', { venueId: prVenueId }),
            color: theme.colors.primary,
          },
        ]
      : []),
    {
      icon: 'play-circle' as const,
      label: 'Rivedi onboarding',
      description: 'Ripassa funzionalità e suggerimenti principali',
      onPress: () => navigation.navigate('Onboarding'),
      color: theme.colors.primary,
    },
  ];

  const supportItems = [
    {
      icon: 'settings' as const,
      label: 'Impostazioni',
      description: 'Tema, notifiche e preferenze account',
      onPress: () => navigation.navigate('Settings'),
      color: theme.colors.muted,
    },
    {
      icon: 'help-circle' as const,
      label: 'Aiuto e supporto',
      description: 'FAQ, contatti e assistenza rapida',
      onPress: () => navigation.navigate('HelpSupport'),
      color: theme.colors.muted,
    },
    {
      icon: 'log-out' as const,
      label: 'Esci',
      description: 'Termina la sessione su questo dispositivo',
      onPress: confirmSignOut,
      color: theme.colors.muted,
    },
  ];

  const renderMenuItem = (item: {
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
    description: string;
    onPress: () => void;
    color: string;
  }) => (
    <TouchableOpacity
      key={item.label}
      style={[styles.menuItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={item.onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint={item.description}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: item.color + '22' }]}>
        <Feather name={item.icon} size={20} color={item.color} />
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{item.label}</Text>
        <Text style={[styles.menuDescription, { color: theme.colors.muted }]} numberOfLines={1}>{item.description}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={theme.colors.muted} />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <View style={[styles.profileHeader, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.headerTopRow}>
            <View style={[styles.profilePill, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Feather name="shield" size={12} color={theme.colors.primary} />
              <Text style={[styles.profilePillText, { color: theme.colors.primary }]}>Account attivo</Text>
            </View>
            <View style={[styles.versionPill, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={[styles.versionPillText, { color: theme.colors.muted }]}>v{appVersion}</Text>
            </View>
          </View>

          <View style={styles.profileMainRow}>
            <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primary + '22' }]}>
              <Feather name="user" size={32} color={theme.colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.colors.text }]}>
                {displayName}
              </Text>
              <Text style={[styles.profileEmail, { color: theme.colors.muted }]}>
                {displayEmail}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.groupCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
          <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>Account</Text>
          {accountItems.map(renderMenuItem)}
        </View>

        <View style={[styles.groupCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
          <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>Supporto</Text>
          {supportItems.map(renderMenuItem)}
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: theme.colors.error + '44', backgroundColor: theme.colors.error + '10' }]}
          onPress={confirmDelete}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Elimina account"
          accessibilityHint="Azione irreversibile"
        >
          <Feather name="trash-2" size={18} color={theme.colors.error} />
          <Text style={[styles.deleteButtonText, { color: theme.colors.error }]}>Elimina account</Text>
        </TouchableOpacity>

        <View style={styles.footerWrap}>
          <Text style={[styles.footerText, { color: theme.colors.muted }]}>Versione app {appVersion}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  inner: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  profileHeader: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  profilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  profilePillText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  versionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  versionPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  profileMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  profileEmail: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  menuDescription: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
  },
  footerWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
