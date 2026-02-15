import * as Notifications from 'expo-notifications';
import { api } from './api';

export type ExpoPushTokenResult = {
  token: string | null;
  status: 'granted' | 'denied' | 'error';
};

export async function registerForPushNotifications(): Promise<ExpoPushTokenResult> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    let finalStatus = settings.status;
    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return { token: null, status: 'denied' };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    return { token: tokenResponse.data, status: 'granted' };
  } catch {
    return { token: null, status: 'error' };
  }
}

export async function sendPushToken(token: string) {
  await api.post('/auth/push-token', { push_token: token });
}
