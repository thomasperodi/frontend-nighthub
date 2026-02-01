import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
console.log('API URL:', process.env.EXPO_PUBLIC_API_URL);


// console.log(`API baseURL: ${baseURL}`);
export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Interceptor per errori di rete più chiari
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.message = `Network Error: impossibile raggiungere il server (${API_URL}). Controlla che il backend sia in esecuzione e l'indirizzo sia raggiungibile dal dispositivo.`;
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
