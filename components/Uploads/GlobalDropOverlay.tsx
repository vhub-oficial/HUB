import React from 'react';
import { useUploadQueue } from '../../contexts/UploadQueueContext';

type Props = {
  categoryType: string | null; // vem do dashboard (type)
  folderId: string | null;     // vem do dashboard (activeFolderId)
  enabled?: boolean;
};

export function GlobalDropOverlay({ categoryType, folderId, enabled = true }: Props) {
  const { enqueueFiles, open } = useUploadQueue();
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if (!Array.from(e.dataTransfer.types).includes('Files')) return;
      setDragging(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if (!Array.from(e.dataTransfer.types).includes('Files')) return;
      e.preventDefault();
      setDragging(true);
    };

    const onDragLeave = () => {
      setDragging(false);
    };

    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;

      // Se algum handler local já marcou preventDefault, não processa aqui.
      if (e.defaultPrevented) return;

      // Se o drop aconteceu dentro de um dropzone local, ignora.
      const t = e.target as Element | null;
      if (t && typeof (t as any).closest === 'function') {
        const insideLocalDropzone = (t as any).closest('[data-local-dropzone="true"]');
        if (insideLocalDropzone) return;
      }

      const files = Array.from(e.dataTransfer.files ?? []);
      setDragging(false);
      if (!files.length) return;

      e.preventDefault();
      e.stopPropagation();

      if (!categoryType) {
        alert('Selecione uma categoria antes de soltar arquivos.');
        return;
      }

      enqueueFiles(files, { categoryType, folderId });
      open();
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [enabled, categoryType, folderId, enqueueFiles, open]);

  if (!enabled || !dragging) return null;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="absolute inset-6 rounded-3xl border-2 border-dashed border-gold/50 bg-black/30 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-white font-semibold text-lg">Solte para enviar</div>
          <div className="text-gray-300 text-sm">
            Destino: <span className="text-white font-medium">{categoryType?.toUpperCase()}</span>
            {folderId ? <span className="text-gray-400"> • pasta atual</span> : <span className="text-gray-400"> • raiz</span>}
          </div>
          <div className="text-xs text-gray-400">Uploads em lote entram em inbox/needs_review para você organizar depois.</div>
        </div>
      </div>
    </div>
  );
}
