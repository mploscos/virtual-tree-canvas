export function captureTreeViewState(controller) {
  return {
    scrollX: controller.viewport.scrollX,
    scrollY: controller.viewport.scrollY,
    selection: controller.getSelection(),
    focusedId: controller.focusedId,
    searchQuery: controller.searchIndex.lastQuery ?? '',
    searchResults: controller.searchIndex.results.slice(),
    searchCursor: controller.searchIndex.cursor,
    searchMatches: new Set(controller.searchHighlights),
    filterQuery: controller.filterQuery,
    sort: { ...controller.columnModel.sort },
    columns: controller.columnModel.columns.map((column) => ({ ...column })),
    expanded: new Set(controller.expansion.model.expanded),
    theme: controller.themeManager.get(),
  };
}

export function restoreTreeViewState(controller, state) {
  if (state.columns) controller.setColumns(state.columns);
  controller.expansion.model.expanded = new Set(state.expanded);
  if (state.sort?.columnId) controller.sortBy(state.sort.columnId, state.sort.direction);
  if (state.filterQuery) controller.setFilter(state.filterQuery);
  controller.rowModel.rebuild();
  controller.viewport.setContentSize(controller.columnModel.contentWidth, controller.rowModel.contentHeight);
  controller.viewport.scrollTo(state.scrollX, state.scrollY);
  controller.setSelection(state.selection);
  controller.focusedId = state.focusedId;
  controller.selection.focused = state.focusedId;
  controller.searchIndex.results = state.searchResults.slice();
  controller.searchIndex.cursor = state.searchCursor;
  controller.searchIndex.lastQuery = state.searchQuery;
  controller.searchHighlights = new Set(state.searchMatches);
  controller.setTheme(state.theme);
}

export function sceneSignature(scene) {
  return {
    visibleRange: { ...scene.visibleRange },
    viewport: {
      scrollX: scene.viewport.scrollX,
      scrollY: scene.viewport.scrollY,
      width: scene.viewport.viewportWidth,
      height: scene.viewport.viewportHeight,
      contentWidth: scene.viewport.contentWidth,
      contentHeight: scene.viewport.contentHeight,
    },
    columns: scene.columns.map((column) => ({ id: column.id, x: column.x, width: column.width, kind: column.kind })),
    rows: scene.rows.slice(scene.visibleRange.first, scene.visibleRange.last + 1).map((row) => ({
      nodeId: row.nodeId,
      rowIndex: row.rowIndex,
      depth: row.depth,
      expanded: row.expanded,
    })),
    selection: Array.from(scene.selection).sort(),
    hoverNodeId: scene.hoverNodeId,
    focusNodeId: scene.focusNodeId,
    searchMatches: Array.from(scene.searchMatches).sort(),
    sort: scene.sort,
    filterQuery: scene.filterQuery,
  };
}
