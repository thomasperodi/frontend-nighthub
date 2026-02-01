import React, { createContext, useContext, useEffect, useState } from 'react';
import { login as apiLogin, persistLogin, clearLogin, restoreLogin, logoutApi } from '../services/auth';
import { resetTo } from '../navigation/NavigationService';

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
    (async () => {
      const res = await restoreLogin();
      if (res.token) {
        setToken(res.token);
        setUser(normalizeUser(res.user));
      }
      setLoading(false);
    })();
  }, []);

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

    // Always land on Login after logout
    resetTo('Login');
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
