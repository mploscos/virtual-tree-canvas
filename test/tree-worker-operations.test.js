import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkerTreeState, getIncludedIdsForQuery, rebuildWorkerRows, searchWorkerTree } from '../src/index.js';

const nodes = [
  { id: 'root', label: 'Root', type: 'root' },
  { id: 'a', parentId: 'root', label: 'Alpha', type: 'system' },
  { id: 'a1', parentId: 'a', label: 'Radar Track', type: 'track', tags: ['air'] },
  { id: 'b', parentId: 'root', label: 'Bravo', type: 'sensor' },
];

test('worker search finds id, label, path, tags, and type', () => {
  const state = createWorkerTreeState(nodes);

  assert.deepEqual(searchWorkerTree(state, 'radar'), ['a1']);
  assert.deepEqual(searchWorkerTree(state, 'root/alpha'), ['a', 'a1']);
  assert.deepEqual(searchWorkerTree(state, 'sensor'), ['b']);
  assert.deepEqual(searchWorkerTree(state, 'air'), ['a1']);
});

test('worker inspector search ignores ancestor path matches', () => {
  const inspectorNodes = [
    { id: 'model:relativeSpatial', label: 'relativeSpatial', type: 'object', data: { inspector: true, path: 'relativeSpatial', key: 'relativeSpatial', valueText: '{"key":0}', valueType: 'object' } },
    { id: 'model:relativeSpatial.key', parentId: 'model:relativeSpatial', label: 'key', type: 'number', data: { inspector: true, path: 'relativeSpatial.key', key: 'key', valueText: '0', valueType: 'number' } },
    { id: 'model:relativeSpatial.type', parentId: 'model:relativeSpatial', label: 'type', type: 'string', data: { inspector: true, path: 'relativeSpatial.type', key: 'type', valueText: 'rpr.SpatialStaticStruct', valueType: 'string' } },
    { id: 'model:relativeSpatial.value', parentId: 'model:relativeSpatial', label: 'value', type: 'object', data: { inspector: true, path: 'relativeSpatial.value', key: 'value', valueText: '{"worldLocation":{}}', valueType: 'object' } },
    { id: 'model:relativeSpatial.value.worldLocation', parentId: 'model:relativeSpatial.value', label: 'worldLocation', type: 'object', data: { inspector: true, path: 'relativeSpatial.value.worldLocation', key: 'worldLocation', valueText: '{"x":0}', valueType: 'object' } },
    { id: 'model:relativeSpatial.value.worldLocation.x', parentId: 'model:relativeSpatial.value.worldLocation', label: 'x', type: 'number', data: { inspector: true, path: 'relativeSpatial.value.worldLocation.x', key: 'x', valueText: '0', valueType: 'number' } },
  ];
  const state = createWorkerTreeState(inspectorNodes);

  assert.deepEqual(searchWorkerTree(state, 'spatial'), [
    'model:relativeSpatial',
    'model:relativeSpatial.type',
  ]);
  assert.deepEqual(getIncludedIdsForQuery(state, 'worldlocation').matchingIds, [
    'model:relativeSpatial.value',
    'model:relativeSpatial.value.worldLocation',
    'model:relativeSpatial.value.worldLocation.x',
  ]);
});

test('worker row rebuild applies expansion and filter without requiring expanded ancestors', () => {
  const state = createWorkerTreeState(nodes);
  const result = rebuildWorkerRows(state, {
    expandedIds: [],
    rowHeight: 20,
    indentWidth: 18,
    filterQuery: 'radar',
  });

  assert.deepEqual(result.rows.map((row) => row.nodeId), ['root', 'a', 'a1']);
  assert.equal(result.contentHeight, 60);
});

test('worker row rebuild respects collapsed filter branches', () => {
  const state = createWorkerTreeState(nodes);
  const result = rebuildWorkerRows(state, {
    expandedIds: [],
    filterCollapsedIds: ['root'],
    rowHeight: 20,
    indentWidth: 18,
    filterQuery: 'radar',
  });

  assert.deepEqual(result.rows.map((row) => row.nodeId), ['root']);
  assert.equal(result.rows[0].expanded, false);
});

test('worker row rebuild sorts siblings', () => {
  const state = createWorkerTreeState(nodes);
  const result = rebuildWorkerRows(state, {
    expandedIds: ['root'],
    rowHeight: 20,
    sort: { columnId: 'name', direction: 'desc' },
  });

  assert.deepEqual(result.rows.map((row) => row.nodeId), ['root', 'b', 'a']);
});

test('worker row rebuild sorts with explicit dynamic sort values', () => {
  const state = createWorkerTreeState(nodes);
  const result = rebuildWorkerRows(state, {
    expandedIds: ['root'],
    rowHeight: 20,
    sort: { columnId: 'value', direction: 'asc' },
    sortValues: [
      ['a', 20],
      ['b', 5],
    ],
  });

  assert.deepEqual(result.rows.map((row) => row.nodeId), ['root', 'b', 'a']);
});

test('worker filter can reuse previous direct matches for narrower queries', () => {
  const state = createWorkerTreeState(nodes);
  const broad = getIncludedIdsForQuery(state, 'track');
  const narrow = getIncludedIdsForQuery(state, 'radar track', broad.matchingIds);
  const result = rebuildWorkerRows(state, {
    rowHeight: 20,
    filterQuery: 'radar track',
    includedIds: Array.from(narrow.includedIds),
  });

  assert.deepEqual(broad.matchingIds, ['a1']);
  assert.deepEqual(narrow.matchingIds, ['a1']);
  assert.deepEqual(result.rows.map((row) => row.nodeId), ['root', 'a', 'a1']);
});
