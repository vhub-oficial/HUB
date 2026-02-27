import { supabase } from './supabase';

type UploadWithProgressArgs = {
  bucket: string;
  objectPath: string;
  file: File;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
  upsert?: boolean;
};

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

// Upload real com progresso via XHR no endpoint REST do Supabase Storage
export async function storageUploadWithProgress({
  bucket,
  objectPath,
  file,
  onProgress,
  signal,
  upsert = false,
}: UploadWithProgressArgs): Promise<void> {
  const anyClient = supabase as any;

  const supabaseUrl: string | undefined = anyClient?.supabaseUrl;
  const supabaseKey: string | undefined = anyClient?.supabaseKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase client não expôs supabaseUrl/supabaseKey (não foi possível fazer upload com progresso).');
  }

  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess?.session?.access_token;
  if (!accessToken) throw new Error('Sessão inválida (sem access token).');

  const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // abort via signal
    const onAbort = () => {
      try {
        xhr.abort();
      } catch {}
    };
    if (signal) {
      if (signal.aborted) onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    xhr.open('POST', url, true); // POST funciona bem no Storage; PUT também costuma funcionar
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', supabaseKey);
    xhr.setRequestHeader('x-upsert', upsert ? 'true' : 'false');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = clamp((evt.loaded / evt.total) * 100);
      onProgress?.(pct);
    };

    xhr.onload = () => {
      if (signal) signal.removeEventListener('abort', onAbort as any);

      // Storage REST retorna 200/201 em sucesso
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      // tenta extrair erro
      let msg = `Falha no upload (HTTP ${xhr.status})`;
      try {
        const j = JSON.parse(xhr.responseText || '{}');
        msg = j?.message || j?.error || msg;
      } catch {}
      reject(new Error(msg));
    };

    xhr.onerror = () => {
      if (signal) signal.removeEventListener('abort', onAbort as any);
      reject(new Error('Falha de rede durante upload.'));
    };

    xhr.onabort = () => {
      if (signal) signal.removeEventListener('abort', onAbort as any);
      reject(new Error('Upload cancelado.'));
    };

    xhr.send(file);
  });
}
