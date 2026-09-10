export function inspectorPaneLayout(width, depth = 0, indentWidth = 18, editorType = '', labelEnd = 0) {
  const safeWidth = Math.max(1, width);
  const rightPadding = 14;
  const minEditor = Math.min(170, Math.max(96, safeWidth * 0.45));
  const minLabelEnd = Math.max(88, depth * indentWidth + 104);
  const preferredLeft = Math.max(minLabelEnd, labelEnd, safeWidth * 0.32);
  const maxLeft = Math.max(64, safeWidth - rightPadding - minEditor);
  const editorLeft = Math.max(64, Math.min(preferredLeft, maxLeft));
  const editorWidth = Math.max(56, safeWidth - rightPadding - editorLeft);
  return { editorLeft, editorWidth };
}

