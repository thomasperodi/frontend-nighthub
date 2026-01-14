import React, { createContext, useContext } from "react";
import { SafeAreaView, SafeAreaProvider as RNSafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface SafeAreaContextType {
  // Puoi aggiungere state qui per funzionalità future (offline/online, etc)
}

const SafeAreaContext = createContext<SafeAreaContextType | undefined>(undefined);

export function SafeAreaProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  
  return (
    <SafeAreaContext.Provider value={{}}>
      <RNSafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top", "bottom"]}>
          <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            {children}
          </View>
        </SafeAreaView>
      </RNSafeAreaProvider>
    </SafeAreaContext.Provider>
  );
}

export function useSafeArea() {
  const context = useContext(SafeAreaContext);
  if (context === undefined) {
    throw new Error("useSafeArea must be used within SafeAreaProvider");
  }
  return context;
}
