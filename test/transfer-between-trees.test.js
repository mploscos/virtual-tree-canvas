import test from 'node:test';
import assert from 'node:assert/strict';
import { moveNodesBetweenTrees, moveTreeNodes } from '../examples/transfer-between-trees-data.js';

const source = [
  { id: 'left', label: 'Left' },
  { id: 'group', parentId: 'left', label: 'Group' },
  { id: 'child', parentId: 'group', label: 'Child' },
  { id: 'grandchild', parentId: 'child', label: 'Grandchild' },
  { id: 'sibling', parentId: 'left', label: 'Sibling' }
];
const target = [{ id: 'right', label: 'Right' }];

test('moves a multi-selection with complete subtrees and one copy of each node', () => {
  const result = moveNodesBetweenTrees(source, target, ['child', 'group', 'sibling'], 'right');
  assert.deepEqual(result.movedRootIds, ['group', 'sibling']);
  assert.equal(result.movedCount, 4);
  assert.deepEqual(result.sourceNodes.map((node) => node.id), ['left']);
  assert.deepEqual(result.targetNodes.map((node) => node.id), [
    'right', 'group', 'child', 'grandchild', 'sibling'
  ]);
  assert.equal(result.targetNodes[1].parentId, 'right');
  assert.equal(result.targetNodes[2].parentId, 'group');
  assert.equal(result.targetNodes[4].parentId, 'right');
  assert.equal(source[1].parentId, 'left');
});

test('ignores IDs missing from the source and rejects destination collisions', () => {
  assert.equal(moveNodesBetweenTrees(source, target, ['missing'], 'right'), null);
  assert.throws(() => moveNodesBetweenTrees(source, [
    ...target, { id: 'child', parentId: 'right' }
  ], ['group'], 'right'), /duplicate node ID/);
});

test('reorders siblings and reparents a complete branch within one tree', () => {
  const reordered = moveTreeNodes(source, source, ['sibling'], { nodeId: 'group', position: 'before' });
  assert.deepEqual(reordered.targetNodes.map((node) => node.id), [
    'left', 'sibling', 'group', 'child', 'grandchild'
  ]);
  assert.equal(reordered.targetNodes.find((node) => node.id === 'sibling').parentId, 'left');

  const reparented = moveTreeNodes(source, source, ['child'], { nodeId: 'sibling', position: 'after' });
  assert.deepEqual(reparented.targetNodes.map((node) => node.id), [
    'left', 'group', 'sibling', 'child', 'grandchild'
  ]);
  assert.equal(reparented.targetNodes.find((node) => node.id === 'child').parentId, 'left');
  assert.equal(reparented.targetNodes.find((node) => node.id === 'grandchild').parentId, 'child');
});

test('moves two selected branches into another folder in the same tree', () => {
  const withFolder = [...source, { id: 'other', parentId: 'left', label: 'Other' }];
  const result = moveTreeNodes(withFolder, withFolder, ['group', 'child', 'sibling'], {
    nodeId: 'other', position: 'inside'
  });
  assert.deepEqual(result.movedRootIds, ['group', 'sibling']);
  assert.equal(result.movedCount, 4);
  assert.deepEqual(result.targetNodes.map((node) => node.id), [
    'left', 'other', 'group', 'child', 'grandchild', 'sibling'
  ]);
  assert.equal(result.targetNodes.find((node) => node.id === 'group').parentId, 'other');
  assert.equal(result.targetNodes.find((node) => node.id === 'sibling').parentId, 'other');
});

test('rejects cycles and leaves a no-op drop unchanged', () => {
  assert.equal(moveTreeNodes(source, source, ['group'], { nodeId: 'child', position: 'inside' }), null);
  assert.equal(moveTreeNodes(source, source, ['sibling'], { nodeId: 'group', position: 'after' }), null);
});

test('inserts a moved branch inside a chosen folder in the other tree', () => {
  const destination = [
    { id: 'right', label: 'Right' },
    { id: 'folder', parentId: 'right', label: 'Folder' },
    { id: 'existing', parentId: 'folder', label: 'Existing' }
  ];
  const result = moveTreeNodes(source, destination, ['group'], { nodeId: 'folder', position: 'inside' });
  assert.deepEqual(result.targetNodes.map((node) => node.id), [
    'right', 'folder', 'existing', 'group', 'child', 'grandchild'
  ]);
  assert.equal(result.targetNodes.find((node) => node.id === 'group').parentId, 'folder');
});
