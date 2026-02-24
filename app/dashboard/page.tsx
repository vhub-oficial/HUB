import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAssets } from '../../hooks/useAssets';
import { useFolders, type FolderRow } from '../../hooks/useFolders';
import { NewFolderModal } from '../../components/Folders/NewFolderModal';
import { AssetGrid } from '../../components/Assets/AssetGrid';
import { Loader2, Users, Mic, Video, Smartphone, Music, Speaker, Clapperboard, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FiltersBar, type FiltersValue } from '../../components/Assets/FiltersBar';
import { useFilterOptions } from '../../hooks/useFilterOptions';
import { GlobalDropOverlay } from '../../components/Uploads/GlobalDropOverlay';
import { normalizeCategoryType } from '../../lib/categoryType';

export const DashboardPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const typeRaw = searchParams.get('type');
  const folderFromUrl = searchParams.get('folder');
  const type = typeRaw ? typeRaw.toLowerCase() : null;
  const lastFolderKey = React.useMemo(() => {
    return type ? `vhub:lastFolder:${type}` : null;
  }, [type]);
  const didUserClearFolderRef = React.useRef(false);
  const q = searchParams.get('q') ?? '';
  const isSearching = !type && !!q.trim();
  const { organizationId, role } = useAuth();

  const isEventInsideSelectionCtxMenu = (ev: MouseEvent) => {
    const path = (ev.composedPath?.() ?? []) as any[];
    return path.some(
      (n) =>
        n &&
        (n as HTMLElement).dataset &&
        (n as HTMLElement).dataset.selectionCtxMenu !== undefined
    );
  };
  
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (isEventInsideSelectionCtxMenu(ev)) return;
      if (!(ev.target instanceof HTMLElement)) return;

      // Se clicou dentro de um card, não limpa
      if (ev.target.closest('[data-asset-card]')) return;

      // Se clicou em áreas marcadas para manter seleção, não limpa
      if (ev.target.closest('[data-keep-selection]')) return;

      // Clique fora: limpa seleção (Drive)
      setSelectedIds(new Set());
      setAnchorIndex(null);
    };

    // capture=true ajuda a pegar antes de handlers internos
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, []);

  React.useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (isEventInsideSelectionCtxMenu(ev)) return;
      setCtxMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onEsc);
    };
  }, []);

  React.useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (isEventInsideSelectionCtxMenu(ev)) return;
      if (!(ev.target instanceof HTMLElement)) return;
      if (ev.target.closest('[data-grid-menu]')) return;
      setGridMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Apply filters to URL (debounced)
  useEffect(() => {
    if (!type) return;
    const sp = new URLSearchParams(location.search);
    sp.set('type', type);

    if (folderFromUrl) sp.set('folder', String(folderFromUrl));
    else sp.delete('folder');

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
  }, [filters, type, location.pathname, location.search, navigate, folderFromUrl]);

  const tagsAny = useMemo(() => {
    if (!filters.tags.trim()) return null;
    return [filters.tags.trim()];
  }, [filters.tags]);

  // ✅ Fonte única da verdade: URL
  const activeFolderId = useMemo(
    () => (folderFromUrl ? String(folderFromUrl) : undefined),
    [folderFromUrl],
  );
  const [folderSearch, setFolderSearch] = useState('');
  const effectiveFolderId = useMemo(() => {
    if (activeFolderId) return activeFolderId;
    return null;
  }, [activeFolderId]);
  const { options } = useFilterOptions(type, effectiveFolderId);
  // Usaremos o mesmo seletor para ordenar também os assets.
  const [foldersSort, setFoldersSort] = useState<'recent' | 'az' | 'za'>('recent');
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [folderMenuOpenId, setFolderMenuOpenId] = useState<string | null>(null); // menu (...) no card
  const [breadcrumb, setBreadcrumb] = useState<FolderRow[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const toastTimer = useRef<any>(null);

  const showToast = (t: { type: 'success' | 'error' | 'info'; text: string }) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const [isBusyMove, setIsBusyMove] = useState(false);

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = React.useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = React.useState<null | { x: number; y: number }>(null);
  const [gridDensity, setGridDensity] = React.useState<'compact' | 'default' | 'large'>('default');
  const [gridMenuOpen, setGridMenuOpen] = React.useState(false);
  const closeCtxMenu = React.useCallback(() => setCtxMenu(null), []);

  const selectionMode = selectedIds.size > 0;

  const folderSortForHook = foldersSort === 'recent' ? 'recent' : 'name';
  const limit = 120;

  const assetsArgs = useMemo(() => ({
    type,
    folderId: effectiveFolderId ?? null,
    tagsAny,
    metaFilters: filters.meta,
    query: q ? q : null,
    limit,
  }), [
    type,
    effectiveFolderId,
    q,
    JSON.stringify(tagsAny ?? []),
    JSON.stringify(filters.meta ?? {}),
    limit,
  ]);

  // Fetch assets based on tag (or all if no tag)
  const {
    assets: scopedAssets,
    loading: assetsLoading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    moveAssetToFolder,
    deleteAsset,
  } = useAssets(assetsArgs);
  const {
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
    refresh: refreshFolders,
    getBreadcrumb,
  } = useFolders({ parentId: null, type: type ?? null, sort: folderSortForHook });
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const setFolderInUrl = useCallback((folderId: string | undefined) => {
    const sp = new URLSearchParams(location.search);

    if (folderId) sp.set('folder', folderId);
    else sp.delete('folder');

    const nextSearch = sp.toString();
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const normalizedType = useMemo(() => normalizeCategoryType(type ?? null), [type]);

  const foldersForCategory = useMemo(() => {
    const base = folders.filter((f) => !f.parent_id);
    if (!normalizedType) return base;
    return base.filter((f) => (f.category_type ?? null) === normalizedType);
  }, [folders, normalizedType]);

  const foldersFiltered = useMemo(() => {
    const qq = folderSearch.trim().toLowerCase();
    let next = !qq ? foldersForCategory : foldersForCategory.filter((f) => f.name.toLowerCase().includes(qq));
    if (foldersSort === 'za') next = [...next].reverse();
    return next;
  }, [foldersForCategory, folderSearch, foldersSort]);

  const canManageFolders = role === 'admin' || role === 'editor';

  const assetsSorted = useMemo(() => {
    const list = [...(scopedAssets ?? [])];
    if (foldersSort === 'az') {
      list.sort((a, b) => String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, { sensitivity: 'base' }));
    } else if (foldersSort === 'za') {
      list.sort((a, b) => String(b?.name ?? '').localeCompare(String(a?.name ?? ''), undefined, { sensitivity: 'base' }));
    }
    return list;
  }, [scopedAssets, foldersSort]);

  useEffect(() => {
    if (!type) return;
    setFolderInUrl(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!activeFolderId) {
        if (mounted) setBreadcrumb([]);
        return;
      }

      const chain = await getBreadcrumb(activeFolderId);
      if (mounted) setBreadcrumb(chain);
    })();

    return () => {
      mounted = false;
    };
  }, [activeFolderId, getBreadcrumb]);

  useEffect(() => {
    if (!lastFolderKey) return;

    if (activeFolderId) {
      sessionStorage.setItem(lastFolderKey, String(activeFolderId));
      didUserClearFolderRef.current = false;
    }
  }, [activeFolderId, lastFolderKey]);

  useEffect(() => {
    if (!type) return;
    if (!lastFolderKey) return;

    const restoreIfNeeded = () => {
      const sp = new URLSearchParams(location.search);
      const hasFolder = !!sp.get('folder');
      if (hasFolder) return;

      if (didUserClearFolderRef.current) return;

      const saved = sessionStorage.getItem(lastFolderKey);
      if (!saved) return;

      setFolderInUrl(saved);
    };

    const onVis = () => {
      if (document.visibilityState === 'visible') restoreIfNeeded();
    };

    document.addEventListener('visibilitychange', onVis);
    restoreIfNeeded();

    return () => document.removeEventListener('visibilitychange', onVis);
  }, [type, lastFolderKey, location.search, setFolderInUrl]);

  const scopedIdToIndex = React.useMemo(() => {
    const map = new Map<string, number>();
    scopedAssets.forEach((a, idx) => map.set(a.id, idx));
    return map;
  }, [scopedAssets]);

  React.useEffect(() => {
    // remove selected ids that are no longer visible in current scope
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (scopedIdToIndex.has(id)) next.add(id);
      }
      return next;
    });

    // reset anchor if it points outside new list
    setAnchorIndex((prev) => {
      if (prev == null) return null;
      if (prev < 0 || prev >= scopedAssets.length) return null;
      return prev;
    });
  }, [scopedAssets, scopedIdToIndex]);

  const handleToggleSelect = React.useCallback(
    (assetId: string, ev: { shift: boolean; meta: boolean; ctrl: boolean }) => {
      const idx = scopedIdToIndex.get(assetId);
      if (idx == null) return;

      setSelectedIds((prev) => {
        const next = new Set(prev);

        const isMultiKey = ev.meta || ev.ctrl;

        // SHIFT: range select between anchor and current
        if (ev.shift && anchorIndex != null) {
          const a = Math.min(anchorIndex, idx);
          const b = Math.max(anchorIndex, idx);

          // Drive behavior:
          // - If user also holds Ctrl/Cmd, ADD range
          // - else REPLACE with range
          const base = isMultiKey ? new Set(next) : new Set<string>();
          for (let i = a; i <= b; i++) {
            const id = scopedAssets[i]?.id;
            if (id) base.add(id);
          }
          return base;
        }

        // Ctrl/Cmd: toggle single
        if (isMultiKey) {
          if (next.has(assetId)) next.delete(assetId);
          else next.add(assetId);
          return next;
        }

        // normal click when already in selection mode:
        // replace with single
        return new Set([assetId]);
      });

      setAnchorIndex(idx);
    },
    [scopedAssets, scopedIdToIndex, anchorIndex]
  );

  const handleMarqueeSelect = React.useCallback(
    (ids: string[], mode: 'replace' | 'add') => {
      setSelectedIds((prev) => {
        const next = mode === 'add' ? new Set(prev) : new Set<string>();
        for (const id of ids) next.add(id);
        return next;
      });

      // set anchor as last id in ids (Drive-ish)
      const last = ids[ids.length - 1];
      const idx = scopedIdToIndex.get(last);
      if (idx != null) setAnchorIndex(idx);
    },
    [scopedIdToIndex]
  );


  const openSelectionContextMenu = React.useCallback(
    (e: React.MouseEvent, assetId?: string) => {
      e.preventDefault();
      e.stopPropagation();

      // Se clicou com direito em um asset:
      // - se já está selecionado, mantém seleção
      // - se não está selecionado, seleciona só ele (Drive-like)
      if (assetId) {
        setSelectedIds((prev) => {
          if (prev.has(assetId)) return prev;
          return new Set([assetId]);
        });
        setAnchorIndex(scopedIdToIndex.get(assetId) ?? null);
      }

      setCtxMenu({ x: e.clientX, y: e.clientY });
    },
    [scopedIdToIndex]
  );

  const onDragStartAsset = (e: React.DragEvent, assetId: string) => {
    setDraggingAssetId(assetId);
    e.dataTransfer.effectAllowed = 'move';
  };


  const getDraggedAssetIds = (e: React.DragEvent): string[] => {
    const rawList = e.dataTransfer.getData('application/x-vhub-asset-ids');
    if (rawList) {
      try {
        const ids = JSON.parse(rawList);
        if (Array.isArray(ids)) return ids.map(String).filter(Boolean);
      } catch {}
    }

    const single =
      e.dataTransfer.getData('application/x-vhub-asset-id') ||
      e.dataTransfer.getData('text/plain') ||
      '';

    return single.trim() ? [single.trim()] : [];
  };

  // drop em uma pasta (ou raiz com folderId = null)
  const handleDropOnFolder = async (folderId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const ids = getDraggedAssetIds(e);
    if (!ids.length) return;

    try {
      setIsBusyMove(true);

      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await moveAssetToFolder(id, folderId);
      }

      refresh();
      setSelectedIds(new Set());
      setAnchorIndex(null);
      if (folderId) {
        const fname = foldersFiltered.find((f) => f.id === folderId)?.name ?? 'pasta';
        showToast({ type: 'success', text: `Movido para “${fname}”` });
      } else {
        showToast({ type: 'success', text: 'Movido para a raiz' });
      }
    } catch (err: any) {
      showToast({ type: 'error', text: err?.message ?? 'Falha ao mover' });
    } finally {
      setIsBusyMove(false);
    }
  };

  const downloadZipFromEdge = async (payload: { ids?: string[]; folderId?: string | null; filename?: string }) => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vhub-zip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let msg = 'Falha no ZIP';
      try {
        const j = await res.json();
        msg = j?.error ?? msg;
      } catch {}
      throw new Error(msg);
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${(payload.filename ?? 'vhub')}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
  };

  const downloadSelectedAsZip = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) throw new Error('Nada selecionado.');
    await downloadZipFromEdge({ ids, filename: `vhub-${type ?? 'assets'}-${Date.now()}` });
  };

  const deleteSelectedAssets = async () => {
    const ids = Array.from(selectedIds).filter(Boolean);
    if (!ids.length) throw new Error('Nada selecionado.');

    const byId = new Map(scopedAssets.map((a) => [a.id, a]));
    const assetsToDelete = ids.map((id) => byId.get(id)).filter(Boolean);

    if (!assetsToDelete.length) throw new Error('Nenhum asset selecionado encontrado nesta lista.');

    const ok = window.confirm(`Deletar ${assetsToDelete.length} asset(s)? Essa ação não pode ser desfeita.`);
    if (!ok) return;

    for (const asset of assetsToDelete) {
      // eslint-disable-next-line no-await-in-loop
      await deleteAsset(asset);
    }
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

    if (activeFolderId === folderId) {
      setFolderMenuOpenId(null);
      setFolderInUrl(undefined);
    }

    refresh();
    refreshFolders?.();
  };

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
                   <div data-keep-selection>
                     <FiltersBar
                       type={type}
                       value={filters}
                       options={options}
                       onChange={setFilters}
                       onClear={() => setFilters({ tags: '', meta: {} })}
                     />
                   </div>
                 )}

                 {/* ✅ Pastas (Drive-style) */}
                 <div className="mt-6">
                   {/* Top row: breadcrumb (somente quando dentro da pasta) + controles à direita */}
                   <div className="flex items-center justify-between gap-3">
                     <div className="min-h-[40px] flex items-center">
                       {type ? (
                         <div className="mt-3 flex items-center gap-2 flex-wrap">
                           <button
                             className="text-sm text-gray-300 hover:text-white border border-border bg-black/30 rounded-lg px-3 py-1"
                             onClick={() => {
                              didUserClearFolderRef.current = true;
                              if (lastFolderKey) sessionStorage.removeItem(lastFolderKey);

                              setFolderInUrl(undefined);
                              setFilters({ tags: '', meta: {} });
                            }}
                             onDragOver={(e) => e.preventDefault()}
                             onDrop={(e) => handleDropOnFolder(null, e)}
                             title="Raiz da categoria"
                           >
                             {(type ?? 'RAIZ').toUpperCase()}
                           </button>

                           {breadcrumb.map((node) => (
                             <div key={node.id} className="flex items-center gap-2">
                               <span className="text-gray-500 text-sm">/</span>
                               <button
                                 className="text-sm text-gray-200 hover:text-white border border-border bg-black/20 rounded-lg px-3 py-1 hover:border-gold/30"
                                 onClick={() => {
                                   setFolderInUrl(node.id);
                                   setFilters({ tags: '', meta: {} });
                                 }}
                                 onDragOver={(e) => e.preventDefault()}
                                 onDrop={(e) => handleDropOnFolder(node.id, e)}
                                 title="Abrir pasta"
                               >
                                 {node.name}
                               </button>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="opacity-0 select-none">.</div>
                       )}
                     </div>

                     {/* Controles à direita (sempre) */}
                     <div className="flex items-center gap-2">
                       <select
                         className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold/40"
                         value={foldersSort}
                         onChange={(e) => setFoldersSort(e.target.value as any)}
                       >
                         <option value="recent">Recentes</option>
                         <option value="az">A–Z</option>
                         <option value="za">Z–A</option>
                       </select>

                      <div className="relative" data-grid-menu>
                        <button
                          type="button"
                          className="flex items-center gap-2 bg-black/40 border border-border rounded-lg px-3 py-2 text-white cursor-pointer hover:border-gold/40 transition-colors"
                          title="Visualização do grid"
                          onClick={() => setGridMenuOpen((v) => !v)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" />
                            <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" />
                            <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.6" />
                            <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.6" />
                          </svg>

                          <span className="text-sm font-medium">
                            {gridDensity === 'compact' && 'Compacto'}
                            {gridDensity === 'default' && 'Padrão'}
                            {gridDensity === 'large' && 'Grande'}
                          </span>

                          {/* caret */}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-80">
                            <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {gridMenuOpen && (
                          <div className="absolute right-0 mt-2 w-40 rounded-xl border border-border bg-black/90 backdrop-blur p-2 z-30">
                            {(['compact', 'default', 'large'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                className={[
                                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                                  gridDensity === mode ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5',
                                ].join(' ')}
                                onClick={() => {
                                  setGridDensity(mode);
                                  setGridMenuOpen(false);
                                }}
                              >
                                {mode === 'compact' && 'Compacto'}
                                {mode === 'default' && 'Padrão'}
                                {mode === 'large' && 'Grande'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                       {!activeFolderId && (
                         <input
                           className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white w-64"
                           placeholder="Buscar pastas..."
                           value={folderSearch}
                           onChange={(e) => setFolderSearch(e.target.value)}
                         />
                       )}


                      {canManageFolders && (
                        <button
                          className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white hover:border-gold/40"
                          onClick={() => setNewFolderOpen(true)}
                        >
                          + Nova pasta
                        </button>
                      )}
                     </div>
                   </div>

                   {/* ✅ Folder cards: só aparecem na RAIZ (como Drive) */}
                   {!activeFolderId && (
                     <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                       {foldersFiltered.map((f) => {
                         const isOver = dragOverFolderId === f.id && !!draggingAssetId;
                         return (
                           <div
                             key={f.id}
                             className={[
                               'relative rounded-2xl border border-border bg-black/20 transition-all',
                               'hover:bg-black/30 hover:border-gold/40',
                               isOver ? 'border-gold/60 ring-2 ring-gold/20 scale-[1.01]' : '',
                             ].join(' ')}
                             onDragOver={(e) => {
                               if (draggingAssetId) e.preventDefault();
                             }}
                             onDragEnter={() => {
                               if (draggingAssetId) setDragOverFolderId(f.id);
                             }}
                             onDragLeave={() => {
                               if (dragOverFolderId === f.id) setDragOverFolderId(null);
                             }}
                             onDrop={async (e) => {
                               setDragOverFolderId(null);
                               await handleDropOnFolder(f.id, e);
                             }}
                           >
                             {/* Card inteiro clicável */}
                             <button
                               className="w-full text-left p-4 flex items-center gap-3"
                               onClick={() => {
                                 setFolderInUrl(f.id);
                                 setFilters({ tags: '', meta: {} });
                                 setFolderMenuOpenId(null);
                               }}
                             >
                               {/* Ícone estilo Drive (inline SVG) */}
                               <div className="w-11 h-11 rounded-xl bg-black/30 border border-border flex items-center justify-center">
                                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                   <path
                                     d="M10 8.5v7l6-3.5-6-3.5Z"
                                     fill="currentColor"
                                   />
                                   <path
                                     d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10Z"
                                     stroke="currentColor"
                                     strokeWidth="1.5"
                                   />
                                 </svg>
                               </div>

                               <div className="flex-1">
                                 <div className="text-white font-semibold leading-tight">{f.name}</div>
                                 <div className="text-xs text-gray-500 mt-1">Pasta</div>
                               </div>
                             </button>

                             {/* Ações (...) no hover */}
                             <div className="absolute top-3 right-3">
                               <button
                                 className="w-9 h-9 rounded-lg bg-black/30 border border-border text-gray-200 hover:border-gold/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                 onClick={() => setFolderMenuOpenId((v) => (v === f.id ? null : f.id))}
                                 title="Ações"
                               >
                                 …
                               </button>

                               {folderMenuOpenId === f.id && canManageFolders && (
                                 <div className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-black/90 backdrop-blur p-2 z-20">
                                   <button
                                     className="w-full text-left px-3 py-2 rounded-lg text-gray-100 hover:bg-white/5"
                                     onClick={() => {
                                       setFolderMenuOpenId(null);
                                       onRenameFolder(f.id, f.name);
                                     }}
                                   >
                                     Renomear
                                   </button>
                                   <button
                                     className="w-full text-left px-3 py-2 rounded-lg text-gray-100 hover:bg-white/5"
                                     onClick={async () => {
                                       setFolderMenuOpenId(null);
                                       try {
                                         await downloadZipFromEdge({
                                           folderId: f.id,
                                           filename: `vhub-${type ?? 'assets'}-pasta-${Date.now()}`,
                                         });
                                         showToast({ type: 'success', text: 'Download iniciado (ZIP)' });
                                       } catch (e: any) {
                                         showToast({ type: 'error', text: e?.message ?? 'Falha no download' });
                                       }
                                     }}
                                   >
                                     Baixar (ZIP)
                                   </button>
                                   <button
                                     className="w-full text-left px-3 py-2 rounded-lg text-red-200 hover:bg-red-500/10"
                                     onClick={() => {
                                       setFolderMenuOpenId(null);
                                       onDeleteFolder(f.id, f.name);
                                     }}
                                   >
                                     Apagar
                                   </button>
                                 </div>
                               )}
                             </div>

                             {/* Overlay “Solte para mover” */}
                             {isOver && (
                               <div className="absolute inset-0 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center pointer-events-none">
                                 <div className="text-sm font-semibold text-gold animate-pulse">
                                   Solte para mover
                                 </div>
                               </div>
                             )}
                           </div>
                         );
                       })}

                       {foldersFiltered.length === 0 && (
                         <div className="text-gray-500 text-sm mt-2">Nenhuma pasta encontrada.</div>
                       )}
                     </div>
                   )}
                 </div>

                 {/* Asset Grid */}
                 <div
                   className="mt-6"
                   onMouseDown={(e) => {
                     const path = ((e as any).nativeEvent?.composedPath?.() ?? []) as any[];
                     const insideMenu = path.some(
                       (n) => n && (n as HTMLElement).dataset && (n as HTMLElement).dataset.selectionCtxMenu !== undefined
                     );
                     if (insideMenu) return;

                     const target = e.target as HTMLElement;

                     // Se clicou dentro de um card, ignora
                     if (target.closest('[data-asset-card]')) return;

                     // Caso contrário, limpa seleção
                     setSelectedIds(new Set());
                     setAnchorIndex(null);
                   }}
                   onDragOver={(e) => {
                     if (activeFolderId && draggingAssetId) e.preventDefault();
                   }}
                   onDrop={async (e) => {
                     if (!activeFolderId) return;
                     await handleDropOnFolder(null, e);
                   }}
                 >
                    <AssetGrid
                      assets={assetsSorted}
                      selectedIds={selectedIds}
                      selectionMode={selectionMode}
                      onToggleSelect={handleToggleSelect}
                      onMarqueeSelect={handleMarqueeSelect}
                      onDeleted={refresh}
                      onDragStart={onDragStartAsset}
                      onItemContextMenu={openSelectionContextMenu}
                      density={gridDensity}
                    />
                    {hasMore && (
                      <div className="mt-6 flex justify-center">
                        <button
                          className="px-4 py-2 rounded-xl bg-black/30 border border-border text-gray-200 hover:border-gold/40 disabled:opacity-50"
                          disabled={assetsLoading || loadingMore}
                          onClick={() => loadMore()}
                          title="Carregar mais"
                        >
                          {loadingMore ? 'Carregando…' : 'Carregar mais'}
                        </button>
                      </div>
                    )}
                    {scopedAssets.length === 0 && (
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


      {type && (
        <GlobalDropOverlay
          categoryType={type}
          folderId={activeFolderId ?? null}
          enabled
        />
      )}


      {ctxMenu && selectedIds.size > 0 && (
        <div
          className="fixed z-[9999] rounded-xl border border-border bg-black/95 backdrop-blur p-2 w-56 shadow-2xl"
          data-selection-ctx-menu
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* DOWNLOAD ZIP */}
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-gray-100 hover:bg-white/5"
            onMouseDown={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              closeCtxMenu();
              showToast({ type: 'info', text: 'Preparando ZIP…' });
              try {
                await downloadSelectedAsZip();
                showToast({ type: 'success', text: 'ZIP gerado — download iniciado.' });
              } catch (e: any) {
                showToast({ type: 'error', text: e?.message ?? 'Falha ao gerar ZIP' });
              }
            }}
          >
            Baixar selecionados (ZIP)
          </button>

          {/* DELETE SELECIONADOS */}
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-red-300 hover:bg-white/5"
            onMouseDown={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              closeCtxMenu();
              showToast({ type: 'info', text: 'Deletando selecionados…' });
              try {
                await deleteSelectedAssets();
                setSelectedIds(new Set());
                setAnchorIndex(null);
                refresh();
                showToast({ type: 'success', text: 'Selecionados deletados.' });
              } catch (e: any) {
                showToast({ type: 'error', text: e?.message ?? 'Falha ao deletar' });
              }
            }}
          >
            Deletar selecionados
          </button>

          <button
            className="w-full text-left px-3 py-2 rounded-lg text-gray-200 hover:bg-white/5"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closeCtxMenu();
              setSelectedIds(new Set());
              setAnchorIndex(null);
            }}
          >
            Limpar seleção
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] animate-fade-in">
          <div
            className={`
              px-6 py-3 rounded-xl shadow-2xl border
              font-medium text-sm tracking-wide
              transition-all duration-300
              ${
                toast.type === 'error'
                  ? 'bg-red-600 text-white border-red-400'
                  : toast.type === 'success'
                    ? 'bg-yellow-400 text-black border-yellow-300'
                    : toast.type === 'info'
                      ? 'bg-yellow-400 text-black border-yellow-300'
                      : 'bg-black text-white border-border'
              }
            `}
          >
            {toast.text}
          </div>
        </div>
      )}

    </div>
  );
};
