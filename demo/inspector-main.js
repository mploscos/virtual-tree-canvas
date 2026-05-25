import { CellEditorManager, themes, TreeRowRenderer, TreeViewController } from '../src/index.js';
import { TreeViewInputController } from '../src/input/index.js';

const canvas = document.querySelector('#tree');
const json = document.querySelector('#json');
const message = document.querySelector('#message');
const focusRange = document.querySelector('#focus-range');
const modeSelect = document.querySelector('#mode');

const model = {
  sensor: {
    enabled: true,
    name: 'Forward radar',
    range: 72,
    gain: 0.64,
    color: '#38bdf8',
    mode: 'track',
  },
  tracks: [
    { id: 'T-100', speed: 430, quality: 0.82, active: true },
    { id: 'T-101', speed: 285, quality: 0.55, active: false },
  ],
  actions: {
    calibrate: null,
  },
};

const meta = {
  'sensor.enabled': { description: 'Toggle sensor state' },
  'sensor.name': { description: 'Sensor display name' },
  'sensor.range': { min: 0, max: 120, step: 1, integer: true, description: 'Maximum range in km' },
  'sensor.gain': { min: 0, max: 1, step: 0.01, description: 'Signal gain' },
  'sensor.color': { color: true, description: 'Display color' },
  'sensor.mode': { options: { Search: 'search', Track: 'track', Standby: 'standby' } },
  tracks: { itemFactory: () => ({ id: `T-${100 + model.tracks.length}`, speed: 0, quality: 0.5, active: false }) },
  'tracks.*': { itemTitle: (i, item) => item.id || `Track ${i}` },
  'tracks.*.speed': { min: 0, max: 900, step: 5, integer: true },
  'tracks.*.quality': { min: 0, max: 1, step: 0.01 },
  'tracks.*.active': { description: 'Track active state' },
  'tracks.*.id': { readonly: true },
  'actions.calibrate': { button: 'Calibrate', fullWidthButton: true, description: 'Emit an action event' },
};

const renderer = new TreeRowRenderer();
renderer.initialize(canvas);
const controller = new TreeViewController({ renderer, initialExpandDepth: 3 });
controller.canvas = canvas;
controller.setTheme(themes.dark);
controller.setModel(model, meta, { presentation: modeSelect.value, flatRoot: true, enforceMeta: true, filter: true });

const cellEditor = new CellEditorManager({ controller, canvas });
new TreeViewInputController({
  canvas,
  controller,
  viewport: controller.viewport,
  rowModel: controller.rowModel,
  expansion: controller.expansion,
  selection: controller.selection,
  cellEditor,
});

controller.on('valuechange', (event) => {
  message.textContent = `${event.detail.path}: ${event.detail.oldValue} -> ${event.detail.newValue}`;
  updateJson();
});
controller.on('action', (event) => {
  message.textContent = `Action: ${event.detail.label} (${event.detail.path})`;
});

focusRange.addEventListener('click', () => controller.focusNode('model:sensor.range', { align: 'center', select: true }));
modeSelect.addEventListener('change', () => {
  controller.setModel(model, meta, { presentation: modeSelect.value, flatRoot: true, enforceMeta: true, filter: true });
  updateJson();
});

function animate(now) {
  controller.render(now);
  requestAnimationFrame(animate);
}

function updateJson() {
  json.textContent = JSON.stringify(model, null, 2);
}

updateJson();
requestAnimationFrame(animate);
