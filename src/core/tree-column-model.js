export const builtInColumns = {
  tree: {
    id: 'name',
    label: 'Name',
    width: 320,
    minWidth: 160,
    align: 'left',
    kind: 'tree',
    value: (node) => node.label ?? node.id,
  },
  status: {
    id: 'status',
    label: 'Status',
    width: 84,
    minWidth: 64,
    align: 'center',
    kind: 'status',
    value: (_node, state) => state.status ?? 0,
  },
  value: {
    id: 'value',
    label: 'Value',
    width: 84,
    minWidth: 56,
    align: 'right',
    kind: 'value',
    value: (_node, state) => state.value ?? '',
  },
  progress: {
    id: 'progress',
    label: 'Progress',
    width: 120,
    minWidth: 80,
    align: 'left',
    kind: 'progress',
    value: (_node, state) => state.progress ?? '',
  },
  type: {
    id: 'type',
    label: 'Type',
    width: 110,
    minWidth: 70,
    align: 'left',
    kind: 'type',
    value: (node) => node.type ?? '',
  },
  updated: {
    id: 'updated',
    label: 'Updated',
    width: 120,
    minWidth: 84,
    align: 'right',
    kind: 'updated',
    value: (_node, state) => state.updatedAt ?? '',
  },
};

export class TreeColumnModel {
  constructor(columns = [builtInColumns.tree]) {
    this.columns = [];
    this.contentWidth = 0;
    this.sort = { columnId: null, direction: null };
    this.setColumns(columns);
  }

  setColumns(columns = [builtInColumns.tree]) {
    const normalized = columns.length ? columns : [builtInColumns.tree];
    this.columns = normalized.map((column, index) => normalizeColumn(column, index));
    if (!this.columns.some((column) => column.kind === 'tree' || column.kind === 'inspectorPane')) {
      this.columns.unshift(normalizeColumn(builtInColumns.tree, 0));
    }
    this.#layout();
  }

  /** @param {number} x */
  getColumnAt(x) {
    return this.columns.find((column) => x >= column.x && x < column.x + column.width) ?? null;
  }

  getColumn(id) {
    return this.columns.find((column) => column.id === id) ?? null;
  }

  resizeColumn(id, width) {
    const column = this.getColumn(id);
    if (!column) return false;
    column.width = Math.max(column.minWidth, width);
    this.#layout();
    return true;
  }

  moveColumn(id, targetIndex) {
    const currentIndex = this.columns.findIndex((column) => column.id === id);
    if (currentIndex === -1) return false;
    const [column] = this.columns.splice(currentIndex, 1);
    const nextIndex = Math.max(0, Math.min(this.columns.length, targetIndex));
    this.columns.splice(nextIndex, 0, column);
    if (!this.columns.some((item) => item.kind === 'tree')) this.columns.unshift(normalizeColumn(builtInColumns.tree, 0));
    this.#layout();
    return true;
  }

  setSort(columnId, direction) {
    if (columnId !== null && !this.getColumn(columnId)) return false;
    this.sort = { columnId, direction };
    return true;
  }

  getResizeHandleAt(x, tolerance = 5) {
    return this.columns.find((column) => Math.abs(x - (column.x + column.width)) <= tolerance) ?? null;
  }

  #layout() {
    let x = 0;
    for (const column of this.columns) {
      column.x = x;
      x += column.width;
    }
    this.contentWidth = x;
  }
}

export function defaultTreeTableColumns() {
  return [
    { ...builtInColumns.tree, id: 'name', label: 'Name', width: 340 },
    builtInColumns.type,
    builtInColumns.status,
    builtInColumns.value,
    builtInColumns.progress,
    builtInColumns.updated,
  ];
}

function normalizeColumn(column, index) {
  const builtIn = typeof column === 'string' ? builtInColumns[column] : null;
  const source = builtIn ?? column;
  if (!source?.id) throw new Error(`Column at index ${index} is missing id`);
  const width = Math.max(source.minWidth ?? 40, source.width ?? 120);
  return {
    id: source.id,
    label: source.label ?? source.id,
    width,
    minWidth: source.minWidth ?? 40,
    align: source.align ?? 'left',
    kind: source.kind ?? (index === 0 ? 'tree' : 'text'),
    sortable: source.sortable ?? true,
    value: source.value ?? ((node) => node[source.id] ?? ''),
    render: source.render,
    x: 0,
  };
}
