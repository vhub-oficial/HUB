import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getOrgBucketName } from '../lib/storageHelpers';

let disableActivityLogs = false;

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

type AssetsArgs = {
  folderId?: string | null; // null => root assets (folder_id is null). undefined => don't filter by folder
  onlyUnfoldered?: boolean;
  type?: string | null; // category/aba
  query?: string | null;
  assetKind?: string | null; // legacy (if you used assets.type as "video"), keep for later if needed
  metaFilters?: Record<string, string> | null;
  tagsAny?: string[] | null; // free tags[] filter (ANY match)
  limit?: number;
};

export function useAssets(args?: AssetsArgs) {
  const { organizationId, user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);

  // ✅ stable key to avoid infinite refetch when args object identity changes
  const argsKey = useMemo(() => {
    try {
      return JSON.stringify(args ?? {});
    } catch {
      return 'args';
    }
  }, [args]);

  const list = useCallback(async (override?: AssetsArgs) => {
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
      if (a.onlyUnfoldered) {
        q = q.is('folder_id', null);
      }
      if (a.folderId) q = q.eq('folder_id', a.folderId);
      else if (a.folderId === null) q = q.is('folder_id', null);

      // Category / Aba
      if (a.type) {
        q = q.eq('type', a.type);
      }
      if (a.folderId) {
        q = q.eq('folder_id', a.folderId);
      }
      // Free tags[] (ANY tag can match) — better UX for filters
      if (a.tagsAny && a.tagsAny.length) {
        // PostgREST operator: overlaps = any intersection
        q = q.overlaps('tags', a.tagsAny);
      }
      if (a.query) {
        const qq = a.query.trim();
        const tagQ = qq.toLowerCase().replace(/\s+/g, '-');
        // name OR tags contains tagQ
        // (tags.cs.{x} = array contains x)
        q = q.or(`name.ilike.%${qq}%,tags.cs.{${tagQ}}`);
      }
      // meta filters (exact match)
      if (a.metaFilters) {
        for (const [k, v] of Object.entries(a.metaFilters)) {
          if (!v) continue;
          // case-insensitive match to avoid "Adele" vs "adele"
          q = q.filter(`meta->>${k}`, 'ilike', `%${v}%`);
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

  // Keep storage object paths safe across browsers/OS and Supabase Storage.
  // - strip accents (NFD)
  // - allow only [a-zA-Z0-9._-]
  // - collapse multiple dashes
  // - keep extension
  const sanitizeObjectName = (name: string) => {
    const trimmed = (name || 'file').trim();
    const parts = trimmed.split('.');
    const ext = parts.length > 1 ? `.${parts.pop()}` : '';
    const base = parts.join('.') || 'file';
    const ascii = base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/[^a-zA-Z0-9._-]+/g, '-') // replace unsafe chars with '-'
      .replace(/-+/g, '-') // collapse
      .replace(/^-|-$/g, ''); // trim dashes
    const safeBase = ascii || 'file';
    return `${safeBase}${ext}`.slice(0, 160);
  };

  const uploadAsset = useCallback(async (
    file: File,
    opts: { folderId?: string | null; tags: string[]; categoryType: string; meta?: any; displayName: string }
  ) => {
    if (!organizationId) throw new Error('organizationId ausente');
    if (!user?.id) throw new Error('não autenticado');
    if (role === 'viewer') throw new Error('viewer não pode fazer upload');
    if (!opts.tags?.length) throw new Error('tags obrigatórias');

    const bucket = getOrgBucketName(organizationId);
    const safeName = sanitizeObjectName(file.name);
    // Use UUID prefix to avoid collisions in rapid multi-upload
    const uploadId = genUUID();
    const filename = `${uploadId}-${safeName}`;
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
        name: opts.displayName || file.name,
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
      if (!disableActivityLogs) {
        const { error: logErr } = await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'upload',
          asset_id: inserted?.id ?? null,
          description: `Upload: ${file.name}`,
          timestamp: new Date().toISOString(),
        });
        if (logErr) {
          // stop spamming 400s for the rest of the session
          disableActivityLogs = true;
        }
      }
    } catch {
      disableActivityLogs = true;
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

  const getAssetById = useCallback(async (id: string) => {
    if (!organizationId) throw new Error('organizationId ausente');
    const { data, error } = await supabase
      .from('assets')
      .select('id,name,url,type,size_mb,tags,folder_id,organization_id,created_by,created_at,meta')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as AssetRow;
  }, [organizationId]);

  const updateAsset = useCallback(async (id: string, patch: Partial<AssetRow>) => {
    if (!organizationId) throw new Error('organizationId ausente');
    if (!user?.id) throw new Error('não autenticado');
    if (role === 'viewer') throw new Error('viewer não pode editar');
    const { error } = await supabase
      .from('assets')
      .update({
        name: patch.name,
        tags: patch.tags,
        meta: patch.meta,
        // allow url update ONLY for external assets (enforced in UI)
        url: patch.url,
      })
      .eq('organization_id', organizationId)
      .eq('id', id);
    if (error) throw error;
    return true;
  }, [organizationId, user, role]);

  const deleteAsset = useCallback(async (asset: AssetRow) => {
    if (!organizationId) throw new Error('organizationId ausente');
    if (!user?.id) throw new Error('não autenticado');
    if (role !== 'admin') throw new Error('Apenas admin pode deletar');

    const source = asset.meta?.source ?? (typeof asset.url === 'string' && /^https?:\/\//i.test(asset.url) ? 'external' : 'storage');

    // 1) delete storage object if needed
    if (source === 'storage') {
      const bucket = getOrgBucketName(organizationId);
      const { error: stErr } = await supabase.storage.from(bucket).remove([asset.url]);
      if (stErr) throw stErr;
    }

    // 2) delete row
    const { error: delErr } = await supabase
      .from('assets')
      .delete()
      .eq('organization_id', organizationId)
      .eq('id', asset.id);
    if (delErr) throw delErr;

    // 3) decrement storage usage (best-effort)
    try {
      if (source === 'storage' && asset.size_mb) {
        const deltaGb = Number(asset.size_mb) / 1024;
        const { data: usage } = await supabase
          .from('storage_usage')
          .select('used_space_gb')
          .eq('organization_id', organizationId)
          .single();
        const currentGb = Number((usage as any)?.used_space_gb ?? 0);
        const nextGb = Math.max(0, currentGb - deltaGb);
        await supabase
          .from('storage_usage')
          .update({ used_space_gb: nextGb, last_updated: new Date().toISOString() })
          .eq('organization_id', organizationId);
      }
    } catch {
      // ignore
    }

    return true;
  }, [organizationId, user, role]);

  const moveAssetToFolder = useCallback(async (assetId: string, folderId: string | null) => {
    if (!organizationId) throw new Error('Sem organização');
    const { data, error } = await supabase
      .from('assets')
      .update({ folder_id: folderId })
      .eq('id', assetId)
      .eq('organization_id', organizationId)
      .select('id,folder_id')
      .single();

    if (error) throw error;

    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, folder_id: data.folder_id } : a))
    );

    return data;
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, argsKey]);

  // ✅ Global refresh when any asset changes (upload/create/delete)
  useEffect(() => {
    const handler = () => {
      if (!organizationId) return;
      list();
    };
    window.addEventListener('vah:assets_changed', handler as EventListener);
    return () => window.removeEventListener('vah:assets_changed', handler as EventListener);
  }, [organizationId, list]);

  const memo = useMemo(
    () => ({ loading, error, assets, refresh: list, uploadAsset, createAsset, getAssetById, updateAsset, deleteAsset, moveAssetToFolder }),
    [loading, error, assets, list, uploadAsset, createAsset, getAssetById, updateAsset, deleteAsset, moveAssetToFolder]
  );
  return memo;
}
