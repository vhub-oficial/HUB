import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssetRow } from '../../hooks/useAssets';
import { Play, Link as LinkIcon, Pencil, Trash2, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createSignedUrl, getOrgBucketName } from '../../lib/storageHelpers';
import { useAssets } from '../../hooks/useAssets';

type Props = {
  asset: AssetRow;
  onDeleted?: () => void;
  onDragStart?: (e: React.DragEvent, assetId: string) => void;

  // ✅ Drive selection
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: (assetId: string, ev: { shift: boolean; meta: boolean; ctrl: boolean }) => void;
};

const isExternal = (asset: AssetRow) => {
  const source = asset.meta?.source;
  if (source === 'external') return true;
  return typeof asset.url === 'string' && /^https?:\/\//i.test(asset.url);
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

export const AssetCard: React.FC<Props> = ({
  asset,
  onDeleted,
  onDragStart,
  selected = false,
  selectionMode = false,
  onToggleSelect,
}) => {
  const navigate = useNavigate();
  const { organizationId, role } = useAuth();
  const { deleteAsset } = useAssets();
  const [src, setSrc] = React.useState<string>('');

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

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!organizationId) return;
        if (isExternal(asset)) {
          const thumb = asset.meta?.thumbnail_url || '';
          if (mounted) setSrc(thumb);
          return;
        }
        const bucket = getOrgBucketName(organizationId);
        const signed = await createSignedUrl(bucket, asset.url, 3600);
        if (mounted) setSrc(signed);
      } catch {
        if (mounted) setSrc('');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [organizationId, asset.url]);

  const handleCardClick = (e: React.MouseEvent) => {
    const meta = e.metaKey;
    const ctrl = e.ctrlKey;
    const shift = e.shiftKey;

    // ✅ Drive rule:
    // - If user is selecting (selectionMode) OR uses Ctrl/Cmd OR Shift: don't navigate, toggle/select.
    if (selectionMode || meta || ctrl || shift) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.(asset.id, { shift, meta, ctrl });
      return;
    }

    navigate(`/assets/${asset.id}`);
  };

  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-vhub-asset-id', asset.id);
        e.dataTransfer.setData('text/plain', asset.id);
        if (onDragStart) onDragStart(e, asset.id);
      }}
      onClick={handleCardClick}
      className={[
        'group text-left rounded-xl overflow-hidden bg-surface border transition-colors relative',
        selected ? 'border-gold/70 ring-2 ring-gold/30' : 'border-border hover:border-gold/40',
      ].join(' ')}
      aria-selected={selected ? 'true' : 'false'}
    >
      {/* Quick actions */}
      <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
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

      <div className="relative aspect-video bg-black/60 overflow-hidden">
        {!isExternal(asset) && src ? (
          <video
            src={src}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            muted
            playsInline
            preload="metadata"
          />
        ) : isExternal(asset) && src ? (
          <img
            src={src}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            alt={asset.name}
            loading="lazy"
          />
        ) : isExternal(asset) ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <div className="flex items-center gap-2">
              <LinkIcon size={16} />
              <span className="text-sm">Link externo</span>
            </div>
            <span className="text-xs text-gray-600">Abra para acessar</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">Sem preview</div>
        )}

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
            {isExternal(asset) ? <LinkIcon className="text-gold" size={22} /> : <Play className="text-gold" size={22} />}
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="text-white font-medium line-clamp-1">{asset.name}</div>
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
