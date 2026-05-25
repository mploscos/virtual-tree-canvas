export class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    return () => this.off(type, listener);
  }

  off(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, detail = {}) {
    const event = { type, detail };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

