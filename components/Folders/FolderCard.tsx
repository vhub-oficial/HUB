import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { FolderRow } from '../../hooks/useFolders';
import { Folder } from 'lucide-react';

export const FolderCard: React.FC<{ folder: FolderRow }> = ({ folder }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/folders/${folder.id}`)}
      className="text-left bg-surface border border-border hover:border-gold/40 rounded-xl p-4 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
          <Folder className="text-gold" size={18} />
        </div>
        <div>
          <div className="text-white font-medium">{folder.name}</div>
          <div className="text-xs text-gray-500">Abrir pasta</div>
        </div>
      </div>
    </button>
  );
};
