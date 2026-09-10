let nextStatusId = 0;

/** Pointer interaction for the optional row-order column; persistence belongs to the host. */
export class RowReorderInput {
  constructor(controller) {
    this.controller = controller;
    this.canvas = controller.canvas;
    this.view = this.canvas.ownerDocument?.defaultView ?? globalThis.window;
    this.gesture = null;
    this.frame = null;
    this.previousTouchAction = this.canvas.style.touchAction;
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('keydown', this.onKey);
    this.canvas.addEventListener('lostpointercapture', this.onCancel);
    this.view.addEventListener('pointermove', this.onMove);
    this.view.addEventListener('pointerup', this.onUp);
    this.view.addEventListener('pointercancel', this.onCancel);
    this.view.addEventListener('blur', this.cancel);
    this.stops = ['filterchange', 'sortchange', 'rowreorderchange'].map(type => controller.on(type, () => {
      this.cancel();
      this.syncMode();
    }));
    this.stops.push(controller.on('datachange', () => {
      if (this.gesture && !controller.model.index.getNode(this.gesture.id)) this.cancel();
    }));
    this.stops.push(controller.on('rowreorder', event => {
      if (!this.status) return;
      const { nodeId, toIndex, siblingOrder } = event.detail;
      const label = controller.model.index.getNode(nodeId)?.label ?? nodeId;
      this.status.textContent = `${label}: position ${toIndex + 1} of ${siblingOrder.length}`;
    }));
    const doc = this.canvas.ownerDocument;
    if (doc?.createElement && this.canvas.parentElement) {
      this.status = doc.createElement('span');
      this.status.id = `vtc-row-order-status-${nextStatusId++}`;
      this.status.setAttribute('aria-live', 'polite');
      Object.assign(this.status.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' });
      this.canvas.parentElement.appendChild(this.status);
    }
    this.syncMode();
  }

  syncMode() {
    this.canvas.style.touchAction = (this.controller.canReorderRows() || this.controller.rowDrag) ? 'none' : this.previousTouchAction;
  }

  onDown = event => {
    if (event.button !== 0 || event.isPrimary === false || this.gesture) return;
    this.suppressClick = false;
    const point = this.point(event);
    const hit = this.controller.hitTest(point.x, point.y);
    if (!hit?.row) return;
    const node = this.controller.model.index.getNode(hit.row.nodeId);
    const payload = this.controller.rowDrag?.(node, this.controller.model.dynamicState.get(node.id) ?? {}) ?? null;
    const orderPart = ['rowDrag', 'rowUp', 'rowDown'].includes(hit.part);
    if (orderPart && node.reorderable === false) return;
    if (orderPart ? !this.controller.canReorderRows() && !(payload != null && hit.part === 'rowDrag') : payload == null || !['label', 'row', 'icon', 'cell'].includes(hit.part)) return;
    this.canvas.focus({ preventScroll: true });
    this.controller.cellEditor?.close?.();
    this.controller.focusedId = hit.row.nodeId;
    this.gesture = { id: hit.row.nodeId, part: orderPart ? hit.part : 'rowDrag', payload, pointerId: event.pointerId,
      startX: point.x, startY: point.y, point, dragging: false };
    this.canvas.setPointerCapture?.(event.pointerId);
    event.stopPropagation();
    if (orderPart) event.preventDefault();
  };

  onMove = event => {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.point = this.point(event);
    if (gesture.part !== 'rowDrag') return;
    if (!gesture.dragging && Math.hypot(gesture.point.x - gesture.startX, gesture.point.y - gesture.startY) < 5) return;
    if (!gesture.dragging && gesture.payload != null) this.emitDrag('rowdragstart', event);
    gesture.dragging = true;
    if (gesture.payload != null) this.emitDrag('rowdragmove', event);
    this.canvas.style.cursor = 'grabbing';
    this.updateTarget();
    this.scheduleScroll();
    event.preventDefault();
  };

  onUp = event => {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.point = this.point(event);
    const target = gesture.dragging ? this.controller.getRowDropTarget(gesture.id, gesture.point.x, gesture.point.y) : null;
    const hit = this.controller.hitTest(gesture.point.x, gesture.point.y);
    if (gesture.dragging && gesture.payload != null) this.emitDrag('rowdragend', event);
    this.suppressClick = gesture.dragging;
    this.cancel(false);
    if (target) this.controller.moveRow(gesture.id, target.index, { source: 'pointer' });
    else if (!gesture.dragging && hit?.row?.nodeId === gesture.id && hit.part === gesture.part) {
      if (gesture.part === 'rowUp') this.controller.moveRowBy(gesture.id, -1, { source: 'button' });
      if (gesture.part === 'rowDown') this.controller.moveRowBy(gesture.id, 1, { source: 'button' });
    }
  };

  onCancel = event => { if (this.gesture?.pointerId === event.pointerId) this.cancel(); };
  onKey = event => {
    if (event.key === 'Escape' && this.gesture) {
      this.cancel();
      event.preventDefault();
    }
  };

  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  updateTarget() {
    const gesture = this.gesture;
    this.controller.setRowDrop(gesture ? this.controller.getRowDropTarget(gesture.id, gesture.point.x, gesture.point.y) : null);
  }

  scheduleScroll() {
    if (this.frame !== null || !this.gesture?.dragging) return;
    const viewport = this.controller.viewport;
    if (this.gesture.point.x < 0 || this.gesture.point.x > viewport.viewportWidth || this.gesture.point.y < 0 || this.gesture.point.y > viewport.viewportHeight) return;
    const y = this.gesture.point.y - viewport.renderInsetY;
    const top = viewport.headerHeight;
    const bottom = top + viewport.rowViewportHeight;
    const delta = y < top + 24 ? -10 : y > bottom - 24 ? 10 : 0;
    if (!delta) return;
    const schedule = this.view.requestAnimationFrame?.bind(this.view) ?? (callback => setTimeout(callback, 16));
    this.frame = schedule(() => {
      this.frame = null;
      if (!this.gesture?.dragging) return;
      const previous = viewport.scrollY;
      this.controller.scrollBy(0, delta);
      this.updateTarget();
      if (viewport.scrollY !== previous) this.scheduleScroll();
    });
  }

  emitDrag(type, originalEvent) {
    const gesture = this.gesture;
    if (gesture) this.controller.events.emit(type, { nodeId: gesture.id, payload: gesture.payload,
      label: this.controller.model.index.getNode(gesture.id)?.label ?? gesture.id, originalEvent });
  }

  cancel = (notify = true) => {
    const gesture = this.gesture;
    if (gesture?.dragging) this.suppressClick = true;
    if (notify && gesture?.dragging && gesture.payload != null) this.emitDrag('rowdragcancel');
    this.gesture = null;
    if (this.frame !== null) (this.view.cancelAnimationFrame?.bind(this.view) ?? clearTimeout)(this.frame);
    this.frame = null;
    if (gesture && this.canvas.hasPointerCapture?.(gesture.pointerId)) this.canvas.releasePointerCapture(gesture.pointerId);
    this.canvas.style.cursor = '';
    this.controller.setRowDrop(null);
  };

  destroy() {
    this.cancel();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('keydown', this.onKey);
    this.canvas.removeEventListener('lostpointercapture', this.onCancel);
    this.view.removeEventListener('pointermove', this.onMove);
    this.view.removeEventListener('pointerup', this.onUp);
    this.view.removeEventListener('pointercancel', this.onCancel);
    this.view.removeEventListener('blur', this.cancel);
    this.canvas.style.touchAction = this.previousTouchAction;
    for (const stop of this.stops) stop();
    this.status?.remove();
  }
}
