/**
 * Share tree-cell positions between painting, hit testing and tooltips.
 */
export function treeCellLayout(depth, indentWidth, hasHierarchy, iconSize = 15) {
  const indent = depth * indentWidth;
  const iconX = indent + (hasHierarchy ? 27 : 8);
  return {
    chevronX: hasHierarchy ? indent + 10 : null,
    iconX,
    labelX: iconX + iconSize + 8
  };
}
