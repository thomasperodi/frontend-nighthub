import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/auth/LoginScreen";
import SelectRoleScreen from "../screens/auth/SelectRoleScreen";
import VenueHomeScreen from "../screens/venue/VenueHomeScreen";
import ClientHomeScreen from "../screens/client/ClientHomeScreen";
import OnboardingScreen from "../screens/onboarding/OnboardingScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
<Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SelectRole" component={SelectRoleScreen} />
      <Stack.Screen name="VenueHome" component={VenueHomeScreen} />
      <Stack.Screen name="ClientHome" component={ClientHomeScreen} />
    </Stack.Navigator>
  );
}
