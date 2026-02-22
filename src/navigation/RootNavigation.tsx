import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../providers/AuthProvider';
import { getOnboardingSeen } from '../services/auth';

import LoginScreen from '../screens/auth/LoginScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

import VenueStack from './stacks/VenueStack';
import ClientStack from './stacks/ClientStack';
import StaffStack from './stacks/StaffStack';
import AdminStack from './stacks/AdminStack';

const Stack = createNativeStackNavigator();
const RegisterScreen = require('../screens/auth/RegisterScreen').default;

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const [onboardingSeen, setOnboardingSeen] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const seen = await getOnboardingSeen();
        setOnboardingSeen(seen);
      } catch {
        // if storage fails, default to showing onboarding once
        setOnboardingSeen(false);
      }
    })();
  }, []);

  // While restoring token, show a small native loader
  if (loading)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );

  // If not authenticated, show auth stack
  if (!user) {
    // While reading onboarding flag, show loader
    if (onboardingSeen === null)
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      );

    return (
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={onboardingSeen ? 'Login' : 'Onboarding'}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </Stack.Navigator>
    );
  }

  // Authenticated — render role-specific stack directly (clean, explicit)
  const role = (user.role || '').toLowerCase();


  if (role === 'admin') return <AdminStack />;
  if (role === 'venue') return <VenueStack />;
  if (role === 'staff') return <StaffStack />;
  // default to client for 'user' or unknown roles
  return <ClientStack />;
}
