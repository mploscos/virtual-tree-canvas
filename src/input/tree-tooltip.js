/** DOM tooltip shared by framework adapters and standalone canvas hosts. */
export class TreeTooltip {
  constructor({ controller, host = controller.canvas?.parentElement }) {
    this.controller = controller;
    this.canvas = controller.canvas;
    this.host = host;
    this.pointer = null;
    this.targetKey = null;
    if (!this.canvas || !host?.ownerDocument) throw new Error('TreeTooltip requires a mounted canvas and host');
    this.element = host.ownerDocument.createElement('div');
    this.element.className = 'virtual-tree-canvas-tooltip';
    this.element.setAttribute('role', 'tooltip');
    Object.assign(this.element.style, {
      position: 'absolute', display: 'none', pointerEvents: 'none', zIndex: '20',
      maxWidth: 'calc(100% - 16px)', padding: '6px 8px', borderRadius: '5px',
      background: 'var(--vtc-tooltip-background, #111827)', color: 'var(--vtc-tooltip-color, #e5e7eb)',
      border: '1px solid var(--vtc-tooltip-border, #374151)',
      font: '12px/1.35 var(--font-family, ui-monospace, monospace)', overflowWrap: 'anywhere'
    });
    host.appendChild(this.element);
    this.canvas.addEventListener('mousemove', this.onMove);
    this.canvas.addEventListener('mouseleave', this.onLeave);
    this.canvas.addEventListener('wheel', this.hide);
    this.canvas.addEventListener('pointerdown', this.hide);
    this.stops = [
      ...['viewportchange', 'filterchange', 'rowdrag'].map(type => controller.on(type, this.hide)),
      controller.on('datachange', this.refresh)
    ];
  }

  onMove = event => {
    this.pointer = { clientX: event.clientX, clientY: event.clientY };
    this.#update(true, false);
  };

  /** Refresh a visible tooltip without requiring another mousemove event. */
  refresh = () => {
    if (this.element.style.display === 'none' || !this.pointer) return;
    this.#update(false, true);
  };

  #update(reposition, preserveTarget) {
    const event = this.pointer;
    const rect = this.canvas.getBoundingClientRect();
    const hit = this.controller.hitTest(event.clientX - rect.left, event.clientY - rect.top);
    let text;
    if (['rowDrag', 'rowUp', 'rowDown'].includes(hit?.part)) {
      text = this.controller.canReorderRows()
        ? { rowDrag: 'Drag to reorder. Alt + Up/Down also moves the focused row.', rowUp: 'Move up', rowDown: 'Move down' }[hit.part]
        : 'Clear sorting and filtering to reorder rows.';
    } else text = this.controller.getTooltipForHit(hit)?.text;
    if (!text || this.controller.rowReorderInput?.gesture) return this.hide();
    const targetKey = tooltipTargetKey(hit);
    if (preserveTarget && targetKey !== this.targetKey) return this.hide();
    this.targetKey = targetKey;
    if (this.element.textContent !== text) this.element.textContent = text;
    if (!reposition) return;
    const hostRect = this.host.getBoundingClientRect();
    this.element.style.display = 'block';
    const x = event.clientX - hostRect.left + 12;
    const y = event.clientY - hostRect.top + 14;
    this.element.style.left = `${Math.max(8, Math.min(x, hostRect.width - this.element.offsetWidth - 8))}px`;
    this.element.style.top = `${Math.max(8, Math.min(y, hostRect.height - this.element.offsetHeight - 8))}px`;
  }

  hide = () => {
    this.element.style.display = 'none';
    this.targetKey = null;
  };

  onLeave = () => {
    this.pointer = null;
    this.hide();
  };

  destroy() {
    this.canvas.removeEventListener('mousemove', this.onMove);
    this.canvas.removeEventListener('mouseleave', this.onLeave);
    this.canvas.removeEventListener('wheel', this.hide);
    this.canvas.removeEventListener('pointerdown', this.hide);
    for (const stop of this.stops) stop();
    this.element.remove();
  }
}

function tooltipTargetKey(hit) {
  if (!hit) return '';
  return `${hit.area ?? ''}\0${hit.row?.nodeId ?? ''}\0${hit.column?.id ?? ''}\0${hit.part ?? ''}`;
}
