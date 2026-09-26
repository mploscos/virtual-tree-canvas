/** Shared geometry for canvas drawing, hit testing and the numeric editor. */
export function numericLayout(width, data = {}) {
  width = Math.max(0, width);
  const numeric = typeof data.value === 'number' && !data.meta?.options && !data.meta?.button;
  const unit = numeric && typeof data.meta?.unit === 'string' ? data.meta.unit.trim() : '';
  // Reserve a stable slot: changes to the number must not move the unit.
  const unitGap = unit ? 6 : 0;
  const unitWidth = unit ? Math.min(Math.max(12, [...unit].length * 7), 96, Math.max(0, width - 48)) : 0;
  const contentWidth = Math.max(0, width - unitWidth - unitGap);
  const rangeGap = 8;
  const rangeWidth = Math.max(0, contentWidth - rangeGap);
  // Keep the slider useful without letting it consume every extra pixel. The exact
  // numeric value is the primary editing control, so it receives the remaining room.
  const barWidth = Math.min(72, rangeWidth * 0.46);
  const valueWidth = Math.max(0, rangeWidth - barWidth);
  return {
    unit, unitWidth, unitLeft: contentWidth + unitGap, contentWidth,
    rangeGap,
    valueWidth, numberLeft: contentWidth - valueWidth,
    barWidth,
  };
}
