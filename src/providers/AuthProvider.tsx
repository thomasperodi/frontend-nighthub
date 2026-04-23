import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { login as apiLogin, persistLogin, clearLogin, restoreLogin, logoutApi, sendActivityHeartbeat } from '../services/auth';
import { registerForPushNotifications, sendPushToken } from '../services/push';
import { startVenueStayMonitoring } from '../services/locationTracking';
import { navigate } from '../navigation/NavigationService';

type PublicUser = { id: string; email: string; role: string; venue_id?: string | null };

type AuthContextValue = {
  user: PublicUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeUser = (user: PublicUser | null) => {
  if (!user) return null;
  return {
    ...user,
    role: (user.role || '').toLowerCase().trim(),
  } as PublicUser;
};

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  useEffect(() => {
    (async () => {
      const res = await restoreLogin();
      if (res.token) {
        setToken(res.token);
        setUser(normalizeUser(res.user));
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user || !token) return;

    let disposed = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stopHeartbeat = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const ping = async () => {
      if (disposed) return;
      try {
        await sendActivityHeartbeat();
      } catch {
        // Ignore transient heartbeat failures.
      }
    };

    const startHeartbeat = () => {
      stopHeartbeat();
      void ping();
      intervalId = setInterval(() => {
        void ping();
      }, 60 * 1000);
    };

    if (AppState.currentState === 'active') {
      startHeartbeat();
    }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        startHeartbeat();
        return;
      }

      stopHeartbeat();
    });

    return () => {
      disposed = true;
      stopHeartbeat();
      subscription.remove();
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!user || !token) return;
    if (user.role !== 'client') return;

    let mounted = true;

    const handleVenueStay = async (payload: any) => {
      const venueId = payload?.venue_id;
      const latitude = Number(payload?.latitude);
      const longitude = Number(payload?.longitude);
      const radius = Number(payload?.radius);

      if (!venueId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const response = await startVenueStayMonitoring({
        venue_id: String(venueId),
        latitude,
        longitude,
        radius: Number.isFinite(radius) ? radius : 100,
      });

      if (!response.started) {
        const msg =
          response.status === 'foreground-denied'
            ? 'Permesso posizione negato'
            : response.status === 'background-denied'
              ? 'Consenti posizione sempre per il tracking'
              : 'Errore avvio posizione';
        Alert.alert('Posizione', msg);
      }
    };

    const confirmAndStart = (payload: any) => {
      Alert.alert(
        'Monitoraggio posizione',
        'Per analisi dati del locale, avviamo il monitoraggio della posizione durante la permanenza.',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Avvia', onPress: () => void handleVenueStay(payload) },
        ],
      );
    };

    const handleNotificationRouting = (payload: any) => {
      if (!payload?.type) return;

      if (payload.type === 'friend_request_received') {
        navigate('ClientHome', { openTab: 'friends' });
        return;
      }

      if (
        payload.type === 'table_invitation_received' ||
        payload.type === 'table_invitation_updated' ||
        payload.type === 'table_invitation_response'
      ) {
        navigate('ClientHome', { openTab: 'friends' });
        return;
      }

      if (payload.type === 'promo_created') {
        navigate('ClientHome', { openTab: 'home' });
        return;
      }

      if (payload.type === 'venue_stay') {
        confirmAndStart(payload);
      }
    };

    const register = async () => {
      const result = await registerForPushNotifications();
      if (!mounted) return;
      if (result.token) {
        await sendPushToken(result.token);
      }
    };

    const receivedSub = Notifications.addNotificationReceivedListener((event) => {
      const payload = event.request.content.data as any;
      if (payload?.type === 'venue_stay') {
        void handleVenueStay(payload);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((event) => {
      const payload = event.notification.request.content.data as any;
      handleNotificationRouting(payload);
    });

    void (async () => {
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (!lastResponse) return;
      const payload = lastResponse.notification.request.content.data as any;
      handleNotificationRouting(payload);
    })();

    void register();

    return () => {
      mounted = false;
      receivedSub.remove();
      responseSub.remove();
    };
  }, [user?.id, token]);

  const signIn = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    if (!data || !data.access_token) throw new Error('Invalid credentials');
    const normalizedUser = normalizeUser(data.user);
    await persistLogin(data.access_token, normalizedUser);
    setToken(data.access_token);
    setUser(normalizedUser);


  };

  const signOut = async () => {
    try {
      // call backend to revoke token (best-effort), then clear local storage
      await logoutApi();
    } catch (err) {
      // ignore network errors — still clear local session
    }

    await clearLogin();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
