/**
 * @typedef {Object} TreeRow
 * @property {string} nodeId
 * @property {number} nodeIndex
 * @property {number} depth
 * @property {number} rowIndex
 * @property {number} y
 * @property {number} height
 * @property {boolean} expanded
 * @property {boolean} hasChildren
 */

export class VisibleRowModel extends EventTarget {
  /**
   * @param {{
   *   model: import('./tree-model.js').TreeModel,
   *   expansion: import('./tree-expansion-manager.js').TreeExpansionManager,
   *   rowHeight?: number,
   *   indentWidth?: number
   * }} options
   */
  constructor({ model, expansion, rowHeight = 28, indentWidth = 18 }) {
    super();
    this.model = model;
    this.expansion = expansion;
    this.rowHeight = rowHeight;
    this.indentWidth = indentWidth;
    /** @type {TreeRow[]} */
    this.rows = [];
    /** @type {Map<string, number>} */
    this.rowIndexById = new Map();
    this.contentWidth = 0;
    this.contentHeight = 0;
    this.sortComparator = null;
    this.filterPredicate = null;
    this.filterCollapsed = new Set();
  }

  setSortComparator(comparator) {
    this.sortComparator = comparator;
  }

  setFilterPredicate(predicate) {
    this.filterPredicate = predicate;
    this.filterCollapsed.clear();
  }

  collapseFilterBranch(id) {
    this.filterCollapsed.add(id);
  }

  expandFilterBranch(id) {
    return this.filterCollapsed.delete(id);
  }

  applyRows({ rows, contentHeight, contentWidth }) {
    this.rows = rows;
    this.rowIndexById.clear();
    for (const row of rows) this.rowIndexById.set(row.nodeId, row.rowIndex);
    this.contentHeight = contentHeight;
    this.contentWidth = contentWidth;
    this.dispatchEvent(new Event('change'));
  }

  rebuild() {
    this.rows = [];
    this.rowIndexById.clear();
    let maxDepth = 0;
    const includeCache = new Map();

    const subtreeIncluded = (id) => {
      if (!this.filterPredicate) return true;
      if (includeCache.has(id)) return includeCache.get(id);
      const node = this.model.index.getNode(id);
      const state = this.model.dynamicState.get(id) ?? {};
      const ownMatch = node ? this.filterPredicate(node, state) : false;
      const childMatch = this.model.index.getChildren(id).some((childId) => subtreeIncluded(childId));
      const included = ownMatch || childMatch;
      includeCache.set(id, included);
      return included;
    };

    const sortedChildren = (id) => {
      const children = this.model.index.getChildren(id).filter((childId) => subtreeIncluded(childId));
      if (!this.sortComparator) return children;
      return children.slice().sort((aId, bId) => {
        const a = this.model.index.getNode(aId);
        const b = this.model.index.getNode(bId);
        return this.sortComparator(a, b, aId, bId);
      });
    };

    const visit = (id, depth) => {
      if (!subtreeIncluded(id)) return;
      const nodeIndex = this.model.index.idToIndex.get(id);
      if (nodeIndex === undefined) return;
      const children = sortedChildren(id);
      const hasChildren = this.expansion.hasChildren(id);
      const autoExpanded = Boolean(this.filterPredicate && children.length > 0);
      const expanded = (this.expansion.isExpanded(id) || autoExpanded) && !this.filterCollapsed.has(id);
      const rowIndex = this.rows.length;
      this.rows.push({
        nodeId: id,
        nodeIndex,
        depth,
        rowIndex,
        y: rowIndex * this.rowHeight,
        height: this.rowHeight,
        expanded,
        hasChildren,
      });
      this.rowIndexById.set(id, rowIndex);
      maxDepth = Math.max(maxDepth, depth);
      if (!expanded) return;
      for (const childId of children) visit(childId, depth + 1);
    };

    const roots = this.model.index.roots.filter((rootId) => subtreeIncluded(rootId));
    if (this.sortComparator) {
      roots.sort((aId, bId) => this.sortComparator(this.model.index.getNode(aId), this.model.index.getNode(bId), aId, bId));
    }
    for (const rootId of roots) visit(rootId, 0);
    this.contentHeight = this.rows.length * this.rowHeight;
    this.contentWidth = Math.max(640, (maxDepth + 1) * this.indentWidth + 520);
    this.dispatchEvent(new Event('change'));
  }

  /** @param {string} id */
  getRowById(id) {
    const rowIndex = this.rowIndexById.get(id);
    return rowIndex === undefined ? null : this.rows[rowIndex];
  }

  /** @param {number} rowIndex */
  getRow(rowIndex) {
    return this.rows[rowIndex] ?? null;
  }

  /**
   * @param {import('./tree-view-viewport.js').TreeViewViewport} viewport
   * @param {number} overscan
   */
  getVisibleRange(viewport, overscan = 6) {
    const rowViewportHeight = viewport.rowViewportHeight ?? viewport.viewportHeight;
    const first = Math.max(0, Math.floor(viewport.scrollY / this.rowHeight) - overscan);
    const last = Math.min(this.rows.length - 1, Math.ceil((viewport.scrollY + rowViewportHeight) / this.rowHeight) + overscan);
    return { first, last, count: last >= first ? last - first + 1 : 0 };
  }
}
