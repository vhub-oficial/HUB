import React from 'react';
import { useUploadQueue } from '../../contexts/UploadQueueContext';

const isFileDrag = (dt: DataTransfer | null | undefined) => {
  if (!dt) return false;

  const types = Array.from(dt.types || []);
  if (types.includes('Files')) return true;

  const items = (dt as any).items as DataTransferItemList | undefined;
  if (items && items.length) {
    for (let i = 0; i < items.length; i++) {
      if (items[i]?.kind === 'file') return true;
    }
  }

  return false;
};

type Props = {
  categoryType: string | null; // vem do dashboard (type)
  folderId: string | null;     // vem do dashboard (activeFolderId)
  enabled?: boolean;
};

export function GlobalDropOverlay({ categoryType, folderId, enabled = true }: Props) {
  const { enqueueFiles, open } = useUploadQueue();
  const [dragging, setDragging] = React.useState(false);
  const closeOverlay = React.useCallback(() => setDragging(false), []);

  const onDragEnter = React.useCallback((e: DragEvent) => {
    if (!enabled) return;
    if (!isFileDrag(e.dataTransfer)) return;

    setDragging(true);
  }, [enabled]);

  const onDragOver = React.useCallback((e: DragEvent) => {
    if (!enabled) return;
    if (!isFileDrag(e.dataTransfer)) return;

    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, [enabled]);

  const onDragLeave = React.useCallback((e: DragEvent) => {
    if (!enabled) return;
    if (!isFileDrag(e.dataTransfer)) return;

    // fecha apenas quando realmente saiu da janela
    if ((e as any).clientX <= 0 || (e as any).clientY <= 0) {
      closeOverlay();
    }
  }, [enabled, closeOverlay]);

  const onDrop = React.useCallback((e: DragEvent) => {
    if (!enabled) return;
    if (!isFileDrag(e.dataTransfer)) return;

    e.preventDefault();
    e.stopPropagation();
    closeOverlay();

    const t = e.target as Element | null;
    const insideLocalDropzone = t?.closest?.('[data-local-dropzone="true"]');
    if (insideLocalDropzone) return;

    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;
    if (!categoryType) {
      alert('Selecione uma categoria antes de soltar arquivos.');
      return;
    }

    enqueueFiles(files, { categoryType, folderId });
    open();
  }, [enabled, closeOverlay, enqueueFiles, open, categoryType, folderId]);

  React.useEffect(() => {
    if (!enabled) return;

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeOverlay();
    };
    const onBlur = () => closeOverlay();
    const onDragEnd = () => closeOverlay();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('dragend', onDragEnd as EventListener);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);

      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('dragend', onDragEnd as EventListener);
    };
  }, [enabled, onDragEnter, onDragOver, onDragLeave, onDrop, closeOverlay]);

  if (!enabled || !dragging) return null;

  return (
    <div className="fixed inset-0 z-[9998]">
      {/* backdrop não interativo */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] pointer-events-none" />

      {/* Área central: dropzone "real" (interativa) */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className="w-full max-w-3xl rounded-3xl border-2 border-dashed border-gold/60 bg-black/40 flex items-center justify-center p-10 shadow-2xl"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeOverlay();

            const files = Array.from((e.dataTransfer?.files ?? []) as any);
            if (!files.length) return;

            if (!categoryType) {
              alert('Selecione uma categoria antes de soltar arquivos.');
              return;
            }

            enqueueFiles(files, { categoryType, folderId });
            open();
          }}
        >
          <div className="text-center space-y-3 pointer-events-none">
            <div className="text-white font-semibold text-2xl">Solte aqui para enviar</div>

            <div className="text-gray-300 text-sm">
              Destino:{' '}
              <span className="text-white font-medium">{categoryType?.toUpperCase()}</span>
              {folderId ? (
                <span className="text-gray-400"> • pasta atual</span>
              ) : (
                <span className="text-gray-400"> • raiz</span>
              )}
            </div>

            <div className="text-xs text-gray-400">
              Dica: você pode arrastar vários arquivos de uma vez.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
