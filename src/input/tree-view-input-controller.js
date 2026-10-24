export class TreeViewInputController {

  #wheelTargets;

  /**
   * @param {{
   *   controller: import('../tree-view-controller.js').TreeViewController,
   *   cellEditor?: import('../inspector/cell-editor-manager.js').CellEditorManager | null
   * }} options
   */
  constructor(options) {
    if (!options?.controller)
      throw new TypeError('TreeViewInputController requires a TreeViewController');
    if (!options.controller.canvas)
      throw new Error('TreeViewInputController requires an initialized TreeViewController canvas');
    this.controller = options.controller;
    this.canvas = options.controller.canvas;
    this.hoveredId = null;
    this.resizeDrag = null;
    this.selectionDrag = null;
    this.selectionFrame = null;
    this.suppressSelectionClick = false;
    this.cellEditor = options.cellEditor ?? null;
    this.view = this.canvas.ownerDocument.defaultView ?? window;
    this.canvas.tabIndex = 0;

    this.#wheelTargets = [this.canvas, this.controller.actionOverlay?.element].filter(Boolean);
    for (const target of this.#wheelTargets)
      target.addEventListener('wheel', this.#onWheel, { passive: false });
    this.canvas.addEventListener('mousedown', this.#onMouseDown);
    this.canvas.addEventListener('mousemove', this.#onMouseMove);
    this.view.addEventListener('mouseup', this.#onMouseUp);
    this.canvas.addEventListener('mouseleave', this.#onMouseLeave);
    this.canvas.addEventListener('click', this.#onClick);
    this.canvas.addEventListener('contextmenu', this.#onContextMenu);
    this.canvas.addEventListener('dblclick', this.#onDoubleClick);
    this.canvas.addEventListener('keydown', this.#onKeyDown);
  }

  destroy() {
    for (const target of this.#wheelTargets) target.removeEventListener('wheel', this.#onWheel);
    this.canvas.removeEventListener('mousedown', this.#onMouseDown);
    this.canvas.removeEventListener('mousemove', this.#onMouseMove);
    this.view.removeEventListener('mouseup', this.#onMouseUp);
    this.#endSelectionDrag();
    this.canvas.removeEventListener('mouseleave', this.#onMouseLeave);
    this.canvas.removeEventListener('click', this.#onClick);
    this.canvas.removeEventListener('contextmenu', this.#onContextMenu);
    this.canvas.removeEventListener('dblclick', this.#onDoubleClick);
    this.canvas.removeEventListener('keydown', this.#onKeyDown);
  }

  #onWheel = (event) => {
    this.cellEditor?.close?.();
    const viewport = this.controller.viewport;
    const { scrollX, scrollY } = viewport;
    const deltaX = event.shiftKey ? event.deltaY : event.deltaX;
    this.controller.scrollBy(deltaX, event.deltaY);
    const moved =
      viewport.scrollX !== scrollX || viewport.scrollY !== scrollY;
    const hasScrollableAxis =
      (deltaX !== 0 && viewport.contentWidth > viewport.contentViewportWidth) ||
      (event.deltaY !== 0 && viewport.contentHeight > viewport.rowViewportHeight);
    if (hasScrollableAxis && (!this.controller.scrollChaining || moved))
      event.preventDefault();
  };

  #onMouseMove = (event) => {
    if (this.selectionDrag) return;
    if (this.controller.rowReorderInput?.gesture) return;
    if (this.resizeDrag) {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const nextWidth = this.resizeDrag.startWidth + (clientX - this.resizeDrag.startX);
      this.controller.resizeColumn(this.resizeDrag.columnId, nextWidth);
      event.preventDefault();
      return;
    }
    const hit = this.#hitTest(event);
    this.canvas.style.cursor = cursorForHit(hit, this.controller);
    const id = hit?.row?.nodeId ?? null;
    const key = hitKey(hit);
    if (id === this.hoveredId && key === this.hoveredHitKey) return;
    this.hoveredId = id;
    this.hoveredHitKey = key;
    this.controller.setHoverHit(hit);
  };

  #onMouseLeave = () => {
    if (!this.resizeDrag) this.canvas.style.cursor = '';
    this.hoveredId = null;
    this.hoveredHitKey = null;
    this.controller.setActiveHit(null);
    this.controller.setHoverHit(null);
  };

  #onClick = (event) => {
    if (this.suppressSelectionClick) {
      this.suppressSelectionClick = false;
      event.preventDefault();
      return;
    }
    if (this.controller.rowReorderInput?.suppressClick) {
      this.controller.rowReorderInput.suppressClick = false;
      event.preventDefault();
      return;
    }
    const hit = this.#hitTest(event);
    if (!hit) return;
    if (['rowDrag', 'rowUp', 'rowDown'].includes(hit.part)) return;
    if (hit.area === 'header') {
      if (hit.part === 'filter' && this.cellEditor?.handleHeaderClick(event, hit)) return;
      if (!this.resizeDrag && hit.part === 'label' && hit.column)
        this.controller.sortBy(hit.column.id);
      return;
    }
    if (hit.part === 'chevron' && hit.row.hasChildren) {
      this.controller.toggle(hit.row.nodeId);
      return;
    }
    if (this.cellEditor?.handleClick(event, hit)) return;
    this.canvas.focus({
      preventScroll: true
    });
    this.controller.clickNode(hit.row.nodeId, {
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      part: hit.part,
      columnId: hit.column?.id ?? null
    });
  };

  #onDoubleClick = (event) => {
    const hit = this.#hitTest(event);
    if (hit?.area !== 'row') return;
    if ([
      'arrayAdd', 'arrayRemove', 'button', 'checkbox', 'editor', 'range',
      'number', 'rowDrag', 'rowUp', 'rowDown', 'chevron'
    ].includes(hit.part)) return;
    this.controller.doubleClickNode(hit.row.nodeId, event);
  };

  #onContextMenu = (event) => {
    const hit = this.#hitTest(event);
    if (hit?.area !== 'row') return;
    this.controller.contextMenuNode(hit.row.nodeId, {
      part: hit.part,
      columnId: hit.column?.id ?? null,
      originalEvent: event
    });
  };

  #onMouseDown = (event) => {
    this.suppressSelectionClick = false;
    if (event.button !== 0) return;
    if (this.controller.rowReorderInput?.gesture) return;
    const hit = this.#hitTest(event);
    if (['rowDrag', 'rowUp', 'rowDown'].includes(hit?.part)) return;
    this.controller.setActiveHit(hit);
    if (this.cellEditor?.handlePointerDown(event, hit)) {
      event.preventDefault();
      return;
    }
    if (hit?.area === 'header' && hit.part === 'resize' && hit.column) {
      const rect = this.canvas.getBoundingClientRect();
      this.resizeDrag = {
        columnId: hit.column.id,
        startX: event.clientX - rect.left,
        startWidth: hit.column.width
      };
      this.canvas.style.cursor = 'col-resize';
      event.preventDefault();
      return;
    }
    if (hit?.area !== 'row' || !['label', 'row', 'icon', 'cell'].includes(hit.part)) return;
    if (!this.controller.multiSelect || !event.shiftKey) return;
    const startIndex = hit.row.rowIndex;
    const anchor = event.shiftKey && this.controller.anchorRowIndex !== null
      ? this.controller.anchorRowIndex : startIndex;
    this.selectionDrag = {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      anchor,
      additive: event.ctrlKey || event.metaKey,
      previous: this.controller.getSelection(),
      endIndex: null,
      active: false
    };
    this.view.addEventListener('mousemove', this.#onSelectionMove);
  };

  #onMouseUp = () => {
    if (this.selectionDrag?.active) this.suppressSelectionClick = true;
    this.#endSelectionDrag();
    this.resizeDrag = null;
    this.canvas.style.cursor = '';
    this.controller.setActiveHit(null);
  };

  #onSelectionMove = (event) => {
    if (!this.selectionDrag || !(event.buttons & 1)) return;
    this.selectionDrag.x = event.clientX;
    this.selectionDrag.y = event.clientY;
    this.#updateSelectionDrag();
    if (this.selectionDrag.active) event.preventDefault();
  };

  #updateSelectionDrag() {
    const drag = this.selectionDrag;
    if (!drag) return;
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 5) return;
    drag.active = true;
    const rect = this.canvas.getBoundingClientRect();
    const viewport = this.controller.viewport;
    const rows = this.controller.rowModel.rows;
    if (!rows.length) return;
    const contentY = drag.y - rect.top - viewport.renderInsetY - viewport.headerHeight + viewport.scrollY;
    const endIndex = Math.max(0, Math.min(rows.length - 1, Math.floor(contentY / this.controller.rowModel.rowHeight)));
    if (endIndex !== drag.endIndex) {
      drag.endIndex = endIndex;
      const selected = drag.additive ? new Set(drag.previous) : new Set();
      for (let index = Math.min(drag.anchor, endIndex); index <= Math.max(drag.anchor, endIndex); index++)
        selected.add(rows[index].nodeId);
      this.controller.setSelection([...selected]);
      this.controller.anchorRowIndex = drag.anchor;
    }
    this.#scheduleSelectionScroll();
  }

  #scheduleSelectionScroll() {
    if (this.selectionFrame !== null || !this.selectionDrag?.active) return;
    const rect = this.canvas.getBoundingClientRect();
    const viewport = this.controller.viewport;
    const y = this.selectionDrag.y - rect.top - viewport.renderInsetY;
    const top = viewport.headerHeight;
    const bottom = top + viewport.rowViewportHeight;
    const delta = y < top + 24 ? -12 : y > bottom - 24 ? 12 : 0;
    if (!delta) return;
    this.selectionFrame = this.view.requestAnimationFrame(() => {
      this.selectionFrame = null;
      if (!this.selectionDrag?.active) return;
      const previous = viewport.scrollY;
      this.controller.scrollBy(0, delta);
      if (viewport.scrollY !== previous) this.#updateSelectionDrag();
    });
  }

  #endSelectionDrag() {
    this.selectionDrag = null;
    this.view.removeEventListener('mousemove', this.#onSelectionMove);
    if (this.selectionFrame !== null) this.view.cancelAnimationFrame(this.selectionFrame);
    this.selectionFrame = null;
  }

  #onKeyDown = (event) => {
    if (this.controller.handleKey(event)) {
      event.preventDefault();
    }
  };

  #hitTest(event) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    return this.controller.hitTest(clientX, clientY);
  }

}

function cursorForHit(hit, controller) {
  if (hit?.part === 'rowDrag') return 'grab';
  if (hit?.part === 'rowUp' || hit?.part === 'rowDown') return 'pointer';
  if (hit?.area === 'header' && hit.part === 'resize') return 'col-resize';
  if (hit?.area === 'header' && hit.part === 'filter') return 'text';
  if (hit?.area !== 'row') return '';
  const data = controller.model.nodes[hit.row.nodeIndex]?.data;
  const editable = controller.editable && !data?.readonly && !data?.disabled;
  if (hit.part === 'chevron') return 'pointer';
  if (hit.part === 'arrayAdd' || hit.part === 'arrayRemove' || hit.part === 'button')
    return controller.editable && !data?.disabled ? 'pointer' : '';
  if (hit.part === 'checkbox') return editable ? 'pointer' : '';
  if (hit.part === 'editor' || hit.part === 'number') return editable ? 'text' : '';
  if (hit.part === 'range') return editable ? 'ew-resize' : '';
  return '';
}

function hitKey(hit) {
  if (!hit?.row || !hit.column) return null;
  return `${hit.row.nodeId}:${hit.column.id}:${hit.part}`;
}
