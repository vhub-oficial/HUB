import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAssets } from '../hooks/useAssets';
import { useAuth } from './AuthContext';

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'canceled';

export type UploadQueueItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress?: number; // 0..100 (best-effort; storage upload via supabase não dá progresso real)
  error?: string | null;
  createdAt: number;

  // target
  categoryType: string; // required
  folderId: string | null;
};

type Ctx = {
  items: UploadQueueItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;

  enqueueFiles: (files: File[], opts: { categoryType: string; folderId: string | null }) => void;
  cancelItem: (id: string) => void;
  cancelAll: () => void;
  retryItem: (id: string) => void;
  retryAll: () => void;
  clearFinished: () => void;
};

const UploadQueueContext = createContext<Ctx | null>(null);

const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
  return `uq_${Math.random().toString(16).slice(2)}_${Date.now()}`;
};

const fileFingerprint = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const { uploadAsset } = useAssets();

  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Always-current snapshot (avoids stale closure)
  const itemsRef = useRef<UploadQueueItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Single-flight runner lock
  const runningRef = useRef(false);

  // Simple dedupe cache (prevents same file enqueue multiple times)
  const seenRef = useRef<Record<string, number>>({});

  const cancelRef = useRef<Record<string, boolean>>({});

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const enqueueFiles = useCallback((files: File[], opts: { categoryType: string; folderId: string | null }) => {
    if (!files?.length) return;
    if (role === 'viewer') {
      alert('Viewer não pode fazer upload.');
      return;
    }
    if (!opts.categoryType) {
      alert('Selecione uma categoria (type) antes de enviar arquivos.');
      return;
    }

    setItems((prev) => {
      const next = [...prev];

      for (const f of files) {
        // ignore empty / weird
        if (!f || !f.name || !f.size) continue;

        // dedupe (same file selected/dropped multiple times)
        const fp = fileFingerprint(f);
        const now = Date.now();
        const last = seenRef.current[fp] ?? 0;
        if (now - last < 60_000) {
          continue;
        }
        seenRef.current[fp] = now;

        next.push({
          id: genId(),
          file: f,
          status: 'queued',
          progress: 0,
          error: null,
          createdAt: Date.now(),
          categoryType: opts.categoryType,
          folderId: opts.folderId ?? null,
        });
      }
      return next;
    });

    setIsOpen(true);
  }, [role]);

  const cancelItem = useCallback((id: string) => {
    cancelRef.current[id] = true;
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'canceled', error: 'Cancelado' } : x)));
  }, []);

  const cancelAll = useCallback(() => {
    const snapshot = itemsRef.current;
    for (const it of snapshot) cancelRef.current[it.id] = true;

    setItems((prev) =>
      prev.map((x) => (x.status === 'done' ? x : { ...x, status: 'canceled', progress: 0, error: 'Cancelado' }))
    );
  }, []);

  const retryItem = useCallback((id: string) => {
    delete cancelRef.current[id];

    setItems((prev) =>
      prev.map((x) =>
        x.id === id && (x.status === 'error' || x.status === 'canceled')
          ? { ...x, status: 'queued', progress: 0, error: null }
          : x
      )
    );

    setIsOpen(true);
  }, []);

  const retryAll = useCallback(() => {
    const snapshot = itemsRef.current;
    for (const it of snapshot) {
      if (it.status === 'error' || it.status === 'canceled') {
        delete cancelRef.current[it.id];
      }
    }

    setItems((prev) =>
      prev.map((x) =>
        x.status === 'error' || x.status === 'canceled'
          ? { ...x, status: 'queued', progress: 0, error: null }
          : x
      )
    );

    setIsOpen(true);
  }, []);

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((x) => !['done', 'error', 'canceled'].includes(x.status)));
  }, []);

  useEffect(() => {
    // Start runner only when there is queued work and not already running
    const hasQueued = items.some((x) => x.status === 'queued');
    if (!hasQueued) return;
    if (runningRef.current) return;
    if (!uploadAsset) return;

    runningRef.current = true;

    (async () => {
      try {
        // Loop until no queued items remain (always read from itemsRef)
        // Safety guard against infinite loops
        let guard = 0;
        while (guard < 500) {
          guard += 1;
          const snapshot = itemsRef.current;
          const next = snapshot.find((x) => x.status === 'queued');
          if (!next) break;

          // canceled before start
          if (cancelRef.current[next.id]) {
            setItems((prev) =>
              prev.map((x) => (x.id === next.id ? { ...x, status: 'canceled', error: 'Cancelado' } : x))
            );
            continue;
          }

          // mark uploading BEFORE calling uploadAsset (prevents double-pick)
          setItems((prev) =>
            prev.map((x) => (x.id === next.id ? { ...x, status: 'uploading', progress: 10, error: null } : x))
          );

          try {
            // IMPORTANT:
            // Para upload “drive-like” sem modal, usamos tag default "inbox"
            // e meta.needs_review=true para o usuário organizar depois.
            await uploadAsset(next.file, {
              folderId: next.folderId,
              tags: ['inbox'],
              categoryType: next.categoryType,
              displayName: next.file.name,
              meta: { source: 'storage', needs_review: true, inbox: true },
            });

            // if canceled during upload, don't mark done
            if (cancelRef.current[next.id]) {
              setItems((prev) =>
                prev.map((x) => (x.id === next.id ? { ...x, status: 'canceled', error: 'Cancelado' } : x))
              );
            } else {
              setItems((prev) =>
                prev.map((x) => (x.id === next.id ? { ...x, status: 'done', progress: 100, error: null } : x))
              );
              window.dispatchEvent(new Event('vah:assets_changed'));
            }
          } catch (e: any) {
            setItems((prev) =>
              prev.map((x) =>
                x.id === next.id ? { ...x, status: 'error', progress: 0, error: e?.message ?? 'Falha no upload' } : x
              )
            );
          }

          await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        runningRef.current = false;
      }
    })();
  }, [items, uploadAsset]);

  const value = useMemo<Ctx>(() => ({
    items,
    isOpen,
    open,
    close,
    enqueueFiles,
    cancelItem,
    cancelAll,
    retryItem,
    retryAll,
    clearFinished,
  }), [items, isOpen, open, close, enqueueFiles, cancelItem, cancelAll, retryItem, retryAll, clearFinished]);

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>;
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error('useUploadQueue must be used within UploadQueueProvider');
  return ctx;
}
