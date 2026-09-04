# virtual-tree-canvas

**A fast, framework-agnostic tree and tree-table for large hierarchical data.**

`virtual-tree-canvas` gives applications the interactions users expect from a
native tree view—expandable branches, columns, selection, search, filtering and
keyboard navigation—without creating a DOM node for every row. It renders only
what is visible with Canvas2D, so it stays responsive as data and live updates
grow.

![Editable model inspector built with virtual-tree-canvas](./docs/inspector-demo.png)

## Why use it?

- **Built for large trees.** Only visible rows plus a small overscan range are painted.
- **Interactive by default.** Tree-table columns, sorting, resizing, selection, focus, tooltips and keyboard navigation are included.
- **Good for live data.** Batched state patches update status, progress and values without rebuilding the tree.
- **Framework-free.** Use it directly from browser JavaScript; no React or Web Component runtime is required.
- **Easy to style.** Built-in dark, light and tactical themes, type-based styling, and editable SVG icons.
- **Ready for inspectors.** Turn plain JavaScript objects into compact editable forms or property tables.

## Install

```bash
npm install virtual-tree-canvas
```

## Quick start

```html
<canvas id="assets-tree"></canvas>
```

```css
#assets-tree {
  display: block;
  width: 100%;
  height: 480px;
}
```

```js
import { TreeViewController } from 'virtual-tree-canvas';

const tree = new TreeViewController({
  canvas: document.querySelector('#assets-tree'),
  initialExpandDepth: 2,
});

tree.setData([
  { id: 'fleet', label: 'Fleet', type: 'root' },
  { id: 'radar-1', parentId: 'fleet', label: 'Forward radar', type: 'sensor' },
  { id: 'track-100', parentId: 'radar-1', label: 'Track T-100', type: 'track' },
]);

tree.setDynamicState([
  { id: 'radar-1', state: { status: 0, progress: 0.72 } },
  { id: 'track-100', state: { status: 1, value: 430 } },
]);

tree.render();
```

The controller observes the canvas size. Call `tree.render()` from your own
animation loop when the data is live, or after changing data in a static view.

![Virtual tree-table with status, progress and SVG icons](./docs/tree-demo.png)

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

`setData()`, expand/collapse, sorting and filtering are structural operations
and may rebuild the visible row list. For very large datasets,
`enableWorkers()` moves search and filtered row rebuilds off the main thread
when Workers are available.

## Columns

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

## Themes and icons

Three themes are included:

```js
import { darkTheme, lightTheme, tacticalTheme } from 'virtual-tree-canvas';

tree.setTheme(tacticalTheme);
```

Themes can map domain types to a colour and icon:

```js
tree.setTheme({
  rowHeight: 28,
  font: '12px system-ui',
  types: {
    root: { icon: 'folder', color: '#38bdf8' },
    platform: { icon: 'aircraft', color: '#60a5fa' },
    sensor: { icon: 'radar', color: '#34d399' },
    warning: { icon: 'warning', color: '#facc15' },
  },
});
```

Built-in icons are editable SVG files in [`src/assets/icons`](./src/assets/icons).
They are preloaded and rasterized once per icon, colour, CSS size and device
pixel ratio. Rendering rows then uses a cached `drawImage`, not SVG parsing or
path drawing.

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

`setModel()` renders JSON-like data as an editable inspector. Metadata controls
the editor, bounds, choices, labels and descriptions.

```js
tree.setModel(
  {
    sensor: { enabled: true, range: 72, mode: 'track' },
    tracks: [{ id: 'T-100', speed: 430 }],
  },
  {
    'sensor.range': { min: 0, max: 120, step: 1, integer: true },
    'sensor.mode': { options: { Search: 'search', Track: 'track' } },
    'tracks.*.speed': { min: 0, max: 900, step: 5 },
    'tracks.*.id': { readonly: true },
  },
  { presentation: 'pane', flatRoot: true },
);
```

Choose `presentation: 'pane'` for a compact folder-and-controls view, or
`presentation: 'table'` for Property / Value / Type / Description columns.
Editors are inferred from data and metadata: checkbox, range, number, text,
select, colour, button, object and array.

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

```js
tree.setData(nodes);
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

Open <http://localhost:4173/demo/> for the large-tree benchmark, or
<http://localhost:4173/demo/inspector.html> for the editable inspector demo.

## Tests

```bash
npm test
```
