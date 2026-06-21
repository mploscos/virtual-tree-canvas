import {
  BenchmarkStats,
  PatchBatcher,
  TreeRowRenderer,
  TreeViewController,
  captureTreeViewState,
  defaultTreeTableColumns,
  restoreTreeViewState,
  themes,
} from '../src/index.js';
import { TreeViewInputController } from '../src/input/index.js';
import { generateTree } from '../examples/generate-tree.js';

let canvas = document.querySelector('#tree');
const shell = document.querySelector('.tree-shell');
const stats = document.querySelector('#stats');
const message = document.querySelector('#message');
const panel = document.querySelector('#benchmark-panel');
const searchInput = document.querySelector('#search');
const filterInput = document.querySelector('#filter');
const searchPrevButton = document.querySelector('#search-prev');
const searchNextButton = document.querySelector('#search-next');
const themeSelect = document.querySelector('#theme');
const datasetSelect = document.querySelector('#dataset-size');
const scenarioSelect = document.querySelector('#scenario');
const updateRateSelect = document.querySelector('#update-rate');
const multiMode = document.querySelector('#multi-mode');
const expandAllButton = document.querySelector('#expand-all');
const collapseAllButton = document.querySelector('#collapse-all');
const focusRandomButton = document.querySelector('#focus-random');
const copyResultsButton = document.querySelector('#copy-results');
const jsonDialog = document.querySelector('#json-dialog');
const jsonOutput = document.querySelector('#json-output');

const datasets = new Map();
const patchBatcher = new PatchBatcher();
const simulationPatchState = {
  progress: 0,
  pulse: 0,
  value: 0,
  updatedAt: 0,
  status: 0,
  color: undefined,
};
let benchmark = new BenchmarkStats();
let controller = null;
let input = null;
let nodes = getDataset(Number(datasetSelect.value));
let lastFrameAt = performance.now();
let lastInputAt = 0;
let searchTimer = null;
let filterTimer = null;
let startingRenderer = false;
let rendererGeneration = 0;
let simulationWorker = null;
let simulationWorkerReady = false;
let simulationWorkerBusy = false;
let simulationWorkerPatches = [];

await startRenderer();

searchInput.addEventListener('input', () => {
  lastInputAt = performance.now();
  window.clearTimeout(searchTimer);
  message.textContent = searchInput.value ? 'Searching...' : '';
  searchTimer = window.setTimeout(async () => {
    const activeController = controller;
    await activeController.searchAsync(searchInput.value);
    if (activeController === controller) updateSearchMessage();
  }, 80);
});
filterInput.addEventListener('input', () => {
  lastInputAt = performance.now();
  window.clearTimeout(filterTimer);
  message.textContent = filterInput.value ? 'Filtering...' : '';
  filterTimer = window.setTimeout(async () => {
    const activeController = controller;
    await activeController.setFilterAsync(filterInput.value);
    if (activeController === controller) message.textContent = filterInput.value ? `${activeController.rowModel.rows.length.toLocaleString()} filtered rows` : '';
  }, 80);
});
searchNextButton.addEventListener('click', () => {
  controller.nextSearchResult();
  updateSearchMessage();
});
searchPrevButton.addEventListener('click', () => {
  controller.previousSearchResult();
  updateSearchMessage();
});
themeSelect.addEventListener('change', () => controller.setTheme(themes[themeSelect.value]));
datasetSelect.addEventListener('change', async () => {
  nodes = getDataset(Number(datasetSelect.value));
  benchmark = new BenchmarkStats();
  await startRenderer({ keepState: false });
});
scenarioSelect.addEventListener('change', () => applyScenario());
updateRateSelect.addEventListener('change', () => {
  benchmark = new BenchmarkStats();
});
expandAllButton.addEventListener('click', () => controller.expandAll());
collapseAllButton.addEventListener('click', () => controller.collapseAll());
copyResultsButton.addEventListener('click', () => copyResults());

focusRandomButton.addEventListener('click', () => {
  const node = controller.model.nodes[1 + ((Math.random() * (controller.model.nodes.length - 1)) | 0)];
  controller.focusNode(node.id, { align: 'center', select: true });
});

multiMode.addEventListener('change', () => {
  canvas.dataset.multi = multiMode.checked ? 'true' : 'false';
});

function getDataset(size) {
  if (!datasets.has(size)) datasets.set(size, generateTree(size));
  return datasets.get(size);
}

async function startRenderer({ keepState = true } = {}) {
  const generation = ++rendererGeneration;
  startingRenderer = true;
  const previousState = keepState && controller ? captureTreeViewState(controller) : null;
  input?.destroy();
  controller?.disableWorkers();
  stopSimulationWorker();
  shell.querySelector('canvas')?.remove();
  shell.insertAdjacentHTML('afterbegin', '<canvas id="tree"></canvas>');
  canvas = shell.querySelector('#tree');
  canvas.dataset.multi = multiMode.checked ? 'true' : 'false';
  message.textContent = '';

  const renderer = new TreeRowRenderer();
  const nextController = new TreeViewController({ renderer, initialExpandDepth: 2 });
  nextController.initialize(canvas);
  nextController.setColumns(defaultTreeTableColumns());
  nextController.setTheme(themes[themeSelect.value]);
  nextController.setData(nodes);
  await nextController.enableWorkers().catch(() => null);
  if (generation !== rendererGeneration) {
    nextController.disableWorkers();
    return;
  }
  controller = nextController;
  startSimulationWorker(nodes);
  if (previousState) restoreTreeViewState(controller, previousState);
  else applyScenario();
  if (filterInput.value) await controller.setFilterAsync(filterInput.value);
  renderer.setScene(controller.createRenderScene());
  controller.on('searchchange', (event) => {
    if (typeof event.detail.totalMs === 'number') benchmark.recordOperation('search', event.detail.totalMs);
    if (typeof event.detail.workerMs === 'number') benchmark.recordOperation('worker', event.detail.workerMs);
  });
  controller.on('filterchange', (event) => {
    if (typeof event.detail.totalMs === 'number') benchmark.recordOperation('filter', event.detail.totalMs);
    if (typeof event.detail.workerMs === 'number') benchmark.recordOperation('worker', event.detail.workerMs);
  });

  input = new TreeViewInputController({
    canvas,
    controller,
    viewport: controller.viewport,
    rowModel: controller.rowModel,
    expansion: controller.expansion,
    selection: controller.selection,
  });
  benchmark = new BenchmarkStats();
  startingRenderer = false;
}

function applyScenario() {
  if (!controller) return;
  if (scenarioSelect.value === 'collapsed') controller.collapseAll();
  else if (scenarioSelect.value === 'expanded' || scenarioSelect.value === 'scroll') controller.expandAll();
  else {
    controller.collapseAll();
    controller.expand('root');
    for (const childId of controller.model.index.getChildren('root').slice(0, 3)) controller.expand(childId);
  }
}

function animate(now) {
  if (startingRenderer || !controller) {
    requestAnimationFrame(animate);
    return;
  }
  const frameMs = now - lastFrameAt;
  lastFrameAt = now;
  if (scenarioSelect.value === 'scroll') controller.scrollBy(0, 14);

  const patches = nextSimulationPatches(now);
  const patchStart = performance.now();
  controller.setDynamicState(patches);
  const patchMs = performance.now() - patchStart;
  const measured = controller.renderMeasured(now);
  const inputLatencyMs = lastInputAt ? now - lastInputAt : 0;
  lastInputAt = 0;
  benchmark.recordFrame({
    now,
    frameMs,
    patchMs,
    sceneMs: measured.sceneMs,
    renderMs: measured.renderMs,
    patchesFrame: patches.length,
    inputLatencyMs,
  });

  updateStats();
  requestAnimationFrame(animate);
}

function startSimulationWorker(datasetNodes) {
  simulationWorkerReady = false;
  simulationWorkerBusy = false;
  simulationWorkerPatches = [];
  if (typeof Worker === 'undefined') return;

  const generation = rendererGeneration;
  let worker;
  try {
    worker = new Worker(new URL('./update-simulation-worker.js', import.meta.url), { type: 'module' });
  } catch (_error) {
    return;
  }
  simulationWorker = worker;
  worker.addEventListener('message', (event) => {
    if (worker !== simulationWorker || generation !== rendererGeneration) return;
    const data = event.data;
    if (data?.type === 'ready') {
      simulationWorkerReady = true;
      return;
    }
    if (data?.type === 'patches') {
      simulationWorkerBusy = false;
      simulationWorkerPatches = Array.isArray(data.patches) ? data.patches : [];
      if (typeof data.durationMs === 'number') benchmark.recordOperation('worker', data.durationMs);
    }
  });
  worker.addEventListener('error', () => {
    if (worker !== simulationWorker) return;
    stopSimulationWorker();
    message.textContent = 'Simulation worker unavailable; using main thread';
  });
  worker.postMessage({
    type: 'configure',
    nodes: datasetNodes.map((node) => ({ id: node.id, type: node.type ?? '' })),
  });
}

function stopSimulationWorker() {
  simulationWorker?.terminate();
  simulationWorker = null;
  simulationWorkerReady = false;
  simulationWorkerBusy = false;
  simulationWorkerPatches = [];
}

function nextSimulationPatches(now) {
  const updateCount = currentUpdateCount();
  if (simulationWorkerReady && simulationWorker) {
    const patches = simulationWorkerPatches;
    simulationWorkerPatches = [];
    requestSimulationFrame(now, updateCount);
    return patches;
  }
  return simulateDynamicUpdatesOnMain(now, updateCount);
}

function requestSimulationFrame(now, updateCount) {
  if (!simulationWorker || simulationWorkerBusy) return;
  simulationWorkerBusy = true;
  simulationWorker.postMessage({
    type: 'simulate',
    now,
    updateCount,
    updatedAt: Math.trunc(performance.timeOrigin + now),
  });
}

function currentUpdateCount() {
  const selectedRate = Number(updateRateSelect.value);
  return scenarioSelect.value === 'heavy' ? Math.max(1000, selectedRate) : selectedRate;
}

function simulateDynamicUpdatesOnMain(now, updateCount) {
  const modelNodes = controller.model.nodes;
  const nodeCount = modelNodes.length;
  if (nodeCount <= 1) return [];
  const updatedAt = Math.trunc(performance.timeOrigin + now);
  for (let i = 0; i < updateCount; i++) {
    const index = 1 + ((Math.random() * (nodeCount - 1)) | 0);
    const node = modelNodes[index];
    if (!node) continue;
    const id = node.id;
    const progress = (Math.sin(now * 0.002 + index * 0.07) + 1) / 2;
    simulationPatchState.progress = progress;
    simulationPatchState.pulse = (now * 0.001 + index) % 1;
    simulationPatchState.value = progress * 100;
    simulationPatchState.updatedAt = updatedAt;
    simulationPatchState.status = node.type === 'error' || progress > 0.88 ? 2 : node.type === 'warning' || progress > 0.55 ? 1 : 0;
    simulationPatchState.color = progress > 0.94 ? '#fb7185' : undefined;
    patchBatcher.set(id, simulationPatchState);
  }
  return patchBatcher.flush();
}

function updateStats() {
  const current = controller.getStats();
  const sample = benchmark.snapshot();
  const result = currentResult(current, sample);
  stats.textContent = `${current.totalNodes.toLocaleString()} nodes · ${current.visibleRows.toLocaleString()} visible rows · ${current.renderedRows} rendered · ${current.patchesFrame}/frame patches · ${Math.round(sample.fps)} FPS`;
  panel.innerHTML =
    rows({
    Dataset: datasetSelect.options[datasetSelect.selectedIndex].text,
    Renderer: 'Canvas2D',
    Scenario: scenarioSelect.options[scenarioSelect.selectedIndex].text,
    Filter: filterInput.value || 'none',
    'Update rate': updateRateSelect.options[updateRateSelect.selectedIndex].text,
    'Rendered rows': current.renderedRows,
    'Visible rows': current.visibleRows.toLocaleString(),
    FPS: sample.fps.toFixed(1),
    'Frame avg/p95/p99': formatMetric(sample.frameMs),
    'Patch avg/p95/p99': formatMetric(sample.patchMs),
    'Scene avg/p95/p99': formatMetric(sample.sceneMs),
    'Render avg/p95/p99': formatMetric(sample.renderMs),
    'Search avg/p95/p99': formatMetric(sample.searchMs),
    'Filter avg/p95/p99': formatMetric(sample.filterMs),
    'Worker avg/p95/p99': formatMetric(sample.workerMs),
    'Patches/s': Math.round(sample.patchesPerSecond).toLocaleString(),
    'Input avg/p95/p99': formatMetric(sample.inputLatencyMs),
    Samples: sample.sampleCount,
  }) +
    `<div class="rule">${result.acceptance}</div>`;
}

function updateSearchMessage() {
  const state = controller.getSearchState();
  if (!state.query) {
    message.textContent = '';
    return;
  }
  message.textContent = state.count ? `Search ${state.cursor + 1}/${state.count}` : 'No search results';
}

function currentResult(current, sample) {
  const heavyScenario = scenarioSelect.value === 'heavy' || scenarioSelect.value === 'scroll' || Number(updateRateSelect.value) >= 1000;
  return {
    datasetSize: Number(datasetSelect.value),
    renderer: 'canvas',
    scenario: scenarioSelect.value,
    updateRate: Number(updateRateSelect.value),
    renderedRows: current.renderedRows,
    visibleRows: current.visibleRows,
    patchesFrame: current.patchesFrame,
    dirtyNodes: current.dirtyNodes,
    fps: sample.fps,
    patchesPerSecond: sample.patchesPerSecond,
    frameMs: sample.frameMs,
    patchMs: sample.patchMs,
    sceneMs: sample.sceneMs,
    renderMs: sample.renderMs,
    searchMs: sample.searchMs,
    filterMs: sample.filterMs,
    workerMs: sample.workerMs,
    inputLatencyMs: sample.inputLatencyMs,
    sampleCount: sample.sampleCount,
    acceptance: heavyScenario
      ? 'Acceptance: Canvas2D is the production renderer; benchmark validates virtualization and patch cost.'
      : 'Acceptance: use heavy/scroll scenarios to validate Canvas2D headroom.',
  };
}

async function copyResults() {
  const result = currentResult(controller.getStats(), benchmark.snapshot());
  const json = JSON.stringify(result, null, 2);
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable');
    await navigator.clipboard.writeText(json);
    message.textContent = 'Benchmark JSON copied';
  } catch (_error) {
    console.log(json);
    showJsonFallback(json);
    message.textContent = 'Clipboard unavailable; JSON shown below';
  }
}

function showJsonFallback(json) {
  jsonOutput.value = json;
  if (jsonDialog.showModal) jsonDialog.showModal();
  else jsonDialog.setAttribute('open', '');
  jsonOutput.focus();
  jsonOutput.select();
}

function formatMetric(metric) {
  return `${metric.avg.toFixed(2)} / ${metric.p95.toFixed(2)} / ${metric.p99.toFixed(2)} ms`;
}

function rows(values) {
  return Object.entries(values)
    .map(([label, value]) => `<div class="row"><span>${label}</span><strong>${value}</strong></div>`)
    .join('');
}

requestAnimationFrame(animate);
