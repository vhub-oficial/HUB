import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCategoryMetaFields } from '../lib/categoryMeta';

type Options = {
  tags: string[];
  meta: Record<string, string[]>;
};

export function useFilterOptions(type?: string | null, folderId?: string | null, refreshKey?: number) {
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Options>({ tags: [], meta: {} });

  const metaFields = useMemo(() => getCategoryMetaFields(type).map((f) => f.key), [type]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!organizationId || !type) {
        setOptions({ tags: [], meta: {} });
        return;
      }

      setLoading(true);
      try {
        // Snapshot da aba (sem filtros), limite alto o suficiente pro MVP
        let query = supabase
          .from('assets')
          .select('tags, meta')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(500);

        if (type) query = query.eq('type', type);

        if (typeof folderId === 'string') {
          query = query.eq('folder_id', folderId);
        } else if (folderId === null) {
          query = query.is('folder_id', null);
        }

        const { data, error } = await query;

        if (error) throw error;

        const tagSet = new Set<string>();
        const metaSets: Record<string, Set<string>> = {};
        metaFields.forEach((k) => (metaSets[k] = new Set<string>()));

        (data ?? []).forEach((row: any) => {
          const tags: string[] = row?.tags ?? [];
          tags.forEach((t) => tagSet.add(t));

          const meta = row?.meta ?? {};
          metaFields.forEach((k) => {
            const v = meta?.[k];
            if (v === undefined || v === null) return;
            const s = String(v).trim();
            if (!s) return;
            metaSets[k].add(s);
          });
        });

        const nextMeta: Record<string, string[]> = {};
        metaFields.forEach((k) => {
          nextMeta[k] = Array.from(metaSets[k]).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        });

        if (!mounted) return;
        setOptions({
          tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
          meta: nextMeta,
        });
      } catch {
        if (mounted) setOptions({ tags: [], meta: {} });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [organizationId, type, folderId, metaFields, refreshKey]);

  return useMemo(() => ({ loading, options }), [loading, options]);
}
