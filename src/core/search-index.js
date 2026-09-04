export class TreeSearchIndex {
  constructor() {
    this.records = [];
    this.results = [];
    this.cursor = -1;
    this.lastQuery = '';
  }

  /** @param {import('./tree-model.js').TreeModel} model */
  rebuild(model) {
    this.records = model.nodes.map((node) => {
      const path = model.index.pathById.get(node.id) ?? '';
      const searchId = searchableNodeId(node);
      const record = {
        id: node.id,
        searchId,
        label: node.label ?? '',
        path,
        tags: (node.tags ?? []).join(' '),
        type: node.type ?? '',
        value: searchableNodeValue(node),
      };
      record.searchText = defaultSearchText(node, record);
      return record;
    });
  }

  /**
   * @param {string} query
   * @param {{ fields?: string[], limit?: number, caseSensitive?: boolean, wholeWord?: boolean }} options
   */
  search(query, options = {}) {
    const q = normalizeSearchValue(query.trim(), options);
    this.lastQuery = query;
    if (!q) {
      this.results = [];
      this.cursor = -1;
      return [];
    }
    const fields = options.fields ?? ['label', 'id', 'path', 'tags', 'type'];
    const limit = options.limit ?? 100;
    const results = [];
    const defaultFields = isDefaultSearchFields(fields);
    for (const record of this.records) {
      if (defaultFields) {
        if (matchesSearch(normalizeSearchValue(record.searchText, options), q, options.wholeWord)) results.push(record.id);
      } else {
        for (const field of fields) {
          if (matchesSearch(searchFieldValue(record, field, options), q, options.wholeWord)) {
            results.push(record.id);
            break;
          }
        }
      }
      if (results.length >= limit) break;
    }
    this.results = results;
    this.cursor = results.length ? 0 : -1;
    return results;
  }

  nextSearchResult() {
    if (!this.results.length) return null;
    this.cursor = (this.cursor + 1) % this.results.length;
    return this.results[this.cursor];
  }

  previousSearchResult() {
    if (!this.results.length) return null;
    this.cursor = (this.cursor - 1 + this.results.length) % this.results.length;
    return this.results[this.cursor];
  }

  currentSearchResult() {
    return this.cursor >= 0 ? this.results[this.cursor] ?? null : null;
  }

  clear() {
    this.results = [];
    this.cursor = -1;
    this.lastQuery = '';
  }
}

function isDefaultSearchFields(fields) {
  return fields.length === 5 && fields.includes('label') && fields.includes('id') && fields.includes('path') && fields.includes('tags') && fields.includes('type');
}

function searchFieldValue(record, field, options) {
  if (field === 'id') return normalizeSearchValue(record.searchId || record.id, options);
  return normalizeSearchValue(record[field] ?? '', options);
}

function searchableNodeId(node) {
  if (node?.data?.inspector) return node.data.key ?? node.label ?? node.id;
  return node?.id ?? '';
}

function searchableNodeValue(node) {
  if (!node?.data?.inspector) return '';
  return node.data.valueText ?? node.data.value ?? '';
}

function defaultSearchText(node, record) {
  if (node?.data?.inspector) {
    const data = node.data;
    return [
      record.searchId,
      node.label ?? '',
      data.key ?? '',
      data.valueText ?? '',
      data.valueType ?? '',
      record.tags,
      record.type,
    ].join(' ');
  }
  return `${record.searchId} ${record.label} ${record.path} ${record.tags} ${record.type}`;
}

function normalizeSearchValue(value, options = {}) {
  const text = String(value ?? '');
  return options.caseSensitive ? text : text.toLowerCase();
}

function matchesSearch(text, query, wholeWord = false) {
  if (!wholeWord) return text.includes(query);
  let index = text.indexOf(query);
  while (index !== -1) {
    if (!isWordChar(text[index - 1]) && !isWordChar(text[index + query.length])) return true;
    index = text.indexOf(query, index + query.length);
  }
  return false;
}

function isWordChar(char) {
  return typeof char === 'string' && /[\p{L}\p{N}_]/u.test(char);
}
