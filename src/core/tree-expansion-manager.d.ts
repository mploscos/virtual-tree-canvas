export declare class TreeExpansionManager extends EventTarget {
    model: import("./tree-model.js").TreeModel;
    /** @param {import('./tree-model.js').TreeModel} model */
    constructor(model: import('./tree-model.js').TreeModel);
    /** @param {string} id */
    isExpanded(id: string): boolean;
    /** @param {string} id */
    hasChildren(id: string): boolean;
    /** @param {string} id */
    expand(id: string): boolean;
    /** @param {string} id */
    collapse(id: string): boolean;
    /** @param {string} id */
    toggle(id: string): boolean;
    expandAll(): void;
    collapseAll(): void;
    /** @param {number} maxDepth */
    expandToDepth(maxDepth: number): void;
    /** @param {string} id */
    expandAncestors(id: string): void;
}
