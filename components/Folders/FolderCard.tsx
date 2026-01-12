
import React from 'react';
import { Folder as FolderType } from '../../types';
import { Folder } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FolderCardProps {
  folder: FolderType;
}

export const FolderCard: React.FC<FolderCardProps> = ({ folder }) => {
  return (
    <Link to={`/folders/${folder.id}`} className="block">
      <div className="bg-surface border border-border rounded-lg p-4 hover:border-gold/50 hover:bg-surfaceHighlight transition-colors group cursor-pointer h-full flex flex-col justify-between">
        <div className="flex items-center space-x-3">
          <Folder className="text-goldDim group-hover:text-gold transition-colors" size={24} fill="currentColor" fillOpacity={0.2} />
          <span className="text-sm font-medium text-gray-300 group-hover:text-white truncate">
            {folder.name}
          </span>
        </div>
        <div className="mt-4 text-xs text-gray-600">
            Created: {new Date(folder.created_at).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
};
