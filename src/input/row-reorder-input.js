let nextStatusId = 0;

/**
 * Pointer interaction for the optional row-order column; persistence belongs to the host.
 */
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
    this.stops = ['filterchange', 'sortchange', 'rowreorderchange'].map((type) =>
      controller.on(type, () => {
        this.cancel();
        this.syncMode();
      })
    );
    this.stops.push(
      controller.on('datachange', () => {
        if (this.gesture && !controller.model.index.getNode(this.gesture.id)) this.cancel();
      })
    );
    this.stops.push(
      controller.on('rowreorder', (event) => {
        if (!this.status) return;
        const { nodeId, toIndex, siblingOrder } = event.detail;
        const label = controller.model.index.getNode(nodeId)?.label ?? nodeId;
        this.status.textContent = `${label}: position ${toIndex + 1} of ${siblingOrder.length}`;
      })
    );
    const doc = this.canvas.ownerDocument;
    if (doc?.createElement && this.canvas.parentElement) {
      this.status = doc.createElement('span');
      this.status.id = `vtc-row-order-status-${nextStatusId++}`;
      this.status.setAttribute('aria-live', 'polite');
      Object.assign(this.status.style, {
        position: 'absolute',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clipPath: 'inset(50%)'
      });
      this.canvas.parentElement.appendChild(this.status);
    }
    if (doc?.createElement && doc.body) {
      this.dragBadge = doc.createElement('span');
      this.dragBadge.className = 'vtc-row-drag-badge';
      this.dragBadge.hidden = true;
      this.dragBadge.setAttribute('aria-hidden', 'true');
      Object.assign(this.dragBadge.style, {
        position: 'fixed',
        zIndex: '2147483647',
        pointerEvents: 'none',
        minWidth: '20px',
        height: '20px',
        padding: '0 6px',
        boxSizing: 'border-box',
        border: '1px solid rgba(255, 255, 255, 0.35)',
        borderRadius: '10px',
        background: '#1f2937',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        font: '600 12px/18px system-ui, sans-serif',
        textAlign: 'center'
      });
      doc.body.appendChild(this.dragBadge);
    }
    this.syncMode();
  }

  syncMode() {
    this.canvas.style.touchAction =
      this.controller.canReorderRows() || this.controller.rowDrag
        ? 'none'
        : this.previousTouchAction;
  }

  onDown = (event) => {
    if (event.button !== 0 || event.isPrimary === false || this.gesture) return;
    this.suppressClick = false;
    const point = this.point(event);
    const hit = this.controller.hitTest(point.x, point.y);
    if (!hit?.row) return;
    const node = this.controller.model.index.getNode(hit.row.nodeId);
    const sourcePayload =
      this.controller.rowDrag?.(node, this.controller.model.dynamicState.get(node.id) ?? {}) ??
      null;
    const orderPart = ['rowDrag', 'rowUp', 'rowDown'].includes(hit.part);
    if (orderPart && node.reorderable === false) return;
    if (
      orderPart
        ? !this.controller.canReorderRows() && !(sourcePayload != null && hit.part === 'rowDrag')
        : sourcePayload == null || !['label', 'row', 'icon', 'cell'].includes(hit.part)
    )
      return;
    const items =
      sourcePayload != null && (!orderPart || hit.part === 'rowDrag')
        ? this.resolveDragItems(node, sourcePayload)
        : [];
    this.canvas.focus({
      preventScroll: true
    });
    this.controller.cellEditor?.close?.();
    this.controller.focusedId = hit.row.nodeId;
    this.gesture = {
      id: hit.row.nodeId,
      part: orderPart ? hit.part : 'rowDrag',
      payload: sourcePayload,
      items,
      sourceSelected: this.controller.selection.selected.has(hit.row.nodeId),
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      point,
      dragging: false
    };
    this.canvas.setPointerCapture?.(event.pointerId);
    event.stopPropagation();
    if (orderPart) event.preventDefault();
  };

  onMove = (event) => {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.point = this.point(event);
    if (gesture.part !== 'rowDrag') return;
    if (
      !gesture.dragging &&
      Math.hypot(gesture.point.x - gesture.startX, gesture.point.y - gesture.startY) < 5
    )
      return;
    if (!gesture.dragging && gesture.payload != null) {
      if (!gesture.sourceSelected) this.controller.setSelection([gesture.id]);
      this.updateDragBadge(event);
      this.emitDrag('rowdragstart', event);
    }
    gesture.dragging = true;
    if (gesture.payload != null) {
      this.updateDragBadge(event);
      this.emitDrag('rowdragmove', event);
    }
    this.canvas.style.cursor = 'grabbing';
    this.updateTarget();
    this.scheduleScroll();
    event.preventDefault();
  };

  onUp = (event) => {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.point = this.point(event);
    const target = gesture.dragging
      ? this.controller.getRowDropTarget(gesture.id, gesture.point.x, gesture.point.y)
      : null;
    const hit = this.controller.hitTest(gesture.point.x, gesture.point.y);
    if (gesture.dragging && gesture.payload != null) this.emitDrag('rowdragend', event);
    this.suppressClick = gesture.dragging;
    this.cancel(false);
    if (target)
      this.controller.moveRow(gesture.id, target.index, {
        source: 'pointer'
      });
    else if (!gesture.dragging && hit?.row?.nodeId === gesture.id && hit.part === gesture.part) {
      if (gesture.part === 'rowUp')
        this.controller.moveRowBy(gesture.id, -1, {
          source: 'button'
        });
      if (gesture.part === 'rowDown')
        this.controller.moveRowBy(gesture.id, 1, {
          source: 'button'
        });
    }
  };

  onCancel = (event) => {
    if (this.gesture?.pointerId === event.pointerId) this.cancel();
  };
  onKey = (event) => {
    if (event.key === 'Escape' && this.gesture) {
      this.cancel();
      event.preventDefault();
    }
  };

  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  updateTarget() {
    const gesture = this.gesture;
    this.controller.setRowDrop(
      gesture
        ? this.controller.getRowDropTarget(gesture.id, gesture.point.x, gesture.point.y)
        : null
    );
  }

  scheduleScroll() {
    if (this.frame !== null || !this.gesture?.dragging) return;
    const viewport = this.controller.viewport;
    if (
      this.gesture.point.x < 0 ||
      this.gesture.point.x > viewport.viewportWidth ||
      this.gesture.point.y < 0 ||
      this.gesture.point.y > viewport.viewportHeight
    )
      return;
    const y = this.gesture.point.y - viewport.renderInsetY;
    const top = viewport.headerHeight;
    const bottom = top + viewport.rowViewportHeight;
    const delta = y < top + 24 ? -10 : y > bottom - 24 ? 10 : 0;
    if (!delta) return;
    const schedule =
      this.view.requestAnimationFrame?.bind(this.view) ?? ((callback) => setTimeout(callback, 16));
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
    if (gesture) {
      const detail = {
        nodeId: gesture.id,
        payload: gesture.payload,
        label: this.controller.model.index.getNode(gesture.id)?.label ?? gesture.id,
        items: gesture.items,
        nodeIds: gesture.items.map((item) => item.nodeId),
        count: gesture.items.length
      };
      if (originalEvent) detail.originalEvent = originalEvent;
      this.controller.events.emit(type, detail);
    }
  }

  resolveDragItems(source, sourcePayload) {
    const selectedIds = this.controller.getSelection();
    const ids = selectedIds.includes(source.id) ? selectedIds : [source.id];
    const items = [];
    for (const id of ids) {
      const node = this.controller.model.index.getNode(id);
      if (!node) continue;
      const payload =
        id === source.id
          ? sourcePayload
          : (this.controller.rowDrag?.(
              node,
              this.controller.model.dynamicState.get(node.id) ?? {}
            ) ?? null);
      if (payload == null) continue;
      items.push({
        nodeId: id,
        payload,
        label: node.label ?? id
      });
    }
    return items;
  }

  updateDragBadge(event) {
    const count = this.gesture?.items.length ?? 0;
    if (!this.dragBadge || count <= 1) return;
    const colors = this.controller.themeManager.get().colors;
    this.dragBadge.textContent = `×${count}`;
    this.dragBadge.style.background = colors.badgeFill;
    this.dragBadge.style.color = colors.badgeText;
    this.dragBadge.style.borderColor = colors.borderStrong;
    this.dragBadge.style.boxShadow = `0 2px 8px ${colors.shadow}`;
    this.dragBadge.hidden = false;
    this.dragBadge.style.left = `${event.clientX + 12}px`;
    this.dragBadge.style.top = `${event.clientY + 12}px`;
    if (this.status) this.status.textContent = `${count} rows dragging`;
  }

  cancel = (notify = true) => {
    const gesture = this.gesture;
    if (gesture?.dragging) this.suppressClick = true;
    if (notify && gesture?.dragging && gesture.payload != null) this.emitDrag('rowdragcancel');
    this.gesture = null;
    if (this.frame !== null)
      (this.view.cancelAnimationFrame?.bind(this.view) ?? clearTimeout)(this.frame);
    this.frame = null;
    if (gesture && this.canvas.hasPointerCapture?.(gesture.pointerId))
      this.canvas.releasePointerCapture(gesture.pointerId);
    this.canvas.style.cursor = '';
    if (this.dragBadge) this.dragBadge.hidden = true;
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
    this.dragBadge?.remove();
  }

}
