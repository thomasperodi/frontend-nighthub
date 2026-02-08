import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { useAuth } from "../../../providers/AuthProvider";
import { deleteAccountApi } from "../../../services/auth";

interface ProfileTabProps {
  navigation: any;
}

export default function ProfileTab({ navigation }: ProfileTabProps) {
  const { theme } = useTheme();
  const { signOut, user } = useAuth();

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

  const menuItems = [
    {
      icon: 'calendar' as const,
      label: 'Le mie prenotazioni',
      onPress: () => navigation.navigate('Reservations'),
      color: theme.colors.primary,
    },
    {
      icon: 'settings' as const,
      label: 'Impostazioni',
      onPress: () => {},
      color: theme.colors.muted,
    },
    {
      icon: 'help-circle' as const,
      label: 'Aiuto e supporto',
      onPress: () => {},
      color: theme.colors.muted,
    },
    {
      icon: 'log-out' as const,
      label: 'Esci',
      onPress: () => signOut(),
      color: theme.colors.muted,
      isDestructive: false,
    },
  ];

  return (
    <ScrollView 
      style={{ flex: 1 }} 
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ padding: 20 }}>
        {/* Header Profilo */}
        <View style={[styles.profileHeader, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primary + '22' }]}>
            <Feather name="user" size={32} color={theme.colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.colors.text }]}>
              {user?.name || user?.email || 'Utente'}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.colors.muted }]}>
              {user?.email || 'email@example.com'}
            </Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={{ marginTop: 24 }}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: item.color + '22' }]}>
                <Feather name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{item.label}</Text>
              <Feather name="chevron-right" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Elimina Account */}
        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: '#FF4D4F' + '44' }]}
          onPress={confirmDelete}
          activeOpacity={0.8}
        >
          <Feather name="trash-2" size={18} color="#FF4D4F" />
          <Text style={[styles.deleteButtonText, { color: '#FF4D4F' }]}>Elimina account</Text>
        </TouchableOpacity>

        {/* Versione */}
        <View style={{ marginTop: 32, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.muted, fontSize: 12, fontWeight: '500' }}>Versione app 1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
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
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    backgroundColor: '#FF4D4F' + '10',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});
