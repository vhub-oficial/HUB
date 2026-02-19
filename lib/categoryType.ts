// DB allows ONLY:
// deepfake, voz-clonada, tiktok, musica, sfx, veo3, prova-social, ugc

export function normalizeCategoryType(input: string | null | undefined): string | null {
  if (!input) return null;

  const raw = String(input).trim();
  if (!raw) return null;

  const s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const valid = new Set([
    'deepfake',
    'voz-clonada',
    'tiktok',
    'musica',
    'sfx',
    'veo3',
    'prova-social',
    'ugc',
  ]);
  if (valid.has(s)) return s;

  const map: Record<string, string> = {
    deepfakes: 'deepfake',
    deepfake: 'deepfake',

    'vozes-para-clonar': 'voz-clonada',
    vozes: 'voz-clonada',
    voz: 'voz-clonada',
    'voz-clonada': 'voz-clonada',

    musicas: 'musica',
    musica: 'musica',

    'provas-sociais': 'prova-social',
    'prova-social': 'prova-social',

    'depoimentos-ugc': 'ugc',
    ugc: 'ugc',

    'veo-3': 'veo3',
    veo3: 'veo3',
  };

  return map[s] ?? null;
}
