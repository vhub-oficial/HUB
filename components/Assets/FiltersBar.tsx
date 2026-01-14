import React from 'react';

type Field = {
  key: string;
  label: string;
  placeholder?: string;
};

const SPEC: Record<string, { fields: Field[] }> = {
  deepfakes: {
    fields: [
      { key: 'personagem', label: 'Personagem', placeholder: 'ex: adele' },
      { key: 'versao', label: 'Versão', placeholder: 'ex: v1' },
    ],
  },
  vozes: {
    fields: [
      { key: 'duracao', label: 'Duração', placeholder: 'ex: 0:15' },
    ],
  },
  tiktok: {
    fields: [
      { key: 'nicho', label: 'Nicho', placeholder: 'ex: motivacional' },
      { key: 'genero', label: 'Gênero/Estilo', placeholder: 'ex: masculino' },
      { key: 'tipo', label: 'Tipo', placeholder: 'ex: hook' },
    ],
  },
  musicas: {
    fields: [
      { key: 'momento_vsl', label: 'Momento VSL', placeholder: 'ex: abertura' },
      { key: 'emocao', label: 'Emoção/Vibe', placeholder: 'ex: urgência' },
    ],
  },
  sfx: {
    fields: [
      { key: 'momento_vsl', label: 'Momento VSL', placeholder: 'ex: CTA' },
      { key: 'emocao', label: 'Emoção/Vibe', placeholder: 'ex: impacto' },
    ],
  },
  veo3: {
    fields: [
      { key: 'produto', label: 'Produto/Objeto', placeholder: 'ex: relógio' },
      { key: 'dimensao', label: 'Dimensão', placeholder: 'ex: 1080x1920' },
    ],
  },
  'provas-sociais': {
    fields: [
      { key: 'nicho', label: 'Nicho', placeholder: 'ex: emagrecimento' },
      { key: 'genero', label: 'Gênero', placeholder: 'ex: homem' },
    ],
  },
  ugc: {
    fields: [
      { key: 'genero_ator', label: 'Gênero do ator', placeholder: 'ex: mulher' },
      { key: 'faixa_etaria', label: 'Faixa etária', placeholder: 'ex: adulto' },
      { key: 'duracao', label: 'Duração', placeholder: 'ex: 1:00' },
    ],
  },
};

function normTag(t: string) {
  return t.trim().toLowerCase().replace(/\s+/g, '-');
}

export type FiltersValue = {
  q: string;
  tags: string; // comma string
  meta: Record<string, string>;
};

export const FiltersBar: React.FC<{
  type: string;
  value: FiltersValue;
  onChange: (next: FiltersValue) => void;
  onClear: () => void;
}> = ({ type, value, onChange, onClear }) => {
  const spec = SPEC[type]?.fields ?? [];

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-white font-semibold">Filtros</div>
          <div className="text-xs text-gray-500">Aba: {type}</div>
        </div>
        <button
          onClick={onClear}
          className="text-sm px-3 py-2 rounded-xl bg-black/30 border border-border text-gray-200 hover:border-gold/40"
        >
          Limpar filtros
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <div className="text-xs text-gray-500 mb-1">Buscar por nome</div>
          <input
            className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
            placeholder="ex: take 1"
            value={value.q}
            onChange={(e) => onChange({ ...value, q: e.target.value })}
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-gray-500 mb-1">Tags (separe por vírgula)</div>
          <input
            className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
            placeholder="ex: deepfake, ugc, tiktok"
            value={value.tags}
            onChange={(e) => onChange({ ...value, tags: e.target.value })}
            onBlur={() => {
              // normalize on blur for consistency
              const normalized = value.tags
                .split(',')
                .map(normTag)
                .filter(Boolean)
                .join(', ');
              onChange({ ...value, tags: normalized });
            }}
          />
        </div>
      </div>

      {spec.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {spec.map((f) => (
            <div key={f.key}>
              <div className="text-xs text-gray-500 mb-1">{f.label}</div>
              <input
                className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                placeholder={f.placeholder ?? ''}
                value={value.meta[f.key] ?? ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    meta: { ...value.meta, [f.key]: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
