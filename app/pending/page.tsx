import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/UI/Button';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Shown when the auth user exists but there is no matching row in public.users yet.
 * This keeps multi-tenant security intact (no fake org/role on the client).
 */
export const PendingAccessPage: React.FC = () => {
  const { signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [seconds, setSeconds] = React.useState(0);

  // UX: ao cair no pending, tentar automaticamente buscar o perfil por alguns segundos.
  // Assim o usuário NÃO precisa de F5 / trocar aba.
  React.useEffect(() => {
    let alive = true;
    let t1: any = null;

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

    return () => {
      alive = false;
      if (t1) clearInterval(t1);
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
        <>
          <h1 className="text-2xl font-bold text-white">Preparando seu acesso</h1>
          <p className="text-gray-400 mt-2">Aguarde, estamos vinculando sua conta com sua organização...</p>

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
            <Button onClick={() => window.location.reload()} variant="secondary">
              Tentar novamente
            </Button>

            <Button onClick={() => signOut()} variant="secondary">
              Sair
            </Button>
          </div>
        </>
      </div>
    </div>
  );
};
