/**
 * @typedef {Object} TreeNode
 * @property {string} id
 * @property {string | null} [parentId]
 * @property {string} [label]
 * @property {string} [type]
 * @property {string} [icon]
 * @property {string} [image]
 * @property {string[]} [tags]
 * @property {any} [data]
 */

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

