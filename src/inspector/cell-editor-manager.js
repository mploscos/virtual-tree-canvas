import { numericLayout } from './numeric-layout.js';

export class CellEditorManager {
  constructor({ controller, host = null }) {
    if (!controller) throw new TypeError('CellEditorManager requires a TreeViewController');
    if (!controller.canvas)
      throw new Error('CellEditorManager requires an initialized TreeViewController canvas');
    this.controller = controller;
    this.canvas = controller.canvas;
    this.view = this.canvas.ownerDocument.defaultView;
    this.host = host ?? controller.canvas.parentElement ?? document.body;
    this.editable = true;
    this.overlay = null;
    this.rangeDrag = null;
    this.overlayKind = null;
    this.overlayNode = null;
    this.stopFilter = controller.on('filterchange', ({ detail }) => {
      if (this.overlayKind === 'filter' && this.overlay) this.overlay.value = detail.query;
    });
    this.stopTheme = controller.on('themechange', () => this.#syncOverlayTheme());
    this.onMouseMove = this.#onMouseMove.bind(this);
    this.onMouseUp = this.#onMouseUp.bind(this);
  }

  setEditable(enabled) {
    this.editable = enabled;
    if (!enabled) this.close();
  }

  destroy() {
    this.stopFilter();
    this.stopTheme();
    this.#removeOverlay();
    this.view.removeEventListener('mousemove', this.onMouseMove);
    this.view.removeEventListener('mouseup', this.onMouseUp);
  }

  close() {
    this.#removeOverlay();
    this.rangeDrag = null;
    this.view.removeEventListener('mousemove', this.onMouseMove);
    this.view.removeEventListener('mouseup', this.onMouseUp);
  }

  /**
   * Keep an in-progress edit while values refresh; cancel if its editor changes.
   */
  reconcile(nodes) {
    const previous = this.overlayNode ?? this.rangeDrag?.node;
    if (!previous) return;
    const next = nodes.find((node) => node.id === previous.id);
    const signature = (data) =>
      JSON.stringify([
        data.editorType,
        data.readonly,
        data.disabled,
        ...['min', 'max', 'step', 'integer', 'options', 'unit'].map((key) => data.meta?.[key])
      ]);
    if (!next || signature(previous.data) !== signature(next.data)) this.close();
  }

  handlePointerDown(event, hit) {
    if (!this.editable || !this.#isEditableHit(hit)) return false;
    const data = hit.row ? this.controller.model.nodes[hit.row.nodeIndex]?.data : null;
    if (!data || data.readonly || data.disabled) return false;
    if (data.editorType === 'range' && hit.part === 'range') {
      this.rangeDrag = {
        hit,
        data,
        node: this.controller.model.nodes[hit.row.nodeIndex]
      };
      this.#updateRangeFromEvent(event);
      this.view.addEventListener('mousemove', this.onMouseMove);
      this.view.addEventListener('mouseup', this.onMouseUp);
      return true;
    }
    // A native select created during mousedown can receive the matching mouseup,
    // which immediately closes its picker. Open it after the click instead.
    if (data.editorType === 'select' && this.view.HTMLSelectElement?.prototype?.showPicker)
      return false;
    if (shouldOpenOverlayOnPointerDown(data, hit)) {
      const node = this.controller.model.nodes[hit.row.nodeIndex];
      this.#showOverlay(node, hit, {
        showPicker: true
      });
      return true;
    }
    return false;
  }

  handleClick(event, hit) {
    if (!this.editable || !this.#isEditableHit(hit)) return false;
    const node = this.controller.model.nodes[hit.row.nodeIndex];
    const data = node?.data;
    if (!data || data.disabled) return false;
    if (hit.part === 'arrayAdd') return this.controller.addInspectorArrayItem(node.id);
    if (hit.part === 'arrayRemove') return this.controller.removeInspectorArrayItem(node.id);
    if (data.editorType === 'button') return this.controller.triggerInspectorAction(node.id);
    if (data.readonly) return false;
    if (data.editorType === 'checkbox') {
      this.controller.updateInspectorValue(node.id, !data.value, 'checkbox');
      return true;
    }
    if (data.editorType === 'range') {
      if (hit.part === 'range') return true;
      if (hit.part !== 'number') {
        this.#toggleRangeMinMax(node, data);
        return true;
      }
    }
    if (this.overlay) return true;
    this.#showOverlay(node, hit, { showPicker: data.editorType === 'select' });
    return true;
  }

  handleHeaderClick(_event, hit) {
    if (hit?.area !== 'header' || hit.part !== 'filter') return false;
    this.#showHeaderFilterOverlay(hit);
    return true;
  }

  #showOverlay(node, hit, options = {}) {
    this.#removeOverlay();
    const data = node.data;
    const rect = this.#clampRectToHost(this.#overlayRect(hit), 4);
    const hostRect = this.host.getBoundingClientRect();
    const element = createEditorElement(data);
    element.className = `vtc-editor vtc-editor-${data.editorType}`;
    element.setAttribute(
      'aria-label',
      [node.label, numericLayout(rect.width, data).unit].filter(Boolean).join(' ')
    );
    Object.assign(element.style, {
      position: 'absolute',
      left: `${rect.x - hostRect.left}px`,
      top: `${rect.y - hostRect.top}px`,
      width: `${Math.max(24, rect.width)}px`,
      height: `${Math.max(18, rect.height)}px`,
      minWidth: '0',
      maxWidth: `${Math.max(24, rect.width)}px`,
      zIndex: 20,
      boxSizing: 'border-box',
      margin: '0',
      outline: 'none',
      appearance: 'none',
      borderRadius: '5px',
      font: editorFont(data),
      padding:
        data.editorType === 'color'
          ? '0 2px'
          : data.editorType === 'select'
            ? '0 22px 0 8px'
            : '0 8px',
      textAlign: data.editorType === 'number' || data.editorType === 'range' ? 'right' : 'left'
    });
    applyEditorTheme(element, this.controller.themeManager.get());
    let committed = false;
    const commit = () => {
      if (committed || this.overlay !== element) return;
      committed = true;
      const nextValue = parseEditorValue(element, data);
      this.controller.updateInspectorValue(node.id, nextValue, data.editorType);
      this.#removeOverlay();
    };
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') commit();
      else if (event.key === 'Escape') this.#removeOverlay();
    });
    if (data.editorType === 'select') {
      element.addEventListener('change', commit);
    }
    element.addEventListener('blur', commit);
    ensureOverlayHost(this.host);
    this.host.append(element);
    this.overlay = element;
    this.overlayKind = 'value';
    this.overlayNode = node;
    element.focus({
      preventScroll: true
    });
    element.select?.();
    if (options.showPicker && element.showPicker) {
      const open = () => {
        try {
          element.showPicker();
        } catch (_error) {
          // Some browsers restrict showPicker to specific input types or gestures.
        }
      };
      if (data.editorType === 'select') open();
      else requestAnimationFrame(open);
    }
  }

  #showHeaderFilterOverlay(hit) {
    this.#removeOverlay();
    const headerRect = this.controller.getHeaderClientRect(hit);
    const rect = this.#clampRectToHost(
      {
        x: headerRect.x + 8,
        y: headerRect.y + 5,
        width: Math.max(
          24,
          Math.min(headerRect.width, this.controller.viewport.contentViewportWidth) - 16
        ),
        height: Math.max(20, headerRect.height - 10)
      },
      0
    );
    const hostRect = this.host.getBoundingClientRect();
    const element = document.createElement('input');
    element.type = 'search';
    element.value = this.controller.filterQuery ?? '';
    element.placeholder = 'Filter inspector';
    Object.assign(element.style, {
      position: 'absolute',
      left: `${rect.x - hostRect.left}px`,
      top: `${rect.y - hostRect.top}px`,
      width: `${Math.max(24, rect.width)}px`,
      height: `${Math.max(20, rect.height)}px`,
      minWidth: '0',
      maxWidth: `${Math.max(24, rect.width)}px`,
      zIndex: 20,
      boxSizing: 'border-box',
      margin: '0',
      outline: 'none',
      borderRadius: '4px',
      font: SANS_FONT,
      padding: '0 8px'
    });
    applyEditorTheme(element, this.controller.themeManager.get());
    element.addEventListener('input', () => this.controller.setFilter(element.value));
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.#removeOverlay();
      if (event.key === 'Enter') this.#removeOverlay();
    });
    element.addEventListener('blur', () => this.#removeOverlay());
    ensureOverlayHost(this.host);
    this.host.append(element);
    this.overlay = element;
    this.overlayKind = 'filter';
    element.focus({
      preventScroll: true
    });
    element.select();
  }

  #updateRangeFromEvent(event) {
    const { hit, data } = this.rangeDrag;
    const node = this.controller.model.nodes[hit.row.nodeIndex];
    const rect = this.#rangeBarRect(hit);
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.x));
    const meta = data.meta ?? {};
    const min = meta.min ?? 0;
    const max = meta.max ?? 100;
    const step = meta.step ?? (meta.integer ? 1 : 0);
    let value = min + (x / Math.max(1, rect.width)) * (max - min);
    if (step) value = Math.round(value / step) * step;
    if (meta.integer) value = Math.round(value);
    value = Math.max(min, Math.min(max, value));
    if (this.controller.updateInspectorValue(node.id, value, 'range'))
      this.#syncRangeOverlay(node.id);
  }

  #onMouseMove(event) {
    if (this.rangeDrag) this.#updateRangeFromEvent(event);
  }

  #onMouseUp() {
    this.rangeDrag = null;
    this.view.removeEventListener('mousemove', this.onMouseMove);
    this.view.removeEventListener('mouseup', this.onMouseUp);
  }

  #isEditableHit(hit) {
    return (
      hit?.area === 'row' &&
      !['unit', 'label', 'chevron'].includes(hit.part) &&
      (hit.column?.kind === 'inspectorValue' || hit.column?.kind === 'inspectorPane')
    );
  }

  #editorContentRect(hit) {
    const rect = this.controller.getCellClientRect(hit);
    if (hit.column?.kind !== 'inspectorPane') {
      return {
        x: rect.x + 10,
        y: rect.y + 5,
        width: Math.max(24, rect.width - 20),
        height: rect.height - 10
      };
    }
    const visibleWidth = Math.max(
      1,
      Math.min(rect.width, this.controller.viewport.contentViewportWidth)
    );
    const data = this.controller.model.nodes[hit.row.nodeIndex]?.data ?? {};
    const { editorLeft, editorWidth } = this.controller.getInspectorPaneLayout(
      visibleWidth,
      hit.row,
      data.editorType
    );
    return {
      x: rect.x + editorLeft + 10,
      y: rect.y + 5,
      width: Math.max(24, editorWidth - 20),
      height: rect.height - 10
    };
  }

  #overlayRect(hit) {
    const data = this.controller.model.nodes[hit.row.nodeIndex]?.data ?? {};
    const rect = this.#editorContentRect(hit);
    const layout = numericLayout(rect.width, data);
    if (data.editorType === 'select') {
      return { ...rect, width: Math.min(layout.contentWidth, 180) };
    }
    if (hit.part === 'number' && data.editorType === 'range') {
      return {
        ...rect,
        x: rect.x + layout.numberLeft,
        y: rect.y - 1,
        width: layout.valueWidth,
        height: rect.height + 2
      };
    }
    if (layout.unit)
      return {
        ...rect,
        width: layout.contentWidth
      };
    return rect;
  }

  #rangeBarRect(hit) {
    const data = this.controller.model.nodes[hit.row.nodeIndex]?.data ?? {};
    const rect = this.#editorContentRect(hit);
    return {
      ...rect,
      y: rect.y + rect.height / 2 - 4,
      width: numericLayout(rect.width, data).barWidth,
      height: 8
    };
  }

  #clampRectToHost(rect, inset = 0) {
    const hostRect = this.host.getBoundingClientRect();
    const minX = hostRect.left + inset;
    const minY = hostRect.top + inset;
    const maxX = hostRect.right - inset;
    const maxY = hostRect.bottom - inset;
    const width = Math.max(24, Math.min(rect.width, maxX - minX));
    const height = Math.max(18, Math.min(rect.height, maxY - minY));
    const x = Math.max(minX, Math.min(rect.x, maxX - width));
    const y = Math.max(minY, Math.min(rect.y, maxY - height));
    return {
      x,
      y,
      width,
      height
    };
  }

  #removeOverlay() {
    const overlay = this.overlay;
    this.overlay = null;
    this.overlayKind = null;
    this.overlayNode = null;
    overlay?.remove();
  }

  #syncOverlayTheme() {
    if (this.overlay) applyEditorTheme(this.overlay, this.controller.themeManager.get());
  }

  #syncRangeOverlay(nodeId) {
    if (
      this.overlayKind !== 'value' ||
      this.overlayNode?.id !== nodeId ||
      this.overlayNode.data?.editorType !== 'range' ||
      !this.overlay
    ) return;
    const value = this.controller.model.index.getNode(nodeId)?.data?.value;
    this.overlay.value = value == null ? '' : String(value);
  }

  #toggleRangeMinMax(node, data) {
    const meta = data.meta ?? {};
    const min = Number.isFinite(meta.min) ? meta.min : 0;
    const max = Number.isFinite(meta.max) ? meta.max : 100;
    const current =
      typeof data.value === 'number' && Number.isFinite(data.value) ? data.value : min;
    if (this.controller.updateInspectorValue(node.id, current <= min ? max : min, 'range'))
      this.#syncRangeOverlay(node.id);
  }

}

function applyEditorTheme(element, theme) {
  const colors = theme.colors;
  const isSelect = element.tagName === 'SELECT';
  Object.assign(element.style, {
    border: `1px solid ${colors.focus}`,
    backgroundColor: isSelect ? colors.progressTrack : (colors.control ?? colors.background),
    color: isSelect ? (theme.valueColors?.enum ?? colors.text) : colors.text,
    caretColor: colors.focus,
    font: element.classList.contains('vtc-editor-number') || element.classList.contains('vtc-editor-range')
      ? (theme.monoFont ?? MONO_FONT)
      : (theme.font ?? SANS_FONT),
    boxShadow: `0 0 0 1px ${colors.borderStrong ?? colors.border}, 0 8px 20px ${colors.shadow ?? 'transparent'}`
  });
  if (isSelect) {
    const chevron = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="${colors.chevron}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    Object.assign(element.style, {
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(chevron)}")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 10px center',
      backgroundSize: '12px 12px'
    });
    for (const option of element.options) {
      option.style.backgroundColor = colors.control ?? colors.background;
      option.style.color = colors.text;
    }
  }
}

function createEditorElement(data) {
  if (data.editorType === 'select') {
    const select = document.createElement('select');
    for (const [label, value] of Object.entries(data.meta.options ?? {})) {
      const option = document.createElement('option');
      option.textContent = label;
      option.value = String(value);
      option.selected = value === data.value;
      select.append(option);
    }
    return select;
  }
  const input = document.createElement('input');
  input.type = data.editorType === 'color' ? 'color' : 'text';
  if (data.editorType === 'number' || data.editorType === 'range') {
    input.inputMode = data.meta.integer ? 'numeric' : 'decimal';
  }
  input.value = data.value ?? '';
  if (data.meta.min !== undefined) input.min = data.meta.min;
  if (data.meta.max !== undefined) input.max = data.meta.max;
  if (data.meta.step !== undefined) input.step = data.meta.step;
  return input;
}

function shouldOpenOverlayOnPointerDown(data, hit) {
  if (data.readonly || data.disabled) return false;
  if (data.editorType === 'range') return hit.part === 'number';
  return (
    data.editorType === 'text' ||
    data.editorType === 'number' ||
    data.editorType === 'select' ||
    data.editorType === 'color'
  );
}

function ensureOverlayHost(host) {
  const style = getComputedStyle(host);
  if (style.position === 'static') host.style.position = 'relative';
  if (style.overflow === 'visible') host.style.overflow = 'hidden';
}

function parseEditorValue(element, data) {
  if (data.editorType === 'number' || data.editorType === 'range') {
    const value = data.meta.integer ? Number.parseInt(element.value, 10) : Number(element.value);
    if (!Number.isFinite(value)) return data.value;
    const min = Number.isFinite(data.meta.min) ? data.meta.min : -Infinity;
    const max = Number.isFinite(data.meta.max) ? data.meta.max : Infinity;
    return Math.max(min, Math.min(max, value));
  }
  if (data.editorType === 'select') {
    const values = Object.values(data.meta.options ?? {});
    const match = values.find((value) => String(value) === element.value);
    return match ?? element.value;
  }
  return element.value;
}

const SANS_FONT = '12px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO_FONT =
  '12px "JetBrains Mono", "Cascadia Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, monospace';

function editorFont(data) {
  return data.editorType === 'number' || data.editorType === 'range' ? MONO_FONT : SANS_FONT;
}
