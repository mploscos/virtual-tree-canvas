import assert from 'node:assert/strict';
import test from 'node:test';
import { IconRegistry, ThemeManager, TreeViewController, darkTheme } from '../src/index.js';

test('ThemeManager resolves type styles correctly', () => {
  const manager = new ThemeManager(darkTheme);
  const style = manager.resolveNodeStyle({ id: 'sensor-1', type: 'sensor' }, { status: 1 });

  assert.equal(style.icon, 'radar');
  assert.equal(style.color, darkTheme.types.sensor.color);
  assert.equal(style.status.label, 'WARN');
});

test('IconRegistry caches icons by name', () => {
  const registry = new IconRegistry();
  const icon = () => {};
  const first = registry.register('custom', icon);
  const second = registry.register('custom', icon);

  assert.equal(first, second);
  assert.equal(registry.get('custom'), first);
});

test('dynamic color override wins over type color', () => {
  const manager = new ThemeManager(darkTheme);
  const style = manager.resolveNodeStyle({ id: 'platform-1', type: 'platform' }, { color: '#ffffff' });

  assert.equal(style.typeColor, darkTheme.types.platform.color);
  assert.equal(style.color, '#ffffff');
});

test('theme change does not rebuild visible rows for visual-only changes', () => {
  const controller = new TreeViewController({ initialExpandDepth: 1 });
  controller.setData([
    { id: 'root', type: 'root' },
    { id: 'sensor-1', parentId: 'root', type: 'sensor' },
  ]);
  const rebuildCount = controller.rebuildCount;
  const rowCount = controller.rowModel.rows.length;

  controller.setTheme({
    colors: {
      background: '#000000',
      rowHover: '#111111',
    },
    types: {
      sensor: { icon: 'radar', color: '#00ff00' },
    },
  });

  assert.equal(controller.rebuildCount, rebuildCount);
  assert.equal(controller.rowModel.rows.length, rowCount);
});

