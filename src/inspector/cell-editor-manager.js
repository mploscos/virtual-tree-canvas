import { numericLayout } from './numeric-layout.js';

let selectMenuId = 0;

export class CellEditorManager {
  /** @type {null | (() => void)} */
  #commitOverlay = null;
  #tabNodeId = null;
  #canvasAriaLabel = 'Tree table';

  constructor({ controller, host = null }) {
    if (!controller) throw new TypeError('CellEditorManager requires a TreeViewController');
    if (!controller.canvas)
      throw new Error('CellEditorManager requires an initialized TreeViewController canvas');
    this.controller = controller;
    this.canvas = controller.canvas;
    this.#canvasAriaLabel = this.canvas.getAttribute('aria-label') ?? 'Tree table';
    this.view = this.canvas.ownerDocument.defaultView;
    this.host = host ?? controller.canvas.parentElement ?? document.body;
    this.editable = true;
    /** @type {HTMLInputElement | HTMLDivElement | null} */
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
    this.onCanvasBlur = () => {
      if (this.overlay) return;
      this.#tabNodeId = null;
      this.canvas.setAttribute('aria-label', this.#canvasAriaLabel);
    };
    this.canvas.addEventListener('blur', this.onCanvasBlur);
    this.onOutsidePointerDown = (event) => {
      if (!this.overlay || this.overlayKind !== 'value') return;
      const path = event.composedPath?.();
      if (path ? path.includes(this.overlay) : this.overlay.contains(event.target)) return;
      if (this.overlayNode?.data?.editorType === 'range' && path?.includes(this.canvas)) {
        const rect = this.canvas.getBoundingClientRect();
        const hit = this.controller.hitTest(event.clientX - rect.left, event.clientY - rect.top);
        if (hit?.row?.nodeId === this.overlayNode.id && hit.part === 'range') return;
      }
      if (this.overlay.classList.contains('vtc-editor-select')) this.#removeOverlay();
      else this.#commitOverlay?.();
    };
  }

  setEditable(enabled) {
    this.editable = enabled;
    if (!enabled) this.close();
  }

  destroy() {
    this.stopFilter();
    this.stopTheme();
    this.#removeOverlay();
    this.canvas.removeEventListener('blur', this.onCanvasBlur);
    this.view.removeEventListener('mousemove', this.onMouseMove);
    this.view.removeEventListener('mouseup', this.onMouseUp);
  }

  close() {
    this.#removeOverlay();
    this.rangeDrag = null;
    this.view.removeEventListener('mousemove', this.onMouseMove);
    this.view.removeEventListener('mouseup', this.onMouseUp);
  }

  commitPending() {
    this.#commitOverlay?.();
    this.close();
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
    if (shouldOpenOverlayOnPointerDown(data, hit)) {
      const node = this.controller.model.nodes[hit.row.nodeIndex];
      this.#showOverlay(node, hit);
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
      this.#focusCheckbox(node.id);
      return true;
    }
    if (data.editorType === 'range') {
      if (hit.part === 'range') return true;
      if (hit.part !== 'number') {
        this.#toggleRangeMinMax(node, data);
        return true;
      }
    }
    if (this.overlay) {
      if (this.overlayNode?.id === node.id) return true;
      if (!this.overlay.classList.contains('vtc-editor-select')) return true;
    }
    this.#showOverlay(node, hit);
    return true;
  }

  handleHeaderClick(_event, hit) {
    if (hit?.area !== 'header' || hit.part !== 'filter') return false;
    this.#showHeaderFilterOverlay(hit);
    return true;
  }

  handleCanvasKey(event) {
    if (!this.editable || !this.controller.inspector) return false;
    if (event.key === 'Tab')
      return this.#moveByTab(this.#tabNodeId ?? this.controller.focusedId,
        event.shiftKey ? -1 : 1);
    if ((event.key === ' ' || event.key === 'Enter') && this.#tabNodeId === this.controller.focusedId) {
      const node = this.controller.model.index.getNode(this.#tabNodeId);
      if (node?.data?.editorType !== 'checkbox' || node.data.readonly || node.data.disabled)
        return false;
      this.controller.updateInspectorValue(node.id, !node.data.value, 'checkbox');
      this.#focusCheckbox(node.id);
      return true;
    }
    return false;
  }

  #moveByTab(currentId, direction) {
    const rows = this.controller.rowModel.rows;
    const currentIndex = rows.findIndex((row) => row.nodeId === currentId);
    const start = currentIndex < 0 ? (direction > 0 ? -1 : rows.length) : currentIndex;
    let targetId = null;
    for (let i = start + direction; i >= 0 && i < rows.length; i += direction) {
      const data = this.controller.model.nodes[rows[i].nodeIndex]?.data;
      if (!data?.inspector || data.readonly || data.disabled ||
          !['text', 'number', 'range', 'select', 'checkbox', 'color'].includes(data.editorType))
        continue;
      targetId = rows[i].nodeId;
      break;
    }
    if (!targetId) return false;
    this.#commitOverlay?.();
    this.#removeOverlay();
    const target = this.controller.model.index.getNode(targetId);
    if (target?.data?.editorType === 'checkbox') return this.#focusCheckbox(targetId);
    if (!this.controller.focusNode(targetId, { select: false })) return false;
    const row = this.controller.rowModel.getRowById(targetId);
    const node = this.controller.model.index.getNode(targetId);
    const column = this.controller.columnModel.columns.find((item) =>
      item.kind === (this.controller.inspector.presentation === 'pane'
        ? 'inspectorPane' : 'inspectorValue'));
    if (!row || !node || !column) return false;
    this.#showOverlay(node, {
      area: 'row',
      part: node.data.editorType === 'range' ? 'number' : 'editor',
      row,
      column
    });
    return true;
  }

  #focusCheckbox(nodeId) {
    const node = this.controller.model.index.getNode(nodeId);
    if (!node || node.data?.editorType !== 'checkbox') return false;
    this.#removeOverlay();
    if (!this.controller.focusNode(nodeId, { select: false })) return false;
    this.#tabNodeId = nodeId;
    this.canvas.setAttribute('aria-label',
      `${node.label}, checkbox, ${node.data.value ? 'checked' : 'unchecked'}`);
    this.canvas.focus({ preventScroll: true });
    return true;
  }

  #showOverlay(node, hit) {
    this.#commitOverlay?.();
    this.#removeOverlay();
    this.#tabNodeId = null;
    this.canvas.setAttribute('aria-label', this.#canvasAriaLabel);
    const data = node.data;
    const rect = this.#clampRectToHost(this.#overlayRect(hit), 4);
    const hostRect = this.host.getBoundingClientRect();
    if (data.editorType === 'select') {
      this.#showSelectOverlay(node, rect, hostRect);
      return;
    }
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
      padding: data.editorType === 'color' ? '0 2px' : '0 8px',
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
      else if (event.key === 'Tab' && this.#moveByTab(node.id, event.shiftKey ? -1 : 1))
        event.preventDefault();
    });
    if (data.editorType === 'color') {
      element.addEventListener('input', () => {
        this.controller.updateInspectorValue(node.id, element.value, data.editorType);
      });
    }
    element.addEventListener('blur', commit);
    ensureOverlayHost(this.host);
    this.host.append(element);
    this.overlay = element;
    this.overlayKind = 'value';
    this.overlayNode = node;
    this.#commitOverlay = commit;
    if (data.editorType !== 'color')
      this.canvas.ownerDocument.addEventListener('pointerdown', this.onOutsidePointerDown, true);
    element.focus({
      preventScroll: true
    });
    element.select?.();
  }

  #showSelectOverlay(node, rect, hostRect) {
    const doc = this.canvas.ownerDocument;
    const entries = Object.entries(node.data.meta?.options ?? {});
    const selected = entries.findIndex(([, value]) => value === node.data.value);
    const selectedIndex = selected >= 0 ? selected : entries.findIndex(([, value]) =>
      String(value) === String(node.data.value));
    const control = doc.createElement('div');
    control.className = 'vtc-editor vtc-editor-select';
    control.tabIndex = 0;
    control.setAttribute('role', 'combobox');
    control.setAttribute('aria-label', node.label);
    control.setAttribute('aria-haspopup', 'listbox');
    control.setAttribute('aria-expanded', 'true');
    Object.assign(control.style, {
      position: 'absolute',
      left: `${rect.x - hostRect.left}px`,
      top: `${rect.y - hostRect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      minWidth: '0',
      boxSizing: 'border-box',
      borderRadius: '5px',
      padding: '0 22px 0 8px',
      display: 'flex',
      alignItems: 'center',
      zIndex: 20,
      cursor: 'pointer',
      userSelect: 'none',
      outline: 'none'
    });
    const label = doc.createElement('span');
    label.textContent = entries[selectedIndex]?.[0] ?? 'Select…';
    Object.assign(label.style, {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      pointerEvents: 'none'
    });
    control.append(label);

    const menu = doc.createElement('div');
    menu.className = 'vtc-editor-menu';
    const menuWidth = rect.width;
    Object.assign(menu.style, {
      position: 'absolute',
      left: '-1px',
      width: `${menuWidth}px`,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: '7px',
      zIndex: 21
    });
    const list = doc.createElement('div');
    const listId = `vtc-select-${++selectMenuId}`;
    list.id = listId;
    list.setAttribute('role', 'listbox');
    Object.assign(list.style, { minHeight: '0', overflowY: 'auto', overscrollBehavior: 'contain' });
    control.setAttribute('aria-controls', listId);
    let search = null;
    if (entries.length > 8) {
      control.tabIndex = -1;
      search = doc.createElement('input');
      search.type = 'search';
      search.placeholder = 'Filter options';
      search.setAttribute('aria-label', `Filter ${node.label} options`);
      Object.assign(search.style, {
        flex: '0 0 32px',
        width: '100%',
        minWidth: '0',
        boxSizing: 'border-box',
        border: '0',
        borderBottom: '1px solid',
        outline: 'none',
        padding: '0 9px',
        font: editorFont(node.data)
      });
      menu.append(search);
    }
    menu.append(list);
    control.append(menu);

    let matches = [];
    let active = -1;
    const updateActive = (scroll = false) => {
      for (let i = 0; i < list.children.length; i++) {
        const option = list.children[i];
        option.dataset.active = i === active ? 'true' : 'false';
      }
      const current = list.children[active];
      if (current) {
        control.setAttribute('aria-activedescendant', current.id);
        search?.setAttribute('aria-activedescendant', current.id);
        if (scroll) {
          const itemRect = current.getBoundingClientRect();
          const listRect = list.getBoundingClientRect();
          if (itemRect.top < listRect.top) list.scrollTop += itemRect.top - listRect.top;
          else if (itemRect.bottom > listRect.bottom)
            list.scrollTop += itemRect.bottom - listRect.bottom;
        }
      } else {
        control.removeAttribute('aria-activedescendant');
        search?.removeAttribute('aria-activedescendant');
      }
      applySelectMenuTheme(control, this.controller.themeManager.get());
    };
    const commit = (index) => {
      if (this.overlay !== control || !matches[index]) return;
      this.controller.updateInspectorValue(node.id, matches[index].value, 'select');
      this.#removeOverlay();
    };
    const render = (query = '') => {
      const needle = normalizeOptionSearch(query.trim());
      matches = entries.map(([text, value], index) => ({ text, value, index }))
        .filter(({ text, value }) =>
          normalizeOptionSearch(`${text} ${value ?? ''}`).includes(needle));
      const desiredHeight = Math.min(248,
        2 + (search ? 32 : 0) + Math.max(1, matches.length) * 28);
      const below = hostRect.bottom - rect.y - rect.height;
      const above = rect.y - hostRect.top;
      const openAbove = below < desiredHeight + 4 && above > below;
      const available = openAbove ? above : below;
      const menuHeight = Math.min(desiredHeight, Math.max(32, available - 8));
      menu.style.maxHeight = `${menuHeight}px`;
      menu.style.top = openAbove ? '' : 'calc(100% + 4px)';
      menu.style.bottom = openAbove ? 'calc(100% + 4px)' : '';
      active = Math.max(0, matches.findIndex(({ index }) => index === selectedIndex));
      list.replaceChildren();
      if (!matches.length) {
        active = -1;
        const empty = doc.createElement('div');
        empty.textContent = 'No matches';
        empty.className = 'vtc-editor-empty';
        empty.style.padding = '8px 10px';
        list.append(empty);
      }
      for (let i = 0; i < matches.length; i++) {
        const entry = matches[i];
        const option = doc.createElement('div');
        option.id = `${listId}-option-${entry.index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', entry.index === selectedIndex ? 'true' : 'false');
        option.dataset.value = String(entry.value);
        option.textContent = entry.text;
        option.title = entry.text;
        Object.assign(option.style, {
          minHeight: '28px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          padding: '4px 10px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer'
        });
        option.addEventListener('pointerenter', () => { active = i; updateActive(); });
        option.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          commit(i);
        });
        option.addEventListener('click', () => commit(i));
        list.append(option);
      }
      updateActive(true);
    };
    search?.addEventListener('input', () => render(search.value));
    control.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.#removeOverlay();
        this.canvas.focus({ preventScroll: true });
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (matches.length) {
          active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
          updateActive(true);
        }
      } else if (event.key === 'Home' || event.key === 'End') {
        if (event.target === search) return;
        event.preventDefault();
        active = event.key === 'Home' ? 0 : matches.length - 1;
        updateActive(true);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        commit(active);
      } else if (event.key === 'Tab') {
        if (this.#moveByTab(node.id, event.shiftKey ? -1 : 1)) event.preventDefault();
      }
    });
    control.addEventListener('pointerdown', (event) => {
      if (menu.contains(event.target)) return;
      this.#removeOverlay();
    });
    control.addEventListener('focusout', (event) => {
      if (!control.contains(event.relatedTarget)) this.#removeOverlay();
    });
    ensureOverlayHost(this.host);
    this.host.append(control);
    this.overlay = control;
    this.overlayKind = 'value';
    this.overlayNode = node;
    this.canvas.ownerDocument.addEventListener('pointerdown', this.onOutsidePointerDown, true);
    render();
    applyEditorTheme(control, this.controller.themeManager.get());
    (search ?? control).focus({ preventScroll: true });
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
    this.canvas.ownerDocument.removeEventListener('pointerdown', this.onOutsidePointerDown, true);
    this.overlay = null;
    this.overlayKind = null;
    this.overlayNode = null;
    this.#commitOverlay = null;
    overlay?.remove();
  }

  #syncOverlayTheme() {
    if (this.overlay) applyEditorTheme(this.overlay, this.controller.themeManager.get());
    if (this.overlay?.classList.contains('vtc-editor-select'))
      applySelectMenuTheme(this.overlay, this.controller.themeManager.get());
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
  const isSelect = element.classList.contains('vtc-editor-select');
  Object.assign(element.style, {
    border: `1px solid ${colors.focus}`,
    backgroundColor: isSelect ? colors.progressTrack : (colors.control ?? colors.background),
    color: isSelect ? (theme.valueColors?.enum ?? colors.text) : colors.text,
    caretColor: colors.focus,
    font: element.classList.contains('vtc-editor-number') || element.classList.contains('vtc-editor-range')
      ? (theme.monoFont ?? MONO_FONT)
      : (theme.font ?? SANS_FONT),
    boxShadow: isSelect ? 'none'
      : `0 0 0 1px ${colors.borderStrong ?? colors.border}, 0 8px 20px ${colors.shadow ?? 'transparent'}`
  });
  if (isSelect) {
    const chevron = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 5"><path d="M0 0h8L4 5z" fill="${colors.chevron}"/></svg>`;
    Object.assign(element.style, {
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(chevron)}")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 13px center',
      backgroundSize: '8px 5px'
    });
  }
}

function applySelectMenuTheme(control, theme) {
  const colors = theme.colors;
  const menu = control.querySelector('.vtc-editor-menu');
  const search = menu?.querySelector('input');
  if (!menu) return;
  Object.assign(menu.style, {
    backgroundColor: colors.control ?? colors.background,
    color: colors.text,
    border: `1px solid ${colors.borderStrong ?? colors.border}`,
    boxShadow: `0 12px 32px ${colors.shadow ?? 'transparent'}`
  });
  if (search) Object.assign(search.style, {
    backgroundColor: colors.control ?? colors.background,
    color: colors.text,
    borderBottomColor: colors.border
  });
  for (const option of menu.querySelectorAll('[role="option"]')) {
    const active = option.dataset.active === 'true';
    const selected = option.getAttribute('aria-selected') === 'true';
    option.style.backgroundColor = active
      ? colors.controlActive : selected ? colors.controlHover : 'transparent';
    option.style.color = active ? colors.textStrong : colors.text;
  }
  const empty = menu.querySelector('.vtc-editor-empty');
  if (empty) empty.style.color = colors.textMuted;
}

function createEditorElement(data) {
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
  return element.value;
}

const SANS_FONT = '12px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO_FONT =
  '12px "JetBrains Mono", "Cascadia Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, monospace';

function editorFont(data) {
  return data.editorType === 'number' || data.editorType === 'range' ? MONO_FONT : SANS_FONT;
}

function normalizeOptionSearch(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}
