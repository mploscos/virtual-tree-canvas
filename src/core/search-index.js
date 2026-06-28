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
        searchId: normalize(searchId),
        label: normalize(node.label ?? ''),
        path: normalize(path),
        tags: normalize((node.tags ?? []).join(' ')),
        type: normalize(node.type ?? ''),
        value: normalize(searchableNodeValue(node)),
      };
      record.searchText = defaultSearchText(node, record);
      return record;
    });
  }

  /**
   * @param {string} query
   * @param {{ fields?: string[], limit?: number }} options
   */
  search(query, options = {}) {
    const q = query.trim().toLowerCase();
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
        if (record.searchText.includes(q)) results.push(record.id);
      } else {
        for (const field of fields) {
          if (searchFieldValue(record, field).includes(q)) {
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

function searchFieldValue(record, field) {
  if (field === 'id') return record.searchId || normalize(record.id);
  return normalize(record[field] ?? '');
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
    return normalize([
      record.searchId,
      node.label ?? '',
      data.key ?? '',
      data.valueText ?? '',
      data.valueType ?? '',
      record.tags,
      record.type,
    ].join(' '));
  }
  return normalize(`${record.searchId} ${record.label} ${record.path} ${record.tags} ${record.type}`);
}

function normalize(value) {
  return String(value ?? '').toLowerCase();
}
