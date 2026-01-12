import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStorage } from '../../hooks/useStorage';

export const UsageStats: React.FC = () => {
  const { role } = useAuth();
  const { loading, error, usedMb, limitMb, percent, isOver80 } = useStorage();

  if (role !== 'admin') {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-white font-semibold">Uso de Armazenamento</h3>
        <p className="text-gray-400 mt-2">Apenas admins podem visualizar o uso.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Uso de Armazenamento</h3>
        {isOver80 && (
          <span className="text-xs px-2 py-1 rounded bg-gold/10 border border-gold/30 text-gold">
            Alerta: acima de 80%
          </span>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm mt-3">
          {error}
        </p>
      )}

      <div className="mt-4">
        <div className="flex justify-between text-sm text-gray-400">
          <span>{loading ? 'Carregando...' : `${usedMb.toFixed(1)} MB usados`}</span>
          <span>{limitMb > 0 ? `${limitMb.toFixed(0)} MB limite` : 'Limite não definido'}</span>
        </div>

        <div className="mt-2 h-3 rounded-full bg-black/60 border border-border overflow-hidden">
          <div
            className="h-full bg-gold transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-2 text-xs text-gray-500">
          {limitMb > 0 ? `${percent.toFixed(1)}% usado` : 'Configure storage_limit_gb no plano da organização.'}
        </div>
      </div>
    </div>
  );
};
