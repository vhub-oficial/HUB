import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getOrgBucketName } from '../lib/storageHelpers';

export type AssetRow = {
  id: string;
  name: string;
  url: string;
  type: string | null;
  size_mb: number | null;
  tags: string[] | null;
  folder_id: string | null;
  organization_id: string | null;
  created_by: string | null;
  created_at: string | null;
  meta?: any | null;
};

type ListArgs = {
  folderId?: string | null; // null => root assets (folder_id is null). undefined => don't filter by folder
  type?: string | null; // category/aba
  query?: string | null;
  assetKind?: string | null; // legacy (if you used assets.type as "video"), keep for later if needed
  metaFilters?: Record<string, string | null | undefined>;
  tagsAny?: string[] | null; // free tags[] filter (contains all provided)
  limit?: number;
};

export function useAssets(args?: ListArgs) {
  const { organizationId, user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);

  const list = useCallback(async (override?: ListArgs) => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);

    const a = { ...(args ?? {}), ...(override ?? {}) };
    const limit = a.limit ?? 60;

    try {
      let q = supabase
        .from('assets')
        .select('id,name,url,type,size_mb,tags,folder_id,organization_id,created_by,created_at,meta')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      // folder filtering:
      // - folderId === null => root assets only (folder_id IS NULL)
      // - folderId is string => assets within folder_id
      // - folderId === undefined => no folder filter
      if (a.folderId === null) q = q.is('folder_id', null);
      else if (typeof a.folderId === 'string') q = q.eq('folder_id', a.folderId);

      // Category / Aba
      if (a.type) {
        q = q.eq('type', a.type);
      }
      // Free tags[] (all tags must be present)
      if (a.tagsAny && a.tagsAny.length) {
        q = q.contains('tags', a.tagsAny);
      }
      if (a.query) {
        q = q.ilike('name', `%${a.query}%`);
      }
      // meta filters (exact match)
      if (a.metaFilters) {
        for (const [k, v] of Object.entries(a.metaFilters)) {
          if (!v) continue;
          q = q.filter(`meta->>${k}`, 'eq', v);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      setAssets((data ?? []) as AssetRow[]);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar assets');
    } finally {
      setLoading(false);
    }
  }, [args, organizationId]);

  const genUUID = () => {
    // Browser-safe UUID (supported in modern browsers)
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as any).randomUUID();
    }
    // Fallback (rare): RFC4122-ish
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const uploadAsset = useCallback(async (
    file: File,
    opts: { folderId?: string | null; tags: string[]; categoryType: string; meta?: any }
  ) => {
    if (!organizationId) throw new Error('organizationId ausente');
    if (!user?.id) throw new Error('não autenticado');
    if (role === 'viewer') throw new Error('viewer não pode fazer upload');
    if (!opts.tags?.length) throw new Error('tags obrigatórias');

    const bucket = getOrgBucketName(organizationId);
    const safeName = file.name.replace(/\s+/g, '-');
    const filename = `${Date.now()}-${safeName}`;
    const folderPath = opts.folderId ? `folders/${opts.folderId}` : 'root';
    const objectPath = `${folderPath}/${filename}`;

    // 1) Upload to storage (bucket is private)
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(objectPath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
    if (upErr) throw upErr;

    // 2) Insert in assets
    // IMPORTANT: store objectPath in assets.url (private storage). UI will create signed URL for preview/download.
    const sizeMb = file.size / (1024 * 1024);
    // Here, assets.type is the CATEGORY/ABA (deepfakes, tiktok, etc.)
    const categoryType = opts.categoryType;
    const assetId = genUUID();

    const { data: inserted, error: insErr } = await supabase
      .from('assets')
      .insert({
        id: assetId,
        name: file.name,
        url: objectPath,
        type: categoryType,
        size_mb: sizeMb,
        tags: opts.tags,
        folder_id: opts.folderId ?? null,
        organization_id: organizationId,
        created_by: user.id,
        created_at: new Date().toISOString(),
        meta: {
          source: 'storage',
          original_name: file.name,
          mime_type: file.type || null,
          ...((opts.meta ?? {}) as any),
        },
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    // 3) Update storage_usage incrementally (GB)
    const deltaGb = sizeMb / 1024;
    const { data: usage, error: uErr } = await supabase
      .from('storage_usage')
      .select('used_space_gb')
      .eq('organization_id', organizationId)
      .single();
    if (uErr) throw uErr;

    const currentGb = Number((usage as any)?.used_space_gb ?? 0);
    const nextGb = currentGb + deltaGb;

    const { error: updErr } = await supabase
      .from('storage_usage')
      .update({
        used_space_gb: nextGb,
        last_updated: new Date().toISOString(),
      })
      .eq('organization_id', organizationId);
    if (updErr) throw updErr;

    // 4) Activity log (best-effort)
    try {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'upload',
        asset_id: inserted?.id ?? null,
        description: `Upload: ${file.name}`,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // ignore logging failure
    }

    return (inserted?.id ?? assetId) as string;
  }, [organizationId, user, role]);

  // Metadata-only asset (no storage upload). Used by the “V•HUB · NOVO ASSET” modal.
  const createAsset = useCallback(async (payload: {
    name: string;
    url: string;
    categoryType: string;
    tags: string[];
    folderId?: string | null;
    meta?: any;
  }) => {
    if (!organizationId) throw new Error('organizationId ausente');
    if (!user?.id) throw new Error('não autenticado');
    if (role === 'viewer') throw new Error('viewer não pode criar assets');
    if (!payload.tags?.length) throw new Error('tags obrigatórias');

    const assetId = genUUID();
    const { data, error } = await supabase
      .from('assets')
      .insert({
        id: assetId,
        name: payload.name,
        url: payload.url,
        type: payload.categoryType,
        size_mb: null,
        tags: payload.tags,
        folder_id: payload.folderId ?? null,
        organization_id: organizationId,
        created_by: user.id,
        created_at: new Date().toISOString(),
        meta: {
          source: 'external',
          ...((payload.meta ?? {}) as any),
        },
      })
      .select('id')
      .single();
    if (error) throw error;
    return (data?.id ?? assetId) as string;
  }, [organizationId, user, role]);

  useEffect(() => {
    list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const memo = useMemo(
    () => ({ loading, error, assets, refresh: list, uploadAsset, createAsset }),
    [loading, error, assets, list, uploadAsset, createAsset]
  );
  return memo;
}
