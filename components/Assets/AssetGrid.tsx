import React from 'react';
import type { AssetRow } from '../../hooks/useAssets';
import { AssetCard } from './AssetCard';

type Props = {
  assets: AssetRow[];
  selectedIds: Set<string>;
  selectionMode: boolean;

  onToggleSelect: (assetId: string, ev: { shift: boolean; meta: boolean; ctrl: boolean }) => void;
  onMarqueeSelect: (ids: string[], mode: 'replace' | 'add') => void;

  onDeleted?: () => void;
  onDragStart?: (e: React.DragEvent, assetId: string) => void;
};

function rectIntersects(a: DOMRect, b: DOMRect) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export const AssetGrid: React.FC<Props> = ({
  assets,
  selectedIds,
  selectionMode,
  onToggleSelect,
  onMarqueeSelect,
  onDeleted,
  onDragStart,
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
    // Only start marquee when clicking the "empty space" of the grid,
    // not when clicking a card/button.
    if (!(e.target instanceof HTMLElement)) return;
    const insideCard = e.target.closest('[data-asset-card]'); // wrapper marker below
    if (insideCard) return;

    // left mouse only
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

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseDown={onMouseDown}
    >
      {/* marquee overlay */}
      {marquee && (
        <div
          className="fixed z-[9998] border border-gold/70 bg-gold/10 pointer-events-none rounded-md"
          style={marqueeStyle ?? undefined}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {assets.map((asset) => (
          <div key={asset.id} ref={setItemRef(asset.id)} data-asset-card>
            <AssetCard
              asset={asset}
              onDeleted={onDeleted}
              onDragStart={onDragStart}
              selected={selectedIds.has(asset.id)}
              selectedIds={Array.from(selectedIds)}
              selectionMode={selectionMode}
              onToggleSelect={onToggleSelect}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
