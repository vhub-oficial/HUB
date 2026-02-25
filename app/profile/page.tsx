import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/UI/Button';

export const ProfilePage: React.FC = () => {
  const { profile, user, signOut } = useAuth();

  const [orgName, setOrgName] = React.useState<string | null>(null);
  const [name, setName] = React.useState(profile?.name ?? '');
  const [busy, setBusy] = React.useState(false);
  const [logoutBusy, setLogoutBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!profile?.organization_id) return;
      const { data } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .single();

      if (!mounted) return;
      setOrgName((data as any)?.name ?? null);
    })();
    return () => { mounted = false; };
  }, [profile?.organization_id]);

  const save = async () => {
    if (!user?.id) return;
    setBusy(true);
    setMsg(null);

    const { error } = await supabase
      .from('users')
      .update({ name })
      .eq('id', user.id);

    setBusy(false);

    if (error) {
      setMsg(error.message);
    } else {
      setMsg('Nome atualizado com sucesso.');
    }
  };

  const handleLogout = async () => {
    setLogoutBusy(true);
    await signOut();
  };

  const roleBadgeColor = {
    admin: 'bg-red-500/15 text-red-300 border-red-500/30',
    editor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    viewer: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  }[profile?.role ?? 'viewer'];

  return (
    <div className="p-6 max-w-4xl space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Perfil</h1>
        <p className="text-gray-400 mt-1">
          Gerencie suas informações pessoais e acesso à organização.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-8">

        {/* Top Identity Section */}
        <div className="flex items-center gap-6">

          {/* Avatar inicial */}
          <div className="w-16 h-16 rounded-2xl bg-gold/20 border border-gold/30 flex items-center justify-center text-2xl font-bold text-gold">
            {(profile?.name ?? user?.email ?? '?')[0]?.toUpperCase()}
          </div>

          <div>
            <div className="text-xl font-semibold text-white">
              {profile?.name ?? 'Usuário'}
            </div>

            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3 py-1 text-xs rounded-full border ${roleBadgeColor}`}>
                {profile?.role}
              </span>

              <span className="text-gray-400 text-sm">
                {orgName ?? 'Organização'}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-border" />

        {/* Form Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div>
            <div className="text-xs text-gray-500">Nome</div>
            <input
              className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-gray-500">E-mail</div>
            <div className="text-white font-semibold mt-1">
              {user?.email ?? '—'}
            </div>
          </div>
        </div>

        {msg && (
          <div className="mt-4 text-sm text-gray-400">
            {msg}
          </div>
        )}

        {/* Divider */}
        <div className="my-8 border-t border-border" />

        {/* Actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">

          <Button onClick={save} disabled={busy || logoutBusy}>
            {busy ? 'Salvando...' : 'Salvar alterações'}
          </Button>

          {!confirmLogout ? (
            <Button
              variant="secondary"
              onClick={() => setConfirmLogout(true)}
              disabled={busy || logoutBusy}
            >
              Sair da conta
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                Confirmar saída?
              </span>

              <Button
                onClick={handleLogout}
                disabled={logoutBusy}
              >
                {logoutBusy ? 'Saindo...' : 'Confirmar'}
              </Button>

              <Button
                variant="secondary"
                onClick={() => setConfirmLogout(false)}
                disabled={logoutBusy}
              >
                Cancelar
              </Button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
