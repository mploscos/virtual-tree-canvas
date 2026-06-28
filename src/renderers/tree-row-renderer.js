import { IconRegistry } from '../core/icon-registry.js';

const DISABLED_ALPHA = 0.72;

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

  render(scene, time = performance.now()) {
    if (scene?.rows) this.scene = scene;
    if (!this.canvas || !this.ctx || !this.scene) return;
    const { viewport, theme } = this.scene;
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
    const colors = theme.colors;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    ctx.save();
    ctx.translate(viewport.renderInsetX ?? 0, viewport.renderInsetY ?? 0);
    this.#drawHeader(ctx);
    this.#drawRows(ctx);
    ctx.restore();
  }

  #drawHeader(ctx) {
    const { viewport, columns, theme, sort, headerFilter, filterQuery } = this.scene;
    if (viewport.headerHeight <= 0) return;
    const colors = theme.colors;
    const visibleWidth = viewport.contentViewportWidth ?? viewport.viewportWidth;
    ctx.save();
    ctx.fillStyle = colors.row;
    ctx.fillRect(0, 0, viewport.viewportWidth, viewport.headerHeight);
    ctx.beginPath();
    ctx.rect(0, 0, visibleWidth, viewport.headerHeight);
    ctx.clip();
    ctx.translate(-viewport.scrollX, 0);
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';

    for (const column of columns) {
      if (headerFilter && column.kind === 'inspectorPane') {
        this.#drawHeaderFilter(ctx, column, viewport, theme, filterQuery);
      } else {
        ctx.fillStyle = colors.textMuted;
        drawTruncatedText(ctx, column.label, column.x + 10, viewport.headerHeight / 2, column.width - 20);
      }
      if (sort?.columnId === column.id && sort.direction) {
        this.#drawSortIndicator(ctx, column.x + column.width - 16, viewport.headerHeight / 2, sort.direction, theme);
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
    ctx.lineTo(visibleWidth, viewport.headerHeight + 0.5);
    ctx.stroke();
  }

  #drawHeaderFilter(ctx, column, viewport, theme, filterQuery) {
    const colors = theme.colors;
    const x = column.x + 8;
    const y = 5;
    const visibleRight = viewport.scrollX + (viewport.contentViewportWidth ?? viewport.viewportWidth);
    const visibleWidth = Math.max(1, Math.min(column.x + column.width, visibleRight) - column.x);
    const width = Math.max(40, visibleWidth - 16);
    const height = Math.max(18, viewport.headerHeight - 10);
    ctx.fillStyle = colors.progressTrack;
    roundRect(ctx, x, y, width, height, 4);
    ctx.fill();
    ctx.strokeStyle = colors.border;
    ctx.stroke();
    ctx.fillStyle = filterQuery ? colors.text : colors.textMuted;
    drawTruncatedText(ctx, filterQuery || 'Filter inspector', x + 8, viewport.headerHeight / 2, width - 16);
  }

  #drawSortIndicator(ctx, x, y, direction, theme) {
    ctx.fillStyle = theme.colors.focus;
    ctx.beginPath();
    if (direction === 'asc') {
      ctx.moveTo(x, y + 3);
      ctx.lineTo(x + 5, y - 3);
      ctx.lineTo(x + 10, y + 3);
    } else {
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + 5, y + 3);
      ctx.lineTo(x + 10, y - 3);
    }
    ctx.closePath();
    ctx.fill();
  }

  #drawRows(ctx) {
    const { rows, visibleRange, viewport } = this.scene;
    this.renderedRows = visibleRange.count;
    const visibleWidth = viewport.contentViewportWidth ?? viewport.viewportWidth;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, viewport.headerHeight, visibleWidth, viewport.rowViewportHeight);
    ctx.clip();
    ctx.translate(-viewport.scrollX, viewport.headerHeight - viewport.scrollY);
    for (let i = visibleRange.first; i <= visibleRange.last; i++) {
      const row = rows[i];
      if (row) this.#drawRow(ctx, row);
    }
    ctx.restore();
  }

  #drawRow(ctx, row) {
    const { columns, nodes, dynamicState, selection, hoverNodeId, hoverPart, activeNodeId, activePart, focusNodeId, searchMatches, theme, viewport } = this.scene;
    const node = nodes[row.nodeIndex];
    const state = dynamicState.get(row.nodeId) ?? {};
    const style = resolveNodeStyle(theme, node, state);
    const colors = theme.colors;
    const selected = selection.has(row.nodeId) || state.selected;
    const highlighted = state.highlighted || searchMatches.has(row.nodeId);
    const hovered = hoverNodeId === row.nodeId;
    const focused = focusNodeId === row.nodeId;
    const y = row.y;
    const visibleX = viewport.scrollX;
    const visibleWidth = viewport.contentViewportWidth ?? viewport.viewportWidth;

    ctx.fillStyle = selected ? colors.rowSelected : highlighted ? colors.rowHighlighted : hovered ? colors.rowHover : colors.row;
    ctx.fillRect(visibleX, y, visibleWidth, row.height);

    this.#drawIndentGuides(ctx, row, colors);

    for (const column of columns) {
      const rect = { x: column.x, y, width: column.width, height: row.height };
      this.#drawCell(ctx, {
        node,
        state,
        row,
        column,
        rect,
        theme,
        style,
        selected,
        hovered,
        hoverPart: hoverNodeId === row.nodeId ? hoverPart : null,
        activePart: activeNodeId === row.nodeId ? activePart : null,
      });
      ctx.strokeStyle = colors.border;
      ctx.beginPath();
      ctx.moveTo(column.x + column.width + 0.5, y);
      ctx.lineTo(column.x + column.width + 0.5, y + row.height);
      ctx.stroke();
    }

    ctx.strokeStyle = colors.border;
    ctx.beginPath();
    ctx.moveTo(visibleX, y + row.height + 0.5);
    ctx.lineTo(visibleX + visibleWidth, y + row.height + 0.5);
    ctx.stroke();

    if (state.updated && node.data?.inspector) this.#drawUpdatedMarker(ctx, row, theme);

    if (focused) {
      ctx.strokeStyle = colors.focus;
      ctx.strokeRect(visibleX + 1.5, y + 2.5, visibleWidth - 3, row.height - 5);
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

  #drawInspectorPaneCell(ctx, { node, row, rect, theme, style, hovered, hoverPart, activePart }) {
    const visibleRight = this.scene.viewport.scrollX + (this.scene.viewport.contentViewportWidth ?? this.scene.viewport.viewportWidth);
    rect = { ...rect, width: Math.max(1, Math.min(rect.x + rect.width, visibleRight) - rect.x) };
    const data = node.data ?? {};
    const colors = theme.colors;
    const indentX = rect.x + row.depth * theme.indentWidth;
    const cy = rect.y + rect.height / 2;
    let labelX = indentX + 28;
    if (!row.hasChildren && node.icon) {
      this.iconRegistry.draw(ctx, style.icon, indentX + 3, rect.y + 6, 15, style.color);
      labelX = indentX + 24;
    } else if (!row.hasChildren) {
      labelX = indentX + 24;
    } else {
      this.#drawChevron(ctx, indentX + 10, cy, row, colors);
    }
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.globalAlpha = data.disabled ? DISABLED_ALPHA : 1;
    ctx.fillStyle = data.valueType === 'object' || data.valueType === 'array' ? colors.text : colors.textMuted;

    if (data.valueType === 'object') {
      drawTruncatedText(ctx, node.label ?? node.id, labelX, cy, Math.max(20, rect.x + rect.width - labelX - 8));
      if (data.meta?.updated) this.#drawUpdatedMarker(ctx, row, theme);
      ctx.globalAlpha = 1;
      return;
    }

    const layout = inspectorPaneLayout(rect.width, row.depth, theme.indentWidth, data.editorType, this.scene.inspectorPaneLabelEnd);
    drawTruncatedText(ctx, node.label ?? node.id, labelX, cy, Math.max(20, rect.x + layout.editorLeft - labelX - 8));

    const editorX = rect.x + layout.editorLeft;
    const editorWidth = layout.editorWidth;
    if (data.valueType === 'array') {
      ctx.fillStyle = colors.textMuted;
      drawTruncatedText(ctx, data.valueText, editorX, cy, Math.max(20, editorWidth - 58));
      this.#drawSmallButton(ctx, rect.x + rect.width - 54, rect.y + 5, 22, rect.height - 10, '+', theme, {
        hovered: hovered && hoverPart === 'arrayAdd',
        active: activePart === 'arrayAdd',
      });
      this.#drawSmallButton(ctx, rect.x + rect.width - 28, rect.y + 5, 22, rect.height - 10, '-', theme, {
        hovered: hovered && hoverPart === 'arrayRemove',
        active: activePart === 'arrayRemove',
      });
    } else {
      this.#drawInspectorValueCell(ctx, {
        node,
        rect: { x: editorX, y: rect.y, width: editorWidth, height: rect.height },
        theme,
        hovered,
        hoverPart,
        activePart,
        suppressUpdatedMarker: true,
      });
    }
    if (data.meta?.updated) this.#drawUpdatedMarker(ctx, row, theme);
    ctx.globalAlpha = 1;
  }

  #drawInspectorValueCell(ctx, { node, rect, theme, hovered = false, hoverPart = null, activePart = null, suppressUpdatedMarker = false }) {
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
    ctx.globalAlpha = disabled ? DISABLED_ALPHA : 1;

    if (data.editorType === 'checkbox') {
      this.#drawCheckbox(ctx, x, rect.y + rect.height / 2 - 8, Boolean(data.value), theme);
    } else if (data.editorType === 'range') {
      this.#drawInspectorRange(ctx, x, rect.y + rect.height / 2 - 4, width, data, theme, {
        hoveredNumber: hovered && hoverPart === 'number',
        activeNumber: activePart === 'number',
      });
    } else if (data.editorType === 'color') {
      ctx.fillStyle = String(data.value || '#000000');
      ctx.fillRect(x, y + 2, 28, height - 4);
      ctx.strokeStyle = theme.colors.border;
      ctx.strokeRect(x + 0.5, y + 2.5, 28, height - 4);
      this.#drawMutedText(ctx, String(data.value ?? ''), x + 38, rect.y + rect.height / 2, width - 38, theme);
    } else if (data.editorType === 'button') {
      const buttonWidth = meta.fullWidthButton ? width : Math.min(width, 140);
      this.#drawControlSurface(ctx, x, y, buttonWidth, height, theme, {
        hovered: hovered && hoverPart === 'button',
        active: activePart === 'button',
        disabled: readonly || disabled,
      });
      ctx.fillStyle = theme.colors.text;
      ctx.textAlign = 'center';
      drawTruncatedText(ctx, meta.button ?? node.label, x + buttonWidth / 2, rect.y + rect.height / 2, Math.max(10, buttonWidth - 12));
      ctx.textAlign = 'left';
    } else if (data.editorType === 'select') {
      const selectWidth = Math.min(width, 180);
      this.#drawControlSurface(ctx, x, y, selectWidth, height, theme, {
        hovered: hovered && hoverPart === 'editor',
        active: activePart === 'editor',
        disabled: readonly || disabled,
      });
      this.#drawMutedText(ctx, data.valueText, x + 8, rect.y + rect.height / 2, selectWidth - 30, theme);
      this.#drawSelectChevron(ctx, x + selectWidth - 18, rect.y + rect.height / 2, theme, disabled);
    } else {
      this.#drawMutedText(ctx, data.valueText, x, rect.y + rect.height / 2, width, theme, readonly);
    }

    if (meta.updated && !suppressUpdatedMarker) {
      ctx.fillStyle = theme.colors.focus;
      ctx.beginPath();
      ctx.arc(rect.x + rect.width - 10, rect.y + rect.height / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  #drawUpdatedMarker(ctx, row, theme) {
    const x = Math.max(6, row.depth * theme.indentWidth - 8);
    const y = row.y + row.height / 2;
    ctx.fillStyle = theme.colors.focus;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  #drawInspectorTypeCell(ctx, { node, rect, theme }) {
    this.#drawMutedText(ctx, node.data?.valueType ?? '', rect.x + 10, rect.y + rect.height / 2, rect.width - 20, theme, false, theme.monoFont);
  }

  #drawInspectorDescriptionCell(ctx, { node, rect, theme }) {
    this.#drawMutedText(ctx, node.data?.meta?.description ?? '', rect.x + 10, rect.y + rect.height / 2, rect.width - 20, theme);
  }

  #drawCheckbox(ctx, x, y, checked, theme) {
    roundRect(ctx, x, y, 16, 16, 3);
    ctx.fillStyle = theme.colors.progressTrack;
    ctx.fill();
    ctx.strokeStyle = checked ? theme.colors.progressFill : theme.colors.textMuted;
    ctx.stroke();
    if (!checked) return;
    ctx.fillStyle = theme.colors.progressFill;
    roundRect(ctx, x + 4, y + 4, 8, 8, 1.5);
    ctx.fill();
  }

  #drawInspectorRange(ctx, x, y, width, data, theme, state = {}) {
    const meta = data.meta ?? {};
    const min = meta.min ?? 0;
    const max = meta.max ?? 100;
    const value = typeof data.value === 'number' ? data.value : min;
    const ratio = max === min ? 0 : clamp01((value - min) / (max - min));
    const valueWidth = Math.min(64, Math.max(42, width * 0.28));
    const gap = 8;
    const barWidth = Math.max(24, width - valueWidth - gap);
    this.#drawMeterBar(ctx, x, y + 0.5, barWidth, 7, ratio, theme.colors.progressFill, theme);
    this.#drawControlSurface(ctx, x + barWidth + gap, y - 6, valueWidth, 20, theme, {
      hovered: Boolean(state.hoveredNumber),
      active: Boolean(state.activeNumber),
    });
    ctx.fillStyle = theme.colors.text;
    ctx.font = theme.monoFont ?? theme.font;
    ctx.textAlign = 'right';
    drawTruncatedText(ctx, String(data.valueText ?? ''), x + barWidth + gap + valueWidth - 6, y + 4, valueWidth - 10);
    ctx.textAlign = 'left';
    ctx.font = theme.font;
  }

  #drawSmallButton(ctx, x, y, width, height, label, theme, state = {}) {
    this.#drawControlSurface(ctx, x, y, width, height, theme, state);
    ctx.fillStyle = theme.colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTruncatedText(ctx, label, x + width / 2, y + height / 2, width - 4);
    ctx.textAlign = 'left';
  }

  #drawControlSurface(ctx, x, y, width, height, theme, { hovered = false, active = false, disabled = false } = {}) {
    const colors = theme.colors;
    ctx.fillStyle = disabled
      ? colors.progressTrack
      : active
        ? mixColor(colors.rowHover, colors.focus, 0.36)
        : hovered
          ? mixColor(colors.rowHover, colors.focus, 0.18)
          : colors.progressTrack;
    roundRect(ctx, x, y, width, height, 5);
    ctx.fill();
    ctx.strokeStyle = active ? colors.focus : hovered ? mixColor(colors.border, colors.focus, 0.5) : colors.border;
    ctx.stroke();
  }

  #drawSelectChevron(ctx, x, y, theme, disabled = false) {
    ctx.fillStyle = disabled ? theme.colors.textMuted : theme.colors.chevron;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 2);
    ctx.lineTo(x + 4, y - 2);
    ctx.lineTo(x, y + 3);
    ctx.closePath();
    ctx.fill();
  }

  #drawMutedText(ctx, text, x, y, width, theme, readonly = false, font = null) {
    ctx.fillStyle = readonly ? theme.colors.textMuted : theme.colors.text;
    ctx.font = font ?? theme.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    drawTruncatedText(ctx, String(text ?? ''), x, y, Math.max(10, width));
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
    drawTruncatedText(ctx, node.label ?? node.id, x + 50, cy, Math.max(40, rect.x + rect.width - x - 56));
  }

  #drawStatusCell(ctx, { rect, style, theme }) {
    const badgeWidth = Math.min(58, rect.width - 12);
    const x = rect.x + (rect.width - badgeWidth) / 2;
    const y = rect.y + (rect.height - 17) / 2;
    const statusColor = style.status.color;
    const baseFill = theme.colors.badgeFill ?? theme.colors.progressTrack;
    ctx.fillStyle = mixColor(baseFill, statusColor, 0.18);
    roundRect(ctx, x, y, badgeWidth, 17, 8);
    ctx.fill();
    ctx.strokeStyle = mixColor(theme.colors.border, statusColor, 0.42);
    ctx.stroke();
    ctx.fillStyle = mixColor(theme.colors.text, statusColor, 0.36);
    ctx.font = '10px "JetBrains Mono", "Cascadia Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTruncatedText(ctx, style.status.label, x + badgeWidth / 2, y + 8.5, badgeWidth - 8);
    ctx.textAlign = 'left';
  }

  #drawProgressCell(ctx, { state, rect, theme, style }) {
    if (state.progress === undefined) return this.#drawTextCell(ctx, { state, rect, theme, style, column: { align: 'right', value: () => '' }, node: {} });
    const ratio = clamp01(state.progress);
    const barX = rect.x + 10;
    const barHeight = 7;
    const barY = rect.y + (rect.height - barHeight) / 2;
    const barWidth = Math.max(20, rect.width - 20);
    const fillColor = state.color ?? theme.colors.progressFill;
    this.#drawMeterBar(ctx, barX, barY, barWidth, barHeight, ratio, fillColor, theme);
  }

  #drawMeterBar(ctx, x, y, width, height, ratio, fillColor, theme) {
    const radius = height / 2;
    ctx.fillStyle = theme.colors.progressTrack;
    roundRect(ctx, x, y, width, height, radius);
    ctx.fill();
    ctx.strokeStyle = mixColor(theme.colors.border, fillColor, 0.22);
    ctx.stroke();

    const fillWidth = width * clamp01(ratio);
    if (fillWidth <= 0) return;
    ctx.save();
    roundRect(ctx, x, y, width, height, radius);
    ctx.clip();
    ctx.fillStyle = fillColor;
    roundRect(ctx, x, y, Math.max(1, fillWidth), height, Math.min(radius, fillWidth / 2));
    ctx.fill();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = mixColor(fillColor, '#ffffff', 0.38);
    ctx.fillRect(x + 1, y + 1, Math.max(0, fillWidth - 2), 1);
    ctx.restore();
  }

  #drawTextCell(ctx, { node, state, rect, column, theme }) {
    let value = column.value(node, state);
    if (column.kind === 'updated' && typeof value === 'number') value = formatTime(value);
    if (typeof value === 'number') value = Math.round(value).toString();
    ctx.fillStyle = column.kind === 'type' ? resolveNodeStyle(theme, node, state).color : theme.colors.textMuted;
    ctx.font = column.kind === 'type' || column.kind === 'updated' || typeof value === 'number' ? theme.monoFont ?? theme.font : theme.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = column.align;
    const x = column.align === 'right' ? rect.x + rect.width - 10 : column.align === 'center' ? rect.x + rect.width / 2 : rect.x + 10;
    drawTruncatedText(ctx, String(value ?? ''), x, rect.y + rect.height / 2, rect.width - 20);
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

function inspectorPaneLayout(width, depth = 0, indentWidth = 18, editorType = '', labelEnd = 0) {
  const safeWidth = Math.max(1, width);
  const rightPadding = 14;
  if (editorType === 'checkbox') {
    const editorWidth = 34;
    return { editorLeft: Math.max(64, safeWidth - rightPadding - editorWidth), editorWidth };
  }
  const minEditor = Math.min(170, Math.max(96, safeWidth * 0.45));
  const minLabelEnd = Math.max(88, depth * indentWidth + 104);
  const preferredLeft = Math.max(minLabelEnd, labelEnd, safeWidth * 0.32);
  const maxLeft = Math.max(64, safeWidth - rightPadding - minEditor);
  const editorLeft = Math.max(64, Math.min(preferredLeft, maxLeft));
  const editorWidth = Math.max(56, safeWidth - rightPadding - editorLeft);
  return { editorLeft, editorWidth };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
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

function mixColor(a, b, amount) {
  const from = parseHexColor(a);
  const to = parseHexColor(b);
  if (!from || !to) return amount >= 0.5 ? b : a;
  const t = clamp01(amount);
  const value = from.map((channel, index) => Math.round(channel + (to[index] - channel) * t));
  return `rgb(${value[0]}, ${value[1]}, ${value[2]})`;
}

function parseHexColor(value) {
  const text = String(value ?? '').trim();
  const match = /^#([0-9a-f]{6})$/i.exec(text);
  if (!match) return null;
  const number = Number.parseInt(match[1], 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function drawTruncatedText(ctx, text, x, y, maxWidth) {
  const value = String(text ?? '');
  const width = Math.max(0, maxWidth);
  if (!value || width <= 0) return;
  ctx.fillText(fitText(ctx, value, width), x, y);
}

const TEXT_FIT_CACHE_LIMIT = 6000;
const textFitCache = new Map();

function fitText(ctx, text, maxWidth) {
  const safeWidth = Math.max(0, Math.floor(maxWidth));
  const cacheKey = `${ctx.font}\u0000${safeWidth}\u0000${text}`;
  const cached = textFitCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let result = text;
  if (ctx.measureText(text).width <= safeWidth) {
    setTextFitCache(cacheKey, result);
    return result;
  }
  const ellipsis = '...';
  const ellipsisWidth = ctx.measureText(ellipsis).width;
  if (ellipsisWidth > safeWidth) {
    setTextFitCache(cacheKey, '');
    return '';
  }
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = text.slice(0, mid);
    if (ctx.measureText(candidate).width + ellipsisWidth <= safeWidth) low = mid;
    else high = mid - 1;
  }
  result = `${text.slice(0, low)}${ellipsis}`;
  setTextFitCache(cacheKey, result);
  return result;
}

function setTextFitCache(key, value) {
  textFitCache.set(key, value);
  if (textFitCache.size <= TEXT_FIT_CACHE_LIMIT) return;
  const firstKey = textFitCache.keys().next().value;
  if (firstKey !== undefined) textFitCache.delete(firstKey);
}

const timeFormatter = new Intl.DateTimeFormat([], {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatTime(value) {
  const time = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(time)) return '';
  return timeFormatter.format(time);
}
