# virtual-tree-canvas

`virtual-tree-canvas` is a framework-agnostic Canvas2D virtual tree/table widget for large hierarchical datasets.

It behaves like a normal TreeView or tree-table component, but renders into a canvas instead of creating one DOM element per row.

## Features

- Virtualized tree rows
- Tree-table columns
- Expand/collapse
- Single and multi-selection
- Search and focus
- Keyboard navigation
- Horizontal and vertical scrolling
- Themes and type-based styles
- Canvas vector icons and image icons
- Batched dynamic state updates
- Benchmark/demo mode

No React, Web Components, or frontend framework required.

## Install

```bash
npm install virtual-tree-canvas
```

## Performance Model

The renderer only draws visible rows plus a small overscan range.

Dynamic updates are handled as patches:

```js
tree.setDynamicState([
  { id: 'node-1', state: { status: 1, progress: 0.7, value: 42 } }
]);
```

Dynamic patches update node state without rebuilding:

- tree indexes
- visible rows
- expansion state
- layout

Cold-path operations such as `setData()`, expand/collapse, and search may rebuild the visible row list.

For large datasets, `enableWorkers()` moves search and filtered row rebuilds off the main thread when browser Workers are available. The synchronous APIs remain available for small datasets, tests, and custom integrations.

## Basic Usage

```js
import { TreeViewController } from 'virtual-tree-canvas';

const canvas = document.querySelector('canvas');
const tree = new TreeViewController({ canvas });

tree.setData([
  { id: 'root', label: 'Root', type: 'root' },
  { id: 'child-1', parentId: 'root', label: 'Child', type: 'sensor' }
]);
```

## Public API

```js
tree.setData(nodes);
tree.setModel(model, meta, { presentation: 'pane' });
tree.setDynamicState(patches);

tree.expand(nodeId);
tree.collapse(nodeId);
tree.toggle(nodeId);
tree.expandAll();
tree.collapseAll();

tree.search(query);
tree.searchAsync(query);
tree.clearSearch();
tree.getSearchState();
tree.nextSearchResult();
tree.previousSearchResult();
tree.setFilter(queryOrPredicate);
tree.setFilterAsync(query);
tree.clearFilter();

tree.focusNode(nodeId);
tree.scrollToNode(nodeId, 'center');

tree.getSelection();
tree.setSelection(['node-1', 'node-2']);
tree.clearSelection();

tree.setTheme(theme);
tree.setColumns(columns);
tree.resizeColumn(columnId, width);
tree.moveColumn(columnId, targetIndex);
tree.sortBy(columnId, 'asc');
tree.clearSort();
tree.registerIcon('custom', imageOrUrlOrDrawFunction);

tree.enableWorkers();
tree.disableWorkers();
```

## Model Inspector

`setModel(model, meta, options)` renders plain JSON-like objects as an editable inspector.

```js
tree.setModel(
  {
    sensor: { enabled: true, range: 72, mode: 'track' },
    tracks: [{ id: 'T-100', speed: 430 }]
  },
  {
    'sensor.range': { min: 0, max: 120, step: 1, integer: true },
    'sensor.mode': { options: { Search: 'search', Track: 'track' } },
    'tracks.*.speed': { min: 0, max: 900, step: 5 },
    'tracks.*.id': { readonly: true }
  }
);
```

Inspector options:

```js
tree.setModel(model, meta, {
  presentation: 'pane',
  flatRoot: true,    // render root properties directly
  enforceMeta: true, // fields without metadata are readonly/disabled
  filter: true,      // use the header as a filter input
  markUpdated: false // do not show update dots for local user edits
});
```

Presentations:

```js
tree.setModel(model, meta, { presentation: 'pane' });  // compact folders + key/value controls
tree.setModel(model, meta, { presentation: 'table' }); // Property | Value | Type | Description
```

Metadata is path-based. Dot paths target object properties, and array items use numeric indexes or `*` wildcards:

```text
sensor.range
tracks.0.speed
tracks.*.speed
```

Inspector editors are inferred from values and metadata: checkbox, range, number, text, select, color, button, object, and array.

Inspector events:

```js
tree.on('valuechange', (event) => {});
tree.on('modelchange', (event) => {});
tree.on('action', (event) => {});
```

`scrollToNode()` supports:

```text
start | center | end | nearest
```

## Events

```js
tree.on('nodehover', (event) => {});
tree.on('nodeclick', (event) => {});
tree.on('nodedblclick', (event) => {});
tree.on('selectionchange', (event) => {});
tree.on('expand', (event) => {});
tree.on('collapse', (event) => {});
tree.on('focuschange', (event) => {});
tree.on('searchchange', (event) => {});
tree.on('filterchange', (event) => {});
tree.on('sortchange', (event) => {});
tree.on('columnschange', (event) => {});
tree.on('viewportchange', (event) => {});
```

The event payload is available as `event.detail`.

## Columns

```js
tree.setColumns([
  {
    id: 'name',
    label: 'Name',
    width: 340,
    minWidth: 160,
    align: 'left',
    kind: 'tree',
    value: (node) => node.label ?? node.id
  },
  {
    id: 'status',
    label: 'Status',
    width: 84,
    minWidth: 64,
    align: 'center',
    kind: 'status',
    value: (_node, state) => state.status
  }
]);
```

Column shape:

```js
{
  id: 'status',
  label: 'Status',
  width: 80,
  minWidth: 40,
  align: 'left' | 'center' | 'right',
  kind: 'tree' | 'status' | 'value' | 'progress' | 'type' | 'updated' | 'text',
  sortable: true,
  value: (node, state) => string | number,
  render: (ctx, cell) => {}
}
```

Built-in helpers:

```js
import { builtInColumns, defaultTreeTableColumns } from 'virtual-tree-canvas';
```

The tree column renders indentation, chevron, icon, and label. Other columns render table cells and participate in horizontal scrolling.

Columns can be resized, reordered, and sorted through the controller API. The demo also supports header click sorting and drag-to-resize on column edges.

## Themes

```js
tree.setTheme({
  rowHeight: 28,
  indentWidth: 18,
  font: '12px system-ui',
  colors: {
    background: '#0b1020',
    row: '#0b1020',
    rowHover: '#111827',
    rowSelected: '#1e3a8a',
    rowHighlighted: '#3b0764',
    text: '#e5e7eb',
    textMuted: '#94a3b8',
    guide: '#1f2937',
    chevron: '#94a3b8',
    focus: '#38bdf8',
    progressTrack: '#1f2937',
    progressFill: '#22c55e',
    badgeText: '#ffffff'
  },
  types: {
    root: { icon: 'folder', color: '#38bdf8' },
    platform: { icon: 'aircraft', color: '#60a5fa' },
    sensor: { icon: 'radar', color: '#34d399' },
    warning: { icon: 'warning', color: '#facc15' },
    error: { icon: 'error', color: '#ef4444' }
  },
  statuses: {
    0: { label: 'OK', color: '#22c55e' },
    1: { label: 'WARN', color: '#facc15' },
    2: { label: 'ERR', color: '#ef4444' }
  }
});
```

Built-in theme exports:

```js
import { themes, darkTheme, lightTheme, tacticalTheme } from 'virtual-tree-canvas';
```

Style resolution order:

1. Dynamic state override, such as `state.color`
2. Node type rule, such as `theme.types.sensor`
3. Default theme color

## Icons

Built-in Canvas2D vector icons:

```text
folder, aircraft, radar, warning, error, task, track, placeholder
```

Register custom icons:

```js
tree.registerIcon('camera', imageElement);
tree.registerIcon('camera-url', '/icons/camera.png');
tree.registerIcon('custom-vector', (ctx, x, y, size, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
});
```

Icons are cached by name and drawn only for rendered rows.

## Demo

```bash
npm run demo
```

Open:

```text
http://localhost:4173/demo/
```

Inspector demo:

```text
http://localhost:4173/demo/inspector.html
```

The demo includes dataset sizes, update rates, benchmark stats, search, filtering, selection, expand/collapse, themes, and tree-table columns.

Benchmark stats separate frame, patch, scene, render, search, filter, and worker timings. Use "Copy JSON" to export the current sample.

## Tests

```bash
npm test
```
