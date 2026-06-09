import { cullLayoutNodes } from '../core/culling.js';

export class Canvas2DRenderer {
  constructor({ themeManager } = {}) {
    this.canvas = null;
    this.ctx = null;
    this.scene = null;
    this.themeManager = themeManager;
    this.visibleNodeIndices = [];
  }

  /** @param {HTMLCanvasElement} canvas */
  initialize(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('Canvas2D context is not available');
  }

  setScene(scene) {
    this.scene = scene;
  }

  updateDynamicState(_patches) {
    // Canvas2D reads model.dynamicState directly. Dynamic patches must not rebuild layout.
  }

  render(frameState) {
    if (!this.canvas || !this.ctx || !this.scene) return;
    const { viewport } = frameState;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const viewportWidth = Math.max(0, viewport.viewportWidth);
    const viewportHeight = Math.max(0, viewport.viewportHeight);
    if (viewportWidth <= 0 || viewportHeight <= 0) return;
    const width = Math.floor(viewportWidth * dpr);
    const height = Math.floor(viewportHeight * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const ctx = this.ctx;
    const theme = this.themeManager?.get() ?? {};
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.background ?? '#101419';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    this.visibleNodeIndices = cullLayoutNodes(this.scene.layout.nodes, viewport.getWorldBounds());
    const visibleSet = new Set(this.visibleNodeIndices);

    ctx.save();
    ctx.scale(viewport.zoom, viewport.zoom);
    ctx.translate(-viewport.x, -viewport.y);
    this.#drawEdges(ctx, visibleSet, theme);
    this.#drawNodes(ctx, theme, viewport.zoom);
    ctx.restore();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.mutedLabel ?? '#9ba8b3';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${this.scene.layout.nodes.length.toLocaleString()} nodes / ${this.visibleNodeIndices.length.toLocaleString()} visible`, 12, 20);
  }

  #drawEdges(ctx, visibleSet, theme) {
    const nodes = this.scene.layout.nodes;
    ctx.strokeStyle = theme.edge ?? '#51606d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const edge of this.scene.layout.edges) {
      if (!visibleSet.has(edge.sourceIndex) && !visibleSet.has(edge.targetIndex)) continue;
      const source = nodes[edge.sourceIndex];
      const target = nodes[edge.targetIndex];
      ctx.moveTo(source.x + source.width, source.y + source.height / 2);
      ctx.lineTo(target.x, target.y + target.height / 2);
    }
    ctx.stroke();
  }

  #drawNodes(ctx, theme, zoom) {
    const model = this.scene.model;
    for (const index of this.visibleNodeIndices) {
      const node = this.scene.layout.nodes[index];
      const state = this.scene.dynamicState.get(node.id) ?? {};
      if (state.visible === false) continue;
      const structural = model.index.getNode(node.id);
      const fill = state.color ?? theme.nodeFill ?? '#202a33';

      ctx.fillStyle = fill;
      ctx.strokeStyle = state.selected ? theme.selected : state.highlighted ? theme.highlighted : theme.nodeStroke;
      ctx.lineWidth = state.selected || state.highlighted ? 2 / zoom : 1 / zoom;
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, node.width, node.height, 4);
      ctx.fill();
      ctx.stroke();

      if (state.progress !== undefined) {
        ctx.fillStyle = theme.progress ?? '#42d392';
        ctx.fillRect(node.x, node.y + node.height - 3, node.width * clamp01(state.progress), 3);
      }

      if (zoom >= 0.28) {
        ctx.fillStyle = theme.label ?? '#eef3f7';
        ctx.font = `${Math.max(9, Math.min(12, 12 / Math.sqrt(zoom)))}px system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        const label = structural?.label ?? node.id;
        ctx.fillText(label, node.x + 8, node.y + node.height / 2, node.width - 14);
      }
    }
  }

  pick(worldX, worldY) {
    if (!this.scene) return null;
    for (let i = this.visibleNodeIndices.length - 1; i >= 0; i--) {
      const node = this.scene.layout.nodes[this.visibleNodeIndices[i]];
      if (worldX >= node.x && worldX <= node.x + node.width && worldY >= node.y && worldY <= node.y + node.height) return node.id;
    }
    return null;
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
