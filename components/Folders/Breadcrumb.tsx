import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { FolderRow } from '../../hooks/useFolders';

export const Breadcrumb: React.FC<{ chain: FolderRow[] }> = ({ chain }) => {
  const navigate = useNavigate();
  return (
    <div className="text-sm text-gray-400 flex flex-wrap items-center gap-2">
      <button className="hover:text-white" onClick={() => navigate('/folders/root')}>
        Pastas
      </button>
      {chain.map((f) => (
        <React.Fragment key={f.id}>
          <span className="text-gray-600">/</span>
          <button className="hover:text-white" onClick={() => navigate(`/folders/${f.id}`)}>
            {f.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
