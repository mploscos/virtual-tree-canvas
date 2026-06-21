import { cloneDynamicState, mergeDynamicState } from './dynamic-state.js';

export class PatchBatcher {
  constructor() {
    /** @type {Map<string, import('./types.js').NodeDynamicState>} */
    this.pending = new Map();
  }

  /** @param {string} id @param {import('./types.js').NodeDynamicState} state */
  set(id, state) {
    const current = this.pending.get(id);
    if (current) mergeDynamicState(current, state);
    else this.pending.set(id, cloneDynamicState(state));
  }

  /** @param {Array<import('./types.js').DynamicPatch>} patches */
  addMany(patches) {
    for (const patch of patches) this.set(patch.id, patch.state);
  }

  flush() {
    const patches = Array.from(this.pending, ([id, state]) => ({ id, state }));
    this.pending.clear();
    return patches;
  }

  get size() {
    return this.pending.size;
  }
}
