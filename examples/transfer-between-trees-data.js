/** Move selected branches within one tree or between two trees. */
export function moveTreeNodes(sourceNodes, targetNodes, selectedIds, drop) {
  const sameTree = sourceNodes === targetNodes;
  const sourceById = new Map(sourceNodes.map((node) => [node.id, node]));
  const selected = new Set(selectedIds.filter((id) => sourceById.has(id)));
  const roots = sourceNodes.filter((node) => {
    if (!selected.has(node.id)) return false;
    let parentId = node.parentId;
    const seen = new Set([node.id]);
    while (parentId != null && sourceById.has(parentId) && !seen.has(parentId)) {
      if (selected.has(parentId)) return false;
      seen.add(parentId);
      parentId = sourceById.get(parentId).parentId;
    }
    return true;
  });
  if (!roots.length) return null;

  const rootIds = new Set(roots.map((node) => node.id));
  const movedIds = new Set();
  for (const node of sourceNodes) {
    let id = node.id;
    const seen = new Set();
    while (id != null && sourceById.has(id) && !seen.has(id)) {
      if (rootIds.has(id)) {
        movedIds.add(node.id);
        break;
      }
      seen.add(id);
      id = sourceById.get(id).parentId;
    }
  }

  const targetById = new Map(targetNodes.map((node) => [node.id, node]));
  const target = targetById.get(drop.nodeId);
  if (!target) throw new Error('Target row does not exist');
  if (!['inside', 'before', 'after'].includes(drop.position))
    throw new Error('Unknown drop position');
  if (!sameTree && [...movedIds].some((id) => targetById.has(id)))
    throw new Error('Source and target contain a duplicate node ID');

  const parentId = drop.position === 'inside' ? target.id : target.parentId;
  if (parentId == null) return null;
  // A branch cannot become its own descendant or be ordered against one of its rows.
  if (sameTree && (movedIds.has(parentId) || movedIds.has(target.id))) return null;

  const remainingSource = sourceNodes.filter((node) => !movedIds.has(node.id));
  const movedNodes = sourceNodes.filter((node) => movedIds.has(node.id)).map((node) =>
    rootIds.has(node.id) ? { ...node, parentId } : { ...node }
  );
  const baseTarget = sameTree ? remainingSource : targetNodes;
  const combined = [...baseTarget, ...movedNodes];
  const byId = new Map(combined.map((node) => [node.id, node]));
  const children = new Map();
  for (const node of combined) {
    const key = node.parentId ?? null;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(node.id);
  }
  const siblings = children.get(parentId) ?? [];
  const movedRootIds = roots.map((node) => node.id);
  const withoutMoved = siblings.filter((id) => !rootIds.has(id));
  const at = drop.position === 'inside'
    ? withoutMoved.length
    : withoutMoved.indexOf(target.id) + Number(drop.position === 'after');
  withoutMoved.splice(at, 0, ...movedRootIds);
  children.set(parentId, withoutMoved);

  const orderedTarget = [];
  const append = (id) => {
    orderedTarget.push(byId.get(id));
    for (const childId of children.get(id) ?? []) append(childId);
  };
  for (const id of children.get(null) ?? []) append(id);

  if (sameTree && orderedTarget.every((node, index) =>
    node.id === sourceNodes[index]?.id && node.parentId === sourceNodes[index]?.parentId
  )) return null;
  return {
    sourceNodes: sameTree ? orderedTarget : remainingSource,
    targetNodes: orderedTarget,
    movedRootIds,
    movedCount: movedNodes.length
  };
}

/** Compatibility helper for the original root-only example. */
export function moveNodesBetweenTrees(sourceNodes, targetNodes, selectedIds, targetParentId) {
  return moveTreeNodes(sourceNodes, targetNodes, selectedIds, {
    nodeId: targetParentId,
    position: 'inside'
  });
}
