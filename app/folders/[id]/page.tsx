import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFolders } from '../../../hooks/useFolders';
import { useAssets } from '../../../hooks/useAssets';
import { FolderCard } from '../../../components/Folders/FolderCard';
import { Breadcrumb } from '../../../components/Folders/Breadcrumb';
import { AssetGrid } from '../../../components/Assets/AssetGrid';
import { UploadDropzone } from '../../../components/Assets/UploadDropzone';

export const FolderPage: React.FC = () => {
  const { id } = useParams();
  const folderId = id === 'root' ? null : (id ?? null);

  const { folders, loading: foldersLoading, error: foldersError, getBreadcrumb } = useFolders(folderId);
  const { assets, loading: assetsLoading, error: assetsError, refresh } = useAssets({
    folderId: folderId, // null => root assets
    limit: 60,
  });

  const [breadcrumb, setBreadcrumb] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (folderId && typeof folderId === 'string') {
        const chain = await getBreadcrumb(folderId);
        if (mounted) setBreadcrumb(chain);
      } else {
        setBreadcrumb([]);
      }
    })();
    return () => { mounted = false; };
  }, [folderId, getBreadcrumb]);

  const title = useMemo(() => {
    if (folderId === null) return 'Pastas (Root)';
    const last = breadcrumb?.[breadcrumb.length - 1];
    return last?.name ? `Pasta: ${last.name}` : 'Pasta';
  }, [folderId, breadcrumb]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <div className="mt-2">
          <Breadcrumb chain={breadcrumb as any[]} />
        </div>
      </div>

      {(foldersError || assetsError) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
          {foldersError ?? assetsError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-white font-semibold">Subpastas</h3>
            <div className="mt-4 space-y-3">
              {foldersLoading && <div className="text-gray-400 text-sm">Carregando...</div>}
              {!foldersLoading && folders.length === 0 && (
                <div className="text-gray-400 text-sm">Nenhuma subpasta.</div>
              )}
              {folders.map((f) => (
                <FolderCard key={f.id} folder={f} />
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="mb-6">
              <UploadDropzone folderId={folderId} onUploaded={() => refresh()} />
            </div>
            <AssetGrid
              title="Assets nesta pasta"
              assets={assets}
              loading={assetsLoading}
              emptyText="Nenhum asset nessa pasta ainda."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
