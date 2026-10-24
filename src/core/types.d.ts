/**
 * @typedef {Object} TreeNode
 * @property {string} id
 * @property {string | null} [parentId]
 * @property {string} [label]
 * @property {string} [type]
 * @property {string} [icon]
 * @property {string} [image]
 * @property {string[]} [tags]
 * @property {boolean} [reorderable] Allow manual reordering of this node (defaults to true).
 * @property {any} [data]
 */
export type TreeNode = {
    id: string;
    parentId?: string | null;
    label?: string;
    type?: string;
    icon?: string;
    image?: string;
    tags?: string[];
    /**
     * Allow manual reordering of this node (defaults to true).
     */
    reorderable?: boolean;
    data?: any;
};
export type NodeDynamicState = {
    value?: number;
    status?: number | string;
    progress?: number;
    pulse?: number;
    color?: string;
    selected?: boolean;
    highlighted?: boolean;
    visible?: boolean;
    updated?: boolean;
    updatedAt?: number;
    icon?: string;
};
export type LayoutNode = {
    index: number;
    id: string;
    parentIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
    iconIndex: number;
    typeIndex: number;
};
export type DynamicPatch = {
    id: string;
    state: NodeDynamicState;
};
/**
 * @typedef {Object} NodeDynamicState
 * @property {number} [value]
 * @property {number | string} [status]
 * @property {number} [progress]
 * @property {number} [pulse]
 * @property {string} [color]
 * @property {boolean} [selected]
 * @property {boolean} [highlighted]
 * @property {boolean} [visible]
 * @property {boolean} [updated]
 * @property {number} [updatedAt]
 * @property {string} [icon]
 */
/**
 * @typedef {Object} LayoutNode
 * @property {number} index
 * @property {string} id
 * @property {number} parentIndex
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} depth
 * @property {number} iconIndex
 * @property {number} typeIndex
 */
/**
 * @typedef {Object} DynamicPatch
 * @property {string} id
 * @property {NodeDynamicState} state
 */
