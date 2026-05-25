import { TreeIndex } from './tree-index.js';

/**
 * Owns structural nodes, expanded state, and per-node dynamic state.
 * Structural operations are cold-path; dynamic patches are hot-path.
 */
export class TreeModel extends EventTarget {
  constructor() {
    super();
    /** @type {Array<import('./types.js').TreeNode>} */
    this.nodes = [];
    this.index = new TreeIndex();
    /** @type {Map<string, import('./types.js').NodeDynamicState>} */
    this.dynamicState = new Map();
    /** @type {Set<string>} */
    this.expanded = new Set();
  }

  /** @param {Array<import('./types.js').TreeNode>} nodes */
  setTree(nodes) {
    this.nodes = nodes.slice();
    this.index.rebuild(this.nodes);
    this.expanded = new Set(this.nodes.map((node) => node.id));
    for (const node of this.nodes) {
      if (!this.dynamicState.has(node.id)) this.dynamicState.set(node.id, { visible: true });
    }
    this.dispatchEvent(new Event('structurechange'));
  }

  /**
   * @param {Array<import('./types.js').TreeNode>} nodes
   */
  addNodes(nodes) {
    this.nodes = this.nodes.concat(nodes);
    this.index.rebuild(this.nodes);
    for (const node of nodes) this.dynamicState.set(node.id, { visible: true });
    this.dispatchEvent(new Event('structurechange'));
  }

  /** @param {string[]} ids */
  removeNodes(ids) {
    const remove = new Set(ids);
    this.nodes = this.nodes.filter((node) => !remove.has(node.id) && !remove.has(node.parentId ?? ''));
    for (const id of remove) {
      this.dynamicState.delete(id);
      this.expanded.delete(id);
    }
    this.index.rebuild(this.nodes);
    this.dispatchEvent(new Event('structurechange'));
  }

  /** @param {string} id */
  expand(id) {
    this.expanded.add(id);
    this.dispatchEvent(new Event('structurechange'));
  }

  /** @param {string} id */
  collapse(id) {
    this.expanded.delete(id);
    this.dispatchEvent(new Event('structurechange'));
  }

  /**
   * @param {Array<import('./types.js').DynamicPatch>} patches
   */
  applyDynamicPatches(patches) {
    for (const patch of patches) {
      const current = this.dynamicState.get(patch.id);
      if (!current) continue;
      Object.assign(current, patch.state);
    }
  }

  /** @param {string} id */
  isVisibleByExpansion(id) {
    const ancestors = this.index.getAncestors(id);
    return ancestors.every((ancestorId) => this.expanded.has(ancestorId));
  }
}
