
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
import { PendingAccessPage } from './app/pending/page';
import { InviteAcceptPage } from './app/auth/invite/[token]/page';
import { RequireRole } from './components/Guards/RequireRole';
import { AdminPage } from './app/admin/page';
import { Loader2 } from 'lucide-react';
import { NewAssetModal } from './components/Assets/NewAssetModal';

// Protected Route Wrapper
const ProtectedLayout = () => {
  const { profile, loading, user, needsProvisioning } = useAuth();
  const { newAssetOpen, initialCategory, closeNewAsset } = useUI();

  if (loading) {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center text-gold">
            <Loader2 className="animate-spin" size={48} />
        </div>
    );
  }

  if (!profile) {
    // If the auth user exists but there's no public.users row yet, show pending screen.
    if (user && needsProvisioning) {
      return <PendingAccessPage />;
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
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <UIProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pending" element={<PendingAccessPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />

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
        </UIProvider>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
