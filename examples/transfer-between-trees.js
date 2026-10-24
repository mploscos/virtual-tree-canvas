import { TreeView } from '../src/index.js';
import { moveTreeNodes } from './transfer-between-trees-data.js';

const initial = {
  a: [
    { id: 'projects', label: 'Projects', icon: 'folder' },
    { id: 'design', parentId: 'projects', label: 'Design', icon: 'folder' },
    { id: 'wireframes', parentId: 'design', label: 'Wireframes', icon: 'file' },
    { id: 'components', parentId: 'design', label: 'Components', icon: 'file' },
    { id: 'engineering', parentId: 'projects', label: 'Engineering', icon: 'folder' },
    { id: 'api', parentId: 'engineering', label: 'API contract', icon: 'file' },
    { id: 'tests', parentId: 'engineering', label: 'Tests', icon: 'file' },
    { id: 'roadmap', parentId: 'projects', label: 'Roadmap', icon: 'file' }
  ],
  b: [
    { id: 'archive', label: 'Archive', icon: 'folder' },
    { id: 'release', parentId: 'archive', label: 'Version 0.7', icon: 'folder' },
    { id: 'notes', parentId: 'release', label: 'Release notes', icon: 'file' },
    { id: 'assets', parentId: 'archive', label: 'Legacy assets', icon: 'folder' },
    { id: 'illustrations', parentId: 'assets', label: 'Illustrations', icon: 'file' },
    { id: 'ideas', parentId: 'archive', label: 'Pending ideas', icon: 'file' }
  ]
};
const roots = { a: 'projects', b: 'archive' };
const names = { a: 'Projects', b: 'Archive' };
const panes = {
  a: document.querySelector('#pane-a'),
  b: document.querySelector('#pane-b')
};
const status = document.querySelector('#status');
let nodes = { a: initial.a.map((node) => ({ ...node })), b: initial.b.map((node) => ({ ...node })) };
let drag = null;

const theme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const views = {};
for (const key of ['a', 'b']) views[key] = new TreeView(
  document.querySelector(`#tree-${key}`), {
    theme: theme(),
    editable: false,
    multiSelect: true,
    filter: false,
    initialExpandDepth: 2,
    rowDrag: (node) => node.id === roots[key] ? null : { nodeId: node.id, tree: key }
  }
);

function updateCounts() {
  for (const key of ['a', 'b'])
    document.querySelector(`#count-${key}`).textContent = `${nodes[key].length - 1} nodes`;
}

function clearDrag() {
  drag = null;
  for (const pane of Object.values(panes)) {
    pane.classList.remove('is-drop-target');
    pane.querySelector('.drop-marker').hidden = true;
  }
}

function dropAt(event, source, ids) {
  if (!event) return null;
  for (const key of ['a', 'b']) {
    const pane = panes[key];
    const paneRect = pane.getBoundingClientRect();
    if (event.clientX < paneRect.left || event.clientX > paneRect.right ||
        event.clientY < paneRect.top || event.clientY > paneRect.bottom) continue;

    const controller = views[key].controller;
    const canvasRect = controller.canvas.getBoundingClientRect();
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;
    const hit = x >= 0 && y >= 0 && x <= canvasRect.width && y <= canvasRect.height
      ? controller.hitTest(x, y)
      : null;
    let drop = { nodeId: roots[key], position: 'inside' };
    let marker = null;
    if (hit?.area === 'row') {
      const node = nodes[key].find((item) => item.id === hit.row.nodeId);
      const rowTop = canvasRect.top - paneRect.top + controller.viewport.renderInsetY +
        controller.viewport.headerHeight + (hit.row.stickyY ?? hit.row.y - controller.viewport.scrollY);
      const fraction = (event.clientY - (paneRect.top + rowTop)) / hit.row.height;
      const folder = node.id === roots[key] || node.icon === 'folder';
      const position = node.id === roots[key] ? 'inside'
        : folder && fraction >= 0.3 && fraction <= 0.7 ? 'inside'
          : fraction < 0.5 ? 'before' : 'after';
      drop = { nodeId: node.id, position };
      marker = { top: rowTop, height: hit.row.height, position };
    }
    try {
      if (!moveTreeNodes(nodes[source], nodes[key], ids, drop)) return null;
    } catch {
      return null;
    }
    const label = nodes[key].find((item) => item.id === drop.nodeId)?.label ?? names[key];
    const action = drop.position === 'inside' ? `inside ${label}`
      : drop.position === 'before' ? `before ${label}` : `after ${label}`;
    return { key, drop, marker, action };
  }
  return null;
}

function showDrop(preview) {
  for (const [key, pane] of Object.entries(panes)) {
    pane.classList.toggle('is-drop-target', key === preview?.key);
    const marker = pane.querySelector('.drop-marker');
    marker.hidden = key !== preview?.key || !preview.marker;
    if (marker.hidden) continue;
    marker.classList.toggle('is-inside', preview.marker.position === 'inside');
    marker.style.top = `${preview.marker.top + (preview.marker.position === 'after' ? preview.marker.height : 0)}px`;
    marker.style.height = preview.marker.position === 'inside' ? `${preview.marker.height}px` : '2px';
  }
  if (preview) panes[preview.key].querySelector('.drop-hint').textContent =
    preview.action[0].toUpperCase() + preview.action.slice(1);
}

function transfer(source, preview, ids) {
  const target = preview.key;
  let result;
  try {
    result = moveTreeNodes(nodes[source], nodes[target], ids, preview.drop);
  } catch (error) {
    status.textContent = `Could not move nodes: ${error.message}`;
    return;
  }
  if (!result) return;
  nodes[source] = result.sourceNodes;
  nodes[target] = result.targetNodes;
  if (source !== target) views[source].setData(nodes[source]);
  views[target].setData(nodes[target]);
  if (source !== target) views[source].clearSelection();
  if (preview.drop.position === 'inside') views[target].controller.expand(preview.drop.nodeId);
  views[target].setSelection(result.movedRootIds);
  updateCounts();
  const branches = result.movedRootIds.length;
  status.textContent = `Moved ${branches} ${branches === 1 ? 'branch' : 'branches'} ${preview.action} (${result.movedCount} ${result.movedCount === 1 ? 'node' : 'nodes'}).`;
}

for (const key of ['a', 'b']) {
  views[key].setData(nodes[key]);
  views[key].on('rowdragstart', ({ detail }) => {
    drag = { source: key, ids: detail.nodeIds };
    status.textContent = `Dragging ${detail.count} ${detail.count === 1 ? 'row' : 'rows'} from ${names[key]}. Drop on a row or empty space in either tree.`;
  });
  views[key].on('rowdragmove', ({ detail }) => {
    if (drag?.source !== key) return;
    const preview = dropAt(detail.originalEvent, key, drag.ids);
    showDrop(preview);
  });
  views[key].on('rowdragend', ({ detail }) => {
    if (drag?.source !== key) return;
    const preview = dropAt(detail.originalEvent, key, drag.ids);
    const ids = drag.ids;
    clearDrag();
    if (!preview) {
      status.textContent = 'No change: drop before or after another row, inside a folder, or in empty space.';
      return;
    }
    // Let the input controller finish releasing pointer capture before setData removes rows.
    queueMicrotask(() => transfer(key, preview, ids));
  });
  views[key].on('rowdragcancel', () => {
    if (drag?.source !== key) return;
    clearDrag();
    status.textContent = 'Drag cancelled.';
  });
}
updateCounts();

document.querySelector('#reset')?.addEventListener('click', () => {
  clearDrag();
  nodes = { a: initial.a.map((node) => ({ ...node })), b: initial.b.map((node) => ({ ...node })) };
  for (const key of ['a', 'b']) {
    views[key].setData(nodes[key]);
    views[key].clearSelection();
  }
  updateCounts();
  status.textContent = 'Example reset. Select several rows and drop them in either tree.';
});

const syncTheme = () => {
  for (const view of Object.values(views)) view.setTheme(theme());
};
window.addEventListener('site-theme-change', syncTheme);
const redrawViews = () => {
  if (document.hidden) return;
  for (const view of Object.values(views)) view.controller.requestRender(true);
};
const onPageShow = (event) => {
  if (event.persisted) redrawViews();
};
document.addEventListener('visibilitychange', redrawViews);
window.addEventListener('pageshow', onPageShow);
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  document.removeEventListener('visibilitychange', redrawViews);
  window.removeEventListener('pageshow', onPageShow);
  window.removeEventListener('site-theme-change', syncTheme);
  for (const view of Object.values(views)) view.destroy();
});
