type WalletProvider = 'apple' | 'google' | null;

type BuildTrackedEventLinkParams = {
  eventId: string;
  refCode?: string | null;
  wallet?: WalletProvider;
};

export type TrackedEventLinks = {
  smartUrl: string;
  webUrl: string;
  appDeepLink: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  appleWalletUrl: string;
  googleWalletUrl: string;
};

const DEFAULT_ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.perodithomas.nighthub';
const DEFAULT_APP_WEB_URL = 'https://nighthub.app';

function normalizeBaseUrl(value: string | undefined | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}

function buildUrl(base: string, path: string, params: URLSearchParams) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const query = params.toString();
  return `${base}${normalizedPath}${query ? `?${query}` : ''}`;
}

function getAppWebBase() {
  return (
    normalizeBaseUrl(process.env.EXPO_PUBLIC_APP_SHARE_URL) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_APP_BASE_URL) ||
    DEFAULT_APP_WEB_URL
  );
}

function getSmartRedirectBase() {
  return (
    normalizeBaseUrl(process.env.EXPO_PUBLIC_APP_SHARE_URL) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_APP_BASE_URL) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL) ||
    DEFAULT_APP_WEB_URL
  );
}

function getIosStoreUrl() {
  return (
    normalizeBaseUrl(process.env.EXPO_PUBLIC_APP_STORE_URL) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_PLAY_STORE_URL) ||
    DEFAULT_ANDROID_STORE_URL
  );
}

function getAndroidStoreUrl() {
  return (
    normalizeBaseUrl(process.env.EXPO_PUBLIC_PLAY_STORE_URL) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_APP_STORE_URL) ||
    DEFAULT_ANDROID_STORE_URL
  );
}

function buildQuery(refCode?: string | null, wallet?: WalletProvider) {
  const params = new URLSearchParams();
  if (refCode) params.set('pr', refCode);
  if (wallet) params.set('wallet', wallet);
  return params;
}

export function buildTrackedEventLinks({
  eventId,
  refCode,
  wallet = null,
}: BuildTrackedEventLinkParams): TrackedEventLinks {
  const encodedEventId = encodeURIComponent(eventId);

  const iosStoreUrl = getIosStoreUrl();
  const androidStoreUrl = getAndroidStoreUrl();
  const appWebBase = getAppWebBase();
  const smartBase = getSmartRedirectBase();

  const query = buildQuery(refCode, wallet);
  const walletAppleQuery = buildQuery(refCode, 'apple');
  const walletGoogleQuery = buildQuery(refCode, 'google');

  const appDeepLink = buildUrl('nighthub:/', `/event/${encodedEventId}`, query).replace(
    'nighthub:///',
    'nighthub://',
  );

  return {
    smartUrl: buildUrl(smartBase, `/r/event/${encodedEventId}`, query),
    webUrl: buildUrl(appWebBase, `/event/${encodedEventId}`, query),
    appDeepLink,
    iosStoreUrl,
    androidStoreUrl,
    appleWalletUrl: buildUrl(smartBase, `/r/event/${encodedEventId}`, walletAppleQuery),
    googleWalletUrl: buildUrl(smartBase, `/r/event/${encodedEventId}`, walletGoogleQuery),
  };
}
