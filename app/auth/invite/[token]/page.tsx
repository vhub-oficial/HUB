import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useInvite } from '../../../../hooks/useInvite';
import { Button } from '../../../../components/UI/Button';

/**
 * Invite accept page.
 * IMPORTANT: This app uses React Router (Vite). Param name is :token but maps to invites.id.
 */
export const InviteAcceptPage: React.FC = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { loading, error, success, acceptInvite, clear } = useInvite();
  const [done, setDone] = useState(false);

  const inviteId = useMemo(() => token ?? '', [token]);

  useEffect(() => {
    clear();
    setDone(false);
  }, [inviteId, clear]);

  const handleAccept = async () => {
    if (!inviteId) return;
    const ok = await acceptInvite(inviteId);
    setDone(ok);
  };

  useEffect(() => {
    // If provisioning succeeded, user should now have profile after refresh.
    // We simply redirect; AuthContext will re-fetch on next auth event or refresh.
    if (done) {
      setTimeout(() => navigate('/dashboard', { replace: true }), 700);
    }
  }, [done, navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-8">
        <h1 className="text-2xl font-bold text-white">Aceitar convite</h1>
        <p className="text-gray-400 mt-2">
          Este link libera seu acesso à organização no VideoAssetHub.
        </p>

        <div className="mt-6 space-y-3">
          <div className="text-sm text-gray-400">
            <div>
              <span className="text-gray-500">Convite ID:</span>{' '}
              <span className="text-white/90">{inviteId || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Logado como:</span>{' '}
              <span className="text-white/90">{user?.email ?? 'Não logado'}</span>
            </div>
          </div>

          {!user && !authLoading && (
            <div className="bg-gold/10 border border-gold/30 p-3 rounded text-gold text-sm">
              Você precisa fazer login antes de aceitar o convite.
              <div className="mt-3">
                <Button onClick={() => navigate('/login', { replace: true })}>
                  Ir para login
                </Button>
              </div>
            </div>
          )}

          {profile && (
            <div className="bg-black/40 border border-border p-3 rounded text-gray-300 text-sm">
              Você já tem um perfil vinculado. Se quiser trocar de organização, fale com um admin.
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-gold/10 border border-gold/30 p-3 rounded text-gold text-sm">
              {success}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleAccept} disabled={!user || !inviteId || loading || !!profile}>
              {loading ? 'Processando...' : 'Aceitar convite'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/dashboard')} disabled={loading}>
              Voltar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
