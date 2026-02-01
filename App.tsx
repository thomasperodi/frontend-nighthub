import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import RootNavigator from "./src/navigation/RootNavigation";
import { ThemeProvider } from "./src/theme/ThemeProvider";
import { AuthProvider } from "./src/providers/AuthProvider";
import { navigationRef, flushNavigationQueue } from "./src/navigation/NavigationService";
import * as SplashScreen from "expo-splash-screen";
import LegalConsentModal from "./src/components/LegalConsentModal";
import { getLegalAccepted, setLegalAccepted } from "./src/services/legal";

// Blocca la splash screen all'avvio
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [legalVisible, setLegalVisible] = useState(false);

  useEffect(() => {
    async function prepareApp() {
      try {
        // Qui puoi caricare font, immagini, dati iniziali ecc.
        // Esempio delay per simulare caricamento
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn(e);
      } finally {
        // Indica che l'app è pronta
        setIsReady(true);
      }
    }

    prepareApp();
  }, []);

  useEffect(() => {
    (async () => {
      const accepted = await getLegalAccepted();
      if (!accepted) setLegalVisible(true);
    })();
  }, []);

  const acceptLegal = async () => {
    await setLegalAccepted(true);
    setLegalVisible(false);
  };

  // Nasconde la splash screen quando l'app è pronta
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    // Non renderizza nulla finché l'app non è pronta
    return null;
  }

  return (
    <ThemeProvider>
      <LegalConsentModal visible={legalVisible} onAccept={acceptLegal} />
      <AuthProvider>
        <NavigationContainer ref={navigationRef} onReady={flushNavigationQueue}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
