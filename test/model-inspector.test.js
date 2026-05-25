import assert from 'node:assert/strict';
import test from 'node:test';
import { getAtPath, inspectorColumns, inspectorPaneColumns, ModelInspectorBuilder, setAtPath, TreeViewController } from '../src/index.js';

test('model inspector builder creates path-based nodes with wildcard metadata', () => {
  const model = { sensor: { range: 10 }, tracks: [{ speed: 5 }] };
  const nodes = new ModelInspectorBuilder().build(model, {
    'sensor.range': { min: 0, max: 100 },
    'tracks.*.speed': { integer: true, description: 'Track speed' },
  });
  const range = nodes.find((node) => node.data.path === 'sensor.range');
  const speed = nodes.find((node) => node.data.path === 'tracks.0.speed');

  assert.equal(range.data.editorType, 'range');
  assert.equal(speed.data.meta.description, 'Track speed');
  assert.equal(speed.data.editorType, 'number');
  assert.ok(nodes.some((node) => node.id === 'model:$'));
});

test('model inspector builder can flatten root object', () => {
  const model = { sensor: { range: 10 }, tracks: [] };
  const nodes = new ModelInspectorBuilder().build(model, {}, { flatRoot: true });

  assert.ok(!nodes.some((node) => node.id === 'model:$'));
  assert.equal(nodes.find((node) => node.data.path === 'sensor').parentId, null);
  assert.equal(nodes.find((node) => node.data.path === 'tracks').parentId, null);
  assert.equal(nodes.find((node) => node.data.path === 'sensor.range').parentId, 'model:sensor');
});

test('model inspector builder can enforce explicit metadata for editable fields', () => {
  const model = { sensor: { range: 10, gain: 0.5 }, tracks: [{ speed: 5 }] };
  const nodes = new ModelInspectorBuilder().build(model, {
    'sensor.range': { min: 0, max: 100 },
    'tracks.*.speed': { min: 0, max: 900 },
  }, { enforceMeta: true });
  const range = nodes.find((node) => node.data.path === 'sensor.range');
  const gain = nodes.find((node) => node.data.path === 'sensor.gain');
  const speed = nodes.find((node) => node.data.path === 'tracks.0.speed');
  const sensor = nodes.find((node) => node.data.path === 'sensor');

  assert.equal(range.data.disabled, false);
  assert.equal(range.data.readonly, false);
  assert.equal(gain.data.disabled, true);
  assert.equal(gain.data.readonly, true);
  assert.equal(speed.data.disabled, false);
  assert.equal(sensor.data.disabled, false);
});

test('model inspector builder applies type and icon metadata', () => {
  const nodes = new ModelInspectorBuilder().build({ classname: 'rpr.Aircraft' }, {
    classname: { type: 'platform', icon: 'aircraft' },
  }, { flatRoot: true });
  const classname = nodes.find((node) => node.data.path === 'classname');

  assert.equal(classname.type, 'platform');
  assert.equal(classname.icon, 'aircraft');
});

test('model path get/set updates nested values', () => {
  const model = { tracks: [{ speed: 5 }] };

  assert.equal(getAtPath(model, 'tracks.0.speed'), 5);
  assert.equal(setAtPath(model, 'tracks.0.speed', 12), 5);
  assert.equal(model.tracks[0].speed, 12);
});

test('inspector columns expose value column', () => {
  const columns = inspectorColumns();

  assert.equal(columns[0].kind, 'tree');
  assert.equal(columns[1].kind, 'inspectorValue');
});

test('inspector pane columns expose compact single-column mode', () => {
  const columns = inspectorPaneColumns();

  assert.equal(columns.length, 1);
  assert.equal(columns[0].kind, 'inspectorPane');
});

test('setModel pane presentation does not inject redundant tree column', () => {
  const controller = new TreeViewController();

  controller.setModel({ sensor: { range: 10 } }, {}, { presentation: 'pane' });

  assert.deepEqual(controller.columnModel.columns.map((column) => column.kind), ['inspectorPane']);
});

test('pane inspector column fits the canvas width after resize', () => {
  const controller = new TreeViewController();
  controller.setModel({ sensor: { range: 10 } }, {}, { presentation: 'pane' });
  controller.canvas = { clientWidth: 320, clientHeight: 200 };

  controller.renderMeasured();

  assert.equal(controller.columnModel.columns[0].width, 320);
  assert.equal(controller.viewport.contentWidth, 320);
});

test('setModel supports flatRoot and enforceMeta inspector options', () => {
  const controller = new TreeViewController();
  controller.setModel({ sensor: { range: 10, gain: 0.5 } }, {
    'sensor.range': { min: 0, max: 100 },
  }, { presentation: 'pane', flatRoot: true, enforceMeta: true });

  assert.equal(controller.model.index.getNode('model:$'), null);
  assert.equal(controller.model.index.getNode('model:sensor').parentId, null);
  assert.equal(controller.updateInspectorValue('model:sensor.range', 12, 'number'), true);
  assert.equal(controller.updateInspectorValue('model:sensor.gain', 0.8, 'number'), false);
});

test('setModel preserves expansion after inspector refreshes', () => {
  const controller = new TreeViewController();
  controller.setModel({ sensor: { range: 10, gain: 1 } }, {}, { presentation: 'pane', flatRoot: true });

  assert.equal(controller.expansion.isExpanded('model:sensor'), true);
  controller.collapse('model:sensor');
  assert.equal(controller.expansion.isExpanded('model:sensor'), false);

  controller.setModel({ sensor: { range: 12, gain: 2 } }, {}, { presentation: 'pane', flatRoot: true });

  assert.equal(controller.expansion.isExpanded('model:sensor'), false);
});

test('setModel can expose a header filter for pane inspector mode', () => {
  const controller = new TreeViewController();
  controller.setModel({ sensor: { range: 10 } }, {
    'sensor.range': { min: 0, max: 100 },
  }, { presentation: 'pane', flatRoot: true, filter: true });

  const scene = controller.createRenderScene();

  assert.equal(scene.headerFilter, true);
  assert.equal(scene.filterQuery, '');
});

test('inspector filter ignores the internal model id prefix', () => {
  const controller = new TreeViewController();
  controller.setModel({ sensor: { mode: 'track', color: '#38bdf8' } }, {
    'sensor.mode': { options: { Track: 'track' } },
    'sensor.color': { color: true },
  }, { presentation: 'pane', flatRoot: true, filter: true });

  controller.setFilter('mode');
  assert.deepEqual(
    controller.rowModel.rows.map((row) => controller.model.index.getNode(row.nodeId).data.path),
    ['sensor', 'sensor.mode']
  );

  controller.setFilter('color');
  assert.deepEqual(
    controller.rowModel.rows.map((row) => controller.model.index.getNode(row.nodeId).data.path),
    ['sensor', 'sensor.color']
  );
});

test('inspector edits mark updated without search highlight background', () => {
  const controller = new TreeViewController();
  controller.setModel({ sensor: { range: 10 } });

  assert.equal(controller.updateInspectorValue('model:sensor.range', 12, 'number'), true);

  const state = controller.model.dynamicState.get('model:sensor.range');
  assert.equal(state.updated, true);
  assert.equal(state.highlighted, undefined);
});

test('inspector can disable edit updated markers', () => {
  const controller = new TreeViewController();
  controller.setModel({ sensor: { range: 10 } }, {}, { markUpdated: false });

  assert.equal(controller.updateInspectorValue('model:sensor.range', 12, 'number'), true);

  assert.equal(controller.model.dynamicState.get('model:sensor.range')?.updated, undefined);
});

test('inspector can add and remove array items', () => {
  const model = { tracks: [] };
  const controller = new TreeViewController();
  controller.setModel(model, { tracks: { itemType: 'object' } }, { presentation: 'pane' });

  assert.equal(controller.addInspectorArrayItem('model:tracks'), true);
  assert.deepEqual(model.tracks, [{}]);
  assert.equal(controller.removeInspectorArrayItem('model:tracks'), true);
  assert.deepEqual(model.tracks, []);
});
