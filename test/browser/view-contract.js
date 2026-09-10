const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const same = (actual, expected, message) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`); };

/** The same user-visible contract runs against TreeView and the DEP adapter. */
export async function runViewContract(create) {
  const results = [];
  async function check(name, action) {
    const a = await create();
    try { await action(a); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: error.stack }); }
    finally { await a.destroy(); }
  }
  await check('editing toggle preserves state and filter listeners run once', async a => {
    const w = a.widget, c = w.controller;
    w.moveRow('a', 2); w.setSelection(['b']);
    w.setDynamicState([{ id: 'b', state: { value: 42 } }]);
    c.registerIcon('custom', '<svg xmlns="http://www.w3.org/2000/svg"/>');
    a.configure({ editable: false }); await wait();
    same(w.controller === c, true, 'controller identity');
    same(w.getRowOrder(), ['b', 'c', 'a'], 'order');
    same(w.getSelection(), ['b'], 'selection');
    same(c.model.dynamicState.get('b').value, 42, 'live value');
    same(c.iconRegistry.icons.has('custom'), true, 'custom icon');
    let calls = 0; const original = c.setFilter.bind(c);
    c.setFilter = (...args) => { calls++; return original(...args); };
    a.root.querySelector('[aria-label="Match case"]').click();
    same(calls, 1, 'one filter call'); same(c.filterOptions.caseSensitive, true, 'case enabled');
    a.configure({ editable: true }); await wait();
    same(w.controller === c, true, 'same editor owner after enabling');
    a.root.querySelector('[aria-label="Match case"]').click();
    same(calls, 2, 'one more filter call'); same(c.filterOptions.caseSensitive, false, 'case disabled');
  });
  await check('filter visibility and icon resolver preserve manual order', async a => {
    a.widget.moveRow('a', 2);
    a.configure({ filter: false }); await wait();
    same(a.widget.getRowOrder(), ['b', 'c', 'a'], 'order after hiding filter');
    same(a.root.querySelector('.vtc-filter').hidden, true, 'hidden');
    a.configure({ filter: true, iconResolver: () => 'person' }); await wait();
    same(a.widget.getRowOrder(), ['b', 'c', 'a'], 'order after changing icons');
    same(a.widget.controller.model.index.getNode('a').icon, 'person', 'icon resolver');
  });
  await check('real pointer dragging and keyboard ordering use the mounted canvas', async a => {
    await wait();
    const w = a.widget, c = w.controller, box = c.canvas.getBoundingClientRect();
    const x = box.left + 12, y = box.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    const events = []; const stop = a.subscribe('rowreorder', e => events.push(e.detail));
    await window.testMouse({type:'mousePressed', x, y, button:'left', clickCount:1});
    const destination = y + c.rowModel.rowHeight * 2 + 8;
    await window.testMouse({type:'mouseMoved', x, y:destination, button:'left', buttons:1});
    await window.testMouse({type:'mouseReleased', x, y:destination, button:'left', clickCount:1});
    same(w.getRowOrder(), ['b','c','a'], 'drag order');
    same(events.length, 1, 'one drag event'); same(events[0].source, 'pointer', 'pointer source');
    c.canvas.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp',altKey:true,bubbles:true,cancelable:true}));
    same(w.getRowOrder(), ['b','a','c'], 'keyboard order');
    same(events.length, 2, 'one keyboard event'); same(events[1].source, 'keyboard', 'keyboard source');
    stop();
  });
  await check('mode, expansion depth and column reset synchronize', async a => {
    a.configure({ mode: 'inspector', model: { child: { value: 1 } }, initialExpandDepth: 0 }); await wait();
    same(!!a.widget.controller.inspector, true, 'inspector mode');
    same(a.widget.controller.initialExpandDepth, 0, 'depth');
    same(a.widget.controller.model.expanded.has('model:child'), false, 'initial collapsed');
    a.configure({ mode: 'tree' }); await wait();
    same(a.widget.controller.inspector, null, 'tree mode');
    a.widget.setColumns([{ id: 'custom' }]); a.configure({ columns: null }); await wait();
    same(a.widget.controller.columnModel.columns.map(c => c.id), ['__vtc_row_order', 'name'], 'default columns');
  });
  await check('theme applies once without changing explicit layout', async a => {
    a.configure({ rowHeight: 36, indentWidth: 24 }); await wait();
    const c = a.widget.controller; let calls = 0; const original = c.setTheme.bind(c);
    c.setTheme = (...args) => { calls++; return original(...args); };
    a.widget.setTheme('light'); await wait();
    same(calls, 1, 'theme calls'); same(c.rowModel.rowHeight, 36, 'row height'); same(c.rowModel.indentWidth, 24, 'indent');
  });
  await check('same reference data and model refresh explicitly', async a => {
    const nodes = [{ id: 'x' }]; a.widget.setData(nodes); nodes.push({ id: 'y' }); a.widget.setData(nodes);
    same(a.widget.getRowOrder(), ['x', 'y'], 'mutated array');
    const model = { speed: 1 }; a.widget.setModel(model); model.speed = 2; a.widget.setModel(model);
    same(a.widget.controller.model.index.getNode('model:speed').data.value, 2, 'mutated object');
  });
  await check('filter input follows direct controller calls', async a => {
    a.widget.setFilter('Alpha', { caseSensitive: true }); a.widget.controller.clearFilter(); await wait();
    same(a.root.querySelector('.vtc-filter input').value, '', 'input');
    same(a.root.querySelector('[aria-label="Match case"]').getAttribute('aria-pressed'), 'false', 'button');
  });
  await check('units, precision, silent writes and user events work without host effects', async a => {
    const w = a.widget, events = []; const stop = a.subscribe('valuechange', e => events.push(e.detail));
    for (const presentation of ['pane', 'table']) {
      a.configure({ presentation, mode: 'inspector', editable: true });
      const model = { speed: 125.45678 };
      w.setModel(model, { speed: { unit: 'm/s', precision: 2, min: 0, max: 300 } });
      await wait();
      const c = w.controller;
      a.silentWrite('speed', 127.123456);
      same(events.length, presentation === 'pane' ? 0 : 1, 'silent API write');
      same(model.speed, 127.123456, 'stored precision');
      same(c.model.index.getNode('model:speed').data.valueText, '127.12', 'display precision');
      const column = c.columnModel.columns.find(col => ['inspectorPane', 'inspectorValue'].includes(col.kind));
      const hit = c.hitTest(column.x + column.width - 60, c.viewport.headerHeight + c.rowModel.rowHeight / 2);
      same(c.cellEditor.handlePointerDown({}, hit), true, 'editor opens');
      let input = c.cellEditor.overlay;
      same(input.value, '127.123456', 'editor precision');
      same(input.getAttribute('aria-label').includes('m/s'), true, 'accessible units');
      const rect = c.canvas.getBoundingClientRect();
      same(input.getBoundingClientRect().right < rect.left + column.x + column.width - 20, true, 'unit remains outside editor');
      input.value = '999';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      same(model.speed, 127.123456, 'Escape cancels without blur commit');
      c.cellEditor.handlePointerDown({}, hit);
      c.closeEditor(); same(c.cellEditor.overlay, null, 'controller closes editor');
      c.cellEditor.handlePointerDown({}, hit); input = c.cellEditor.overlay;
      input.value = '130.98765'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      same(model.speed, 130.98765, 'user edit stored');
    }
    same(events.length, 2, 'one value event per edit'); stop();
  });
  await check('header filter works in readonly tables and remains open while typing', async a => {
    a.configure({ presentation: 'table', editable: false });
    a.widget.setModel({ speed: 1, altitude: 2 }); await wait();
    const c = a.widget.controller, column = c.columnModel.columns[0];
    const hit = c.hitTest(column.x + 30, c.viewport.headerHeight / 2);
    same(hit.part, 'filter', 'header hit');
    c.cellEditor.handleHeaderClick({}, hit);
    const input = c.cellEditor.overlay;
    for (const query of ['s', 'sp', 'speed']) {
      input.value = query; input.dispatchEvent(new Event('input')); await wait();
      same(c.cellEditor.overlay === input, true, 'same filter editor');
      same(c.filterQuery, query, 'filter applied');
    }
    c.clearFilter(); same(input.value, '', 'external clear reflected');
    c.closeEditor(); same(c.cellEditor.overlay, null, 'filter closes');
  });
  await check('search and selection delegation remain usable', async a => {
    a.widget.search('Bravo');
    same(a.widget.getSearchState().count, 1, 'search count');
    a.widget.nextSearchResult(); a.widget.focusNode('b', { select: true });
    same(a.widget.getSelection(), ['b'], 'focus and select');
    a.widget.clearSearch(); same(a.widget.getSearchState().count, 0, 'clear search');
  });
  await check('queued configuration and listeners are disposed', async a => {
    const c = a.widget.controller, button = a.root.querySelector('[aria-label="Match case"]');
    a.configure({ editable: false }); await a.destroy(); await wait();
    same(c.canvas, null, 'canvas disposed'); same(c.renderFrame, null, 'frame cancelled');
    const filter = c.filterOptions.caseSensitive; button.click(); same(c.filterOptions.caseSensitive, filter, 'detached listener removed');
  });
  return results;
}
