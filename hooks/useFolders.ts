import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  organization_id: string | null;
  created_by: string | null;
  created_at: string | null;
};

export function useFolders(parentId?: string | null) {
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);

  const list = useCallback(async (overrideParentId?: string | null) => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    const pid = overrideParentId !== undefined ? overrideParentId : parentId;

    try {
      let q = supabase
        .from('folders')
        .select('id,name,parent_id,organization_id,created_by,created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);

      // root: parent_id IS NULL
      if (pid === null) q = q.is('parent_id', null);
      else if (typeof pid === 'string') q = q.eq('parent_id', pid);

      const { data, error } = await q;
      if (error) throw error;
      setFolders((data ?? []) as FolderRow[]);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar pastas');
    } finally {
      setLoading(false);
    }
  }, [organizationId, parentId]);

  const getFolderById = useCallback(async (id: string) => {
    if (!organizationId) return null;
    const { data, error } = await supabase
      .from('folders')
      .select('id,name,parent_id,organization_id,created_by,created_at')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .single();
    if (error) return null;
    return data as FolderRow;
  }, [organizationId]);

  const getBreadcrumb = useCallback(async (folderId: string) => {
    // builds chain up to root
    const chain: FolderRow[] = [];
    let currentId: string | null = folderId;
    let guard = 0;
    while (currentId && guard < 20) {
      // eslint-disable-next-line no-await-in-loop
      const node = await getFolderById(currentId);
      if (!node) break;
      chain.unshift(node);
      currentId = node.parent_id;
      guard++;
    }
    return chain;
  }, [getFolderById]);

  useEffect(() => {
    // default behavior: list children of parentId (or null for root)
    if (parentId !== undefined) list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const memo = useMemo(() => ({
    loading, error, folders, refresh: list, getFolderById, getBreadcrumb
  }), [loading, error, folders, list, getFolderById, getBreadcrumb]);

  return memo;
}
