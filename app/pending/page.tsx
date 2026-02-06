import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/UI/Button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { normalizeJoinCodeError } from '../../lib/errorMessages';

/**
 * Shown when the auth user exists but there is no matching row in public.users yet.
 * This keeps multi-tenant security intact (no fake org/role on the client).
 */
export const PendingAccessPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const join = async () => {
    setErr(null);
    setOk(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setErr('Digite o código da organização.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('join_org_by_code', { p_code: trimmed });
      if (error) throw error;
      setOk('Acesso liberado! Redirecionando...');
      // reload to force AuthContext to refetch profile reliably
      setTimeout(() => window.location.assign('/#/dashboard'), 600);
    } catch (e: any) {
      setErr(normalizeJoinCodeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-8">
        <h1 className="text-2xl font-bold text-white">Acesso pendente</h1>
        <p className="text-gray-400 mt-2">
          Sua conta foi criada ({user?.email}), mas ainda não está vinculada a uma organização.
          <br />
          Você pode entrar com um <span className="text-gold font-semibold">código da organização</span> ou aceitar um convite.
        </p>

        <div className="mt-6">
          <label className="text-sm text-gray-400">Código da organização</label>
          <input
            className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
            placeholder="Ex: VHUB-SMARTHUB-1111"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
          />
          {err && (
            <div className="mt-3 bg-red-500/10 border border-red-500/30 p-3 rounded text-red-300 text-sm">
              {err}
            </div>
          )}
          {ok && (
            <div className="mt-3 bg-gold/10 border border-gold/30 p-3 rounded text-gold text-sm">
              {ok}
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <Button onClick={join} disabled={busy}>
              {busy ? 'Entrando...' : 'Entrar'}
            </Button>
            <Button onClick={() => navigate('/login', { replace: true })} variant="secondary" disabled={busy}>
              Voltar ao login
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Dica: para esta org, o código atual é <span className="text-gray-300">VHUB-SMARTHUB-1111</span>.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={() => navigate('/admin')} variant="secondary">
            Abrir Admin (se você for admin)
          </Button>
          <Button onClick={() => signOut()} variant="secondary">
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};
