import { normalizeCategoryType } from './categoryType';

export type MetaFieldDef = {
  key: string;
  label: string;
};

const F = (key: string, label: string): MetaFieldDef => ({ key, label });

/**
 * ✅ Fonte ÚNICA da verdade dos campos meta por categoria.
 * Chaves aqui DEVEM ser CANÔNICAS (retorno de normalizeCategoryType):
 * deepfake, voz-clonada, tiktok, musica, sfx, veo3, prova-social, ugc
 */
export const CATEGORY_META_FIELDS: Record<string, MetaFieldDef[]> = {
  deepfake: [F('personagem', 'Personagem'), F('versao', 'Versão')],

  'voz-clonada': [F('personagem', 'Personagem'), F('versao', 'Versão'), F('genero', 'Gênero')],

  tiktok: [
    F('produto', 'Produto'),
    F('nicho', 'Nicho'),
    F('tipo', 'Tipo'),
    F('momento_vsl', 'Momento da VSL'),
  ],

  musica: [F('momento_vsl', 'Momentos da VSL'), F('emocao', 'Emoções')],

  sfx: [F('momento_vsl', 'Momentos da VSL'), F('emocao', 'Emoções')],

  veo3: [F('produto', 'Produto'), F('dimensao', 'Dimensão')],

  'prova-social': [F('nicho', 'Nichos'), F('genero', 'Gêneros')],

  ugc: [F('genero', 'Gêneros'), F('faixa_etaria', 'Idades')],
};

/**
 * Resolve campos meta de forma segura:
 * aceita inputs do UI (plural) e do banco (canônico).
 */
export function getCategoryMetaFields(inputType: string | null | undefined): MetaFieldDef[] {
  const normalized = normalizeCategoryType(inputType);
  if (!normalized) return [];
  return CATEGORY_META_FIELDS[normalized] ?? [];
}
