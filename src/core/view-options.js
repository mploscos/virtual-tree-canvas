import { resolveTheme } from './theme-manager.js';
/** Supported TreeView configuration options and defaults. */
export const treeViewDefaults = Object.freeze({
  mode: 'tree', presentation: 'pane', nodes: Object.freeze([]), model: null, meta: null,
  columns: null, theme: 'dark', flatRoot: true, enforceMeta: false,
  filter: true, filterPlacement: 'auto', markUpdated: true, editable: true,
  rowReorder: false, initialExpandDepth: 1, rowHeight: undefined,
  indentWidth: undefined, headerHeight: 28, iconResolver: null, fontFamily: null,
});
export const treeViewOptionNames = Object.freeze(Object.keys(treeViewDefaults));

export function validateTreeViewOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Options must be an object');
  for (const [key, value] of Object.entries(options)) {
    if (key === 'theme') resolveTheme(value);
    if (key === 'mode' && !['tree', 'inspector'].includes(value)) throw new TypeError('mode must be tree or inspector');
    if (key === 'presentation' && !['pane', 'table'].includes(value)) throw new TypeError('presentation must be pane or table');
    if (key === 'filterPlacement' && !['auto', 'bar', 'header'].includes(value)) throw new TypeError('filterPlacement must be auto, bar or header');
    if (key === 'nodes' && !Array.isArray(value)) throw new TypeError('nodes must be an array');
    if (key === 'columns' && value !== null && !Array.isArray(value)) throw new TypeError('columns must be an array or null');
    if (key === 'model' && value === undefined) throw new TypeError('model must not be undefined');
    if (key === 'meta' && value !== null && (!value || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('meta must be an object or null');
    if (['rowHeight', 'indentWidth'].includes(key) && value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new TypeError(`${key} must be a positive number`);
    if (key === 'headerHeight' && (!Number.isFinite(value) || value < 0)) throw new TypeError('headerHeight must be non-negative');
    if (key === 'initialExpandDepth' && (!Number.isInteger(value) || value < 0)) throw new TypeError('initialExpandDepth must be a non-negative integer');
    if (key === 'iconResolver' && value !== null && typeof value !== 'function') throw new TypeError('iconResolver must be a function or null');
    if (key === 'fontFamily' && value !== null && typeof value !== 'string') throw new TypeError('fontFamily must be a string or null');
    if (['flatRoot', 'enforceMeta', 'filter', 'markUpdated', 'editable', 'rowReorder'].includes(key) && typeof value !== 'boolean') throw new TypeError(`${key} must be boolean`);
  }
}
