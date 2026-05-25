export class TreeWorkerClient {
  constructor(workerUrl = new URL('../workers/tree-worker.js', import.meta.url)) {
    if (typeof Worker === 'undefined') throw new Error('Worker is not available');
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.nextId = 1;
    this.pending = new Map();
    this.ready = Promise.resolve();
    this.worker.addEventListener('message', this.#onMessage);
  }

  setData(nodes) {
    this.ready = this.#request('setData', { nodes });
    return this.ready;
  }

  async search(query, options = {}) {
    await this.ready;
    return this.#request('search', { query, options });
  }

  async rebuildRows(options = {}) {
    await this.ready;
    return this.#request('rebuildRows', options);
  }

  destroy() {
    for (const { reject } of this.pending.values()) reject(new Error('Tree worker destroyed'));
    this.pending.clear();
    this.worker.removeEventListener('message', this.#onMessage);
    this.worker.terminate();
  }

  #request(type, payload) {
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.worker.postMessage({ id, type, payload });
    return promise;
  }

  #onMessage = (event) => {
    const { id, ok, result, error } = event.data ?? {};
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    if (ok) pending.resolve(result);
    else pending.reject(new Error(error || 'Tree worker request failed'));
  };
}
