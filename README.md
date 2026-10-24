# virtual-tree-canvas

**A fast, framework-agnostic tree and tree-table for large hierarchical data.**

`virtual-tree-canvas` gives applications the interactions users expect from a
native tree view—expandable branches, columns, selection, search, filtering and
keyboard navigation—without creating a DOM node for every row. It renders only
what is visible with Canvas2D, so it stays responsive as data and live updates
grow.

Try the [live tree and editable inspector](https://mploscos.github.io/virtual-tree-canvas/#demos) in the browser.

## Why use it?

- **Built for large trees.** Only visible rows plus a small overscan range are painted.
- **Interactive by default.** Tree-table columns, sorting, resizing, selection, focus, tooltips and keyboard navigation are included.
- **Good for live data.** Batched state patches update status, progress and values without rebuilding the tree.
- **Framework-free.** Use it directly from browser JavaScript; no React or Web Component runtime is required.
- **Easy to style.** Built-in dark and light themes, type-based styling, and editable SVG icons.
- **Ready for inspectors.** Turn plain JavaScript objects into compact editable forms or property tables.

See [the changelog](./CHANGELOG.md) for migration notes and additions.

## Install

```bash
npm install virtual-tree-canvas
```

## Choose between `setData` and `setModel`

Both display a tree. The difference is who creates its rows:

| Method | Pass in | Use it for |
| --- | --- | --- |
| `setData(nodes)` | A flat array of rows with stable `id` values and optional `parentId` links | Application-defined trees and tables: assets, files, live status, sorting and manual row order |
| `setModel(model, meta?)` | An ordinary JavaScript object or array; no row IDs needed | Inspecting and editing its properties, including nested objects and arrays |

`setData()` displays the rows you define. It does not turn the properties of each
row's `data` into child rows or editors. Configure columns to display values, and
use `setDynamicState()` for frequent updates.

`setModel()` walks the model and creates property rows and suitable editors.
Optional metadata (`meta`) adds labels, limits, choices and other editing rules.
User edits update the supplied model and emit `valuechange` / `modelchange`.
Calling either method on `TreeView` switches to its corresponding mode (`tree`
or `inspector`). For an array of objects without IDs, use `setModel()` to
inspect its indexed items. Use `setData()` when each item is an application row
and you can give it a stable ID.

## Quick start: complete DOM view

Give the host an explicit height. `TreeView` mounts its canvas, filter, tooltip
and editors, observes size changes and schedules rendering itself.

```html
<div id="assets-tree" style="height:480px"></div>
```

```js
import { TreeView } from 'virtual-tree-canvas';

const view = new TreeView(document.querySelector('#assets-tree'), {
  initialExpandDepth: 2,
  rowReorder: true
});
view.setData([
  { id: 'fleet', label: 'Fleet', icon: 'folder' },
  { id: 'radar-1', parentId: 'fleet', label: 'Forward radar', icon: 'radar' },
  { id: 'track-100', parentId: 'radar-1', label: 'Track T-100', icon: 'track' }
]);
view.setDynamicState([{ id: 'track-100', state: { value: 430 } }]);
view.configure({ editable: false, rowHeight: 32 });
view.on('rowreorder', ({ detail }) => console.log(detail.order));
const tree = view.controller; // optional lower-level operations
// On permanent unmount: view.destroy();
```

`configure(patch)` batches changes in a microtask. Public operations and reading
`view.controller` flush pending configuration first; `view.flush()` is also
available. Editability, theme, filter visibility and icon resolution preserve
manual order, selection, expansion and live values. `setData` and `setModel`
explicitly reinstall data even when the same mutated reference is supplied.

- `mode`: `tree` (default) or `inspector`; `presentation`: `pane` or `table`.
- `filterPlacement`: `auto` (bar in tree/pane, first-column header in inspector
  table), `bar` or `header`. Set `filter: false` to hide it. Hiding the control
  preserves its query; call `clearFilter()` to clear the query.
- `columns: null` restores defaults for the current presentation.
- Explicit `rowHeight` and `indentWidth` override the theme; configure them as
  `undefined` to resume theme defaults. `initialExpandDepth` applies to future
  data installations; it does not expand or collapse the current tree.
- `fontFamily: 'inherit'` follows the host font and refreshes after fonts load.
- Wheel scrolling stays within a scrollable tree by default, including at its
  edges. If the tree has no overflow, an ancestor can handle it. Set
  `scrollChaining: true` to allow this at tree edges too.
- `iconsBaseUrl`, `iconRegistry` and `nativeScrollbars` are construction options.
- `setInspectorValue(path, value, {emit: false})` updates a value without emitting
  `valuechange` or `modelchange`. Normal writes include `source: 'api'`; editor
  writes use `source: 'user'`. Programmatic writes also refresh readonly values
  without making them editable. Both include the model in their event details.

Use `view.configure` for view configuration. Direct controller operations are
available for interaction state (filtering, selection, sorting, navigation);
changing data or presentation through the view keeps its configuration coherent.

## Low-level canvas integration

Existing applications can keep `TreeViewController` and manage their own DOM:

```js
import { TreeViewController } from 'virtual-tree-canvas';
const tree = new TreeViewController({ canvas, host, autoRender: true });
tree.setData(rows);
```

The controller owns state and editing, including `setEditable`,
`setInspectorValue`, `closeEditor` and layout precedence. With `autoRender`
omitted, use your existing explicit `tree.render()` loop.

## Common tasks

```js
// Navigate and select
tree.expand('radar-1');
tree.focusNode('track-100', { align: 'center', select: true });
tree.setSelection(['track-100']);

// Search and filter
tree.search('forward radar');
tree.setFilter('track');
tree.clearFilter();

// Configure the tree-table
tree.setColumns(columns);
tree.sortBy('status', 'asc');
tree.resizeColumn('name', 320);

// Use a worker for expensive search/filter work
await tree.enableWorkers();
```

## Live updates and performance

Use `setDynamicState()` for values that change frequently. It updates the
dynamic state of affected nodes while retaining indexes, expansion state and
visible rows.

```js
tree.setDynamicState([
  { id: 'track-100', state: { status: 1, progress: 0.7, value: 42 } },
]);
```

Calls made before the next animation frame are coalesced by node ID and property
(the last value wins). Repeated values and changes wholly outside the current
viewport/overscan do not repaint. When a patch changes the value of the active
sort column, sibling rows are reordered in the selected ascending or descending
direction; a batch of patches causes at most one row-list rebuild. `render()`,
`createRenderScene()`, sorting, filtering, TreeView configuration flushes,
inspector writes, search and selection operations apply pending patches before
they read dynamic state. The controller's `flushDynamicState()` method is also
available when an integration needs an explicit synchronous boundary.

`setData()`, expand/collapse, sorting and filtering are structural operations
and may rebuild the visible row list. For very large datasets,
`enableWorkers()` moves search and filtered row rebuilds off the main thread
when Workers are available.
Vite and webpack 5 emit the worker automatically. With bundlers that do not
process `new Worker(new URL(...))`, emit `virtual-tree-canvas/workers/tree-worker.js`
as a separate worker entry and pass its deployed URL to `enableWorkers(workerUrl)`.

Row actions can also use checkboxes styled like inspector controls. Set `kind: 'checkbox'` and provide
`checked` as a boolean or a function of `(node, state)`. The `rowaction` event
includes `checked`; update your application state in response. Checkbox actions
support `visible` and `disabled` and do not select or drag the row.

## Columns

Use `showHeader: false` to hide column headings while keeping the filter available.
The configured `headerHeight` is preserved when the header is shown again.

```js
tree.setColumns([
  {
    id: 'name',
    label: 'Name',
    width: 340,
    minWidth: 160,
    kind: 'tree',
    value: (node) => node.label ?? node.id,
  },
  {
    id: 'status',
    label: 'Status',
    width: 84,
    minWidth: 64,
    align: 'center',
    kind: 'status',
    value: (_node, state) => state.status,
  },
  {
    id: 'progress',
    label: 'Progress',
    width: 140,
    kind: 'progress',
    value: (_node, state) => state.progress,
  },
]);
```

Available column kinds are `tree`, `status`, `value`, `progress`, `type`,
`updated` and `text`. A column can also provide `render(ctx, cell)` for custom
Canvas2D content. Import `builtInColumns` or `defaultTreeTableColumns` to start
from the default set.

Text columns accept `format(value, node, state)` to customize displayed text and
tooltips while sorting by the original `value`. For example,
`format: value => value.toFixed(2)` displays two decimal places. By default,
numeric text uses the same precision as inspector values (up to three decimals).

## Themes and icons

Two themes are included:

```js
import { darkTheme, lightTheme } from 'virtual-tree-canvas';

tree.setTheme(lightTheme);
```

Use `tree.setTheme(darkTheme)` to switch back, or pass `"dark"` / `"light"`.

Inspector values and columns with `kind: 'value'` use `theme.valueColors` to
distinguish numbers, strings, booleans, enums and empty values. Read-only values
retain their contrast; disabled controls remain dimmed. Override individual
colors, for example `tree.setTheme({ valueColors: { number: '#8bd5ee' } })`.
A value column can specify `valueType: 'enum'` or a
`valueType(value, node, state)` callback when its semantic type differs from the
raw value. Formatting and sorting are unaffected.

Columns with `kind: 'status'` display compact pills using `theme.statuses`, for
example `{ Live: { label: 'Live', color: '#56ba95' } }`. Their width adapts to
the label within the column.

Themes can map domain types to a colour and icon:

```js
tree.setTheme({
  rowHeight: 28,
  iconSize: 15,
  font: '12px system-ui',
  types: {
    root: { icon: 'folder', color: '#38bdf8' },
    platform: { icon: 'aircraft', color: '#60a5fa' },
    sensor: { icon: 'radar', color: '#34d399' },
    warning: { icon: 'warning', color: '#facc15' },
  },
});
```

`rowHeight` controls the height of each node and `iconSize` controls its icon.
Increase both when the tree needs larger, more readable entries.

Built-in icons come from the editable SVG files in [`resources/icons`](./resources/icons).
Their sources are included in the JavaScript package, so built-in icons work in native ESM,
Vite and other bundlers without a public asset path or extra HTTP requests. The renderer
rasterizes only the icons it uses, once per colour, CSS size and device pixel ratio,
then draws the cached image. Run `npm run icons:generate` after changing an SVG.

To host a replacement icon directory instead, set `iconsBaseUrl` when constructing
`TreeView`, `TreeViewController` or `IconRegistry`:

```js
const tree = new TreeViewController({ canvas, iconsBaseUrl: '/icons/' });
```

The option accepts an absolute URL (including a CDN), a root-relative path or a
document-relative path. The directory must provide `<name>.svg` for each icon
used. A custom `iconRegistry` takes precedence.

Register application icons from an SVG URL, inline SVG or an image:

```js
tree.registerIcon('camera', '/icons/camera.svg');
tree.registerIcon('satellite', '<svg viewBox="0 0 24 24"><path fill="currentColor" d="..."/></svg>');
tree.registerIcon('logo', imageElement);
```

Use `currentColor` in an SVG to inherit the type or dynamic-state colour.
`tree.iconRegistry.prepare({ icons, size, color, pixelRatio })` is also
available when an application wants to warm a known icon set before display.

## Model inspector

`setModel()` renders a JavaScript object or array as an editable inspector;
you do not create nodes or IDs yourself. Metadata controls the editor, bounds,
choices, labels and descriptions.

```js
tree.setModel(
  {
    sensor: { enabled: true, range: 72, mode: 'track' },
    tracks: [{ id: 'T-100', speed: 430 }],
  },
  {
    'sensor.range': { min: 0, max: 120, step: 1, integer: true },
    'sensor.mode': { options: { Search: 'search', Track: 'track' } },
    tracks: { itemTitle: (index, item) => item.id || `Track ${index + 1}` },
    'tracks.*.speed': { min: 0, max: 900, step: 5, unit: 'm/s', precision: 2 },
    'tracks.*.id': { readonly: true },
  },
  { presentation: 'pane', flatRoot: true },
);
```

Choose `presentation: 'pane'` for a compact folder-and-controls view, or
`presentation: 'table'` for Property / Value / Type / Description columns.
Editors are inferred from data and metadata: checkbox, range, number, text,
select, colour, button, object and array.

Array elements occupy one row each. Their index is shown quietly in the tree
gutter; primitive values are edited on that row. Object elements expand to their
properties and show a short summary from `name`, `label`, `title` or `id`, or
from their first two simple fields. Nested arrays show their length beside the
index and expand directly to their own elements. Set `itemTitle(index, item)`
on the array's metadata to choose a different summary. Paths and node IDs
still use zero-based array indices.

Numeric metadata supports `unit` (a display-only string suffix) and `precision`
(decimal places, 0–20). The unit has a reserved slot beside the number in both
pane and table presentations, including range sliders. It stays visible while
editing; the editor receives the full original numeric value and emits a number.
Precision changes display only, not stored values, limits or step size. Omit both
options to keep the existing formatting. Invalid precision values are ignored.
Customize the suffix with `theme.unitFont` and `theme.colors.unit` (defaults to
`textMuted`). Long units are truncated to fit the available cell width.

Listen for user edits and actions with `valuechange`, `modelchange` and
`action` events.

## Events

```js
tree.on('nodeclick', (event) => {
  console.log(event.detail.nodeId);
});
tree.on('selectionchange', (event) => {});
tree.on('expand', (event) => {});
tree.on('searchchange', (event) => {});
tree.on('filterchange', (event) => {});
tree.on('valuechange', (event) => {});
```

Other events include `nodehover`, `nodedblclick`, `collapse`, `focuschange`,
`sortchange`, `columnschange`, `viewportchange`, `modelchange` and `action`.
The payload is always available as `event.detail`.

## API overview

The [web API reference](https://mploscos.github.io/virtual-tree-canvas/docs/api.html) covers the DOM view, controller,
configuration, filtering, columns, inspector metadata, row actions and events.
For the complete view, start with `TreeView`; access `view.controller` for
lower-level operations such as sorting a column or enabling workers.

```js
tree.setData(nodes);
tree.setModel(model, meta);
tree.setDynamicState(patches);
tree.setTheme(theme);
tree.setColumns(columns);

tree.expand(nodeId);
tree.collapse(nodeId);
tree.toggle(nodeId);
tree.expandAll();
tree.collapseAll();

tree.search(query, { caseSensitive, wholeWord });
tree.setFilter(queryOrPredicate, { caseSensitive, wholeWord });
tree.clearSearch();
tree.clearFilter();

tree.focusNode(nodeId, { align: 'start' | 'center' | 'end' | 'nearest' });
tree.scrollToNode(nodeId, 'center');
tree.scrollTo(x, y);

tree.setSelection(ids);
tree.getSelection();
tree.registerIcon(name, svgOrImage);
tree.enableWorkers();
tree.disableWorkers();
```

## Demo

```bash
npm run demo
```

Open <http://localhost:4173/> for interactive trees, an editable inspector, row ordering and streaming cryptocurrency quotes. The gallery also links to the units example and icon catalogue.

The market table uses [crypto-ai.dev's public WebSocket](https://crypto-ai.dev/docs) without an API key. Its free feed is about 15 seconds delayed. The demo creates the rows once and applies incoming prices with `setDynamicState()`. The feed runs only while the table is visible and the page is active; the Pause feed button closes the connection. Quotes are for demonstration, not a benchmark workload or investment advice. The component itself makes no network requests.

## Tests and type declarations

```bash
npm install
npm test
npm run test:types
npm run test:browser
```

The package includes `.d.ts` declarations for the root entry and public subpaths, so editors can autocomplete the API in JavaScript projects and check types when enabled. No separate `@types` package is needed.

The browser suite requires Chromium. See [CONTRIBUTING.md](./CONTRIBUTING.md) for local development and declaration generation.

## Selecting rows

Selection is limited to one row by default, including `setSelection(ids)`. Set `multiSelect: true` to allow multiple rows:

```js
const view = new TreeView(host, { nodes, multiSelect: true });
// Later: view.configure({ multiSelect: false });
```

With `multiSelect: true`, a normal click selects one row; Ctrl/Command + click adds or removes a row, and Shift + click selects a range. Hold Shift while dragging across row content to select a continuous range of visible rows; Ctrl/Command + Shift + drag adds the range to the existing selection. When `rowDrag` is configured, dragging without Shift exports the selection if the source row is selected, or just the source row otherwise. With `multiSelect: false`, dragging a row exports only that row. The dedicated row-order handle continues to reorder rows. Editors, action buttons and expand/collapse controls keep their own gestures.

## Manual row order

`rowReorder: true` adds a dedicated handle and Up/Down controls to a data table. Set `reorderable: false` on derived or fixed nodes to hide their ordering controls and prevent moving them manually; their parent can still move with its subtree. Dragging commits only on drop; Escape or dropping outside cancels. Alt+Up / Alt+Down moves the focused row. Edge scrolling works while dragging.

```js
const tree = new TreeViewController({
  canvas, host,
  rowReorder: true,
  autoRender: true,
  tooltip: true,
  columns: [
    { id: 'name', kind: 'tree', label: 'Property', width: 300 },
    { id: 'value', label: 'Value', width: 120, value: (_node, state) => state.value }
  ]
});
tree.setData(favoriteRows);
tree.on('rowreorder', ({ detail }) => saveOrder(detail.order));
```

- `moveRow(id, targetIndex)` uses a zero-based index among siblings. `moveRowBy(id, offset)` and `getRowOrder(parentId = null)` are also available.
- Reordering preserves IDs, parent relationships, expansion, selected IDs and live dynamic state. `setDynamicState()` does not change order. `setData()` intentionally installs the order supplied by the host; restore a saved order before calling it.
- Reordering is disabled during sorting/filtering and for object-inspector models (`setModel`). It does not reorder JavaScript object properties or mutate inspected arrays. Use data rows (`setData`) for favorites, with stable IDs and dynamic value columns.
- The `rowreorder` detail contains `nodeId`, `parentId`, `fromIndex`, `toIndex`, `siblingOrder`, `order` and `source`. The host owns persistence and live subscriptions. One row is moved at a time, including its subtree, without reparenting.
- The order column is fixed at 72 CSS px (three 24 px targets) and cannot be sorted, resized or moved. The mode can be toggled with `setRowReorder(enabled)`. Sticky ancestor rows are omitted in this mode.
- `autoRender` coalesces rendering into an animation frame and cancels pending work on `destroy()`. It is opt-in so existing hosts with their own render loop continue to work.
- `tooltip: true` creates a reusable tooltip in `host` (or the canvas parent). The host must provide a positioned container. `attachTooltip({ host })` is also available.
- `setData(nodes, { iconResolver })` allows host-independent visual mapping without mutating the input nodes.

Open [the reorder demo](https://mploscos.github.io/virtual-tree-canvas/examples/reorder-table.html) to try a table with live values. The demo's localStorage is illustrative; the library never persists user data itself.

## Icon catalogue

95 SVGs are included, with a
[rendered visual sheet](https://mploscos.github.io/virtual-tree-canvas/docs/icon-catalog.html), and a
[reference of available icons](./docs/icon-catalog.md). `builtinIconNames`
exposes available IDs.

## Row actions and data dragging

Actions are optional accessible buttons on the right of visible rows. Their icon names use
`IconRegistry`, including registered custom icons. The host handles the action;
clicking a button does not select or expand the row.

```js
const favorites = new Set();
const view = new TreeView(host, {
  nodes,
  rowActions: [{
    id: 'favorite', preloadIcons: ['star', 'star-filled'], icon: node => favorites.has(node.id) ? 'star-filled' : 'star', label: 'Toggle favorite',
    visible: node => !node.data?.group,
    disabled: node => node.data?.unavailable === true,
    pressed: node => favorites.has(node.id)
  }],
  rowDrag: node => node.data?.reference ?? null
});
view.on('rowaction', ({detail}) => {
  if (favorites.has(detail.nodeId)) favorites.delete(detail.nodeId);
  else favorites.add(detail.nodeId);
  view.controller.requestRender();
});
```

`rowActions` accepts unique `id` and accessible `label` strings. `icon`, `visible`,
`disabled` and `pressed` may be functions receiving `(node, dynamicState)`.
`visible`, `disabled` and `pressed` also accept booleans. Buttons remain focusable
with Tab and work with Enter/Space. Only visible-row buttons are mounted; live
value updates preserve their identity and focus.

`rowDrag(node, dynamicState)` returns a payload, or `null` to disable data dragging
for that row. With `multiSelect: true`, hold Shift and drag to select a range, then drag
any selected row to export all selected draggable rows. A plain drag from an unselected
row exports that row directly. With the default single-selection mode, dragging any draggable row exports that row.
The resolver only supplies data; it does not need to inspect the
selection to choose the gesture. The row-order handle only reorders rows. Editors, checkboxes,
action buttons and expand/collapse controls retain their normal behavior.
A small count badge identifies multi-row data drags. Manual reordering shows
an exact canvas snapshot of the source row alongside the insertion line.

The controller emits `rowdragstart`, `rowdragmove`, `rowdragend` and
`rowdragcancel`. The backward-compatible `nodeId`, `payload` and `label` fields
describe the source row. `items`, `nodeIds` and `count` describe the complete
drag selection; every item contains its row's `nodeId`, `payload` and `label`.
Rows whose `rowDrag` resolver returns `null` are omitted. Except on cancellation,
`originalEvent` provides client coordinates. Connect these events to your
application's drop manager to highlight destinations and handle the drop.
The payload is captured at pointer-down; use a stable reference instead of a
snapshot of a live value. The library never moves or deletes exported data.

The [two-tree transfer demo](./examples/transfer-between-trees.html) enables `multiSelect: true` and shows a
complete drop handler. Hold Shift while dragging to select a range, then drag a selected row to export the group. Drop before or after a row,
inside a folder, or in empty space, within either tree. The application updates
the arrays and calls `setData()`; the component does not mutate the source data.

Dragging uses Pointer Events within a document. Escape, pointer cancellation,
loss of pointer capture, removal of the source row and destruction cancel the
gesture. Live value refreshes preserve an ongoing drag. Sorting and filtering
disable manual row reordering but still allow exporting rows. Clear the filter
and cycle the column header through ascending, descending and unsorted to
restore manual ordering. With `rowReorder: true`, Alt+Up/Down also reorders rows.

For actions whose `icon` callback changes between variants, supply `preloadIcons: ['star', 'star-filled']`. The visible action layer prepares these icons in both normal and pressed colors at the current pixel ratio before interaction.
