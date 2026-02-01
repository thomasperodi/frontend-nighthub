import * as SecureStore from 'expo-secure-store';

const LEGAL_ACCEPTED_KEY = 'legal_accepted_v1';

export async function getLegalAccepted(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(LEGAL_ACCEPTED_KEY);
    return value === '1';
  } catch {
    return false;
  }
}

export async function setLegalAccepted(accepted: boolean = true): Promise<void> {
  try {
    await SecureStore.setItemAsync(LEGAL_ACCEPTED_KEY, accepted ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}
