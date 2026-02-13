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
  last_asset_at?: string | null;
};

export function useFolders(args?: { parentId?: string | null; type?: string | null; sort?: 'recent' | 'name' | 'activity' }) {
  const { organizationId, user } = useAuth();
  const parentId = args?.parentId ?? null;
  const type = args?.type ?? null;
  const sort = args?.sort ?? 'recent';

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

    if (sort === 'activity' && type && parentId === null) {
      const { data, error: e } = await supabase.rpc('get_folders_with_stats', { p_category_type: type });
      if (e) {
        setError(e.message);
        setFolders([]);
        setLoading(false);
        return;
      }

      const sorted = (data ?? []).sort((a: any, b: any) => {
        const ta = a.last_asset_at ? new Date(a.last_asset_at).getTime() : 0;
        const tb = b.last_asset_at ? new Date(b.last_asset_at).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setFolders(sorted as FolderRow[]);
      setLoading(false);
      return;
    }

    const selectCols = supportsCategoryType
      ? 'id,name,parent_id,organization_id,created_by,created_at,category_type'
      : 'id,name,parent_id,organization_id,created_by,created_at';

    let q = supabase
      .from('folders')
      .select(selectCols)
      .eq('organization_id', organizationId)
      .limit(200);

    if (parentId === null) q = q.is('parent_id', null);
    else q = q.eq('parent_id', parentId);

    if (supportsCategoryType && type) {
      q = q.eq('category_type', type);
    }

    if (sort === 'name') q = q.order('name', { ascending: true });
    else q = q.order('created_at', { ascending: false });

    const { data, error: e } = await q;

    if (e) {
      setError(e.message);
      setFolders([]);
    } else {
      setFolders((data ?? []) as FolderRow[]);
    }

    setLoading(false);
  }, [organizationId, parentId, sort, supportsCategoryType, type]);

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
      const categoryType = opts?.type ?? null;
      if (!categoryType) throw new Error('Selecione uma categoria antes de criar uma pasta.');

      const payload: any = {
        name: clean,
        organization_id: organizationId,
        parent_id: opts?.parentId ?? null,
        created_by: user.id,
        category_type: categoryType,
      };

      const { data, error: e } = await supabase
        .from('folders')
        .insert(payload)
        .select('id,name,category_type,parent_id,organization_id,created_by,created_at')
        .single();

      if (e) throw e;

      setFolders((prev) => [data as FolderRow, ...prev]);
      return data as FolderRow;
    },
    [organizationId, user?.id],
  );


  const renameFolder = useCallback(async (folderId: string, nextName: string) => {
    const name = nextName.trim();
    if (!name) throw new Error('Nome inválido.');

    const { data, error } = await supabase
      .from('folders')
      .update({ name })
      .eq('id', folderId)
      .select('id,name,category_type,parent_id,organization_id,created_by,created_at')
      .single();

    if (error) throw error;

    setFolders((prev) => prev.map((f) => (f.id === folderId ? (data as any) : f)));
    return data;
  }, [supabase]);

  const deleteFolder = useCallback(async (folderId: string) => {
    const { error: detachErr } = await supabase
      .from('assets')
      .update({ folder_id: null })
      .eq('folder_id', folderId);

    if (detachErr) throw detachErr;

    const { error: delErr } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (delErr) throw delErr;

    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  }, [supabase]);

  return useMemo(() => ({
    folders,
    loading,
    error,
    reload: load,
    refresh: load,
    createFolder,
    renameFolder,
    deleteFolder,
    supportsCategoryType,
    getFolderById,
    getBreadcrumb,
  }), [createFolder, deleteFolder, error, folders, getBreadcrumb, getFolderById, load, loading, renameFolder, supportsCategoryType]);
}
