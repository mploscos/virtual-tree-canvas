export class TreeSelectionManager extends EventTarget {
  constructor() {
    super();
    this.selected = new Set();
    this.hovered = null;
    this.focused = null;
  }

  setHover(id) {
    if (this.hovered === id) return;
    this.hovered = id;
    this.dispatchEvent(new Event('change'));
  }

  select(id, additive = false) {
    if (!additive) this.selected.clear();
    if (id) this.selected.add(id);
    this.focused = id;
    this.dispatchEvent(new Event('change'));
  }

  toggle(id) {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.focused = id;
    this.dispatchEvent(new Event('change'));
  }

  clear() {
    this.selected.clear();
    this.focused = null;
    this.dispatchEvent(new Event('change'));
  }

  toPatches() {
    return Array.from(this.selected, (id) => ({ id, state: { selected: true } }));
  }
}
