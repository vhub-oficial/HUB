import { supabase } from './supabase';

export function getOrgBucketName(organizationId: string) {
  return `videos-org-${organizationId}`;
}

export async function createSignedUrl(bucket: string, path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}
