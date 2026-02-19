import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, needsProvisioning, authError } = useAuth();
  const blockedMessage = 'Seu acesso foi bloqueado pelo administrador desta organização.';

  const [isRegistering, setIsRegistering] = React.useState(false);
  const [isForgot, setIsForgot] = React.useState(false);
  const [showVerifyEmail, setShowVerifyEmail] = React.useState(false);
  const [provisioning, setProvisioning] = React.useState(false);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [orgCode, setOrgCode] = React.useState('');

  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const storageKeyForJoinCode = React.useCallback((e: string) => {
    return `vhub:join_code:${(e || '').trim().toLowerCase()}`;
  }, []);

  const validateJoinCode = React.useCallback(async (code: string) => {
    const clean = code.trim();
    if (!clean) throw new Error('Informe o código da organização.');
    const { data, error } = await supabase.rpc('validate_org_join_code', { p_code: clean });
    if (error) throw new Error('Falha ao validar o código. Tente novamente.');
    if (!data) throw new Error('Código da organização inválido.');
    return true;
  }, []);

  const tryAutoJoinAfterLogin = React.useCallback(async (e: string) => {
    const key = storageKeyForJoinCode(e);
    const code = localStorage.getItem(key);
    if (!code) return false;
    try {
      const { error } = await supabase.rpc('join_org_by_code', { p_code: code });
      if (error) throw error;
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }, [storageKeyForJoinCode]);

  React.useEffect(() => {
    if (!authError) return;
    setErr(authError);
    setInfo(null);
  }, [authError]);

  React.useEffect(() => {
    (async () => {
      if (user && profile) {
        navigate('/dashboard');
        return;
      }
      if (user && needsProvisioning) {
        setProvisioning(true);
        const ok = await tryAutoJoinAfterLogin(user.email ?? '');
        if (ok) {
          window.location.assign('/#/dashboard');
          return;
        }
        setProvisioning(false);
        setErr('Seu acesso ainda não está vinculado a uma organização. Informe o código manualmente.');
      }
    })();
  }, [user, profile, needsProvisioning, navigate, tryAutoJoinAfterLogin]);

  const onForgot = async () => {
    try {
      setBusy(true);
      setErr(null);
      setInfo(null);
      const cleanEmail = email.trim();
      if (!cleanEmail) throw new Error('Informe seu e-mail.');
      const redirectTo = `${window.location.origin}/#/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
      if (error) throw error;
      setInfo('Enviamos um e-mail para redefinir sua senha. Verifique sua caixa de entrada.');
    } catch (e: any) {
      setErr(e?.message ?? 'Falha ao enviar e-mail de redefinição.');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setErr(null);
      setInfo(null);

      const cleanEmail = email.trim();
      if (!cleanEmail) throw new Error('Informe seu e-mail.');

      if (isForgot) {
        await onForgot();
        return;
      }

      if (isRegistering) {
        if (!name.trim()) throw new Error('O nome é obrigatório para o cadastro.');
        await validateJoinCode(orgCode);
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        localStorage.setItem(storageKeyForJoinCode(cleanEmail), orgCode.trim());
        setShowVerifyEmail(true);
        setIsRegistering(false);
        setIsForgot(false);
        setPassword('');
        setInfo('Conta criada! Agora confirme seu e-mail para liberar seu acesso.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? 'Falha na autenticação.');
    } finally {
      setBusy(false);
    }
  };

  if (showVerifyEmail) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6">
          <div className="text-white text-xl font-semibold">Verifique seu e-mail</div>
          <div className="mt-3 text-gray-300 text-sm">
            Enviamos um link de confirmação para <span className="text-white font-medium">{email.trim()}</span>.
            {' '}Abra sua caixa de entrada e confirme para liberar o acesso.
          </div>
          {info && <div className="mt-3 text-amber-300 text-sm">{info}</div>}
          {err && <div className="mt-3 text-red-400 text-sm">{err}</div>}
          <div className="mt-6 flex gap-2 justify-end">
            <button
              className="px-4 py-2 rounded-xl border border-border bg-black/40 text-gray-200 hover:bg-black/30"
              onClick={() => setShowVerifyEmail(false)}
            >
              Voltar
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-gold text-black font-semibold"
              onClick={() => {
                setShowVerifyEmail(false);
                setIsRegistering(false);
                setIsForgot(false);
              }}
            >
              Ir para login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (provisioning) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-black/60 border border-border rounded-2xl p-6">
          <div className="text-white text-xl font-semibold">Conectando à organização…</div>
          <div className="mt-3 text-gray-300 text-sm">
            Estamos vinculando seu acesso automaticamente. Se demorar, aguarde alguns segundos.
          </div>
          <div className="mt-5 flex justify-end">
            <button
              className="px-4 py-2 rounded-xl border border-border bg-black/40 text-gray-200 hover:bg-black/30"
              onClick={async () => {
                setProvisioning(false);
                await supabase.auth.signOut();
                navigate('/login');
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-gold/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-surface border border-border p-8 rounded-xl shadow-2xl relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">V•HUB</h1>
          <p className="text-gray-400">
            {isForgot ? 'Receba um link para redefinir sua senha.' : isRegistering ? 'Crie sua conta para começar.' : 'Acesse sua conta para continuar.'}
          </p>
        </div>

        {err && (
          <div className={`mb-4 p-3 rounded flex items-center gap-2 text-sm ${err === blockedMessage ? 'bg-amber-900/20 border border-amber-700/50 text-amber-100' : 'bg-red-900/20 border border-red-900/50 text-red-200'}`}>
            <AlertCircle size={16} />
            <span>{err}</span>
          </div>
        )}

        {info && (
          <div className="mb-4 bg-gold/10 border border-gold/30 p-3 rounded text-gold text-sm">
            {info}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          {isRegistering && !isForgot && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-4 py-2 text-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-colors"
                placeholder="Seu Nome"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-4 py-2 text-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          {!isForgot && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Senha</label>
              <input
                className="w-full bg-background border border-border rounded-md px-4 py-2 text-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-colors"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          )}

          {isRegistering && !isForgot && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Código da organização</label>
              <input
                className="w-full bg-background border border-border rounded-md px-4 py-2 text-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-colors uppercase"
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value)}
                placeholder="EX: SQUAD-VSL"
              />
              <div className="mt-2 text-gray-500 text-xs">Você precisa de um código válido para concluir o cadastro.</div>
            </div>
          )}

          <button
            type="submit"
            className="w-full mt-2 rounded-xl bg-gold text-black font-semibold py-3 disabled:opacity-50"
            disabled={busy || !email.trim() || (isForgot ? false : !password) || (isRegistering && !isForgot && !orgCode.trim())}
          >
            {busy ? 'Aguarde...' : isForgot ? 'Enviar link' : isRegistering ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            className="text-gray-300 hover:text-white"
            onClick={() => {
              setErr(null);
              setInfo(null);
              setShowVerifyEmail(false);
              setIsForgot(false);
              setIsRegistering((v) => !v);
            }}
          >
            {isRegistering ? 'Já tenho conta' : 'Quero me cadastrar'}
          </button>

          <button
            className="text-gray-300 hover:text-white"
            onClick={() => {
              setErr(null);
              setInfo(null);
              setIsRegistering(false);
              setIsForgot((v) => !v);
            }}
          >
            Esqueci minha senha
          </button>
        </div>

        {err?.includes('vinculado') && (
          <div className="mt-3">
            <button
              className="text-sm text-amber-300 hover:text-amber-200 underline"
              onClick={() => navigate('/pending')}
            >
              Inserir código manualmente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
