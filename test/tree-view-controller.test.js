import assert from 'node:assert/strict';
import test from 'node:test';
import { CellEditorManager, TreeViewController, TreeViewInputController } from '../src/index.js';

const nodes = [
  { id: 'root', label: 'Root' },
  { id: 'a', parentId: 'root', label: 'A', type: 'group' },
  { id: 'a1', parentId: 'a', label: 'A1' },
  { id: 'a2', parentId: 'a', label: 'A2' },
  { id: 'b', parentId: 'root', label: 'B', type: 'group' },
  { id: 'b1', parentId: 'b', label: 'B1' },
  { id: 'b2', parentId: 'b', label: 'B2' },
  { id: 'c', parentId: 'root', label: 'C' },
];

function createController() {
  const controller = new TreeViewController({ initialExpandDepth: 1, rowHeight: 20 });
  controller.resize(200, 60);
  controller.setData(nodes);
  return controller;
}

test('visible rows rebuild after expand and collapse', () => {
  const controller = createController();
  assert.deepEqual(controller.rowModel.rows.map((row) => row.nodeId), ['root', 'a', 'b', 'c']);

  controller.expand('a');
  assert.deepEqual(controller.rowModel.rows.map((row) => row.nodeId), ['root', 'a', 'a1', 'a2', 'b', 'c']);

  controller.collapse('root');
  assert.deepEqual(controller.rowModel.rows.map((row) => row.nodeId), ['root']);
});

test('scrollToNode supports alignment modes', () => {
  const controller = createController();
  controller.expandAll();
  controller.scrollToNode('b1', 'start');
  assert.equal(controller.viewport.scrollY, 5 * 20);

  controller.scrollToNode('b1', 'center');
  assert.equal(controller.viewport.scrollY, 5 * 20 - 6);

  controller.scrollToNode('b1', 'end');
  assert.equal(controller.viewport.scrollY, 5 * 20 + 20 - 32);
});

test('keyboard navigation moves focus through visible rows', () => {
  const controller = createController();
  controller.setSelection(['root']);

  controller.handleKey({ key: 'ArrowDown' });
  assert.equal(controller.selection.focused, 'a');

  controller.handleKey({ key: 'End' });
  assert.equal(controller.selection.focused, 'c');

  controller.handleKey({ key: 'Home' });
  assert.equal(controller.selection.focused, 'root');

  controller.handleKey({ key: 'PageDown' });
  assert.equal(controller.selection.focused, 'a');
});

test('shift selection selects a visible row range', () => {
  const controller = createController();
  controller.expand('a');
  controller.selectRow(1);
  controller.selectRow(3, { shiftKey: true });

  assert.deepEqual(controller.getSelection(), ['a', 'a1', 'a2']);
});

test('ctrl and cmd toggle individual row selection', () => {
  const controller = createController();
  controller.selectRow(1);
  controller.selectRow(2, { ctrlKey: true });
  assert.deepEqual(controller.getSelection(), ['a', 'b']);

  controller.selectRow(1, { metaKey: true });
  assert.deepEqual(controller.getSelection(), ['b']);
});

test('dynamic patches do not rebuild visible rows', () => {
  const controller = createController();
  const rebuildCount = controller.rebuildCount;
  const rowCount = controller.rowModel.rows.length;

  controller.setDynamicState([{ id: 'a', state: { progress: 0.7, status: 2, value: 42 } }]);

  assert.equal(controller.rebuildCount, rebuildCount);
  assert.equal(controller.rowModel.rows.length, rowCount);
  assert.equal(controller.model.dynamicState.get('a').progress, 0.7);
  assert.equal(controller.getStats().dirtyNodes, 1);
});

test('search state tracks cursor and clearSearch removes highlights', () => {
  const controller = createController();
  const results = controller.search('b');

  assert.equal(results.length, 3);
  assert.equal(controller.getSearchState().current, 'b');
  assert.equal(controller.nextSearchResult(), 'b1');
  assert.equal(controller.getSearchState().cursor, 1);

  controller.clearSearch();

  assert.equal(controller.getSearchState().count, 0);
  assert.equal(controller.searchHighlights.size, 0);
  assert.equal(controller.model.dynamicState.get('b').highlighted, false);
});

test('ctrl+a selects all visible rows', () => {
  const controller = createController();

  assert.equal(controller.handleKey({ key: 'a', ctrlKey: true }), true);

  assert.deepEqual(controller.getSelection(), ['root', 'a', 'b', 'c']);
});

test('public initialization APIs fail on invalid dependencies', () => {
  const controller = new TreeViewController();

  assert.throws(() => controller.initialize({}), /HTMLCanvasElement/);
  assert.throws(() => new TreeViewInputController({}), /TreeViewController/);
  assert.throws(() => new CellEditorManager({ controller }), /initialized/);
});

test('layout metrics update rows through controller API', () => {
  const controller = createController();

  controller.setLayoutMetrics({ rowHeight: 24, indentWidth: 20, headerHeight: 10 });

  assert.equal(controller.rowModel.rowHeight, 24);
  assert.equal(controller.viewport.rowHeight, 24);
  assert.equal(controller.rowModel.indentWidth, 20);
  assert.equal(controller.viewport.headerHeight, 10);
  assert.throws(() => controller.setLayoutMetrics({ rowHeight: 0 }), /rowHeight/);
});

test('native scrollbar bridge stays synchronized with viewport scroll', () => {
  const previousDocument = globalThis.document;
  const previousComputedStyle = globalThis.getComputedStyle;

  class FakeElement extends EventTarget {
    constructor() {
      super();
      this.children = [];
      this.parentElement = null;
      const style = {};
      style.setProperty = (key, value) => {
        style[key] = value;
      };
      this.style = style;
      this.className = '';
      this.id = '';
      this.textContent = '';
      this.scrollTop = 0;
      this.scrollLeft = 0;
      this.clientWidth = 100;
      this.clientHeight = 100;
      this.offsetWidth = 114;
      this.offsetHeight = 114;
      this.offsetLeft = 0;
      this.offsetTop = 0;
    }

    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
      return child;
    }

    remove() {
      const siblings = this.parentElement?.children;
      if (!siblings) return;
      const index = siblings.indexOf(this);
      if (index >= 0) siblings.splice(index, 1);
      this.parentElement = null;
    }
  }

  try {
    const host = new FakeElement();
    const canvas = new FakeElement();
    canvas.clientWidth = 200;
    canvas.clientHeight = 80;
    canvas.offsetLeft = 7;
    canvas.offsetTop = 30;
    canvas.getContext = () => ({});
    canvas.getBoundingClientRect = () => ({ width: 200, height: 80, left: 7, top: 30 });
    host.appendChild(canvas);
    const head = new FakeElement();
    const body = new FakeElement();
    globalThis.document = {
      head,
      body,
      createElement: () => new FakeElement(),
      getElementById: (id) => [...head.children, ...body.children].find((child) => child.id === id) ?? null,
    };
    globalThis.getComputedStyle = () => ({ position: 'static' });

    const renderer = {
      initialize() {},
      setScene() {},
      render() {},
      updateDynamicState() {},
    };
    const controller = new TreeViewController({ initialExpandDepth: 10, rowHeight: 20, renderer });
    controller.initialize(canvas);
    controller.setData(nodes);

    const vertical = host.children.find((child) => child.className === 'virtual-tree-canvas-scrollbar virtual-tree-canvas-scrollbar-y');
    assert.ok(vertical);
    assert.ok(head.children.find((child) => child.id === 'virtual-tree-canvas-native-scrollbar-style'));
    assert.ok(vertical.style['--vtc-scrollbar-thumb']);
    assert.equal(vertical.style.left, '193px');
    assert.equal(vertical.style.top, '58px');
    assert.equal(vertical.style.height, '52px');
    assert.equal(controller.viewport.contentViewportWidth, 186);
    assert.equal(controller.hitTest(187, 30), null);

    vertical.scrollTop = 40;
    vertical.dispatchEvent(new Event('scroll'));
    assert.equal(controller.viewport.scrollY, 40);

    controller.scrollTo(0, 20);
    assert.equal(vertical.scrollTop, 20);
  } finally {
    globalThis.document = previousDocument;
    globalThis.getComputedStyle = previousComputedStyle;
  }
});
