import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cloneDynamicState,
  mergeDynamicState,
  mergeDynamicStateChanged
} from '../src/core/dynamic-state.js';

test('mergeDynamicState applies falsy and undefined values', () => {
  const state = {
    progress: 0.7,
    color: '#22c55e',
    selected: true,
    updated: true,
  };

  mergeDynamicState(state, {
    progress: 0,
    color: undefined,
    selected: false,
    updated: false,
  });

  assert.equal(state.progress, 0);
  assert.equal(state.color, undefined);
  assert.equal(state.selected, false);
  assert.equal(state.updated, false);
});

test('mergeDynamicState preserves custom dynamic keys', () => {
  const state = { visible: true };

  mergeDynamicState(state, { customMetric: 12, nested: { ok: true } });

  assert.equal(state.customMetric, 12);
  assert.deepEqual(state.nested, { ok: true });
});

test('cloneDynamicState returns an independent state object', () => {
  const source = { progress: 0.5, customMetric: 4 };
  const clone = cloneDynamicState(source);

  source.progress = 1;
  source.customMetric = 8;

  assert.deepEqual(clone, { progress: 0.5, customMetric: 4 });
});

test('mergeDynamicStateChanged reports only real Object.is changes', () => {
  const nested = { ok: true };
  const state = { value: 1, status: 2, customMetric: NaN, nested, zero: 0 };

  assert.equal(
    mergeDynamicStateChanged(state, { value: 1, status: 3, customMetric: NaN, nested }),
    true
  );
  assert.deepEqual(state, { value: 1, status: 3, customMetric: NaN, nested, zero: 0 });
  assert.equal(mergeDynamicStateChanged(state, { status: 3, customMetric: NaN, nested }), false);
  assert.equal(mergeDynamicStateChanged(state, { zero: -0 }), true);
  assert.equal(Object.is(state.zero, -0), true);
});
