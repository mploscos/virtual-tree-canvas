import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeViewController } from '../src/index.js';

class RecordingRenderer {
  constructor() {
    this.renderCount = 0;
    this.updates = [];
    this.renderedRows = 0;
  }
  setScene() {}
  updateDynamicState(patches) { this.updates.push(patches); }
  render(scene) {
    this.renderCount++;
    this.renderedRows = scene.visibleRange.count;
  }
}

function fixture(count = 100) {
  const callbacks = new Map();
  let sequence = 0;
  const view = {
    requestAnimationFrame(callback) {
      callbacks.set(++sequence, callback);
      return sequence;
    },
    cancelAnimationFrame(id) { callbacks.delete(id); }
  };
  const renderer = new RecordingRenderer();
  const controller = new TreeViewController({
    autoRender: true,
    initialExpandDepth: 10,
    rowHeight: 20,
    renderer
  });
  controller.resize(300, 100);
  controller.setData(Array.from({ length: count }, (_, index) => ({ id: `node-${index}` })));
  controller.canvas = { ownerDocument: { defaultView: view } };
  controller.render();
  renderer.renderCount = 0;
  renderer.updates.length = 0;

  return {
    controller,
    renderer,
    callbacks,
    runFrame() {
      const entry = callbacks.entries().next().value;
      assert.ok(entry, 'a frame is pending');
      callbacks.delete(entry[0]);
      entry[1]();
    }
  };
}

test('dynamic updates coalesce by ID and property within one frame', () => {
  const { controller, renderer, runFrame } = fixture();
  controller.setDynamicState([{ id: 'node-0', state: { value: 10, status: 1 } }]);
  controller.setDynamicState([{ id: 'node-0', state: { value: 11, progress: 0.5 } }]);
  controller.setDynamicState([{ id: 'node-1', state: { value: 20 } }]);

  runFrame();

  assert.deepEqual(controller.model.dynamicState.get('node-0'), {
    visible: true, value: 11, status: 1, progress: 0.5
  });
  assert.equal(controller.model.dynamicState.get('node-1').value, 20);
  assert.equal(renderer.updates.length, 1);
  assert.deepEqual(renderer.updates[0].map((patch) => patch.id), ['node-0', 'node-1']);
  assert.equal(renderer.renderCount, 1);
  assert.equal(controller.getStats().patchesReceived, 3);
  assert.equal(controller.getStats().uniqueNodesReceived, 2);
  controller.destroy();
});

test('repeated, custom and nonexistent patches do not request a render', () => {
  const { controller, renderer, runFrame } = fixture();
  controller.setDynamicState([{ id: 'node-0', state: { value: 1, custom: 'a' } }]);
  runFrame();
  renderer.renderCount = 0;
  renderer.updates.length = 0;

  controller.setDynamicState([
    { id: 'node-0', state: { value: 1 } },
    { id: 'node-0', state: { custom: 'a' } },
    { id: 'missing', state: { value: 2 } }
  ]);
  runFrame();

  assert.equal(renderer.renderCount, 0);
  assert.equal(renderer.updates.length, 0);
  assert.equal(controller.getStats().rendersAvoidedNoChanges, 1);
  controller.destroy();
});

test('offscreen patches persist without rendering and appear after scrolling', () => {
  const { controller, renderer, runFrame } = fixture();
  controller.setDynamicState([{ id: 'node-80', state: { value: 80 } }]);
  runFrame();
  assert.equal(renderer.renderCount, 0);
  assert.equal(controller.model.dynamicState.get('node-80').value, 80);
  assert.equal(controller.getStats().rendersAvoidedOffscreen, 1);

  controller.scrollToNode('node-80', 'start');
  runFrame();
  assert.equal(renderer.renderCount, 1);
  assert.equal(controller.scene.dynamicState.get('node-80').value, 80);
  controller.destroy();
});

test('mixed visible and offscreen patches produce one render', () => {
  const { controller, renderer, runFrame } = fixture();
  controller.setDynamicState([{ id: 'node-0', state: { value: 1 } }]);
  controller.setDynamicState([{ id: 'node-90', state: { value: 90 } }]);
  runFrame();
  assert.equal(renderer.renderCount, 1);
  assert.equal(renderer.updates.length, 1);
  assert.equal(renderer.updates[0].length, 2);
  controller.destroy();
});

test('manual scene reads flush pending state and manual render cancels its frame', () => {
  const { controller, renderer, callbacks } = fixture();
  controller.setDynamicState([{ id: 'node-0', state: { value: 4 } }]);
  const scene = controller.createRenderScene();
  assert.equal(scene.dynamicState.get('node-0').value, 4);
  assert.equal(renderer.renderCount, 0);
  controller.render();
  assert.equal(renderer.renderCount, 1);
  assert.equal(callbacks.size, 0);
  controller.destroy();
});

test('destroy clears queued patches and scheduled work', () => {
  const { controller, callbacks } = fixture();
  controller.setDynamicState([{ id: 'node-0', state: { value: 1 } }]);
  assert.equal(controller.dynamicPatchQueue.size, 1);
  controller.destroy();
  assert.equal(controller.dynamicPatchQueue.size, 0);
  assert.equal(callbacks.size, 0);
  assert.equal(controller.renderFrame, null);
});

test('render scenes omit sort snapshots while worker options serialize them on demand', async () => {
  const { controller } = fixture(4);
  controller.setColumns([
    { id: 'value', title: 'Value', width: 100, sortable: true,
      value: (_node, state) => state.value ?? 0 }
  ]);
  controller.setDynamicState([{ id: 'node-1', state: { value: 3 } }]);
  controller.flushDynamicState();
  controller.sortBy('value', 'asc');
  assert.equal(Object.hasOwn(controller.createRenderScene(), 'sortValues'), false);

  let options;
  controller.workerClient = {
    rebuildRows: async (received) => {
      options = received;
      return {
        rows: controller.rowModel.rows,
        contentWidth: controller.rowModel.contentWidth,
        contentHeight: controller.rowModel.contentHeight
      };
    }
  };
  await controller.setFilterAsync('');
  assert.ok(Array.isArray(options.sortValues));
  assert.equal(new Map(options.sortValues).get('node-1'), 3);
  controller.workerClient = null;
  controller.destroy();
});
