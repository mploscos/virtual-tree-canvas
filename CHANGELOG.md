# Changelog

## 0.8.0 — 2026-10-24

### Added

- Arrays in the inspector use compact indexed value rows, with readable summaries for objects, simple values and nested arrays.
- TypeScript declarations for every public entry point, type checks and a declaration generator.
- Shift + drag range selection, leaving an ordinary drag available for data dragging.

### Fixed

- Live column sorting compares cached values by node ID to avoid repeated node lookups, and reuses one numeric-aware collator in the controller and worker.
- Double-clicking an inspector array’s add or remove control no longer toggles its expansion.
- Inspector selects open on the first completed click without immediately closing.
- An open range number editor now follows slider changes immediately.

### Changed

- Single selection is the default. `multiSelect: true` enables range and additive selection; data dragging follows the active selection mode without application-specific gesture checks.
- Keep Dark and Light as the two built-in themes; remove the redundant Tactical preset.
- Package exports now expose declarations for subpaths and the bundled icon resources.
- Built-in SVG icons are included in the ESM package, so bundled applications need no icon asset path or additional HTTP requests. `iconsBaseUrl` remains available for externally hosted replacements.
- Inspector selects now keep the canvas control dimensions, font, colors and dropdown indicator while editing.
- Build the local search index on first use and stop expansion traversal at the configured depth, reducing initial mount work.


## 0.7.11 — 2026-10-18

### Changed

- Active column sorting now follows live dynamic values, reordering sibling rows once per update batch in the selected ascending or descending direction.
- Programmatic inspector writes can refresh readonly and disabled values while user editing remains blocked.

## 0.7.10 — 2026-10-11

### Changed

- Manual row ordering now starts only from its dedicated drag handle. Dragging a row from its content remains available exclusively for external data drops.
- Manual ordering displays an exact canvas snapshot of the rendered source row while retaining the insertion indicator.

### Fixed

- Tree hierarchy guides account for the row-order gutter instead of crossing its controls.
- The insertion indicator uses a finer line that does not obscure adjacent row content.

## 0.7.9 — 2026-10-09

### Added

- Expand the built-in SVG catalogue from 65 to 95 icons with common document, navigation, platform, execution, editing, visibility and state symbols.

### Changed

- Nodes without explicit icon metadata now use the neutral `item` icon. `placeholder` is reserved for unknown icon names and `point` retains its geographic meaning.
- Toolbar-scale action icons use distinct silhouettes, and `road` represents a road independently from a generic route.

### Fixed

- Transparent-margin trimming also works with image elements by reading their pixels through a temporary canvas.

## 0.7.8 — 2026-10-08

### Added

- `nodeclick` now reports the hit `part` and `columnId`, and `nodecontextmenu` exposes the same cell-level context with the original pointer event.
- Themes can set `iconSize` independently from `rowHeight` for larger tree and inspector icons.

### Fixed

- Registered bitmap and canvas icons preserve their intrinsic aspect ratio inside the configured icon box, with optional transparent-margin trimming through `{ image, trim: true }`.
- Hit testing now resolves visually pinned ancestor rows, so selection, expansion, hover, tooltips and context menus target the sticky row instead of the scrolled row underneath.
- Collapsing a pinned ancestor preserves that row's viewport position instead of anchoring a child that disappears.

## 0.7.6 — 2026-09-27

### Changed

- Wheel scrolling stays within a scrollable tree by default, including at its edges, while trees without overflow leave scrolling to an ancestor. Set `scrollChaining: true` to let an ancestor continue scrolling at tree edges.

### Fixed

- Wheel input over row actions such as favorite stars now scrolls the tree and follows its scroll-chaining policy.

## 0.7.5 — 2026-09-25

### Added

- External row dragging now includes every draggable row in the active selection through `items`, `nodeIds` and `count`, with a count badge for multi-row gestures.

### Changed

- Range editors now keep the slider at a useful width and let the numeric input fill the remaining space before its unit and row actions.
- Pane inspector rows reclaim leading row-action slots whose actions are hidden, allowing inputs and units to extend up to the first visible action without overlapping it.
- Starting a drag on an unselected row selects and drags only that row, matching common multi-selection behavior.

## 0.7.2 — 2026-09-13

### Fixed

- Repaint initially visible row-action icons when their asynchronous SVG raster finishes loading.

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
