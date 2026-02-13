import React from 'react';
import { X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useAssets } from '../../hooks/useAssets';
import { useAuth } from '../../contexts/AuthContext';
import { inferExternalMetaFromUrl } from '../../lib/externalMedia';

const CATEGORIES = [
  { key: 'deepfakes', label: 'Deepfakes' },
  { key: 'vozes', label: 'Voz para Clonar' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'musicas', label: 'Músicas' },
  { key: 'sfx', label: 'SFX' },
  { key: 'veo3', label: 'VEO 3' },
  { key: 'provas-sociais', label: 'Provas Sociais' },
  { key: 'ugc', label: 'Depoimentos UGC' },
];

function normalizeTags(input: string) {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.toLowerCase())
    .map((t) => t.replace(/\s+/g, '-'));
}

export const NewAssetModal: React.FC<{
  open: boolean;
  onClose: () => void;
  initialCategory: string | null;
  onCreated?: () => void;
}> = ({ open, onClose, initialCategory, onCreated }) => {
  const { role } = useAuth();
  const { createAsset, uploadAsset } = useAssets();
  const [category, setCategory] = React.useState<string | null>(initialCategory);
  const [folderId] = React.useState<string | null>(null); // keep simple for now
  const [name, setName] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [tagsText, setTagsText] = React.useState('');
  const [meta, setMeta] = React.useState<Record<string, any>>({});
  const [mode, setMode] = React.useState<'upload' | 'external'>('upload');
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // ✅ IMPORTANT: hooks must be called unconditionally (fixes React 310)
  const acceptByCategory = React.useMemo(() => {
    if (category === 'musicas' || category === 'sfx' || category === 'vozes') {
      return { 'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg'] };
    }
    if (category === 'provas-sociais') {
      return { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] };
    }
    return { 'video/*': ['.mp4', '.mov', '.webm', '.m4v'] };
  }, [category]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => setFile(files?.[0] ?? null),
    multiple: false,
    accept: acceptByCategory,
    disabled: busy || !(role === 'admin' || role === 'editor'),
  });

  React.useEffect(() => {
    setCategory(initialCategory);
    // reset form when opening
    if (open) {
      setErr(null);
      setBusy(false);
      setFile(null);
      setName('');
      setUrl('');
      setTagsText('');
      setMeta({});
      setMode('upload');
    }
  }, [initialCategory, open]);

  if (!open) return null;

  const canCreate = role === 'admin' || role === 'editor';

  const save = async () => {
    setErr(null);
    if (!canCreate) return setErr('Seu role não permite criar assets.');
    if (!category) return setErr('Selecione uma categoria.');
    const tags = normalizeTags(tagsText);
    if (!tags.length) return setErr('Tags são obrigatórias.');
    if (!name.trim()) return setErr('Nome do asset é obrigatório.');

    setBusy(true);
    try {
      if (mode === 'external') {
        const trimmed = url.trim();
        if (!trimmed) return setErr('Link do ativo é obrigatório.');
        const externalMeta = inferExternalMetaFromUrl(trimmed);
        const nextMeta = {
          ...(typeof meta === 'object' && meta ? meta : {}),
          category,
          ...externalMeta,
        };

        await createAsset({
          name: name.trim(),
          url: trimmed,
          categoryType: category,
          tags,
          folderId,
          meta: nextMeta,
        });
      } else {
        if (!file) return setErr('Selecione um arquivo para upload.');
        if (!name.trim()) return setErr('Nome do asset é obrigatório.');
        await uploadAsset(file, {
          folderId,
          tags,
          categoryType: category,
          displayName: name.trim(),
          meta: { ...meta, category, source: 'storage' },
        });
      }
      onCreated?.();
      // ✅ notify all pages to refresh lists immediately
      window.dispatchEvent(new Event('vah:assets_changed'));
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao criar asset');
    } finally {
      setBusy(false);
    }
  };

  // Render “schema” básico por categoria (MVP). Depois refinamos exatamente como seus prints.
  const renderCategoryFields = () => {
    if (!category) return null;
    const set = (k: string, v: any) => setMeta((m) => ({ ...m, [k]: v }));

    switch (category) {
      case 'deepfakes':
        return (
          <>
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Personagem (ex: Adele)" onChange={(e) => set('personagem', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Duração (ex: 0:30)" onChange={(e) => set('duracao', e.target.value)} />
              <input className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Versão (ex: V1, V2)" onChange={(e) => set('versao', e.target.value)} />
            </div>
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Capa (URL opcional)" onChange={(e) => set('thumbnail_url', e.target.value)} />
          </>
        );
      case 'vozes':
        return (
          <>
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Nome da voz (ex: Locutor Impactante)" onChange={(e) => set('nome_voz', e.target.value)} />
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Duração do sample (ex: 0:15)" onChange={(e) => set('duracao', e.target.value)} />
          </>
        );
      case 'tiktok':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Nicho (ex: Motivacional)" onChange={(e) => set('nicho', e.target.value)} />
              <input className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Gênero/Estilo (ex: Masculino)" onChange={(e) => set('genero', e.target.value)} />
            </div>
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Tipo de asset (ex: Hook, CTA)" onChange={(e) => set('tipo', e.target.value)} />
          </>
        );
      case 'musicas':
      case 'sfx':
        return (
          <>
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Nome da trilha" onChange={(e) => set('nome_trilha', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Momento da VSL" onChange={(e) => set('momento_vsl', e.target.value)} />
              <input className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Emoção/Vibe" onChange={(e) => set('emocao', e.target.value)} />
            </div>
          </>
        );
      case 'veo3':
        return (
          <>
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Produto/Objeto do insert" onChange={(e) => set('produto', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <select
                className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                defaultValue=""
                onChange={(e) => set('dimensao', e.target.value)}
              >
                <option value="">Dimensão</option>
                <option value="HORIZONTAL">Horizontal</option>
                <option value="VERTICAL">Vertical</option>
              </select>
              <input className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Duração (ex: 0:05)" onChange={(e) => set('duracao', e.target.value)} />
            </div>
          </>
        );
      case 'provas-sociais':
        return (
          <>
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Nicho do resultado (ex: Emagrecimento)" onChange={(e) => set('nicho', e.target.value)} />
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Gênero do cliente (ex: HOMEM)" onChange={(e) => set('genero', e.target.value)} />
          </>
        );
      case 'ugc':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Gênero do ator (ex: MULHER)" onChange={(e) => set('genero_ator', e.target.value)} />
              <input className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Faixa etária (ex: ADULTO)" onChange={(e) => set('faixa_etaria', e.target.value)} />
            </div>
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Duração (ex: 1:00)" onChange={(e) => set('duracao', e.target.value)} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-border">
          <div>
            <div className="text-gold font-semibold">+ Novo Asset</div>
            <div className="text-xs text-gray-500">{category ? category.toUpperCase() : 'SELECIONE UMA CATEGORIA'}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Category chooser (Dashboard behavior) */}
          {!initialCategory && (
            <div>
              <div className="text-xs text-gray-500 mb-2">Onde deseja salvar este ativo?</div>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={[
                      'rounded-lg px-3 py-2 text-sm border transition',
                      category === c.key ? 'bg-gold/10 border-gold/40 text-gold' : 'bg-black/30 border-border text-gray-300 hover:text-white'
                    ].join(' ')}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('upload')}
              className={[
                "px-3 py-2 rounded-lg border text-sm transition",
                mode === 'upload' ? "bg-gold/10 border-gold/40 text-gold" : "bg-black/30 border-border text-gray-300 hover:text-white"
              ].join(' ')}
            >
              Upload (Storage)
            </button>
            <button
              onClick={() => setMode('external')}
              className={[
                "px-3 py-2 rounded-lg border text-sm transition",
                mode === 'external' ? "bg-gold/10 border-gold/40 text-gold" : "bg-black/30 border-border text-gray-300 hover:text-white"
              ].join(' ')}
            >
              Conectar Link Externo
            </button>
          </div>

          {/* Base fields */}
          <div className="space-y-3">
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Nome do asset" value={name} onChange={(e) => setName(e.target.value)} />
            {mode === 'external' ? (
              <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder="Link do ativo (Google Drive / Minimax / etc.)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            ) : (
              <div className="space-y-3">
                <div
                  {...getRootProps()}
                  className={[
                    "rounded-xl border border-dashed p-5 text-center transition-colors",
                    isDragActive ? "border-gold/50 bg-gold/5" : "border-border bg-black/20",
                    (!canCreate || busy) ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-gold/40"
                  ].join(' ')}
                >
                  <input {...getInputProps()} />
                  <div className="text-white font-medium">
                    {file ? `Arquivo: ${file.name}` : (isDragActive ? 'Solte o arquivo aqui…' : 'Arraste e solte aqui')}
                  </div>
                  <div className="text-gray-400 text-sm mt-1">
                    (drag & drop)
                  </div>
                </div>
              </div>
            )}
            {renderCategoryFields()}
            <input className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
              placeholder="Tags / palavras-chave (separe por vírgula) *" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>

          {err && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded text-red-300 text-sm">
              {err}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-gray-300 hover:text-white">
            Cancelar
          </button>
          <button
            disabled={busy}
            onClick={save}
            className="px-5 py-2 rounded-xl bg-gold text-black font-semibold hover:opacity-90 disabled:opacity-60"
          >
            Confirmar cadastro
          </button>
        </div>
      </div>
    </div>
  );
};
