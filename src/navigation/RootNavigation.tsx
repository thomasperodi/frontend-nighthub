import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../providers/AuthProvider';

import LoginScreen from '../screens/auth/LoginScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

import VenueStack from './stacks/VenueStack';
import ClientStack from './stacks/ClientStack';
import StaffStack from './stacks/StaffStack';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  // While restoring token, show a small native loader
  if (loading)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );

  // If not authenticated, show auth stack
  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  // Authenticated — render role-specific stack directly (clean, explicit)
  const role = (user.role || '').toLowerCase();

  if (role === 'venue') return <VenueStack />;
  if (role === 'staff') return <StaffStack />;
  // default to client for 'user' or unknown roles
  return <ClientStack />;
}
