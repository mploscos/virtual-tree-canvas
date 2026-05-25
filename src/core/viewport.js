export class TreeViewport extends EventTarget {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.width = 1;
    this.height = 1;
    this.minZoom = 0.08;
    this.maxZoom = 4;
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dispatchEvent(new Event('change'));
  }

  pan(dx, dy) {
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
    this.dispatchEvent(new Event('change'));
  }

  zoomAt(screenX, screenY, factor) {
    const before = this.screenToWorld(screenX, screenY);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    const after = this.screenToWorld(screenX, screenY);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.dispatchEvent(new Event('change'));
  }

  focus(bounds) {
    this.x = bounds.x + bounds.width / 2 - this.width / (2 * this.zoom);
    this.y = bounds.y + bounds.height / 2 - this.height / (2 * this.zoom);
    this.dispatchEvent(new Event('change'));
  }

  getWorldBounds(padding = 120) {
    return {
      x: this.x - padding / this.zoom,
      y: this.y - padding / this.zoom,
      width: this.width / this.zoom + (padding * 2) / this.zoom,
      height: this.height / this.zoom + (padding * 2) / this.zoom,
    };
  }

  screenToWorld(screenX, screenY) {
    return {
      x: this.x + screenX / this.zoom,
      y: this.y + screenY / this.zoom,
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.x) * this.zoom,
      y: (worldY - this.y) * this.zoom,
    };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
