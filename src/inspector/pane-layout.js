export const inspectorArrayButtonWidth = 22;

/** @param {{valueType?: string, disabled?: boolean, meta?: {readonly?: boolean}, arrayRemovable?: boolean}|null} [data] */
export function inspectorPaneLayout(
  width,
  depth = 0,
  indentWidth = 18,
  editorType = '',
  labelEnd = 0,
  data = null,
  editable = false
) {
  const hasAdd = editable && data?.valueType === 'array' && !data.disabled && !data.meta?.readonly;
  const hasRemove = editable && data?.arrayRemovable === true;
  const buttonStep = inspectorArrayButtonWidth + 4;
  const rightButtonX = width - 6 - inspectorArrayButtonWidth;
  const arrayAddX = hasAdd ? rightButtonX - (hasRemove ? buttonStep : 0) : null;
  const arrayRemoveX = hasRemove ? rightButtonX : null;
  const contentWidth = Math.max(1, width - buttonStep * (Number(hasAdd) + Number(hasRemove)));
  const rightPadding = 14;
  const minEditor = Math.min(170, Math.max(96, contentWidth * 0.45));
  const minLabelEnd = Math.max(88, depth * indentWidth + 104);
  const preferredLeft = Math.max(minLabelEnd, labelEnd, contentWidth * 0.32);
  const maxLeft = Math.max(64, contentWidth - rightPadding - minEditor);
  const editorLeft = Math.max(64, Math.min(preferredLeft, maxLeft));
  const editorWidth = Math.max(56, contentWidth - rightPadding - editorLeft);
  return {
    editorLeft,
    editorWidth,
    contentWidth,
    arrayAddX,
    arrayRemoveX
  };
}
