import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export function ScreenLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top", "bottom"]}
    >
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
