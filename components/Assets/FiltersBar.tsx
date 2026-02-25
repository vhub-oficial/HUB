import React from 'react';
import { getCategoryMetaFields } from '../../lib/categoryMeta';

type FiltersValue = {
  tags: string;
  meta: Record<string, string>;
};

type Props = {
  type: string | null;
  value: FiltersValue;
  options: {
    tags?: string[];
    meta?: Record<string, string[]>;
  };
  onChange: (next: FiltersValue) => void;
  onClear: () => void;
};

export const FiltersBar: React.FC<Props> = ({ type, value, options, onChange, onClear }) => {
  const normalizedType = (type ?? '').trim().toLowerCase();
  const metaFields = normalizedType ? getCategoryMetaFields(normalizedType) : [];

  const hasAny = (options?.tags?.length ?? 0) > 0 || metaFields.length > 0;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {metaFields.map((f) => {
        const opts = options?.meta?.[f.key] ?? [];
        return (
          <select
            key={f.key}
            className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
            value={value.meta?.[f.key] ?? ''}
            onChange={(e) => {
              const next = { ...(value.meta ?? {}) };
              next[f.key] = e.target.value;
              onChange({ ...value, meta: next });
            }}
          >
            <option value="">{f.allLabel ?? `Todos os ${f.label}`}</option>
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      })}

      {(options?.tags?.length ?? 0) > 0 && (
        <select
          className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
          value={value.tags ?? ''}
          onChange={(e) => onChange({ ...value, tags: e.target.value })}
        >
          <option value="">Todas as tags</option>
          {options.tags!.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        className="bg-black/40 border border-border rounded-lg px-3 py-2 text-white hover:bg-black/60"
        onClick={onClear}
      >
        Limpar
      </button>
    </div>
  );
};
