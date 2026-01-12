import React, { useMemo, useState } from 'react';
import { useInvite } from '../../hooks/useInvite';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/UI/Button';

const roles = ['viewer', 'editor', 'admin'] as const;

export const AdminPage: React.FC = () => {
  const { organizationId } = useAuth();
  const { loading, error, success, sendInvite, clear } = useInvite();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof roles)[number]>('viewer');
  const [inviteId, setInviteId] = useState<string | null>(null);

  const inviteLink = useMemo(() => {
    if (!inviteId) return null;
    // HashRouter: include #/ route
    return `${window.location.origin}/#/invite/${inviteId}`;
  }, [inviteId]);

  const onCreate = async () => {
    clear();
    setInviteId(null);
    const data = await sendInvite(email.trim(), role);
    if (data?.id) setInviteId(data.id);
  };

  const copy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    alert('Link copiado!');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Admin</h1>
        <p className="text-gray-400 mt-1">
          Organização: <span className="text-white/90">{organizationId ?? '—'}</span>
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
        <h2 className="text-white font-semibold">Convidar usuário</h2>
        <p className="text-gray-400 text-sm mt-1">
          MVP: cria um registro em <code className="text-white/80">invites</code> e gera um link.
        </p>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 p-3 rounded text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 bg-gold/10 border border-gold/30 p-3 rounded text-gold text-sm">
            {success}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-sm text-gray-400">E-mail</label>
            <input
              className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: editor@agencia.com"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">Role</label>
            <select
              className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Button onClick={onCreate} disabled={loading || !email.trim()}>
              {loading ? 'Criando...' : 'Criar convite'}
            </Button>
          </div>

          {inviteLink && (
            <div className="mt-4 border border-border rounded-lg p-3 bg-black/30">
              <div className="text-xs text-gray-400">Link do convite</div>
              <div className="text-sm text-white break-all mt-1">{inviteLink}</div>
              <div className="mt-3 flex gap-3">
                <Button onClick={copy}>Copiar link</Button>
                <Button variant="secondary" onClick={() => window.open(inviteLink, '_blank')!}>
                  Abrir
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                O usuário deve fazer login com o e-mail convidado e aceitar o convite nessa rota.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
