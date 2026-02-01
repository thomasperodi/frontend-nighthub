import { api } from './api';
import { API_ENDPOINTS } from '../constants/endpoints';
import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';

function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase config (set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY)',
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function guessExtFromUri(uri: string): string {
  const m = /\.(png|jpe?g|webp)(?:\?|#|$)/i.exec(uri);
  if (!m) return 'jpg';
  const ext = m[1].toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
}

function extToContentType(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function preparePosterForUpload(params: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<{ uri: string; ext: string; contentType: string; fileName: string }> {
  const inputUri = params.uri;

  // We always try to compress posters aggressively to speed up uploads.
  // If anything fails, fall back to the original uri and guessed content type.
  try {
    // expo-image-manipulator is not available on web, and requires a rebuilt dev-client
    // when using expo-dev-client.
    if (Platform.OS === 'web') throw new Error('skip compression on web');

    const ImageManipulator = await import('expo-image-manipulator');

    let bytes: number | null = null;
    try {
      const info = await FileSystem.getInfoAsync(inputUri, { size: true });
      bytes = typeof info.size === 'number' ? info.size : null;
    } catch {
      // ignore; some URI schemes don't support size
    }

    const aggressive = bytes === null ? true : bytes > 1_500_000;
    const actions: ImageManipulator.Action[] = aggressive ? [{ resize: { width: 1280 } }] : [];
    const compress = aggressive ? 0.6 : 0.75;

    const out = await ImageManipulator.manipulateAsync(
      inputUri,
      actions,
      {
        compress,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    return {
      uri: out.uri,
      ext: 'jpg',
      contentType: 'image/jpeg',
      fileName: 'poster.jpg',
    };
  } catch {
    const ext = guessExtFromUri(inputUri);
    return {
      uri: inputUri,
      ext,
      contentType: params.mimeType || extToContentType(ext),
      fileName: params.fileName || `poster.${ext}`,
    };
  }
}

async function uploadEventPosterViaBackend(params: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<string> {
  const prepared = await preparePosterForUpload(params);
  const { uri, contentType, fileName } = prepared;

  const form = new FormData();
  form.append('file', {
    uri,
    type: contentType || 'image/jpeg',
    name: fileName || 'poster.jpg',
  } as any);

  const { data } = await api.post<{ path: string }>(
    API_ENDPOINTS.EVENTS.UPLOAD_POSTER,
    form,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    },
  );

  return data.path;
}

export async function uploadEventPoster(params: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<string> {
  const prepared = await preparePosterForUpload(params);
  const { uri, ext, contentType } = prepared;

  try {
    const { data: signed } = await api.post<{
      bucket: string;
      path: string;
      token: string;
      signedUrl: string;
    }>(API_ENDPOINTS.EVENTS.SIGNED_UPLOAD_POSTER, {
      ext,
      contentType,
    });

    const base64 = await FileSystem.readAsStringAsync(uri, {
      // Expo SDK typings differ across versions; string literal works at runtime.
      encoding: 'base64' as any,
    });
    const bytes = decode(base64);

    const supabase = getSupabaseClient();
    const { error } = await supabase.storage
      .from(signed.bucket)
      .uploadToSignedUrl(signed.path, signed.token, bytes, {
        contentType,
      });

    if (error) {
      throw new Error(error.message);
    }

    return signed.path;
  } catch (e: any) {
    // Fallback for older servers or missing client config.
    return uploadEventPosterViaBackend(params);
  }
}
