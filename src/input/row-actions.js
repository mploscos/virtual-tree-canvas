import { drawCheckbox } from '../renderers/checkbox.js';

/** Accessible buttons for visible rows. Actions and their meaning belong to the host. */
export class RowActions {
  constructor(controller) {
    this.controller = controller;
    this.buttons = new Map();
    this.buttonsByNodeId = new Map();
    this.actionsById = new Map();
    this.visibleRowsById = new Map();
    this.preparedIcons = new Set();
    this.fullUpdates = 0;
    this.incrementalUpdates = 0;
    this.themeToken = 0;
    this.theme = null;
    this.element = controller.canvas.ownerDocument.createElement('div');
    Object.assign(this.element.style, {
      position: 'absolute', overflow: 'hidden', pointerEvents: 'none', zIndex: '2'
    });
    const style = controller.canvas.ownerDocument.createElement('style');
    style.textContent = `
      .vtc-row-action { appearance:none; display:flex; align-items:center; justify-content:center;
        background:transparent; color:inherit; outline:none; }
      .vtc-row-action:hover:not(:disabled) canvas { filter:brightness(1.45) drop-shadow(0 0 2px var(--vtc-action-focus)); }
      .vtc-row-action:focus-visible { outline:1px solid var(--vtc-action-focus); outline-offset:-2px; }
    `;
    this.element.append(style);
    controller.canvas.parentElement?.append(this.element);
    this.element.addEventListener('pointerdown', (event) => event.stopPropagation());
  }

  /** @param {object} scene @param {{full?: boolean, dirtyNodeIds?: Set<string>}} invalidation */
  render(scene, invalidation = { full: true }) {
    if (!invalidation.full && invalidation.dirtyNodeIds?.size) {
      this.incrementalUpdates++;
      for (const id of invalidation.dirtyNodeIds) this.#syncDynamicRow(id, scene);
      return;
    }
    this.fullUpdates++;
    this.#syncAll(scene);
  }

  #syncAll(scene) {
    const { viewport, theme, rows, visibleRange, stickyRows } = scene;
    if (this.theme !== theme) {
      this.theme = theme;
      this.themeToken++;
    }
    this.actionsById.clear();
    for (const action of this.controller.rowActions) this.actionsById.set(action.id, action);
    const ratio = Math.max(1, this.element.ownerDocument.defaultView.devicePixelRatio || 1);
    this.#prepareIcons(theme, ratio);
    const column = scene.columns.find((column) => column.id === '__vtc_actions');
    const width = column?.width ?? 0;
    setStyle(this.element, '--vtc-action-focus', theme.colors.focus);
    setStyle(this.element, 'background', 'transparent');
    setStyle(this.element, 'left', `${viewport.renderInsetX + Math.max(0, viewport.contentViewportWidth - width)}px`);
    setStyle(this.element, 'top', `${viewport.renderInsetY + viewport.headerHeight}px`);
    setStyle(this.element, 'width', `${width}px`);
    setStyle(this.element, 'height', `${viewport.rowViewportHeight}px`);

    const used = new Set();
    this.visibleRowsById.clear();
    if (column) {
      const stickyBottom = stickyRows.reduce(
        (end, row) => Math.max(end, row.stickyY + row.height), 0
      );
      for (let i = visibleRange.first; i <= visibleRange.last; i++) {
        const row = rows[i];
        if (!row || row.y + row.height - viewport.scrollY <= stickyBottom) continue;
        this.#rememberVisibleRow(row, row.y - viewport.scrollY, false, stickyBottom, viewport);
      }
      for (const row of stickyRows) {
        this.#rememberVisibleRow(row, row.stickyY, true, stickyBottom, viewport);
      }
      for (const info of this.visibleRowsById.values()) this.#syncRow(info, scene, used, ratio);
    }
    for (const [key, button] of this.buttons) {
      if (!used.has(button)) this.#removeButton(key, button, true);
    }
  }

  #rememberVisibleRow(row, y, sticky, stickyBottom, viewport) {
    if (y + row.height <= 0 || y >= viewport.rowViewportHeight) return;
    this.visibleRowsById.set(row.nodeId, { row, y, sticky, stickyBottom });
  }

  #syncDynamicRow(id, scene) {
    const info = this.visibleRowsById.get(id);
    if (!info) return;
    const ratio = Math.max(1, this.element.ownerDocument.defaultView.devicePixelRatio || 1);
    this.#syncRow(info, scene, null, ratio);
  }

  #syncRow(info, scene, used, ratio) {
    const { row, y, sticky, stickyBottom } = info;
    const node = this.controller.model.index.getNode(row.nodeId);
    if (!node) return;
    const state = this.controller.model.dynamicState.get(node.id) ?? {};
    this.controller.rowActions.forEach((action, index) => {
      const visible = resolve(action.visible, node, state) !== false;
      const key = actionKey(node.id, action.id);
      let button = this.buttons.get(key);
      if (!visible) {
        if (button) this.#removeButton(key, button, false);
        return;
      }
      if (button?._vtcKind !== action.kind) {
        this.#removeButton(key, button, false);
        button = null;
      }
      if (!button) button = this.#createButton(key, node, action);
      used?.add(button);
      this.#syncButton(button, node, state, action, index, row, y, sticky, stickyBottom, scene, ratio);
    });
  }

  #createButton(key, node, action) {
    const button = this.element.ownerDocument.createElement('button');
    button.type = 'button';
    button._vtcKind = action.kind;
    if (action.kind === 'checkbox') button.setAttribute('role', 'checkbox');
    button.className = 'vtc-row-action';
    button.dataset.nodeId = node.id;
    button.dataset.action = action.id;
    Object.assign(button.style, {
      position: 'absolute', pointerEvents: 'auto', width: '26px', padding: '3px',
      border: '0', borderRadius: '3px', cursor: 'pointer'
    });
    const icon = this.element.ownerDocument.createElement('canvas');
    Object.assign(icon.style, { width: '16px', height: '16px', display: 'block' });
    button.append(icon);
    button.onclick = (event) => this.#activate(button, event);
    this.buttons.set(key, button);
    let nodeButtons = this.buttonsByNodeId.get(node.id);
    if (!nodeButtons) this.buttonsByNodeId.set(node.id, (nodeButtons = new Map()));
    nodeButtons.set(action.id, button);
    this.element.append(button);
    return button;
  }

  #syncButton(button, node, state, action, index, row, y, sticky, stickyBottom, scene, ratio) {
    setProperty(button, 'title', action.label);
    setAttribute(button, 'aria-label', `${action.label}: ${node.label ?? node.id}`);
    const pressed = action.pressed === undefined ? null : Boolean(resolve(action.pressed, node, state));
    setAttribute(button, 'aria-pressed', pressed === null ? null : String(pressed));
    const disabled = Boolean(resolve(action.disabled, node, state));
    setProperty(button, 'disabled', disabled);
    setStyle(button, 'left', `${index * 28 + 1}px`);
    setStyle(button, 'top', `${y + 1}px`);
    setStyle(button, 'height', `${row.height - 2}px`);
    setStyle(button, 'clipPath', sticky ? 'none' : `inset(${Math.max(0, stickyBottom - y - 1)}px 0 0)`);
    setStyle(button, 'opacity', disabled ? '0.3' : '1');

    const canvas = button.firstChild;
    const size = action.kind === 'checkbox' ? 18 : 16;
    const pixels = Math.round(size * ratio);
    setStyle(canvas, 'width', `${size}px`);
    setStyle(canvas, 'height', `${size}px`);
    const checked = action.kind === 'checkbox' && Boolean(resolve(action.checked, node, state));
    if (action.kind === 'checkbox') setAttribute(button, 'aria-checked', String(checked));
    const icon = action.kind === 'checkbox' ? '' : resolve(action.icon, node, state) ?? 'star';
    const color = pressed ? scene.theme.colors.text : scene.theme.colors.textMuted;
    const drawKey = `${this.themeToken}\0${action.kind ?? ''}\0${icon}\0${color}\0${checked}\0${pixels}`;
    if (canvas._vtcDrawKey === drawKey) return;
    canvas._vtcDrawKey = drawKey;
    if (canvas.width !== pixels) canvas.width = pixels;
    if (canvas.height !== pixels) canvas.height = pixels;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(pixels / size, 0, 0, pixels / size, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (action.kind === 'checkbox') drawCheckbox(ctx, 1, 1, checked, scene.theme);
    else this.controller.iconRegistry.draw(ctx, icon, 0, 0, 16, color);
  }

  #activate(button, event) {
    event.stopPropagation();
    this.controller.flushDynamicState();
    const current = this.controller.model.index.getNode(button.dataset.nodeId);
    const spec = this.actionsById.get(button.dataset.action);
    const state = this.controller.model.dynamicState.get(current?.id) ?? {};
    if (!current || !spec || resolve(spec.disabled, current, state)) return;
    this.controller.events.emit('rowaction', {
      actionId: spec.id, nodeId: current.id, node: current,
      ...(spec.kind === 'checkbox'
        ? { checked: !Boolean(resolve(spec.checked, current, state)) }
        : {}),
      originalEvent: event
    });
  }

  #prepareIcons(theme, ratio) {
    for (const action of this.controller.rowActions) {
      const icons = action.preloadIcons ?? (typeof action.icon === 'string' ? [action.icon] : []);
      for (const icon of icons) for (const color of [theme.colors.text, theme.colors.textMuted]) {
        const key = `${icon}\0${color}\0${ratio}`;
        if (this.preparedIcons.has(key)) continue;
        this.preparedIcons.add(key);
        void this.controller.iconRegistry.prepare({ icons: [icon], size: 16, color, pixelRatio: ratio });
      }
    }
  }

  #removeButton(key, button, preserveFocus) {
    if (!button) return;
    const focused = this.element.getRootNode().activeElement === button;
    button.remove();
    this.buttons.delete(key);
    const nodeButtons = this.buttonsByNodeId.get(button.dataset.nodeId);
    nodeButtons?.delete(button.dataset.action);
    if (!nodeButtons?.size) this.buttonsByNodeId.delete(button.dataset.nodeId);
    if (focused && preserveFocus) {
      (this.buttons.values().next().value ?? this.controller.canvas).focus({ preventScroll: true });
    } else if (focused) this.controller.canvas.focus({ preventScroll: true });
  }

  destroy() {
    this.element.remove();
    this.buttons.clear();
    this.buttonsByNodeId.clear();
    this.actionsById.clear();
    this.visibleRowsById.clear();
  }
}

function resolve(value, node, state) {
  return typeof value === 'function' ? value(node, state) : value;
}

function actionKey(nodeId, actionId) {
  return `${nodeId.length}:${nodeId}${actionId}`;
}

function setProperty(target, name, value) {
  if (!Object.is(target[name], value)) target[name] = value;
}

function setAttribute(target, name, value) {
  if (value === null) {
    if (target.hasAttribute(name)) target.removeAttribute(name);
  } else if (target.getAttribute(name) !== value) target.setAttribute(name, value);
}

function setStyle(target, name, value) {
  if (name.startsWith('--')) {
    if (target.style.getPropertyValue(name) !== value) target.style.setProperty(name, value);
  } else if (target.style[name] !== value) target.style[name] = value;
}
