import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAssets } from '../../hooks/useAssets';
import { useFolders } from '../../hooks/useFolders';
import { AssetCard } from '../../components/Assets/AssetCard';
import { FolderCard } from '../../components/Folders/FolderCard';
import { Loader2, Users, Mic, Video, Smartphone, Music, Speaker, Clapperboard, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const DashboardPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tag = searchParams.get('tag') || undefined;
  const { organizationId } = useAuth();
  
  // Fetch assets based on tag (or all if no tag)
  const { assets, loading: assetsLoading } = useAssets({ tag });
  const { folders, loading: foldersLoading } = useFolders(null);

  const loading = assetsLoading || foldersLoading;

  // Stats State
  const [stats, setStats] = useState([
    { label: 'Deepfakes', count: 0, icon: Users, tag: 'deepfake' },
    { label: 'Voz para Clonar', count: 0, icon: Mic, tag: 'voz-clonada' },
    { label: 'Vídeos Originais', count: 0, icon: Video, tag: 'original' },
    { label: 'Tik Tok', count: 0, icon: Smartphone, tag: 'tiktok' },
    { label: 'Músicas', count: 0, icon: Music, tag: 'musica' },
    { label: 'SFX', count: 0, icon: Speaker, tag: 'sfx' },
    { label: 'VEO 3', count: 0, icon: Clapperboard, tag: 'veo3' },
    { label: 'Provas Sociais', count: 0, icon: Video, tag: 'prova-social' },
    { label: 'Depoimentos UGC', count: 0, icon: MessageSquare, tag: 'ugc' },
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
           .contains('tags', [stat.tag]);
         return { ...stat, count: count || 0 };
      }));
      setStats(newStats);
    };

    fetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return (
    <div className="p-8 space-y-10 min-h-screen">
      
      {/* 1. HERO SECTION - Only show on Home (no tag) */}
      {!tag && (
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
      {!tag && (
        <section>
            <div className="flex items-center gap-2 mb-6 border-l-4 border-gold pl-4">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Visão Geral do Acervo</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {stats.map((stat, idx) => (
                    <Link to={`/dashboard?tag=${stat.tag}`} key={idx} className="block group">
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
                {tag ? `Filtro: ${tag.replace('-', ' ')}` : 'Últimos Adicionados'}
            </h2>
         </div>

         {loading ? (
             <div className="flex justify-center py-20">
                 <Loader2 className="animate-spin text-gold" size={40} />
             </div>
         ) : (
             <div className="space-y-8">
                 {/* Show Folders if strictly filtering or on home (logic per requirements) */}
                 {folders.length > 0 && !tag && (
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
