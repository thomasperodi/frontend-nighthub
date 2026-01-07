import { View, Text, TouchableOpacity } from "react-native";

export default function SelectRoleScreen({ navigation }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B0B", padding: 24 }}>
      <Text style={{ color: "white", fontSize: 26, marginBottom: 40 }}>
        Chi sei?
      </Text>

      <TouchableOpacity
        onPress={() => navigation.navigate("VenueHome")}
        style={{
          backgroundColor: "#1F1F1F",
          padding: 20,
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: "white", fontSize: 18 }}>Locale / Organizzatore</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("ClientHome")}
        style={{
          backgroundColor: "#1F1F1F",
          padding: 20,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "white", fontSize: 18 }}>Cliente</Text>
      </TouchableOpacity>
    </View>
  );
}
