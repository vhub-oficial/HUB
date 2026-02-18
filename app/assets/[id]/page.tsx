import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAssets, type AssetRow } from '../../../hooks/useAssets';
import { useAuth } from '../../../contexts/AuthContext';
import { createSignedUrl, getOrgBucketName } from '../../../lib/storageHelpers';
import { ArrowLeft, ExternalLink, Trash2, Save, Pencil, ChevronDown, ChevronUp } from 'lucide-react';

const isExternal = (asset: AssetRow) => {
  const source = asset.meta?.source;
  if (source === 'external') return true;
  return typeof asset.url === 'string' && /^https?:\/\//i.test(asset.url);
};

const normalizeTags = (s: string) =>
  s.split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => t.toLowerCase())
    .map(t => t.replace(/\s+/g, '-'));

export const AssetDetailPage: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { organizationId, role } = useAuth();
  const { getAssetById, updateAsset, deleteAsset } = useAssets();

  const [loading, setLoading] = React.useState(true);

  const editFromQuery = React.useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get('edit') === '1';
  }, [location.search]);
  const [asset, setAsset] = React.useState<AssetRow | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string>('');
  const [isExternalEmbed, setIsExternalEmbed] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<boolean>(editFromQuery);
  const [name, setName] = React.useState('');
  const [tagsText, setTagsText] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [metaJson, setMetaJson] = React.useState('');
  const [metaForm, setMetaForm] = React.useState<Record<string, string>>({});
  const [showTech, setShowTech] = React.useState(false);

  const canEdit = role === 'admin' || role === 'editor';
  const canDelete = role === 'admin';

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        if (!id) throw new Error('Asset inválido');
        const a = await getAssetById(id);
        if (!mounted) return;
        setAsset(a);
        setName(a.name ?? '');
        setTagsText((a.tags ?? []).join(', '));
        setUrl(a.url ?? '');
        setMetaJson(JSON.stringify(a.meta ?? {}, null, 2));

        // preview
        const meta = (a.meta ?? {}) as any;

        if (meta?.source === 'external') {
          if (typeof meta?.preview_url === 'string' && meta.preview_url) {
            setPreviewUrl(meta.preview_url);
            setIsExternalEmbed(true);
          } else if (typeof a?.url === 'string' && a.url) {
            setPreviewUrl(a.url);
            setIsExternalEmbed(false);
          } else {
            setPreviewUrl('');
            setIsExternalEmbed(false);
          }
        } else if (organizationId) {
          const bucket = getOrgBucketName(organizationId);
          const signed = await createSignedUrl(bucket, a.url, 3600);
          if (!mounted) return;
          setPreviewUrl(signed);
          setIsExternalEmbed(false);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? 'Erro ao carregar asset');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, getAssetById, organizationId]);

  React.useEffect(() => {
    if (editFromQuery) setEditing(true);
  }, [editFromQuery]);

  React.useEffect(() => {
    if (!asset) return;
    const m = (asset.meta ?? {}) as any;

    setMetaForm({
      produto: m.produto ?? '',
      dimensao: m.dimensao ?? '',
      versao: m.versao ?? '',
      personagem: m.personagem ?? '',
      nicho: m.nicho ?? '',
      genero: m.genero ?? '',
      tipo: m.tipo ?? '',
      momento_vsl: m.momento_vsl ?? '',
      emocao: m.emocao ?? '',
      faixa_etaria: m.faixa_etaria ?? '',
      genero_ator: m.genero_ator ?? '',
    });
  }, [asset?.id]);

  const onSave = async () => {
    if (!asset) return;
    try {
      setErr(null);
      const tags = normalizeTags(tagsText);
      let parsedMeta: any = {};
      try {
        parsedMeta = metaJson ? JSON.parse(metaJson) : {};
      } catch {
        throw new Error('Meta inválida (JSON).');
      }

      const nextMeta = {
        ...(asset.meta ?? {}),
        ...parsedMeta,
        ...Object.fromEntries(
          Object.entries(metaForm)
            .map(([k, v]) => [k, (v ?? '').trim()])
            .filter(([_, v]) => v !== '')
        ),
      } as Record<string, any>;

      Object.keys(nextMeta).forEach((k) => {
        if (typeof nextMeta[k] === 'string' && nextMeta[k].trim() === '') delete nextMeta[k];
      });

      // ✅ remover chaves vazias e também garantir que duracao não exista
      delete (nextMeta as any).duracao;

      // prevent changing url for storage assets
      const nextPatch: Partial<AssetRow> = {
        name,
        tags,
        meta: nextMeta,
      };
      if (isExternal(asset)) nextPatch.url = url;

      await updateAsset(asset.id, nextPatch);
      setEditing(false);

      // refresh local state
      const fresh = { ...asset, ...nextPatch, tags, meta: nextMeta } as AssetRow;
      setAsset(fresh);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao salvar');
    }
  };

  const onDelete = async () => {
    if (!asset) return;
    const ok = confirm('Tem certeza que deseja deletar este asset? (ação irreversível)');
    if (!ok) return;
    try {
      setErr(null);
      await deleteAsset(asset);
      nav('/dashboard', { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao deletar');
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-400">Carregando...</div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6">
        <button className="text-gray-300 hover:text-white flex items-center gap-2" onClick={() => nav(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="mt-4 text-red-300">{err ?? 'Asset não encontrado'}</div>
      </div>
    );
  }

  const external = isExternal(asset);
  const meta = asset.meta ?? {};

  // Pretty fields per category (MVP)
  const prettyFields: Array<{ label: string; value: string }> = [];
  const push = (label: string, value?: any) => {
    if (value === undefined || value === null || String(value).trim() === '') return;
    prettyFields.push({ label, value: String(value) });
  };

  // Common-ish
  push('Versão', meta.versao);
  push('Personagem', meta.personagem);
  push('Produto', meta.produto);
  push('Dimensão', meta.dimensao);
  push('Nicho', meta.nicho);
  push('Gênero', meta.genero);
  push('Tipo', meta.tipo);
  push('Momento VSL', meta.momento_vsl);
  push('Emoção/Vibe', meta.emocao);
  push('Faixa etária', meta.faixa_etaria);
  push('Gênero do ator', meta.genero_ator);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button className="text-gray-300 hover:text-white flex items-center gap-2" onClick={() => nav(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="flex gap-2">
          {external && (
            <a
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg bg-black/30 border border-border text-gray-200 hover:border-gold/40 flex items-center gap-2"
            >
              <ExternalLink size={16} /> Abrir link
            </a>
          )}

          {canEdit && (
            <button
              onClick={() => setEditing((v) => !v)}
              className="px-3 py-2 rounded-lg bg-black/30 border border-border text-gray-200 hover:border-gold/40 flex items-center gap-2"
            >
              <Pencil size={16} /> {editing ? 'Cancelar edição' : 'Editar'}
            </button>
          )}

          {editing && canEdit && (
            <button
              onClick={onSave}
              className="px-3 py-2 rounded-lg bg-gold text-black font-semibold hover:opacity-90 flex items-center gap-2"
            >
              <Save size={16} /> Salvar
            </button>
          )}

          {canDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 hover:bg-red-500/15 flex items-center gap-2"
            >
              <Trash2 size={16} /> Deletar
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="text-xs text-gray-500">Categoria</div>
            <div className="text-white font-semibold">{asset.type ?? '—'}</div>
          </div>

          <div className="aspect-video bg-black/60 flex items-center justify-center p-4">
            {meta?.source === 'external' ? (
              isExternalEmbed && previewUrl ? (
                <div className="w-full aspect-video rounded-2xl overflow-hidden border border-border bg-black/30">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    title={asset?.name ?? 'External preview'}
                  />
                </div>
              ) : (
                <a
                  href={asset?.url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-white/5"
                >
                  Abrir link externo
                </a>
              )
            ) : previewUrl ? (
              <video src={previewUrl} controls className="w-full rounded-2xl" />
            ) : (
              <div className="text-gray-500">Sem preview</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-5 space-y-4">
          <div>
            <div className="text-xs text-gray-500">Nome</div>
            {editing ? (
              <input
                className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            ) : (
              <div className="text-white font-semibold mt-1">{asset.name}</div>
            )}
          </div>

          <div>
            <div className="text-xs text-gray-500">Tags</div>
            {editing ? (
              <input
                className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="separe por vírgula"
              />
            ) : (
              <div className="mt-2 flex gap-2 flex-wrap">
                {(asset.tags ?? []).map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded bg-black/40 border border-border text-gray-300">
                    {t}
                  </span>
                ))}
                {(asset.tags?.length ?? 0) === 0 && <span className="text-gray-500 text-sm">—</span>}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-gray-500">Fonte</div>
            <div className="mt-1 text-gray-200">
              {(asset.meta?.source ?? (external ? 'external' : 'storage')).toString()}
            </div>
          </div>

          {external && (
            <div>
              <div className="text-xs text-gray-500">Link externo</div>
              {editing ? (
                <input
                  className="mt-1 w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              ) : (
                <div className="mt-1 text-gray-300 text-sm break-all">{asset.url}</div>
              )}
            </div>
          )}

          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {[
                ['produto', 'Produto'],
                ['dimensao', 'Dimensão'],
                ['personagem', 'Personagem'],
                ['versao', 'Versão'],
                ['nicho', 'Nicho'],
                ['genero', 'Gênero'],
                ['tipo', 'Tipo'],
                ['momento_vsl', 'Momento VSL'],
                ['emocao', 'Emoção'],
                ['faixa_etaria', 'Faixa etária'],
                ['genero_ator', 'Gênero do ator'],
              ].map(([k, label]) => (
                <div className="space-y-1" key={k}>
                  <div className="text-xs text-gray-400">{label}</div>
                  <input
                    className="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-white"
                    value={metaForm[k] ?? ''}
                    onChange={(e) => setMetaForm((p) => ({ ...p, [k]: e.target.value }))}
                    placeholder={label}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pretty meta */}
          {prettyFields.length > 0 && (
            <div>
              <div className="text-xs text-gray-500">Detalhes</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {prettyFields.map((f) => (
                  <div key={f.label} className="px-3 py-2 rounded-xl bg-black/30 border border-border">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">{f.label}</div>
                    <div className="text-sm text-white">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical details (admin only) */}
          {role === 'admin' && (
            <div className="pt-2">
              <button
                className="w-full flex items-center justify-between text-sm text-gray-300 hover:text-white bg-black/20 border border-border rounded-xl px-3 py-2"
                onClick={() => setShowTech((v) => !v)}
              >
                <span>Detalhes técnicos</span>
                {showTech ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showTech && (
                <div className="mt-2 space-y-2">
                  {!external && (
                    <div className="text-xs text-gray-500 break-all">
                      <span className="text-gray-400">Storage path:</span> {asset.url}
                    </div>
                  )}
                  <pre className="text-xs text-gray-300 bg-black/30 border border-border rounded-lg p-3 overflow-auto">
{JSON.stringify(asset.meta ?? {}, null, 2)}
                  </pre>
                  {editing && (
                    <textarea
                      className="w-full h-40 bg-black/40 border border-border rounded-lg px-3 py-2 text-white font-mono text-xs"
                      value={metaJson}
                      onChange={(e) => setMetaJson(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
