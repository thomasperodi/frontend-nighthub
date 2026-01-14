import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import VenueHomeScreen from '../../screens/venue/VenueHomeScreen';
import EventDetailScreen from '../../screens/client/EventDetailScreen';
import PromoDetailScreen from '../../screens/client/PromoDetailScreen';

const Stack = createNativeStackNavigator();

export default function VenueStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VenueHome" component={VenueHomeScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="PromoDetail" component={PromoDetailScreen} />
    </Stack.Navigator>
  );
}
