import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeViewController, TreeView } from '../src/index.js';
import { treeViewDefaults } from '../src/core/view-options.js';

// Test configuration against the real controller without replacing the model, events or renderer.
function viewFixture() {
  const view = Object.create(TreeView.prototype);
  Object.assign(view, { options: { ...treeViewDefaults, nodes: [], model: {}, meta: {} }, pending: null, scheduled: false, destroyed: false, flushing: false, refreshPending: true });
  view._controller = new TreeViewController();
  view.syncLayout = () => {};
  view.applyTheme = () => view._controller.setTheme(view.options.theme);
  view.configure({ nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], rowReorder: true });
  view.flush();
  return view;
}

test('visual configuration preserves row order, selection, live values and custom icons', () => {
  const view = viewFixture(), controller = view.controller;
  controller.moveRow('a', 2);
  controller.setSelection(['b']);
  controller.setDynamicState([{ id: 'b', state: { value: 42 } }]);
  controller.registerIcon('custom', () => {});
  const nodes = controller.model.nodes;
  view.configure({ editable: false, filter: false, rowHeight: 36, indentWidth: 24, initialExpandDepth: 0 });
  assert.equal(view.controller, controller);
  assert.equal(controller.model.nodes, nodes);
  assert.deepEqual(controller.getRowOrder(), ['b', 'c', 'a']);
  assert.deepEqual(controller.getSelection(), ['b']);
  assert.equal(controller.model.dynamicState.get('b').value, 42);
  assert.equal(controller.iconRegistry.icons.has('custom'), true);
  assert.equal(controller.initialExpandDepth, 0);
});

test('theme applies once, explicit dimensions win and can be reset to theme defaults', () => {
  const view = viewFixture(), controller = view.controller;
  let calls = 0;
  const setTheme = controller.setTheme.bind(controller);
  controller.setTheme = theme => { calls++; setTheme(theme); };
  view.configure({ rowHeight: 36, indentWidth: 24 });
  view.setTheme('light');
  assert.equal(calls, 1);
  assert.equal(controller.rowModel.rowHeight, 36);
  assert.equal(controller.rowModel.indentWidth, 24);
  view.configure({ rowHeight: undefined, indentWidth: undefined });
  view.flush();
  assert.equal(controller.rowModel.rowHeight, 28);
  assert.equal(controller.rowModel.indentWidth, 18);
});

test('explicit data/model installation refreshes mutated references and mode changes are applied', () => {
  const view = viewFixture(), nodes = view.options.nodes;
  nodes.push({ id: 'new' });
  view.setData(nodes);
  assert.equal(view.controller.model.nodes.length, 4);
  const model = { speed: 1 };
  view.setModel(model);
  model.speed = 2;
  view.setModel(model);
  assert.equal(view.controller.model.index.getNode('model:speed').data.value, 2);
  view.configure({ mode: 'tree' });
  assert.equal(view.controller.inspector, null);
  view.configure({ mode: 'inspector' });
  assert.equal(view.controller.inspector.model, model);
});

test('reset columns and resolve icons without reinstalling or reordering data', () => {
  const view = viewFixture();
  view.setColumns([{ id: 'custom' }]);
  view.configure({ columns: null });
  assert.deepEqual(view.controller.columnModel.columns.map(c => c.id), ['__vtc_row_order', 'name']);
  view.moveRow('a', 2);
  view.configure({ iconResolver: () => 'person' });
  assert.deepEqual(view.controller.getRowOrder(), ['b', 'c', 'a']);
  assert.equal(view.controller.model.index.getNode('a').icon, 'person');
});

test('invalid configuration is rejected before applying any option', () => {
  const view = viewFixture();
  assert.throws(() => view.configure({ editable: false, theme: 'missing' }), /Unknown/);
  assert.equal(view.controller.editable, true);
  assert.throws(() => view.configure({ rowHeight: -1 }), /positive/);
  assert.throws(() => view.configure({ mode: 'invalid' }), /mode/);
  assert.throws(() => view.setModel(undefined), /undefined/);
});

test('inspector write by path supports silent updates and preserves numeric units and precision', () => {
  const c = new TreeViewController({ autoRender: true });
  const model = { speed: 1.2345 };
  c.setModel(model, { speed: { unit: 'm/s', precision: 2 } }, { flatRoot: true });
  const events = [];
  c.on('valuechange', e => events.push(e));
  c.on('modelchange', e => events.push(e));
  assert.equal(c.setInspectorValue('speed', 9.8765, { emit: false }), true);
  assert.equal(events.length, 0);
  assert.equal(model.speed, 9.8765);
  assert.equal(c.model.index.getNode('model:speed').data.valueText, '9.88');
  assert.equal(c.setInspectorValue('speed', 3.4567), true);
  assert.equal(events.length, 2);
  assert.equal(events[0].detail.source, 'api');
  assert.equal(events[0].detail.model, model);
});

test('editor close and editability are owned by the controller, without host listeners', () => {
  const c = new TreeViewController();
  let closed = 0;
  c.cellEditor = { close() { closed++; }, setEditable(enabled) { if (!enabled) this.close(); } };
  c.closeEditor();
  assert.equal(closed, 1);
  c.setEditable(false);
  assert.equal(closed, 2);
});

test('new inspector branches use initial expansion while collapsed existing branches stay collapsed', () => {
  const c = new TreeViewController({ initialExpandDepth: 3 });
  const model = { old: { value: 1 } };
  c.setModel(model, {}, { flatRoot: true });
  c.collapse('model:old');
  model.new = { value: 2 };
  c.setModel(model, {}, { flatRoot: true });
  assert.equal(c.model.expanded.has('model:old'), false);
  assert.equal(c.model.expanded.has('model:new'), true);
});
