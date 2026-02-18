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
  clearFinished: () => void;
};

const UploadQueueContext = createContext<Ctx | null>(null);

const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
  return `uq_${Math.random().toString(16).slice(2)}_${Date.now()}`;
};

const fileFingerprint = (f: File) => `${f.name}::${f.size}::${f.lastModified}`;

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const { uploadAsset } = useAssets();

  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const runningRef = useRef(false);
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
      const existing = new Set(
        prev
          .filter((x) => x.status === 'queued' || x.status === 'uploading')
          .map((x) => fileFingerprint(x.file)),
      );

      const localSeen = new Set<string>();
      const next = [...prev];

      for (const f of files) {
        const fp = fileFingerprint(f);
        if (existing.has(fp)) continue;
        if (localSeen.has(fp)) continue;
        localSeen.add(fp);

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

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((x) => !['done', 'error', 'canceled'].includes(x.status)));
  }, []);

  // Runner: processa 1 por vez (mais confiável)
  useEffect(() => {
    if (runningRef.current) return;
    if (!items.some((x) => x.status === 'queued')) return;

    runningRef.current = true;

    (async () => {
      try {
        while (true) {
          const next = (() => {
            const queued = items.filter((x) => x.status === 'queued');
            if (!queued.length) return null;
            // oldest first
            queued.sort((a, b) => a.createdAt - b.createdAt);
            return queued[0];
          })();

          if (!next) break;
          if (cancelRef.current[next.id]) {
            setItems((prev) => prev.map((x) => (x.id === next.id ? { ...x, status: 'canceled' } : x)));
            continue;
          }

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

            setItems((prev) =>
              prev.map((x) => (x.id === next.id ? { ...x, status: 'done', progress: 100 } : x))
            );

            window.dispatchEvent(new Event('vah:assets_changed'));
          } catch (e: any) {
            setItems((prev) =>
              prev.map((x) =>
                x.id === next.id ? { ...x, status: 'error', progress: 0, error: e?.message ?? 'Falha no upload' } : x
              )
            );
          }
        }
      } finally {
        runningRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const value = useMemo<Ctx>(() => ({
    items,
    isOpen,
    open,
    close,
    enqueueFiles,
    cancelItem,
    clearFinished,
  }), [items, isOpen, open, close, enqueueFiles, cancelItem, clearFinished]);

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>;
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error('useUploadQueue must be used within UploadQueueProvider');
  return ctx;
}
