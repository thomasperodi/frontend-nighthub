import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useTheme } from "../../../theme/ThemeProvider";
import { useAuth } from "../../../providers/AuthProvider";
import { deleteAccountApi } from "../../../services/auth";

interface ProfileTabProps {
  navigation: any;
}

export default function ProfileTab({ navigation }: ProfileTabProps) {
  const { theme } = useTheme();
  const { signOut } = useAuth();

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

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ padding: 18 }}>
        <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>Il tuo profilo</Text>
        <Text style={[styles.placeholderText, { color: theme.colors.muted }]}>Informazioni account, preferiti e impostazioni.</Text>

        <View style={{ height: 12 }} />
        <TouchableOpacity
          style={[{ padding: 12, backgroundColor: theme.colors.primary, borderRadius: 10 }]}
          onPress={() => navigation.navigate('Reservations')}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Le mie prenotazioni</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />
        <TouchableOpacity
          style={[{ padding: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 }]}
          onPress={() => signOut()}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Esci</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />
        <TouchableOpacity
          style={[{ padding: 12, backgroundColor: '#FF4D4F', borderRadius: 10 }]}
          onPress={() => confirmDelete()}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>Elimina account</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 18 }}>
        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>Versione app 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholderTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  placeholderText: { },
});
