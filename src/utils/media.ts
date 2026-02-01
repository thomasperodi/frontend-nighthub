function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function resolveEventImageUri(image?: string | null): string | undefined {
  if (!image) return undefined;

  // Already usable by <Image />
  if (/^(https?:)?\/\//i.test(image) || image.startsWith('data:')) {
    return image;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const bucket =
    process.env.EXPO_PUBLIC_SUPABASE_BUCKET_EVENTS ||
    process.env.EXPO_PUBLIC_SUPABASE_BUCKET ||
    'NightHub';

  if (!supabaseUrl) {
    // Fallback: keep the raw path (useful to spot misconfiguration quickly)
    return image;
  }

  const base = supabaseUrl.replace(/\/$/, '');

  // If API returns a storage-relative path (common when you don't want to store full URLs)
  // Example: /storage/v1/object/public/NightHub/events/<uuid>.png
  if (image.startsWith('/storage/v1/object/')) {
    return `${base}${image}`;
  }
  if (image.startsWith('storage/v1/object/')) {
    return `${base}/${image}`;
  }

  // If someone stored a bucket-prefixed key, normalize it.
  // Example: NightHub/events/<uuid>.png -> events/<uuid>.png
  const withoutLeadingSlash = image.startsWith('/') ? image.slice(1) : image;
  const key = withoutLeadingSlash.startsWith(`${bucket}/`)
    ? withoutLeadingSlash.slice(bucket.length + 1)
    : withoutLeadingSlash;

  const encoded = encodePath(key);

  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}
