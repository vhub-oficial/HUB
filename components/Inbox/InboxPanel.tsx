import React from 'react';
import { X, CheckSquare, Square, FolderInput, Inbox, Download } from 'lucide-react';
import { useAssets, type AssetRow } from '../../hooks/useAssets';
import { useFolders } from '../../hooks/useFolders';
import { createSignedUrl, getOrgBucketName } from '../../lib/storageHelpers';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  open: boolean;
  onClose: () => void;
  categoryType: string; // ex: veo3
};

const isExternal = (asset: AssetRow) => {
  const source = (asset as any)?.meta?.source;
  if (source === 'external') return true;
  return typeof asset.url === 'string' && /^https?:\/\//i.test(asset.url);
};

export function InboxPanel({ open, onClose, categoryType }: Props) {
  const { organizationId, role } = useAuth();
  const { assets, loading, refresh, updateAsset, moveAssetToFolder } = useAssets({
    type: categoryType,
    // pega itens do inbox, de qualquer pasta (folderId undefined)
    tagsAny: ['inbox'],
    metaFilters: { needs_review: 'true' },
    limit: 200,
  });

  const { folders } = useFolders({ parentId: null, type: categoryType, sort: 'name' });

  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [lastClicked, setLastClicked] = React.useState<string | null>(null);
  const [bulkMoving, setBulkMoving] = React.useState(false);
  const [bulkDone, setBulkDone] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    // limpa seleção quando lista muda muito
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const a of assets) if (prev[a.id]) next[a.id] = true;
      return next;
    });
  }, [assets]);

  const list = assets ?? [];
  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const selectedCount = selectedIds.length;

  const toggleOne = (id: string, e?: React.MouseEvent) => {
    // shift-range (drive-like simples)
    if (e?.shiftKey && lastClicked) {
      const ids = list.map((a) => a.id);
      const a = ids.indexOf(lastClicked);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [s, t] = a < b ? [a, b] : [b, a];
        const next: Record<string, boolean> = { ...selected };
        for (let i = s; i <= t; i++) next[ids[i]] = true;
        setSelected(next);
        return;
      }
    }

    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    setLastClicked(id);
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    for (const a of list) next[a.id] = true;
    setSelected(next);
  };

  const clearSelection = () => setSelected({});

  const removeFromInboxBulk = async () => {
    if (!selectedCount) return;
    if (role === 'viewer') return alert('Viewer não pode editar assets.');
    setBulkDone(false);

    for (const id of selectedIds) {
      const a = list.find((x) => x.id === id);
      if (!a) continue;

      const tags = Array.isArray(a.tags) ? a.tags : [];
      const nextTags = tags.filter((t) => t !== 'inbox');
      const nextMeta = { ...(a.meta ?? {}), needs_review: false, inbox: false };

      // eslint-disable-next-line no-await-in-loop
      await updateAsset(id, { tags: nextTags, meta: nextMeta } as any);
    }

    window.dispatchEvent(new Event('vah:assets_changed'));
    setBulkDone(true);
    clearSelection();
    refresh();
  };

  const moveBulk = async (folderId: string | null) => {
    if (!selectedCount) return;
    if (role === 'viewer') return alert('Viewer não pode mover assets.');
    setBulkMoving(true);
    setBulkDone(false);

    try {
      for (const id of selectedIds) {
        // eslint-disable-next-line no-await-in-loop
        await moveAssetToFolder(id, folderId);
      }
      window.dispatchEvent(new Event('vah:assets_changed'));
      setBulkDone(true);
      clearSelection();
      refresh();
    } finally {
      setBulkMoving(false);
    }
  };

  const downloadSelected = async () => {
    if (!selectedCount) return;

    for (const id of selectedIds) {
      const a = list.find((x) => x.id === id);
      if (!a) continue;

      // external -> abre em nova aba
      if (isExternal(a)) {
        const direct = (a.meta as any)?.download_url || a.url;
        window.open(direct, '_blank', 'noopener,noreferrer');
        continue;
      }

      // storage -> signed + fetch + download
      if (!organizationId) continue;
      const bucket = getOrgBucketName(organizationId);
      // eslint-disable-next-line no-await-in-loop
      const signed = await createSignedUrl(bucket, a.url, 3600);
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(signed);
      if (!res.ok) continue;
      // eslint-disable-next-line no-await-in-loop
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = (a.name || 'download').toString();
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);

      // pequeno espaçamento pra não travar o browser
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9997]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* drawer */}
      <div className="absolute right-0 top-0 h-full w-[460px] max-w-[92vw] bg-black/85 backdrop-blur border-l border-border">
        {/* header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="text-gold" size={18} />
            <div className="text-white font-semibold">Inbox • {categoryType.toUpperCase()}</div>
            <div className="text-xs text-gray-400">({list.length})</div>
          </div>
          <button
            className="w-9 h-9 rounded-lg bg-black/30 border border-border text-gray-200 hover:border-gold/40 flex items-center justify-center"
            onClick={onClose}
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* actions */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {selectedCount ? `${selectedCount} selecionado(s)` : 'Selecione itens para ações em massa'}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-xs px-3 py-2 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40 flex items-center gap-2"
                onClick={selectAll}
                title="Selecionar tudo"
              >
                <CheckSquare size={14} />
                Tudo
              </button>
              <button
                className="text-xs px-3 py-2 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40 flex items-center gap-2"
                onClick={clearSelection}
                title="Limpar seleção"
              >
                <Square size={14} />
                Limpar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="text-xs px-3 py-2 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40 disabled:opacity-50"
              disabled={!selectedCount || role === 'viewer'}
              onClick={removeFromInboxBulk}
              title="Remove tag inbox e marca needs_review=false"
            >
              Arquivar (sair do Inbox)
            </button>

            <button
              className="text-xs px-3 py-2 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40 disabled:opacity-50 flex items-center gap-2"
              disabled={!selectedCount}
              onClick={downloadSelected}
              title="Download múltiplo (sequencial)"
            >
              <Download size={14} />
              Download
            </button>

            <button
              className="text-xs px-3 py-2 rounded-lg border border-border bg-black/30 text-gray-200 hover:border-gold/40 disabled:opacity-50"
              disabled={!selectedCount || role === 'viewer' || bulkMoving}
              onClick={() => moveBulk(null)}
              title="Mover para raiz (sem pasta)"
            >
              Mover p/ Raiz
            </button>

            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <FolderInput size={14} />
                mover p/ pasta:
              </div>
              <select
                className="text-xs bg-black/30 border border-border rounded-lg px-3 py-2 text-white hover:border-gold/40 disabled:opacity-50"
                disabled={!selectedCount || role === 'viewer' || bulkMoving}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  moveBulk(v);
                  e.currentTarget.value = '';
                }}
                defaultValue=""
              >
                <option value="" disabled>Selecionar…</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {bulkMoving && <div className="text-xs text-gray-400">Movendo…</div>}
          {bulkDone && <div className="text-xs text-gold">Feito ✅</div>}
        </div>

        {/* list */}
        <div className="p-2 overflow-auto h-[calc(100%-140px)]">
          {loading ? (
            <div className="p-4 text-sm text-gray-400">Carregando…</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">Inbox vazio.</div>
          ) : (
            <div className="space-y-1">
              {list.map((a) => {
                const checked = !!selected[a.id];
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                      checked ? 'border-gold/40 bg-gold/5' : 'border-border bg-black/20 hover:border-gold/30'
                    }`}
                    onClick={(e) => toggleOne(a.id, e)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => null}
                      className="accent-yellow-400"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{a.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {isExternal(a) ? 'Externo' : 'Storage'} • {a.folder_id ? 'em pasta' : 'raiz'}
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {Array.isArray(a.tags) ? a.tags.slice(0, 2).join(', ') : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* footer hint */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border text-[11px] text-gray-500 bg-black/60">
          Dica: shift seleciona intervalo. ctrl/cmd alterna itens. “Arquivar” remove inbox + needs_review.
        </div>
      </div>
    </div>
  );
}
