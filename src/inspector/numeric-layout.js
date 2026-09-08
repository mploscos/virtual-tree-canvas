/** Shared geometry for canvas drawing, hit testing and the numeric editor. */
export function numericLayout(width, data = {}) {
  width = Math.max(0, width);
  const numeric = typeof data.value === 'number' && !data.meta?.options && !data.meta?.button;
  const unit = numeric && typeof data.meta?.unit === 'string' ? data.meta.unit.trim() : '';
  // Reserve a stable slot: changes to the number must not move the unit.
  const gap = unit ? 6 : 0;
  const unitWidth = unit ? Math.min(Math.max(24, [...unit].length * 7), 96, Math.max(0, width - 48)) : 0;
  const contentWidth = Math.max(0, width - unitWidth - gap);
  const valueWidth = Math.min(64, Math.max(42, contentWidth * 0.28), Math.max(0, contentWidth - 32));
  return {
    unit, unitWidth, unitLeft: contentWidth + gap, contentWidth,
    valueWidth, numberLeft: contentWidth - valueWidth,
    barWidth: Math.max(0, contentWidth - valueWidth - 8),
  };
}
