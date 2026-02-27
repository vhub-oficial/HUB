import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getOrgBucketName } from '../lib/storageHelpers';
import { storageUploadWithProgress } from '../lib/storageUploadWithProgress';

let disableActivityLogs = false;

// ✅ Thumbs públicas (CDN) — bucket global
const THUMBS_BUCKET = 'vhub-thumbs';

async function canvasToThumbBlob(canvas: HTMLCanvasElement): Promise<{ blob: Blob; mime: string; ext: string }> {
  const tryBlob = (mime: string, quality: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), mime, quality));

  const webp = await tryBlob('image/webp', 0.82);
  if (webp) return { blob: webp, mime: 'image/webp', ext: 'webp' };

  const jpg = await tryBlob('image/jpeg', 0.86);
  if (jpg) return { blob: jpg, mime: 'image/jpeg', ext: 'jpg' };

  throw new Error('thumb_blob_failed');
}

async function imageFileToThumb(file: File, maxW = 640) {
  const img = new Image();
  const url = URL.createObjectURL(file);

  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('image_load_failed'));
      img.src = url;
    });

    const scale = Math.min(1, maxW / img.width);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no_canvas');

    ctx.drawImage(img, 0, 0, w, h);

    return await canvasToThumbBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function videoFileToThumb(file: File, seekSeconds = 0.5, maxW = 640) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error('video_meta_failed'));
      video.src = url;
      video.load();
    });

    const duration = Number(video.duration || 0);
    const t = duration > 0 ? Math.min(Math.max(seekSeconds, 0), Math.max(0, duration - 0.1)) : 0;

    await new Promise<void>((res, rej) => {
      video.onseeked = () => res();
      video.onerror = () => rej(new Error('video_seek_failed'));
      video.currentTime = t;
    });

    await new Promise<void>((res, rej) => {
      if (video.readyState >= 2) return res();
      video.onloadeddata = () => res();
      video.onerror = () => rej(new Error('video_loadeddata_failed'));
    });

    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;

    const scale = Math.min(1, maxW / vw);
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no_canvas');

    ctx.drawImage(video, 0, 0, w, h);

    return await canvasToThumbBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
  assetKind?: string | null;
  metaFilters?: Record<string, string> | null;
  tagsAny?: string[] | null;
  limit?: number; // page size
};

type Cursor = { created_at: string; id: string } | null;

export function useAssets(args?: AssetsArgs) {
  const { organizationId, user, role } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<Cursor>(null);

  // ✅ stable key to avoid infinite refetch when args object identity changes
  const argsKey = useMemo(() => {
    try {
      // IMPORTANT: argsKey should NOT include volatile cursor state
      return JSON.stringify(args ?? {});
    } catch {
      return 'args';
    }
  }, [args]);

  // track latest argsKey for safety inside callbacks (avoid stale closures)
  const argsKeyRef = useRef(argsKey);
  useEffect(() => {
    argsKeyRef.current = argsKey;
  }, [argsKey]);

  const genUUID = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as any).randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const sanitizeObjectName = (name: string) => {
    const trimmed = (name || 'file').trim();
    const parts = trimmed.split('.');
    const ext = parts.length > 1 ? `.${parts.pop()}` : '';
    const base = parts.join('.') || 'file';
    const ascii = base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const safeBase = ascii || 'file';
    return `${safeBase}${ext}`.slice(0, 160);
  };

  // build the base query (without cursor)
  const buildQuery = useCallback(
    (a: AssetsArgs, limit: number) => {
      let q = supabase
        .from('assets')
        .select('id,name,url,type,size_mb,tags,folder_id,organization_id,created_by,created_at,meta')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);

      // folder filtering
      if (a.onlyUnfoldered) {
        q = q.is('folder_id', null);
      } else if (typeof a.folderId === 'string') {
        q = q.eq('folder_id', a.folderId);
      } else if (a.folderId === null) {
        q = q.is('folder_id', null);
      }

      // category
      if (a.type) q = q.eq('type', a.type);

      // tags ANY
      if (a.tagsAny && a.tagsAny.length) {
        q = q.overlaps('tags', a.tagsAny);
      }

      // search
      if (a.query) {
        const qq = a.query.trim();
        const tagQ = qq.toLowerCase().replace(/\s+/g, '-');
        q = q.or(`name.ilike.%${qq}%,tags.cs.{${tagQ}}`);
      }

      // meta filters
      if (a.metaFilters) {
        for (const [k, v] of Object.entries(a.metaFilters)) {
          if (!v) continue;
          q = q.filter(`meta->>${k}`, 'ilike', `%${v}%`);
        }
      }

      return q;
    },
    [organizationId]
  );

  // apply keyset cursor (created_at DESC, id DESC)
  const applyCursor = (q: any, c: Cursor) => {
    if (!c) return q;
    // (created_at < c.created_at) OR (created_at = c.created_at AND id < c.id)
    return q.or(`created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`);
  };

  const fetchFirstPage = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);

    const a: AssetsArgs = { ...(args ?? {}) };
    const pageSize = a.limit ?? 60;

    try {
      const q0 = buildQuery(a, pageSize + 1); // +1 to detect hasMore
      const { data, error } = await q0;
      if (error) throw error;

      const rows = (data ?? []) as AssetRow[];
      const nextHasMore = rows.length > pageSize;
      const page = nextHasMore ? rows.slice(0, pageSize) : rows;

      setAssets(page);
      setHasMore(nextHasMore);

      const last = page[page.length - 1];
      setCursor(last?.created_at && last?.id ? { created_at: last.created_at, id: last.id } : null);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar assets');
      setAssets([]);
      setHasMore(false);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId, args, buildQuery]);

  const loadMore = useCallback(async () => {
    if (!organizationId) return;
    if (loadingMore) return;
    if (!hasMore) return;

    const c = cursor;
    if (!c) return;

    setLoadingMore(true);
    setError(null);

    const a: AssetsArgs = { ...(args ?? {}) };
    const pageSize = a.limit ?? 60;

    try {
      let q = buildQuery(a, pageSize + 1);
      q = applyCursor(q, c);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as AssetRow[];
      const nextHasMore = rows.length > pageSize;
      const page = nextHasMore ? rows.slice(0, pageSize) : rows;

      // dedupe by id (safety)
      setAssets((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const r of page) {
          if (!seen.has(r.id)) merged.push(r);
        }
        return merged;
      });

      setHasMore(nextHasMore);

      const last = page[page.length - 1];
      if (last?.created_at && last?.id) {
        setCursor({ created_at: last.created_at, id: last.id });
      } else {
        // if no rows returned, stop
        if (!page.length) setHasMore(false);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar mais assets');
    } finally {
      setLoadingMore(false);
    }
  }, [organizationId, args, buildQuery, cursor, hasMore, loadingMore]);

  const refresh = useCallback(async () => {
    // refresh resets pagination and fetches first page again
    setCursor(null);
    setHasMore(false);
    await fetchFirstPage();
  }, [fetchFirstPage]);

  const uploadAsset = useCallback(
    async (
      file: File,
      opts: { folderId?: string | null; tags: string[]; categoryType: string; meta?: any; displayName: string },
      extra?: { onProgress?: (pct: number) => void; signal?: AbortSignal }
    ) => {
      if (!organizationId) throw new Error('organizationId ausente');
      if (!user?.id) throw new Error('não autenticado');
      if (role === 'viewer') throw new Error('viewer não pode fazer upload');
      if (!opts.tags?.length) throw new Error('tags obrigatórias');

      const bucket = getOrgBucketName(organizationId);
      const safeName = sanitizeObjectName(file.name);
      const uploadId = genUUID();
      const filename = `${uploadId}-${safeName}`;
      const folderPath = opts.folderId ? `folders/${opts.folderId}` : 'root';
      const objectPath = `${folderPath}/${filename}`;

      // ✅ Upload real com progresso (0–90% fica na UI; o resto é insert/usage/thumbnail)
      await storageUploadWithProgress({
        bucket,
        objectPath,
        file,
        upsert: false,
        signal: extra?.signal,
        onProgress: (pct) => {
          // mapeia 0..100 -> 0..90 (deixa margem para insert/usage/thumbnail)
          const uiPct = Math.min(90, Math.max(0, Math.round(pct * 0.9)));
          extra?.onProgress?.(uiPct);
        },
      });

      // pequeno “checkpoint” pra evitar sensação de travamento ao sair do upload
      extra?.onProgress?.(Math.max(extra?.onProgress ? 90 : 90, Math.min(92, 90)));

      let thumb: { path: string; mime: string } | null = null;

      try {
        const isImg = file.type?.startsWith('image/');
        const isVid = file.type?.startsWith('video/');

        if (isImg || isVid) {
          const out = isImg ? await imageFileToThumb(file, 640) : await videoFileToThumb(file, 0.5, 640);
          const thumbName = `${genUUID()}-thumb.${out.ext}`;
          const thumbPath = `${organizationId}/${folderPath}/thumbs/${thumbName}`;

          const upThumb = await supabase.storage.from(THUMBS_BUCKET).upload(
            thumbPath,
            new File([out.blob], `thumb.${out.ext}`, { type: out.mime }),
            {
            upsert: false,
            contentType: out.mime,
            cacheControl: '31536000',
            }
          );

          if (!upThumb.error) {
            thumb = { path: thumbPath, mime: out.mime };
          }
        }
      } catch {
        thumb = null;
      }

      const sizeMb = file.size / (1024 * 1024);
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
            ...(thumb ? { thumbnail_path: thumb.path, thumbnail_mime: thumb.mime, thumbnail_bucket: THUMBS_BUCKET } : {}),
            ...((opts.meta ?? {}) as any),
          },
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      extra?.onProgress?.(95);

      // storage usage (best-effort but still deterministic enough for now)
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
        .update({ used_space_gb: nextGb, last_updated: new Date().toISOString() })
        .eq('organization_id', organizationId);
      if (updErr) throw updErr;

      try {
        if (!disableActivityLogs) {
          const { error: logErr } = await supabase.from('activity_logs').insert({
            user_id: user.id,
            action: 'upload',
            asset_id: inserted?.id ?? null,
            description: `Upload: ${file.name}`,
            timestamp: new Date().toISOString(),
          });
          if (logErr) disableActivityLogs = true;
        }
      } catch {
        disableActivityLogs = true;
      }

      extra?.onProgress?.(100);

      return (inserted?.id ?? assetId) as string;
    },
    [organizationId, user, role]
  );

  const createAsset = useCallback(
    async (payload: {
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
    },
    [organizationId, user, role]
  );

  const getAssetById = useCallback(
    async (id: string) => {
      if (!organizationId) throw new Error('organizationId ausente');
      const { data, error } = await supabase
        .from('assets')
        .select('id,name,url,type,size_mb,tags,folder_id,organization_id,created_by,created_at,meta')
        .eq('organization_id', organizationId)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as AssetRow;
    },
    [organizationId]
  );

  const updateAsset = useCallback(
    async (assetId: string, patch: Partial<AssetRow>) => {
      if (!organizationId) throw new Error('organizationId ausente');
      if (!user?.id) throw new Error('não autenticado');
      if (role === 'viewer') throw new Error('viewer não pode editar');

      const upd: any = {};
      if (patch.name !== undefined) upd.name = patch.name;
      if (patch.tags !== undefined) upd.tags = patch.tags;
      if (patch.meta !== undefined) upd.meta = patch.meta;
      if (patch.url !== undefined) upd.url = patch.url;

      if (Object.keys(upd).length === 0) return true;

      const { error } = await supabase
        .from('assets')
        .update(upd)
        .eq('organization_id', organizationId)
        .eq('id', assetId);

      if (error) throw error;

      setAssets((prev) => prev.map((a) => (a.id === assetId ? ({ ...a, ...upd } as AssetRow) : a)));

      return true;
    },
    [organizationId, user, role]
  );

  const deleteAsset = useCallback(
    async (asset: AssetRow) => {
      if (!organizationId) throw new Error('organizationId ausente');
      if (!user?.id) throw new Error('não autenticado');
      if (role !== 'admin') throw new Error('Apenas admin pode deletar');

      const source =
        asset.meta?.source ??
        (typeof asset.url === 'string' && /^https?:\/\//i.test(asset.url) ? 'external' : 'storage');

      if (source === 'storage') {
        const bucket = getOrgBucketName(organizationId);
        const { error: stErr } = await supabase.storage.from(bucket).remove([asset.url]);
        if (stErr) throw stErr;

        try {
          const tBucket = (asset.meta as any)?.thumbnail_bucket as string | undefined;
          const tPath = (asset.meta as any)?.thumbnail_path as string | undefined;
          if (tBucket && tPath) {
            await supabase.storage.from(tBucket).remove([tPath]);
          }
        } catch {
          // ignore
        }
      }

      const { error: delErr } = await supabase.from('assets').delete().eq('organization_id', organizationId).eq('id', asset.id);
      if (delErr) throw delErr;

      try {
        if (source === 'storage' && asset.size_mb) {
          const deltaGb = Number(asset.size_mb) / 1024;
          const { data: usage } = await supabase.from('storage_usage').select('used_space_gb').eq('organization_id', organizationId).single();
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
    },
    [organizationId, user, role]
  );

  const moveAssetToFolder = useCallback(
    async (assetId: string, folderId: string | null) => {
      if (!organizationId) throw new Error('Sem organização');
      const { data, error } = await supabase
        .from('assets')
        .update({ folder_id: folderId })
        .eq('id', assetId)
        .eq('organization_id', organizationId)
        .select('id,folder_id')
        .single();

      if (error) throw error;

      // optimistic update (keep list responsive)
      setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, folder_id: data.folder_id } : a)));

      return data;
    },
    [organizationId]
  );

  // ✅ refetch first page whenever args change
  useEffect(() => {
    if (!organizationId) return;
    // reset pagination on args change
    setCursor(null);
    setHasMore(false);
    fetchFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, argsKey]);

  // ✅ Global refresh when any asset changes (upload/create/delete)
  useEffect(() => {
    const handler = () => {
      if (!organizationId) return;
      refresh();
    };
    window.addEventListener('vah:assets_changed', handler as EventListener);
    return () => window.removeEventListener('vah:assets_changed', handler as EventListener);
  }, [organizationId, refresh]);

  const memo = useMemo(
    () => ({
      loading,
      loadingMore,
      error,
      assets,
      hasMore,
      refresh,
      loadMore,
      uploadAsset,
      createAsset,
      getAssetById,
      updateAsset,
      deleteAsset,
      moveAssetToFolder,
    }),
    [
      loading,
      loadingMore,
      error,
      assets,
      hasMore,
      refresh,
      loadMore,
      uploadAsset,
      createAsset,
      getAssetById,
      updateAsset,
      deleteAsset,
      moveAssetToFolder,
    ]
  );

  return memo;
}
