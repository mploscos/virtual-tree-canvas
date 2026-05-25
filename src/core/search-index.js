export class TreeSearchIndex {
  constructor() {
    this.records = [];
    this.results = [];
    this.cursor = -1;
    this.lastQuery = '';
  }

  /** @param {import('./tree-model.js').TreeModel} model */
  rebuild(model) {
    this.records = model.nodes.map((node) => ({
      id: node.id,
      label: (node.label ?? '').toLowerCase(),
      path: (model.index.pathById.get(node.id) ?? '').toLowerCase(),
      tags: (node.tags ?? []).join(' ').toLowerCase(),
      type: (node.type ?? '').toLowerCase(),
    }));
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
    for (const record of this.records) {
      for (const field of fields) {
        if (String(record[field] ?? '').includes(q)) {
          results.push(record.id);
          break;
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
