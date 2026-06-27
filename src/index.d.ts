export type TreeViewAlign = 'start' | 'center' | 'end' | 'nearest';

export type TreeNode = {
  id: string;
  parentId?: string | null;
  label?: string;
  type?: string;
  icon?: string;
  image?: string;
  tags?: string[];
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
  sortable?: boolean;
  value?: (node: TreeNode, state: Record<string, any>) => string | number | boolean;
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
  constructor(options?: Record<string, any> & { nativeScrollbars?: boolean });
  initialize(canvas: HTMLCanvasElement): this;
  attachCellEditor(options?: { host?: HTMLElement | null }): CellEditorManager;
  attachInput(options?: { cellEditor?: CellEditorManager | null }): TreeViewInputController;
  destroy(): void;
  on(type: string, listener: (event: any) => void): any;
  off(type: string, listener: (event: any) => void): void;
  setData(nodes: TreeNode[]): void;
  setModel(model: any, meta?: Record<string, MetaRule>, options?: Record<string, any>): void;
  setColumns(columns: Column[]): void;
  setDynamicState(patches: DynamicPatch[]): void;
  setTheme(theme: any): void;
  setLayoutMetrics(options?: { rowHeight?: number; indentWidth?: number; headerHeight?: number }): void;
  resize(width: number, height: number): void;
  render(time?: number): void;
  renderMeasured(time?: number): any;
  hitTest(clientX: number, clientY: number): any;
  getTooltipForHit(hit: any): any;
  search(query: string, options?: Record<string, any>): any;
  setFilter(queryOrPredicate?: string | ((node: any, state: any) => boolean)): void;
  clearFilter(): void;
  focusNode(nodeId: string, options?: Record<string, any>): boolean;
  scrollToNode(nodeId: string, align?: TreeViewAlign): boolean;
  scrollTo(x: number, y: number): void;
  getSelection(): string[];
  setSelection(ids: string[]): void;
  clearSelection(): void;
  expandAll(): void;
  collapseAll(): void;
}

export class TreeViewInputController {
  constructor(options: { controller: TreeViewController; cellEditor?: CellEditorManager | null });
  destroy(): void;
}

export class CellEditorManager {
  constructor(options: { controller: TreeViewController; host?: HTMLElement | null });
  destroy(): void;
  close(): void;
}
