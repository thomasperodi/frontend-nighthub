import { NavigationContainer } from "@react-navigation/native";
import RootNavigator from "./src/navigation/RootNavigation";
import { ThemeProvider } from "./src/theme/ThemeProvider";
import { AuthProvider } from "./src/providers/AuthProvider";
import { navigationRef, flushNavigationQueue } from "./src/navigation/NavigationService";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} onReady={flushNavigationQueue}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
