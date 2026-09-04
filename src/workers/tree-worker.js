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
  const options = {
    caseSensitive: Boolean(payload.filterOptions?.caseSensitive),
    wholeWord: Boolean(payload.filterOptions?.wholeWord),
  };
  const query = normalizeFilterValue(payload.filterQuery ?? '', options);
  if (!query) return rebuildWorkerRows(state, payload);

  const cacheKey = `${options.caseSensitive ? 1 : 0}:${options.wholeWord ? 1 : 0}:${query}`;
  let cached = filterCache.get(cacheKey);
  if (!cached) {
    const base = findBestPrefixCache(query, options);
    const computed = getIncludedIdsForQuery(state, query, base?.matchingIds ?? null, options);
    cached = {
      query,
      options,
      matchingIds: computed.matchingIds,
      includedIds: Array.from(computed.includedIds),
    };
    filterCache.set(cacheKey, cached);
    trimFilterCache();
  }
  return rebuildWorkerRows(state, { ...payload, includedIds: cached.includedIds });
}

function findBestPrefixCache(query, options = {}) {
  let best = null;
  for (const cached of filterCache.values()) {
    if (cached.options.caseSensitive !== Boolean(options.caseSensitive) || cached.options.wholeWord !== Boolean(options.wholeWord)) continue;
    const cachedQuery = cached.query;
    if (!cachedQuery || cachedQuery === query || !query.startsWith(cachedQuery)) continue;
    if (!best || cachedQuery.length > best.query.length) best = cached;
  }
  return best;
}

function trimFilterCache(limit = 8) {
  while (filterCache.size > limit) {
    const oldest = filterCache.keys().next().value;
    filterCache.delete(oldest);
  }
}

function normalizeFilterValue(value, options = {}) {
  const text = String(value ?? '').trim();
  return options.caseSensitive ? text : text.toLowerCase();
}
