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
  onRenameInline?: (assetId: string, nextName: string) => Promise<void> | void;

  renamingId?: string | null;
  onOpenRename?: (assetId: string) => void;
  onCloseRename?: () => void;
  canRenameInline?: boolean;
};

type MarqueeState = {
  startLocalX: number;
  startLocalY: number;
  localX: number;
  localY: number;
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

function getScrollParent(el: HTMLElement | null): HTMLElement {
  let cur: HTMLElement | null = el;
  while (cur) {
    const st = window.getComputedStyle(cur);
    const oy = st.overflowY;
    const ox = st.overflowX;
    const canScrollY = (oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight;
    const canScrollX = (ox === 'auto' || ox === 'scroll') && cur.scrollWidth > cur.clientWidth;
    if (canScrollY || canScrollX) return cur;
    cur = cur.parentElement;
  }
  return document.documentElement;
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
  onRenameInline,
  renamingId,
  onOpenRename,
  onCloseRename,
  canRenameInline,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const scrollParentRef = React.useRef<HTMLElement | null>(null);

  const [marquee, setMarquee] = React.useState<MarqueeState | null>(null);

  const setItemRef = (id: string) => (el: HTMLDivElement | null) => {
    itemRefs.current[id] = el;
  };

  React.useEffect(() => {
    if (!containerRef.current) return;
    scrollParentRef.current = getScrollParent(containerRef.current);
  }, []);

  const getScrollMetrics = React.useCallback(() => {
    const sp = scrollParentRef.current || document.documentElement;
    const rect = sp.getBoundingClientRect();
    const scrollLeft = sp === document.documentElement ? window.scrollX : sp.scrollLeft;
    const scrollTop = sp === document.documentElement ? window.scrollY : sp.scrollTop;
    return { sp, rect, scrollLeft, scrollTop };
  }, []);

  const toLocal = React.useCallback(
    (clientX: number, clientY: number) => {
      const { rect, scrollLeft, scrollTop } = getScrollMetrics();
      return {
        localX: clientX - rect.left + scrollLeft,
        localY: clientY - rect.top + scrollTop,
      };
    },
    [getScrollMetrics]
  );

  const computeHitIds = React.useCallback(() => {
    if (!containerRef.current || !marquee) return [];

    const { rect, scrollLeft, scrollTop } = getScrollMetrics();
    const cont = containerRef.current.getBoundingClientRect();

    const leftLocal = Math.min(marquee.startLocalX, marquee.localX);
    const topLocal = Math.min(marquee.startLocalY, marquee.localY);

    const m = new DOMRect(
      leftLocal - scrollLeft + rect.left,
      topLocal - scrollTop + rect.top,
      marquee.w,
      marquee.h
    );

    const hit: string[] = [];
    for (const a of assets) {
      const el = itemRefs.current[a.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (rectIntersects(r, m)) hit.push(a.id);
    }

    const min = 6;
    if (marquee.w < min && marquee.h < min) return [];
    if (!rectIntersects(cont, m)) return [];
    return hit;
  }, [assets, marquee, getScrollMetrics]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) return;

    if (e.target.closest('[data-asset-card]')) return;
    if (e.target.closest('[data-no-marquee]')) return;
    if (e.button !== 0) return;

    const mode: 'replace' | 'add' = e.metaKey || e.ctrlKey ? 'add' : 'replace';

    const { localX: sx, localY: sy } = toLocal(e.clientX, e.clientY);

    setMarquee({
      startLocalX: sx,
      startLocalY: sy,
      localX: sx,
      localY: sy,
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

        const { localX, localY } = toLocal(ev.clientX, ev.clientY);
        const w = Math.abs(localX - prev.startLocalX);
        const h = Math.abs(localY - prev.startLocalY);

        return {
          ...prev,
          localX,
          localY,
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
  }, [marquee, toLocal, computeHitIds, onMarqueeSelect]);

  React.useEffect(() => {
    if (!marquee?.active) return;

    const sp = scrollParentRef.current || document.documentElement;

    const onScroll = () => {
      setMarquee((prev) => {
        if (!prev?.active) return prev;

        const { localX, localY } = toLocal(prev.lastClientX, prev.lastClientY);
        const w = Math.abs(localX - prev.startLocalX);
        const h = Math.abs(localY - prev.startLocalY);
        return { ...prev, localX, localY, w, h };
      });
    };

    sp.addEventListener('scroll', onScroll, { passive: true });
    return () => sp.removeEventListener('scroll', onScroll as EventListener);
  }, [marquee?.active, toLocal]);

  React.useEffect(() => {
    if (!marquee?.active) return;

    let raf = 0;
    const edge = 48;
    const maxSpeed = 18;

    const tick = () => {
      const sp = scrollParentRef.current || document.documentElement;
      const { rect } = getScrollMetrics();

      setMarquee((prev) => {
        if (!prev?.active) return prev;

        const y = prev.lastClientY;
        const nearTop = y < rect.top + edge;
        const nearBottom = y > rect.bottom - edge;

        let dy = 0;
        if (nearTop) {
          const t = Math.max(0, rect.top + edge - y);
          dy = -Math.min(maxSpeed, Math.ceil((t / edge) * maxSpeed));
        } else if (nearBottom) {
          const t = Math.max(0, y - (rect.bottom - edge));
          dy = Math.min(maxSpeed, Math.ceil((t / edge) * maxSpeed));
        }

        if (dy !== 0) {
          if (sp === document.documentElement) {
            window.scrollBy(0, dy);
          } else {
            sp.scrollTop += dy;
          }

          const { localX, localY } = toLocal(prev.lastClientX, prev.lastClientY);
          const w = Math.abs(localX - prev.startLocalX);
          const h = Math.abs(localY - prev.startLocalY);
          return { ...prev, localX, localY, w, h };
        }

        return prev;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [marquee?.active, getScrollMetrics, toLocal]);

  const marqueeStyle = React.useMemo(() => {
    if (!marquee) return null;

    const { rect, scrollLeft, scrollTop } = getScrollMetrics();

    const leftLocal = Math.min(marquee.startLocalX, marquee.localX);
    const topLocal = Math.min(marquee.startLocalY, marquee.localY);
    const width = Math.abs(marquee.localX - marquee.startLocalX);
    const height = Math.abs(marquee.localY - marquee.startLocalY);

    const left = leftLocal - scrollLeft + rect.left;
    const top = topLocal - scrollTop + rect.top;

    return { left, top, width, height } as React.CSSProperties;
  }, [marquee, getScrollMetrics]);

  const gridClass = React.useMemo(() => {
    if (density === 'compact') return 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3';
    if (density === 'large') return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6';
    return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4';
  }, [density]);

  return (
    <div
      ref={containerRef}
      className="relative px-6 pt-12 pb-6 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
      onMouseDown={onMouseDown}
    >
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
              onRenameInline={onRenameInline}
              renamingId={renamingId ?? null}
              onOpenRename={onOpenRename}
              onCloseRename={onCloseRename}
              canRenameInline={!!canRenameInline}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
