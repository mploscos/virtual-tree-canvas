import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeViewController } from '../src/index.js';

test('automatic painting coalesces changes and cancels scheduled work on destroy', () => {
  const callbacks = new Map();
  let next = 0,
    renders = 0;
  const view = {
    requestAnimationFrame(callback) {
      callbacks.set(++next, callback);
      return next;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
    }
  };
  const controller = new TreeViewController({
    autoRender: true
  });
  controller.canvas = {
    ownerDocument: {
      defaultView: view
    }
  };
  controller.render = () => {
    renders++;
  };
  controller.setData([
    {
      id: 'one'
    }
  ]);
  controller.setDynamicState([
    {
      id: 'one',
      state: {
        value: 1
      }
    }
  ]);
  controller.requestRender();
  assert.equal(callbacks.size, 1);
  const callback = [...callbacks.values()][0];
  callbacks.clear();
  callback();
  assert.equal(renders, 1);
  controller.requestRender();
  controller.destroy();
  assert.equal(callbacks.size, 0);
  assert.equal(controller.renderFrame, null);
});

test('icon resolver applies strings and visual patches without mutating caller nodes', () => {
  const nodes = [
    {
      id: 'one'
    },
    {
      id: 'two',
      icon: 'folder'
    },
    {
      id: 'three'
    }
  ];
  const controller = new TreeViewController();
  controller.setData(nodes, {
    iconResolver: (node) =>
      node.id === 'one'
        ? 'person'
        : node.id === 'two'
          ? {
              icon: 'data-bus'
            }
          : null
  });
  assert.equal(controller.model.index.getNode('one').icon, 'person');
  assert.equal(controller.model.index.getNode('two').icon, 'data-bus');
  assert.equal(nodes[0].icon, undefined);
  assert.equal(nodes[1].icon, 'folder');
  assert.equal(controller.model.index.getNode('three'), nodes[2]);
  assert.equal(controller.renderFrame, null);
  controller.destroy();
});

test('refreshing tree members retains existing branch expansion and initializes new branches', () => {
  const controller = new TreeViewController({
    initialExpandDepth: 0
  });
  const nodes = [
    {
      id: 'one'
    },
    {
      id: 'property',
      parentId: 'one'
    },
    {
      id: 'two'
    },
    {
      id: 'other',
      parentId: 'two'
    }
  ];
  controller.setData(nodes);
  controller.expand('one');
  controller.setData([
    ...nodes,
    {
      id: 'three'
    },
    {
      id: 'new',
      parentId: 'three'
    }
  ]);
  assert.equal(controller.expansion.isExpanded('one'), true);
  assert.equal(controller.expansion.isExpanded('two'), false);
  assert.equal(controller.expansion.isExpanded('three'), false);
  controller.destroy();
});
