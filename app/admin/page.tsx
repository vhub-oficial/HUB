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

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!organizationId) return;
      setJoinBusy(true);
      try {
        const [{ data: orgData }, { data: usageData }, { data: usersData }] = await Promise.all([
          supabase.from('organizations').select('id,name,plan,storage_limit_gb,join_code').eq('id', organizationId).single(),
          supabase.from('storage_usage').select('used_space_gb,last_updated').eq('organization_id', organizationId).single(),
          supabase.from('users').select('id,email,name,role,created_at').eq('organization_id', organizationId).order('created_at', { ascending: true }),
        ]);
        if (!mounted) return;
        setOrg(orgData ?? null);
        setUsage(usageData ?? null);
        setUsers(usersData ?? []);
        setJoinCode((orgData as any)?.join_code ?? null);
        setEditOrgName((orgData as any)?.name ?? '');
        setEditJoin((orgData as any)?.join_code ?? '');
      } finally {
        if (mounted) setJoinBusy(false);
      }
    })();
    return () => { mounted = false; };
  }, [organizationId]);

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

  const removeUserFromOrg = async (userId: string) => {
    if (!organizationId) return;
    if (userId === user?.id) return;

    const ok = window.confirm('Remover este usuário da sua organização? Ele perderá o acesso e voltará para "Acesso pendente".');
    if (!ok) return;

    try {
      setBusy(true);

      const { error } = await supabase
        .from('users')
        .update({ organization_id: null, role: 'viewer', is_active: false })
        .eq('id', userId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      setUsers((prev) => prev.filter((x) => x.id !== userId));
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Falha ao remover usuário');
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
          <h2 className="text-white font-semibold">Usuários</h2>
          <p className="text-gray-400 text-sm mt-1">
            Gerencie membros e roles (admin, editor, viewer).
          </p>

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
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="p-3 text-white">{u.name ?? '—'}</td>
                    <td className="p-3 text-gray-300">{u.email}</td>
                    <td className="p-3">
                      <select
                        className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                        value={u.role ?? 'viewer'}
                        disabled={busy}
                        onChange={(e) => updateRole(u.id, e.target.value as any)}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        className="px-3 py-2 rounded-lg border border-border bg-black/40 text-red-300 hover:text-red-200 hover:border-red-400 disabled:opacity-50"
                        disabled={busy || u.id === user?.id}
                        onClick={() => removeUserFromOrg(u.id)}
                        title={u.id === user?.id ? 'Você não pode remover sua própria conta' : 'Remover usuário da organização'}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr className="border-t border-border">
                    <td className="p-3 text-gray-500" colSpan={4}>Nenhum usuário encontrado.</td>
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
