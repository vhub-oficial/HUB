import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/UI/Button';

export const ProfilePage: React.FC = () => {
  const { profile, user, signOut } = useAuth();
  const [orgName, setOrgName] = React.useState<string | null>(null);
  const [name, setName] = React.useState(profile?.name ?? '');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

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
    const { error } = await supabase.from('users').update({ name }).eq('id', user.id);
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      setMsg('Nome atualizado!');
      setTimeout(() => window.location.reload(), 400);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
        <p className="text-gray-400 mt-1">Informações essenciais da sua conta.</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">Nome</div>
            <input
              className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs text-gray-500">E-mail</div>
            <div className="text-white font-semibold mt-1">{user?.email ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Role</div>
            <div className="text-white font-semibold mt-1">{profile?.role ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Organização</div>
            <div className="text-white font-semibold mt-1">{orgName ?? profile?.organization_id ?? '—'}</div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 items-center">
          <Button onClick={save} disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button onClick={() => signOut()} variant="secondary">
            Sair da conta
          </Button>
          {msg && <span className="text-sm text-gray-400">{msg}</span>}
        </div>
      </div>
    </div>
  );
};
