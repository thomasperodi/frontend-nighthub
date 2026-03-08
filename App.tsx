import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import RootNavigator from "./src/navigation/RootNavigation";
import { ThemeProvider } from "./src/theme/ThemeProvider";
import { AuthProvider } from "./src/providers/AuthProvider";
import { navigationRef, flushNavigationQueue } from "./src/navigation/NavigationService";
import LegalConsentModal from "./src/components/LegalConsentModal";
import { getLegalAccepted, setLegalAccepted } from "./src/services/legal";
import { StripeProvider } from "@stripe/stripe-react-native";

export default function App() {
  const [legalVisible, setLegalVisible] = useState(false);

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

  return (
    <ThemeProvider>
      <LegalConsentModal visible={legalVisible} onAccept={acceptLegal} />
      <AuthProvider>
        <StripeProvider
          publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
          urlScheme="nighthub"
        >
          <NavigationContainer ref={navigationRef} onReady={flushNavigationQueue}>
            <RootNavigator />
          </NavigationContainer>
        </StripeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
