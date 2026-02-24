
import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Topbar } from './components/Layout/Topbar';
import { DashboardPage } from './app/dashboard/page';
import { AssetDetailPage } from './app/assets/[id]/page';
import { ProfilePage } from './app/profile/page';
import { LoginPage } from './app/auth/login/page';
import { ResetPasswordPage } from './app/auth/reset/page';
import { PendingAccessPage } from './app/pending/page';
import { InviteAcceptPage } from './app/auth/invite/[token]/page';
import { BlockedPage } from './app/blocked/page';
import { RequireRole } from './components/Guards/RequireRole';
import { AdminPage } from './app/admin/page';
import { Loader2 } from 'lucide-react';
import { NewAssetModal } from './components/Assets/NewAssetModal';
import { UploadQueueProvider } from './contexts/UploadQueueContext';
import { UploadTray } from './components/Uploads/UploadTray';
import { supabase } from './lib/supabase';
import { Button } from './components/UI/Button';

const storageKeyForJoinCode = (email: string) =>
  `vhub:join_code:${(email || '').toLowerCase().trim()}`;

// Legacy folder route redirect (avoid "ghost page" + runtime errors)
const FolderRouteRedirect: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const sp = new URLSearchParams(location.search);

  if (id && id !== 'root') sp.set('folder', id);

  // keep existing type if present in URL, do not force
  return <Navigate to={{ pathname: '/dashboard', search: `?${sp.toString()}` }} replace />;
};

const ProvisioningGate: React.FC<{ email?: string | null }> = ({ email }) => {
  const navigate = useNavigate();
  const { refreshProfile, signOut } = useAuth() as any;

  const [seconds, setSeconds] = React.useState(0);
  const [retryClicks, setRetryClicks] = React.useState(0);
  const [mode, setMode] = React.useState<'auto' | 'manual'>('auto');
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);

  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = React.useRef(false);

  const manualUnlocked = seconds >= 20 || retryClicks >= 2;

  const stopPolling = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tryRefreshUntilReady = React.useCallback(async () => {
    const p = await refreshProfile?.();
    if (p) {
      stopPolling();
      navigate('/dashboard', { replace: true });
      return true;
    }
    return false;
  }, [navigate, refreshProfile, stopPolling]);

  const tryAutoJoin = React.useCallback(async () => {
    setErr(null);

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return;

    const key = storageKeyForJoinCode(cleanEmail);
    const saved = (localStorage.getItem(key) || '').trim();

    if (!saved) return;

    setBusy(true);
    try {
      const { error } = await supabase.rpc('join_org_by_code', { p_code: saved });
      if (error) throw error;
      localStorage.removeItem(key);
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível vincular automaticamente.');
    } finally {
      setBusy(false);
    }
  }, [email]);

  React.useEffect(() => {
    stoppedRef.current = false;

    const run = async () => {
      await tryAutoJoin();

      timerRef.current = setInterval(async () => {
        if (stoppedRef.current) return;

        setSeconds((s) => {
          if (s >= 20) {
            stopPolling();
            return s;
          }
          return s + 1;
        });

        const ok = await tryRefreshUntilReady();
        if (ok) {
          stopPolling();
        }
      }, 1000);
    };

    run();

    return () => {
      stoppedRef.current = true;
      stopPolling();
    };
  }, [stopPolling, tryAutoJoin, tryRefreshUntilReady]);

  const onRetry = async () => {
    setRetryClicks((n) => n + 1);
    setErr(null);
    setSeconds(0);
    stopPolling();
    await tryAutoJoin();

    timerRef.current = setInterval(async () => {
      setSeconds((s) => {
        if (s >= 20) {
          stopPolling();
          return s;
        }
        return s + 1;
      });

      const ok = await tryRefreshUntilReady();
      if (ok) {
        stopPolling();
      }
    }, 1000);
  };

  const joinManual = async () => {
    setErr(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setErr('Digite o código da organização.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('join_org_by_code', { p_code: trimmed });
      if (error) throw error;
      const ok = await tryRefreshUntilReady();
      if (!ok) {
        // deixa o polling terminar (ou usuário clicar retry)
      }
    } catch (e: any) {
      setErr(e?.message || 'Código inválido.');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'auto') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-10">
          <h1 className="text-2xl font-bold text-white">Preparando seu acesso</h1>
          <p className="text-gray-400 mt-2">
            Aguarde, estamos vinculando sua conta com sua organização...
          </p>

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border border-gold/40 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
              </div>
              <div>
                <div className="text-gray-200">Preparando o painel</div>
                <div className="text-gray-500">Aguarde... ({seconds}s)</div>
              </div>
            </div>
          </div>

          {err && (
            <div className="mt-5 bg-red-500/10 border border-red-500/30 p-3 rounded text-red-200 text-sm">
              {err}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={onRetry} variant="secondary" disabled={busy}>
              Tentar novamente
            </Button>
            <Button onClick={() => signOut()} variant="secondary" disabled={busy}>
              Sair
            </Button>

            {manualUnlocked && (
              <Button onClick={() => setMode('manual')} disabled={busy}>
                Inserir código
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-10">
        <h1 className="text-2xl font-bold text-white">Inserir código da organização</h1>
        <p className="text-gray-400 mt-2">
          Se o vínculo automático não concluiu, insira o código para finalizar.
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
            <div className="mt-3 bg-red-500/10 border border-red-500/30 p-3 rounded text-red-200 text-sm">
              {err}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <Button onClick={joinManual} disabled={busy}>
              {busy ? 'Validando...' : 'Finalizar'}
            </Button>
            <Button onClick={() => setMode('auto')} variant="secondary" disabled={busy}>
              Voltar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Protected Route Wrapper
const ProtectedLayout = () => {
  const { profile, loading, user, needsProvisioning, isBlocked } = useAuth();
  const { newAssetOpen, initialCategory, initialFolderId, closeNewAsset } = useUI();

  if (loading) {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center text-gold">
            <Loader2 className="animate-spin" size={48} />
        </div>
    );
  }


  if (isBlocked) {
    return <BlockedPage />;
  }

  if (!profile) {
    // If the auth user exists but there's no public.users row yet, show pending screen.
    if (user && needsProvisioning) {
      // NÃO mostrar /pending automaticamente. Tenta auto-join e só oferece manual se falhar.
      return <ProvisioningGate email={user.email} />;
    }
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden text-gray-200">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 min-w-0">
        <Topbar />
        <main className="flex-1 p-0 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
      <NewAssetModal
        open={newAssetOpen}
        onClose={closeNewAsset}
        initialCategory={initialCategory}
        initialFolderId={initialFolderId}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <UIProvider>
          <UploadQueueProvider>
            <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset" element={<ResetPasswordPage />} />
            <Route path="/pending" element={<PendingAccessPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route path="/blocked" element={<BlockedPage />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Legacy Folder Routes (redirect to dashboard shell) */}
              <Route path="/folders/:id" element={<FolderRouteRedirect />} />
              <Route path="/folders/root" element={<FolderRouteRedirect />} />

              {/* Asset detail */}
              <Route path="/assets/:id" element={<AssetDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Admin Route (Simple Guard) */}
              <Route
                path="/admin"
                element={<RequireRole required="admin"><AdminPage /></RequireRole>}
              />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <UploadTray />
          </UploadQueueProvider>
        </UIProvider>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
