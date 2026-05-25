export class BenchmarkStats {
  constructor({ maxSamples = 240 } = {}) {
    this.maxSamples = maxSamples;
    this.samples = {
      frameMs: [],
      patchMs: [],
      sceneMs: [],
      renderMs: [],
      inputLatencyMs: [],
      searchMs: [],
      filterMs: [],
      workerMs: [],
    };
    this.frameCount = 0;
    this.patchCount = 0;
    this.lastSecondAt = null;
    this.fps = 0;
    this.patchesPerSecond = 0;
    this.lastPatchesFrame = 0;
  }

  recordFrame({ now, frameMs, patchMs = 0, sceneMs, renderMs, patchesFrame = 0, inputLatencyMs = 0 }) {
    this.frameCount++;
    this.patchCount += patchesFrame;
    this.lastPatchesFrame = patchesFrame;
    pushSample(this.samples.frameMs, frameMs, this.maxSamples);
    pushSample(this.samples.patchMs, patchMs, this.maxSamples);
    pushSample(this.samples.sceneMs, sceneMs, this.maxSamples);
    pushSample(this.samples.renderMs, renderMs, this.maxSamples);
    if (inputLatencyMs) pushSample(this.samples.inputLatencyMs, inputLatencyMs, this.maxSamples);

    if (this.lastSecondAt === null) this.lastSecondAt = now;
    const elapsed = now - this.lastSecondAt;
    if (elapsed >= 1000) {
      this.fps = (this.frameCount * 1000) / elapsed;
      this.patchesPerSecond = (this.patchCount * 1000) / elapsed;
      this.frameCount = 0;
      this.patchCount = 0;
      this.lastSecondAt = now;
    }
  }

  recordOperation(type, durationMs) {
    if (type === 'search') pushSample(this.samples.searchMs, durationMs, this.maxSamples);
    else if (type === 'filter') pushSample(this.samples.filterMs, durationMs, this.maxSamples);
    else if (type === 'worker') pushSample(this.samples.workerMs, durationMs, this.maxSamples);
  }

  snapshot() {
    return {
      fps: this.fps,
      patchesFrame: this.lastPatchesFrame,
      patchesPerSecond: this.patchesPerSecond,
      frameMs: describe(this.samples.frameMs),
      patchMs: describe(this.samples.patchMs),
      sceneMs: describe(this.samples.sceneMs),
      renderMs: describe(this.samples.renderMs),
      inputLatencyMs: describe(this.samples.inputLatencyMs),
      searchMs: describe(this.samples.searchMs),
      filterMs: describe(this.samples.filterMs),
      workerMs: describe(this.samples.workerMs),
      sampleCount: this.samples.frameMs.length,

      // Backward-compatible aliases for existing callers/tests.
      avgFrameMs: average(this.samples.frameMs),
      p95FrameMs: percentile(this.samples.frameMs, 0.95),
      avgSceneMs: average(this.samples.sceneMs),
      avgRenderMs: average(this.samples.renderMs),
      p95RenderMs: percentile(this.samples.renderMs, 0.95),
      avgInputLatencyMs: average(this.samples.inputLatencyMs),
    };
  }
}

function describe(samples) {
  return {
    avg: average(samples),
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    p99: percentile(samples, 0.99),
  };
}

function pushSample(samples, value, maxSamples) {
  samples.push(value);
  if (samples.length > maxSamples) samples.shift();
}

function average(samples) {
  if (!samples.length) return 0;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

function percentile(samples, p) {
  if (!samples.length) return 0;
  const sorted = samples.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[index];
}
