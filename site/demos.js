import { TreeView, builtInColumns, inspectorColumns } from '../src/index.js';
import { generateTree } from '../examples/generate-tree.js';
import { createMarketDemo } from './market.js';

const theme = document.documentElement.dataset.theme;
const nodes = generateTree(2400);
const heroColumns = [
    { ...builtInColumns.tree, width: 200 },
    { ...builtInColumns.status, width: 64 },
    { ...builtInColumns.value, width: 72 },
    { ...builtInColumns.progress, width: 100 }
];
const hero = new TreeView(document.querySelector('#hero-tree'), {
    theme,
    filter: true,
    editable: false,
    initialExpandDepth: 3,
    columns: heroColumns
});
hero.setData(nodes);

const model = {
    sensor: { enabled: true, range: 72, mode: 'track' },
    detections: [
        { name: 'North contact', bearing: 45, distance: 12 },
        { bearing: 130, distance: 8, active: true }
    ],
    tags: ['radar', 'navigation'],
    scanLines: [[12, 18, 25], [31, 42]]
};
const inspector = new TreeView(document.querySelector('#inspector-tree'), {
    theme,
    mode: 'inspector',
    presentation: 'pane',
    filter: true,
    initialExpandDepth: 3
});
inspector.setModel(model, {
    'sensor.range': { min: 0, max: 120, step: 1, integer: true, unit: 'km' },
    'sensor.mode': { options: { Search: 'search', Track: 'track', Standby: 'standby' } },
    detections: { itemFactory: () => ({ bearing: 0, distance: 0 }) },
    'detections.*.bearing': { min: 0, max: 360, step: 1, integer: true },
    'detections.*.distance': { min: 0, max: 100, step: 1, integer: true },
    tags: { itemType: 'string' },
    scanLines: { itemFactory: () => [0, 0] },
    'scanLines.*': { itemType: 'number' }
});

const [propertyColumn, valueColumn] = inspectorColumns();
const units = new TreeView(document.querySelector('#units-tree'), {
    theme,
    mode: 'inspector',
    presentation: 'table',
    filter: true,
    filterPlacement: 'header',
    initialExpandDepth: 2,
    columns: [
        { ...propertyColumn, width: 230 },
        { ...valueColumn, width: 255 }
    ]
});
units.setModel({
    speed: 125.45678,
    altitude: 1250.25,
    acceleration: -9.80665,
    temperature: 21.125,
    heading: 0.00001234
}, {
    speed: { unit: 'm/s', precision: 2, min: 0, max: 300 },
    altitude: { unit: 'm', precision: 1 },
    acceleration: { unit: 'm/s²', precision: 3, readonly: true },
    temperature: { unit: '°C', precision: 2 },
    heading: { unit: 'rad', precision: 8 }
});

const reorderNodes = [
    { id: 'altitude', label: 'Altitude', icon: 'aircraft', data: { unit: 'm' } },
    { id: 'speed', label: 'Speed', icon: 'car', data: { unit: 'm/s' } },
    { id: 'temperature', label: 'Temperature', icon: 'thermometer', data: { unit: '°C' } },
    { id: 'wind', label: 'Wind', icon: 'wind', data: { unit: 'm/s' } },
    { id: 'power', label: 'Power', icon: 'sensor', data: { unit: 'W' } },
    { id: 'signal', label: 'Data bus signal', icon: 'data-bus', data: { unit: 'dB' } }
];
const reorderColumns = [
    { ...builtInColumns.tree, label: 'Property', width: 250 },
    { ...builtInColumns.value, width: 110 },
    { id: 'unit', label: 'Unit', width: 90, value: (node) => node.data.unit }
];
const reorder = new TreeView(document.querySelector('#reorder-tree'), {
    theme,
    rowReorder: true,
    editable: false,
    filter: false,
    columns: reorderColumns
});
reorder.setData(reorderNodes);

export const market = createMarketDemo(
    document.querySelector('#market-tree'),
    document.querySelector('#market-status'),
    document.querySelector('#market-toggle'),
    { theme }
);
const themeViews = [hero, inspector, units, reorder];
const views = [...themeViews, market.view];
const syncTheme = (event) => {
    for (const view of themeViews) view.setTheme(event.detail.theme);
    market.setTheme(event.detail.theme);
};
window.addEventListener('site-theme-change', syncTheme);

let compactHero = false;
let compactReorder = false;
const tableSize = new ResizeObserver((entries) => {
    for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        if (entry.target === hero.host) {
            const compact = width < 450;
            if (compact !== compactHero) {
                hero.setColumns(compact ? [heroColumns[0], heroColumns[2]] : heroColumns);
                compactHero = compact;
            }
            const nameWidth = Math.max(160, width - hero.controller.viewport.scrollbarSize - (compact ? 72 : 64 + 72 + 100));
            if (hero.controller.columnModel.getColumn('name').width !== nameWidth)
                hero.controller.resizeColumn('name', nameWidth);
        } else if (entry.target === units.host) {
            const propertyWidth = Math.max(160, Math.min(230, Math.floor(width * 0.45)));
            const valueWidth = Math.max(140, width - propertyWidth);
            if (units.controller.columnModel.getColumn('property').width !== propertyWidth)
                units.controller.resizeColumn('property', propertyWidth);
            if (units.controller.columnModel.getColumn('value').width !== valueWidth)
                units.controller.resizeColumn('value', valueWidth);
        } else if (entry.target === reorder.host) {
            const compact = width < 530;
            if (compact !== compactReorder) {
                reorder.setColumns(compact ? reorderColumns.slice(0, 2) : reorderColumns);
                compactReorder = compact;
            }
            const valueWidth = compact ? Math.max(56, Math.min(100, width - 72 - 160)) : 110;
            const nameWidth = Math.max(160, width - 72 - valueWidth - (compact ? 0 : 90));
            if (reorder.controller.columnModel.getColumn('name').width !== nameWidth)
                reorder.controller.resizeColumn('name', nameWidth);
            if (reorder.controller.columnModel.getColumn('value').width !== valueWidth)
                reorder.controller.resizeColumn('value', valueWidth);
        }
    }
});
tableSize.observe(hero.host);
tableSize.observe(units.host);
tableSize.observe(reorder.host);

const active = new Set();
const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (entry.isIntersecting) active.add(entry.target.id);
        else active.delete(entry.target.id);
    }
});
visibility.observe(hero.host);
visibility.observe(reorder.host);

const liveIds = hero.controller.rowModel.rows.slice(0, 45).map((row) => row.nodeId);
let tick = 0;
const timer = window.setInterval(() => {
    if (document.hidden) return;
    tick++;
    if (active.has('hero-tree')) {
        const ids = [
            ...liveIds,
            ...Array.from({ length: 32 }, (_, index) => nodes[(tick * 47 + index * 71) % nodes.length].id)
        ];
        hero.setDynamicState(ids.map((id, index) => ({
            id,
            state: {
                value: Number((28 + index * 0.7 + Math.sin(tick / 3 + index) * 9).toFixed(2)),
                progress: (Math.sin(tick / 6 + index / 5) + 1) / 2,
                status: index === 0 ? 0 : index % 17 === 0 ? 2 : index % 7 === 0 ? 1 : 0
            }
        })));
    }
    if (active.has('reorder-tree')) {
        reorder.setDynamicState(reorderNodes.map((node, index) => ({
            id: node.id,
            state: { value: (100 + index * 20 + Math.sin(tick / 5 + index) * 5).toFixed(2) }
        })));
    }
}, 500);

const redrawViews = () => {
    if (document.hidden) return;
    for (const view of views) view.controller.requestRender(true);
};
const onPageShow = (event) => {
    if (event.persisted) redrawViews();
};
document.addEventListener('visibilitychange', redrawViews);
window.addEventListener('pageshow', onPageShow);
window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    window.clearInterval(timer);
    visibility.disconnect();
    tableSize.disconnect();
    document.removeEventListener('visibilitychange', redrawViews);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('site-theme-change', syncTheme);
    market.destroy();
    for (const view of views) view.destroy();
});
