import React from 'react';

const SPEC_LABELS: Record<string, { title: string; fields: { key: string; labelAll: string }[] }> = {
  veo3: {
    title: 'VEO 3',
    fields: [
      { key: 'produto', labelAll: 'TODOS OS PRODUTOS' },
      { key: 'dimensao', labelAll: 'TODAS AS DIMENSÕES' },
    ],
  },
  deepfakes: {
    title: 'DEEPFAKES',
    fields: [
      { key: 'personagem', labelAll: 'TODOS OS PERSONAGENS' },
      { key: 'versao', labelAll: 'TODAS AS VERSÕES' },
    ],
  },
  vozes: {
    title: 'VOZ PRA CLONAR',
    fields: [],
  },
  tiktok: {
    title: 'TIKTOK',
    fields: [
      { key: 'nicho', labelAll: 'TODOS OS NICHOS' },
      { key: 'genero', labelAll: 'TODOS OS GÊNEROS' },
      { key: 'tipo', labelAll: 'TODOS OS TIPOS' },
    ],
  },
  musicas: {
    title: 'ÁUDIO',
    fields: [
      { key: 'momento_vsl', labelAll: 'MOMENTOS DA VSL' },
      { key: 'emocao', labelAll: 'TODAS AS EMOÇÕES' },
    ],
  },
  sfx: {
    title: 'ÁUDIO',
    fields: [
      { key: 'momento_vsl', labelAll: 'MOMENTOS DA VSL' },
      { key: 'emocao', labelAll: 'TODAS AS EMOÇÕES' },
    ],
  },
  'provas-sociais': {
    title: 'PROVAS SOCIAIS',
    fields: [
      { key: 'nicho', labelAll: 'TODOS OS NICHOS' },
      { key: 'genero', labelAll: 'TODOS OS GÊNEROS' },
    ],
  },
  'depoimentos-ugc': {
    title: 'DEPOIMENTOS UGC',
    fields: [
      { key: 'genero_ator', labelAll: 'TODOS OS GÊNEROS' },
      { key: 'faixa_etaria', labelAll: 'TODAS AS IDADES' },
    ],
  },
};

const normalizeType = (input: string | null | undefined) => {
  if (!input) return null;
  const t = String(input).trim().toLowerCase();

  const map: Record<string, string> = {
    'veo-3': 'veo3',
    veo_3: 'veo3',
    deepfake: 'deepfakes',
    voz: 'vozes',
    'voz-clonada': 'vozes',
    voz_clonada: 'vozes',
    'vozes-para-clonar': 'vozes',
    vozes_para_clonar: 'vozes',
    musica: 'musicas',
    'prova-social': 'provas-sociais',
    provas_sociais: 'provas-sociais',
    provassociais: 'provas-sociais',
    ugc: 'depoimentos-ugc',
    depoimentosugc: 'depoimentos-ugc',
    depoimentos_ugc: 'depoimentos-ugc',
  };

  return map[t] ?? t;
};

export type FiltersValue = {
  tags: string; // single tag (ou vazio)
  meta: Record<string, string>; // selects
};

export const FiltersBar: React.FC<{
  type: string;
  value: FiltersValue;
  onChange: (next: FiltersValue) => void;
  onClear: () => void;
  options: {
    tags: string[];
    meta: Record<string, string[]>;
  };
}> = ({ type, value, onChange, onClear, options }) => {
  const normalizedType = normalizeType(type);
  const spec = normalizedType ? SPEC_LABELS[normalizedType] : null;
  if (!spec) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-gold font-bold text-xs tracking-widest uppercase">
        <span>⚡</span>
        <span>FILTROS {spec.title}</span>
      </div>

      {spec.fields.map((f) => (
        <select
          key={f.key}
          className="bg-black/30 border border-border rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-200 hover:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40"
          value={value.meta[f.key] ?? ''}
          onChange={(e) => onChange({ ...value, meta: { ...value.meta, [f.key]: e.target.value } })}
        >
          <option className="bg-black text-white" value="">{f.labelAll}</option>
          {(options.meta?.[f.key] ?? []).map((opt) => (
            <option className="bg-black text-white" key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ))}

      <select
        className="bg-black/30 border border-border rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-200 hover:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40"
        value={value.tags ?? ''}
        onChange={(e) => onChange({ ...value, tags: e.target.value })}
      >
        <option className="bg-black text-white" value="">TODAS AS TAGS</option>
        {options.tags.map((t) => (
          <option className="bg-black text-white" key={t} value={t}>{t}</option>
        ))}
      </select>

      <button
        onClick={onClear}
        className="bg-black/20 border border-border rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-300 hover:border-gold/40"
      >
        LIMPAR
      </button>
    </div>
  );
};
