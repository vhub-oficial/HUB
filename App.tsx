
import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Topbar } from './components/Layout/Topbar';
import { DashboardPage } from './app/dashboard/page';
import { FolderPage } from './app/folders/[id]/page';
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

const storageKeyForJoinCode = (email: string) => `vhub:join_code:${email.toLowerCase().trim()}`;

const ProvisioningGate: React.FC<{ email?: string | null }> = ({ email }) => {
  const [status, setStatus] = React.useState<'loading' | 'failed'>('loading');

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const cleanEmail = (email ?? '').trim();
        if (!cleanEmail) throw new Error('missing-email');

        const key = storageKeyForJoinCode(cleanEmail);
        const code = localStorage.getItem(key)?.trim();
        if (!code) throw new Error('missing-code');

        // tenta vincular automaticamente (RPC já existente no /pending)
        const { error } = await supabase.rpc('join_org_by_code', { p_code: code });
        if (error) throw error;

        // se deu certo, limpamos o code e recarregamos para o AuthContext pegar o profile
        localStorage.removeItem(key);
        window.location.assign('/#/dashboard');
      } catch {
        if (mounted) setStatus('failed');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [email]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-black/60 border border-border rounded-2xl p-6 text-gray-200">
          <div className="text-white text-xl font-semibold">Conectando à organização…</div>
          <div className="mt-3 text-gray-300 text-sm">
            Estamos vinculando seu acesso automaticamente. Se demorar, aguarde alguns segundos.
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Loader2 className="animate-spin text-gold" size={18} />
            <div className="text-sm text-gray-300">Processando…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-black/60 border border-border rounded-2xl p-6 text-gray-200">
        <div className="text-white text-xl font-semibold">Acesso ainda não vinculado</div>
        <div className="mt-3 text-gray-300 text-sm">
          Não conseguimos vincular automaticamente. Você pode inserir o código manualmente.
        </div>
        <div className="mt-5 flex justify-end">
          <a
            className="px-4 py-2 rounded-xl border border-border bg-gold text-black font-semibold hover:opacity-90"
            href="/#/pending"
          >
            Inserir código
          </a>
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

              {/* Folder Routes */}
              <Route path="/folders/:id" element={<FolderPage />} />
              <Route path="/folders/root" element={<FolderPage />} />

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
