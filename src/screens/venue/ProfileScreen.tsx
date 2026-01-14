import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";
import { deleteAccountApi } from "../../services/auth";

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { signOut } = useAuth();

  const onLogout = async () => {
    await signOut();
  };

  const confirmDelete = () => {
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
      await deleteAccountApi();
      Alert.alert('Account eliminato', 'Il tuo account è stato eliminato con successo.');
      await signOut();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Errore', err?.response?.data?.message || 'Impossibile eliminare l\'account. Riprova.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Impostazioni</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nome locale</Text>
        <Text style={styles.value}>Club Phoenix</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tema</Text>
        <Text style={styles.value}>Automatico</Text>
      </View>

      <View style={{ marginTop: 20 }}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: 'rgba(255,255,255,0.06)' }]} onPress={onLogout} accessibilityRole="button">
          <Text style={styles.btnText}>Esci</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, { backgroundColor: '#FF4D4F', marginTop: 12 }]} onPress={confirmDelete} accessibilityRole="button">
          <Text style={[styles.btnText, { color: 'white' }]}>Elimina account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 20 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  label: { color: "#CFC6FF" },
  value: { color: "white", fontWeight: "700", marginTop: 6 },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: { color: '#CFC6FF', fontWeight: '800' }
});
