import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  organization_id: string;
  created_by: string | null;
  created_at: string | null;
  category_type?: string | null;
};

export function useFolders(args?: { parentId?: string | null; type?: string | null }) {
  const { organizationId, user } = useAuth();
  const parentId = args?.parentId ?? null;
  const type = args?.type ?? null;

  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportsCategoryType, setSupportsCategoryType] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!organizationId) return;

      const { error: e } = await supabase
        .from('folders')
        .select('id,category_type')
        .eq('organization_id', organizationId)
        .limit(1);

      if (!mounted) return;

      if (!e) setSupportsCategoryType(true);
      else if ((e as any)?.code === '42703') setSupportsCategoryType(false);
      else setSupportsCategoryType(false);
    })();

    return () => {
      mounted = false;
    };
  }, [organizationId]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);

    const selectCols = supportsCategoryType
      ? 'id,name,parent_id,organization_id,created_by,created_at,category_type'
      : 'id,name,parent_id,organization_id,created_by,created_at';

    let q = supabase
      .from('folders')
      .select(selectCols)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (parentId === null) q = q.is('parent_id', null);
    else q = q.eq('parent_id', parentId);

    if (supportsCategoryType && type) {
      q = q.eq('category_type', type);
    }

    const { data, error: e } = await q;

    if (e) {
      setError(e.message);
      setFolders([]);
    } else {
      setFolders((data ?? []) as FolderRow[]);
    }

    setLoading(false);
  }, [organizationId, parentId, supportsCategoryType, type]);

  const getFolderById = useCallback(async (id: string) => {
    if (!organizationId) return null;

    const baseCols = 'id,name,parent_id,organization_id,created_by,created_at';
    const cols = supportsCategoryType ? `${baseCols},category_type` : baseCols;

    const { data, error: e } = await supabase
      .from('folders')
      .select(cols)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .single();

    if (e) return null;
    return data as FolderRow;
  }, [organizationId, supportsCategoryType]);

  const getBreadcrumb = useCallback(async (folderId: string) => {
    const chain: FolderRow[] = [];
    let currentId: string | null = folderId;
    let guard = 0;

    while (currentId && guard < 20) {
      // eslint-disable-next-line no-await-in-loop
      const node = await getFolderById(currentId);
      if (!node) break;
      chain.unshift(node);
      currentId = node.parent_id;
      guard += 1;
    }

    return chain;
  }, [getFolderById]);

  useEffect(() => {
    load();
  }, [load]);

  const createFolder = useCallback(
    async (name: string, opts?: { parentId?: string | null; type?: string | null }) => {
      if (!organizationId || !user?.id) throw new Error('Sem organização/usuário');

      const clean = name.trim();
      if (!clean) throw new Error('Nome inválido');

      const payload: any = {
        name: clean,
        organization_id: organizationId,
        parent_id: opts?.parentId ?? null,
        created_by: user.id,
      };

      if (supportsCategoryType && opts?.type) {
        payload.category_type = opts.type;
      }

      const { data, error: e } = await supabase
        .from('folders')
        .insert(payload)
        .select('*')
        .single();

      if (e) throw e;

      setFolders((prev) => [data as FolderRow, ...prev]);
      return data as FolderRow;
    },
    [organizationId, supportsCategoryType, user?.id],
  );

  return useMemo(() => ({
    folders,
    loading,
    error,
    reload: load,
    refresh: load,
    createFolder,
    supportsCategoryType,
    getFolderById,
    getBreadcrumb,
  }), [createFolder, error, folders, getBreadcrumb, getFolderById, load, loading, supportsCategoryType]);
}
