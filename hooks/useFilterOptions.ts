import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Options = {
  tags: string[];
  meta: Record<string, string[]>;
};

const SPEC_META_KEYS: Record<string, string[]> = {
  deepfakes: ['personagem', 'versao'],
  vozes: [],
  tiktok: ['nicho', 'genero', 'tipo'],
  musicas: ['momento_vsl', 'emocao'],
  sfx: ['momento_vsl', 'emocao'],
  veo3: ['produto', 'dimensao'],
  'provas-sociais': ['nicho', 'genero'],
  ugc: ['genero_ator', 'faixa_etaria'],
};

export function useFilterOptions(type?: string) {
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Options>({ tags: [], meta: {} });

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
        const { data, error } = await supabase
          .from('assets')
          .select('tags, meta')
          .eq('organization_id', organizationId)
          .eq('type', type)
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) throw error;

        const tagSet = new Set<string>();
        const metaSets: Record<string, Set<string>> = {};
        const keys = SPEC_META_KEYS[type] ?? [];
        keys.forEach((k) => (metaSets[k] = new Set<string>()));

        (data ?? []).forEach((row: any) => {
          const tags: string[] = row?.tags ?? [];
          tags.forEach((t) => tagSet.add(t));

          const meta = row?.meta ?? {};
          keys.forEach((k) => {
            const v = meta?.[k];
            if (v === undefined || v === null) return;
            const s = String(v).trim();
            if (!s) return;
            metaSets[k].add(s);
          });
        });

        const nextMeta: Record<string, string[]> = {};
        keys.forEach((k) => {
          nextMeta[k] = Array.from(metaSets[k]).sort((a, b) => a.localeCompare(b));
        });

        if (!mounted) return;
        setOptions({
          tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b)),
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
  }, [organizationId, type]);

  return useMemo(() => ({ loading, options }), [loading, options]);
}
