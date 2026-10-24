import { TreeIndex } from './tree-index.js';
/**
 * Owns structural nodes, expanded state, and per-node dynamic state.
 * Structural operations are cold-path; dynamic patches are hot-path.
 */
export declare class TreeModel extends EventTarget {
    /** @type {Array<import('./types.js').TreeNode>} */
    nodes: Array<import('./types.js').TreeNode>;
    index: TreeIndex;
    /** @type {Map<string, import('./types.js').NodeDynamicState>} */
    dynamicState: Map<string, import('./types.js').NodeDynamicState>;
    /** @type {Set<string>} */
    expanded: Set<string>;
    constructor();
    /** @param {Array<import('./types.js').TreeNode>} nodes */
    setTree(nodes: Array<import('./types.js').TreeNode>): void;
    /**
     * @param {Array<import('./types.js').TreeNode>} nodes
     */
    addNodes(nodes: Array<import('./types.js').TreeNode>): void;
    /** @param {string[]} ids */
    removeNodes(ids: string[]): void;
    /** @param {string} id */
    expand(id: string): void;
    /** Move one node among siblings without resetting expansion or live values. */
    moveNode(id: any, targetIndex: any): {
        nodeId: any;
        parentId: string | null;
        fromIndex: number;
        toIndex: number;
        siblingOrder: string[];
        order: string[];
    } | null;
    /** @param {string} id */
    collapse(id: string): void;
    /**
     * @param {Array<import('./types.js').DynamicPatch>} patches
     */
    applyDynamicPatches(patches: Array<import('./types.js').DynamicPatch>): Set<any>;
    /** @param {string} id */
    isVisibleByExpansion(id: string): boolean;
}
