import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/UI/Button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { normalizeJoinCodeError } from '../../lib/errorMessages';
import { Loader2 } from 'lucide-react';

/**
 * Shown when the auth user exists but there is no matching row in public.users yet.
 * This keeps multi-tenant security intact (no fake org/role on the client).
 */
export const PendingAccessPage: React.FC = () => {
  const { user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'auto' | 'manual'>('auto');
  const [seconds, setSeconds] = React.useState(0);

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

  // UX: ao cair no pending, tentar automaticamente buscar o perfil por alguns segundos.
  // Assim o usuário NÃO precisa de F5 / trocar aba.
  React.useEffect(() => {
    let alive = true;
    let t1: any = null;
    let t2: any = null;

    const tick = async () => {
      if (!alive) return;
      setSeconds((s) => s + 1);
      const p = await refreshProfile();
      if (!alive) return;
      if (p) {
        navigate('/dashboard', { replace: true });
      }
    };

    // roda imediato e depois a cada 1s
    tick();
    t1 = setInterval(tick, 1000);

    // após 12s, libera fallback manual (se ainda não vinculou)
    t2 = setTimeout(() => {
      if (!alive) return;
      setMode('manual');
    }, 12000);

    return () => {
      alive = false;
      if (t1) clearInterval(t1);
      if (t2) clearTimeout(t2);
    };
  }, [navigate, refreshProfile]);


  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-8">
        {mode === 'auto' ? (
          <>
            <h1 className="text-2xl font-bold text-white">Estamos preparando seu acesso</h1>
            <p className="text-gray-400 mt-2">
              Vinculando sua conta à organização…
              <br />
              <span className="text-gray-300">{user?.email}</span>
            </p>

            <div className="mt-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/40 border border-border flex items-center justify-center">
                <Loader2 className="animate-spin text-gold" size={20} />
              </div>
              <div className="text-sm">
                <div className="text-white">Quase lá</div>
                <div className="text-gray-500">Aguarde… ({seconds}s)</div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={async () => {
                  setMode('auto');
                  setSeconds(0);
                  await refreshProfile();
                }}
                variant="secondary"
              >
                Tentar novamente
              </Button>
              <Button onClick={() => setMode('manual')} variant="secondary">
                Inserir código manualmente
              </Button>
            </div>

            <div className="mt-6 flex gap-3">
              <Button onClick={() => signOut()} variant="secondary">
                Sair
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white">Acesso ainda não vinculado</h1>
            <p className="text-gray-400 mt-2">
              Não conseguimos vincular automaticamente.
              <br />
              Você pode inserir o <span className="text-gold font-semibold">código da organização</span>.
            </p>

            <div className="mt-6">
              <label className="text-sm text-gray-400">Código da organização</label>
              <input
                className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Ex: SQUAD-VSL"
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
                <Button
                  onClick={() => {
                    setErr(null);
                    setOk(null);
                    setMode('auto');
                    setSeconds(0);
                  }}
                  variant="secondary"
                  disabled={busy}
                >
                  Voltar para “Aguardar”
                </Button>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button onClick={() => signOut()} variant="secondary">
                Sair
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
