export interface RowAction {
  kind?: 'button' | 'checkbox';
  checked?: boolean | ((node: TreeNode, state: Record<string, any>) => boolean);
  id: string;
  label: string;
  icon?: string | ((node: TreeNode, state: Record<string, any>) => string);
  /** Icon variants to rasterize before the first action. */
  preloadIcons?: string[];
  visible?: boolean | ((node: TreeNode, state: Record<string, any>) => boolean);
  disabled?: boolean | ((node: TreeNode, state: Record<string, any>) => boolean);
  pressed?: boolean | ((node: TreeNode, state: Record<string, any>) => boolean);
}
export type RowDragResolver = ((node: TreeNode, state: Record<string, any>) => any | null) | null;
export const builtinIconNames: readonly string[];
export interface RowReorderDetail {
  nodeId: string;
  parentId: string | null;
  fromIndex: number;
  toIndex: number;
  siblingOrder: string[];
  order: string[];
  source: 'api' | 'pointer' | 'button' | 'keyboard';
}

export interface TreeViewOptions {
  nativeScrollbars?: boolean;
  iconsBaseUrl?: string | URL;
  iconRegistry?: IconRegistry;
  rowReorder?: boolean;
  rowActions?: RowAction[];
  rowDrag?: RowDragResolver;
  autoRender?: boolean;
  tooltip?: boolean;
  canvas?: HTMLCanvasElement;
  host?: HTMLElement;
  [key: string]: any;
}

export class TreeTooltip {
  constructor(options: { controller: TreeViewController; host?: HTMLElement });
  hide(): void;
  destroy(): void;
}

export type TreeViewAlign = 'start' | 'center' | 'end' | 'nearest';

export type IconDrawFunction = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => void;
export type IconSource = string | CanvasImageSource | IconDrawFunction;

export class IconRegistry {
  constructor(options?: { pixelRatio?: number; iconsBaseUrl?: string | URL });
  register(name: string, icon: IconSource): any;
  get(name: string): any;
  onChange(listener: () => void): () => void;
  prepare(options?: { icons?: Iterable<string>; size?: number; color?: string; pixelRatio?: number }): Promise<any[]>;
  draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, color: string): void;
}

export type TreeNode = {
  id: string;
  parentId?: string | null;
  label?: string;
  type?: string;
  icon?: string;
  image?: string;
  tags?: string[];
  reorderable?: boolean;
  data?: any;
};

export type DynamicPatch = {
  id: string;
  state?: Record<string, any>;
} & Record<string, any>;

export type MetaRule = {
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  /** Display-only suffix for numeric values. Never appended to the model value. */
  unit?: string;
  /** Display decimal places (0–20). Editing retains the original precision. */
  precision?: number;
  readonly?: boolean;
  disabled?: boolean;
  updated?: boolean;
  description?: string;
  color?: boolean;
  options?: Record<string, string | number | boolean>;
  button?: string;
  label?: string;
  fullWidthButton?: boolean;
  itemType?: 'object' | 'number' | 'string' | 'boolean';
  itemTitle?: (i: number, item: any) => string;
  itemFactory?: () => any;
  type?: string;
  icon?: string;
};

export type Column = {
  id: string;
  label?: string;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  kind?: string;
  /** Optional semantic type for value-column coloring; defaults to the raw value type. */
  valueType?: string | ((value: any, node: TreeNode, state: Record<string, any>) => string);
  sortable?: boolean;
  value?: (node: TreeNode, state: Record<string, any>) => string | number | boolean;
  /** Formats displayed text and tooltips without changing sorting values. */
  format?: (value: any, node: TreeNode, state: Record<string, any>) => string;
  render?: (ctx: CanvasRenderingContext2D, cell: any) => void;
};

export const themes: Record<string, any>;

export class TreeRowRenderer {
  renderedRows: number;
  constructor(options?: Record<string, any>);
  initialize(canvas: HTMLCanvasElement): void;
  setScene(scene: any): void;
  updateDynamicState(patches: DynamicPatch[]): void;
  render(scene?: any, time?: number): void;
}

export class TreeViewController {
  canvas?: HTMLCanvasElement;
  inputController?: TreeViewInputController | null;
  cellEditor?: CellEditorManager | null;
  viewport: {
    viewportWidth: number;
    viewportHeight: number;
    [key: string]: any;
  };
  filterQuery: string;
  rowModel: any;
  expansion: any;
  selection: any;
  constructor(options?: TreeViewOptions);
  iconRegistry: IconRegistry;
  tooltip?: TreeTooltip | null;
  rowReorder: boolean;
  editable: boolean;
  initialExpandDepth: number;
  filterOptions: {caseSensitive: boolean; wholeWord: boolean};
  model: any;
  inspector: any;
  columnModel: any;
  setRowActions(actions: RowAction[]): void;
  setRowDrag(resolver: RowDragResolver): void;
  sortBy(id: string, direction?: string): boolean;
  clearSort(): void;
  setEditable(enabled: boolean): void;
  setInitialExpandDepth(depth: number): void;
  setIconResolver(resolver: TreeViewConfiguration['iconResolver']): void;
  setInspectorOptions(options: {filter?: boolean; markUpdated?: boolean}): void;
  setHeaderFilter(enabled: boolean): void;
  setInspectorValue(path: string, value: any, options?: InspectorWriteOptions): boolean;
  updateInspectorValue(nodeId: string, value: any, editorType?: string, options?: InspectorWriteOptions): boolean;
  closeEditor(): void;
  clearSearch(): void;
  getSearchState(): TreeSearchState;
  nextSearchResult(): string | null;
  previousSearchResult(): string | null;
  setRowReorder(enabled: boolean): void;
  canReorderRows(nodeId?: string): boolean;
  getRowOrder(parentId?: string | null): string[];
  moveRow(nodeId: string, targetIndex: number, options?: {source?: RowReorderDetail["source"]}): boolean;
  moveRowBy(nodeId: string, offset: number, options?: {source?: RowReorderDetail["source"]}): boolean;
  requestRender(force?: boolean): void;
  cancelRender(): void;
  attachTooltip(options?: {host?: HTMLElement}): TreeTooltip;
  initialize(canvas: HTMLCanvasElement): this;
  attachCellEditor(options?: { host?: HTMLElement | null }): CellEditorManager;
  attachInput(options?: { cellEditor?: CellEditorManager | null }): TreeViewInputController;
  destroy(): void;
  on<K extends keyof TreeViewEvents>(type: K, listener: (event: TreeViewEvent<K>) => void): () => void;
  on(type: string, listener: (event: any) => void): () => void;
  off(type: string, listener: (event: any) => void): void;
  setData(nodes: TreeNode[], options?: { iconResolver?: TreeViewConfiguration['iconResolver'] }): void;
  setModel(model: any, meta?: Record<string, MetaRule>, options?: Record<string, any>): void;
  setColumns(columns: Column[] | null): void;
  setDynamicState(patches: DynamicPatch[]): void;
  flushDynamicState(): Set<string>;
  setTheme(theme: any): void;
  setLayoutMetrics(options?: { rowHeight?: number; indentWidth?: number; headerHeight?: number }): void;
  registerIcon(name: string, icon: IconSource): any;
  resize(width: number, height: number): void;
  render(time?: number): void;
  renderMeasured(time?: number): any;
  getStats(): TreeViewStats;
  hitTest(clientX: number, clientY: number): any;
  getTooltipForHit(hit: any): any;
  search(query: string, options?: Record<string, any> & { caseSensitive?: boolean; wholeWord?: boolean }): any;
  setFilter(queryOrPredicate?: string | ((node: any, state: any) => boolean), options?: { caseSensitive?: boolean; wholeWord?: boolean }): void;
  clearFilter(): void;
  focusNode(nodeId: string, options?: Record<string, any>): boolean;
  scrollToNode(nodeId: string, align?: TreeViewAlign): boolean;
  scrollTo(x: number, y: number): void;
  getSelection(): string[];
  setSelection(ids: string[]): void;
  clearSelection(): void;
  toggle(nodeId: string): boolean;
  expandAll(): void;
  collapseAll(): void;
}

export interface TreeViewStats {
  totalNodes: number;
  visibleRows: number;
  renderedRows: number;
  patchesFrame: number;
  dirtyNodes: number;
  selectedCount: number;
  rebuildCount: number;
  setDynamicStateCalls: number;
  patchesReceived: number;
  uniqueNodesReceived: number;
  nodesChanged: number;
  rendersRequested: number;
  rendersExecuted: number;
  rendersAvoidedNoChanges: number;
  rendersAvoidedOffscreen: number;
  rowActionsFullUpdates: number;
  rowActionsIncrementalUpdates: number;
}

export class TreeViewInputController {
  constructor(options: { controller: TreeViewController; cellEditor?: CellEditorManager | null });
  destroy(): void;
}

export class CellEditorManager {
  constructor(options: { controller: TreeViewController; host?: HTMLElement | null });
  destroy(): void;
  setEditable(enabled: boolean): void;
  close(): void;
}

export interface InspectorWriteOptions { emit?: boolean; source?: string }
export interface TreeViewConfiguration {
  mode?: 'tree' | 'inspector';
  presentation?: 'pane' | 'table';
  nodes?: TreeNode[];
  model?: any;
  meta?: Record<string, MetaRule> | null;
  columns?: Column[] | null;
  theme?: string | Record<string, any>;
  flatRoot?: boolean;
  enforceMeta?: boolean;
  filter?: boolean;
  filterPlacement?: 'auto' | 'bar' | 'header';
  markUpdated?: boolean;
  editable?: boolean;
  rowReorder?: boolean;
  rowActions?: RowAction[];
  rowDrag?: RowDragResolver;
  initialExpandDepth?: number;
  rowHeight?: number;
  indentWidth?: number;
  /** Hide column headings without hiding the filter bar. Defaults to true; inspector panes may hide headings automatically. */
  showHeader?: boolean;
  headerHeight?: number;
  iconResolver?: ((node: TreeNode) => string | Partial<TreeNode> | null | undefined) | null;
  fontFamily?: string | null;
}
export const treeViewOptionNames: readonly (keyof TreeViewConfiguration)[];
export function validateTreeViewOptions(options: TreeViewConfiguration): void;

export class TreeView {
  constructor(host: HTMLElement, options?: TreeViewConfiguration & Pick<TreeViewOptions, 'iconsBaseUrl' | 'iconRegistry' | 'nativeScrollbars'>);
  readonly controller: TreeViewController;
  readonly element: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly destroyed: boolean;
  configure(options: TreeViewConfiguration): this;
  flush(): void;
  destroy(): void;
  setData(nodes: TreeNode[]): void;
  setModel(model: any, meta?: Record<string, MetaRule>): void;
  setColumns(columns: Column[] | null): void;
  setTheme(theme: string | Record<string, any>): void;
  setDynamicState(patches: DynamicPatch[]): void;
  setInspectorValue(path: string, value: any, options?: InspectorWriteOptions): boolean;
  on<K extends keyof TreeViewEvents>(type: K, listener: (event: TreeViewEvent<K>) => void): () => void;
  on(type: string, listener: (event: any) => void): () => void;
  off(type: string, listener: (event: any) => void): void;
  setFilter(query?: string | ((node: TreeNode, state: Record<string, any>) => boolean), options?: {caseSensitive?: boolean; wholeWord?: boolean}): void;
  clearFilter(): void;
  getRowOrder(parentId?: string | null): string[];
  moveRow(id: string, index: number, options?: {source?: RowReorderDetail['source']}): boolean;
  moveRowBy(id: string, offset: number, options?: {source?: RowReorderDetail['source']}): boolean;
  getSelection(): string[];
  setSelection(ids: string[]): void;
  clearSelection(): void;
  search(query: string, options?: Record<string, any>): any;
  clearSearch(): void;
  getSearchState(): TreeSearchState;
  nextSearchResult(): string | null;
  previousSearchResult(): string | null;
  focusNode(id: string, options?: Record<string, any>): boolean;
  scrollToNode(id: string, align?: TreeViewAlign): boolean;
  expandAll(): void;
  collapseAll(): void;
  registerIcon(name: string, source: IconSource): any;
}

/** Public event details shared by the DOM view and the controller. */
export interface InspectorValueChange {
  path: string;
  oldValue: any;
  newValue: any;
  model: any;
  nodeId: string;
  editorType: string;
  source: string;
}
export interface TreeSearchState {
  query: string;
  results: string[];
  cursor: number;
  current: string | null;
  count: number;
}
export interface RowDragDetail {
  nodeId: string;
  payload: any;
  label: string;
  originalEvent: PointerEvent;
}
export interface TreeViewEvents {
  rowaction: {checked?: boolean; actionId: string; nodeId: string; node: TreeNode; originalEvent: MouseEvent};
  rowdragstart: RowDragDetail;
  rowdragmove: RowDragDetail;
  rowdragend: RowDragDetail;
  rowdragcancel: Omit<RowDragDetail, 'originalEvent'>;
  valuechange: InspectorValueChange;
  modelchange: {model: any; meta?: Record<string, MetaRule>; path?: string; structural?: boolean; action?: string; value?: any} & Partial<InspectorValueChange>;
  action: {path: string; label: string; nodeId: string; model: any; source: string};
  rowreorder: RowReorderDetail;
  selectionchange: {selection: string[]; focusedId: string | null};
  focuschange: {nodeId: string | null};
  filterchange: {query: string; options: {caseSensitive: boolean; wholeWord: boolean}; visibleRows: number; worker?: boolean};
  searchchange: Omit<TreeSearchState, 'count'>;
  nodeclick: {nodeId: string; row: any; originalEvent: any};
  nodedblclick: {nodeId: string; row: any; originalEvent: any};
  editablechange: {editable: boolean};
  rowreorderchange: {enabled: boolean};
}
export type TreeViewEvent<K extends keyof TreeViewEvents> = {type: K; detail: TreeViewEvents[K]};

/** Formats an inspector value using its options and precision. */
export function formatInspectorValue(value: any, meta?: MetaRule): string;

export class ModelInspectorBuilder {
  build(model: any, meta?: Record<string, MetaRule>, options?: {flatRoot?: boolean; enforceMeta?: boolean}): TreeNode[];
}
