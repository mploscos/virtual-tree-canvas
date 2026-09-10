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
  for (const presentation of ['pane', 'table']) await check(`editors survive live refreshes (${presentation})`, async a => {
    const w = a.widget;
    const meta = { level: {min:0,max:100,step:1}, mode: {options:{One:1,Two:2}} };
    a.configure({mode:'inspector',presentation,model:{level:20,mode:1},meta,rowReorder:false,rowDrag:node=>({id:node.id})});
    await wait();
    const c = w.controller;
    const stop = c.on('valuechange', e => w.setModel({...e.detail.model}, structuredClone(meta)));
    const point = (path, part, fraction = .5) => {
      const box = c.canvas.getBoundingClientRect();
      const row = c.rowModel.rows.find(row => c.model.nodes[row.nodeIndex].data.path === path);
      const y = c.viewport.renderInsetY + c.viewport.headerHeight + row.y - c.viewport.scrollY + row.height / 2;
      const xs = [];
      for (let x=0;x<c.viewport.contentViewportWidth;x++) if(c.hitTest(x,y)?.part===part && c.hitTest(x,y)?.row===row) xs.push(x);
      if (!xs.length) throw Error(`Missing ${path} ${part}`);
      return {x:box.left+xs[Math.floor((xs.length-1)*fraction)],y:box.top+y};
    };
    const mouse = (type, p, buttons=0) => window.testMouse({type,...p,button:'left',buttons,clickCount:1});
    await mouse('mousePressed',point('level','range',.2),1);
    const initial=c.inspector.model.level;
    await wait();
    await mouse('mouseMoved',point('level','range',.8),1);
    same(c.inspector.model.level>initial,true,'range continues after model refresh');
    await mouse('mouseReleased',point('level','range',.8));
    const p=point('level','number');
    await mouse('mousePressed',p,1); await mouse('mouseReleased',p);
    const input=c.cellEditor.overlay;
    same(!!input,true,'numeric input remains open after click');
    same(input.matches(':focus'),true,'numeric input keeps focus');
    input.value='37';
    w.setModel({...c.inspector.model,level:60},structuredClone(meta));await wait();
    same(c.cellEditor.overlay===input,true,'same input after incoming value');
    same(input.value,'37','draft remains untouched');
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    same(c.inspector.model.level,37,'typed value commits');
    const selectPoint=point('mode','editor');
    await mouse('mousePressed',selectPoint,1); await mouse('mouseReleased',selectPoint);
    const select=c.cellEditor.overlay;
    same(select?.tagName,'SELECT','select opens');
    for(let i=0;i<3;i++){w.setModel({...c.inspector.model,level:i},structuredClone(meta));await wait();}
    same(c.cellEditor.overlay===select,true,'select survives repeated live updates');
    select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}));
    same(c.inspector.model.mode,2,'selection commits after refreshes');
    await mouse('mousePressed',point('level','number'),1);await mouse('mouseReleased',point('level','number'));
    w.setModel({...c.inspector.model},{...meta,level:{...meta.level,readonly:true}});
    same(c.cellEditor.overlay,null,'readonly changes cancel editing');
    stop();
  });
  await check('flat lists reclaim chevron space and trees keep sibling alignment', async a => {
    const w=a.widget;
    a.configure({rowReorder:false});
    w.setColumns([{id:'name',kind:'tree',width:400}]); await wait();
    const c=w.controller, y=c.viewport.renderInsetY+c.viewport.headerHeight+c.rowModel.rowHeight/2;
    same(c.hitTest(12,y).part,'icon','flat-list icon occupies the former bullet space');
    same(c.hitTest(32,y).part,'label','flat-list label starts earlier');
    const ctx=c.renderer.ctx, arc=ctx.arc; let bullets=0;
    try {
      ctx.arc=function(x,y,r,...args){if(r===1.5)bullets++;return arc.call(this,x,y,r,...args);};
      c.render();
    } finally {ctx.arc=arc;}
    same(bullets,0,'leaf bullets are not drawn');
    w.setData([{id:'branch',label:'Branch'},{id:'child',parentId:'branch',label:'Child'},{id:'leaf',label:'Leaf'}]);
    await wait();
    same(c.hitTest(10,y).part,'chevron','branch still expands');
    const leaf=c.rowModel.getRowById('leaf');
    const leafY=c.viewport.renderInsetY+c.viewport.headerHeight+leaf.y+leaf.height/2;
    same(c.hitTest(34,leafY).part,'icon','leaf icon aligns with its branch sibling');
    same(c.hitTest(10,leafY).part,'cell','leaf has no expansion target');
  });
  await check('header visibility preserves its height and keeps filtering available', async a => {
    a.configure({headerHeight:36,showHeader:false,filter:true});await wait();
    const c=a.widget.controller;
    same(c.viewport.headerHeight,0,'header hidden');
    same(a.root.querySelector('.vtc-filter').hidden,false,'filter remains available');
    a.widget.setSelection(['b']);
    a.configure({showHeader:true});await wait();
    same(c.viewport.headerHeight,36,'configured height restored');
    same(a.widget.getSelection(),['b'],'selection preserved');
  });
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
    const scrollY = window.scrollY, parentScroll = a.root.parentElement?.scrollTop;
    const events = []; const stop = a.subscribe('rowreorder', e => events.push(e.detail));
    await window.testMouse({type:'mousePressed', x, y, button:'left', clickCount:1});
    const destination = y + c.rowModel.rowHeight * 2 + 8;
    await window.testMouse({type:'mouseMoved', x, y:destination, button:'left', buttons:1});
    await window.testMouse({type:'mouseReleased', x, y:destination, button:'left', clickCount:1});
    same(window.scrollY, scrollY, 'page remains stationary');
    same(a.root.parentElement?.scrollTop, parentScroll, 'parent remains stationary');
    same(w.getRowOrder(), ['b','c','a'], 'drag order');
    same(events.length, 1, 'one drag event'); same(events[0].source, 'pointer', 'pointer source');
    c.canvas.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp',altKey:true,bubbles:true,cancelable:true}));
    same(w.getRowOrder(), ['b','a','c'], 'keyboard order');
    same(events.length, 2, 'one keyboard event'); same(events[1].source, 'keyboard', 'keyboard source');
    stop();
  });
  await check('checkbox actions are independent of row selection and dragging', async a => {
    const checked=new Set(), events=[];
    a.configure({rowActions:[{id:'enabled',kind:'checkbox',label:'Enabled',checked:node=>checked.has(node.id),disabled:node=>node.id==='c'}],rowDrag:node=>({id:node.id})});
    await wait();const c=a.widget.controller;
    a.subscribe('rowaction', event=>{events.push(event.detail);if(event.detail.checked)checked.add(event.detail.nodeId);else checked.delete(event.detail.nodeId);c.requestRender();});
    const input=a.root.querySelector('[role=checkbox][data-node-id="a"]'), box=input.getBoundingClientRect();
    await window.testMouse({type:'mousePressed',x:box.x+box.width/2,y:box.y+box.height/2,button:'left',clickCount:1});
    await window.testMouse({type:'mouseReleased',x:box.x+box.width/2,y:box.y+box.height/2,button:'left',clickCount:1});
    await wait();same(events.length,1,'one action');same(events[0].checked,true,'checked value');same(input.getAttribute('aria-checked'),'true','checkbox reflects state');
    same(c.getSelection(),[],'row is not selected');same(c.rowReorderInput.gesture,null,'no drag gesture');
    input.click();await wait();same(events[1].checked,false,'unchecking emits false');
    a.root.querySelector('[role=checkbox][data-node-id="c"]').click();same(events.length,2,'disabled checkbox ignores clicks');
  });
  await check('row actions preserve selection, focus and dynamic state', async a => {
    let selected = false;
    a.configure({ rowActions: [{id:'favorite',preloadIcons:['star','star-filled'],icon:()=>selected?'star-filled':'star',label:'Favorite',visible: n => n.id !== 'c',disabled:n => n.id === 'b',pressed:()=>selected}] });
    await wait();
    const c = a.widget.controller;
    for (let i=0;i<30 && c.iconRegistry.get('star-filled').rasters.size<2;i++) await wait();
    same(c.iconRegistry.get('star-filled').rasters.size>=2,true,'both action colors prepared before the first toggle');
    const button = a.root.querySelector('[data-action="favorite"][data-node-id="a"]');
    same(!!button, true, 'visible row button');
    same(a.root.querySelector('[data-node-id="b"]').disabled, true, 'disabled action');
    same(a.root.querySelector('[data-node-id="c"]'), null, 'hidden action');
    const events = []; a.subscribe('rowaction', e => {events.push(e.detail);selected = true;c.requestRender();});
    button.focus({preventScroll:true}); button.click();
    a.widget.setDynamicState([{id:'a',state:{value:2}}]); await wait();
    same(events.length, 1, 'one action'); same(events[0].nodeId,'a','action identifies row');
    same(a.widget.getSelection(), [], 'action does not require selection');
    same(a.root.querySelector('[data-node-id="a"]') === button,true,'button retained during updates');
    same(button.getAttribute('aria-pressed'),'true','pressed state');
    a.configure({rowActions:[]}); await wait();
    same(a.root.querySelector('[data-action]'),null,'removed actions');
  });
  await check('right-side actions include partial rows and checkboxes share the value column', async a => {
    a.configure({ mode:'inspector',rowReorder:false,rowActions:[{id:'favorite',label:'Favorite',icon:'star'}] });
    a.widget.setModel({speed:12,enabled:true,mode:'Auto',altitude:34},{mode:{options:['Auto','Manual']}});
    await wait();
    const c = a.widget.controller;
    const column = c.columnModel.columns.find(col => col.kind === 'inspectorPane');
    same(c.columnModel.columns.at(-1).id,'__vtc_actions','actions on the right');
    const number = c.getInspectorPaneLayout(column.width,c.rowModel.rows[0],'number');
    const checkbox = c.getInspectorPaneLayout(column.width,c.rowModel.rows[1],'checkbox');
    const select = c.getInspectorPaneLayout(column.width,c.rowModel.rows[2],'select');
    same(checkbox.editorLeft,number.editorLeft,'checkbox and numeric alignment');
    same(checkbox.editorLeft,select.editorLeft,'checkbox and select alignment');
    c.resize(700,c.viewport.headerHeight+c.rowModel.rowHeight*3+20); c.render();
    const last = a.root.querySelector('[data-node-id="model:altitude"]');
    same(!!last,true,'action retained on partially visible final row');
    const right = last.getBoundingClientRect().right - c.canvas.getBoundingClientRect().left;
    same(Math.abs(right - (c.viewport.renderInsetX+c.viewport.contentViewportWidth-1))<2,true,'actions pinned to visible right edge');
  });
  await check('actions preserve row selection and use screen-resolution icons after resize', async a => {
    a.configure({rowActions:[{id:'favorite',label:'Favorite',icon:'star'}],rowReorder:false});await wait();
    const c=a.widget.controller;
    a.widget.setSelection(['b']);c.render();
    const checkSelection=()=>{
      const dpr=c.canvas.width/c.viewport.viewportWidth;
      const row=c.rowModel.getRowById('b');
      const y=Math.floor((c.viewport.headerHeight+row.y-c.viewport.scrollY+row.height/2)*dpr);
      const ctx=c.canvas.getContext('2d');
      const left=Array.from(ctx.getImageData(Math.floor(5*dpr),y,1,1).data);
      const right=Array.from(ctx.getImageData(Math.floor((c.viewport.contentViewportWidth-8)*dpr),y,1,1).data);
      same(right,left,'selection continues beneath actions');
      const button=a.root.querySelector('[data-action="favorite"]');
      same(getComputedStyle(button.parentElement).backgroundColor,'rgba(0, 0, 0, 0)','overlay is transparent');
      const icon=button.querySelector('canvas');
      same(icon.width,Math.round(16*(window.devicePixelRatio||1)),'icon backing resolution');
      same(icon.getBoundingClientRect().width,16,'icon display size');
    };
    checkSelection();
    c.resize(600,240);c.render();checkSelection();
    c.resize(850,300);c.render();checkSelection();
    const original=Object.getOwnPropertyDescriptor(window,'devicePixelRatio');
    try {Object.defineProperty(window,'devicePixelRatio',{configurable:true,value:2});c.render();checkSelection();}
    finally {if(original)Object.defineProperty(window,'devicePixelRatio',original);else delete window.devicePixelRatio;}
  });
  await check('external dragging works with sorting and leaves row order intact', async a => {
    a.configure({rowDrag: node => ({id:node.id})}); await wait();
    const c = a.widget.controller, events = [];
    for (const type of ['rowdragstart','rowdragmove','rowdragend','rowdragcancel']) c.on(type, e => events.push(e));
    c.sortBy('name','desc'); await wait();
    const box = c.canvas.getBoundingClientRect(), x = box.left + 125, y = box.top + c.viewport.headerHeight + c.rowModel.rowHeight / 2;
    await window.testMouse({type:'mousePressed',x,y,button:'left',clickCount:1});
    await window.testMouse({type:'mouseMoved',x:x+30,y:y+5,button:'left',buttons:1});
    await window.testMouse({type:'mouseReleased',x:x+30,y:y+5,button:'left',clickCount:1});
    same(events.map(e=>e.type),['rowdragstart','rowdragmove','rowdragend'],'drag lifecycle');
    same(events[0].detail.payload,{id:'c'},'sorted row payload');
    same(a.widget.getRowOrder(),['a','b','c'],'manual order unchanged');
    same(a.widget.getSelection(),[],'drag does not generate a click');
    await window.testMouse({type:'mousePressed',x,y,button:'left',clickCount:1});
    await window.testMouse({type:'mouseMoved',x:x+30,y:y+5,button:'left',buttons:1});
    c.canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await window.testMouse({type:'mouseReleased',x:x+30,y:y+5,button:'left',clickCount:1});
    same(events.at(-1).type,'rowdragcancel','Escape cancels');
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
