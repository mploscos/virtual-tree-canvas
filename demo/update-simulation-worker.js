const pending = new Map();
const patchState = {
  progress: 0,
  pulse: 0,
  value: 0,
  updatedAt: 0,
  status: 0,
  color: undefined,
};

let nodeRefs = [];

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data?.type === 'configure') {
    nodeRefs = Array.isArray(data.nodes) ? data.nodes : [];
    pending.clear();
    self.postMessage({ type: 'ready' });
    return;
  }

  if (data?.type !== 'simulate') return;
  const startedAt = performance.now();
  const patches = simulateDynamicUpdates(data.now, data.updateCount, data.updatedAt);
  self.postMessage({ type: 'patches', patches, durationMs: performance.now() - startedAt });
});

function simulateDynamicUpdates(now, updateCount, updatedAt) {
  const nodeCount = nodeRefs.length;
  if (nodeCount <= 1 || updateCount <= 0) return [];

  for (let i = 0; i < updateCount; i++) {
    const index = 1 + ((Math.random() * (nodeCount - 1)) | 0);
    const node = nodeRefs[index];
    if (!node) continue;

    const progress = (Math.sin(now * 0.002 + index * 0.07) + 1) / 2;
    patchState.progress = progress;
    patchState.pulse = (now * 0.001 + index) % 1;
    patchState.value = progress * 100;
    patchState.updatedAt = updatedAt;
    patchState.status = node.type === 'error' || progress > 0.88 ? 2 : node.type === 'warning' || progress > 0.55 ? 1 : 0;
    patchState.color = progress > 0.94 ? '#fb7185' : undefined;
    setPending(node.id, patchState);
  }

  return flushPending();
}

function setPending(id, state) {
  const current = pending.get(id);
  if (current) {
    current.progress = state.progress;
    current.pulse = state.pulse;
    current.value = state.value;
    current.updatedAt = state.updatedAt;
    current.status = state.status;
    current.color = state.color;
  } else {
    pending.set(id, {
      progress: state.progress,
      pulse: state.pulse,
      value: state.value,
      updatedAt: state.updatedAt,
      status: state.status,
      color: state.color,
    });
  }
}

function flushPending() {
  const patches = new Array(pending.size);
  let index = 0;
  for (const [id, state] of pending) patches[index++] = { id, state };
  pending.clear();
  return patches;
}
