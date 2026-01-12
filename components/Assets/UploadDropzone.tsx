import React, { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../../contexts/AuthContext';
import { useAssets } from '../../hooks/useAssets';
import { Button } from '../UI/Button';

type Props = {
  folderId?: string | null;
  categoryType: string; // category/aba slug
  onUploaded?: () => void;
};

export const UploadDropzone: React.FC<Props> = ({ folderId = null, categoryType, onUploaded }) => {
  const { role } = useAuth();
  const { uploadAsset } = useAssets();
  const [tagsText, setTagsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canUpload = role === 'admin' || role === 'editor';

  const tags = useMemo(() => {
    return tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }, [tagsText]);

  const normalizedTags = useMemo(() => {
    return tags.map((t) => t.toLowerCase().replace(/\s+/g, '-'));
  }, [tags]);

  const onDrop = async (acceptedFiles: File[]) => {
    setErr(null);
    setOk(null);
    if (!canUpload) {
      setErr('Seu role não permite upload.');
      return;
    }
    if (normalizedTags.length === 0) {
      setErr('Adicione pelo menos 1 tag (separada por vírgula) antes de enviar.');
      return;
    }
    const file = acceptedFiles?.[0];
    if (!file) return;

    setBusy(true);
    try {
      await uploadAsset(file, { folderId, tags: normalizedTags, categoryType });
      setOk('Upload concluído!');
      // give backend a beat; then refresh list
      setTimeout(() => onUploaded?.(), 300);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro no upload');
    } finally {
      setBusy(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'video/*': ['.mp4', '.mov', '.webm', '.m4v'] },
    disabled: busy || !canUpload,
  });

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Upload</h3>
        {!canUpload && (
          <span className="text-xs px-2 py-1 rounded bg-black/40 border border-border text-gray-400">
            Apenas admin/editor
          </span>
        )}
      </div>

      <p className="text-gray-400 text-sm mt-2">
        Arraste e solte um vídeo. Tags obrigatórias (separe por vírgula).
      </p>

      <div className="mt-4">
        <label className="text-sm text-gray-400">Tags</label>
        <input
          className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
          placeholder="ex: deepfake, ugc, tiktok"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          disabled={busy}
        />
      </div>

      <div
        {...getRootProps()}
        className={[
          'mt-4 rounded-xl border border-dashed p-6 text-center transition-colors',
          isDragActive ? 'border-gold/50 bg-gold/5' : 'border-border bg-black/20',
          (!canUpload || busy) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-gold/40',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <div className="text-white font-medium">
          {isDragActive ? 'Solte o vídeo aqui…' : 'Arraste e solte aqui'}
        </div>
        <div className="text-gray-400 text-sm mt-1">
          ou clique para escolher um arquivo
        </div>
      </div>

      {err && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 p-3 rounded text-red-300 text-sm">
          {err}
        </div>
      )}
      {ok && (
        <div className="mt-4 bg-gold/10 border border-gold/30 p-3 rounded text-gold text-sm">
          {ok}
        </div>
      )}

      <div className="mt-4">
        <Button disabled>
          {busy ? 'Enviando…' : 'Pronto'}
        </Button>
      </div>
    </div>
  );
};
