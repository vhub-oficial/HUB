import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssetRow } from '../../hooks/useAssets';
import { Play, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createSignedUrl, getOrgBucketName } from '../../lib/storageHelpers';

type Props = {
  asset: AssetRow;
};

const isExternal = (asset: AssetRow) => {
  const source = asset.meta?.source;
  if (source === 'external') return true;
  // fallback: if url is full http(s), treat as external
  return typeof asset.url === 'string' && /^https?:\/\//i.test(asset.url);
};

export const AssetCard: React.FC<Props> = ({ asset }) => {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const [src, setSrc] = React.useState<string>('');

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!organizationId) return;
        if (isExternal(asset)) {
          // for external assets, prefer thumbnail_url if provided
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

  return (
    <button
      onClick={() => navigate(`/assets/${asset.id}`)}
      className="group text-left rounded-xl overflow-hidden bg-surface border border-border hover:border-gold/40 transition-colors"
    >
      <div className="relative aspect-video bg-black/60 overflow-hidden">
        {/* preview */}
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
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            Sem preview
          </div>
        )}

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
            {isExternal(asset) ? (
              <LinkIcon className="text-gold" size={22} />
            ) : (
              <Play className="text-gold" size={22} />
            )}
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
