import { supabase } from './supabase';

export function getOrgBucketName(organizationId: string) {
  return `videos-org-${organizationId}`;
}

// In-memory cache for signed urls to avoid re-signing on every render.
// Keyed by: bucket|path|expiresInSeconds
type SignedCacheEntry = { url: string; expAtMs: number };
const signedUrlCache = new Map<string, SignedCacheEntry>();

export async function createSignedUrl(bucket: string, path: string, expiresInSeconds = 3600) {
  const key = `${bucket}|${path}|${expiresInSeconds}`;
  const now = Date.now();

  const hit = signedUrlCache.get(key);
  if (hit && hit.expAtMs > now) {
    return hit.url;
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;

  const signedUrl = data.signedUrl;

  // store slightly before expiry to avoid edge cases
  const safetySeconds = Math.min(60, Math.max(5, Math.floor(expiresInSeconds * 0.1)));
  const ttlMs = Math.max(5, expiresInSeconds - safetySeconds) * 1000;

  signedUrlCache.set(key, { url: signedUrl, expAtMs: now + ttlMs });

  return signedUrl;
}
