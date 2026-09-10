/** Share tree-cell positions between painting, hit testing and tooltips. */
export function treeCellLayout(depth, indentWidth, hasHierarchy) {
  const indent = depth * indentWidth;
  return {
    chevronX: hasHierarchy ? indent + 10 : null,
    iconX: indent + (hasHierarchy ? 27 : 8),
    labelX: indent + (hasHierarchy ? 50 : 31),
  };
}
