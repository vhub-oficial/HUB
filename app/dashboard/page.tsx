import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAssets } from '../../hooks/useAssets';
import { useFolders } from '../../hooks/useFolders';
import { AssetCard } from '../../components/Assets/AssetCard';
import { FolderCard } from '../../components/Folders/FolderCard';
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

  useEffect(() => {
    if (!type) return;
    setFilters({ tags: '', meta: {} });
    const sp = new URLSearchParams(location.search);
    sp.set('type', type);
    sp.delete('tags');
    for (const key of Array.from(sp.keys())) {
      if (key.startsWith('m_')) sp.delete(key);
    }
    navigate({ pathname: location.pathname, search: `?${sp.toString()}` }, { replace: true });
  }, [typeRaw, type, location.pathname, location.search, navigate]);

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

    sp.delete('q');
    sp.delete('produto');
    sp.delete('dimensao');
    sp.delete('tag');

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

  const assetsArgs = useMemo(() => ({
    type,
    tagsAny,
    metaFilters: filters.meta,
    limit: 60,
  }), [type, JSON.stringify(tagsAny ?? []), JSON.stringify(filters.meta ?? {})]);

  // Fetch assets based on tag (or all if no tag)
  const { assets, loading: assetsLoading } = useAssets(assetsArgs);
  const { folders, loading: foldersLoading } = useFolders(null);

  const loading = assetsLoading || foldersLoading;

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
      {!type && (
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
      {!type && (
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
                {type ? `Filtro: ${type.replace('-', ' ')}` : 'Últimos Adicionados'}
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

                 {/* Show Folders if strictly filtering or on home (logic per requirements) */}
                 {folders.length > 0 && !type && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
                        {folders.map(folder => <FolderCard key={folder.id} folder={folder} />)}
                    </div>
                 )}

                 {/* Asset Grid */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {assets.length > 0 ? (
                        assets.map(asset => <AssetCard key={asset.id} asset={asset} />)
                    ) : (
                        <div className="col-span-full py-16 text-center border border-dashed border-[#222] rounded-xl">
                            <p className="text-gray-500">Nenhum ativo encontrado nesta seção.</p>
                        </div>
                    )}
                 </div>
             </div>
         )}
      </section>

    </div>
  );
};
