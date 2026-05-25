/**
 * CPU index for structural tree queries. Rebuild this only on cold-path changes.
 */
export class TreeIndex {
  constructor() {
    /** @type {Map<string, number>} */
    this.idToIndex = new Map();
    /** @type {Map<string | null, string[]>} */
    this.childrenByParent = new Map();
    /** @type {string[]} */
    this.roots = [];
    /** @type {Array<import('./types.js').TreeNode>} */
    this.nodes = [];
    /** @type {Map<string, string>} */
    this.pathById = new Map();
  }

  /**
   * @param {Array<import('./types.js').TreeNode>} nodes
   */
  rebuild(nodes) {
    this.idToIndex.clear();
    this.childrenByParent.clear();
    this.roots = [];
    this.nodes = nodes;
    this.pathById.clear();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node?.id) throw new Error(`Tree node at index ${i} is missing id`);
      if (this.idToIndex.has(node.id)) throw new Error(`Duplicate tree node id: ${node.id}`);
      this.idToIndex.set(node.id, i);
    }

    for (const node of nodes) {
      const parentId = node.parentId ?? null;
      if (parentId !== null && !this.idToIndex.has(parentId)) {
        throw new Error(`Parent ${parentId} for node ${node.id} does not exist`);
      }
      if (!this.childrenByParent.has(parentId)) this.childrenByParent.set(parentId, []);
      this.childrenByParent.get(parentId).push(node.id);
      if (parentId === null) this.roots.push(node.id);
    }

    for (const rootId of this.roots) this.#indexPaths(rootId, '');
  }

  /** @param {string} id */
  getNode(id) {
    const index = this.idToIndex.get(id);
    return index === undefined ? null : this.nodes[index];
  }

  /** @param {string | null} parentId */
  getChildren(parentId) {
    return this.childrenByParent.get(parentId) ?? [];
  }

  /** @param {string} id */
  getAncestors(id) {
    const ancestors = [];
    let node = this.getNode(id);
    while (node?.parentId) {
      ancestors.push(node.parentId);
      node = this.getNode(node.parentId);
    }
    return ancestors;
  }

  #indexPaths(id, parentPath) {
    const node = this.getNode(id);
    if (!node) return;
    const label = node.label || node.id;
    const path = parentPath ? `${parentPath}/${label}` : label;
    this.pathById.set(id, path);
    for (const childId of this.getChildren(id)) this.#indexPaths(childId, path);
  }
}

