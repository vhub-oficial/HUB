import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type StorageState = {
  loading: boolean;
  error: string | null;
  usedMb: number;
  limitMb: number;
  percent: number;
  isOver80: boolean;
};

/**
 * Reads:
 * - public.storage_usage.used_space_gb (used space)
 * - public.organizations.storage_limit_gb (plan limit)
 *
 * IMPORTANT: RLS must allow admins to read org + storage_usage.
 */
export function useStorage() {
  const { organizationId, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedMb, setUsedMb] = useState<number>(0);
  const [limitMb, setLimitMb] = useState<number>(0);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    // Only admins should see usage in UI (backend already enforces via RLS)
    if (role !== 'admin') return;

    setLoading(true);
    setError(null);
    try {
      // 1) org limit in GB
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('id, storage_limit_gb')
        .eq('id', organizationId)
        .single();

      if (orgErr) throw orgErr;

      const limitGb = Number((org as any)?.storage_limit_gb ?? 0);
      const computedLimitMb = limitGb > 0 ? limitGb * 1024 : 0;
      setLimitMb(computedLimitMb);

      // 2) storage usage (schema confirmed)
      const { data: usage, error: usageErr } = await supabase
        .from('storage_usage')
        .select('organization_id, used_space_gb, last_updated')
        .eq('organization_id', organizationId)
        .single();

      if (usageErr) throw usageErr;

      const usedGb = Number((usage as any)?.used_space_gb ?? 0);
      const used = usedGb > 0 ? usedGb * 1024 : 0;

      setUsedMb(Math.max(0, used));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar uso de armazenamento');
    } finally {
      setLoading(false);
    }
  }, [organizationId, role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const derived = useMemo(() => {
    const percent = limitMb > 0 ? Math.min(100, (usedMb / limitMb) * 100) : 0;
    return {
      percent,
      isOver80: percent >= 80,
    };
  }, [usedMb, limitMb]);

  const state: StorageState = useMemo(
    () => ({
      loading,
      error,
      usedMb,
      limitMb,
      percent: derived.percent,
      isOver80: derived.isOver80,
    }),
    [loading, error, usedMb, limitMb, derived]
  );

  return { ...state, refresh };
}
