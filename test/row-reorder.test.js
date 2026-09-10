import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeViewController } from '../src/index.js';
import { RowReorderInput } from '../src/input/row-reorder-input.js';

const nodes = [
  { id: 'a', label: 'Alpha' }, { id: 'a1', parentId: 'a', label: 'Nested' },
  { id: 'b', label: 'Bravo' }, { id: 'c', label: 'Charlie' }
];
function make(options = {}) {
  const controller = new TreeViewController({ rowReorder: true, initialExpandDepth: 10, ...options });
  controller.setData(nodes);
  controller.resize(500, 180);
  return controller;
}

test('manual row order preserves IDs, hierarchy, expansion, selection and live values', () => {
  const controller = make();
  controller.setDynamicState([{ id: 'a', state: { value: 42 } }]);
  controller.setSelection(['a', 'b']);
  const expanded = [...controller.model.expanded];
  const values = controller.model.dynamicState.get('a');
  const events = [];
  controller.on('rowreorder', event => events.push(event.detail));
  assert.equal(controller.moveRow('a', 2), true);
  assert.deepEqual(controller.getRowOrder(), ['b', 'c', 'a']);
  assert.deepEqual(controller.rowModel.rows.map(row => row.nodeId), ['b', 'c', 'a', 'a1']);
  assert.deepEqual(controller.getSelection(), ['a', 'b']);
  assert.deepEqual([...controller.model.expanded], expanded);
  assert.equal(controller.model.dynamicState.get('a'), values);
  assert.equal(values.value, 42);
  assert.equal(controller.focusedId, 'a');
  assert.deepEqual(nodes.map(node => node.id), ['a', 'a1', 'b', 'c']);
  assert.deepEqual(events[0].siblingOrder, ['b', 'c', 'a']);
  assert.equal(events[0].fromIndex, 0);
  assert.equal(events[0].toIndex, 2);
  controller.setDynamicState([{ id: 'a', state: { value: 99 } }]);
  assert.deepEqual(controller.getRowOrder(), ['b', 'c', 'a']);
});

test('reorder is opt-in, sibling-only and unavailable for filtered, sorted or inspector rows', () => {
  const controller = make({ rowReorder: false });
  assert.equal(controller.moveRow('a', 1), false);
  controller.setRowReorder(true);
  assert.equal(controller.moveRow('a1', 2), false);
  assert.equal(controller.moveRow('missing', 0), false);
  assert.equal(controller.moveRow('a', 1.5), false);
  controller.sortBy('name');
  assert.equal(controller.moveRow('a', 1), false);
  controller.clearSort();
  controller.setFilter('Alpha');
  assert.equal(controller.moveRow('a', 1), false);
  controller.clearFilter();
  assert.equal(controller.moveRow('a', 1), true);
  controller.setModel({ value: 1 }, {}, { presentation: 'pane' });
  assert.equal(controller.canReorderRows(), false);
  assert.ok(!controller.columnModel.columns.some(column => column.kind === 'rowOrder'));
  controller.setData(nodes);
  assert.equal(controller.columnModel.columns[0].kind, 'rowOrder');
  assert.equal(controller.columnModel.columns[1].kind, 'tree');
  controller.setModel({ value: 1 }, {}, { presentation: 'table' });
  controller.setData(nodes);
  assert.deepEqual(controller.columnModel.columns.map(column => column.kind), ['rowOrder', 'tree']);
});

test('keyboard movement keeps focus on the moved row and respects boundaries', () => {
  const controller = make();
  controller.focusNode('b');
  assert.equal(controller.handleKey({ key: 'ArrowUp', altKey: true }), true);
  assert.deepEqual(controller.getRowOrder(), ['b', 'a', 'c']);
  assert.equal(controller.focusedId, 'b');
  controller.handleKey({ key: 'ArrowUp', altKey: true });
  assert.deepEqual(controller.getRowOrder(), ['b', 'a', 'c']);
  controller.handleKey({ key: 'ArrowDown', altKey: true });
  assert.deepEqual(controller.getRowOrder(), ['a', 'b', 'c']);
});

test('manual-order column survives column changes without becoming sortable or resizable', () => {
  const controller = make();
  controller.setColumns([{ id: 'name', kind: 'tree', width: 200 }, { id: 'value', width: 100 }]);
  assert.equal(controller.columnModel.columns[0].id, '__vtc_row_order');
  assert.equal(controller.resizeColumn('__vtc_row_order', 200), false);
  assert.equal(controller.sortBy('__vtc_row_order'), false);
  controller.moveColumn('value', 0);
  assert.equal(controller.columnModel.columns[0].id, '__vtc_row_order');
  controller.setRowReorder(false);
  assert.ok(!controller.columnModel.columns.some(column => column.kind === 'rowOrder'));
});

function pointer(type, x, y, pointerId = 1) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, button: 0, pointerId });
  return event;
}
function inputFixture() {
  const controller = make();
  controller.setData([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const view = new EventTarget();
  const canvas = new EventTarget();
  canvas.ownerDocument = { defaultView: view };
  canvas.style = {};
  canvas.focus = () => {};
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0 });
  controller.canvas = canvas;
  const input = new RowReorderInput(controller);
  return { controller, view, canvas, input };
}

test('pointer drag has a threshold and changes order only on a valid drop', () => {
  const { controller, view, canvas, input } = inputFixture();
  try {
    canvas.dispatchEvent(pointer('pointerdown', 12, 40));
    view.dispatchEvent(pointer('pointermove', 12, 42));
    assert.equal(input.gesture.dragging, false);
    view.dispatchEvent(pointer('pointermove', 12, 107));
    assert.deepEqual(controller.getRowOrder(), ['a', 'b', 'c']);
    assert.equal(controller.rowDrop.index, 2);
    view.dispatchEvent(pointer('pointerup', 12, 107));
    assert.deepEqual(controller.getRowOrder(), ['b', 'c', 'a']);
    assert.equal(controller.rowDrop, null);
  } finally { input.destroy(); }
});

test('pointer cancellation, Escape and dropping outside leave the order unchanged', () => {
  for (const cancel of ['pointercancel', 'Escape', 'outside', 'filter']) {
    const { controller, view, canvas, input } = inputFixture();
    try {
      canvas.dispatchEvent(pointer('pointerdown', 12, 40));
      view.dispatchEvent(pointer('pointermove', 12, 107));
      if (cancel === 'pointercancel') view.dispatchEvent(pointer('pointercancel', 12, 107));
      if (cancel === 'Escape') {
        const event = new Event('keydown'); Object.assign(event, { key: 'Escape' }); canvas.dispatchEvent(event);
      }
      if (cancel === 'outside') view.dispatchEvent(pointer('pointerup', 600, 107));
      if (cancel === 'filter') controller.setFilter('a');
      assert.deepEqual(controller.getRowOrder(), ['a', 'b', 'c']);
      assert.equal(input.gesture, null);
    } finally { input.destroy(); }
  }
});

test('up/down buttons provide movement without dragging', () => {
  const { controller, view, canvas, input } = inputFixture();
  try {
    canvas.dispatchEvent(pointer('pointerdown', 60, 40));
    view.dispatchEvent(pointer('pointerup', 60, 40));
    assert.deepEqual(controller.getRowOrder(), ['b', 'a', 'c']);
  } finally { input.destroy(); }
});
