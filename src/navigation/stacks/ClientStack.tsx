import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ClientHomeScreen from '../../screens/client/ClientHomeScreen';
import EventDetailScreen from '../../screens/client/EventDetailScreen';
import PromoDetailScreen from '../../screens/client/PromoDetailScreen';
import ReservationsScreen from '../../screens/client/ReservationsScreen';
import ReservationDetailScreen from '../../screens/client/ReservationDetailScreen';
import OnboardingScreen from '../../screens/onboarding/OnboardingScreen';
import SettingsScreen from '../../screens/client/SettingsScreen';
import HelpSupportScreen from '../../screens/client/HelpSupportScreen';

const Stack = createNativeStackNavigator();

export default function ClientStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientHome" component={ClientHomeScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="PromoDetail" component={PromoDetailScreen} />
      <Stack.Screen name="Reservations" component={ReservationsScreen} />
      <Stack.Screen name="ReservationDetail" component={ReservationDetailScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
    </Stack.Navigator>
  );
}
