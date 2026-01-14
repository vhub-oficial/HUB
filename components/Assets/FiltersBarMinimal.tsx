import React from 'react';

type Props = {
  title: string;
  produto?: string | null;
  dimensao?: string | null;
  tag?: string | null;
  produtos: string[];
  dimensoes: string[];
  tags: string[];
  onChange: (next: {
    produto?: string | null;
    dimensao?: string | null;
    tag?: string | null;
  }) => void;
};

export const FiltersBarMinimal: React.FC<Props> = ({
  title,
  produto,
  dimensao,
  tag,
  produtos,
  dimensoes,
  tags,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-4 text-sm text-gray-300">
      <div className="flex items-center gap-2 text-gold font-semibold">
        <span>⚡</span>
        <span>FILTROS {title.toUpperCase()}</span>
      </div>

      <select
        className="bg-black/40 border border-border rounded-lg px-3 py-1.5"
        value={produto ?? ''}
        onChange={(event) => onChange({ produto: event.target.value || null })}
      >
        <option value="">TODOS OS PRODUTOS</option>
        {produtos.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <select
        className="bg-black/40 border border-border rounded-lg px-3 py-1.5"
        value={dimensao ?? ''}
        onChange={(event) => onChange({ dimensao: event.target.value || null })}
      >
        <option value="">TODAS AS DIMENSÕES</option>
        {dimensoes.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <select
        className="bg-black/40 border border-border rounded-lg px-3 py-1.5"
        value={tag ?? ''}
        onChange={(event) => onChange({ tag: event.target.value || null })}
      >
        <option value="">TODAS AS TAGS</option>
        {tags.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};
