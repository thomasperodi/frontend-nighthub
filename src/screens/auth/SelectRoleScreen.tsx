import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

export default function SelectRoleScreen({ navigation }: any) {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 24 }}>
      <Text style={{ color: theme.colors.text, fontSize: 26, marginBottom: 40 }}>
        Chi sei?
      </Text>

      {/* Bottone per il locale / organizzatore */}
      <TouchableOpacity
        onPress={() => navigation.replace("VenueTabs")} // <- qui
        style={{
          backgroundColor: theme.colors.surface,
          padding: 20,
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: theme.colors.text, fontSize: 18 }}>
          Locale / Organizzatore
        </Text>
      </TouchableOpacity>

      {/* Bottone per il cliente */}
      <TouchableOpacity
        onPress={() => navigation.replace("ClientTabs")} // <- qui
        style={{
          backgroundColor: theme.colors.surface,
          padding: 20,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: theme.colors.text, fontSize: 18 }}>Cliente</Text>
      </TouchableOpacity>
    </View>
  );
}
