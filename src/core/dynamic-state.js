const hasOwn = Object.prototype.hasOwnProperty;

/**
 * @param {import('./types.js').NodeDynamicState} target
 * @param {import('./types.js').NodeDynamicState} state
 */
export function mergeDynamicState(target, state) {
  mergeDynamicStateChanged(target, state);
  return target;
}

/**
 * Merge a dynamic state patch and report whether at least one own property changed.
 * Values are compared with Object.is so repeated NaN values and signed zero are
 * handled consistently.
 *
 * @param {import('./types.js').NodeDynamicState} target
 * @param {import('./types.js').NodeDynamicState} state
 * @returns {boolean}
 */
export function mergeDynamicStateChanged(target, state) {
  if (!state) return false;
  let changed = false;

  for (const key in state) {
    if (!hasOwn.call(state, key) || Object.is(target[key], state[key])) continue;
    target[key] = state[key];
    changed = true;
  }

  return changed;
}

/** @param {import('./types.js').NodeDynamicState} state */
export function cloneDynamicState(state) {
  return mergeDynamicState({}, state);
}
