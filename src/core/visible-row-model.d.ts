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
 * @property {number} [stickyY]
 */
export type TreeRow = {
    nodeId: string;
    nodeIndex: number;
    depth: number;
    rowIndex: number;
    y: number;
    height: number;
    expanded: boolean;
    hasChildren: boolean;
    stickyY?: number;
};
export declare class VisibleRowModel extends EventTarget {
    #private;
    model: import("./tree-model.js").TreeModel;
    expansion: import("./tree-expansion-manager.js").TreeExpansionManager;
    rowHeight: number;
    indentWidth: number;
    /**
     * @type {TreeRow[]}
     */
    rows: TreeRow[];
    /**
     * @type {Map<string, number>}
     */
    rowIndexById: Map<string, number>;
    contentWidth: number;
    contentHeight: number;
    sortComparator: any;
    sortIdComparator: any;
    filterPredicate: any;
    filterCollapsed: Set<any>;
    /**
     * @param {{
     *   model: import('./tree-model.js').TreeModel,
     *   expansion: import('./tree-expansion-manager.js').TreeExpansionManager,
     *   rowHeight?: number,
     *   indentWidth?: number
     * }} options
     */
    constructor({ model, expansion, rowHeight, indentWidth }: {
        model: import('./tree-model.js').TreeModel;
        expansion: import('./tree-expansion-manager.js').TreeExpansionManager;
        rowHeight?: number;
        indentWidth?: number;
    });
    setSortComparator(comparator: any): void;
    /** Sort IDs without resolving nodes for every comparison. */
    setSortIdComparator(comparator: any): void;
    setFilterPredicate(predicate: any): void;
    collapseFilterBranch(id: any): void;
    expandFilterBranch(id: any): boolean;
    applyRows({ rows, contentHeight, contentWidth }: {
        contentHeight: any;
        contentWidth: any;
        rows: any;
    }): void;
    rebuild(): void;
    /**
     * @param {string} id
     */
    getRowById(id: string): TreeRow | null;
    /**
     * @param {number} rowIndex
     */
    getRow(rowIndex: number): TreeRow;
    /**
     * @param {import('./tree-view-viewport.js').TreeViewViewport} viewport
     * @param {number} overscan
     */
    getVisibleRange(viewport: import('./tree-view-viewport.js').TreeViewViewport, overscan?: number): {
        first: number;
        last: number;
        count: number;
    };
    /**
     * @param {import('./tree-view-viewport.js').TreeViewViewport} viewport
     */
    getStickyRows(viewport: import('./tree-view-viewport.js').TreeViewViewport): {
        nodeId?: string | undefined;
        nodeIndex?: number | undefined;
        depth?: number | undefined;
        rowIndex?: number | undefined;
        y?: number | undefined;
        height?: number | undefined;
        expanded?: boolean | undefined;
        hasChildren?: boolean | undefined;
        stickyY: number;
    }[];
}
