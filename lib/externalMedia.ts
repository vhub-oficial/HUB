// lib/externalMedia.ts
export type ExternalProvider = 'google_drive' | 'youtube' | 'vimeo' | 'unknown';

export type ExternalMeta = {
  source: 'external';
  provider: ExternalProvider;
  external_id?: string;
  thumbnail_url?: string;
  preview_url?: string;
};

function safeUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

// ---- Google Drive ----
// formatos comuns:
// https://drive.google.com/file/d/FILE_ID/view?usp=sharing
// https://drive.google.com/open?id=FILE_ID
// https://drive.google.com/uc?id=FILE_ID&export=download
export function extractGoogleDriveId(raw: string): string | null {
  const u = safeUrl(raw);
  if (!u) return null;

  if (u.hostname !== 'drive.google.com') return null;

  const parts = u.pathname.split('/').filter(Boolean);

  // /file/d/<id>/view
  const fileIdx = parts.indexOf('file');
  if (fileIdx >= 0 && parts[fileIdx + 1] === 'd' && parts[fileIdx + 2]) {
    return parts[fileIdx + 2];
  }

  // /open?id=<id>
  const idQ = u.searchParams.get('id');
  if (idQ) return idQ;

  // /uc?id=<id>
  if (parts[0] === 'uc') {
    const idUc = u.searchParams.get('id');
    if (idUc) return idUc;
  }

  return null;
}

export function buildGoogleDriveMeta(fileId: string): Pick<ExternalMeta, 'provider' | 'external_id' | 'thumbnail_url' | 'preview_url'> {
  return {
    provider: 'google_drive',
    external_id: fileId,
    // thumb grande para ficar bonito na grid
    thumbnail_url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    // player embutido (funciona quando permissão do link permite)
    preview_url: `https://drive.google.com/file/d/${fileId}/preview`,
  };
}

// ---- YouTube ----
// https://www.youtube.com/watch?v=VIDEO_ID
// https://youtu.be/VIDEO_ID
export function extractYouTubeId(raw: string): string | null {
  const u = safeUrl(raw);
  if (!u) return null;

  if (u.hostname === 'youtu.be') {
    const id = u.pathname.replace('/', '').trim();
    return id || null;
  }

  if (u.hostname.endsWith('youtube.com')) {
    const v = u.searchParams.get('v');
    if (v) return v;
    // /embed/<id>
    const parts = u.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
  }

  return null;
}

export function buildYouTubeMeta(videoId: string): Pick<ExternalMeta, 'provider' | 'external_id' | 'thumbnail_url' | 'preview_url'> {
  return {
    provider: 'youtube',
    external_id: videoId,
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    preview_url: `https://www.youtube.com/embed/${videoId}`,
  };
}

// ---- Vimeo ----
// https://vimeo.com/VIDEO_ID
// (thumb oficial do vimeo exige API; aqui usamos preview e deixamos thumb opcional)
export function extractVimeoId(raw: string): string | null {
  const u = safeUrl(raw);
  if (!u) return null;
  if (!u.hostname.endsWith('vimeo.com')) return null;

  const parts = u.pathname.split('/').filter(Boolean);
  const maybeId = parts[0];
  if (maybeId && /^\d+$/.test(maybeId)) return maybeId;

  // /video/<id>
  const videoIdx = parts.indexOf('video');
  if (videoIdx >= 0 && parts[videoIdx + 1] && /^\d+$/.test(parts[videoIdx + 1])) {
    return parts[videoIdx + 1];
  }

  return null;
}

export function buildVimeoMeta(videoId: string): Pick<ExternalMeta, 'provider' | 'external_id' | 'preview_url'> {
  return {
    provider: 'vimeo',
    external_id: videoId,
    preview_url: `https://player.vimeo.com/video/${videoId}`,
  };
}

export function inferExternalMetaFromUrl(raw: string): ExternalMeta {
  const driveId = extractGoogleDriveId(raw);
  if (driveId) {
    return { source: 'external', ...buildGoogleDriveMeta(driveId) };
  }

  const ytId = extractYouTubeId(raw);
  if (ytId) {
    return { source: 'external', ...buildYouTubeMeta(ytId) };
  }

  const vimeoId = extractVimeoId(raw);
  if (vimeoId) {
    return { source: 'external', ...buildVimeoMeta(vimeoId) };
  }

  // fallback genérico
  return { source: 'external', provider: 'unknown' };
}
