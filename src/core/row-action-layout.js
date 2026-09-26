export const ROW_ACTION_SLOT_WIDTH = 28;

/** Width before the first visible action that the row content can safely reclaim. */
export function leadingHiddenRowActionWidth(actions = [], node, state = {}) {
  const firstVisible = actions.findIndex(
    (action) => resolve(action.visible, node, state) !== false
  );
  const hiddenCount = firstVisible === -1 ? actions.length : firstVisible;
  return hiddenCount * ROW_ACTION_SLOT_WIDTH;
}

function resolve(value, node, state) {
  return typeof value === 'function' ? value(node, state) : value;
}
