import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssetRow } from '../../hooks/useAssets';
import { Play, Link as LinkIcon, AudioLines, Pencil, Trash2, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createSignedUrl, getOrgBucketName } from '../../lib/storageHelpers';
import { useAssets } from '../../hooks/useAssets';
import { supabase } from '../../lib/supabase';

type Props = {
  asset: AssetRow;
  onDeleted?: () => void;
  onDragStart?: (e: React.DragEvent, assetId: string) => void;

  selected?: boolean;
  selectedIds?: string[];
  selectionMode?: boolean;
  onToggleSelect?: (assetId: string, ev: { shift: boolean; meta: boolean; ctrl: boolean }) => void;
  onContextMenu?: (e: React.MouseEvent, assetId?: string) => void;
  onRenameInline?: (assetId: string, nextName: string) => Promise<void> | void;

  renamingId: string | null;
  onOpenRename?: (assetId: string) => void;
  onCloseRename?: () => void;
  canRenameInline: boolean;
};

type VhubAudioSingleton = {
  audio: HTMLAudioElement;
  assetId: string | null;
};

declare global {
  interface Window {
    __vhubAudio?: VhubAudioSingleton;
  }
}

const AUDIO_EVT = 'vhub:audio:play';

const isExternal = (asset: AssetRow) => {
  const source = asset.meta?.source;
  if (source === 'external') return true;
  return typeof asset.url === 'string' && /^https?:\/\//i.test(asset.url);
};

const isAudio = (asset: AssetRow) => {
  const mt = (asset.meta as any)?.mime_type as string | undefined;
  if (mt && mt.toLowerCase().startsWith('audio/')) return true;

  const n = (asset.name || asset.url || '').toLowerCase();
  return (
    n.endsWith('.mp3') ||
    n.endsWith('.wav') ||
    n.endsWith('.m4a') ||
    n.endsWith('.aac') ||
    n.endsWith('.ogg') ||
    n.endsWith('.flac')
  );
};

const sanitizeFilename = (name: string) =>
  (name || 'download')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);

const extFromMime = (mime?: string | null) => {
  if (!mime) return '';
  const m = mime.toLowerCase();
  if (m.includes('video/mp4')) return '.mp4';
  if (m.includes('video/quicktime')) return '.mov';
  if (m.includes('video/webm')) return '.webm';
  if (m.includes('audio/mpeg')) return '.mp3';
  if (m.includes('audio/wav')) return '.wav';
  if (m.includes('audio/mp4')) return '.m4a';
  if (m.includes('image/png')) return '.png';
  if (m.includes('image/jpeg')) return '.jpg';
  if (m.includes('image/webp')) return '.webp';
  return '';
};

const buildDownloadName = (asset: AssetRow) => {
  const base = sanitizeFilename(asset.name || asset.meta?.original_name || 'download');
  const original = (asset.meta?.original_name as string | undefined) || '';
  const originalExt = original.includes('.') ? `.${original.split('.').pop()}` : '';
  const mimeExt = extFromMime(asset.meta?.mime_type);
  const ext = originalExt || mimeExt || '';
  return `${base}${ext}`;
};

const MediaFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="w-full overflow-hidden rounded-xl bg-black/25 border border-white/5 relative"
    style={{ aspectRatio: '16 / 9' }}
  >
    <div className="absolute inset-0">{children}</div>
  </div>
);

export const AssetCard: React.FC<Props> = ({
  asset,
  onDeleted,
  onDragStart,
  selected = false,
  selectedIds,
  onToggleSelect,
  onContextMenu,
  onRenameInline,
  renamingId,
  onOpenRename,
  onCloseRename,
  canRenameInline,
}) => {
  const navigate = useNavigate();
  const { organizationId, role } = useAuth();
  const { deleteAsset } = useAssets();
  const [src, setSrc] = React.useState<string>('');
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isAudioLoading, setIsAudioLoading] = React.useState(false);
  const external = React.useMemo(() => isExternal(asset), [asset.id]);
  const audioCapable = React.useMemo(() => isAudio(asset), [asset]);
  const assetIdRef = React.useRef<string>(asset.id);
  const renaming = renamingId === asset.id;
  const [draftName, setDraftName] = React.useState(asset.name ?? '');
  const [renameSaving, setRenameSaving] = React.useState(false);

  React.useEffect(() => {
    assetIdRef.current = asset.id;
  }, [asset.id]);

  React.useEffect(() => {
    if (!renaming) setDraftName(asset.name ?? '');
  }, [asset.name, renaming]);

  React.useEffect(() => {
    const onOtherPlay = (ev: Event) => {
      const ce = ev as CustomEvent<{ assetId: string }>;
      const otherId = ce?.detail?.assetId;
      if (!otherId || otherId === assetIdRef.current) return;

      if (isPlaying) {
        try {
          const singleton = window.__vhubAudio;
          if (singleton?.audio) singleton.audio.pause();
        } catch {}
        setIsPlaying(false);
      }
    };

    window.addEventListener(AUDIO_EVT, onOtherPlay as EventListener);
    return () => window.removeEventListener(AUDIO_EVT, onOtherPlay as EventListener);
  }, [isPlaying]);

  const handleDownload = React.useCallback(async () => {
    try {
      if (isExternal(asset)) {
        const direct = asset.meta?.download_url || asset.url;
        window.open(direct, '_blank', 'noopener,noreferrer');
        return;
      }
      if (!organizationId) return;
      const bucket = getOrgBucketName(organizationId);
      const signed = await createSignedUrl(bucket, asset.url, 3600);
      const filename = buildDownloadName(asset);

      const res = await fetch(signed);
      if (!res.ok) throw new Error('download_failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
    } catch {
      navigate(`/assets/${asset.id}`);
    }
  }, [asset, organizationId, navigate]);

  const getPlayableAudioUrl = React.useCallback(async (): Promise<string> => {
    if (isExternal(asset)) {
      const direct = (asset.meta?.download_url || asset.url || '').toString();
      if (!direct) throw new Error('invalid_external_url');
      return direct;
    }

    if (!organizationId) throw new Error('missing_organization');
    if (!asset.url) throw new Error('missing_storage_path');

    const bucket = getOrgBucketName(organizationId);
    const signed = await createSignedUrl(bucket, asset.url, 3600);
    if (!signed) throw new Error('signed_url_failed');
    return signed;
  }, [asset, organizationId]);

  const stopIfSingletonIsThis = React.useCallback(() => {
    const singleton = window.__vhubAudio;
    if (singleton?.assetId === asset.id && singleton.audio) {
      try {
        singleton.audio.pause();
      } catch {}
      singleton.assetId = null;
    }
    setIsPlaying(false);
  }, [asset.id]);

  const toggleAudio = React.useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const singleton = window.__vhubAudio;
      if (singleton?.assetId === asset.id && singleton.audio && !singleton.audio.paused) {
        singleton.audio.pause();
        setIsPlaying(false);
        return;
      }

      setIsAudioLoading(true);

      try {
        window.dispatchEvent(new CustomEvent(AUDIO_EVT, { detail: { assetId: asset.id } }));
        const url = await getPlayableAudioUrl();

        if (!window.__vhubAudio?.audio) {
          window.__vhubAudio = { audio: new Audio(), assetId: null };
        }

        const s = window.__vhubAudio;
        if (!s) throw new Error('audio_singleton_missing');

        const audio = s.audio;
        try {
          audio.pause();
        } catch {}

        s.assetId = asset.id;

        audio.onended = () => {
          if (window.__vhubAudio?.assetId === assetIdRef.current) {
            window.__vhubAudio.assetId = null;
          }
          setIsPlaying(false);
        };

        audio.onpause = () => {
          if (window.__vhubAudio?.assetId === assetIdRef.current) {
            setIsPlaying(false);
          }
        };

        audio.onplay = () => {
          if (window.__vhubAudio?.assetId === assetIdRef.current) {
            setIsPlaying(true);
          }
        };

        if (audio.src !== url) audio.src = url;

        try {
          audio.load();
        } catch {}

        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('[AudioInline] play failed', err);
        setIsPlaying(false);
      } finally {
        setIsAudioLoading(false);
      }
    },
    [asset.id, getPlayableAudioUrl],
  );

  React.useEffect(() => {
    return () => {
      stopIfSingletonIsThis();
    };
  }, [stopIfSingletonIsThis]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (external) {
          const thumb = asset.meta?.thumbnail_url || '';
          if (mounted) setSrc(thumb);
          return;
        }

        const thumbPath = (asset.meta as any)?.thumbnail_path as string | undefined;
        const thumbBucket = (asset.meta as any)?.thumbnail_bucket as string | undefined;

        if (!thumbPath) {
          if (mounted) setSrc('');
          return;
        }

        if (thumbBucket === 'vhub-thumbs') {
          const { data } = supabase.storage.from('vhub-thumbs').getPublicUrl(thumbPath);
          if (mounted) setSrc(data.publicUrl || '');
          return;
        }

        if (!organizationId) {
          if (mounted) setSrc('');
          return;
        }

        const bucket = getOrgBucketName(organizationId);
        const signed = await createSignedUrl(bucket, thumbPath, 3600);
        if (mounted) setSrc(signed);
      } catch {
        if (mounted) setSrc('');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [asset.id, external, organizationId, (asset.meta as any)?.thumbnail_path, (asset.meta as any)?.thumbnail_bucket]);

  const cancelRename = React.useCallback(() => {
    setDraftName(asset.name ?? '');
    setRenameSaving(false);
    onCloseRename?.();
  }, [asset.name, onCloseRename]);

  const commitRename = React.useCallback(async () => {
    if (!canRenameInline) return;
    if (!onRenameInline) return;

    const clean = String(draftName ?? '').trim();
    if (!clean || clean === (asset.name ?? '').trim()) {
      onCloseRename?.();
      return;
    }

    try {
      setRenameSaving(true);
      await onRenameInline(asset.id, clean);
    } finally {
      setRenameSaving(false);
    }
  }, [canRenameInline, onRenameInline, draftName, asset.id, asset.name, onCloseRename]);

  const handleCardClick = (e: React.MouseEvent) => {
    const meta = e.metaKey;
    const ctrl = e.ctrlKey;
    const shift = e.shiftKey;

    // ✅ Drive: 1 clique sempre seleciona (sem navegar)
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect?.(asset.id, { shift, meta, ctrl });
  };

  const handleCardDoubleClick = (e: React.MouseEvent) => {
    // ✅ Drive: 2 cliques abre
    e.preventDefault();
    e.stopPropagation();
    navigate(`/assets/${asset.id}`);
  };

  if (renaming && !canRenameInline) {
    onCloseRename?.();
  }

  return (
    <button
      data-asset-card
      draggable
      onDragStart={(e) => {
        const ids =
          selectedIds && selectedIds.length > 0
            ? (selectedIds.includes(asset.id) ? selectedIds : [asset.id])
            : [asset.id];

        e.dataTransfer.setData('application/x-vhub-asset-ids', JSON.stringify(ids));
        e.dataTransfer.setData('application/x-vhub-asset-id', asset.id);
        e.dataTransfer.setData('text/plain', asset.id);

        // ✅ Drive-like drag preview (badge com quantidade)
        try {
          if (ids.length > 1) {
            const ghost = document.createElement('div');
            ghost.style.position = 'fixed';
            ghost.style.top = '-1000px';
            ghost.style.left = '-1000px';
            ghost.style.width = '220px';
            ghost.style.height = '64px';
            ghost.style.display = 'flex';
            ghost.style.alignItems = 'center';
            ghost.style.gap = '10px';
            ghost.style.padding = '10px 12px';
            ghost.style.borderRadius = '14px';
            ghost.style.background = 'rgba(0,0,0,0.82)';
            ghost.style.border = '1px solid rgba(255,255,255,0.12)';
            ghost.style.boxShadow = '0 10px 30px rgba(0,0,0,0.45)';
            ghost.style.backdropFilter = 'blur(10px)';
            ghost.style.webkitBackdropFilter = 'blur(10px)';
            ghost.style.color = '#fff';
            ghost.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';

            const thumb = document.createElement('div');
            thumb.style.width = '44px';
            thumb.style.height = '44px';
            thumb.style.borderRadius = '12px';
            thumb.style.background = 'rgba(255,255,255,0.08)';
            thumb.style.border = '1px solid rgba(255,255,255,0.12)';
            thumb.style.display = 'flex';
            thumb.style.alignItems = 'center';
            thumb.style.justifyContent = 'center';
            thumb.style.flex = '0 0 auto';

            // ícone simples (sem dependências)
            thumb.innerHTML =
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none">' +
              '<path d="M7 7a2 2 0 0 1 2-2h6l2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7Z" stroke="rgba(255,255,255,0.85)" stroke-width="1.6"/>' +
              '<path d="M15 5v2h2" stroke="rgba(255,255,255,0.85)" stroke-width="1.6"/>' +
              '</svg>';

            const textWrap = document.createElement('div');
            textWrap.style.display = 'flex';
            textWrap.style.flexDirection = 'column';
            textWrap.style.minWidth = '0';

            const title = document.createElement('div');
            title.textContent = 'Movendo itens';
            title.style.fontSize = '13px';
            title.style.fontWeight = '700';
            title.style.lineHeight = '1.1';

            const subtitle = document.createElement('div');
            subtitle.textContent = `${ids.length} selecionado(s)`;
            subtitle.style.fontSize = '12px';
            subtitle.style.opacity = '0.75';
            subtitle.style.marginTop = '3px';
            subtitle.style.whiteSpace = 'nowrap';
            subtitle.style.overflow = 'hidden';
            subtitle.style.textOverflow = 'ellipsis';

            const badge = document.createElement('div');
            badge.textContent = String(ids.length);
            badge.style.marginLeft = 'auto';
            badge.style.width = '30px';
            badge.style.height = '30px';
            badge.style.borderRadius = '999px';
            badge.style.display = 'flex';
            badge.style.alignItems = 'center';
            badge.style.justifyContent = 'center';
            badge.style.fontSize = '12px';
            badge.style.fontWeight = '800';
            badge.style.background = 'rgba(255, 215, 0, 0.18)'; // gold-ish, sem depender de CSS
            badge.style.border = '1px solid rgba(255, 215, 0, 0.35)';
            badge.style.color = 'rgba(255,255,255,0.95)';

            textWrap.appendChild(title);
            textWrap.appendChild(subtitle);

            ghost.appendChild(thumb);
            ghost.appendChild(textWrap);
            ghost.appendChild(badge);

            document.body.appendChild(ghost);

            // offset para não esconder o cursor
            e.dataTransfer.setDragImage(ghost, 28, 18);

            // cleanup no próximo frame
            requestAnimationFrame(() => {
              ghost.remove();
            });
          }
        } catch {
          // se falhar, mantém preview padrão do browser
        }

        if (onDragStart) onDragStart(e, asset.id);
      }}
      onClick={handleCardClick}
      onDoubleClick={handleCardDoubleClick}
      onContextMenu={(e) => onContextMenu?.(e, asset.id)}
      className={[
        'group block w-full min-w-0 text-left rounded-xl overflow-hidden bg-surface border transition-colors relative',
        selected ? 'border-gold/70 ring-2 ring-gold/30' : 'border-border hover:border-gold/40',
      ].join(' ')}
      aria-selected={selected ? 'true' : 'false'}
    >
      {/* Quick actions */}
      <div
        className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
        data-no-marquee
      >
        <button
          data-no-marquee
          className="w-9 h-9 rounded-lg bg-black/50 border border-border text-gray-200 hover:border-gold/40 flex items-center justify-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDownload();
          }}
          title="Download"
        >
          <Download size={16} />
        </button>

        {(role === 'admin' || role === 'editor') && (
          <button
            data-no-marquee
            className="w-9 h-9 rounded-lg bg-black/50 border border-border text-gray-200 hover:border-gold/40 flex items-center justify-center"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/assets/${asset.id}?edit=1`);
            }}
            title="Editar"
          >
            <Pencil size={16} />
          </button>
        )}

        {role === 'admin' && (
          <button
            data-no-marquee
            className="w-9 h-9 rounded-lg bg-black/50 border border-border text-red-200 hover:border-red-500/40 flex items-center justify-center"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!confirm('Deletar este asset?')) return;
              await deleteAsset(asset);
              onDeleted?.();
            }}
            title="Deletar"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="relative">
        <MediaFrame>
          {src ? (
            <img
              src={src}
              alt={asset.name ?? 'Preview'}
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
          ) : external ? (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <div className="text-center">
                <div className="text-sm font-semibold">Link externo</div>
                <div className="text-xs text-gray-500 mt-1">Sem thumbnail</div>
              </div>
            </div>
          ) : isAudio(asset) ? (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <div className="text-center">
                <AudioLines className="mx-auto mb-2 text-gray-400" size={28} />
                <div className="text-sm font-semibold">Áudio</div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-xs">Sem preview</div>
            </div>
          )}
        </MediaFrame>

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
            {/* Ícone central (hover) */}
            {audioCapable ? (
              <button
                type="button"
                data-no-marquee
                onClick={(e) => toggleAudio(e as any)}
                className="pointer-events-auto text-gold"
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
                aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
                disabled={isAudioLoading}
              >
                {isPlaying ? (
                  // Pause icon
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M7 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M17 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  // Play icon (o mesmo estilo do seu Play atual)
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 7l10 5-10 5V7Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ) : (
              // ✅ Vídeo/imagem/external: mantém comportamento antigo (somente visual)
              external ? <LinkIcon className="text-gold" size={22} /> : <Play className="text-gold" size={22} />
            )}
          </div>
        </div>
      </div>

      <div className="p-3">
        {/* NOME DO ASSET (inline rename) */}
        <div
          className="mt-2 px-3 pb-3"
          data-no-marquee
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!canRenameInline) return;
            onOpenRename?.(asset.id);
          }}
        >
          {!renaming ? (
            <div className="text-sm text-white truncate" title={asset.name}>
              {asset.name}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={draftName}
                disabled={renameSaving}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRename();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/40 border border-border text-white text-sm outline-none focus:border-gold/60"
              />

              <button
                type="button"
                data-no-marquee
                disabled={renameSaving}
                className="text-xs px-3 py-2 rounded-xl border border-border bg-black/30 text-gray-200 hover:border-gold/40 disabled:opacity-50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commitRename();
                }}
                title="Salvar"
              >
                Salvar
              </button>

              <button
                type="button"
                data-no-marquee
                disabled={renameSaving}
                className="text-xs px-3 py-2 rounded-xl border border-border bg-black/30 text-gray-200 hover:border-red-400/60 disabled:opacity-50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelRename();
                }}
                title="Cancelar"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        <div className="mt-1 flex gap-2 flex-wrap">
          {(asset.tags ?? []).slice(0, 3).map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded bg-black/40 border border-border text-gray-300">
              {t}
            </span>
          ))}
          {(asset.tags?.length ?? 0) > 3 && (
            <span className="text-xs px-2 py-0.5 rounded bg-black/40 border border-border text-gray-400">
              +{(asset.tags?.length ?? 0) - 3}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
