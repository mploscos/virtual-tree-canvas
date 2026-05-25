export class PointerController {
  constructor({ canvas, viewport, renderer, onHover, onClick }) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.renderer = renderer;
    this.onHover = onHover;
    this.onClick = onClick;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.downX = 0;
    this.downY = 0;

    canvas.addEventListener('pointerdown', this.#onPointerDown);
    canvas.addEventListener('pointermove', this.#onPointerMove);
    canvas.addEventListener('pointerup', this.#onPointerUp);
    canvas.addEventListener('pointercancel', this.#onPointerUp);
    canvas.addEventListener('wheel', this.#onWheel, { passive: false });
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.#onPointerDown);
    this.canvas.removeEventListener('pointermove', this.#onPointerMove);
    this.canvas.removeEventListener('pointerup', this.#onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.#onPointerUp);
    this.canvas.removeEventListener('wheel', this.#onWheel);
  }

  #onPointerDown = (event) => {
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.downX = event.clientX;
    this.downY = event.clientY;
    this.canvas.setPointerCapture(event.pointerId);
  };

  #onPointerMove = (event) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (this.dragging && event.buttons === 1) {
      this.viewport.pan(this.lastX - event.clientX, this.lastY - event.clientY);
    }
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    const world = this.viewport.screenToWorld(x, y);
    this.onHover?.(this.renderer.pick?.(world.x, world.y) ?? null);
  };

  #onPointerUp = (event) => {
    const moved = Math.hypot(event.clientX - this.downX, event.clientY - this.downY);
    this.dragging = false;
    const rect = this.canvas.getBoundingClientRect();
    const world = this.viewport.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    const id = this.renderer.pick?.(world.x, world.y) ?? null;
    if (id && moved < 4) this.onClick?.(id, event);
  };

  #onWheel = (event) => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * 0.0012);
    this.viewport.zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
  };
}
