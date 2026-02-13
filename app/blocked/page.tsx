import React from 'react';
import { Button } from '../../components/UI/Button';
import { supabase } from '../../lib/supabase';

export const BlockedPage: React.FC = () => {
  const [busy, setBusy] = React.useState(false);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-8">
        <h1 className="text-2xl font-bold text-white">Acesso bloqueado</h1>
        <p className="text-gray-400 mt-2">
          Seu acesso foi bloqueado pelo administrador da organização.
        </p>

        <div className="mt-6">
          <Button onClick={handleSignOut} disabled={busy}>
            {busy ? 'Saindo...' : 'Sair'}
          </Button>
        </div>
      </div>
    </div>
  );
};
