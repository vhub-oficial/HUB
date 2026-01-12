
import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Topbar } from './components/Layout/Topbar';
import { DashboardPage } from './app/dashboard/page';
import { FolderPage } from './app/folders/[id]/page';
import { LoginPage } from './app/auth/login/page';
import { PendingAccessPage } from './app/pending/page';
import { RequireRole } from './components/Guards/RequireRole';
import { AdminPage } from './app/admin/page';
import { Loader2 } from 'lucide-react';

// Protected Route Wrapper
const ProtectedLayout = () => {
  const { profile, loading, user, needsProvisioning } = useAuth();

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
    <div className="flex min-h-screen bg-background text-gray-200">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64">
        <Topbar />
        <main className="flex-1 overflow-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pending" element={<PendingAccessPage />} />
          
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            
            {/* Folder Routes */}
            <Route path="/folders/:id" element={<FolderPage />} />
            
            {/* Admin Route (Simple Guard) */}
            <Route
              path="/admin"
              element={<RequireRole required="admin"><AdminPage /></RequireRole>}
            />
          </Route>
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
