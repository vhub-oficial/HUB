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
  const [retryClicks, setRetryClicks] = React.useState(0);

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

    // após 18s, libera fallback manual (último caso)
    // (modo manual NÃO abre sozinho — só libera o botão)
    t2 = setTimeout(() => {
      // só “desbloqueia” a opção manual; não muda de modo automaticamente
      // (mantém a tela clean e premium)
    }, 18000);

    return () => {
      alive = false;
      if (t1) clearInterval(t1);
      if (t2) clearTimeout(t2);
    };
  }, [navigate, refreshProfile]);

  const steps = React.useMemo(
    () => [
      { title: 'Criando conta', hint: 'Validando credenciais e sessão' },
      { title: 'Vinculando organização', hint: 'Aplicando permissões do seu workspace' },
      { title: 'Preparando o painel', hint: 'Carregando seus recursos' },
    ],
    []
  );

  // Stepper “premium”: progride por tempo (sem % falsa)
  const stepIndex = React.useMemo(() => {
    if (seconds < 4) return 0;
    if (seconds < 10) return 1;
    return 2;
  }, [seconds]);

  // Último caso: só libera manual se demorou bastante OU após 2 “Tentar novamente”
  const manualUnlocked = seconds >= 18 || retryClicks >= 2;

  const Stepper = ({ current }: { current: number }) => {
    return (
      <div className="mt-6">
        <div className="flex items-center gap-3">
          {steps.map((s, idx) => {
            const done = idx < current;
            const active = idx === current;
            return (
              <div key={s.title} className="flex-1">
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0',
                      done
                        ? 'bg-gold/15 border-gold/40 text-gold'
                        : active
                        ? 'bg-black/40 border-gold/40 text-gold'
                        : 'bg-black/30 border-border text-gray-500',
                    ].join(' ')}
                  >
                    {done ? '✓' : idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className={active ? 'text-white font-medium' : done ? 'text-gray-200' : 'text-gray-500'}>
                      {s.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{s.hint}</div>
                  </div>
                </div>
                {idx < steps.length - 1 && <div className="mt-3 h-px bg-border/60" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-8">
        {mode === 'auto' ? (
          <>
            <h1 className="text-2xl font-bold text-white">Preparando seu acesso</h1>
            <p className="text-gray-400 mt-2">
              Estamos configurando sua conta no workspace…
              <br />
              <span className="text-gray-300">{user?.email}</span>
            </p>

            <div className="mt-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/40 border border-border flex items-center justify-center">
                <Loader2 className="animate-spin text-gold" size={20} />
              </div>
              <div className="text-sm">
                <div className="text-white">{steps[stepIndex]?.title}</div>
                <div className="text-gray-500">Aguarde… ({seconds}s)</div>
              </div>
            </div>

            <Stepper current={stepIndex} />

            <div className="mt-6 flex gap-3">
              <Button
                onClick={async () => {
                  setErr(null);
                  setOk(null);
                  setRetryClicks((n) => n + 1);
                  // não reseta seconds: mantém sensação de progresso contínuo
                  const p = await refreshProfile();
                  if (p) navigate('/dashboard', { replace: true });
                }}
                variant="secondary"
              >
                Tentar novamente
              </Button>
              {manualUnlocked && (
                <Button
                  onClick={() => {
                    setErr(null);
                    setOk(null);
                    setMode('manual');
                  }}
                  variant="secondary"
                >
                  Inserir código
                </Button>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <Button onClick={() => signOut()} variant="secondary">
                Sair
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white">Inserir código da organização</h1>
            <p className="text-gray-400 mt-2">
              Caso o vínculo automático não tenha sido concluído, insira o código abaixo.
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
                    // mantém seconds para não “reiniciar a sensação”
                  }}
                  variant="secondary"
                  disabled={busy}
                >
                  Voltar
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
