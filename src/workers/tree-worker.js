import { createWorkerTreeState, getIncludedIdsForQuery, rebuildWorkerRows, searchWorkerTree } from '../core/tree-worker-operations.js';

let state = createWorkerTreeState([]);
let filterCache = new Map();

self.addEventListener('message', (event) => {
  const { id, type, payload } = event.data ?? {};
  try {
    let result;
    if (type === 'setData') {
      state = createWorkerTreeState(payload.nodes ?? []);
      filterCache = new Map();
      result = { nodeCount: state.nodes.length };
    } else if (type === 'search') {
      result = searchWorkerTree(state, payload.query ?? '', payload.options ?? {});
    } else if (type === 'rebuildRows') {
      result = rebuildRowsIncremental(payload ?? {});
    } else {
      throw new Error(`Unknown tree worker request: ${type}`);
    }
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message ?? String(error) });
  }
});

function rebuildRowsIncremental(payload) {
  const query = String(payload.filterQuery ?? '').trim().toLowerCase();
  if (!query) return rebuildWorkerRows(state, payload);

  let cached = filterCache.get(query);
  if (!cached) {
    const base = findBestPrefixCache(query);
    const computed = getIncludedIdsForQuery(state, query, base?.matchingIds ?? null);
    cached = {
      matchingIds: computed.matchingIds,
      includedIds: Array.from(computed.includedIds),
    };
    filterCache.set(query, cached);
    trimFilterCache();
  }
  return rebuildWorkerRows(state, { ...payload, includedIds: cached.includedIds });
}

function findBestPrefixCache(query) {
  let best = null;
  for (const [cachedQuery, cached] of filterCache) {
    if (!cachedQuery || cachedQuery === query || !query.startsWith(cachedQuery)) continue;
    if (!best || cachedQuery.length > best.query.length) best = { query: cachedQuery, ...cached };
  }
  return best;
}

function trimFilterCache(limit = 8) {
  while (filterCache.size > limit) {
    const oldest = filterCache.keys().next().value;
    filterCache.delete(oldest);
  }
}
