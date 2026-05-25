import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BenchmarkStats,
  TreeViewController,
  captureTreeViewState,
  defaultTreeTableColumns,
  restoreTreeViewState,
  sceneSignature,
} from '../src/index.js';

const nodes = [
  { id: 'root', label: 'Root', type: 'root' },
  { id: 'a', parentId: 'root', label: 'Alpha sensor', type: 'sensor' },
  { id: 'b', parentId: 'root', label: 'Bravo platform', type: 'platform' },
  { id: 'b1', parentId: 'b', label: 'Bravo child', type: 'track' },
];

class RecordingRenderer {
  constructor() {
    this.scenes = [];
    this.renderedRows = 0;
  }
  initialize() {}
  setScene(scene) {
    this.scene = scene;
  }
  updateDynamicState() {}
  render(scene) {
    this.scenes.push(scene);
    this.renderedRows = scene.visibleRange.count;
  }
}

function createController(renderer = new RecordingRenderer()) {
  const controller = new TreeViewController({ renderer, initialExpandDepth: 1 });
  controller.setColumns(defaultTreeTableColumns());
  controller.resize(500, 180);
  controller.setData(nodes);
  return controller;
}

test('benchmark stats collect without throwing', () => {
  const stats = new BenchmarkStats({ maxSamples: 4 });
  stats.recordFrame({ now: 0, frameMs: 16, patchMs: 0.5, sceneMs: 1, renderMs: 3, patchesFrame: 10 });
  stats.recordFrame({ now: 1000, frameMs: 20, patchMs: 1.5, sceneMs: 2, renderMs: 4, patchesFrame: 20, inputLatencyMs: 5 });
  stats.recordOperation('search', 12);
  stats.recordOperation('filter', 8);
  stats.recordOperation('worker', 20);
  const snapshot = stats.snapshot();

  assert.equal(snapshot.avgFrameMs, 18);
  assert.equal(snapshot.p95FrameMs, 20);
  assert.equal(snapshot.avgSceneMs, 1.5);
  assert.equal(snapshot.avgRenderMs, 3.5);
  assert.equal(snapshot.patchMs.avg, 1);
  assert.equal(snapshot.frameMs.p50, 16);
  assert.equal(snapshot.frameMs.p95, 20);
  assert.equal(snapshot.frameMs.p99, 20);
  assert.equal(snapshot.searchMs.avg, 12);
  assert.equal(snapshot.filterMs.avg, 8);
  assert.equal(snapshot.workerMs.avg, 20);
  assert.ok(snapshot.patchesPerSecond >= 30);
});

test('renderer switch preserves viewport, selection, and search', () => {
  const first = createController();
  first.expand('b');
  first.scrollBy(50, 40);
  first.setSelection(['b1']);
  first.search('bravo');
  const state = captureTreeViewState(first);

  const second = createController();
  restoreTreeViewState(second, state);

  assert.equal(second.viewport.scrollX, first.viewport.scrollX);
  assert.equal(second.viewport.scrollY, first.viewport.scrollY);
  assert.deepEqual(second.getSelection(), first.getSelection());
  assert.equal(second.searchIndex.lastQuery, 'bravo');
  assert.deepEqual(second.searchIndex.results, first.searchIndex.results);
});

test('both renderers receive equivalent scenes', () => {
  const rendererA = new RecordingRenderer();
  const rendererB = new RecordingRenderer();
  const a = createController(rendererA);
  const b = createController(rendererB);

  a.expand('b');
  b.expand('b');
  a.setSelection(['b1']);
  b.setSelection(['b1']);
  a.setDynamicState([{ id: 'b1', state: { progress: 0.5, status: 1 } }]);
  b.setDynamicState([{ id: 'b1', state: { progress: 0.5, status: 1 } }]);
  a.renderMeasured(100);
  b.renderMeasured(100);

  assert.deepEqual(sceneSignature(rendererA.scenes[0]), sceneSignature(rendererB.scenes[0]));
});
