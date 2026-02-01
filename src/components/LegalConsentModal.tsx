import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import PrimaryButton from './PrimaryButton';

type Props = {
  visible: boolean;
  onAccept: () => void | Promise<void>;
  privacyUrl?: string;
  termsUrl?: string;
  lastUpdated?: string;
};

export default function LegalConsentModal({
  visible,
  onAccept,
  privacyUrl,
  termsUrl,
  lastUpdated = '29/01/2026',
}: Props) {
  const { theme } = useTheme();

  const openUrl = async (url?: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // force explicit accept
      }}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.62)' }]}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
>
          <Text style={[styles.title, { color: theme.colors.text }]}>Privacy e Termini</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Ultimo aggiornamento: {lastUpdated}</Text>

          <ScrollView
            style={{ maxHeight: 360 }}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.body, { color: theme.colors.text }]}
>
              {`Per usare l'app è necessario accettare l'informativa privacy e i termini di utilizzo.\n\n`}
              {`Continuando ad usare l'app dichiari di aver letto e accettato quanto segue (sintesi):\n\n`}
              {`• Dati trattati: dati account (es. email), dati di utilizzo dell'app, eventuali dati inseriti dall'utente (prenotazioni, preferenze) e dati tecnici del dispositivo.\n`}
              {`• Finalità: erogazione del servizio, sicurezza, prevenzione abusi, assistenza e miglioramento dell'esperienza.\n`}
              {`• Condivisione: i dati possono essere condivisi con fornitori tecnici necessari al funzionamento (es. hosting, notifiche) e con i locali/organizzatori solo per gestire prenotazioni e servizi richiesti.\n`}
              {`• Conservazione: per il tempo necessario alle finalità e agli obblighi di legge.\n`}
              {`• Diritti: accesso, rettifica, cancellazione, limitazione/opposizione, portabilità (ove applicabile).\n\n`}
              {`Puoi consultare i testi completi ai link qui sotto (se disponibili).`}
            </Text>

            {(privacyUrl || termsUrl) ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                {privacyUrl ? (
                  <TouchableOpacity
                    onPress={() => openUrl(privacyUrl)}
                    style={[styles.linkBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                    accessibilityRole="button"
                    accessibilityLabel="Apri informativa privacy"
                  >
                    <Text style={[styles.linkText, { color: theme.colors.text }]}>Apri informativa privacy</Text>
                  </TouchableOpacity>
                ) : null}

                {termsUrl ? (
                  <TouchableOpacity
                    onPress={() => openUrl(termsUrl)}
                    style={[styles.linkBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                    accessibilityRole="button"
                    accessibilityLabel="Apri termini di utilizzo"
                  >
                    <Text style={[styles.linkText, { color: theme.colors.text }]}>Apri termini di utilizzo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {Platform.OS === 'android' ? (
              <Text style={[styles.hint, { color: theme.colors.muted }]}
>
                {`Nota: il tasto "Indietro" non chiude questo avviso.`}
              </Text>
            ) : null}
          </ScrollView>

          <View style={{ marginTop: 10 }}>
            <PrimaryButton title="Accetto e continuo" onPress={onAccept} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  linkBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '800',
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
  },
});
