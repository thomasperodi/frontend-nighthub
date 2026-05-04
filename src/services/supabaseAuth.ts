import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

type RecoveryTokens = {
  accessToken: string;
  refreshToken: string;
};

const DEFAULT_RESET_REDIRECT = 'nighthub://reset-password';

let cachedClient: ReturnType<typeof createClient> | null = null;

function getEnv(name: string): string {
  return String((process.env as Record<string, string | undefined>)[name] || '').trim();
}

export function isSupabaseForgotPasswordEnabled(): boolean {
  return getEnv('EXPO_PUBLIC_FORGOT_PASSWORD_PROVIDER').toLowerCase() === 'supabase';
}

export function getSupabaseResetRedirectUrl(): string {
  return getEnv('EXPO_PUBLIC_SUPABASE_RESET_REDIRECT_URL') || DEFAULT_RESET_REDIRECT;
}

function getSupabaseAuthClient() {
  if (cachedClient) return cachedClient;

  const url = getEnv('EXPO_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    throw new Error(
      'Config Supabase mancante: imposta EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}

function parseSearchParams(raw: string | null | undefined): URLSearchParams {
  return new URLSearchParams(String(raw || '').replace(/^\?|^#/, ''));
}

export function extractSupabaseRecoveryTokensFromUrl(url?: string | null): RecoveryTokens | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const query = parseSearchParams(parsed.search);
  const hash = parseSearchParams(parsed.hash);

  const accessToken = query.get('access_token') || hash.get('access_token') || '';
  const refreshToken = query.get('refresh_token') || hash.get('refresh_token') || '';
  const recoveryType = query.get('type') || hash.get('type') || '';

  if (!accessToken || !refreshToken || recoveryType !== 'recovery') {
    return null;
  }

  return {
    accessToken,
    refreshToken,
  };
}

export async function requestSupabasePasswordReset(email: string): Promise<void> {
  const supabase = getSupabaseAuthClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getSupabaseResetRedirectUrl(),
  });

  if (error) {
    throw error;
  }
}

export async function completeSupabasePasswordReset(params: {
  accessToken: string;
  refreshToken: string;
  newPassword: string;
}): Promise<void> {
  const supabase = getSupabaseAuthClient();

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
  });
  if (sessionError) {
    throw sessionError;
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: params.newPassword,
  });
  if (updateError) {
    throw updateError;
  }

  await supabase.auth.signOut();
}
