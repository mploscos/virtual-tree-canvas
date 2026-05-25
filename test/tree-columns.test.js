import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeViewController, defaultTreeTableColumns } from '../src/index.js';

const nodes = [
  { id: 'root', label: 'Root', type: 'root' },
  { id: 'a', parentId: 'root', label: 'Alpha', type: 'sensor' },
  { id: 'b', parentId: 'root', label: 'Bravo', type: 'platform' },
];

test('setColumns updates content width', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1 });
  controller.setData(nodes);
  controller.setColumns([
    { id: 'name', label: 'Name', width: 300, kind: 'tree', value: (node) => node.label },
    { id: 'status', label: 'Status', width: 90, kind: 'status', value: (_node, state) => state.status },
  ]);

  assert.equal(controller.viewport.contentWidth, 390);
});

test('visible rows are unaffected by dynamic patches with columns', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1 });
  controller.setColumns(defaultTreeTableColumns());
  controller.setData(nodes);
  const rowCount = controller.rowModel.rows.length;
  const rebuildCount = controller.rebuildCount;

  controller.setDynamicState([{ id: 'a', state: { status: 1, progress: 0.5, value: 44 } }]);

  assert.equal(controller.rowModel.rows.length, rowCount);
  assert.equal(controller.rebuildCount, rebuildCount);
});

test('horizontal scroll clamps correctly', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1 });
  controller.resize(200, 120);
  controller.setColumns([
    { id: 'name', label: 'Name', width: 300, kind: 'tree', value: (node) => node.label },
    { id: 'value', label: 'Value', width: 160, kind: 'value', value: (_node, state) => state.value },
  ]);
  controller.setData(nodes);

  controller.scrollBy(1000, 0);

  assert.equal(controller.viewport.scrollX, 260);
});

test('hit testing detects tree column chevron vs regular cell', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1, rowHeight: 20, headerHeight: 24 });
  controller.resize(500, 160);
  controller.setColumns([
    { id: 'name', label: 'Name', width: 260, kind: 'tree', value: (node) => node.label },
    { id: 'type', label: 'Type', width: 100, kind: 'type', value: (node) => node.type },
  ]);
  controller.setData(nodes);

  const chevronHit = controller.hitTest(8, 24 + 10);
  const cellHit = controller.hitTest(280, 24 + 10);

  assert.equal(chevronHit.part, 'chevron');
  assert.equal(chevronHit.column.id, 'name');
  assert.equal(cellHit.part, 'cell');
  assert.equal(cellHit.column.id, 'type');
});

test('render scene contains renderer-ready data', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1 });
  controller.setColumns(defaultTreeTableColumns());
  controller.setData(nodes);
  controller.setDynamicState([{ id: 'a', state: { highlighted: true } }]);
  const scene = controller.createRenderScene();

  assert.ok(Array.isArray(scene.rows));
  assert.ok(scene.visibleRange);
  assert.ok(scene.viewport);
  assert.ok(Array.isArray(scene.columns));
  assert.ok(scene.theme.colors);
  assert.ok(Array.isArray(scene.nodes));
  assert.ok(scene.dynamicState instanceof Map);
  assert.ok(scene.selection instanceof Set);
  assert.ok(scene.searchMatches instanceof Set);
  assert.equal('model' in scene, false);
  assert.equal('controller' in scene, false);
  assert.equal('rowModel' in scene, false);
});

test('resizeColumn updates content width and clamps to minWidth', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1 });
  controller.setColumns([
    { id: 'name', label: 'Name', width: 300, minWidth: 180, kind: 'tree', value: (node) => node.label },
    { id: 'value', label: 'Value', width: 100, minWidth: 60, value: (_node, state) => state.value },
  ]);
  controller.setData(nodes);

  assert.equal(controller.resizeColumn('name', 120), true);

  assert.equal(controller.columnModel.getColumn('name').width, 180);
  assert.equal(controller.viewport.contentWidth, 280);
});

test('moveColumn reorders columns without changing visible rows', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1 });
  controller.setColumns(defaultTreeTableColumns());
  controller.setData(nodes);
  const rowIds = controller.rowModel.rows.map((row) => row.nodeId);

  assert.equal(controller.moveColumn('status', 1), true);

  assert.equal(controller.columnModel.columns[1].id, 'status');
  assert.deepEqual(controller.rowModel.rows.map((row) => row.nodeId), rowIds);
});

test('sortBy sorts siblings by column value', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1 });
  controller.setColumns([
    { id: 'name', label: 'Name', width: 300, kind: 'tree', value: (node) => node.label },
  ]);
  controller.setData(nodes);

  controller.sortBy('name', 'desc');

  assert.deepEqual(controller.rowModel.rows.map((row) => row.nodeId), ['root', 'b', 'a']);
});

test('sortBy uses a stable snapshot for dynamic columns', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1 });
  controller.setColumns([
    { id: 'name', label: 'Name', width: 300, kind: 'tree', value: (node) => node.label },
    { id: 'value', label: 'Value', width: 100, kind: 'value', value: (_node, state) => state.value ?? 0 },
  ]);
  controller.setData(nodes);
  controller.setDynamicState([
    { id: 'a', state: { value: 10 } },
    { id: 'b', state: { value: 1 } },
  ]);

  controller.sortBy('value', 'asc');
  assert.deepEqual(controller.rowModel.rows.map((row) => row.nodeId), ['root', 'b', 'a']);

  controller.setDynamicState([
    { id: 'a', state: { value: 0 } },
    { id: 'b', state: { value: 99 } },
  ]);
  controller.setFilter('a');
  controller.clearFilter();

  assert.deepEqual(controller.rowModel.rows.map((row) => row.nodeId), ['root', 'b', 'a']);
});

test('setFilter shows matches and ancestors without changing expansion state', () => {
  const controller = new TreeViewController({ initialExpandDepth: 0 });
  controller.setData([
    { id: 'root', label: 'Root', type: 'root' },
    { id: 'a', parentId: 'root', label: 'Alpha', type: 'sensor' },
    { id: 'a1', parentId: 'a', label: 'Deep Match', type: 'sensor' },
    { id: 'b', parentId: 'root', label: 'Bravo', type: 'platform' },
  ]);

  controller.setFilter('deep');

  assert.deepEqual(controller.rowModel.rows.map((row) => row.nodeId), ['root', 'a', 'a1']);
  assert.equal(controller.expansion.isExpanded('root'), false);
});

test('hit testing detects header resize handles', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1, headerHeight: 24 });
  controller.resize(500, 160);
  controller.setColumns([
    { id: 'name', label: 'Name', width: 260, kind: 'tree', value: (node) => node.label },
    { id: 'type', label: 'Type', width: 100, kind: 'type', value: (node) => node.type },
  ]);
  controller.setData(nodes);

  const hit = controller.hitTest(260, 10);

  assert.equal(hit.area, 'header');
  assert.equal(hit.part, 'resize');
  assert.equal(hit.column.id, 'name');
});
