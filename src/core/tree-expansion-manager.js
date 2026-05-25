export class TreeExpansionManager extends EventTarget {
  /** @param {import('./tree-model.js').TreeModel} model */
  constructor(model) {
    super();
    this.model = model;
  }

  /** @param {string} id */
  isExpanded(id) {
    return this.model.expanded.has(id);
  }

  /** @param {string} id */
  hasChildren(id) {
    return this.model.index.getChildren(id).length > 0;
  }

  /** @param {string} id */
  expand(id) {
    if (!this.hasChildren(id) || this.model.expanded.has(id)) return false;
    this.model.expanded.add(id);
    this.dispatchEvent(new Event('change'));
    return true;
  }

  /** @param {string} id */
  collapse(id) {
    if (!this.model.expanded.delete(id)) return false;
    this.dispatchEvent(new Event('change'));
    return true;
  }

  /** @param {string} id */
  toggle(id) {
    return this.isExpanded(id) ? this.collapse(id) : this.expand(id);
  }

  expandAll() {
    for (const node of this.model.nodes) {
      if (this.hasChildren(node.id)) this.model.expanded.add(node.id);
    }
    this.dispatchEvent(new Event('change'));
  }

  collapseAll() {
    this.model.expanded.clear();
    this.dispatchEvent(new Event('change'));
  }

  /** @param {number} maxDepth */
  expandToDepth(maxDepth) {
    this.model.expanded.clear();
    const visit = (id, depth) => {
      if (depth < maxDepth && this.hasChildren(id)) this.model.expanded.add(id);
      for (const childId of this.model.index.getChildren(id)) visit(childId, depth + 1);
    };
    for (const rootId of this.model.index.roots) visit(rootId, 0);
    this.dispatchEvent(new Event('change'));
  }

  /** @param {string} id */
  expandAncestors(id) {
    for (const ancestorId of this.model.index.getAncestors(id)) this.model.expanded.add(ancestorId);
    this.dispatchEvent(new Event('change'));
  }
}

