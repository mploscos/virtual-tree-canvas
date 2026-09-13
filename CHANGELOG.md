# Changelog

## 0.7.1

- Coalesce dynamic state patches by node until the next frame and ignore repeated values.
- Skip Canvas2D renders for dynamic changes outside the visible/overscan and sticky rows.
- Incrementally synchronize RowActions for dirty visible rows without redundant DOM or icon writes.
- Avoid copying active sort snapshots into every render scene; serialize them only for worker calls.
- Add dynamic-update counters, regression coverage, and a 10,000-node browser benchmark.
- Keep an open truncated-value tooltip visible and refresh its text across live state/data updates while the pointer remains on the same cell.

## 0.7.0 — 2026-09-10

### Added

- Configurable right-aligned row actions with icons, checkboxes, tooltips, disabled and pressed states, and keyboard activation.
- Optional row data dragging with start, move, end and cancel events for application drop targets.
- `preloadIcons` prepares action icon variants before the first interaction. Includes new trash and filled-star icons.
- `showHeader` hides column headings independently of the filter.
- `reorderable: false` prevents manual movement of individual rows while allowing their parent subtree to move.
- Value formatting and semantic type colors for table columns, plus configurable status pills.

### Fixed

- Row actions preserve selection backgrounds and remain available on partially visible rows. Hover highlights the icon without covering the row.
- Action icons render at their displayed size and current screen pixel density.
- Canvas resizing repaints immediately after measurement; keyboard focus uses a subtle outer border.
- Inspector checkboxes align with other value controls. Sliders and text inputs remain editable when row dragging is enabled.
- Live refreshes preserve active editors, row drags, expansion state and action-button focus.
- Flat lists no longer reserve unnecessary leaf-marker space. Sticky ancestor separators remain hidden before scrolling.
- Focusing a row during dragging no longer scrolls ancestor panels.
- Sorted and filtered tables can export rows while keeping manual reordering disabled.
- Pointer cancellation and disposal release drag state.

## 0.6.0 — 2026-09-10

### Added

- `TreeView(host, options)` mounts a complete tree or inspector with a canvas, filter, tooltip and editor. Use `configure()` to update its options.
- Manual row ordering with drag handles, Up/Down buttons, Alt+Arrow shortcuts, edge scrolling and cancellation. `rowreorder` reports changes for applications that save the order.
- `getRowOrder`, `moveRow`, `moveRowBy` and `setRowReorder` APIs. Manual ordering is available for data rows when filtering and column sorting are inactive.
- `autoRender`, `TreeTooltip`, configurable `iconsBaseUrl` and application-defined `iconResolver`.
- `setEditable`, `setInitialExpandDepth`, `setIconResolver`, `setHeaderFilter` and inspector writes by path with optional event suppression.
- Expanded SVG catalogue with 63 icons. Includes a visual catalogue and examples of units and manual ordering.

### Changed

- Built-in SVGs are served from `resources/icons/` and loaded on demand. SVG sources and raster variants are cached.

### Fixed

- Changing editability, filter visibility or icons preserves row order, selection and live values.
- Explicit row dimensions survive theme changes.
- Explicit data and model setters refresh mutated objects even when their reference is unchanged.
- Mode and expansion-depth options are applied; `columns: null` restores the current presentation's default columns.
- Filter controls reflect programmatic changes, including clearing the filter. Header filtering works in readonly tables.
- Cancelling an editor does not commit its value. Layout changes close editors whose position is no longer valid.
- Switching from inspector mode to data rows clears inspector-specific columns.

### Migration

Applications that bundle the library must serve its resources and configure their public URL:

```js
const view = new TreeView(host, {
  iconsBaseUrl: '/node_modules/virtual-tree-canvas/resources/icons/'
});
```

Update references to `src/assets/icons/` to use `resources/icons/`.

Existing `TreeViewController` integrations and explicit render loops remain supported.
Manual ordering and controller automatic rendering are opt-in. Numeric units and
display precision remain supported.
