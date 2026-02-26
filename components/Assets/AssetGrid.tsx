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

type MarqueeState = {
  startPageX: number;
  startPageY: number;
  pageX: number;
  pageY: number;
  lastClientX: number;
  lastClientY: number;
  w: number;
  h: number;
  mode: 'replace' | 'add';
  active: boolean;
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

  const [marquee, setMarquee] = React.useState<MarqueeState | null>(null);

  const setItemRef = (id: string) => (el: HTMLDivElement | null) => {
    itemRefs.current[id] = el;
  };

  const computeHitIds = React.useCallback(() => {
    if (!containerRef.current || !marquee) return [];
    const cont = containerRef.current.getBoundingClientRect();

    const leftPage = Math.min(marquee.startPageX, marquee.pageX);
    const topPage = Math.min(marquee.startPageY, marquee.pageY);
    // marquee rect in viewport coords
    const m = new DOMRect(leftPage - window.scrollX, topPage - window.scrollY, marquee.w, marquee.h);

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

    const sx = e.clientX + window.scrollX;
    const sy = e.clientY + window.scrollY;

    setMarquee({
      startPageX: sx,
      startPageY: sy,
      pageX: sx,
      pageY: sy,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
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
        if (!prev?.active) return prev;

        const px = ev.clientX + window.scrollX;
        const py = ev.clientY + window.scrollY;

        const w = Math.abs(px - prev.startPageX);
        const h = Math.abs(py - prev.startPageY);

        return {
          ...prev,
          pageX: px,
          pageY: py,
          lastClientX: ev.clientX,
          lastClientY: ev.clientY,
          w,
          h,
        };
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

  React.useEffect(() => {
    if (!marquee?.active) return;

    const onScroll = () => {
      setMarquee((prev) => {
        if (!prev?.active) return prev;

        const px = prev.lastClientX + window.scrollX;
        const py = prev.lastClientY + window.scrollY;

        const w = Math.abs(px - prev.startPageX);
        const h = Math.abs(py - prev.startPageY);

        return { ...prev, pageX: px, pageY: py, w, h };
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [marquee?.active]);

  const marqueeStyle = React.useMemo(() => {
    if (!marquee) return null;

    const leftPage = Math.min(marquee.startPageX, marquee.pageX);
    const topPage = Math.min(marquee.startPageY, marquee.pageY);
    const width = Math.abs(marquee.pageX - marquee.startPageX);
    const height = Math.abs(marquee.pageY - marquee.startPageY);

    const left = leftPage - window.scrollX;
    const top = topPage - window.scrollY;

    return {
      left,
      top,
      width,
      height,
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
