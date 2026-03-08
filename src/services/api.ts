import axios from 'axios';
import { Platform } from 'react-native';

const RAW_API_URL = (process.env.EXPO_PUBLIC_API_URL || '').trim();

function resolveApiBaseUrl(rawUrl: string): string {
  const fallback = 'http://localhost:3000';
  let value = rawUrl || fallback;

  if (!/^https?:\/\//i.test(value)) {
    value = `http://${value}`;
  }

  value = value.replace(/\/+$/, '');

  try {
    const parsed = new URL(value);
    const isLoopback =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    if (Platform.OS === 'android' && isLoopback) {
      parsed.hostname = '10.0.2.2';
      value = parsed.toString().replace(/\/$/, '');
    }
  } catch {
    value = fallback;
  }

  return value;
}

const API_BASE_URL = resolveApiBaseUrl(RAW_API_URL);
console.log('API URL:', RAW_API_URL || 'http://localhost:3000');
console.log('API baseURL:', API_BASE_URL);


// console.log(`API baseURL: ${baseURL}`);
export const api = axios.create({
  baseURL: API_BASE_URL ,
  timeout: 10000,
});

// Interceptor per errori di rete più chiari
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.message = `Network Error: impossibile raggiungere il server (${API_BASE_URL}). Controlla che il backend sia in esecuzione e l'indirizzo sia raggiungibile dal dispositivo.`;
    }
    return Promise.reject(error);
  }
);

// Funzione per impostare / rimuovere il token JWT
export function setAuthToken(token?: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}
