import React from 'react';
import { Button } from '../UI/Button';

export function NewFolderModal(props: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  title?: string;
}) {
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (props.open) {
      setName('');
      setErr(null);
      setBusy(false);
    }
  }, [props.open]);

  if (!props.open) return null;

  const submit = async () => {
    try {
      setBusy(true);
      setErr(null);
      await props.onCreate(name);
      props.onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Falha ao criar pasta');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-black border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="text-white font-semibold text-lg">{props.title ?? 'Nova pasta'}</div>
          <button className="text-gray-400 hover:text-white" onClick={props.onClose}>✕</button>
        </div>

        <div className="mt-4">
          <label className="text-gray-400 text-sm">Nome da pasta</label>
          <input
            className="mt-2 w-full bg-black/40 border border-border rounded-xl px-4 py-3 text-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Campanhas, BrainVex, VSL 2026..."
          />
          {err && <div className="mt-2 text-red-400 text-sm">{err}</div>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Criando...' : 'Criar pasta'}
          </Button>
        </div>
      </div>
    </div>
  );
}
