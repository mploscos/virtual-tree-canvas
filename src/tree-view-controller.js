import {
  EventEmitter,
  IconRegistry,
  PatchBatcher,
  ThemeManager,
  TreeColumnModel,
  TreeExpansionManager,
  TreeModel,
  TreeSearchIndex,
  TreeSelectionManager,
  TreeWorkerClient,
  TreeViewViewport,
  VisibleRowModel,
} from './core/index.js';
import { CellEditorManager } from './inspector/cell-editor-manager.js';
import { formatInspectorValue, getAtPath, inspectorColumns, inspectorPaneColumns, ModelInspectorBuilder, setAtPath } from './inspector/index.js';
import { TreeViewInputController } from './input/tree-view-input-controller.js';
import { TreeRowRenderer } from './renderers/index.js';

export class TreeViewController {
  constructor(options = {}) {
    this.events = new EventEmitter();
    this.model = new TreeModel();
    this.expansion = new TreeExpansionManager(this.model);
    this.rowModel = new VisibleRowModel({
      model: this.model,
      expansion: this.expansion,
      rowHeight: options.rowHeight ?? 28,
      indentWidth: options.indentWidth ?? 18,
    });
    this.viewport = new TreeViewViewport({
      rowHeight: this.rowModel.rowHeight,
      indentWidth: this.rowModel.indentWidth,
      headerHeight: options.headerHeight ?? 28,
    });
    this.viewport.renderInsetX = options.renderInsetX ?? 0;
    this.viewport.renderInsetY = options.renderInsetY ?? 0;
    this.columnModel = new TreeColumnModel(options.columns);
    this.searchIndex = new TreeSearchIndex();
    this.selection = new TreeSelectionManager();
    this.patchBatcher = new PatchBatcher();
    this.themeManager = options.themeManager ?? new ThemeManager();
    this.iconRegistry = options.iconRegistry ?? new IconRegistry();
    this.renderer = options.renderer ?? new TreeRowRenderer({ themeManager: this.themeManager, iconRegistry: this.iconRegistry });
    this.nativeScrollbars = options.nativeScrollbars !== false;
    this.initialExpandDepth = options.initialExpandDepth ?? 1;
    this.searchHighlights = new Set();
    this.filterQuery = '';
    this.hoverId = null;
    this.hoverPart = null;
    this.activeId = null;
    this.activePart = null;
    this.focusedId = null;
    this.anchorRowIndex = null;
    this.lastPatchCount = 0;
    this.lastDirtyNodeCount = 0;
    this.lastRenderedRows = 0;
    this.rebuildCount = 0;
    this.workerClient = null;
    this.workerRevision = 0;
    this.sortValueSnapshot = null;
    this.inspector = null;
    this.inputController = null;
    this.cellEditor = null;
    this.scene = this.createRenderScene();

    if (options.canvas) this.initialize(options.canvas);
    if (options.editable !== false && (options.host || options.editable)) this.attachCellEditor({ host: options.host });
    if (options.canvas && options.input !== false) this.attachInput();
  }

  initialize(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new TypeError('TreeViewController.initialize requires an HTMLCanvasElement');
    }
    this.canvas = canvas;
    this.renderer.initialize(canvas);
    this.renderer.setScene(this.scene);
    this.#resizeToCanvasClientSize();
    this.#observeCanvasSize();
    this.#setupNativeScrollbars();
    return this;
  }

  attachCellEditor(options = {}) {
    if (!this.canvas) throw new Error('TreeViewController.attachCellEditor requires an initialized canvas');
    this.cellEditor?.destroy?.();
    this.cellEditor = new CellEditorManager({
      controller: this,
      host: options.host,
    });
    return this.cellEditor;
  }

  attachInput(options = {}) {
    if (!this.canvas) throw new Error('TreeViewController.attachInput requires an initialized canvas');
    this.inputController?.destroy?.();
    this.inputController = new TreeViewInputController({
      controller: this,
      cellEditor: options.cellEditor ?? this.cellEditor,
    });
    return this.inputController;
  }

  destroy() {
    this.inputController?.destroy?.();
    this.cellEditor?.destroy?.();
    this.disableWorkers();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#nativeScroll?.destroy?.();
    this.#nativeScroll = null;
    this.inputController = null;
    this.cellEditor = null;
    this.canvas = null;
  }

  on(type, listener) {
    return this.events.on(type, listener);
  }

  off(type, listener) {
    this.events.off(type, listener);
  }

  setData(nodes) {
    this.inspector = null;
    if (this.columnModel.columns.length === 1 && this.columnModel.columns[0]?.kind === 'inspectorPane') {
      this.columnModel.setColumns([]);
    }
    this.model.setTree(nodes);
    this.expansion.expandToDepth(this.initialExpandDepth);
    this.searchIndex.rebuild(this.model);
    this.workerClient?.setData(this.model.nodes);
    this.#rebuildRows();
  }

  setModel(model, meta = {}, options = {}) {
    const builder = new ModelInspectorBuilder();
    const presentation = options.presentation ?? options.mode ?? 'table';
    const previousExpanded = new Set(this.model.expanded);
    const shouldPreserveExpansion = Boolean(this.inspector);
    const inspectorOptions = {
      presentation,
      flatRoot: Boolean(options.flatRoot),
      enforceMeta: Boolean(options.enforceMeta),
      filter: Boolean(options.filter),
      markUpdated: options.markUpdated !== false,
    };
    const nodes = builder.build(model, meta, inspectorOptions);
    this.inspector = { model, meta, builder, presentation, options: inspectorOptions };
    this.setColumns(presentation === 'pane' ? inspectorPaneColumns() : inspectorColumns());
    this.model.setTree(nodes);
    if (shouldPreserveExpansion) this.#restoreExpansion(previousExpanded);
    else this.expansion.expandToDepth(this.initialExpandDepth);
    this.searchIndex.rebuild(this.model);
    this.#rebuildRows();
    this.events.emit('modelchange', { model, meta, structural: true });
  }

  updateInspectorValue(nodeId, newValue, editorType = 'unknown') {
    const node = this.model.index.getNode(nodeId);
    if (!node?.data?.inspector || !this.inspector) return false;
    const data = node.data;
    if (data.readonly || data.disabled) return false;
    const oldValue = data.value;
    if (Object.is(oldValue, newValue)) return true;
    setAtPath(this.inspector.model, data.path, newValue);
    data.value = newValue;
    data.valueType = Array.isArray(newValue) ? 'array' : newValue === null ? 'null' : typeof newValue === 'object' ? 'object' : typeof newValue;
    data.valueText = formatInspectorValue(newValue, data.meta);
    if (this.inspector.options.markUpdated !== false) {
      this.setDynamicState([{ id: nodeId, state: { updated: true } }]);
    }
    const detail = { path: data.path, oldValue, newValue, nodeId, editorType };
    this.events.emit('valuechange', detail);
    this.events.emit('modelchange', { model: this.inspector.model, path: data.path, oldValue, newValue, nodeId });
    return true;
  }

  triggerInspectorAction(nodeId) {
    const node = this.model.index.getNode(nodeId);
    if (!node?.data?.inspector) return false;
    const label = node.data.meta?.button ?? node.label;
    this.events.emit('action', { path: node.data.path, label, nodeId });
    return true;
  }

  addInspectorArrayItem(nodeId) {
    const node = this.model.index.getNode(nodeId);
    if (!node?.data?.inspector || node.data.valueType !== 'array' || !this.inspector) return false;
    const array = getAtPath(this.inspector.model, node.data.path);
    if (!Array.isArray(array)) return false;
    const item = createDefaultArrayItem(node.data.meta);
    array.push(item);
    this.#rebuildInspectorModel(node.data.path);
    this.events.emit('modelchange', { model: this.inspector.model, path: node.data.path, structural: true, action: 'array-add', value: item });
    return true;
  }

  removeInspectorArrayItem(nodeId) {
    const node = this.model.index.getNode(nodeId);
    if (!node?.data?.inspector || node.data.valueType !== 'array' || !this.inspector) return false;
    const array = getAtPath(this.inspector.model, node.data.path);
    if (!Array.isArray(array) || !array.length) return false;
    const value = array.pop();
    this.#rebuildInspectorModel(node.data.path);
    this.events.emit('modelchange', { model: this.inspector.model, path: node.data.path, structural: true, action: 'array-remove', value });
    return true;
  }

  enableWorkers(workerUrl) {
    if (this.workerClient) return Promise.resolve(this);
    this.workerClient = new TreeWorkerClient(workerUrl);
    return this.workerClient.setData(this.model.nodes).then(() => this);
  }

  disableWorkers() {
    this.workerClient?.destroy();
    this.workerClient = null;
  }

  setColumns(columns) {
    this.columnModel.setColumns(columns);
    this.#syncContentSize();
    this.events.emit('columnschange', { columns: this.columnModel.columns });
  }

  resizeColumn(columnId, width) {
    if (!this.columnModel.resizeColumn(columnId, width)) return false;
    this.#syncContentSize();
    this.events.emit('columnschange', { columns: this.columnModel.columns });
    return true;
  }

  moveColumn(columnId, targetIndex) {
    if (!this.columnModel.moveColumn(columnId, targetIndex)) return false;
    this.#syncContentSize();
    this.events.emit('columnschange', { columns: this.columnModel.columns });
    return true;
  }

  sortBy(columnId, direction = 'toggle') {
    const column = this.columnModel.getColumn(columnId);
    if (!column || column.sortable === false) return false;
    const current = this.columnModel.sort;
    let nextDirection = direction;
    if (direction === 'toggle') {
      if (current.columnId !== columnId) nextDirection = 'asc';
      else if (current.direction === 'asc') nextDirection = 'desc';
      else if (current.direction === 'desc') nextDirection = null;
      else nextDirection = 'asc';
    }
    if (nextDirection !== 'asc' && nextDirection !== 'desc') {
      this.clearSort();
      return true;
    }
    this.columnModel.setSort(columnId, nextDirection);
    this.sortValueSnapshot = createSortValueSnapshot(column, this.model.nodes, this.model.dynamicState);
    this.rowModel.setSortComparator((a, b) => compareColumnValues(column, a, b, this.model.dynamicState, this.sortValueSnapshot) * (nextDirection === 'desc' ? -1 : 1));
    this.#rebuildRows();
    this.events.emit('sortchange', { columnId, direction: nextDirection });
    return true;
  }

  clearSort() {
    this.columnModel.setSort(null, null);
    this.sortValueSnapshot = null;
    this.rowModel.setSortComparator(null);
    this.#rebuildRows();
    this.events.emit('sortchange', { columnId: null, direction: null });
  }

  setFilter(queryOrPredicate = '') {
    this.filterQuery = typeof queryOrPredicate === 'string' ? queryOrPredicate : '';
    if (typeof queryOrPredicate === 'function') {
      this.rowModel.setFilterPredicate(queryOrPredicate);
    } else {
      const query = queryOrPredicate.trim().toLowerCase();
      this.rowModel.setFilterPredicate(query ? (node, state) => matchesFilter(node, state, this.model.index.pathById.get(node.id) ?? '', query) : null);
    }
    this.#rebuildRows();
    this.events.emit('filterchange', { query: this.filterQuery, visibleRows: this.rowModel.rows.length });
  }

  clearFilter() {
    this.setFilter('');
  }

  async setFilterAsync(query = '') {
    if (!this.workerClient || typeof query !== 'string') {
      this.setFilter(query);
      return this.rowModel.rows;
    }
    const totalStart = now();
    const revision = ++this.workerRevision;
    this.filterQuery = query;
    const normalized = query.trim().toLowerCase();
    this.rowModel.setFilterPredicate(normalized ? (node, state) => matchesFilter(node, state, this.model.index.pathById.get(node.id) ?? '', normalized) : null);
    const workerStart = now();
    const result = await this.workerClient.rebuildRows(this.#workerRowOptions({ filterQuery: query }));
    const workerMs = now() - workerStart;
    if (revision !== this.workerRevision) return this.rowModel.rows;
    this.#applyWorkerRows(result);
    this.events.emit('filterchange', { query: this.filterQuery, visibleRows: this.rowModel.rows.length, worker: true, workerMs, totalMs: now() - totalStart });
    return this.rowModel.rows;
  }

  setDynamicState(patches) {
    this.lastPatchCount = patches.length;
    this.lastDirtyNodeCount = new Set(patches.map((patch) => patch.id)).size;
    this.model.applyDynamicPatches(patches);
    this.renderer.updateDynamicState(patches);
  }

  setTheme(theme) {
    const beforeRowHeight = this.rowModel.rowHeight;
    const beforeIndentWidth = this.rowModel.indentWidth;
    this.themeManager.setTheme(theme);
    const nextTheme = this.themeManager.get();
    this.rowModel.rowHeight = nextTheme.rowHeight;
    this.rowModel.indentWidth = nextTheme.indentWidth;
    this.viewport.rowHeight = nextTheme.rowHeight;
    this.viewport.indentWidth = nextTheme.indentWidth;
    if (beforeRowHeight !== nextTheme.rowHeight || beforeIndentWidth !== nextTheme.indentWidth) {
      this.#rebuildRows();
    }
    this.#nativeScroll?.applyTheme?.(nextTheme);
    this.events.emit('themechange', { theme: nextTheme });
  }

  setLayoutMetrics(options = {}) {
    const rowHeight = options.rowHeight ?? this.rowModel.rowHeight;
    const indentWidth = options.indentWidth ?? this.rowModel.indentWidth;
    const headerHeight = options.headerHeight ?? this.viewport.headerHeight;
    assertPositiveNumber(rowHeight, 'rowHeight');
    assertPositiveNumber(indentWidth, 'indentWidth');
    assertNonNegativeNumber(headerHeight, 'headerHeight');
    const rowsChanged = this.rowModel.rowHeight !== rowHeight || this.rowModel.indentWidth !== indentWidth;
    this.rowModel.rowHeight = rowHeight;
    this.rowModel.indentWidth = indentWidth;
    this.viewport.rowHeight = rowHeight;
    this.viewport.indentWidth = indentWidth;
    this.viewport.headerHeight = headerHeight;
    if (rowsChanged) this.#rebuildRows();
    else this.#syncContentSize();
    this.events.emit('layoutchange', this.getViewportState());
  }

  registerIcon(name, imageOrUrl) {
    return this.iconRegistry.register(name, imageOrUrl);
  }

  expand(nodeId) {
    if (this.filterQuery && this.rowModel.expandFilterBranch(nodeId)) {
      this.#rebuildRows();
      this.events.emit('expand', { nodeId, filter: true });
      return true;
    }
    if (!this.expansion.expand(nodeId)) return false;
    this.#rebuildRows();
    this.events.emit('expand', { nodeId });
    return true;
  }

  collapse(nodeId) {
    const row = this.rowModel.getRowById(nodeId);
    const shouldCollapseFilterBranch = Boolean(this.filterQuery && row?.expanded);
    const changed = this.expansion.collapse(nodeId);
    if (shouldCollapseFilterBranch) this.rowModel.collapseFilterBranch(nodeId);
    if (!changed && !shouldCollapseFilterBranch) return false;
    this.#rebuildRows();
    this.events.emit('collapse', { nodeId, filter: shouldCollapseFilterBranch });
    return true;
  }

  toggle(nodeId) {
    const row = this.rowModel.getRowById(nodeId);
    return (row?.expanded ?? this.expansion.isExpanded(nodeId)) ? this.collapse(nodeId) : this.expand(nodeId);
  }

  expandAll() {
    this.expansion.expandAll();
    this.#rebuildRows();
    this.events.emit('expand', { nodeId: null, all: true });
  }

  collapseAll() {
    this.expansion.collapseAll();
    this.#rebuildRows();
    this.events.emit('collapse', { nodeId: null, all: true });
  }

  search(query, options = {}) {
    for (const id of this.searchHighlights) this.patchBatcher.set(id, { highlighted: false });
    const results = this.searchIndex.search(query, { limit: options.limit ?? 500, fields: options.fields });
    this.searchHighlights = new Set(results);
    const expandedSizeBefore = this.expansion.model.expanded.size;
    for (const id of results) {
      if (options.expand !== false) this.expansion.expandAncestors(id);
      this.patchBatcher.set(id, { highlighted: true });
    }
    if (options.expand !== false && this.expansion.model.expanded.size !== expandedSizeBefore) this.#rebuildRows();
    this.setDynamicState(this.patchBatcher.flush());
    if (results[0] && options.focus !== false) {
      this.scrollToNode(results[0], options.align ?? 'nearest');
      this.focusedId = results[0];
      this.selection.focused = results[0];
      if (options.select) this.setSelection([results[0]]);
      this.events.emit('focuschange', { nodeId: results[0] });
    }
    this.events.emit('searchchange', { query, results, cursor: this.searchIndex.cursor, current: this.searchIndex.currentSearchResult() });
    return results;
  }

  async searchAsync(query, options = {}) {
    if (!this.workerClient) return this.search(query, options);
    const totalStart = now();
    const revision = ++this.workerRevision;
    for (const id of this.searchHighlights) this.patchBatcher.set(id, { highlighted: false });
    const searchStart = now();
    const results = await this.workerClient.search(query, { limit: options.limit ?? 500, fields: options.fields });
    const searchMs = now() - searchStart;
    if (revision !== this.workerRevision) return this.searchIndex.results;
    this.searchIndex.lastQuery = query;
    this.searchIndex.results = results;
    this.searchIndex.cursor = results.length ? 0 : -1;
    this.searchHighlights = new Set(results);
    const expandedSizeBefore = this.expansion.model.expanded.size;
    for (const id of results) {
      if (options.expand !== false) this.expansion.expandAncestors(id);
      this.patchBatcher.set(id, { highlighted: true });
    }
    let rowMs = 0;
    const expansionChanged = options.expand !== false && this.expansion.model.expanded.size !== expandedSizeBefore;
    if (expansionChanged || this.filterQuery) {
      const rowStart = now();
      const rowResult = await this.workerClient.rebuildRows(this.#workerRowOptions({ filterQuery: this.filterQuery }));
      rowMs = now() - rowStart;
      if (revision !== this.workerRevision) return this.searchIndex.results;
      this.#applyWorkerRows(rowResult);
    }
    this.setDynamicState(this.patchBatcher.flush());
    if (results[0] && options.focus !== false) {
      this.scrollToNode(results[0], options.align ?? 'nearest');
      this.focusedId = results[0];
      this.selection.focused = results[0];
      if (options.select) this.setSelection([results[0]]);
      this.events.emit('focuschange', { nodeId: results[0] });
    }
    this.events.emit('searchchange', {
      query,
      results,
      cursor: this.searchIndex.cursor,
      current: this.searchIndex.currentSearchResult(),
      worker: true,
      searchMs,
      rowMs,
      workerMs: searchMs + rowMs,
      totalMs: now() - totalStart,
    });
    return results;
  }

  clearSearch() {
    this.workerRevision++;
    for (const id of this.searchHighlights) this.patchBatcher.set(id, { highlighted: false });
    this.searchHighlights.clear();
    this.searchIndex.clear();
    this.setDynamicState(this.patchBatcher.flush());
    this.events.emit('searchchange', { query: '', results: [], cursor: -1, current: null });
  }

  getSearchState() {
    return {
      query: this.searchIndex.lastQuery,
      results: this.searchIndex.results.slice(),
      cursor: this.searchIndex.cursor,
      current: this.searchIndex.currentSearchResult(),
      count: this.searchIndex.results.length,
    };
  }

  nextSearchResult() {
    const id = this.searchIndex.nextSearchResult();
    if (id) this.focusNode(id, { select: false });
    this.events.emit('searchchange', { query: this.searchIndex.lastQuery, results: this.searchIndex.results.slice(), cursor: this.searchIndex.cursor, current: id });
    return id;
  }

  previousSearchResult() {
    const id = this.searchIndex.previousSearchResult();
    if (id) this.focusNode(id, { select: false });
    this.events.emit('searchchange', { query: this.searchIndex.lastQuery, results: this.searchIndex.results.slice(), cursor: this.searchIndex.cursor, current: id });
    return id;
  }

  focusNode(nodeId, options = {}) {
    if (!nodeId) return false;
    this.expansion.expandAncestors(nodeId);
    this.#rebuildRows();
    if (!this.scrollToNode(nodeId, options.align ?? 'nearest')) return false;
    this.focusedId = nodeId;
    this.selection.focused = nodeId;
    if (options.select) this.setSelection([nodeId]);
    this.events.emit('focuschange', { nodeId });
    return true;
  }

  scrollToNode(nodeId, align = 'nearest') {
    const row = this.rowModel.getRowById(nodeId);
    if (!row) return false;
    this.viewport.scrollRowIntoView(row.rowIndex, align);
    this.events.emit('viewportchange', this.getViewportState());
    return true;
  }

  getSelection() {
    return Array.from(this.selection.selected);
  }

  setSelection(ids) {
    this.selection.selected.clear();
    for (const id of ids) this.selection.selected.add(id);
    this.selection.focused = ids[ids.length - 1] ?? null;
    this.focusedId = this.selection.focused;
    this.anchorRowIndex = this.focusedId ? this.rowModel.getRowById(this.focusedId)?.rowIndex ?? null : null;
    this.#syncSelectionState();
    this.events.emit('selectionchange', { selection: this.getSelection(), focusedId: this.focusedId });
  }

  clearSelection() {
    this.setSelection([]);
  }

  setHover(nodeId) {
    if (this.hoverId === nodeId) return;
    this.hoverId = nodeId;
    this.hoverPart = null;
    this.events.emit('nodehover', { nodeId });
  }

  setHoverHit(hit) {
    const nodeId = hit?.row?.nodeId ?? null;
    const part = hit?.part ?? null;
    if (this.hoverId === nodeId && this.hoverPart === part) return;
    this.hoverId = nodeId;
    this.hoverPart = part;
    this.events.emit('nodehover', { nodeId, part });
  }

  setActiveHit(hit) {
    const nodeId = hit?.row?.nodeId ?? null;
    const part = hit?.part ?? null;
    if (this.activeId === nodeId && this.activePart === part) return;
    this.activeId = nodeId;
    this.activePart = part;
  }

  clickNode(nodeId, event = {}) {
    const row = this.rowModel.getRowById(nodeId);
    if (!row) return;
    this.selectRow(row.rowIndex, event);
    this.events.emit('nodeclick', { nodeId, row, originalEvent: event });
  }

  doubleClickNode(nodeId, event = {}) {
    const row = this.rowModel.getRowById(nodeId);
    if (!row) return;
    if (row.hasChildren) this.toggle(nodeId);
    this.events.emit('nodedblclick', { nodeId, row, originalEvent: event });
  }

  selectRow(rowIndex, event = {}) {
    const row = this.rowModel.getRow(rowIndex);
    if (!row) return false;
    if (event.shiftKey && this.anchorRowIndex !== null) {
      this.selection.selected.clear();
      const start = Math.min(this.anchorRowIndex, rowIndex);
      const end = Math.max(this.anchorRowIndex, rowIndex);
      for (let i = start; i <= end; i++) this.selection.selected.add(this.rowModel.rows[i].nodeId);
    } else if (event.ctrlKey || event.metaKey || event.multi) {
      if (this.selection.selected.has(row.nodeId)) this.selection.selected.delete(row.nodeId);
      else this.selection.selected.add(row.nodeId);
      this.anchorRowIndex = rowIndex;
    } else {
      this.selection.selected.clear();
      this.selection.selected.add(row.nodeId);
      this.anchorRowIndex = rowIndex;
    }
    this.focusedId = row.nodeId;
    this.selection.focused = row.nodeId;
    this.#syncSelectionState();
    this.events.emit('selectionchange', { selection: this.getSelection(), focusedId: this.focusedId });
    this.events.emit('focuschange', { nodeId: this.focusedId });
    return true;
  }

  handleKey(event) {
    if (!this.rowModel.rows.length) return false;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      this.selection.selected.clear();
      for (const row of this.rowModel.rows) this.selection.selected.add(row.nodeId);
      const focusedRow = this.rowModel.getRow(this.#focusedRowIndex());
      this.focusedId = focusedRow?.nodeId ?? this.focusedId;
      this.selection.focused = this.focusedId;
      this.#syncSelectionState();
      this.events.emit('selectionchange', { selection: this.getSelection(), focusedId: this.focusedId });
      return true;
    }
    const currentRow = this.#focusedRowIndex();
    let target = currentRow;
    if (event.key === 'ArrowDown') target = Math.min(this.rowModel.rows.length - 1, currentRow + 1);
    else if (event.key === 'ArrowUp') target = Math.max(0, currentRow - 1);
    else if (event.key === 'PageDown') target = Math.min(this.rowModel.rows.length - 1, currentRow + Math.max(1, Math.floor(this.viewport.rowViewportHeight / this.rowModel.rowHeight) - 1));
    else if (event.key === 'PageUp') target = Math.max(0, currentRow - Math.max(1, Math.floor(this.viewport.rowViewportHeight / this.rowModel.rowHeight) - 1));
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = this.rowModel.rows.length - 1;
    else if (event.key === 'ArrowRight') {
      const row = this.rowModel.getRow(currentRow);
      if (row?.hasChildren && !row.expanded) return this.expand(row.nodeId);
      if (row?.expanded) target = Math.min(this.rowModel.rows.length - 1, currentRow + 1);
    } else if (event.key === 'ArrowLeft') {
      const row = this.rowModel.getRow(currentRow);
      if (row?.expanded) return this.collapse(row.nodeId);
      const node = row ? this.model.index.getNode(row.nodeId) : null;
      const parentRow = node?.parentId ? this.rowModel.getRowById(node.parentId) : null;
      if (parentRow) target = parentRow.rowIndex;
    } else if (event.key === 'Enter' || event.key === ' ') {
      const row = this.rowModel.getRow(currentRow);
      if (row) this.selectRow(row.rowIndex, { ctrlKey: true });
      return true;
    } else return false;

    const row = this.rowModel.getRow(target);
    if (!row) return false;
    this.selectRow(target, { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
    this.viewport.scrollRowIntoView(target, 'nearest');
    this.events.emit('viewportchange', this.getViewportState());
    return true;
  }

  scrollBy(dx, dy) {
    this.viewport.scrollBy(dx, dy);
    this.events.emit('viewportchange', this.getViewportState());
  }

  scrollTo(x, y) {
    this.viewport.scrollTo(x, y);
    this.events.emit('viewportchange', this.getViewportState());
  }

  render(time = performance.now()) {
    this.renderMeasured(time);
  }

  renderMeasured(time = performance.now()) {
    const sceneStart = performance.now();
    this.scene = this.createRenderScene();
    const sceneMs = performance.now() - sceneStart;
    this.renderer.setScene(this.scene);
    const renderStart = performance.now();
    this.renderer.render(this.scene, time);
    const renderMs = performance.now() - renderStart;
    this.lastRenderedRows = this.renderer.renderedRows ?? 0;
    return { scene: this.scene, sceneMs, renderMs, renderedRows: this.lastRenderedRows };
  }

  createRenderScene() {
    const visibleRange = this.rowModel.getVisibleRange(this.viewport, 4);
    return {
      rows: this.rowModel.rows,
      visibleRange,
      viewport: this.viewport,
      columns: this.columnModel.columns,
      theme: this.themeManager.get(),
      nodes: this.model.nodes,
      dynamicState: this.model.dynamicState,
      selection: this.selection.selected,
      hoverNodeId: this.hoverId,
      hoverPart: this.hoverPart,
      activeNodeId: this.activeId,
      activePart: this.activePart,
      focusNodeId: this.focusedId,
      searchMatches: this.searchHighlights,
      sort: this.columnModel.sort,
      sortValues: this.sortValueSnapshot ? Array.from(this.sortValueSnapshot) : null,
      inspectorPaneLabelEnd: this.#computeInspectorPaneLabelEnd(visibleRange),
      filterQuery: this.filterQuery,
      headerFilter: Boolean(this.inspector?.options?.filter),
      stats: this.getStats(),
    };
  }

  closeEditor() {
    this.events.emit('editorclose', {});
  }

  hitTest(clientX, clientY) {
    const localX = clientX - (this.viewport.renderInsetX ?? 0);
    const localY = clientY - (this.viewport.renderInsetY ?? 0);
    if (localX < 0 || localY < 0) return null;
    if (localX >= this.viewport.contentViewportWidth) return null;
    const x = localX + this.viewport.scrollX;
    if (localY < this.viewport.headerHeight) {
      const resizeColumn = this.columnModel.getResizeHandleAt(x);
      if (resizeColumn) return { area: 'header', part: 'resize', column: resizeColumn, x, y: localY };
      const column = this.columnModel.getColumnAt(x);
      if (column?.kind === 'inspectorPane' && this.inspector?.options?.filter) {
        return { area: 'header', part: 'filter', column, x, y: localY };
      }
      return column ? { area: 'header', part: 'label', column, x, y: localY } : { area: 'header', part: 'header', column: null, x, y: localY };
    }

    if (localY >= this.viewport.headerHeight + this.viewport.rowViewportHeight) return null;
    const rowY = localY - this.viewport.headerHeight + this.viewport.scrollY;
    const rowIndex = Math.floor(rowY / this.rowModel.rowHeight);
    const row = this.rowModel.getRow(rowIndex);
    if (!row) return null;
    const column = this.columnModel.getColumnAt(x);
    if (!column) return { area: 'row', part: 'row', row, column: null, x, y: rowY };

    let part = 'cell';
    if (column.kind === 'inspectorPane') {
      const localX = x - column.x;
      const node = this.model.nodes[row.nodeIndex];
      if (node?.data?.valueType === 'object') {
        const treeX = row.depth * this.rowModel.indentWidth;
        part = localX >= treeX + 4 && localX <= treeX + 22 ? 'chevron' : 'label';
        return { area: 'row', part, row, column, x, y: rowY };
      }
      if (node?.data?.valueType === 'array') {
        if (localX >= column.width - 54 && localX <= column.width - 32) part = 'arrayAdd';
        else if (localX >= column.width - 28 && localX <= column.width - 6) part = 'arrayRemove';
        else {
          const editorLeft = this.getInspectorPaneLayout(this.#visibleInspectorPaneWidth(column), row, node?.data?.editorType).editorLeft;
          if (localX >= editorLeft) part = 'editor';
          else {
            const treeX = row.depth * this.rowModel.indentWidth;
            part = localX >= treeX + 4 && localX <= treeX + 22 ? 'chevron' : 'label';
          }
        }
        return { area: 'row', part, row, column, x, y: rowY };
      }
      const layout = this.getInspectorPaneLayout(this.#visibleInspectorPaneWidth(column), row, node?.data?.editorType);
      if (localX >= layout.editorLeft) part = this.#inspectorEditorPart(row, localX - layout.editorLeft, layout.editorWidth);
      else {
        const treeX = row.depth * this.rowModel.indentWidth;
        if (localX >= treeX + 4 && localX <= treeX + 22) part = 'chevron';
        else part = 'label';
      }
    } else if (column.kind === 'tree') {
      const localX = x - column.x;
      const treeX = row.depth * this.rowModel.indentWidth;
      if (localX >= treeX + 4 && localX <= treeX + 22) part = 'chevron';
      else if (localX >= treeX + 26 && localX <= treeX + 44) part = 'icon';
      else if (localX >= treeX + 48) part = 'label';
      else part = 'cell';
    } else if (column.kind === 'inspectorValue') {
      part = this.#inspectorEditorPart(row, x - column.x, column.width);
    }
    return { area: 'row', part, row, column, x, y: rowY };
  }

  #inspectorEditorPart(row, localEditorX, editorWidth) {
    const node = this.model.nodes[row.nodeIndex];
    const data = node?.data;
    if (!data?.inspector) return 'cell';
    if (data.editorType === 'checkbox') return 'checkbox';
    if (data.editorType === 'range') {
      const width = Math.max(24, editorWidth - 20);
      const valueWidth = Math.min(64, Math.max(42, width * 0.28));
      const numberLeft = editorWidth - valueWidth - 10;
      return localEditorX >= numberLeft ? 'number' : 'range';
    }
    if (data.editorType === 'button') return 'button';
    return 'editor';
  }

  #visibleInspectorPaneWidth(column) {
    return Math.max(1, Math.min(column.width, this.viewport.scrollX + this.viewport.contentViewportWidth - column.x));
  }

  getInspectorPaneLayout(width, row = null, editorType = '') {
    return inspectorPaneLayout(width, row?.depth ?? 0, this.rowModel.indentWidth, editorType, this.#computeInspectorPaneLabelEnd(this.rowModel.getVisibleRange(this.viewport, 4)));
  }

  getCellClientRect(hit) {
    if (!hit?.row || !hit.column || !this.canvas) return { x: 0, y: 0, width: 0, height: 0 };
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + (this.viewport.renderInsetX ?? 0) + hit.column.x - this.viewport.scrollX,
      y: rect.top + (this.viewport.renderInsetY ?? 0) + this.viewport.headerHeight + hit.row.y - this.viewport.scrollY,
      width: hit.column.width,
      height: hit.row.height,
    };
  }

  getHeaderClientRect(hit) {
    if (!hit?.column || !this.canvas) return { x: 0, y: 0, width: 0, height: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const visibleWidth = Math.max(0, this.viewport.contentViewportWidth - Math.max(0, hit.column.x - this.viewport.scrollX));
    return {
      x: rect.left + (this.viewport.renderInsetX ?? 0) + hit.column.x - this.viewport.scrollX,
      y: rect.top + (this.viewport.renderInsetY ?? 0),
      width: Math.min(hit.column.width, visibleWidth || hit.column.width),
      height: this.viewport.headerHeight,
    };
  }

  getTooltipForHit(hit) {
    if (!hit?.row || !hit.column) return null;
    const node = this.model.nodes[hit.row.nodeIndex];
    if (!node) return null;
    const state = this.model.dynamicState.get(hit.row.nodeId) ?? {};
    const rect = this.getCellClientRect(hit);
    let text = '';
    let width = rect.width;

    if (hit.column.kind === 'inspectorPane') {
      const data = node.data ?? {};
      const visibleWidth = this.#visibleInspectorPaneWidth(hit.column);
      const layout = this.getInspectorPaneLayout(visibleWidth, hit.row, data.editorType);
      if (hit.part === 'label' || hit.part === 'chevron') {
        const labelX = hit.row.depth * this.rowModel.indentWidth + (hit.row.hasChildren ? 28 : 24);
        text = node.label ?? node.id;
        width = data.valueType === 'object' ? Math.max(0, visibleWidth - labelX - 8) : Math.max(0, layout.editorLeft - labelX - 8);
      } else if (hit.part === 'arrayAdd' || hit.part === 'arrayRemove') {
        return null;
      } else {
        text = inspectorTooltipValue(node);
        width = Math.max(0, layout.editorWidth - 20);
      }
    } else if (hit.column.kind === 'tree') {
      const labelX = hit.row.depth * this.rowModel.indentWidth + 50;
      text = node.label ?? node.id;
      width = Math.max(0, hit.column.width - labelX - 6);
    } else if (hit.column.kind === 'inspectorValue') {
      text = inspectorTooltipValue(node);
      width = Math.max(0, hit.column.width - 20);
    } else if (hit.column.kind === 'inspectorType') {
      text = node.data?.valueType ?? '';
      width = Math.max(0, hit.column.width - 20);
    } else if (hit.column.kind === 'inspectorDescription') {
      text = node.data?.meta?.description ?? '';
      width = Math.max(0, hit.column.width - 20);
    } else if (typeof hit.column.value === 'function') {
      const value = hit.column.value(node, state);
      text = value == null ? '' : String(value);
      width = Math.max(0, hit.column.width - 20);
    }

    text = String(text ?? '');
    if (!text || !isProbablyTruncated(text, width)) return null;
    return { text, rect, nodeId: node.id, part: hit.part, columnId: hit.column.id };
  }

  resize(width, height) {
    this.viewport.resize(width, height);
    this.#fitInspectorPaneColumn(width);
    this.#syncContentSize();
    this.events.emit('viewportchange', this.getViewportState());
  }

  getStats() {
    return {
      totalNodes: this.model.nodes.length,
      visibleRows: this.rowModel.rows.length,
      renderedRows: this.lastRenderedRows,
      patchesFrame: this.lastPatchCount,
      dirtyNodes: this.lastDirtyNodeCount,
      selectedCount: this.selection.selected.size,
      rebuildCount: this.rebuildCount,
    };
  }

  getViewportState() {
    return {
      rowHeight: this.viewport.rowHeight,
      indentWidth: this.viewport.indentWidth,
      headerHeight: this.viewport.headerHeight,
      renderInsetX: this.viewport.renderInsetX,
      renderInsetY: this.viewport.renderInsetY,
      scrollX: this.viewport.scrollX,
      scrollY: this.viewport.scrollY,
      viewportWidth: this.viewport.viewportWidth,
      viewportHeight: this.viewport.viewportHeight,
      contentWidth: this.viewport.contentWidth,
      contentHeight: this.viewport.contentHeight,
      zoom: this.viewport.zoom,
    };
  }

  #rebuildRows() {
    const scrollX = this.viewport.scrollX;
    const scrollY = this.viewport.scrollY;
    this.rowModel.rebuild();
    this.#syncContentSize();
    this.viewport.scrollTo(scrollX, scrollY);
    this.rebuildCount++;
  }

  #syncContentSize() {
    this.#syncScrollbarState(this.columnModel.contentWidth, this.rowModel.contentHeight);
    if (this.viewport.viewportWidth > 1) this.#fitInspectorPaneColumn(this.viewport.contentViewportWidth);
    this.#syncScrollbarState(this.columnModel.contentWidth, this.rowModel.contentHeight);
    this.viewport.setContentSize(this.columnModel.contentWidth, this.rowModel.contentHeight);
  }

  #syncSelectionState() {
    for (const [id, state] of this.model.dynamicState) {
      if (state.selected) this.patchBatcher.set(id, { selected: false });
    }
    for (const id of this.selection.selected) this.patchBatcher.set(id, { selected: true });
    this.setDynamicState(this.patchBatcher.flush());
  }

  #restoreExpansion(expandedIds) {
    this.model.expanded.clear();
    for (const id of expandedIds) {
      if (this.model.index.getNode(id) && this.expansion.hasChildren(id)) this.model.expanded.add(id);
    }
  }

  #focusedRowIndex() {
    if (this.focusedId) {
      const row = this.rowModel.getRowById(this.focusedId);
      if (row) return row.rowIndex;
    }
    return Math.max(0, Math.floor(this.viewport.scrollY / this.rowModel.rowHeight));
  }

  #observeCanvasSize() {
    if (!this.canvas || typeof ResizeObserver === 'undefined') return;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = Math.floor(entry?.contentRect?.width ?? 0);
      const height = Math.floor(entry?.contentRect?.height ?? 0);
      if (width > 0 && height > 0) this.resize(width, height);
    });
    this.#resizeObserver.observe(this.canvas);
  }

  #resizeToCanvasClientSize() {
    if (!this.canvas) return;
    const width = Math.floor(this.canvas.clientWidth || this.canvas.getBoundingClientRect().width || 0);
    const height = Math.floor(this.canvas.clientHeight || this.canvas.getBoundingClientRect().height || 0);
    if (width > 0 && height > 0) this.resize(width, height);
  }

  #setupNativeScrollbars() {
    if (!this.nativeScrollbars || !this.canvas || typeof document === 'undefined') return;
    const host = this.canvas.parentElement;
    if (!host) return;

    this.#nativeScroll?.destroy?.();
    ensureNativeScrollbarStyles(document);

    const previousHostPosition = host.style.position;
    let hostPositionChanged = false;
    if (typeof getComputedStyle === 'function' && getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
      hostPositionChanged = true;
    }

    const vertical = document.createElement('div');
    const verticalSpacer = document.createElement('div');
    const horizontal = document.createElement('div');
    const horizontalSpacer = document.createElement('div');
    const corner = document.createElement('div');

    vertical.className = 'virtual-tree-canvas-scrollbar virtual-tree-canvas-scrollbar-y';
    horizontal.className = 'virtual-tree-canvas-scrollbar virtual-tree-canvas-scrollbar-x';
    corner.className = 'virtual-tree-canvas-scrollbar-corner';
    vertical.appendChild(verticalSpacer);
    horizontal.appendChild(horizontalSpacer);
    applyNativeScrollbarTheme([vertical, horizontal, corner], this.themeManager.get());

    const size = nativeScrollbarSize();
    this.#nativeScrollbarSize = size;
    Object.assign(vertical.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${size}px`,
      height: '1px',
      overflowX: 'hidden',
      overflowY: 'auto',
      zIndex: '4',
    });
    Object.assign(horizontal.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '1px',
      height: `${size}px`,
      overflowX: 'auto',
      overflowY: 'hidden',
      zIndex: '4',
    });
    Object.assign(corner.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${size}px`,
      height: `${size}px`,
      zIndex: '4',
      background: 'transparent',
      pointerEvents: 'none',
    });
    Object.assign(verticalSpacer.style, {
      width: '1px',
      minHeight: '1px',
    });
    Object.assign(horizontalSpacer.style, {
      height: '1px',
      minWidth: '1px',
    });

    host.appendChild(vertical);
    host.appendChild(horizontal);
    host.appendChild(corner);

    let syncing = false;
    const sync = () => {
      this.#syncScrollbarState(this.viewport.contentWidth, this.viewport.contentHeight);
      const maxX = Math.max(0, this.viewport.contentWidth - this.viewport.contentViewportWidth);
      const maxY = Math.max(0, this.viewport.contentHeight - this.viewport.rowViewportHeight);
      const showX = maxX > 0;
      const showY = maxY > 0;
      const canvasMetrics = this.#canvasHostMetrics();

      vertical.style.display = showY ? 'block' : 'none';
      horizontal.style.display = showX ? 'block' : 'none';
      corner.style.display = showX && showY ? 'block' : 'none';
      vertical.style.left = `${canvasMetrics.left + canvasMetrics.width - size}px`;
      vertical.style.top = `${canvasMetrics.top + this.viewport.headerHeight}px`;
      vertical.style.height = `${Math.max(1, canvasMetrics.height - this.viewport.headerHeight - (showX ? size : 0))}px`;
      horizontal.style.left = `${canvasMetrics.left}px`;
      horizontal.style.top = `${canvasMetrics.top + canvasMetrics.height - size}px`;
      horizontal.style.width = `${Math.max(1, canvasMetrics.width - (showY ? size : 0))}px`;
      corner.style.left = `${canvasMetrics.left + canvasMetrics.width - size}px`;
      corner.style.top = `${canvasMetrics.top + canvasMetrics.height - size}px`;

      verticalSpacer.style.height = `${Math.ceil(maxY + vertical.clientHeight)}px`;
      horizontalSpacer.style.width = `${Math.ceil(maxX + horizontal.clientWidth)}px`;

      syncing = true;
      vertical.scrollTop = this.viewport.scrollY;
      horizontal.scrollLeft = this.viewport.scrollX;
      syncing = false;
    };
    const onVerticalScroll = () => {
      if (syncing) return;
      this.viewport.scrollTo(this.viewport.scrollX, vertical.scrollTop);
      this.events.emit('viewportchange', this.getViewportState());
    };
    const onHorizontalScroll = () => {
      if (syncing) return;
      this.viewport.scrollTo(horizontal.scrollLeft, this.viewport.scrollY);
      this.events.emit('viewportchange', this.getViewportState());
    };
    const onViewportChange = () => sync();

    vertical.addEventListener('scroll', onVerticalScroll, { passive: true });
    horizontal.addEventListener('scroll', onHorizontalScroll, { passive: true });
    this.viewport.addEventListener('change', onViewportChange);
    sync();

    this.#nativeScroll = {
      sync,
      applyTheme: (theme) => applyNativeScrollbarTheme([vertical, horizontal, corner], theme),
      destroy: () => {
        vertical.removeEventListener('scroll', onVerticalScroll);
        horizontal.removeEventListener('scroll', onHorizontalScroll);
        this.viewport.removeEventListener('change', onViewportChange);
        vertical.remove();
        horizontal.remove();
        corner.remove();
        this.#nativeScrollbarSize = 0;
        this.viewport.setScrollbarState({ size: 0, vertical: false, horizontal: false });
        if (hostPositionChanged) host.style.position = previousHostPosition;
      },
    };
  }

  #syncScrollbarState(contentWidth, contentHeight) {
    const size = this.nativeScrollbars ? this.#nativeScrollbarSize : 0;
    if (!size) {
      this.viewport.setScrollbarState({ size: 0, vertical: false, horizontal: false });
      return;
    }
    let availableWidth = this.viewport.viewportWidth;
    let availableRowHeight = Math.max(1, this.viewport.viewportHeight - this.viewport.headerHeight);
    let showY = contentHeight > availableRowHeight;
    let showX = contentWidth > availableWidth;
    if (showY && contentWidth > Math.max(1, availableWidth - size)) showX = true;
    if (showX && contentHeight > Math.max(1, availableRowHeight - size)) showY = true;
    this.viewport.setScrollbarState({ size, vertical: showY, horizontal: showX });
  }

  #canvasHostMetrics() {
    if (!this.canvas) return { left: 0, top: 0, width: this.viewport.viewportWidth, height: this.viewport.viewportHeight };
    const left = Number.isFinite(this.canvas.offsetLeft) ? this.canvas.offsetLeft : 0;
    const top = Number.isFinite(this.canvas.offsetTop) ? this.canvas.offsetTop : 0;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth || this.canvas.getBoundingClientRect?.().width || this.viewport.viewportWidth));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight || this.canvas.getBoundingClientRect?.().height || this.viewport.viewportHeight));
    return { left, top, width, height };
  }

  #computeInspectorPaneLabelEnd(visibleRange) {
    const column = this.columnModel.columns.find((item) => item.kind === 'inspectorPane');
    if (!column) return 0;
    let labelEnd = 0;
    for (let i = visibleRange.first; i <= visibleRange.last; i++) {
      const row = this.rowModel.rows[i];
      if (!row) continue;
      const node = this.model.nodes[row.nodeIndex];
      if (!node) continue;
      if (node.data?.valueType === 'object') continue;
      const indentX = row.depth * this.rowModel.indentWidth;
      const labelX = indentX + (row.hasChildren ? 28 : 24);
      const labelWidth = String(node.label ?? node.id ?? '').length * 6.4;
      labelEnd = Math.max(labelEnd, labelX + labelWidth + 12);
    }
    return Math.min(labelEnd, Math.max(90, this.#visibleInspectorPaneWidth(column) - 72));
  }

  #fitInspectorPaneColumn(width) {
    const column = this.columnModel.columns.length === 1 ? this.columnModel.columns[0] : null;
    if (column?.kind !== 'inspectorPane' && column?.kind !== 'tree') return;
    if (column.kind === 'inspectorPane' && this.inspector?.options?.presentation !== 'pane') return;
    const nextWidth = Math.max(column.minWidth, Math.floor(width));
    if (Math.abs(column.width - nextWidth) < 1) return;
    this.columnModel.resizeColumn(column.id, nextWidth);
  }

  #workerRowOptions(overrides = {}) {
    return {
      expandedIds: Array.from(this.expansion.model.expanded),
      filterCollapsedIds: Array.from(this.rowModel.filterCollapsed ?? []),
      rowHeight: this.rowModel.rowHeight,
      indentWidth: this.rowModel.indentWidth,
      sort: this.columnModel.sort,
      filterQuery: this.filterQuery,
      ...overrides,
    };
  }

  #applyWorkerRows(result) {
    const scrollX = this.viewport.scrollX;
    const scrollY = this.viewport.scrollY;
    this.rowModel.applyRows(result);
    this.#syncContentSize();
    this.viewport.scrollTo(scrollX, scrollY);
    this.rebuildCount++;
  }

  #rebuildInspectorModel(focusPath = '') {
    if (!this.inspector) return;
    const expanded = new Set(this.expansion.model.expanded);
    const focusId = focusPath ? `model:${focusPath}` : this.focusedId;
    const nodes = this.inspector.builder.build(this.inspector.model, this.inspector.meta, this.inspector.options);
    this.model.setTree(nodes);
    this.expansion.model.expanded = expanded;
    if (focusId) this.expansion.expandAncestors(focusId);
    this.searchIndex.rebuild(this.model);
    this.#rebuildRows();
    if (focusId) this.focusedId = focusId;
  }

  #resizeObserver = null;
  #nativeScroll = null;
  #nativeScrollbarSize = 0;
}

const NATIVE_SCROLLBAR_STYLE_ID = 'virtual-tree-canvas-native-scrollbar-style';

function ensureNativeScrollbarStyles(doc) {
  if (!doc || typeof doc.createElement !== 'function') return;
  if (typeof doc.getElementById === 'function' && doc.getElementById(NATIVE_SCROLLBAR_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = NATIVE_SCROLLBAR_STYLE_ID;
  style.textContent = `
.virtual-tree-canvas-scrollbar {
  --vtc-scrollbar-size: 12px;
  --vtc-scrollbar-track: rgba(15, 23, 42, 0.32);
  --vtc-scrollbar-thumb: rgba(148, 163, 184, 0.58);
  --vtc-scrollbar-thumb-hover: rgba(148, 163, 184, 0.78);
  --vtc-scrollbar-thumb-active: rgba(56, 189, 248, 0.76);
  --vtc-scrollbar-thumb-border: rgba(255, 255, 255, 0.08);
  background: var(--vtc-scrollbar-track);
  scrollbar-color: var(--vtc-scrollbar-thumb) var(--vtc-scrollbar-track);
  scrollbar-width: thin;
}

.virtual-tree-canvas-scrollbar:hover {
  scrollbar-color: var(--vtc-scrollbar-thumb-hover) var(--vtc-scrollbar-track);
}

.virtual-tree-canvas-scrollbar::-webkit-scrollbar {
  width: var(--vtc-scrollbar-size);
  height: var(--vtc-scrollbar-size);
}

.virtual-tree-canvas-scrollbar::-webkit-scrollbar-track {
  background: var(--vtc-scrollbar-track);
}

.virtual-tree-canvas-scrollbar::-webkit-scrollbar-thumb {
  min-width: 28px;
  min-height: 28px;
  border: 3px solid transparent;
  border-radius: 999px;
  background:
    linear-gradient(180deg, var(--vtc-scrollbar-thumb-highlight), transparent 52%),
    var(--vtc-scrollbar-thumb);
  background-clip: content-box;
  box-shadow: inset 0 0 0 1px var(--vtc-scrollbar-thumb-border);
}

.virtual-tree-canvas-scrollbar:hover::-webkit-scrollbar-thumb {
  background:
    linear-gradient(180deg, var(--vtc-scrollbar-thumb-highlight), transparent 52%),
    var(--vtc-scrollbar-thumb-hover);
  background-clip: content-box;
}

.virtual-tree-canvas-scrollbar::-webkit-scrollbar-thumb:active {
  background:
    linear-gradient(180deg, var(--vtc-scrollbar-thumb-highlight), transparent 52%),
    var(--vtc-scrollbar-thumb-active);
  background-clip: content-box;
}

.virtual-tree-canvas-scrollbar::-webkit-scrollbar-corner,
.virtual-tree-canvas-scrollbar-corner {
  background: var(--vtc-scrollbar-track);
}
`;
  const target = doc.head ?? doc.body ?? doc.documentElement;
  target?.appendChild?.(style);
}

function applyNativeScrollbarTheme(elements, theme) {
  const colors = theme?.colors ?? {};
  const track = alphaHex(colors.row ?? colors.background ?? '#0b1020', 0.74);
  const thumb = mixHex(colors.borderStrong ?? colors.border ?? '#334155', colors.textMuted ?? colors.focus ?? '#94a3b8', 0.55);
  const hover = mixHex(thumb, colors.focus ?? '#38bdf8', 0.32);
  const active = mixHex(thumb, colors.focus ?? '#38bdf8', 0.52);
  const highlight = alphaHex('#ffffff', 0.2);
  const border = alphaHex('#ffffff', 0.09);
  for (const element of elements) {
    if (!element?.style?.setProperty) continue;
    element.style.setProperty('--vtc-scrollbar-track', track);
    element.style.setProperty('--vtc-scrollbar-thumb', thumb);
    element.style.setProperty('--vtc-scrollbar-thumb-hover', hover);
    element.style.setProperty('--vtc-scrollbar-thumb-active', active);
    element.style.setProperty('--vtc-scrollbar-thumb-highlight', highlight);
    element.style.setProperty('--vtc-scrollbar-thumb-border', border);
  }
}

function mixHex(a, b, amount) {
  const from = parseHexColor(a);
  const to = parseHexColor(b);
  if (!from || !to) return amount >= 0.5 ? b : a;
  const t = Math.max(0, Math.min(1, amount));
  const value = from.map((channel, index) => Math.round(channel + (to[index] - channel) * t));
  return `rgb(${value[0]}, ${value[1]}, ${value[2]})`;
}

function alphaHex(value, alpha) {
  const color = parseHexColor(value);
  if (!color) return value;
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${Math.max(0, Math.min(1, alpha))})`;
}

function parseHexColor(value) {
  const text = String(value ?? '').trim();
  const match = /^#([0-9a-f]{6})$/i.exec(text);
  if (!match) return null;
  const number = Number.parseInt(match[1], 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function nativeScrollbarSize() {
  if (typeof document === 'undefined') return 14;
  const probe = document.createElement('div');
  Object.assign(probe.style, {
    position: 'absolute',
    top: '-9999px',
    width: '100px',
    height: '100px',
    overflow: 'scroll',
  });
  document.body?.appendChild(probe);
  const size = Math.max(10, probe.offsetWidth - probe.clientWidth || 14);
  probe.remove();
  return size;
}

function assertPositiveNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive number`);
  }
}

function assertNonNegativeNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative number`);
  }
}

function inspectorPaneLayout(width, depth = 0, indentWidth = 18, editorType = '', labelEnd = 0) {
  const safeWidth = Math.max(1, width);
  const rightPadding = 14;
  if (editorType === 'checkbox') {
    const editorWidth = 34;
    return { editorLeft: Math.max(64, safeWidth - rightPadding - editorWidth), editorWidth };
  }
  const minEditor = Math.min(170, Math.max(96, safeWidth * 0.45));
  const minLabelEnd = Math.max(88, depth * indentWidth + 104);
  const preferredLeft = Math.max(minLabelEnd, labelEnd, safeWidth * 0.32);
  const maxLeft = Math.max(64, safeWidth - rightPadding - minEditor);
  const editorLeft = Math.max(64, Math.min(preferredLeft, maxLeft));
  const editorWidth = Math.max(56, safeWidth - rightPadding - editorLeft);
  return { editorLeft, editorWidth };
}

function createDefaultArrayItem(meta = {}) {
  if (meta.itemFactory) return meta.itemFactory();
  if (meta.itemType === 'number') return 0;
  if (meta.itemType === 'boolean') return false;
  if (meta.itemType === 'object') return {};
  return '';
}

function createSortValueSnapshot(column, nodes, dynamicState) {
  return new Map(nodes.map((node) => [node.id, column.value(node, dynamicState.get(node.id) ?? {})]));
}

function compareColumnValues(column, a, b, dynamicState, snapshot = null) {
  const aValue = snapshot ? snapshot.get(a.id) : column.value(a, dynamicState.get(a.id) ?? {});
  const bValue = snapshot ? snapshot.get(b.id) : column.value(b, dynamicState.get(b.id) ?? {});
  if (typeof aValue === 'number' && typeof bValue === 'number') return aValue - bValue;
  return String(aValue ?? '').localeCompare(String(bValue ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function matchesFilter(node, state, path, query) {
  const inspector = node.data?.inspector;
  const values = inspector
    ? [
        node.label,
        node.type,
        node.data?.path,
        node.data?.key,
        node.data?.valueText,
        node.data?.meta?.description,
        ...Object.keys(node.data?.meta?.options ?? {}),
      ]
    : [
        node.id,
        node.label,
        node.type,
        path,
        ...(node.tags ?? []),
        state.status,
        state.value,
      ];
  return values.some((value) => String(value ?? '').toLowerCase().includes(query));
}

function inspectorTooltipValue(node) {
  const data = node.data ?? {};
  if (data.editorType === 'checkbox') return '';
  if (data.editorType === 'button') return data.meta?.button ?? node.label ?? '';
  if (data.valueType === 'object') return '';
  return data.valueText ?? data.value ?? '';
}

function isProbablyTruncated(text, width) {
  if (width <= 0) return Boolean(text);
  return String(text).length * 6.4 > width;
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}
