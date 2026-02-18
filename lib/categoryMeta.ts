export type MetaFieldKey =
  | 'produto'
  | 'dimensao'
  | 'personagem'
  | 'versao'
  | 'nicho'
  | 'genero'
  | 'tipo'
  | 'momento_vsl'
  | 'emocao'
  | 'faixa_etaria'
  | 'genero_ator';

export type MetaFieldDef = {
  key: MetaFieldKey;
  label: string;
  placeholder?: string;
};

const F = (key: MetaFieldKey, label: string, placeholder?: string): MetaFieldDef => ({
  key,
  label,
  placeholder,
});

export const CATEGORY_META_FIELDS: Record<string, MetaFieldDef[]> = {
  veo3: [F('produto', 'Produto/Objeto do insert'), F('dimensao', 'Dimensão')],
  tiktok: [F('produto', 'Produto'), F('nicho', 'Nicho'), F('tipo', 'Tipo'), F('momento_vsl', 'Momento VSL')],
  deepfakes: [F('personagem', 'Personagem'), F('versao', 'Versão')],
  vozes: [F('personagem', 'Personagem'), F('versao', 'Versão'), F('genero', 'Gênero')],
  ugc: [F('produto', 'Produto'), F('faixa_etaria', 'Faixa etária'), F('genero_ator', 'Gênero do ator')],
  musicas: [F('genero', 'Gênero'), F('tipo', 'Tipo')],
  sfx: [F('tipo', 'Tipo')],
  provas_sociais: [F('produto', 'Produto'), F('nicho', 'Nicho')],
  depoimentos_ugc: [F('produto', 'Produto'), F('nicho', 'Nicho')],
  'provas-sociais': [F('produto', 'Produto'), F('nicho', 'Nicho')],
};

export function getCategoryMetaFields(type?: string | null) {
  const t = (type ?? '').toLowerCase();
  return CATEGORY_META_FIELDS[t] ?? [];
}
