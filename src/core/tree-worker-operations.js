export function createWorkerTreeState(nodes) {
  const idToIndex = new Map();
  const childrenByParent = new Map();
  const parentById = new Map();
  const roots = [];
  const pathById = new Map();

  for (let i = 0; i < nodes.length; i++) idToIndex.set(nodes[i].id, i);
  for (const node of nodes) {
    const parentId = node.parentId ?? null;
    parentById.set(node.id, parentId);
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(node.id);
    if (parentId === null) roots.push(node.id);
  }

  const indexPaths = (id, parentPath) => {
    const node = nodes[idToIndex.get(id)];
    if (!node) return;
    const label = node.label || node.id;
    const path = parentPath ? `${parentPath}/${label}` : label;
    pathById.set(id, path);
    for (const childId of childrenByParent.get(id) ?? []) indexPaths(childId, path);
  };
  for (const rootId of roots) indexPaths(rootId, '');

  const records = nodes.map((node) => {
    const path = pathById.get(node.id) ?? '';
    const tags = (node.tags ?? []).join(' ');
    return {
      id: node.id,
      label: node.label ?? '',
      path,
      tags,
      type: node.type ?? '',
      searchText: normalize(`${node.id} ${node.label ?? ''} ${path} ${tags} ${node.type ?? ''}`),
    };
  });

  return { nodes, idToIndex, childrenByParent, parentById, roots, pathById, records };
}

export function searchWorkerTree(state, query, { fields = ['label', 'id', 'path', 'tags', 'type'], limit = 500 } = {}) {
  const q = normalize(query);
  if (!q) return [];
  const results = [];
  const defaultFields = fields.length === 5 && fields.includes('label') && fields.includes('id') && fields.includes('path') && fields.includes('tags') && fields.includes('type');

  for (const record of state.records) {
    const matches = defaultFields ? record.searchText.includes(q) : fields.some((field) => normalize(record[field]).includes(q));
    if (!matches) continue;
    results.push(record.id);
    if (results.length >= limit) break;
  }
  return results;
}

export function rebuildWorkerRows(state, options = {}) {
  const rowHeight = options.rowHeight ?? 28;
  const indentWidth = options.indentWidth ?? 18;
  const expanded = new Set(options.expandedIds ?? []);
  const query = normalize(options.filterQuery ?? '');
  const sort = options.sort ?? { columnId: null, direction: null };
  const sortValues = options.sortValues ? new Map(options.sortValues) : null;
  const includedIds = options.includedIds ? new Set(options.includedIds) : query ? getIncludedIdsForQuery(state, query).includedIds : null;
  const rows = [];
  let maxDepth = 0;

  const hasChildren = (id) => (state.childrenByParent.get(id) ?? []).length > 0;
  const nodeForId = (id) => state.nodes[state.idToIndex.get(id)];
  const isIncluded = (id) => !includedIds || includedIds.has(id);

  const sortIds = (ids) => {
    const filtered = includedIds ? ids.filter((id) => includedIds.has(id)) : ids;
    if (!sort.columnId || !sort.direction) return filtered;
    const direction = sort.direction === 'desc' ? -1 : 1;
    return filtered.slice().sort((aId, bId) => compareNodes(nodeForId(aId), nodeForId(bId), sort.columnId, sortValues) * direction);
  };

  const visit = (id, depth) => {
    if (!isIncluded(id)) return;
    const nodeIndex = state.idToIndex.get(id);
    if (nodeIndex === undefined) return;
    const expandedRow = expanded.has(id);
    const rowIndex = rows.length;
    rows.push({
      nodeId: id,
      nodeIndex,
      depth,
      rowIndex,
      y: rowIndex * rowHeight,
      height: rowHeight,
      expanded: expandedRow,
      hasChildren: hasChildren(id),
    });
    maxDepth = Math.max(maxDepth, depth);
    if (!expandedRow && !query) return;
    for (const childId of sortIds(state.childrenByParent.get(id) ?? [])) visit(childId, depth + 1);
  };

  for (const rootId of sortIds(state.roots)) visit(rootId, 0);
  return {
    rows,
    contentHeight: rows.length * rowHeight,
    contentWidth: Math.max(640, (maxDepth + 1) * indentWidth + 520),
  };
}

export function getIncludedIdsForQuery(state, query, candidateIds = null) {
  const q = normalize(query);
  const includedIds = new Set();
  const matchingIds = [];
  const records = candidateIds ? idsToRecords(state, candidateIds) : state.records;

  for (const record of records) {
    if (!record.searchText.includes(q)) continue;
    matchingIds.push(record.id);
    let id = record.id;
    while (id !== null && id !== undefined && !includedIds.has(id)) {
      includedIds.add(id);
      id = state.parentById.get(id) ?? null;
    }
  }
  return { matchingIds, includedIds };
}

function idsToRecords(state, ids) {
  const records = [];
  for (const id of ids) {
    const index = state.idToIndex.get(id);
    if (index !== undefined) records.push(state.records[index]);
  }
  return records;
}

function compareNodes(a, b, columnId, sortValues = null) {
  const aValue = sortValues ? sortValues.get(a?.id) : columnValue(a, columnId);
  const bValue = sortValues ? sortValues.get(b?.id) : columnValue(b, columnId);
  if (typeof aValue === 'number' && typeof bValue === 'number') return aValue - bValue;
  return String(aValue ?? '').localeCompare(String(bValue ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function columnValue(node, columnId) {
  if (!node) return '';
  if (columnId === 'name') return node.label ?? node.id;
  if (columnId === 'type') return node.type ?? '';
  return node[columnId] ?? '';
}

function normalize(value) {
  return String(value ?? '').toLowerCase();
}
