export class TreeViewInputController {
  /**
   * @param {{
   *   controller: import('../tree-view-controller.js').TreeViewController,
   *   cellEditor?: import('../inspector/cell-editor-manager.js').CellEditorManager | null
   * }} options
   */
  constructor(options) {
    if (!options?.controller) throw new TypeError('TreeViewInputController requires a TreeViewController');
    if (!options.controller.canvas) throw new Error('TreeViewInputController requires an initialized TreeViewController canvas');
    this.controller = options.controller;
    this.canvas = options.controller.canvas;
    this.hoveredId = null;
    this.resizeDrag = null;
    this.cellEditor = options.cellEditor ?? null;
    this.canvas.tabIndex = 0;

    this.canvas.addEventListener('wheel', this.#onWheel, { passive: false });
    this.canvas.addEventListener('mousedown', this.#onMouseDown);
    this.canvas.addEventListener('mousemove', this.#onMouseMove);
    window.addEventListener('mouseup', this.#onMouseUp);
    this.canvas.addEventListener('mouseleave', this.#onMouseLeave);
    this.canvas.addEventListener('click', this.#onClick);
    this.canvas.addEventListener('dblclick', this.#onDoubleClick);
    this.canvas.addEventListener('keydown', this.#onKeyDown);
  }

  destroy() {
    this.canvas.removeEventListener('wheel', this.#onWheel);
    this.canvas.removeEventListener('mousedown', this.#onMouseDown);
    this.canvas.removeEventListener('mousemove', this.#onMouseMove);
    window.removeEventListener('mouseup', this.#onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.#onMouseLeave);
    this.canvas.removeEventListener('click', this.#onClick);
    this.canvas.removeEventListener('dblclick', this.#onDoubleClick);
    this.canvas.removeEventListener('keydown', this.#onKeyDown);
  }

  #onWheel = (event) => {
    event.preventDefault();
    this.cellEditor?.close?.();
    this.controller.scrollBy(event.shiftKey ? event.deltaY : event.deltaX, event.deltaY);
  };

  #onMouseMove = (event) => {
    if (this.resizeDrag) {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const nextWidth = this.resizeDrag.startWidth + (clientX - this.resizeDrag.startX);
      this.controller.resizeColumn(this.resizeDrag.columnId, nextWidth);
      event.preventDefault();
      return;
    }
    const hit = this.#hitTest(event);
    this.canvas.style.cursor = cursorForHit(hit);
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
    this.canvas.focus();
    const hit = this.#hitTest(event);
    if (!hit) return;
    if (hit.area === 'header') {
      if (hit.part === 'filter' && this.cellEditor?.handleHeaderClick(event, hit)) return;
      if (!this.resizeDrag && hit.part === 'label' && hit.column) this.controller.sortBy(hit.column.id);
      return;
    }
    if (hit.part === 'chevron' && hit.row.hasChildren) {
      this.controller.toggle(hit.row.nodeId);
      return;
    }
    if (this.cellEditor?.handleClick(event, hit)) return;
    this.controller.clickNode(hit.row.nodeId, {
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      multi: this.canvas.dataset.multi === 'true',
    });
  };

  #onDoubleClick = (event) => {
    const hit = this.#hitTest(event);
    if (hit?.area === 'row') this.controller.doubleClickNode(hit.row.nodeId, event);
  };

  #onMouseDown = (event) => {
    const hit = this.#hitTest(event);
    this.controller.setActiveHit(hit);
    if (this.cellEditor?.handlePointerDown(event, hit)) {
      event.preventDefault();
      return;
    }
    if (hit?.area !== 'header' || hit.part !== 'resize' || !hit.column) return;
    const rect = this.canvas.getBoundingClientRect();
    this.resizeDrag = {
      columnId: hit.column.id,
      startX: event.clientX - rect.left,
      startWidth: hit.column.width,
    };
    this.canvas.style.cursor = 'col-resize';
    event.preventDefault();
  };

  #onMouseUp = () => {
    this.resizeDrag = null;
    this.canvas.style.cursor = '';
    this.controller.setActiveHit(null);
  };

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

function cursorForHit(hit) {
  if (hit?.area === 'header' && hit.part === 'resize') return 'col-resize';
  if (hit?.area === 'header' && hit.part === 'filter') return 'text';
  if (hit?.area !== 'row') return '';
  if (hit.part === 'button' || hit.part === 'checkbox' || hit.part === 'arrayAdd' || hit.part === 'arrayRemove' || hit.part === 'chevron') return 'pointer';
  if (hit.part === 'editor' || hit.part === 'number') return 'text';
  if (hit.part === 'range') return 'ew-resize';
  return '';
}

function hitKey(hit) {
  if (!hit?.row || !hit.column) return null;
  return `${hit.row.nodeId}:${hit.column.id}:${hit.part}`;
}
