# Changelog

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
