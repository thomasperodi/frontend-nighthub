import * as SecureStore from 'expo-secure-store';
import { api, setAuthToken } from './api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const ONBOARDING_SEEN_KEY = 'onboarding_seen_v1';

export type RegisterPayload = {
  email: string;
  username: string;
  password: string;
  role: 'client' | 'venue' | 'staff' | 'admin';
  name: string;
  phone?: string;
  avatar?: string;
  sesso: 'M' | 'F' | 'ALTRO';
  birth_date?: string;
  venue_id?: string;
};

export async function getOnboardingSeen(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_SEEN_KEY);
  return value === '1';
}

export async function setOnboardingSeen(seen: boolean = true): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_SEEN_KEY, seen ? '1' : '0');
}

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password });
  return res.data; // { access_token, user }
}

export async function register(payload: RegisterPayload) {
  const res = await api.post('/auth/register', payload);
  return res.data;
}

export async function persistLogin(token: string, user: any) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  setAuthToken(token);
}

export async function clearLogin() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  setAuthToken(null);
}

export async function logoutApi() {
  // call backend logout (uses Authorization header if set)
  await api.post('/auth/logout');
}

export async function deleteAccountApi() {
  // delete current user (requires Authorization header)
  const res = await api.delete('/auth/me');
  return res.data;
}

export async function restoreLogin() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const userJson = await SecureStore.getItemAsync(USER_KEY);
  const user = userJson ? JSON.parse(userJson) : null;
  if (token) setAuthToken(token);
  return { token, user };
}
