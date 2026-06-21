const hasOwn = Object.prototype.hasOwnProperty;

const knownDynamicStateKeys = new Set([
  'value',
  'status',
  'progress',
  'pulse',
  'color',
  'selected',
  'highlighted',
  'visible',
  'updated',
  'updatedAt',
  'icon',
]);

/**
 * @param {import('./types.js').NodeDynamicState} target
 * @param {import('./types.js').NodeDynamicState} state
 */
export function mergeDynamicState(target, state) {
  if (!state) return target;

  if (hasOwn.call(state, 'value') && target.value !== state.value) target.value = state.value;
  if (hasOwn.call(state, 'status') && target.status !== state.status) target.status = state.status;
  if (hasOwn.call(state, 'progress') && target.progress !== state.progress) target.progress = state.progress;
  if (hasOwn.call(state, 'pulse') && target.pulse !== state.pulse) target.pulse = state.pulse;
  if (hasOwn.call(state, 'color') && target.color !== state.color) target.color = state.color;
  if (hasOwn.call(state, 'selected') && target.selected !== state.selected) target.selected = state.selected;
  if (hasOwn.call(state, 'highlighted') && target.highlighted !== state.highlighted) target.highlighted = state.highlighted;
  if (hasOwn.call(state, 'visible') && target.visible !== state.visible) target.visible = state.visible;
  if (hasOwn.call(state, 'updated') && target.updated !== state.updated) target.updated = state.updated;
  if (hasOwn.call(state, 'updatedAt') && target.updatedAt !== state.updatedAt) target.updatedAt = state.updatedAt;
  if (hasOwn.call(state, 'icon') && target.icon !== state.icon) target.icon = state.icon;

  for (const key in state) {
    if (!hasOwn.call(state, key) || knownDynamicStateKeys.has(key)) continue;
    if (target[key] !== state[key]) target[key] = state[key];
  }

  return target;
}

/** @param {import('./types.js').NodeDynamicState} state */
export function cloneDynamicState(state) {
  return mergeDynamicState({}, state);
}
