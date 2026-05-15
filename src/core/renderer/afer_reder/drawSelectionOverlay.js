export function drawSelectionOverlay(ctx, selectionBounds) {
  if (!ctx || !selectionBounds) return;
  let start_ms = Date.now();
  const { left, top, width, height, color } = selectionBounds;
  ctx.save();
  const fill = (color && color !== 'transparent') ? color : 'rgba(64,158,255,0.15)';
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(left, top, width, height);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(64,158,255,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(left, top, width, height);
  ctx.restore();
  let end_ms = Date.now();
  console.log(`drawSelectionOverlay took ${end_ms - start_ms}ms`);
}
