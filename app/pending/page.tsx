import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/UI/Button';

/**
 * Shown when the auth user exists but there is no matching row in public.users yet.
 * This keeps multi-tenant security intact (no fake org/role on the client).
 */
export const PendingAccessPage: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-8">
        <h1 className="text-2xl font-bold text-white">Acesso pendente</h1>
        <p className="text-gray-400 mt-2">
          Sua conta foi criada ({user?.email}), mas ainda não está vinculada a uma organização.
          <br />
          Peça para um <span className="text-gold font-semibold">Admin</span> te convidar ou concluir o provisionamento.
        </p>

        <div className="mt-6 flex gap-3">
          <Button onClick={() => signOut()} variant="secondary">
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};
