import { IconRegistry } from '../core/icon-registry.js';

export class TreeRowRenderer {
  constructor({ iconRegistry } = {}) {
    this.canvas = null;
    this.ctx = null;
    this.scene = null;
    this.iconRegistry = iconRegistry ?? new IconRegistry();
    this.renderedRows = 0;
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
    // Canvas2D reads the state map directly; patches still stay on the hot path.
  }

  render(scene) {
    if (scene?.rows) this.scene = scene;
    if (!this.canvas || !this.ctx || !this.scene) return;
    const { viewport, theme } = this.scene;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.floor(this.canvas.clientWidth * dpr);
    const height = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      viewport.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    }

    const ctx = this.ctx;
    const colors = theme.colors;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

    ctx.save();
    ctx.translate(viewport.renderInsetX ?? 0, viewport.renderInsetY ?? 0);
    this.#drawHeader(ctx);
    this.#drawRows(ctx);
    ctx.restore();
  }

  #drawHeader(ctx) {
    const { viewport, columns, theme, sort, headerFilter, filterQuery } = this.scene;
    const colors = theme.colors;
    ctx.save();
    ctx.fillStyle = colors.row;
    ctx.fillRect(0, 0, viewport.viewportWidth, viewport.headerHeight);
    ctx.translate(-viewport.scrollX, 0);
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';

    for (const column of columns) {
      if (headerFilter && column.kind === 'inspectorPane') {
        this.#drawHeaderFilter(ctx, column, viewport, theme, filterQuery);
      } else {
        ctx.fillStyle = colors.textMuted;
        ctx.fillText(column.label, column.x + 10, viewport.headerHeight / 2, column.width - 20);
      }
      if (sort?.columnId === column.id && sort.direction) {
        ctx.fillText(sort.direction === 'asc' ? '^' : 'v', column.x + column.width - 16, viewport.headerHeight / 2, 12);
      }
      ctx.strokeStyle = colors.border;
      ctx.beginPath();
      ctx.moveTo(column.x + column.width + 0.5, 0);
      ctx.lineTo(column.x + column.width + 0.5, viewport.headerHeight);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = colors.border;
    ctx.beginPath();
    ctx.moveTo(0, viewport.headerHeight + 0.5);
    ctx.lineTo(viewport.viewportWidth, viewport.headerHeight + 0.5);
    ctx.stroke();
  }

  #drawHeaderFilter(ctx, column, viewport, theme, filterQuery) {
    const colors = theme.colors;
    const x = column.x + 8;
    const y = 5;
    const width = Math.max(40, column.width - 16);
    const height = Math.max(18, viewport.headerHeight - 10);
    ctx.fillStyle = colors.progressTrack;
    roundRect(ctx, x, y, width, height, 4);
    ctx.fill();
    ctx.strokeStyle = colors.border;
    ctx.stroke();
    ctx.fillStyle = filterQuery ? colors.text : colors.textMuted;
    ctx.fillText(filterQuery || 'Filter inspector', x + 8, viewport.headerHeight / 2, width - 16);
  }

  #drawRows(ctx) {
    const { rows, visibleRange, viewport } = this.scene;
    this.renderedRows = visibleRange.count;
    ctx.save();
    ctx.translate(-viewport.scrollX, viewport.headerHeight - viewport.scrollY);
    for (let i = visibleRange.first; i <= visibleRange.last; i++) {
      const row = rows[i];
      if (row) this.#drawRow(ctx, row);
    }
    ctx.restore();
  }

  #drawRow(ctx, row) {
    const { columns, nodes, dynamicState, selection, hoverNodeId, focusNodeId, searchMatches, theme, viewport } = this.scene;
    const node = nodes[row.nodeIndex];
    const state = dynamicState.get(row.nodeId) ?? {};
    const style = resolveNodeStyle(theme, node, state);
    const colors = theme.colors;
    const selected = selection.has(row.nodeId) || state.selected;
    const highlighted = state.highlighted || searchMatches.has(row.nodeId);
    const hovered = hoverNodeId === row.nodeId;
    const focused = focusNodeId === row.nodeId;
    const y = row.y;
    const rowWidth = Math.max(viewport.contentWidth, viewport.scrollX + viewport.viewportWidth);

    ctx.fillStyle = selected ? colors.rowSelected : highlighted ? colors.rowHighlighted : hovered ? colors.rowHover : colors.row;
    ctx.fillRect(0, y, rowWidth, row.height);

    this.#drawIndentGuides(ctx, row, colors);

    for (const column of columns) {
      const rect = { x: column.x, y, width: column.width, height: row.height };
      this.#drawCell(ctx, { node, state, row, column, rect, theme, style });
      ctx.strokeStyle = colors.border;
      ctx.beginPath();
      ctx.moveTo(column.x + column.width + 0.5, y);
      ctx.lineTo(column.x + column.width + 0.5, y + row.height);
      ctx.stroke();
    }

    ctx.strokeStyle = colors.border;
    ctx.beginPath();
    ctx.moveTo(0, y + row.height + 0.5);
    ctx.lineTo(rowWidth, y + row.height + 0.5);
    ctx.stroke();

    if (state.updated && node.data?.inspector) {
      ctx.fillStyle = theme.colors.focus;
      ctx.beginPath();
      ctx.arc(rowWidth - 10, y + row.height / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (focused) {
      ctx.strokeStyle = colors.focus;
      ctx.strokeRect(1.5, y + 2.5, rowWidth - 3, row.height - 5);
    }
  }

  #drawCell(ctx, cell) {
    if (cell.column.render) {
      cell.column.render(ctx, cell);
      return;
    }
    if (cell.column.kind === 'tree') this.#drawTreeCell(ctx, cell);
    else if (cell.column.kind === 'inspectorPane') this.#drawInspectorPaneCell(ctx, cell);
    else if (cell.column.kind === 'inspectorValue') this.#drawInspectorValueCell(ctx, cell);
    else if (cell.column.kind === 'inspectorType') this.#drawInspectorTypeCell(ctx, cell);
    else if (cell.column.kind === 'inspectorDescription') this.#drawInspectorDescriptionCell(ctx, cell);
    else if (cell.column.kind === 'status') this.#drawStatusCell(ctx, cell);
    else if (cell.column.kind === 'progress') this.#drawProgressCell(ctx, cell);
    else this.#drawTextCell(ctx, cell);
  }

  #drawInspectorPaneCell(ctx, { node, row, rect, theme }) {
    const data = node.data ?? {};
    const colors = theme.colors;
    const indentX = rect.x + row.depth * theme.indentWidth;
    const labelX = indentX + 28;
    const cy = rect.y + rect.height / 2;
    this.#drawChevron(ctx, indentX + 10, cy, row, colors);
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.globalAlpha = data.disabled ? 0.45 : 1;
    ctx.fillStyle = data.valueType === 'object' || data.valueType === 'array' ? colors.text : colors.textMuted;
    ctx.fillText(node.label ?? node.id, labelX, cy, 180);

    const editorX = rect.x + Math.min(Math.max(210, rect.width * 0.42), rect.width - 180);
    const editorWidth = Math.max(80, rect.x + rect.width - editorX - 14);
    if (data.valueType === 'array') {
      ctx.fillStyle = colors.textMuted;
      ctx.fillText(data.valueText, editorX, cy, Math.max(20, editorWidth - 58));
      this.#drawSmallButton(ctx, rect.x + rect.width - 54, rect.y + 5, 22, rect.height - 10, '+', theme);
      this.#drawSmallButton(ctx, rect.x + rect.width - 28, rect.y + 5, 22, rect.height - 10, '-', theme);
    } else if (data.valueType === 'object') {
      // Pane mode uses object rows as folders; the label is enough.
    } else {
      this.#drawInspectorValueCell(ctx, {
        node,
        rect: { x: editorX, y: rect.y, width: editorWidth, height: rect.height },
        theme,
      });
    }
    ctx.globalAlpha = 1;
  }

  #drawInspectorValueCell(ctx, { node, rect, theme }) {
    const data = node.data ?? {};
    const meta = data.meta ?? {};
    const disabled = data.disabled;
    const readonly = data.readonly;
    const x = rect.x + 10;
    const y = rect.y + 5;
    const width = Math.max(24, rect.width - 20);
    const height = rect.height - 10;
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.globalAlpha = disabled ? 0.45 : 1;

    if (data.editorType === 'checkbox') {
      this.#drawCheckbox(ctx, x, rect.y + rect.height / 2 - 7, Boolean(data.value), theme);
    } else if (data.editorType === 'range') {
      this.#drawInspectorRange(ctx, x, rect.y + rect.height / 2 - 4, width, data, theme);
    } else if (data.editorType === 'color') {
      ctx.fillStyle = String(data.value || '#000000');
      ctx.fillRect(x, y + 2, 28, height - 4);
      ctx.strokeStyle = theme.colors.border;
      ctx.strokeRect(x + 0.5, y + 2.5, 28, height - 4);
      this.#drawMutedText(ctx, String(data.value ?? ''), x + 38, rect.y + rect.height / 2, width - 38, theme);
    } else if (data.editorType === 'button') {
      ctx.fillStyle = readonly || disabled ? theme.colors.progressTrack : theme.colors.rowHover;
      roundRect(ctx, x, y, meta.fullWidthButton ? width : Math.min(width, 140), height, 4);
      ctx.fill();
      ctx.fillStyle = theme.colors.text;
      ctx.textAlign = 'center';
      ctx.fillText(meta.button ?? node.label, x + (meta.fullWidthButton ? width : Math.min(width, 140)) / 2, rect.y + rect.height / 2);
      ctx.textAlign = 'left';
    } else if (data.editorType === 'select') {
      ctx.fillStyle = theme.colors.rowHover;
      roundRect(ctx, x, y, Math.min(width, 180), height, 4);
      ctx.fill();
      this.#drawMutedText(ctx, data.valueText, x + 8, rect.y + rect.height / 2, Math.min(width, 180) - 22, theme);
      ctx.fillStyle = theme.colors.chevron;
      ctx.fillText('v', x + Math.min(width, 180) - 14, rect.y + rect.height / 2);
    } else {
      this.#drawMutedText(ctx, data.valueText, x, rect.y + rect.height / 2, width, theme, readonly);
    }

    if (meta.updated) {
      ctx.fillStyle = theme.colors.focus;
      ctx.beginPath();
      ctx.arc(rect.x + rect.width - 10, rect.y + rect.height / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  #drawInspectorTypeCell(ctx, { node, rect, theme }) {
    this.#drawMutedText(ctx, node.data?.valueType ?? '', rect.x + 10, rect.y + rect.height / 2, rect.width - 20, theme);
  }

  #drawInspectorDescriptionCell(ctx, { node, rect, theme }) {
    this.#drawMutedText(ctx, node.data?.meta?.description ?? '', rect.x + 10, rect.y + rect.height / 2, rect.width - 20, theme);
  }

  #drawCheckbox(ctx, x, y, checked, theme) {
    ctx.strokeStyle = theme.colors.textMuted;
    ctx.strokeRect(x + 0.5, y + 0.5, 14, 14);
    if (!checked) return;
    ctx.strokeStyle = theme.colors.progressFill;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 7);
    ctx.lineTo(x + 6, y + 11);
    ctx.lineTo(x + 12, y + 3);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  #drawInspectorRange(ctx, x, y, width, data, theme) {
    const meta = data.meta ?? {};
    const min = meta.min ?? 0;
    const max = meta.max ?? 100;
    const value = typeof data.value === 'number' ? data.value : min;
    const ratio = max === min ? 0 : clamp01((value - min) / (max - min));
    const valueWidth = Math.min(64, Math.max(42, width * 0.28));
    const gap = 8;
    const barWidth = Math.max(24, width - valueWidth - gap);
    ctx.fillStyle = theme.colors.progressTrack;
    ctx.fillRect(x, y, barWidth, 8);
    ctx.fillStyle = theme.colors.progressFill;
    ctx.fillRect(x, y, barWidth * ratio, 8);
    ctx.fillStyle = theme.colors.rowHover;
    roundRect(ctx, x + barWidth + gap, y - 6, valueWidth, 20, 3);
    ctx.fill();
    ctx.fillStyle = theme.colors.text;
    ctx.textAlign = 'right';
    ctx.fillText(String(data.valueText ?? ''), x + barWidth + gap + valueWidth - 6, y + 4, valueWidth - 10);
    ctx.textAlign = 'left';
  }

  #drawSmallButton(ctx, x, y, width, height, label, theme) {
    ctx.fillStyle = theme.colors.rowHover;
    roundRect(ctx, x, y, width, height, 3);
    ctx.fill();
    ctx.fillStyle = theme.colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + height / 2, width - 4);
    ctx.textAlign = 'left';
  }

  #drawMutedText(ctx, text, x, y, width, theme, readonly = false) {
    ctx.fillStyle = readonly ? theme.colors.textMuted : theme.colors.text;
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(String(text ?? ''), x, y, Math.max(10, width));
  }

  #drawTreeCell(ctx, { node, row, rect, theme, style }) {
    const colors = theme.colors;
    const x = rect.x + row.depth * theme.indentWidth;
    const cy = rect.y + rect.height / 2;
    this.#drawChevron(ctx, x + 10, cy, row, colors);
    this.iconRegistry.draw(ctx, style.icon, x + 27, rect.y + 6, 15, style.color);
    ctx.fillStyle = colors.text;
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(node.label ?? node.id, x + 50, cy, Math.max(40, rect.x + rect.width - x - 56));
  }

  #drawStatusCell(ctx, { rect, style, theme }) {
    const badgeWidth = Math.min(58, rect.width - 12);
    const x = rect.x + (rect.width - badgeWidth) / 2;
    const y = rect.y + (rect.height - 16) / 2;
    ctx.fillStyle = style.status.color;
    roundRect(ctx, x, y, badgeWidth, 16, 8);
    ctx.fill();
    ctx.fillStyle = theme.colors.badgeText;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.status.label, x + badgeWidth / 2, y + 8, badgeWidth - 8);
    ctx.textAlign = 'left';
  }

  #drawProgressCell(ctx, { state, rect, theme, style }) {
    if (state.progress === undefined) return this.#drawTextCell(ctx, { state, rect, theme, style, column: { align: 'right', value: () => '' }, node: {} });
    const barX = rect.x + 10;
    const barY = rect.y + (rect.height - 8) / 2;
    const barWidth = Math.max(20, rect.width - 20);
    ctx.fillStyle = theme.colors.progressTrack;
    ctx.fillRect(barX, barY, barWidth, 8);
    ctx.fillStyle = state.color ?? theme.colors.progressFill;
    ctx.fillRect(barX, barY, barWidth * clamp01(state.progress), 8);
  }

  #drawTextCell(ctx, { node, state, rect, column, theme }) {
    let value = column.value(node, state);
    if (column.kind === 'updated' && typeof value === 'number') value = formatTime(value);
    if (typeof value === 'number') value = Math.round(value).toString();
    ctx.fillStyle = column.kind === 'type' ? resolveNodeStyle(theme, node, state).color : theme.colors.textMuted;
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = column.align;
    const x = column.align === 'right' ? rect.x + rect.width - 10 : column.align === 'center' ? rect.x + rect.width / 2 : rect.x + 10;
    ctx.fillText(String(value ?? ''), x, rect.y + rect.height / 2, rect.width - 20);
    ctx.textAlign = 'left';
  }

  #drawIndentGuides(ctx, row, colors) {
    if (!row.depth) return;
    ctx.strokeStyle = colors.guide;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let depth = 0; depth < row.depth; depth++) {
      const guideX = depth * this.scene.theme.indentWidth + 10.5;
      ctx.moveTo(guideX, row.y);
      ctx.lineTo(guideX, row.y + row.height);
    }
    ctx.stroke();
  }

  #drawChevron(ctx, x, y, row, colors) {
    ctx.fillStyle = row.hasChildren ? colors.chevron : colors.textMuted;
    if (!row.hasChildren) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    if (row.expanded) {
      ctx.moveTo(x - 5, y - 2);
      ctx.lineTo(x + 5, y - 2);
      ctx.lineTo(x, y + 4);
    } else {
      ctx.moveTo(x - 2, y - 5);
      ctx.lineTo(x - 2, y + 5);
      ctx.lineTo(x + 4, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function resolveNodeStyle(theme, node, state = {}) {
  const typeRule = theme.types[node?.type ?? ''] ?? {};
  const status = theme.statuses[state.status ?? 0] ?? { label: String(state.status ?? ''), color: theme.colors.textMuted };
  return {
    icon: state.icon ?? node?.icon ?? typeRule.icon ?? 'placeholder',
    color: state.color ?? typeRule.color ?? theme.colors.progressFill,
    typeColor: typeRule.color ?? theme.colors.progressFill,
    status,
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
