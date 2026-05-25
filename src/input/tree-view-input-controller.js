export class TreeViewInputController {
  /**
   * @param {{
   *   canvas: HTMLCanvasElement,
   *   viewport: import('../core/tree-view-viewport.js').TreeViewViewport,
   *   rowModel: import('../core/visible-row-model.js').VisibleRowModel,
   *   expansion: import('../core/tree-expansion-manager.js').TreeExpansionManager,
   *   selection: import('../core/selection-manager.js').TreeSelectionManager,
   *   controller?: import('../tree-view-controller.js').TreeViewController,
   *   onRowsChanged?: () => void,
   *   onSelectionChanged?: () => void,
   *   onHoverChanged?: (id: string | null) => void
   * }} options
   */
  constructor(options) {
    Object.assign(this, options);
    this.anchorRowIndex = null;
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
    if (this.controller) {
      this.controller.scrollBy(event.shiftKey ? event.deltaY : event.deltaX, event.deltaY);
      return;
    }
    this.viewport.scrollBy(event.shiftKey ? event.deltaY : event.deltaX, event.deltaY);
  };

  #onMouseMove = (event) => {
    if (this.resizeDrag) {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const nextWidth = this.resizeDrag.startWidth + (clientX - this.resizeDrag.startX);
      this.controller?.resizeColumn(this.resizeDrag.columnId, nextWidth);
      event.preventDefault();
      return;
    }
    const hit = this.#hitTest(event);
    this.canvas.style.cursor = hit?.area === 'header' && hit.part === 'resize' ? 'col-resize' : '';
    const id = hit?.row?.nodeId ?? null;
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.controller?.setHover(id);
    this.onHoverChanged?.(id);
  };

  #onMouseLeave = () => {
    if (!this.resizeDrag) this.canvas.style.cursor = '';
    this.hoveredId = null;
    this.controller?.setHover(null);
    this.onHoverChanged?.(null);
  };

  #onClick = (event) => {
    this.canvas.focus();
    const hit = this.#hitTest(event);
    if (!hit) return;
    if (hit.area === 'header') {
      if (hit.part === 'filter' && this.cellEditor?.handleHeaderClick(event, hit)) return;
      if (!this.resizeDrag && hit.part === 'label' && hit.column) this.controller?.sortBy(hit.column.id);
      return;
    }
    if (hit.part === 'chevron' && hit.row.hasChildren) {
      if (this.controller) {
        this.controller.toggle(hit.row.nodeId);
        this.onRowsChanged?.();
        return;
      }
      this.expansion.toggle(hit.row.nodeId);
      this.rowModel.rebuild();
      this.viewport.setContentSize(this.rowModel.contentWidth, this.rowModel.contentHeight);
      this.onRowsChanged?.();
      return;
    }
    if (this.cellEditor?.handleClick(event, hit)) return;
    if (this.controller) {
      this.controller.clickNode(hit.row.nodeId, {
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        multi: this.canvas.dataset.multi === 'true',
      });
      this.onSelectionChanged?.();
      return;
    }
    this.#selectRow(hit.row.rowIndex, event);
  };

  #onDoubleClick = (event) => {
    const hit = this.#hitTest(event);
    if (hit?.area === 'row') this.controller?.doubleClickNode(hit.row.nodeId, event);
  };

  #onMouseDown = (event) => {
    const hit = this.#hitTest(event);
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
  };

  #onKeyDown = (event) => {
    if (this.controller?.handleKey(event)) {
      event.preventDefault();
      this.onSelectionChanged?.();
      return;
    }
    if (!this.rowModel.rows.length) return;
    const currentRow = this.#focusedRowIndex();
    let target = currentRow;
    if (event.key === 'ArrowDown') target = Math.min(this.rowModel.rows.length - 1, currentRow + 1);
    else if (event.key === 'ArrowUp') target = Math.max(0, currentRow - 1);
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = this.rowModel.rows.length - 1;
    else if (event.key === 'ArrowRight') {
      const row = this.rowModel.getRow(currentRow);
      if (row?.hasChildren && !row.expanded) this.#toggleAndRebuild(row.nodeId);
      else if (row?.expanded) target = Math.min(this.rowModel.rows.length - 1, currentRow + 1);
    } else if (event.key === 'ArrowLeft') {
      const row = this.rowModel.getRow(currentRow);
      if (row?.expanded) this.#toggleAndRebuild(row.nodeId);
      else {
        const node = row ? this.rowModel.model.index.getNode(row.nodeId) : null;
        const parentRow = node?.parentId ? this.rowModel.getRowById(node.parentId) : null;
        if (parentRow) target = parentRow.rowIndex;
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      const row = this.rowModel.getRow(currentRow);
      if (row) this.selection.toggle(row.nodeId);
      this.onSelectionChanged?.();
      event.preventDefault();
      return;
    } else return;

    const row = this.rowModel.getRow(target);
    if (row) {
      this.selection.select(row.nodeId);
      this.anchorRowIndex = target;
      this.viewport.scrollRowIntoView(target);
      this.onSelectionChanged?.();
    }
    event.preventDefault();
  };

  #selectRow(rowIndex, event) {
    const row = this.rowModel.getRow(rowIndex);
    if (!row) return;
    if (event.shiftKey && this.anchorRowIndex !== null) {
      this.selection.selected.clear();
      const start = Math.min(this.anchorRowIndex, rowIndex);
      const end = Math.max(this.anchorRowIndex, rowIndex);
      for (let i = start; i <= end; i++) this.selection.selected.add(this.rowModel.rows[i].nodeId);
      this.selection.focused = row.nodeId;
      this.selection.dispatchEvent(new Event('change'));
    } else if (event.ctrlKey || event.metaKey || this.canvas.dataset.multi === 'true') {
      this.selection.toggle(row.nodeId);
      this.anchorRowIndex = rowIndex;
    } else {
      this.selection.select(row.nodeId);
      this.anchorRowIndex = rowIndex;
    }
    this.onSelectionChanged?.();
  }

  #focusedRowIndex() {
    if (this.selection.focused) {
      const row = this.rowModel.getRowById(this.selection.focused);
      if (row) return row.rowIndex;
    }
    return Math.max(0, Math.floor(this.viewport.scrollY / this.rowModel.rowHeight));
  }

  #toggleAndRebuild(id) {
    this.expansion.toggle(id);
    this.rowModel.rebuild();
    this.viewport.setContentSize(this.rowModel.contentWidth, this.rowModel.contentHeight);
    this.onRowsChanged?.();
  }

  #hitTest(event) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    if (this.controller) return this.controller.hitTest(clientX, clientY);
    const x = clientX + this.viewport.scrollX;
    const y = clientY - (this.viewport.headerHeight ?? 0) + this.viewport.scrollY;
    if (clientY < (this.viewport.headerHeight ?? 0)) return { area: 'header', part: 'header', x, y: clientY };
    const rowIndex = Math.floor(y / this.rowModel.rowHeight);
    const row = this.rowModel.getRow(rowIndex);
    if (!row) return null;
    const rowX = row.depth * this.rowModel.indentWidth;
    const chevronLeft = rowX + 4;
    const chevronRight = chevronLeft + 18;
    const part = x >= chevronLeft && x <= chevronRight ? 'chevron' : x <= rowX + 42 ? 'icon' : 'body';
    return { area: 'row', row, x, y, part };
  }
}
