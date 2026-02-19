import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

function parseHashTokens() {
  const h = (window.location.hash || '').replace(/^#/, '');
  const sp = new URLSearchParams(h);
  const access_token = sp.get('access_token') || '';
  const refresh_token = sp.get('refresh_token') || '';
  const type = sp.get('type') || '';
  return { access_token, refresh_token, type };
}

export const ResetPasswordPage: React.FC = () => {
  const nav = useNavigate();
  const [p1, setP1] = React.useState('');
  const [p2, setP2] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { access_token, refresh_token, type } = parseHashTokens();
      if (type === 'recovery' && access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    })();
  }, []);

  const submit = async () => {
    try {
      setBusy(true);
      setErr(null);
      setOk(null);
      if (p1.length < 6) throw new Error('Senha muito curta (mínimo 6).');
      if (p1 !== p2) throw new Error('As senhas não coincidem.');
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;
      setOk('Senha atualizada com sucesso. Agora você pode entrar.');
      setTimeout(() => nav('/login'), 600);
    } catch (e: any) {
      setErr(e?.message ?? 'Falha ao atualizar senha.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6">
        <div className="text-white text-xl font-semibold">Definir nova senha</div>
        <div className="mt-5 space-y-3">
          <div>
            <label className="text-gray-400 text-sm">Nova senha</label>
            <input
              className="mt-2 w-full bg-black/40 border border-border rounded-xl px-4 py-3 text-white"
              type="password"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm">Confirmar senha</label>
            <input
              className="mt-2 w-full bg-black/40 border border-border rounded-xl px-4 py-3 text-white"
              type="password"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {err && <div className="text-red-400 text-sm">{err}</div>}
          {ok && <div className="text-amber-300 text-sm">{ok}</div>}
          <button
            className="w-full mt-2 rounded-xl bg-gold text-black font-semibold py-3 disabled:opacity-50"
            disabled={busy || !p1 || !p2}
            onClick={submit}
          >
            {busy ? 'Aguarde...' : 'Salvar nova senha'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
