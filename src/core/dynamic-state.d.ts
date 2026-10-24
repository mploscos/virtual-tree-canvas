/**
 * @param {import('./types.js').NodeDynamicState} target
 * @param {import('./types.js').NodeDynamicState} state
 */
export declare function mergeDynamicState(target: import('./types.js').NodeDynamicState, state: import('./types.js').NodeDynamicState): import("./types.js").NodeDynamicState;
/**
 * Merge a dynamic state patch and report whether at least one own property changed.
 * Values are compared with Object.is so repeated NaN values and signed zero are
 * handled consistently.
 *
 * @param {import('./types.js').NodeDynamicState} target
 * @param {import('./types.js').NodeDynamicState} state
 * @returns {boolean}
 */
export declare function mergeDynamicStateChanged(target: import('./types.js').NodeDynamicState, state: import('./types.js').NodeDynamicState): boolean;
/** @param {import('./types.js').NodeDynamicState} state */
export declare function cloneDynamicState(state: import('./types.js').NodeDynamicState): import("./types.js").NodeDynamicState;
