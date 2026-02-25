import { normalizeCategoryType } from './categoryType';

export type MetaFieldDef = {
  key: string;
  label: string;
  allLabel?: string; // label do placeholder "Todos/Todas ..." (PT correto)
};

const F = (key: string, label: string, allLabel?: string): MetaFieldDef => ({ key, label, allLabel });

/**
 * ✅ Fonte ÚNICA da verdade dos campos meta por categoria.
 * Chaves aqui DEVEM ser CANÔNICAS (retorno de normalizeCategoryType):
 * deepfake, voz-clonada, tiktok, musica, sfx, veo3, prova-social, ugc
 */
export const CATEGORY_META_FIELDS: Record<string, MetaFieldDef[]> = {
  deepfake: [
    F('personagem', 'Personagem', 'Todos os Personagens'),
    F('versao', 'Versão', 'Todas as Versões'),
  ],

  'voz-clonada': [
    F('personagem', 'Personagem', 'Todos os Personagens'),
    F('versao', 'Versão', 'Todas as Versões'),
    F('genero', 'Gênero', 'Todos os Gêneros'),
  ],

  tiktok: [
    F('produto', 'Produto', 'Todos os Produtos'),
    F('nicho', 'Nicho', 'Todos os Nichos'),
    F('tipo', 'Tipo', 'Todos os Tipos'),
    F('momento_vsl', 'Momento da VSL', 'Todos os Momentos da VSL'),
  ],

  musica: [
    F('momento_vsl', 'Momentos da VSL', 'Todos os Momentos da VSL'),
    F('emocao', 'Emoções', 'Todas as Emoções'),
  ],

  sfx: [
    F('momento_vsl', 'Momentos da VSL', 'Todos os Momentos da VSL'),
    F('emocao', 'Emoções', 'Todas as Emoções'),
  ],

  veo3: [
    F('produto', 'Produto', 'Todos os Produtos'),
    F('dimensao', 'Dimensão', 'Todas as Dimensões'),
  ],

  'prova-social': [
    F('nicho', 'Nichos', 'Todos os Nichos'),
    F('genero', 'Gêneros', 'Todos os Gêneros'),
  ],

  ugc: [
    F('genero', 'Gêneros', 'Todos os Gêneros'),
    F('faixa_etaria', 'Idades', 'Todas as Idades'),
  ],
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
