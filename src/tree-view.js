import { TreeViewController } from './tree-view-controller.js';
import { TreeFilterBar } from './input/tree-filter-bar.js';
import {
  treeViewDefaults,
  treeViewOptionNames,
  validateTreeViewOptions
} from './core/view-options.js';
import { resolveTheme } from './core/theme-manager.js';
import { treeViewStyles } from './view/styles.js';

/**
 * Mount a tree or inspector with a canvas, filter controls and editors.
 */
export class TreeView {
  constructor(host, options = {}) {
    if (!host?.ownerDocument) throw new TypeError('TreeView requires an HTMLElement host');
    validateTreeViewOptions(options);
    resolveTheme(options.theme ?? treeViewDefaults.theme);
    this.host = host;
    this.document = host.ownerDocument;
    this.window = this.document.defaultView;
    this.destroyed = false;
    this.flushing = false;
    this.scheduled = false;
    this.pending = null;
    this.refreshPending = true;
    this.options = {
      ...treeViewDefaults,
      nodes: [],
      model: {},
      meta: {}
    };
    this.element = this.document.createElement('div');
    this.element.className = 'vtc-view';
    const style = this.document.createElement('style');
    style.textContent = treeViewStyles;
    this.canvasHost = this.document.createElement('div');
    this.canvasHost.className = 'vtc-canvas-host';
    this.canvas = this.document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'Tree table');
    this.canvasHost.append(this.canvas);
    this.element.append(style, this.canvasHost);
    host.append(this.element);
    this._controller = new TreeViewController({
      canvas: this.canvas,
      host: this.canvasHost,
      autoRender: true,
      tooltip: true,
      iconsBaseUrl: options.iconsBaseUrl,
      iconRegistry: options.iconRegistry,
      nativeScrollbars: options.nativeScrollbars
    });
    this.filterBar = new TreeFilterBar(this._controller, this.document);
    this.element.insertBefore(this.filterBar.element, this.canvasHost);
    this.stopTheme = this._controller.on('themechange', () => this.syncTheme());
    this.configure(options);
    this.flush();
    this.syncTheme();
    this.document.fonts?.addEventListener('loadingdone', this.refreshFont);
    this.document.fonts?.ready.then(this.refreshFont);
  }

  get controller() {
    this.flush();
    return this._controller;
  }

  /**
   * Merge options; several changes in one task are applied once.
   */
  configure(patch) {
    if (this.destroyed) throw new Error('TreeView has been destroyed');
    validateTreeViewOptions(patch);
    if (Object.hasOwn(patch, 'theme')) resolveTheme(patch.theme);
    const next = {
      ...(this.pending ?? this.options)
    };
    for (const key of treeViewOptionNames) if (Object.hasOwn(patch, key)) next[key] = patch[key];
    this.pending = next;
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => {
        if (!this.destroyed) this.flush();
      });
    }
    return this;
  }

  flush() {
    if (this.destroyed || this.flushing || !this.pending) return;
    this.scheduled = false;
    const next = this.pending,
      previous = this.options;
    const changed = (key) => !Object.is(next[key], previous[key]);
    const replaceData =
      this.refreshPending ||
      changed('mode') ||
      (next.mode === 'tree'
        ? changed('nodes')
        : changed('model') ||
          changed('meta') ||
          changed('presentation') ||
          changed('flatRoot') ||
          changed('enforceMeta'));
    this.pending = null;
    this.refreshPending = false;
    this.options = next;
    this.flushing = true;
    const controller = this._controller;
    try {
      controller.flushDynamicState();
      if (changed('initialExpandDepth')) controller.setInitialExpandDepth(next.initialExpandDepth);
      if (changed('rowHeight') || changed('indentWidth'))
        controller.setLayoutMetrics({
          rowHeight: next.rowHeight,
          indentWidth: next.indentWidth
        });
      if (changed('theme') || changed('fontFamily')) this.applyTheme();
      if (changed('editable')) controller.setEditable(next.editable);
      if (changed('rowActions')) controller.setRowActions(next.rowActions);
      if (changed('rowDrag')) controller.setRowDrag(next.rowDrag);
      if (changed('rowReorder')) controller.setRowReorder(next.rowReorder);
      if (replaceData) {
        if (next.mode === 'tree')
          controller.setData(next.nodes ?? [], {
            iconResolver: next.iconResolver
          });
        else
          controller.setModel(next.model, next.meta ?? {}, {
            presentation: next.presentation,
            flatRoot: next.flatRoot,
            enforceMeta: next.enforceMeta,
            markUpdated: next.markUpdated
          });
      } else {
        if (changed('iconResolver') && next.mode === 'tree')
          controller.setIconResolver(next.iconResolver);
        if (changed('markUpdated'))
          controller.setInspectorOptions({
            markUpdated: next.markUpdated
          });
      }
      if (changed('columns') || (replaceData && next.columns !== null))
        controller.setColumns(next.columns);
      if (replaceData || ['filter', 'filterPlacement', 'headerHeight', 'showHeader'].some(changed))
        this.syncLayout();
    } finally {
      this.flushing = false;
    }
  }

  syncLayout() {
    const { filter, filterPlacement, headerHeight, showHeader, mode, presentation } = this.options;
    const bar =
      filter &&
      (!showHeader ||
        filterPlacement === 'bar' ||
        (filterPlacement === 'auto' && (mode === 'tree' || presentation === 'pane')));
    this.filterBar.setVisible(bar);
    this._controller.setHeaderFilter(filter && !bar);
    this._controller.setLayoutMetrics({
      headerHeight:
        !showHeader || (bar && mode === 'inspector' && presentation === 'pane') ? 0 : headerHeight
    });
  }

  applyTheme() {
    const theme = resolveTheme(this.options.theme);
    const family =
      this.options.fontFamily === 'inherit'
        ? this.window.getComputedStyle(this.host).fontFamily
        : this.options.fontFamily;
    this.fontFamily = family;
    this._controller.setTheme(
      family
        ? {
            ...theme,
            font: `12px ${family}`,
            monoFont: `12px ${family}`
          }
        : theme
    );
  }

  refreshFont = () => {
    if (this.destroyed) return;
    this.flush();
    const family =
      this.options.fontFamily === 'inherit'
        ? this.window.getComputedStyle(this.host).fontFamily
        : this.options.fontFamily;
    if (family !== this.fontFamily) this.applyTheme();
    else this._controller.requestRender();
  };

  syncTheme() {
    const theme = this._controller.themeManager.get();
    for (const [key, value] of Object.entries({
      background: theme.colors.background,
      text: theme.colors.text,
      border: theme.colors.border,
      focus: theme.colors.focus,
      selected: theme.colors.rowSelected
    }))
      this.element.style.setProperty(`--vtc-${key}`, value);
    if (this.fontFamily) this.element.style.setProperty('--vtc-font-family', this.fontFamily);
    else this.element.style.removeProperty('--vtc-font-family');
  }

  setData(nodes) {
    if (!Array.isArray(nodes)) throw new TypeError('nodes must be an array');
    this.configure({
      nodes,
      mode: 'tree'
    });
    this.refreshPending = true;
    this.flush();
  }

  setModel(model, meta = (this.pending ?? this.options).meta) {
    this.configure({
      model,
      meta,
      mode: 'inspector'
    });
    this.refreshPending = true;
    this.flush();
  }

  setColumns(columns) {
    const changed = columns !== (this.pending ?? this.options).columns;
    this.configure({
      columns
    });
    this.flush();
    if (!changed) this._controller.setColumns(columns);
  }

  setTheme(theme) {
    this.configure({
      theme
    });
    this.flush();
  }

  on(type, listener) {
    return this._controller.on(type, listener);
  }

  off(type, listener) {
    this._controller.off(type, listener);
  }

  setDynamicState(patches) {
    this.controller.setDynamicState(patches);
  }

  setInspectorValue(path, value, options) {
    return this.controller.setInspectorValue(path, value, options);
  }

  setFilter(query, options) {
    this.controller.setFilter(query, options);
  }

  clearFilter() {
    this.controller.clearFilter();
  }

  getRowOrder(parentId) {
    return this.controller.getRowOrder(parentId);
  }

  moveRow(id, index, options) {
    return this.controller.moveRow(id, index, options);
  }

  moveRowBy(id, offset, options) {
    return this.controller.moveRowBy(id, offset, options);
  }

  getSelection() {
    return this.controller.getSelection();
  }

  setSelection(ids) {
    this.controller.setSelection(ids);
  }

  clearSelection() {
    this.controller.clearSelection();
  }

  search(query, options) {
    return this.controller.search(query, options);
  }

  clearSearch() {
    this.controller.clearSearch();
  }

  getSearchState() {
    return this.controller.getSearchState();
  }

  nextSearchResult() {
    return this.controller.nextSearchResult();
  }

  previousSearchResult() {
    return this.controller.previousSearchResult();
  }

  focusNode(id, options) {
    return this.controller.focusNode(id, options);
  }

  scrollToNode(id, align) {
    return this.controller.scrollToNode(id, align);
  }

  expandAll() {
    this.controller.expandAll();
  }

  collapseAll() {
    this.controller.collapseAll();
  }

  registerIcon(name, source) {
    return this.controller.registerIcon(name, source);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pending = null;
    this.document.fonts?.removeEventListener('loadingdone', this.refreshFont);
    this.stopTheme();
    this.filterBar.destroy();
    this._controller.destroy();
    this.element.remove();
  }

}
