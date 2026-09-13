export function drawCheckbox(ctx, x, y, checked, theme) {
  ctx.beginPath();
  ctx.roundRect(x, y, 16, 16, 3);
  ctx.fillStyle = theme.colors.progressTrack;
  ctx.fill();
  ctx.strokeStyle = checked ? theme.colors.progressFill : theme.colors.textMuted;
  ctx.stroke();
  if (!checked) return;
  ctx.fillStyle = theme.colors.progressFill;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 4, 8, 8, 1.5);
  ctx.fill();
}
