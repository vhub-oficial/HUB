import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAssets } from '../../hooks/useAssets';
import { useFolders } from '../../hooks/useFolders';
import { NewFolderModal } from '../../components/Folders/NewFolderModal';
import { AssetCard } from '../../components/Assets/AssetCard';
import { Loader2, Users, Mic, Video, Smartphone, Music, Speaker, Clapperboard, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FiltersBar, type FiltersValue } from '../../components/Assets/FiltersBar';
import { useFilterOptions } from '../../hooks/useFilterOptions';

export const DashboardPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const typeRaw = searchParams.get('type');
  const type = typeRaw ? typeRaw.toLowerCase() : null;
  const q = searchParams.get('q') ?? '';
  const isSearching = !type && !!q.trim();
  const { organizationId } = useAuth();
  
  // Read filters from URL (persistência)
  const tags0 = searchParams.get('tags') ?? '';

  const metaFromUrl: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) {
    if (!k.startsWith('m_')) continue;
    metaFromUrl[k.slice(2)] = v;
  }

  const [filters, setFilters] = useState<FiltersValue>({
    tags: tags0,
    meta: metaFromUrl,
  });

  const prevTypeRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!type) return;
    if (prevTypeRef.current === null) {
      prevTypeRef.current = type;
      return;
    }
    if (prevTypeRef.current !== type) {
      prevTypeRef.current = type;
      setFilters({ tags: '', meta: {} });
    }
  }, [type]);

  // Sync state when URL changes (back/forward)
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const nextTags = sp.get('tags') ?? '';
    const nextMeta: Record<string, string> = {};
    for (const [k, v] of sp.entries()) {
      if (!k.startsWith('m_')) continue;
      nextMeta[k.slice(2)] = v;
    }
    setFilters({ tags: nextTags, meta: nextMeta });
  }, [location.search]);

  // Apply filters to URL (debounced)
  useEffect(() => {
    if (!type) return;
    const sp = new URLSearchParams(location.search);
    sp.set('type', type);

    if (filters.tags.trim()) sp.set('tags', filters.tags.trim());
    else sp.delete('tags');

    for (const key of Array.from(sp.keys())) {
      if (key.startsWith('m_')) sp.delete(key);
    }
    for (const [k, v] of Object.entries(filters.meta)) {
      if (!v || !v.trim()) continue;
      sp.set(`m_${k}`, v.trim());
    }

    const next = `?${sp.toString()}`;
    if (next !== location.search) {
      const t = setTimeout(() => {
        navigate({ pathname: location.pathname, search: next }, { replace: true });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [filters, type, location.pathname, location.search, navigate]);

  const tagsAny = useMemo(() => {
    if (!filters.tags.trim()) return null;
    return [filters.tags.trim()];
  }, [filters.tags]);

  const { options } = useFilterOptions(type);
  const [foldersSort, setFoldersSort] = useState<'recent' | 'az' | 'za'>('recent');
  // ✅ novo estado: pasta ativa (quando null, mostra "soltos")
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const folderSortForHook = foldersSort === 'recent' ? 'recent' : 'name';

  const assetsArgs = useMemo(() => ({
    type,
    folderId: null,
    tagsAny,
    metaFilters: filters.meta,
    query: q ? q : null,
    limit: 120,
  }), [type, q, JSON.stringify(tagsAny ?? []), JSON.stringify(filters.meta ?? {})]);

  // Fetch assets based on tag (or all if no tag)
  const { assets: looseAssets, loading: assetsLoading, refresh, moveAssetToFolder } = useAssets(assetsArgs);
  const {
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
    refresh: refreshFolders,
  } = useFolders({ parentId: null, type: type ?? null, sort: folderSortForHook });
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const foldersForCategory = useMemo(() => {
    const base = folders.filter((f) => !f.parent_id);
    if (!type) return base;
    return base.filter((f) => f.category_type === type);
  }, [folders, type]);

  const foldersFiltered = useMemo(() => {
    const qq = (q ?? '').trim().toLowerCase();
    let next = !qq ? foldersForCategory : foldersForCategory.filter((f) => f.name.toLowerCase().includes(qq));
    if (foldersSort === 'za') next = [...next].reverse();
    return next;
  }, [foldersForCategory, q, foldersSort]);

  const onDragStartAsset = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
  };

  // helper: pega assetId do drag
  const getDraggedAssetId = (e: React.DragEvent) => {
    return (
      e.dataTransfer.getData('application/x-vhub-asset-id') ||
      e.dataTransfer.getData('text/plain') ||
      ''
    ).trim();
  };

  // drop em uma pasta
  const handleDropOnFolder = async (folderId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const assetId = getDraggedAssetId(e);
    if (!assetId) return;

    await moveAssetToFolder(assetId, folderId);
    refresh();
  };

  // drop em "soltos"
  const handleDropToUnfiled = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const assetId = getDraggedAssetId(e);
    if (!assetId) return;
    await moveAssetToFolder(assetId, null);
    refresh();
  };

  // renomear
  const onRenameFolder = async (folderId: string, currentName: string) => {
    const next = window.prompt('Renomear pasta:', currentName);
    if (!next) return;
    const name = next.trim();
    if (!name || name === currentName) return;
    await renameFolder(folderId, name);
    refreshFolders?.();
  };

  // apagar (enterprise-safe: esvazia antes)
  const onDeleteFolder = async (folderId: string, folderName: string) => {
    const ok = window.confirm(`Apagar a pasta "${folderName}"? Os assets serão movidos para "Soltos".`);
    if (!ok) return;

    const { error: upErr } = await supabase
      .from('assets')
      .update({ folder_id: null })
      .eq('folder_id', folderId);

    if (upErr) {
      alert(upErr.message ?? 'Falha ao mover assets para "Soltos"');
      return;
    }

    await deleteFolder(folderId);

    if (activeFolderId === folderId) setActiveFolderId(null);

    refresh();
    refreshFolders?.();
  };

  const assetsScoped = useMemo(() => {
    if (activeFolderId) return looseAssets.filter((a) => a.folder_id === activeFolderId);
    return looseAssets.filter((a) => !a.folder_id);
  }, [looseAssets, activeFolderId]);

  const loading = assetsLoading;

  // Stats State
  const [stats, setStats] = useState([
    { label: 'Deepfakes', count: 0, icon: Users, type: 'deepfakes' },
    { label: 'Voz para Clonar', count: 0, icon: Mic, type: 'vozes' },
    { label: 'Vídeos Originais', count: 0, icon: Video, type: 'original' },
    { label: 'Tik Tok', count: 0, icon: Smartphone, type: 'tiktok' },
    { label: 'Músicas', count: 0, icon: Music, type: 'musicas' },
    { label: 'SFX', count: 0, icon: Speaker, type: 'sfx' },
    { label: 'VEO 3', count: 0, icon: Clapperboard, type: 'veo3' },
    { label: 'Provas Sociais', count: 0, icon: Video, type: 'provas-sociais' },
    { label: 'Depoimentos UGC', count: 0, icon: MessageSquare, type: 'ugc' },
  ]);
  const [totalAssets, setTotalAssets] = useState(0);

  // Fetch Stats Counts
  useEffect(() => {
    if (!organizationId) return;

    const fetchCounts = async () => {
      // Fetch Total
      const { count: total } = await supabase
        .from('assets')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);
      
      setTotalAssets(total || 0);

      // Fetch Per Category
      // Note: This fires multiple requests. In production, use an RPC or optimized query.
      const newStats = await Promise.all(stats.map(async (stat) => {
         const { count } = await supabase
           .from('assets')
           .select('*', { count: 'exact', head: true })
           .eq('organization_id', organizationId)
           .eq('type', stat.type);
         return { ...stat, count: count || 0 };
      }));
      setStats(newStats);
    };

    fetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return (
    <div className="p-8 space-y-10 min-h-screen">
      
      {/* 1. HERO SECTION - Only show on Home (no type) */}
      {!type && !isSearching && (
        <div className="relative w-full h-64 bg-black rounded-3xl border border-gold/20 flex flex-col items-center justify-center text-center overflow-hidden">
          <div className="absolute top-4 bg-gold/10 text-gold px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-gold/20">
            Hub Oficial
          </div>
          <h1 className="text-6xl font-black text-white mt-4 tracking-tighter">
            V<span className="text-gold">•</span>HUB
          </h1>
          <h2 className="text-xl text-gray-300 font-medium mt-2">Central de Inteligência de VSL</h2>
          <p className="text-sm text-gray-500 max-w-lg mt-2 italic">
            Acervo centralizado de ativos de alta performance. Encontre Deepfakes, UGCs, e áudios exclusivos selecionados para elevar o nível das suas edições.
          </p>
          
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gold/5 pointer-events-none"></div>
        </div>
      )}

      {/* 2. STATS GRID (Visão Geral) - Only show on Home */}
      {!type && !isSearching && (
        <section>
            <div className="flex items-center gap-2 mb-6 border-l-4 border-gold pl-4">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Visão Geral do Acervo</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {stats.map((stat, idx) => (
                    <Link to={`/dashboard?type=${stat.type}`} key={idx} className="block group">
                        <div className="bg-[#0f0f0f] border border-[#222] hover:border-gold/50 rounded-xl p-4 flex flex-col items-center justify-center transition-all h-28">
                            <stat.icon className="text-gold mb-2 group-hover:scale-110 transition-transform" size={20} />
                            <span className="text-xl font-bold text-white">{stat.count}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-500 mt-1">{stat.label}</span>
                        </div>
                    </Link>
                ))}
                
                {/* Total Stats Card */}
                <div className="bg-[#0f0f0f] border border-[#222] rounded-xl p-4 flex flex-col items-center justify-center h-28 col-span-1 lg:col-span-1 border-dashed border-gray-800">
                    <span className="text-2xl font-black text-white">{totalAssets}</span>
                    <span className="text-[10px] uppercase font-bold text-gray-500 mt-1">Ativos Totais</span>
                </div>
            </div>
        </section>
      )}

      {/* 3. CONTENT AREA (Assets & Folders) */}
      <section>
         <div className="flex items-center justify-between mb-6 border-l-4 border-gold pl-4">
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest">
              {type
                ? `Filtro: ${type.replace('-', ' ')}`
                : (isSearching ? `Resultados: "${q}"` : 'Últimos Adicionados')}
            </h2>
          </div>

         {loading ? (
             <div className="flex justify-center py-20">
                 <Loader2 className="animate-spin text-gold" size={40} />
             </div>
         ) : (
             <div className="space-y-8">
                 {type && (
                   <FiltersBar
                     type={type}
                     value={filters}
                     options={options}
                     onChange={setFilters}
                     onClear={() => setFilters({ tags: '', meta: {} })}
                   />
                 )}

                 {/* ✅ Pastas (Drive-style) */}
                 <div className="mt-6">
                   <div className="flex items-center justify-between gap-3">
                     <div>
                       <div className="text-white font-semibold">Pastas</div>
                       <div className="text-gray-400 text-sm">
                         {activeFolderId ? 'Dentro da pasta' : 'Soltos (sem pasta)'}
                       </div>
                     </div>

                     <div className="flex items-center gap-2">
                       <select
                         className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                         value={foldersSort}
                         onChange={(e) => setFoldersSort(e.target.value as any)}
                       >
                         <option value="recent">Recentes</option>
                         <option value="az">A–Z</option>
                         <option value="za">Z–A</option>
                       </select>

                       <button
                         className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white hover:border-gold/40"
                         onClick={() => setNewFolderOpen(true)}
                       >
                         + Nova pasta
                       </button>
                     </div>
                   </div>

                   {activeFolderId && (
                     <div className="mt-3 flex items-center gap-2">
                       {/* RAIZ (drop target para remover da pasta) */}
                       <button
                         className="text-sm text-gray-300 hover:text-white border border-border bg-black/30 rounded-lg px-3 py-1"
                         onClick={() => setActiveFolderId(null)}
                         onDragOver={(e) => e.preventDefault()}
                         onDrop={handleDropToUnfiled}
                         title="Solte aqui para remover da pasta (voltar para a raiz)"
                       >
                         {type ? type.toUpperCase() : 'RAIZ'}
                       </button>

                       <span className="text-gray-500 text-sm">/</span>

                       <span className="text-gray-200 text-sm">
                         {foldersFiltered.find((f) => f.id === activeFolderId)?.name ?? 'Pasta'}
                       </span>
                     </div>
                   )}

                   <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     {foldersFiltered.map((f) => (
                       <div
                         key={f.id}
                         className={`text-left bg-black/20 border border-border rounded-2xl p-4 hover:bg-black/30 hover:border-gold/40 transition-colors relative ${
                           activeFolderId === f.id ? 'border-gold/40' : ''
                         }`}
                         onDragOver={(e) => e.preventDefault()}
                         onDrop={(e) => handleDropOnFolder(f.id, e)}
                       >
                         <button
                           className="w-full text-left"
                           onClick={() => setActiveFolderId(f.id)}
                         >
                           <div className="text-white font-semibold">{f.name}</div>
                           <div className="text-gray-400 text-sm mt-1">Abrir</div>
                         </button>

                         <div className="absolute top-3 right-3 flex gap-2">
                           <button
                             className="text-xs px-2 py-1 rounded-md bg-black/40 border border-border text-gray-200 hover:border-gold/40"
                             onClick={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               onRenameFolder(f.id, f.name);
                             }}
                             title="Renomear"
                           >
                             Renomear
                           </button>

                           <button
                             className="text-xs px-2 py-1 rounded-md bg-black/40 border border-border text-red-200 hover:border-red-400/60"
                             onClick={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               onDeleteFolder(f.id, f.name);
                             }}
                             title="Apagar"
                           >
                             Apagar
                           </button>
                         </div>
                       </div>
                     ))}

                     {foldersFiltered.length === 0 && (
                       <div className="text-gray-500 text-sm mt-2">Nenhuma pasta encontrada.</div>
                     )}
                   </div>
                 </div>

                 {/* Asset Grid */}
                 <div className="mt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {assetsScoped.map((asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        onDeleted={refresh}
                        onDragStart={onDragStartAsset}
                      />
                    ))}
                  </div>
                  {assetsScoped.length === 0 && (
                    <div className="text-gray-500 text-sm mt-3">
                      {activeFolderId ? 'Nenhum asset nesta pasta.' : 'Nenhum asset solto.'}
                    </div>
                  )}
                 </div>
             </div>
         )}
      </section>


      <NewFolderModal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onCreate={(name) => {
          if (!type) {
            alert('Selecione uma categoria antes de criar uma pasta.');
            return Promise.resolve();
          }

          return createFolder(name, { parentId: null, type }).then(() => undefined);
        }}
        title={type ? `Nova pasta em ${type.toUpperCase()}` : 'Nova pasta'}
      />

    </div>
  );
};
