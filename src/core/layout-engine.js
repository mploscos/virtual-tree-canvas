/**
 * Simple top-down hierarchical layout. Replaceable by design.
 */
export class TreeLayoutEngine {
  constructor(options = {}) {
    this.nodeWidth = options.nodeWidth ?? 132;
    this.nodeHeight = options.nodeHeight ?? 26;
    this.levelGap = options.levelGap ?? 92;
    this.rowGap = options.rowGap ?? 12;
  }

  /**
   * @param {import('./tree-model.js').TreeModel} model
   */
  layout(model) {
    /** @type {import('./types.js').LayoutNode[]} */
    const layoutNodes = [];
    /** @type {{ sourceIndex: number, targetIndex: number }[]} */
    const edges = [];
    const typeMap = new Map();
    const iconMap = new Map();
    let row = 0;

    const typeIndex = (value = '') => {
      if (!typeMap.has(value)) typeMap.set(value, typeMap.size);
      return typeMap.get(value);
    };
    const iconIndex = (value = '') => {
      if (!iconMap.has(value)) iconMap.set(value, iconMap.size);
      return iconMap.get(value);
    };

    const visit = (id, depth, parentIndex) => {
      if (!model.isVisibleByExpansion(id)) return;
      const node = model.index.getNode(id);
      if (!node) return;
      const index = layoutNodes.length;
      const item = {
        index,
        id: node.id,
        parentIndex,
        x: depth * this.levelGap,
        y: row * (this.nodeHeight + this.rowGap),
        width: this.nodeWidth,
        height: this.nodeHeight,
        depth,
        iconIndex: iconIndex(node.icon),
        typeIndex: typeIndex(node.type),
      };
      layoutNodes.push(item);
      if (parentIndex >= 0) edges.push({ sourceIndex: parentIndex, targetIndex: index });
      row++;
      if (!model.expanded.has(id)) return;
      for (const childId of model.index.getChildren(id)) visit(childId, depth + 1, index);
    };

    for (const rootId of model.index.roots) visit(rootId, 0, -1);

    const width = layoutNodes.reduce((max, node) => Math.max(max, node.x + node.width), 0);
    const height = layoutNodes.reduce((max, node) => Math.max(max, node.y + node.height), 0);
    return { nodes: layoutNodes, edges, bounds: { x: 0, y: 0, width, height }, typeMap, iconMap };
  }
}

