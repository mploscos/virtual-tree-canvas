/**
 * CPU index for structural tree queries. Rebuild this only on cold-path changes.
 */
export declare class TreeIndex {
    #private;
    /** @type {Map<string, number>} */
    idToIndex: Map<string, number>;
    /** @type {Map<string | null, string[]>} */
    childrenByParent: Map<string | null, string[]>;
    /** @type {string[]} */
    roots: string[];
    /** @type {Array<import('./types.js').TreeNode>} */
    nodes: Array<import('./types.js').TreeNode>;
    /** @type {Map<string, string>} */
    pathById: Map<string, string>;
    constructor();
    /**
     * @param {Array<import('./types.js').TreeNode>} nodes
     */
    rebuild(nodes: Array<import('./types.js').TreeNode>): void;
    /** @param {string} id */
    getNode(id: string): import("./types.js").TreeNode | null;
    /** @param {string | null} parentId */
    getChildren(parentId: string | null): string[];
    /** @param {string} id */
    getAncestors(id: string): string[];
}
