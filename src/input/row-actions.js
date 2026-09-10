import { drawCheckbox } from '../renderers/checkbox.js';
/** Accessible buttons for visible rows. Actions and their meaning belong to the host. */
export class RowActions {
  constructor(controller) {
    this.controller = controller;
    this.buttons = new Map();
    this.preparedIcons = new Set();
    this.element = controller.canvas.ownerDocument.createElement('div');
    Object.assign(this.element.style, { position: 'absolute', overflow: 'hidden', pointerEvents: 'none', zIndex: '2' });
    const style = controller.canvas.ownerDocument.createElement('style');
    style.textContent = `
      .vtc-row-action { appearance:none; display:flex; align-items:center; justify-content:center;
        background:transparent; color:inherit; outline:none; }
      .vtc-row-action:hover:not(:disabled) canvas { filter:brightness(1.45) drop-shadow(0 0 2px var(--vtc-action-focus)); }
      .vtc-row-action:focus-visible { outline:1px solid var(--vtc-action-focus); outline-offset:-2px; }
    `;
    this.element.append(style);
    controller.canvas.parentElement?.append(this.element);
    this.element.addEventListener('pointerdown', event => event.stopPropagation());
  }

  render(scene) {
    const { viewport, theme, rows, visibleRange, stickyRows } = scene;
    const ratio = Math.max(1, this.element.ownerDocument.defaultView.devicePixelRatio || 1);
    for (const action of this.controller.rowActions) {
      const icons = action.preloadIcons ?? (typeof action.icon === 'string' ? [action.icon] : []);
      for (const icon of icons) for (const color of [theme.colors.text, theme.colors.textMuted]) {
        const key = JSON.stringify([icon, color, ratio]);
        if (this.preparedIcons.has(key)) continue;
        this.preparedIcons.add(key);
        void this.controller.iconRegistry.prepare({icons:[icon],size:16,color,pixelRatio:ratio});
      }
    }
    const column = scene.columns.find(c => c.id === '__vtc_actions');
    const used = new Set();
    const width = column?.width ?? 0;
    this.element.style.setProperty('--vtc-action-focus', theme.colors.focus);
    Object.assign(this.element.style, { background:'transparent', left: `${viewport.renderInsetX + Math.max(0, viewport.contentViewportWidth - width)}px`, top: `${viewport.renderInsetY + viewport.headerHeight}px`,
      width: `${width}px`, height: `${viewport.rowViewportHeight}px` });
    if (column) {
      const visible = new Map();
      const stickyBottom = stickyRows.reduce((end, row) => Math.max(end, row.stickyY + row.height), 0);
      for (let i = visibleRange.first; i <= visibleRange.last; i++) {
        const row = rows[i];
        if (row && row.y + row.height - viewport.scrollY > stickyBottom) visible.set(row.nodeId, {row, y:row.y - viewport.scrollY});
      }
      for (const row of stickyRows) visible.set(row.nodeId, {row, y:row.stickyY, sticky:true});
      for (const {row, y, sticky} of visible.values()) {
        if (y + row.height <= 0 || y >= viewport.rowViewportHeight) continue;
        const node = this.controller.model.index.getNode(row.nodeId);
        const state = this.controller.model.dynamicState.get(node.id) ?? {};
        this.controller.rowActions.forEach((action, index) => {
          const resolve = value => typeof value === 'function' ? value(node, state) : value;
          if (resolve(action.visible) === false) return;
          const key = JSON.stringify([node.id, action.id, action.kind]);
          used.add(key);
          let button = this.buttons.get(key);
          if (!button) {
            button = this.element.ownerDocument.createElement('button');
            button.type = 'button';
            if (action.kind === 'checkbox') button.setAttribute('role','checkbox');
            button.className = 'vtc-row-action';
            button.dataset.nodeId = node.id;
            button.dataset.action = action.id;
            Object.assign(button.style, { position:'absolute', pointerEvents:'auto', width:'26px', padding:'3px', border:'0', borderRadius:'3px', cursor:'pointer' });
            const icon = this.element.ownerDocument.createElement('canvas');
            Object.assign(icon.style, {width:'16px',height:'16px',display:'block'});
            button.append(icon);
            button.onclick = event => {
              event.stopPropagation();
              const current = this.controller.model.index.getNode(button.dataset.nodeId);
              const spec = this.controller.rowActions.find(item => item.id === button.dataset.action);
              const currentState = this.controller.model.dynamicState.get(current?.id) ?? {};
              if (!current || !spec || (typeof spec.disabled === 'function' ? spec.disabled(current, currentState) : spec.disabled)) return;
              this.controller.events.emit('rowaction', { actionId: spec.id, nodeId: current.id, node: current, ...(spec.kind === 'checkbox' ? {checked:!(typeof spec.checked === 'function' ? spec.checked(current,currentState) : spec.checked)} : {}), originalEvent: event });
            };
            this.buttons.set(key, button);
            this.element.append(button);
          }
          button.title = action.label;
          button.setAttribute('aria-label', `${action.label}: ${node.label ?? node.id}`);
          if (action.pressed !== undefined) button.setAttribute('aria-pressed', String(Boolean(resolve(action.pressed))));
          else button.removeAttribute('aria-pressed');
          button.disabled = Boolean(resolve(action.disabled));
          Object.assign(button.style, { left:`${index * 28 + 1}px`, top:`${y + 1}px`, height:`${row.height - 2}px`,
            clipPath:sticky ? 'none' : `inset(${Math.max(0, stickyBottom - y - 1)}px 0 0)`, opacity:button.disabled ? '0.3':'1' });
          const canvas = button.firstChild;
          const ratio = Math.max(1, this.element.ownerDocument.defaultView.devicePixelRatio || 1);
          const size = action.kind === 'checkbox' ? 18 : 16;
          canvas.style.width = canvas.style.height = `${size}px`;
          const pixels = Math.round(size * ratio);
          if (canvas.width !== pixels || canvas.height !== pixels) canvas.width = canvas.height = pixels;
          const ctx = canvas.getContext('2d');
          ctx.setTransform(pixels / size, 0, 0, pixels / size, 0, 0);
          ctx.clearRect(0,0,size,size);
          if (action.kind === 'checkbox') {
            const checked = Boolean(resolve(action.checked));
            button.setAttribute('aria-checked', String(checked));
            drawCheckbox(ctx,1,1,checked,theme);
            return;
          }
          this.controller.iconRegistry.draw(ctx, resolve(action.icon) ?? 'star', 0,0,16,resolve(action.pressed) ? theme.colors.text : theme.colors.textMuted);
        });
      }
    }
    let refocus = false;
    for (const [key, button] of this.buttons) if (!used.has(key)) {
      refocus ||= this.element.getRootNode().activeElement === button;
      button.remove(); this.buttons.delete(key);
    }
    if (refocus) (this.buttons.values().next().value ?? this.controller.canvas).focus({preventScroll:true});
  }

  destroy() { this.element.remove(); this.buttons.clear(); }
}
