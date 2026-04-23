import React, { useEffect, useState } from "react";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import RootNavigator from "./src/navigation/RootNavigation";
import { ThemeProvider } from "./src/theme/ThemeProvider";
import { AuthProvider } from "./src/providers/AuthProvider";
import { navigationRef, flushNavigationQueue } from "./src/navigation/NavigationService";
import LegalConsentModal from "./src/components/LegalConsentModal";
import { getLegalAccepted, setLegalAccepted } from "./src/services/legal";
import { StripeProvider } from "@stripe/stripe-react-native";

const normalizeBaseUrl = (value: string | undefined | null): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  return `https://${raw}`.replace(/\/+$/, "");
};

const shareBase =
  normalizeBaseUrl(process.env.EXPO_PUBLIC_APP_SHARE_URL) ||
  normalizeBaseUrl(process.env.EXPO_PUBLIC_APP_BASE_URL);

const linking: LinkingOptions<any> = {
  prefixes: [
    "nighthub://",
    ...(shareBase ? [shareBase] : []),
  ],
  config: {
    screens: {
      EventDetail: "event/:id",
    },
  },
};

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
          <NavigationContainer ref={navigationRef} onReady={flushNavigationQueue} linking={linking}>
            <RootNavigator />
          </NavigationContainer>
        </StripeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
