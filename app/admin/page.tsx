import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/UI/Button';
import { supabase } from '../../lib/supabase';

const roles = ['viewer', 'editor', 'admin'] as const;

export const AdminPage: React.FC = () => {
  const { organizationId, user } = useAuth();
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [org, setOrg] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editOrgName, setEditOrgName] = useState('');
  const [editJoin, setEditJoin] = useState('');

  const [usersTab, setUsersTab] = useState<'active' | 'blocked'>('active');
  const [usersQuery, setUsersQuery] = useState<string>('');
  const [usersPage, setUsersPage] = useState<number>(1);
  const usersPageSize = 25;
  const [usersTotal, setUsersTotal] = useState<number>(0);
  const [usersTotalActive, setUsersTotalActive] = useState<number>(0);
  const [usersTotalBlocked, setUsersTotalBlocked] = useState<number>(0);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!organizationId) return;
      setJoinBusy(true);
      try {
        const [{ data: orgData }, { data: usageData }] = await Promise.all([
          supabase.from('organizations').select('id,name,plan,storage_limit_gb,join_code').eq('id', organizationId).single(),
          supabase.from('storage_usage').select('used_space_gb,last_updated').eq('organization_id', organizationId).single(),
        ]);
        if (!mounted) return;
        setOrg(orgData ?? null);
        setUsage(usageData ?? null);
        setJoinCode((orgData as any)?.join_code ?? null);
        setEditOrgName((orgData as any)?.name ?? '');
        setEditJoin((orgData as any)?.join_code ?? '');
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? 'Falha ao carregar dados do admin');
      } finally {
        if (mounted) setJoinBusy(false);
      }
    })();
    return () => { mounted = false; };
  }, [organizationId]);

  const fetchUserCounts = React.useCallback(async () => {
    if (!organizationId) return;
    const [{ count: cActive }, { count: cBlocked }] = await Promise.all([
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('disabled', false),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('disabled', true),
    ]);
    setUsersTotalActive(cActive ?? 0);
    setUsersTotalBlocked(cBlocked ?? 0);
  }, [organizationId]);

  const fetchUsers = React.useCallback(async () => {
    if (!organizationId) return;
    setUsersLoading(true);
    setErr(null);
    try {
      const from = (usersPage - 1) * usersPageSize;
      const to = from + usersPageSize - 1;
      const isBlocked = usersTab === 'blocked';
      const search = usersQuery.trim();

      let q = supabase
        .from('users')
        .select('id,email,name,role,disabled,created_at', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('disabled', isBlocked)
        .order('created_at', { ascending: true })
        .range(from, to);

      if (search) {
        q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      setUsers(data ?? []);
      setUsersTotal(count ?? 0);
    } catch (e: any) {
      setErr(e?.message ?? 'Falha ao carregar usuários');
      setUsers([]);
      setUsersTotal(0);
    } finally {
      setUsersLoading(false);
    }
  }, [organizationId, usersTab, usersQuery, usersPage]);

  React.useEffect(() => {
    if (!organizationId) return;
    fetchUserCounts();
  }, [organizationId, fetchUserCounts]);

  React.useEffect(() => {
    if (!organizationId) return;
    fetchUsers();
  }, [organizationId, fetchUsers]);

  const copyJoin = async () => {
    if (!joinCode) return;
    await navigator.clipboard.writeText(joinCode);
    alert('Código copiado!');
  };

  const saveOrg = async () => {
    if (!organizationId) return;
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: editOrgName.trim(), join_code: editJoin.trim() })
        .eq('id', organizationId);
      if (error) throw error;
      setOrg((o: any) => ({ ...o, name: editOrgName.trim(), join_code: editJoin.trim() }));
      setJoinCode(editJoin.trim());
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao salvar organização');
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (userId: string, nextRole: (typeof roles)[number]) => {
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: nextRole })
        .eq('organization_id', organizationId)
        .eq('id', userId);
      if (error) throw error;
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao atualizar role');
    } finally {
      setBusy(false);
    }
  };

  const setUserDisabled = async (userId: string, nextDisabled: boolean) => {
    if (!organizationId) return;

    const msg = nextDisabled
      ? 'Bloquear este usuário? Ele não conseguirá mais acessar a organização.'
      : 'Reativar este usuário? Ele voltará a ter acesso conforme a role atual.';
    if (!window.confirm(msg)) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ disabled: nextDisabled })
        .eq('id', userId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      await fetchUserCounts();
      await fetchUsers();
    } catch (e: any) {
      alert(e?.message ?? 'Falha ao atualizar acesso do usuário');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Admin</h1>
        <p className="text-gray-400 mt-1">
          Organização: <span className="text-white/90">{org?.name ?? '—'}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Join code */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-white font-semibold">Organização</h2>
          <p className="text-gray-400 text-sm mt-1">
            Visão e controle básico da sua organização.
          </p>

          {(() => {
            const used = Number(usage?.used_space_gb ?? 0);
            const limit = Number(org?.storage_limit_gb ?? 0);
            const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            const usedGB = used.toFixed(2);
            const limitGB = limit ? limit.toFixed(0) : '—';
            return (
              <div className="mt-4 bg-black/20 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Uso de storage</span>
                  <span className="text-white font-semibold">{usedGB} GB / {limitGB} GB ({pct}%)</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-black/40 border border-border overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-black/30 border border-border rounded-lg p-4">
              <div className="text-xs text-gray-500">Nome</div>
              <input
                className="mt-2 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
              />
            </div>
            <div className="bg-black/30 border border-border rounded-lg p-4">
              <div className="text-xs text-gray-500">Plano</div>
              <div className="text-white font-semibold mt-1">{org?.plan ?? '—'}</div>
            </div>
            <div className="bg-black/30 border border-border rounded-lg p-4">
              <div className="text-xs text-gray-500">Limite (GB)</div>
              <div className="text-white font-semibold mt-1">{org?.storage_limit_gb ?? '—'}</div>
            </div>
            <div className="bg-black/30 border border-border rounded-lg p-4">
              <div className="text-xs text-gray-500">Usado (GB)</div>
              <div className="text-white font-semibold mt-1">{Number(usage?.used_space_gb ?? 0).toFixed(2)}</div>
            </div>
          </div>

          <div className="mt-4 bg-black/30 border border-border rounded-lg p-4 flex items-center justify-between gap-3">
            <input
              className="flex-1 bg-black/40 border border-border rounded-lg px-3 py-2 text-white font-mono text-sm"
              value={editJoin}
              onChange={(e) => setEditJoin(e.target.value)}
              placeholder="Código da organização"
            />
            <Button onClick={copyJoin} disabled={!joinCode || joinBusy}>
              Copiar
            </Button>
          </div>
          <div className="mt-3 flex gap-3">
            <Button onClick={saveOrg} disabled={busy || joinBusy}>
              {busy ? 'Salvando...' : 'Salvar organização'}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Dica: novos usuários podem usar esse código na tela de “Acesso pendente”.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-white font-semibold">Usuários</h2>
              <p className="text-gray-400 text-sm mt-1">
                Gerencie membros e roles (admin, editor, viewer).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={[
                  'px-3 py-2 rounded-xl border text-sm transition-colors',
                  usersTab === 'active'
                    ? 'bg-white/10 text-white border-white/15'
                    : 'bg-black/30 text-gray-300 border-white/10 hover:bg-white/5',
                ].join(' ')}
                onClick={() => {
                  setUsersTab('active');
                  setUsersPage(1);
                }}
                disabled={usersLoading || busy}
              >
                Ativos ({usersTotalActive})
              </button>
              <button
                type="button"
                className={[
                  'px-3 py-2 rounded-xl border text-sm transition-colors',
                  usersTab === 'blocked'
                    ? 'bg-white/10 text-white border-white/15'
                    : 'bg-black/30 text-gray-300 border-white/10 hover:bg-white/5',
                ].join(' ')}
                onClick={() => {
                  setUsersTab('blocked');
                  setUsersPage(1);
                }}
                disabled={usersLoading || busy}
              >
                Bloqueados ({usersTotalBlocked})
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <input
              className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white w-80 max-w-full"
              placeholder="Buscar por nome ou e-mail..."
              value={usersQuery}
              onChange={(e) => {
                setUsersQuery(e.target.value);
                setUsersPage(1);
              }}
              disabled={usersLoading || busy}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-border bg-black/30 text-white hover:border-gold/40 disabled:opacity-50"
                disabled={usersLoading || busy || usersPage <= 1}
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <div className="text-sm text-gray-300">
                Página <span className="text-white font-semibold">{usersPage}</span>
                {usersTotal > 0 ? (
                  <>
                    {' '}
                    • <span className="text-gray-400">{usersTotal}</span> no total
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-border bg-black/30 text-white hover:border-gold/40 disabled:opacity-50"
                disabled={usersLoading || busy || usersPage * usersPageSize >= usersTotal}
                onClick={() => setUsersPage((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-3 bg-red-500/10 border border-red-500/30 p-3 rounded text-red-300 text-sm">
              {err}
            </div>
          )}

          <div className="mt-4 overflow-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-black/30 text-gray-400">
                <tr>
                  <th className="text-left p-3">Usuário</th>
                  <th className="text-left p-3">E-mail</th>
                  <th className="text-left p-3">Role</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading && (
                  <tr className="border-t border-border">
                    <td className="p-3 text-gray-400" colSpan={4}>
                      Carregando usuários...
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="p-3 text-white">{u.name ?? '—'}</td>
                    <td className="p-3 text-gray-300">{u.email}</td>
                    <td className="p-3">
                      <select
                        className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                        value={u.role ?? 'viewer'}
                        disabled={busy || usersLoading}
                        onChange={(e) => updateRole(u.id, e.target.value as any)}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        className={`px-3 py-2 rounded-lg border ${
                          u.disabled ? 'border-yellow-500 text-yellow-300' : 'border-red-500 text-red-300'
                        }`}
                        disabled={busy || usersLoading}
                        onClick={() => setUserDisabled(u.id, !u.disabled)}
                      >
                        {u.disabled ? 'Reativar' : 'Bloquear'}
                      </button>
                      {u.disabled && <span className="ml-2 text-xs text-yellow-300">Bloqueado</span>}
                    </td>
                  </tr>
                ))}
                {!usersLoading && users.length === 0 && (
                  <tr className="border-t border-border">
                    <td className="p-3 text-gray-500" colSpan={4}>
                      {usersTab === 'blocked'
                        ? 'Nenhum usuário bloqueado encontrado.'
                        : 'Nenhum usuário ativo encontrado.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
