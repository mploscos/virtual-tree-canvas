const wait = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const same = (actual, expected, message) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
};

/**
 * The same user-visible contract runs against TreeView and the DEP adapter.
 */
export async function runViewContract(create) {
  const results = [];
  async function check(name, action) {
    const a = await create();
    try {
      await action(a);
      results.push({
        name,
        passed: true
      });
    } catch (error) {
      results.push({
        name,
        passed: false,
        error: error.stack
      });
    } finally {
      await a.destroy();
    }
  }

  await check('array buttons never toggle expansion on a double click', async (a) => {
    const model = { tags: ['radar'] };
    a.configure({ mode: 'inspector', presentation: 'pane', model, meta: { tags: { itemType: 'string' } }, editable: true });
    await wait();
    const c = a.widget.controller;
    const canvas = c.canvas;
    const rect = canvas.getBoundingClientRect();
    const point = (part) => {
      const row = c.rowModel.getRowById('model:tags');
      const y = c.viewport.renderInsetY + c.viewport.headerHeight + row.y - c.viewport.scrollY + row.height / 2;
      for (let x = 0; x < c.viewport.contentViewportWidth; x++) {
        const hit = c.hitTest(x, y);
        if (hit?.row?.nodeId === row.nodeId && hit.part === part)
          return { clientX: rect.left + x, clientY: rect.top + y };
      }
      throw new Error(`Missing ${part} control`);
    };
    const doubleClickButton = (part) => {
      const p = point(part);
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, ...p }));
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2, ...p }));
      canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2, ...p }));
    };
    same(c.rowModel.getRowById('model:tags').expanded, true, 'initially expanded');
    doubleClickButton('arrayAdd');
    same(model.tags.length, 3, 'two items added');
    same(c.rowModel.getRowById('model:tags').expanded, true, 'add keeps expansion');
    c.collapse('model:tags');
    doubleClickButton('arrayRemove');
    same(model.tags.length, 1, 'two items removed');
    same(c.rowModel.getRowById('model:tags').expanded, false, 'remove keeps collapsed state');
  });

  for (const presentation of ['pane', 'table'])
    await check(`select editor keeps canvas control geometry (${presentation})`, async (a) => {
      a.configure({ mode: 'inspector', presentation, flatRoot: true, editable: true });
      a.widget.setModel({ mode: 'track' }, { mode: { options: { Track: 'track', Search: 'search' } } });
      await wait();
      const c = a.widget.controller;
      const row = c.rowModel.getRowById('model:mode');
      const column = c.columnModel.columns.find((item) => item.kind === (presentation === 'pane' ? 'inspectorPane' : 'inspectorValue'));
      const hit = { area: 'row', part: 'editor', row, column };
      const cell = c.getCellClientRect(hit);
      const layout = presentation === 'pane' ? c.getInspectorPaneLayout(cell.width, row, 'select') : null;
      const expectedX = cell.x + (layout?.editorLeft ?? 0) + 10;
      const expectedWidth = Math.min(180, Math.max(24, (layout?.editorWidth ?? cell.width) - 20));
      same(c.cellEditor.handlePointerDown({}, hit), false, 'select waits for click completion');
      same(c.cellEditor.handleClick({}, hit), true, 'select opens');
      const select = c.cellEditor.overlay;
      const actual = select.getBoundingClientRect();
      same(select.tagName, 'SELECT', 'native select');
      same(Math.abs(actual.left - expectedX) < 1, true, 'left edge matches canvas');
      same(Math.abs(actual.top - (cell.y + 5)) < 1, true, 'top edge matches canvas');
      same(Math.abs(actual.width - expectedWidth) < 1, true, 'width matches canvas');
      same(Math.abs(actual.height - (cell.height - 10)) < 1, true, 'height matches canvas');
      same(getComputedStyle(select).backgroundImage === 'none', false, 'dropdown indicator remains visible');
      const darkArrow = select.style.backgroundImage;
      a.widget.setTheme('light');
      same(select.style.backgroundImage === darkArrow, false, 'dropdown indicator follows theme');
      c.closeEditor();
    });

  await check('inspector select opens on the first click across the whole control', async (a) => {
    a.configure({ mode: 'inspector', presentation: 'pane', flatRoot: true, editable: true });
    a.widget.setModel({ mode: 'track' }, { mode: { options: { Track: 'track', Search: 'search' } } });
    await wait();
    const c = a.widget.controller;
    const row = c.rowModel.getRowById('model:mode');
    const column = c.columnModel.columns.find((item) => item.kind === 'inspectorPane');
    const cell = c.getCellClientRect({ area: 'row', part: 'editor', row, column });
    const layout = c.getInspectorPaneLayout(cell.width, row, 'select');
    const x = cell.x + layout.editorLeft + 10;
    const width = Math.min(180, Math.max(24, layout.editorWidth - 20));
    for (const offset of [10, width - 10]) {
      const point = { x: x + offset, y: cell.y + cell.height / 2, button: 'left', clickCount: 1 };
      await window.testMouse({ type: 'mousePressed', ...point });
      same(c.cellEditor.overlay, null, 'picker is not inserted before mouseup');
      await window.testMouse({ type: 'mouseReleased', ...point });
      const select = c.cellEditor.overlay;
      same(select?.tagName, 'SELECT', 'first click creates select');
      same(select.matches(':open'), true, 'picker remains open');
      c.closeEditor();
    }
  });

  await check('inspector pane labels allow mouse range selection without opening editors', async (a) => {
    a.configure({ mode: 'inspector', presentation: 'pane', flatRoot: true, multiSelect: true });
    a.widget.setModel({ first: 'Alpha', second: 'Bravo' });
    await wait();
    const c = a.widget.controller;
    const box = c.canvas.getBoundingClientRect();
    const x = box.left + 75;
    const y = (id) => {
      const row = c.rowModel.getRowById(id);
      return box.top + c.viewport.headerHeight + row.y - c.viewport.scrollY + row.height / 2;
    };
    same(c.hitTest(75, y('model:first') - box.top)?.part, 'label', 'gesture starts on label');
    await window.testMouse({ type: 'mousePressed', x, y: y('model:first'), button: 'left', clickCount: 1, modifiers: 8 });
    same(c.cellEditor.overlay, null, 'label does not open an editor');
    await window.testMouse({ type: 'mouseMoved', x, y: y('model:second'), button: 'left', buttons: 1, modifiers: 8 });
    same(a.widget.getSelection(), ['model:first', 'model:second'], 'labels select a range');
    await window.testMouse({ type: 'mouseReleased', x, y: y('model:second'), button: 'left', clickCount: 1, modifiers: 8 });
  });

  for (const presentation of ['pane', 'table'])
    await check(`editors survive live refreshes (${presentation})`, async (a) => {
      const w = a.widget;
      const meta = {
        level: {
          min: 0,
          max: 100,
          step: 1
        },
        mode: {
          options: {
            One: 1,
            Two: 2
          }
        }
      };
      a.configure({
        mode: 'inspector',
        presentation,
        model: {
          level: 20,
          mode: 1
        },
        meta,
        rowReorder: false,
        rowDrag: (node) => ({
          id: node.id
        })
      });
      await wait();
      const c = w.controller;
      const stop = c.on('valuechange', (e) =>
        w.setModel(
          {
            ...e.detail.model
          },
          structuredClone(meta)
        )
      );
      const point = (path, part, fraction = 0.5) => {
        const box = c.canvas.getBoundingClientRect();
        const row = c.rowModel.rows.find((row) => c.model.nodes[row.nodeIndex].data.path === path);
        const y =
          c.viewport.renderInsetY +
          c.viewport.headerHeight +
          row.y -
          c.viewport.scrollY +
          row.height / 2;
        const xs = [];
        for (let x = 0; x < c.viewport.contentViewportWidth; x++)
          if (c.hitTest(x, y)?.part === part && c.hitTest(x, y)?.row === row) xs.push(x);
        if (!xs.length) throw Error(`Missing ${path} ${part}`);
        return {
          x: box.left + xs[Math.floor((xs.length - 1) * fraction)],
          y: box.top + y
        };
      };
      const mouse = (type, p, buttons = 0) =>
        window.testMouse({
          type,
          ...p,
          button: 'left',
          buttons,
          clickCount: 1
        });
      await mouse('mousePressed', point('level', 'range', 0.2), 1);
      const initial = c.inspector.model.level;
      await wait();
      await mouse('mouseMoved', point('level', 'range', 0.8), 1);
      same(c.inspector.model.level > initial, true, 'range continues after model refresh');
      await mouse('mouseReleased', point('level', 'range', 0.8));
      const p = point('level', 'number');
      await mouse('mousePressed', p, 1);
      await mouse('mouseReleased', p);
      const input = c.cellEditor.overlay;
      same(!!input, true, 'numeric input remains open after click');
      same(input.matches(':focus'), true, 'numeric input keeps focus');
      input.value = '37';
      w.setModel(
        {
          ...c.inspector.model,
          level: 60
        },
        structuredClone(meta)
      );
      await wait();
      same(c.cellEditor.overlay === input, true, 'same input after incoming value');
      same(input.value, '37', 'draft remains untouched');
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true
        })
      );
      same(c.inspector.model.level, 37, 'typed value commits');
      const selectPoint = point('mode', 'editor');
      await mouse('mousePressed', selectPoint, 1);
      await mouse('mouseReleased', selectPoint);
      const select = c.cellEditor.overlay;
      same(select?.tagName, 'SELECT', 'select opens');
      for (let i = 0; i < 3; i++) {
        w.setModel(
          {
            ...c.inspector.model,
            level: i
          },
          structuredClone(meta)
        );
        await wait();
      }
      same(c.cellEditor.overlay === select, true, 'select survives repeated live updates');
      select.value = '2';
      select.dispatchEvent(
        new Event('change', {
          bubbles: true
        })
      );
      same(c.inspector.model.mode, 2, 'selection commits after refreshes');
      await mouse('mousePressed', point('level', 'number'), 1);
      await mouse('mouseReleased', point('level', 'number'));
      w.setModel(
        {
          ...c.inspector.model
        },
        {
          ...meta,
          level: {
            ...meta.level,
            readonly: true
          }
        }
      );
      same(c.cellEditor.overlay, null, 'readonly changes cancel editing');
      stop();
    });
  for (const presentation of ['pane', 'table'])
    await check(`open range number follows slider changes (${presentation})`, async (a) => {
      a.configure({ mode: 'inspector', presentation, flatRoot: true, editable: true });
      a.widget.setModel({ level: 20 }, { level: { min: 0, max: 100, step: 1, integer: true } });
      await wait();
      const c = a.widget.controller;
      const point = (part, fraction = 0.5) => {
        const row = c.rowModel.getRowById('model:level');
        const box = c.canvas.getBoundingClientRect();
        const y = c.viewport.renderInsetY + c.viewport.headerHeight +
          row.y - c.viewport.scrollY + row.height / 2;
        const xs = [];
        for (let x = 0; x < c.viewport.contentViewportWidth; x++) {
          const hit = c.hitTest(x, y);
          if (hit?.row === row && hit.part === part) xs.push(x);
        }
        if (!xs.length) throw new Error(`Missing ${part} control`);
        return { x: box.left + xs[Math.floor((xs.length - 1) * fraction)], y: box.top + y };
      };
      const mouse = (type, p, buttons = 0) => window.testMouse({
        type, ...p, button: 'left', buttons, clickCount: 1
      });
      const number = point('number');
      await mouse('mousePressed', number, 1);
      await mouse('mouseReleased', number);
      const input = c.cellEditor.overlay;
      same(input?.value, '20', 'number editor opens with current value');
      input.value = '41';
      const start = point('range', 0.75);
      await mouse('mousePressed', start, 1);
      same(c.cellEditor.overlay === input, true, 'number editor stays open on range press');
      same(input.value, String(c.inspector.model.level), 'range press replaces stale draft');
      const end = point('range', 0.25);
      await mouse('mouseMoved', end, 1);
      same(input.value, String(c.inspector.model.level), 'number follows range drag immediately');
      await mouse('mouseReleased', end);
      same(c.cellEditor.overlay === input, true, 'number editor stays open after range drag');
      same(input.value, String(c.inspector.model.level), 'number remains synchronized');
    });
  await check('flat lists reclaim chevron space and trees keep sibling alignment', async (a) => {
    const w = a.widget;
    a.configure({
      rowReorder: false
    });
    w.setColumns([
      {
        id: 'name',
        kind: 'tree',
        width: 400
      }
    ]);
    await wait();
    const c = w.controller,
      y = c.viewport.renderInsetY + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    same(c.hitTest(12, y).part, 'icon', 'flat-list icon occupies the former bullet space');
    same(c.hitTest(32, y).part, 'label', 'flat-list label starts earlier');
    const ctx = c.renderer.ctx,
      arc = ctx.arc;
    let bullets = 0;
    try {
      ctx.arc = function (x, y, r, ...args) {
        if (r === 1.5) bullets++;
        return arc.call(this, x, y, r, ...args);
      };
      c.render();
    } finally {
      ctx.arc = arc;
    }
    same(bullets, 0, 'leaf bullets are not drawn');
    w.setData([
      {
        id: 'branch',
        label: 'Branch'
      },
      {
        id: 'child',
        parentId: 'branch',
        label: 'Child'
      },
      {
        id: 'leaf',
        label: 'Leaf'
      }
    ]);
    await wait();
    same(c.hitTest(10, y).part, 'chevron', 'branch still expands');
    const leaf = c.rowModel.getRowById('leaf');
    const leafY = c.viewport.renderInsetY + c.viewport.headerHeight + leaf.y + leaf.height / 2;
    same(c.hitTest(34, leafY).part, 'icon', 'leaf icon aligns with its branch sibling');
    same(c.hitTest(10, leafY).part, 'cell', 'leaf has no expansion target');
  });
  await check('header visibility preserves its height and keeps filtering available', async (a) => {
    a.configure({
      headerHeight: 36,
      showHeader: false,
      filter: true
    });
    await wait();
    const c = a.widget.controller;
    same(c.viewport.headerHeight, 0, 'header hidden');
    same(a.root.querySelector('.vtc-filter').hidden, false, 'filter remains available');
    a.widget.setSelection(['b']);
    a.configure({
      showHeader: true
    });
    await wait();
    same(c.viewport.headerHeight, 36, 'configured height restored');
    same(a.widget.getSelection(), ['b'], 'selection preserved');
  });
  await check('editing toggle preserves state and filter listeners run once', async (a) => {
    const w = a.widget,
      c = w.controller;
    w.moveRow('a', 2);
    w.setSelection(['b']);
    w.setDynamicState([
      {
        id: 'b',
        state: {
          value: 42
        }
      }
    ]);
    c.registerIcon('custom', '<svg xmlns="http://www.w3.org/2000/svg"/>');
    a.configure({
      editable: false
    });
    await wait();
    same(w.controller === c, true, 'controller identity');
    same(w.getRowOrder(), ['b', 'c', 'a'], 'order');
    same(w.getSelection(), ['b'], 'selection');
    same(c.model.dynamicState.get('b').value, 42, 'live value');
    same(c.iconRegistry.icons.has('custom'), true, 'custom icon');
    let calls = 0;
    const original = c.setFilter.bind(c);
    c.setFilter = (...args) => {
      calls++;
      return original(...args);
    };
    a.root.querySelector('[aria-label="Match case"]').click();
    same(calls, 1, 'one filter call');
    same(c.filterOptions.caseSensitive, true, 'case enabled');
    a.configure({
      editable: true
    });
    await wait();
    same(w.controller === c, true, 'same editor owner after enabling');
    a.root.querySelector('[aria-label="Match case"]').click();
    same(calls, 2, 'one more filter call');
    same(c.filterOptions.caseSensitive, false, 'case disabled');
  });
  await check('filter visibility and icon resolver preserve manual order', async (a) => {
    a.widget.moveRow('a', 2);
    a.configure({
      filter: false
    });
    await wait();
    same(a.widget.getRowOrder(), ['b', 'c', 'a'], 'order after hiding filter');
    same(a.root.querySelector('.vtc-filter').hidden, true, 'hidden');
    a.configure({
      filter: true,
      iconResolver: () => 'person'
    });
    await wait();
    same(a.widget.getRowOrder(), ['b', 'c', 'a'], 'order after changing icons');
    same(a.widget.controller.model.index.getNode('a').icon, 'person', 'icon resolver');
  });
  await check('wheel scrolling stays in the tree unless chaining is enabled', async (a) => {
    const scroller = document.createElement('div');
    scroller.style.cssText = 'width:920px;height:120px;overflow:auto';
    a.root.before(scroller);
    scroller.append(a.root);
    a.configure({
      nodes: Array.from({ length: 40 }, (_, index) => ({
        id: `scroll-row-${index}`,
        label: `Row ${index}`
      }))
    });
    await wait();
    const box = a.widget.controller.canvas.getBoundingClientRect();
    const wheelDown = () =>
      window.testMouse({
        type: 'mouseWheel',
        x: box.left + box.width / 2,
        y: box.top + Math.min(80, box.height / 2),
        deltaX: 0,
        deltaY: 120
      });

    await wheelDown();
    await wait();
    same(scroller.scrollTop, 0, 'default wheel does not scroll the parent');

    a.widget.controller.scrollTo(0, Number.POSITIVE_INFINITY);
    a.configure({ scrollChaining: true });
    await wait();
    await wheelDown();
    await wait();
    same(scroller.scrollTop > 0, true, 'enabled chaining scrolls the parent at the tree edge');

    a.configure({
      scrollChaining: false,
      nodes: [{ id: 'only-row', label: 'Only row' }]
    });
    scroller.scrollTop = 0;
    await wait();
    await wheelDown();
    await wait();
    same(a.widget.controller.viewport.scrollY, 0, 'tree without overflow does not scroll');
    same(scroller.scrollTop > 0, true, 'tree without overflow leaves the wheel to its parent');
  });
  await check('wheel scrolling over row actions uses the tree scroll path', async (a) => {
    const scroller = document.createElement('div');
    scroller.style.cssText = 'width:920px;height:120px;overflow:auto';
    a.root.before(scroller);
    scroller.append(a.root);
    a.configure({
      rowReorder: false,
      nodes: Array.from({ length: 40 }, (_, index) => ({
        id: `row-${index}`,
        label: `Row ${index}`
      })),
      rowActions: [{ id: 'favorite', label: 'Favorite', icon: 'star' }]
    });
    await wait();
    const wheelOverAction = () => {
      const box = a.root.querySelector('.vtc-row-action').getBoundingClientRect();
      return window.testMouse({
        type: 'mouseWheel',
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
        deltaX: 0,
        deltaY: 120
      });
    };

    await wheelOverAction();
    await wait();
    same(a.widget.controller.viewport.scrollY > 0, true, 'action area scrolls the tree');
    same(scroller.scrollTop, 0, 'action area retains wheel scrolling in the tree');

    a.widget.controller.scrollTo(0, Number.POSITIVE_INFINITY);
    await wait();
    await wheelOverAction();
    await wait();
    same(scroller.scrollTop, 0, 'action area retains wheel scrolling at the tree edge');

    a.configure({ scrollChaining: true });
    await wait();
    await wheelOverAction();
    await wait();
    same(scroller.scrollTop > 0, true, 'action area honors enabled scroll chaining');
  });
  await check('real pointer dragging and keyboard ordering use the mounted canvas', async (a) => {
    await wait();
    const w = a.widget,
      c = w.controller,
      box = c.canvas.getBoundingClientRect();
    const x = box.left + 12,
      y = box.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    const scrollY = window.scrollY,
      parentScroll = a.root.parentElement?.scrollTop;
    const events = [];
    const stop = a.subscribe('rowreorder', (e) => events.push(e.detail));
    await window.testMouse({
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1
    });
    const destination = y + c.rowModel.rowHeight * 2 + 8;
    await window.testMouse({
      type: 'mouseMoved',
      x,
      y: destination,
      button: 'left',
      buttons: 1
    });
    const dragGhost = document.querySelector('.vtc-row-drag-ghost');
    same(dragGhost?.hidden, false, 'row drag ghost visible');
    const pixelRatio = c.canvas.width / c.viewport.viewportWidth;
    same(
      dragGhost?.width,
      Math.round(c.viewport.contentViewportWidth * pixelRatio),
      'row drag ghost width'
    );
    same(
      dragGhost?.height,
      Math.round(c.rowModel.rowHeight * pixelRatio),
      'row drag ghost height'
    );
    await window.testMouse({
      type: 'mouseReleased',
      x,
      y: destination,
      button: 'left',
      clickCount: 1
    });
    same(window.scrollY, scrollY, 'page remains stationary');
    same(a.root.parentElement?.scrollTop, parentScroll, 'parent remains stationary');
    same(w.getRowOrder(), ['b', 'c', 'a'], 'drag order');
    same(events.length, 1, 'one drag event');
    same(events[0].source, 'pointer', 'pointer source');
    c.canvas.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true
      })
    );
    same(w.getRowOrder(), ['b', 'a', 'c'], 'keyboard order');
    same(events.length, 2, 'one keyboard event');
    same(events[1].source, 'keyboard', 'keyboard source');
    stop();
  });
  await check('Shift drag selects a visible range without reordering', async (a) => {
    await wait();
    const c = a.widget.controller;
    const box = c.canvas.getBoundingClientRect();
    const x = box.left + 125;
    const y = box.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    const endY = y + c.rowModel.rowHeight * 2;
    const order = a.widget.getRowOrder();
    await window.testMouse({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await window.testMouse({ type: 'mouseMoved', x, y: endY, button: 'left', buttons: 1 });
    same(a.widget.getSelection(), [], 'plain drag does not select a range');
    await window.testMouse({ type: 'mouseReleased', x, y: endY, button: 'left', clickCount: 1 });
    a.widget.clearSelection();
    await window.testMouse({ type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: 8 });
    await window.testMouse({ type: 'mouseMoved', x, y: endY, button: 'left', buttons: 1, modifiers: 8 });
    same(a.widget.getSelection(), ['a', 'b', 'c'], 'all crossed rows selected');
    await window.testMouse({ type: 'mouseReleased', x, y: endY, button: 'left', clickCount: 1, modifiers: 8 });
    same(a.widget.getSelection(), ['a', 'b', 'c'], 'release keeps selection');
    same(a.widget.getRowOrder(), order, 'row order untouched');
  });
  await check('single-select mode allows direct data dragging but never keeps a range', async (a) => {
    a.configure({ multiSelect: false, rowDrag: (node) => ({ id: node.id }) });
    await wait();
    const c = a.widget.controller;
    a.widget.setSelection(['a', 'b']);
    same(a.widget.getSelection(), ['b'], 'programmatic selection is limited to one row');
    const box = c.canvas.getBoundingClientRect();
    const x = box.left + 125;
    const y = box.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    const events = [];
    c.on('rowdragstart', (event) => events.push(event.detail));
    await window.testMouse({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await window.testMouse({ type: 'mouseMoved', x: x + 30, y: y + c.rowModel.rowHeight * 2, button: 'left', buttons: 1 });
    same(a.widget.getSelection(), ['a'], 'drag selects only its source row');
    same(events[0].nodeIds, ['a'], 'drag exports one row');
    await window.testMouse({ type: 'mouseReleased', x: x + 30, y: y + c.rowModel.rowHeight * 2, button: 'left', clickCount: 1 });
  });
  await check('plain drag exports an unselected row without selecting a range', async (a) => {
    a.configure({ rowDrag: (node) => ({ id: node.id }) });
    await wait();
    const c = a.widget.controller;
    const box = c.canvas.getBoundingClientRect();
    const x = box.left + 125;
    const y = box.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    const endY = y + c.rowModel.rowHeight * 2;
    const events = [];
    c.on('rowdragstart', (event) => events.push(event.detail));
    c.setSelection(['b', 'c']);
    await window.testMouse({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await window.testMouse({ type: 'mouseMoved', x, y: endY, button: 'left', buttons: 1 });
    same(a.widget.getSelection(), ['a'], 'source row replaces the old selection');
    same(events[0].nodeIds, ['a'], 'plain drag exports its source');
    await window.testMouse({ type: 'mouseReleased', x, y: endY, button: 'left', clickCount: 1 });
  });
  await check('Shift drag selects rows while external row dragging remains available', async (a) => {
    a.configure({ rowDrag: (node) => ({ id: node.id }) });
    await wait();
    const c = a.widget.controller;
    const box = c.canvas.getBoundingClientRect();
    const x = box.left + 125;
    const y = box.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    const endY = y + c.rowModel.rowHeight * 2;
    const events = [];
    const stop = a.subscribe('rowdrag', (event) => events.push(event));
    await window.testMouse({ type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: 8 });
    await window.testMouse({ type: 'mouseMoved', x, y: endY, button: 'left', buttons: 1, modifiers: 8 });
    await window.testMouse({ type: 'mouseReleased', x, y: endY, button: 'left', clickCount: 1, modifiers: 8 });
    same(a.widget.getSelection(), ['a', 'b', 'c'], 'Shift drag selects range');
    same(events.length, 0, 'Shift drag does not start external drag');
    stop();
  });
  await check('Ctrl drag exports a selected draggable row without selecting a range', async (a) => {
    a.configure({ rowDrag: (node) => ({ id: node.id }) });
    await wait();
    const c = a.widget.controller;
    c.setSelection(['a']);
    const box = c.canvas.getBoundingClientRect();
    const x = box.left + 125;
    const y = box.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    const endY = y + c.rowModel.rowHeight * 2;
    const events = [];
    c.on('rowdragstart', (event) => events.push(event.detail));
    await window.testMouse({ type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: 2 });
    await window.testMouse({ type: 'mouseMoved', x, y: endY, button: 'left', buttons: 1, modifiers: 2 });
    await window.testMouse({ type: 'mouseReleased', x, y: endY, button: 'left', clickCount: 1, modifiers: 2 });
    same(a.widget.getSelection(), ['a'], 'Ctrl drag keeps the selected row');
    same(events[0].nodeIds, ['a'], 'Ctrl drag exports the selected row');
  });
  await check('the reorder gutter offsets hierarchy guides', async (a) => {
    a.configure({
      nodes: [
        { id: 'root', label: 'Root' },
        { id: 'child', parentId: 'root', label: 'Child' }
      ]
    });
    const c = a.widget.controller;
    c.expand('root');
    c.render();
    const row = c.rowModel.getRowById('child');
    const treeColumn = c.columnModel.columns.find((column) => column.kind === 'tree');
    const pixelRatio = c.canvas.width / c.viewport.viewportWidth;
    const y = Math.floor(
      (c.viewport.renderInsetY +
        c.viewport.headerHeight +
        row.y -
        c.viewport.scrollY +
        7) *
        pixelRatio
    );
    const pixel = (x) =>
      Array.from(c.canvas.getContext('2d').getImageData(Math.floor(x * pixelRatio), y, 1, 1).data);
    const color = (value) =>
      [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
    same(pixel(10).slice(0, 3), color(c.themeManager.get().colors.row), 'order gutter is clear');
    same(
      pixel(treeColumn.x + 10).slice(0, 3),
      color(c.themeManager.get().colors.guide),
      'guide starts inside the tree column'
    );
  });
  await check('checkbox actions are independent of row selection and dragging', async (a) => {
    const checked = new Set(),
      events = [];
    a.configure({
      rowActions: [
        {
          id: 'enabled',
          kind: 'checkbox',
          label: 'Enabled',
          checked: (node) => checked.has(node.id),
          disabled: (node) => node.id === 'c'
        }
      ],
      rowDrag: (node) => ({
        id: node.id
      })
    });
    await wait();
    const c = a.widget.controller;
    a.subscribe('rowaction', (event) => {
      events.push(event.detail);
      if (event.detail.checked) checked.add(event.detail.nodeId);
      else checked.delete(event.detail.nodeId);
      c.requestRender();
    });
    const input = a.root.querySelector('[role=checkbox][data-node-id="a"]'),
      box = input.getBoundingClientRect();
    await window.testMouse({
      type: 'mousePressed',
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      button: 'left',
      clickCount: 1
    });
    await window.testMouse({
      type: 'mouseReleased',
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      button: 'left',
      clickCount: 1
    });
    await wait();
    same(events.length, 1, 'one action');
    same(events[0].checked, true, 'checked value');
    same(input.getAttribute('aria-checked'), 'true', 'checkbox reflects state');
    same(c.getSelection(), [], 'row is not selected');
    same(c.rowReorderInput.gesture, null, 'no drag gesture');
    input.click();
    await wait();
    same(events[1].checked, false, 'unchecking emits false');
    a.root.querySelector('[role=checkbox][data-node-id="c"]').click();
    same(events.length, 2, 'disabled checkbox ignores clicks');
  });
  await check('row actions preserve selection, focus and dynamic state', async (a) => {
    let selected = false;
    a.configure({
      rowActions: [
        {
          id: 'favorite',
          preloadIcons: ['star', 'star-filled'],
          icon: () => (selected ? 'star-filled' : 'star'),
          label: 'Favorite',
          visible: (n) => n.id !== 'c',
          disabled: (n) => n.id === 'b',
          pressed: () => selected
        }
      ]
    });
    await wait();
    const c = a.widget.controller;
    for (let i = 0; i < 30 && c.iconRegistry.get('star-filled').rasters.size < 2; i++) await wait();
    same(
      c.iconRegistry.get('star-filled').rasters.size >= 2,
      true,
      'both action colors prepared before the first toggle'
    );
    const button = a.root.querySelector('[data-action="favorite"][data-node-id="a"]');
    same(!!button, true, 'visible row button');
    same(a.root.querySelector('[data-node-id="b"]').disabled, true, 'disabled action');
    same(a.root.querySelector('[data-node-id="c"]'), null, 'hidden action');
    const events = [];
    a.subscribe('rowaction', (e) => {
      events.push(e.detail);
      selected = true;
      c.requestRender();
    });
    button.focus({
      preventScroll: true
    });
    button.click();
    a.widget.setDynamicState([
      {
        id: 'a',
        state: {
          value: 2
        }
      }
    ]);
    await wait();
    same(events.length, 1, 'one action');
    same(events[0].nodeId, 'a', 'action identifies row');
    same(a.widget.getSelection(), [], 'action does not require selection');
    same(
      a.root.querySelector('[data-node-id="a"]') === button,
      true,
      'button retained during updates'
    );
    same(button.getAttribute('aria-pressed'), 'true', 'pressed state');
    a.configure({
      rowActions: []
    });
    await wait();
    same(a.root.querySelector('[data-action]'), null, 'removed actions');
  });
  await check('async action icons repaint without scrolling', async (a) => {
    const c = a.widget.controller;
    c.registerIcon(
      'async-action-test',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="currentColor"/></svg>'
    );
    a.configure({
      mode: 'inspector',
      model: { first: 1, second: 2 },
      rowReorder: false,
      rowActions: [
        {
          id: 'favorite',
          label: 'Favorite',
          icon: () => 'async-action-test'
        }
      ]
    });
    for (
      let index = 0;
      index < 30 && c.iconRegistry.get('async-action-test').rasters.size === 0;
      index++
    ) {
      await wait();
    }
    await wait();
    const icon = a.root.querySelector(
      '[data-node-id="model:first"][data-action="favorite"] canvas'
    );
    const pixels = icon.getContext('2d').getImageData(0, 0, icon.width, icon.height).data;
    same(
      pixels.some((channel, index) => index % 4 === 3 && channel > 0),
      true,
      'initially visible async icon is repainted once decoded'
    );
  });
  await check(
    'right-side actions include partial rows and checkboxes share the value column',
    async (a) => {
      a.configure({
        mode: 'inspector',
        rowReorder: false,
        rowActions: [
          {
            id: 'favorite',
            label: 'Favorite',
            icon: 'star'
          }
        ]
      });
      a.widget.setModel(
        {
          speed: 12,
          enabled: true,
          mode: 'Auto',
          altitude: 34
        },
        {
          mode: {
            options: ['Auto', 'Manual']
          }
        }
      );
      await wait();
      const c = a.widget.controller;
      const column = c.columnModel.columns.find((col) => col.kind === 'inspectorPane');
      same(c.columnModel.columns.at(-1).id, '__vtc_actions', 'actions on the right');
      const number = c.getInspectorPaneLayout(column.width, c.rowModel.rows[0], 'number');
      const checkbox = c.getInspectorPaneLayout(column.width, c.rowModel.rows[1], 'checkbox');
      const select = c.getInspectorPaneLayout(column.width, c.rowModel.rows[2], 'select');
      same(checkbox.editorLeft, number.editorLeft, 'checkbox and numeric alignment');
      same(checkbox.editorLeft, select.editorLeft, 'checkbox and select alignment');
      c.resize(700, c.viewport.headerHeight + c.rowModel.rowHeight * 3 + 20);
      c.render();
      const last = a.root.querySelector('[data-node-id="model:altitude"]');
      same(!!last, true, 'action retained on partially visible final row');
      const right = last.getBoundingClientRect().right - c.canvas.getBoundingClientRect().left;
      same(
        Math.abs(right - (c.viewport.renderInsetX + c.viewport.contentViewportWidth - 1)) < 2,
        true,
        'actions pinned to visible right edge'
      );
    }
  );
  await check('pane ranges reclaim hidden leading action slots', async (a) => {
    a.root.style.width = '404px';
    a.configure({
      mode: 'inspector',
      presentation: 'pane',
      showHeader: false,
      initialExpandDepth: 3,
      rowReorder: false,
      rowActions: [
        {
          id: 'dashboard',
          label: 'Show in dashboard',
          kind: 'checkbox',
          visible: (node) => node.data?.path === ''
        },
        {
          id: 'favorite',
          label: 'Toggle favorite',
          icon: 'star',
          visible: (node) => node.data?.path !== ''
        }
      ]
    });
    a.widget.setModel(
      { surface: { azimuthToTrack: 14.5 } },
      { 'surface.azimuthToTrack': { min: -180, max: 180, unit: '°' } }
    );
    await wait();

    const c = a.widget.controller;
    const row = c.rowModel.rows.find(
      (candidate) => c.model.nodes[candidate.nodeIndex].data?.path === 'surface.azimuthToTrack'
    );
    const pane = c.columnModel.columns.find((column) => column.kind === 'inspectorPane');
    const y = c.viewport.headerHeight + row.y - c.viewport.scrollY + row.height / 2;
    const parts = Array.from({ length: c.viewport.contentViewportWidth }, (_, x) => ({
      x,
      part: c.hitTest(x, y)?.part
    }));
    const numberXs = parts.filter(({ part }) => part === 'number').map(({ x }) => x);

    same(
      c.hitTest(pane.x + pane.width + 10, y)?.column?.kind,
      'inspectorPane',
      'hidden dashboard slot is reclaimed'
    );
    same(numberXs.length > 80, true, 'numeric input receives the reclaimed width');
    same(
      c.hitTest(pane.x + pane.width + 28, y)?.column?.id,
      '__vtc_actions',
      'favorite slot remains reserved'
    );
  });
  await check('row actions update only dirty rows and retain focus', async (a) => {
    const evaluatedRows = [];
    a.configure({
      rowReorder: false,
      rowActions: [
        {
          id: 'live',
          label: 'Live',
          icon: (_node, state) => state.actionIcon ?? 'star',
          visible: (_node, state) => state.show !== false,
          disabled: (node, state) => {
            evaluatedRows.push(node.id);
            return Boolean(state.disabled);
          },
          pressed: (_node, state) => Boolean(state.pressed)
        },
        {
          id: 'checked',
          kind: 'checkbox',
          label: 'Checked',
          checked: (_node, state) => Boolean(state.checked)
        }
      ]
    });
    await wait();
    const c = a.widget.controller;
    const actionCanvas = a.root.querySelector('[data-node-id="a"][data-action="live"] canvas');
    await c.iconRegistry.prepare({
      icons: ['star', 'item'],
      size: 16,
      color: c.themeManager.get().colors.textMuted,
      pixelRatio: window.devicePixelRatio
    });
    await wait();
    const full = c.actionOverlay.fullUpdates;
    const incremental = c.actionOverlay.incrementalUpdates;
    const drawKey = actionCanvas._vtcDrawKey;
    evaluatedRows.length = 0;
    const focused = a.root.querySelector('[data-node-id="b"][data-action="live"]');
    focused.focus({ preventScroll: true });

    a.widget.setDynamicState([{ id: 'a', state: { irrelevant: 1 } }]);
    await wait();
    same(c.actionOverlay.fullUpdates, full, 'dynamic update avoids full action sync');
    same(c.actionOverlay.incrementalUpdates, incremental + 1, 'one incremental action sync');
    same([...new Set(evaluatedRows)], ['a'], 'only the dirty row is reevaluated');
    same(actionCanvas._vtcDrawKey, drawKey, 'irrelevant state does not redraw an icon');
    same(document.activeElement === focused, true, 'focus on another row is retained');

    a.widget.setDynamicState([{
      id: 'a',
      state: { disabled: true, pressed: true, checked: true, actionIcon: 'star-filled' }
    }]);
    await wait();
    const live = a.root.querySelector('[data-node-id="a"][data-action="live"]');
    const checked = a.root.querySelector('[data-node-id="a"][data-action="checked"]');
    same(live.disabled, true, 'disabled updates incrementally');
    same(live.getAttribute('aria-pressed'), 'true', 'pressed updates incrementally');
    same(checked.getAttribute('aria-checked'), 'true', 'checked updates incrementally');
    same(actionCanvas._vtcDrawKey !== drawKey, true, 'relevant icon state redraws');

    a.widget.setDynamicState([{ id: 'a', state: { show: false } }]);
    await wait();
    same(a.root.querySelector('[data-node-id="a"][data-action="live"]'), null, 'visibility removes only the affected action');
    same(!!a.root.querySelector('[data-node-id="a"][data-action="checked"]'), true, 'other actions remain');

    const beforeScroll = c.actionOverlay.fullUpdates;
    c.scrollBy(0, c.rowModel.rowHeight);
    await wait();
    same(c.actionOverlay.fullUpdates > beforeScroll, true, 'scroll performs a full action sync');
  });
  await check('sticky row actions participate in dynamic invalidation', async (a) => {
    const children = Array.from({ length: 30 }, (_, index) => ({
      id: `child-${index}`, parentId: 'root', label: `Child ${index}`
    }));
    a.configure({
      nodes: [{ id: 'root', label: 'Root' }, ...children],
      rowReorder: false,
      rowActions: [{
        id: 'live', label: 'Live', icon: 'star',
        disabled: (_node, state) => Boolean(state.disabled)
      }]
    });
    await wait();
    const c = a.widget.controller;
    c.scrollToNode('child-20', 'start');
    await wait();
    for (let index = 0; index < 30 && c.iconRegistry.get('star').rasters.size < 2; index++) {
      await wait();
    }
    c.cancelRender();
    c.render();
    const sticky = a.root.querySelector('[data-node-id="root"][data-action="live"]');
    same(!!sticky, true, 'sticky action is mounted');
    const incremental = c.actionOverlay.incrementalUpdates;
    a.widget.setDynamicState([{ id: 'root', state: { disabled: true } }]);
    await wait();
    same(sticky.disabled, true, 'sticky action updates dynamically');
    same(c.actionOverlay.incrementalUpdates, incremental + 1, 'sticky update is incremental');
  });
  await check('visible tooltips survive live value updates without mouse movement', async (a) => {
    a.configure({
      rowReorder: false,
      columns: [
        { id: 'name', title: 'Name', width: 700, kind: 'tree' },
        {
          id: 'value',
          title: 'Value',
          width: 90,
          kind: 'value',
          value: (_node, state) => state.value ?? ''
        }
      ]
    });
    await wait();
    const c = a.widget.controller;
    a.widget.setDynamicState([{
      id: 'a',
      state: { value: 'A long live value that is clipped' }
    }]);
    await wait();
    const canvasRect = c.canvas.getBoundingClientRect();
    const row = c.rowModel.getRowById('a');
    const column = c.columnModel.columns.find((item) => item.id === 'value');
    const localX = c.viewport.renderInsetX + column.x - c.viewport.scrollX + 20;
    const localY = c.viewport.renderInsetY + c.viewport.headerHeight + row.y - c.viewport.scrollY + row.height / 2;
    const hit = c.hitTest(localX, localY);
    same(c.getTooltipForHit(hit)?.text, 'A long live value that is clipped', 'value is truncated');
    c.canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: canvasRect.left + localX,
      clientY: canvasRect.top + localY,
      bubbles: true
    }));
    const tooltip = a.root.querySelector('.virtual-tree-canvas-tooltip');
    same(tooltip.style.display, 'block', 'clipped value shows its tooltip');
    same(tooltip.textContent, 'A long live value that is clipped', 'initial tooltip value');

    a.widget.setData([
      { id: 'a', label: 'Alpha refreshed' },
      { id: 'b', label: 'Bravo refreshed' },
      { id: 'c', label: 'Charlie refreshed' }
    ]);
    await wait();
    same(tooltip.style.display, 'block', 'same-cell data refresh keeps the tooltip visible');

    a.widget.setDynamicState([{
      id: 'a',
      state: { value: 'A different live value that remains clipped' }
    }]);
    await wait();
    same(tooltip.style.display, 'block', 'tooltip remains visible after the update');
    same(
      tooltip.textContent,
      'A different live value that remains clipped',
      'tooltip content refreshes without mouse movement'
    );
  });
  await check(
    'actions preserve row selection and use screen-resolution icons after resize',
    async (a) => {
      a.configure({
        rowActions: [
          {
            id: 'favorite',
            label: 'Favorite',
            icon: 'star'
          }
        ],
        rowReorder: false
      });
      await wait();
      const c = a.widget.controller;
      a.widget.setSelection(['b']);
      c.render();
      const checkSelection = () => {
        const dpr = c.canvas.width / c.viewport.viewportWidth;
        const row = c.rowModel.getRowById('b');
        const y = Math.floor(
          (c.viewport.headerHeight + row.y - c.viewport.scrollY + row.height / 2) * dpr
        );
        const ctx = c.canvas.getContext('2d');
        const left = Array.from(ctx.getImageData(Math.floor(5 * dpr), y, 1, 1).data);
        const right = Array.from(
          ctx.getImageData(Math.floor((c.viewport.contentViewportWidth - 8) * dpr), y, 1, 1).data
        );
        same(right, left, 'selection continues beneath actions');
        const button = a.root.querySelector('[data-action="favorite"]');
        same(
          getComputedStyle(button.parentElement).backgroundColor,
          'rgba(0, 0, 0, 0)',
          'overlay is transparent'
        );
        const icon = button.querySelector('canvas');
        same(
          icon.width,
          Math.round(16 * (window.devicePixelRatio || 1)),
          'icon backing resolution'
        );
        same(icon.getBoundingClientRect().width, 16, 'icon display size');
      };
      checkSelection();
      c.resize(600, 240);
      c.render();
      checkSelection();
      c.resize(850, 300);
      c.render();
      checkSelection();
      const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
      try {
        Object.defineProperty(window, 'devicePixelRatio', {
          configurable: true,
          value: 2
        });
        c.render();
        checkSelection();
      } finally {
        if (original) Object.defineProperty(window, 'devicePixelRatio', original);
        else delete window.devicePixelRatio;
      }
    }
  );
  await check('external dragging works with sorting and leaves row order intact', async (a) => {
    a.configure({
      rowDrag: (node) => ({
        id: node.id
      })
    });
    await wait();
    const c = a.widget.controller,
      events = [];
    for (const type of ['rowdragstart', 'rowdragmove', 'rowdragend', 'rowdragcancel'])
      c.on(type, (e) => events.push(e));
    c.sortBy('name', 'desc');
    c.setSelection(['b', 'c']);
    await wait();
    const box = c.canvas.getBoundingClientRect(),
      x = box.left + 125,
      y = box.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    await window.testMouse({
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1
    });
    await window.testMouse({
      type: 'mouseMoved',
      x: x + 30,
      y: y + 5,
      button: 'left',
      buttons: 1
    });
    const dragBadge = document.querySelector('.vtc-row-drag-badge');
    same(dragBadge?.hidden, false, 'multi-row drag badge visible');
    same(dragBadge?.textContent, '×2', 'multi-row drag badge count');
    await window.testMouse({
      type: 'mouseReleased',
      x: x + 30,
      y: y + 5,
      button: 'left',
      clickCount: 1
    });
    same(
      events.map((e) => e.type),
      ['rowdragstart', 'rowdragmove', 'rowdragend'],
      'drag lifecycle'
    );
    same(
      events[0].detail.payload,
      {
        id: 'c'
      },
      'sorted row payload'
    );
    same(events[0].detail.nodeIds, ['b', 'c'], 'selected drag row ids');
    same(events[0].detail.count, 2, 'selected drag row count');
    same(dragBadge?.hidden, true, 'multi-row drag badge hidden after drop');
    same(a.widget.getRowOrder(), ['a', 'b', 'c'], 'manual order unchanged');
    same(a.widget.getSelection(), ['b', 'c'], 'drag preserves the active selection');
    await window.testMouse({
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1
    });
    await window.testMouse({
      type: 'mouseMoved',
      x: x + 30,
      y: y + 5,
      button: 'left',
      buttons: 1
    });
    c.canvas.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      })
    );
    await window.testMouse({
      type: 'mouseReleased',
      x: x + 30,
      y: y + 5,
      button: 'left',
      clickCount: 1
    });
    same(events.at(-1).type, 'rowdragcancel', 'Escape cancels');
  });
  await check('mode, expansion depth and column reset synchronize', async (a) => {
    a.configure({
      mode: 'inspector',
      model: {
        child: {
          value: 1
        }
      },
      initialExpandDepth: 0
    });
    await wait();
    same(!!a.widget.controller.inspector, true, 'inspector mode');
    same(a.widget.controller.initialExpandDepth, 0, 'depth');
    same(a.widget.controller.model.expanded.has('model:child'), false, 'initial collapsed');
    a.configure({
      mode: 'tree'
    });
    await wait();
    same(a.widget.controller.inspector, null, 'tree mode');
    a.widget.setColumns([
      {
        id: 'custom'
      }
    ]);
    a.configure({
      columns: null
    });
    await wait();
    same(
      a.widget.controller.columnModel.columns.map((c) => c.id),
      ['__vtc_row_order', 'name'],
      'default columns'
    );
  });
  await check('theme applies once without changing explicit layout', async (a) => {
    a.configure({
      rowHeight: 36,
      indentWidth: 24
    });
    await wait();
    const c = a.widget.controller;
    let calls = 0;
    const original = c.setTheme.bind(c);
    c.setTheme = (...args) => {
      calls++;
      return original(...args);
    };
    a.widget.setTheme('light');
    await wait();
    same(calls, 1, 'theme calls');
    same(c.rowModel.rowHeight, 36, 'row height');
    same(c.rowModel.indentWidth, 24, 'indent');
  });
  await check('empty editable fields stay visible and editor overlays follow the theme', async (a) => {
    a.configure({
      mode: 'inspector',
      presentation: 'pane',
      model: { callsign: '' },
      meta: { callsign: {} },
      flatRoot: true,
      editable: true,
      rowReorder: false
    });
    a.widget.setTheme('light');
    await wait();
    const c = a.widget.controller;
    c.render();
    const row = c.rowModel.rows.find(
      (candidate) => c.model.nodes[candidate.nodeIndex].data.path === 'callsign'
    );
    const column = c.columnModel.columns.find((candidate) => candidate.kind === 'inspectorPane');
    const paneWidth = Math.min(column.width, c.viewport.contentViewportWidth - column.x);
    const layout = c.getInspectorPaneLayout(paneWidth, row, 'text');
    const dpr = c.canvas.width / c.viewport.viewportWidth;
    const pixel = Array.from(
      c.canvas
        .getContext('2d')
        .getImageData(
          Math.floor((column.x + layout.editorLeft + 10) * dpr),
          Math.floor((c.viewport.headerHeight + row.y + row.height / 2) * dpr),
          1,
          1
        ).data
    ).slice(0, 3);
    const rowColor = [1, 3, 5].map((index) =>
      Number.parseInt(c.themeManager.get().colors.row.slice(index, index + 2), 16)
    );
    same(JSON.stringify(pixel) === JSON.stringify(rowColor), false, 'empty editor frame');

    const hit = c.hitTest(
      column.x + layout.editorLeft + 20,
      c.viewport.headerHeight + row.y + row.height / 2
    );
    same(c.cellEditor.handlePointerDown({}, hit), true, 'empty editor opens');
    const input = c.cellEditor.overlay;
    same(getComputedStyle(input).backgroundColor, 'rgb(255, 255, 255)', 'light editor background');
    same(getComputedStyle(input).color, 'rgb(15, 23, 42)', 'light editor text');

    a.widget.setTheme('dark');
    await wait();
    same(c.cellEditor.overlay === input, true, 'theme change preserves the draft editor');
    same(getComputedStyle(input).backgroundColor, 'rgb(18, 27, 43)', 'dark editor background');
    same(getComputedStyle(input).color, 'rgb(232, 237, 244)', 'dark editor text');
    c.closeEditor();
  });
  for (const presentation of ['pane', 'table'])
    await check(`filled editable values and read-only values are distinct (${presentation})`, async (a) => {
      a.configure({ mode: 'inspector', presentation, flatRoot: true, editable: true });
      a.widget.setModel(
        { altitude: 1250.25, acceleration: -9.80665 },
        { altitude: { unit: 'm' }, acceleration: { unit: 'm/s²', readonly: true } }
      );
      await wait();
      const c = a.widget.controller;
      c.render();
      const canvas = c.canvas;
      const canvasBox = canvas.getBoundingClientRect();
      const context = canvas.getContext('2d');
      const column = c.columnModel.columns.find((item) =>
        item.kind === (presentation === 'pane' ? 'inspectorPane' : 'inspectorValue')
      );
      const dpr = canvas.width / c.viewport.viewportWidth;
      const valuePoint = (name) => {
        const row = c.rowModel.getRowById(`model:${name}`);
        const cell = c.getCellClientRect({ area: 'row', part: 'editor', row, column });
        const editorLeft = presentation === 'pane'
          ? c.getInspectorPaneLayout(cell.width, row, 'number').editorLeft
          : 0;
        return {
          x: cell.x - canvasBox.left + editorLeft + 40,
          y: cell.y - canvasBox.top + 5,
          row
        };
      };
      const hasFrame = ({ x, y }) => {
        const top = context.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data;
        const above = context.getImageData(Math.floor(x * dpr), Math.floor((y - 2) * dpr), 1, 1).data;
        return Array.from(top).some((channel, index) => channel !== above[index]);
      };
      const altitude = valuePoint('altitude');
      const acceleration = valuePoint('acceleration');
      same(hasFrame(altitude), true, 'filled editable value has a frame');
      same(hasFrame(acceleration), false, 'read-only value has no frame');
      const hover = (point) => canvas.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        clientX: canvasBox.left + point.x,
        clientY: canvasBox.top + point.y + 8
      }));
      hover(altitude);
      same(canvas.style.cursor, 'text', 'editable cursor');
      hover(acceleration);
      same(canvas.style.cursor, '', 'read-only cursor');
      const hit = c.hitTest(acceleration.x, acceleration.y + 8);
      same(c.cellEditor.handlePointerDown({}, hit), false, 'read-only editor does not open');
      a.configure({ editable: false });
      await wait();
      c.render();
      same(hasFrame(altitude), false, 'global read-only mode removes the frame');
    });
  await check('same reference data and model refresh explicitly', async (a) => {
    const nodes = [
      {
        id: 'x'
      }
    ];
    a.widget.setData(nodes);
    nodes.push({
      id: 'y'
    });
    a.widget.setData(nodes);
    same(a.widget.getRowOrder(), ['x', 'y'], 'mutated array');
    const model = {
      speed: 1
    };
    a.widget.setModel(model);
    model.speed = 2;
    a.widget.setModel(model);
    same(a.widget.controller.model.index.getNode('model:speed').data.value, 2, 'mutated object');
  });
  await check('filter input follows direct controller calls', async (a) => {
    a.widget.setFilter('Alpha', {
      caseSensitive: true
    });
    a.widget.controller.clearFilter();
    await wait();
    same(a.root.querySelector('.vtc-filter input').value, '', 'input');
    same(
      a.root.querySelector('[aria-label="Match case"]').getAttribute('aria-pressed'),
      'false',
      'button'
    );
  });
  await check(
    'units, precision, silent writes and user events work without host effects',
    async (a) => {
      const w = a.widget,
        events = [],
        nodeClicks = [];
      const stop = a.subscribe('valuechange', (e) => events.push(e.detail));
      const stopClicks = a.subscribe('nodeclick', (e) => nodeClicks.push(e.detail));
      for (const presentation of ['pane', 'table']) {
        a.configure({
          presentation,
          mode: 'inspector',
          editable: true
        });
        const model = {
          speed: 125.45678
        };
        w.setModel(model, {
          speed: {
            unit: 'm/s',
            precision: 2,
            min: 0,
            max: 300
          }
        });
        await wait();
        const c = w.controller;
        a.silentWrite('speed', 127.123456);
        same(events.length, presentation === 'pane' ? 0 : 1, 'silent API write');
        same(model.speed, 127.123456, 'stored precision');
        same(c.model.index.getNode('model:speed').data.valueText, '127.12', 'display precision');
        const column = c.columnModel.columns.find((col) =>
          ['inspectorPane', 'inspectorValue'].includes(col.kind)
        );
        const canvasRect = c.canvas.getBoundingClientRect();
        c.canvas.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          clientX: canvasRect.left + column.x + column.width - 12,
          clientY: canvasRect.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2
        }));
        same(nodeClicks.at(-1).part, 'unit', 'unit click part');
        same(nodeClicks.at(-1).columnId, column.id, 'unit click column');
        const hit = c.hitTest(
          column.x + column.width - 60,
          c.viewport.headerHeight + c.rowModel.rowHeight / 2
        );
        same(c.cellEditor.handlePointerDown({}, hit), true, 'editor opens');
        let input = c.cellEditor.overlay;
        same(input.value, '127.123456', 'editor precision');
        same(input.getAttribute('aria-label').includes('m/s'), true, 'accessible units');
        const rect = c.canvas.getBoundingClientRect();
        same(
          input.getBoundingClientRect().right < rect.left + column.x + column.width - 20,
          true,
          'unit remains outside editor'
        );
        input.value = '999';
        input.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape'
          })
        );
        same(model.speed, 127.123456, 'Escape cancels without blur commit');
        c.cellEditor.handlePointerDown({}, hit);
        c.closeEditor();
        same(c.cellEditor.overlay, null, 'controller closes editor');
        c.cellEditor.handlePointerDown({}, hit);
        input = c.cellEditor.overlay;
        input.value = '130.98765';
        input.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Enter'
          })
        );
        same(model.speed, 130.98765, 'user edit stored');
      }
      same(events.length, 2, 'one value event per edit');
      stop();
      stopClicks();
    }
  );
  await check('header filter works in readonly tables and remains open while typing', async (a) => {
    a.configure({
      presentation: 'table',
      editable: false
    });
    a.widget.setModel({
      speed: 1,
      altitude: 2
    });
    await wait();
    const c = a.widget.controller,
      column = c.columnModel.columns[0];
    const hit = c.hitTest(column.x + 30, c.viewport.headerHeight / 2);
    same(hit.part, 'filter', 'header hit');
    c.cellEditor.handleHeaderClick({}, hit);
    const input = c.cellEditor.overlay;
    for (const query of ['s', 'sp', 'speed']) {
      input.value = query;
      input.dispatchEvent(new Event('input'));
      await wait();
      same(c.cellEditor.overlay === input, true, 'same filter editor');
      same(c.filterQuery, query, 'filter applied');
    }
    c.clearFilter();
    same(input.value, '', 'external clear reflected');
    c.closeEditor();
    same(c.cellEditor.overlay, null, 'filter closes');
  });
  await check('search and selection delegation remain usable', async (a) => {
    a.widget.search('Bravo');
    same(a.widget.getSearchState().count, 1, 'search count');
    a.widget.nextSearchResult();
    a.widget.focusNode('b', {
      select: true
    });
    same(a.widget.getSelection(), ['b'], 'focus and select');
    a.widget.clearSearch();
    same(a.widget.getSearchState().count, 0, 'clear search');
  });
  await check('queued configuration and listeners are disposed', async (a) => {
    const c = a.widget.controller,
      button = a.root.querySelector('[aria-label="Match case"]');
    a.configure({
      editable: false
    });
    await a.destroy();
    await wait();
    same(c.canvas, null, 'canvas disposed');
    same(c.renderFrame, null, 'frame cancelled');
    const filter = c.filterOptions.caseSensitive;
    button.click();
    same(c.filterOptions.caseSensitive, filter, 'detached listener removed');
  });
  return results;
}
