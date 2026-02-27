import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { useUploadQueue } from '../../contexts/UploadQueueContext';

const statusLabel: Record<string, string> = {
  queued: 'Na fila',
  uploading: 'Enviando…',
  done: 'Concluído',
  error: 'Erro',
  canceled: 'Cancelado',
};

export function UploadTray() {
  const { items, isOpen, close, clearFinished, cancelItem, cancelAll, retryAll, retryItem } = useUploadQueue();

  if (!isOpen) return null;

  const total = items.length;
  const done = items.filter((x) => x.status === 'done').length;
  const uploading = items.filter((x) => x.status === 'uploading').length;
  const queued = items.filter((x) => x.status === 'queued').length;
  const hasRetryable = items.some((x) => x.status === 'error' || x.status === 'canceled');

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[380px] max-w-[92vw]">
      <div className="rounded-2xl border border-border bg-black/80 backdrop-blur shadow-xl overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <div className="text-sm font-semibold text-white">
            Uploads • {done}/{total}
            <span className="text-gray-400 font-normal"> {uploading ? `• ${uploading} enviando` : ''}{queued ? `• ${queued} na fila` : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasRetryable && (
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40"
                onClick={retryAll}
                title="Tentar novamente (erros e cancelados)"
              >
                Tentar novamente
              </button>
            )}
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40"
              onClick={cancelAll}
              title="Cancelar todos"
            >
              Cancelar todos
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40"
              onClick={clearFinished}
              title="Limpar concluídos/erros"
            >
              <Trash2 size={14} />
            </button>
            <button
              className="text-xs px-2 py-1 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40"
              onClick={close}
              title="Fechar"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="max-h-[360px] overflow-auto">
          {items.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">Nenhum upload.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.slice().reverse().map((it) => (
                <div key={it.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{it.file.name}</div>
                      <div className="text-xs text-gray-400">
                        {statusLabel[it.status]} • {it.categoryType.toUpperCase()} {it.folderId ? `• pasta` : '• raiz'}
                      </div>
                      {it.status === 'error' && it.error && (
                        <div className="text-xs text-red-300 mt-1">{it.error}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {(it.status === 'queued' || it.status === 'uploading') && (
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-red-400/60"
                          onClick={() => cancelItem(it.id)}
                          title="Cancelar"
                        >
                          Cancelar
                        </button>
                      )}
                      {(it.status === 'error' || it.status === 'canceled') && (
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40"
                          onClick={() => retryItem(it.id)}
                          title="Tentar novamente"
                        >
                          Tentar novamente
                        </button>
                      )}
                    </div>
                  </div>

                  {/* progress (best-effort) */}
                  <div className="mt-2 h-2 rounded-full bg-black/40 border border-border overflow-hidden">
                    <div
                      className="h-full bg-gold/40"
                      style={{ width: `${Math.min(100, Math.max(0, it.progress ?? 0))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border text-[11px] text-gray-500">
          Uploads em lote entram como tag <span className="text-gray-300">inbox</span> e <span className="text-gray-300">needs_review</span>.
        </div>
      </div>
    </div>
  );
}
