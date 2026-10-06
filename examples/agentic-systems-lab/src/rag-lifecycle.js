import crypto from 'node:crypto';

export function stableDocumentId({ sourceId, path, tenant = 'default' }) {
  if (!sourceId && !path) throw new Error('sourceId or path is required');
  return crypto.createHash('sha256').update(`${tenant}:${sourceId ?? path}`).digest('hex').slice(0, 24);
}

export function planDocumentLifecycle(event) {
  const type = String(event?.type ?? '').toLowerCase();
  const documentId = stableDocumentId(event);
  const metadata = {
    document_id: documentId,
    source_id: event.sourceId ?? null,
    path: event.path ?? null,
    tenant: event.tenant ?? 'default',
    version: Number(event.version ?? 1),
  };
  if (type === 'created') return { documentId, steps: ['LOAD', 'CHUNK', 'EMBED', 'UPSERT'], metadata };
  if (type === 'updated') return { documentId, steps: ['DELETE_OLD_VERSION', 'LOAD', 'CHUNK', 'EMBED', 'UPSERT'], metadata };
  if (type === 'deleted') return { documentId, steps: ['DELETE_BY_DOCUMENT_ID'], metadata };
  throw new Error(`unsupported lifecycle event: ${type || '<empty>'}`);
}

export function buildMetadataFilter(filters = {}) {
  const allowed = ['document_id', 'tenant', 'client_name', 'rule_number', 'date', 'source_id'];
  const out = {};
  for (const [key, value] of Object.entries(filters)) {
    if (!allowed.includes(key) || value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

export function selectRerankCandidates(chunks, { initialK = 20, finalK = 3 } = {}) {
  const initial = [...chunks].filter(x => Number.isFinite(Number(x.vectorScore)))
    .sort((a, b) => Number(b.vectorScore) - Number(a.vectorScore)).slice(0, initialK);
  return initial.filter(x => Number.isFinite(Number(x.rerankScore)))
    .sort((a, b) => Number(b.rerankScore) - Number(a.rerankScore)).slice(0, finalK);
}
