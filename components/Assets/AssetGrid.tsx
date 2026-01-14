import React from 'react';
import type { AssetRow } from '../../hooks/useAssets';
import { AssetCard } from './AssetCard';

type Props = {
  title?: string;
  assets: AssetRow[];
  loading?: boolean;
  emptyText?: string;
  onRefresh?: () => void;
};

export const AssetGrid: React.FC<Props> = ({ title, assets, loading, emptyText, onRefresh }) => {
  return (
    <div>
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-white font-semibold">{title}</h2>
        </div>
      )}

      {loading && (
        <div className="text-gray-400 text-sm">Carregando...</div>
      )}

      {!loading && assets.length === 0 && (
        <div className="text-gray-400 text-sm">{emptyText ?? 'Nenhum asset encontrado.'}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {assets.map((a) => (
          <AssetCard key={a.id} asset={a} onDeleted={onRefresh} />
        ))}
      </div>
    </div>
  );
};
