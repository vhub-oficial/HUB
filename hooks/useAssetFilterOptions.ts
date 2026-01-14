import { useMemo } from 'react';
import type { AssetRow } from './useAssets';

export function useAssetFilterOptions(assets: AssetRow[], type: string) {
  return useMemo(() => {
    const produtos = new Set<string>();
    const dimensoes = new Set<string>();
    const tags = new Set<string>();

    for (const asset of assets) {
      if (asset.type !== type) continue;

      if (asset.meta?.produto) produtos.add(asset.meta.produto);
      if (asset.meta?.dimensao) dimensoes.add(asset.meta.dimensao);

      if (Array.isArray(asset.tags)) {
        asset.tags.forEach((tag) => tags.add(tag));
      }
    }

    return {
      produtos: Array.from(produtos).sort(),
      dimensoes: Array.from(dimensoes).sort(),
      tags: Array.from(tags).sort(),
    };
  }, [assets, type]);
}
