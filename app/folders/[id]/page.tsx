import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useFolders } from '../../../hooks/useFolders';
import { useAssets } from '../../../hooks/useAssets';
import { FolderCard } from '../../../components/Folders/FolderCard';
import { Breadcrumb } from '../../../components/Folders/Breadcrumb';
import { AssetGrid } from '../../../components/Assets/AssetGrid';
import { NewAssetModal } from '../../../components/Assets/NewAssetModal';
import { NewFolderModal } from '../../../components/Folders/NewFolderModal';

export const FolderPage: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const typeRaw = searchParams.get('type');
  const type = typeRaw ? typeRaw.toLowerCase() : null;
  const q = searchParams.get('q') ?? '';
  const tags = searchParams.get('tags') ?? '';
  const tagsAny = tags.trim() ? [tags.trim()] : null;

  const filters = useMemo(() => {
    const meta: Record<string, string> = {};
    for (const [k, v] of searchParams.entries()) {
      if (!k.startsWith('m_')) continue;
      meta[k.slice(2)] = v;
    }
    return { meta };
  }, [location.search]);

  const folderId = id === 'root' ? null : (id ?? null);

  const {
    folders: subfolders,
    loading: foldersLoading,
    error: foldersError,
    createFolder,
    getBreadcrumb,
  } = useFolders({ parentId: folderId, type: type ?? null });

  const { assets, loading: assetsLoading, error: assetsError, refresh } = useAssets({
    type: type ?? null,
    folderId: id,
    tagsAny,
    metaFilters: filters.meta,
    query: q ? q : null,
    limit: 60,
  });

  const [openNew, setOpenNew] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
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
    return () => {
      mounted = false;
    };
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
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Subpastas</h3>
              <button
                className="px-3 py-2 rounded-xl bg-black/40 border border-border text-white hover:bg-black/60 text-sm"
                onClick={() => setNewOpen(true)}
              >
                + Nova subpasta
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {foldersLoading && <div className="text-gray-400 text-sm">Carregando...</div>}
              {!foldersLoading && subfolders.length === 0 && (
                <div className="text-gray-400 text-sm">Nenhuma subpasta.</div>
              )}
              {subfolders.map((f) => (
                <FolderCard key={f.id} folder={f} />
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-surface border border-border rounded-xl p-6">
            <button
              className="w-full bg-gold text-black font-semibold rounded-xl py-3 hover:opacity-90 transition mb-6"
              onClick={() => setOpenNew(true)}
            >
              V•HUB · Novo Asset
            </button>
            <AssetGrid
              title="Assets nesta pasta"
              assets={assets}
              loading={assetsLoading}
              emptyText="Nenhum asset nessa pasta ainda."
            />
          </div>
        </div>
      </div>

      <NewAssetModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        initialCategory={type}
        onCreated={() => refresh()}
      />

      <NewFolderModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(name) => createFolder(name, { parentId: id, type: type ?? null }).then(() => undefined)}
        title="Nova subpasta"
      />
    </div>
  );
};
