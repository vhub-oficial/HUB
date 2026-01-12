
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFolders } from '../../../hooks/useFolders';
import { useAssets } from '../../../hooks/useAssets';
import { FolderCard } from '../../../components/Folders/FolderCard';
import { AssetCard } from '../../../components/Assets/AssetCard';
import { Loader2, ChevronRight } from 'lucide-react';

export const FolderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const folderId = id === 'root' ? 'root' : id; // Normalize
  
  const { folders, loading: foldersLoading } = useFolders(folderId);
  const { assets, loading: assetsLoading } = useAssets({ folderId });

  const isLoading = foldersLoading || assetsLoading;

  return (
    <div className="p-8">
       {/* Breadcrumb Mock */}
       <div className="flex items-center text-sm text-gray-500 mb-6">
          <Link to="/folders/root" className="hover:text-gold transition-colors">Root</Link>
          {folderId !== 'root' && (
              <>
                 <ChevronRight size={14} className="mx-2" />
                 <span className="text-white">Current Folder</span>
              </>
          )}
       </div>

       <h2 className="text-2xl font-bold text-white mb-6">
         {folderId === 'root' ? 'All Files' : 'Folder Contents'}
       </h2>

       {isLoading ? (
         <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-gold" size={40} />
        </div>
       ) : (
           <>
            {/* Folders Grid */}
            {folders.length > 0 && (
                <div className="mb-10">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4 tracking-wider">Folders</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {folders.map(folder => <FolderCard key={folder.id} folder={folder} />)}
                    </div>
                </div>
            )}

            {/* Assets Grid */}
            <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4 tracking-wider">Assets</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {assets.map(asset => <AssetCard key={asset.id} asset={asset} />)}
                     {assets.length === 0 && (
                        <p className="text-gray-600 text-sm">No assets in this folder.</p>
                    )}
                </div>
            </div>
           </>
       )}
    </div>
  );
};
