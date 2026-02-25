import React from 'react';
import type { AssetRow } from '../../hooks/useAssets';
import { AssetCard } from './AssetCard';

type Props = {
  assets: AssetRow[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  density?: 'compact' | 'default' | 'large';

  onToggleSelect: (assetId: string, ev: { shift: boolean; meta: boolean; ctrl: boolean }) => void;
  onMarqueeSelect: (ids: string[], mode: 'replace' | 'add') => void;

  onDeleted?: () => void;
  onDragStart?: (e: React.DragEvent, assetId: string) => void;
  onItemContextMenu?: (e: React.MouseEvent, assetId?: string) => void;
};

function rectIntersects(a: DOMRect, b: DOMRect) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export const AssetGrid: React.FC<Props> = ({
  assets,
  selectedIds,
  selectionMode,
  density = 'default',
  onToggleSelect,
  onMarqueeSelect,
  onDeleted,
  onDragStart,
  onItemContextMenu,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const [marquee, setMarquee] = React.useState<null | {
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
    mode: 'replace' | 'add';
    active: boolean;
  }>(null);

  const setItemRef = (id: string) => (el: HTMLDivElement | null) => {
    itemRefs.current[id] = el;
  };

  const computeHitIds = React.useCallback(() => {
    if (!containerRef.current || !marquee) return [];
    const cont = containerRef.current.getBoundingClientRect();

    // marquee rect in viewport coords
    const m = new DOMRect(marquee.x, marquee.y, marquee.w, marquee.h);

    const hit: string[] = [];
    for (const a of assets) {
      const el = itemRefs.current[a.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // only count if intersects
      if (rectIntersects(r, m)) hit.push(a.id);
    }

    // ignore tiny accidental drags
    const min = 6;
    if (marquee.w < min && marquee.h < min) return [];
    // also ensure marquee is inside container region (optional sanity)
    if (!rectIntersects(cont, m)) return [];
    return hit;
  }, [assets, marquee]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) return;

    // NÃO iniciar marquee se clicar em um card
    if (e.target.closest('[data-asset-card]')) return;

    // NÃO iniciar se clicar em zona bloqueada (ações)
    if (e.target.closest('[data-no-marquee]')) return;

    if (e.button !== 0) return;

    const mode: 'replace' | 'add' = e.metaKey || e.ctrlKey ? 'add' : 'replace';

    setMarquee({
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      w: 0,
      h: 0,
      mode,
      active: true,
    });
  };

  React.useEffect(() => {
    if (!marquee?.active) return;

    const onMove = (ev: MouseEvent) => {
      setMarquee((prev) => {
        if (!prev) return prev;
        const x1 = prev.startX;
        const y1 = prev.startY;
        const x2 = ev.clientX;
        const y2 = ev.clientY;
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);
        return { ...prev, x, y, w, h };
      });
    };

    const onUp = () => {
      const ids = computeHitIds();
      if (ids.length) onMarqueeSelect(ids, marquee.mode);
      setMarquee(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [marquee, computeHitIds, onMarqueeSelect]);

  const marqueeStyle = React.useMemo(() => {
    if (!marquee) return null;
    return {
      left: marquee.x,
      top: marquee.y,
      width: marquee.w,
      height: marquee.h,
    } as React.CSSProperties;
  }, [marquee]);

  const gridClass = React.useMemo(() => {
    if (density === 'compact') return 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3';
    if (density === 'large') return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6';
    return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'; // default (mais denso que antes)
  }, [density]);

  return (
    <div
      ref={containerRef}
      className="relative px-6 pt-12 pb-6 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
      onMouseDown={onMouseDown}
    >
      {/* marquee overlay */}
      {marquee && (
        <div
          className="fixed z-[9998] border border-gold/70 bg-gold/10 pointer-events-none rounded-md"
          style={marqueeStyle ?? undefined}
        />
      )}

      <div className={gridClass}>
        {assets.map((asset) => (
          <div key={asset.id} ref={setItemRef(asset.id)} data-asset-card className="w-full">
            <AssetCard
              asset={asset}
              onDeleted={onDeleted}
              onDragStart={onDragStart}
              selected={selectedIds.has(asset.id)}
              selectedIds={Array.from(selectedIds)}
              selectionMode={selectionMode}
              onToggleSelect={onToggleSelect}
              onContextMenu={onItemContextMenu}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
