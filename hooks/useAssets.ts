import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
};

type ListArgs = {
  folderId?: string | null; // null => root assets (folder_id is null). undefined => don't filter by folder
  tag?: string | null;
  query?: string | null;
  type?: string | null;
  limit?: number;
};

export function useAssets(args?: ListArgs) {
  const { organizationId } = useAuth();
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
        .select('id,name,url,type,size_mb,tags,folder_id,organization_id,created_by,created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      // folder filtering:
      // - folderId === null => root assets only (folder_id IS NULL)
      // - folderId is string => assets within folder_id
      // - folderId === undefined => no folder filter
      if (a.folderId === null) q = q.is('folder_id', null);
      else if (typeof a.folderId === 'string') q = q.eq('folder_id', a.folderId);

      if (a.tag) {
        // tags is text[] (ARRAY), use contains
        q = q.contains('tags', [a.tag]);
      }
      if (a.query) {
        q = q.ilike('name', `%${a.query}%`);
      }
      if (a.type) {
        q = q.eq('type', a.type);
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

  useEffect(() => {
    list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const memo = useMemo(() => ({ loading, error, assets, refresh: list }), [loading, error, assets, list]);
  return memo;
}
