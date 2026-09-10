import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { IconRegistry, ThemeManager, TreeViewController, darkTheme, builtinIconNames } from '../src/index.js';

test('all built-in SVGs resolve to the published resources directory by default', async () => {
  const registry = new IconRegistry();
  assert.equal(registry.icons.size, builtinIconNames.length);
  for (const [name, icon] of registry.icons) {
    const expected = new URL(`../resources/icons/${name}.svg`, import.meta.url);
    assert.equal(icon.url, expected.href);
    assert.match(await readFile(expected, 'utf8'), /<svg/);
  }
});

test('icon registries keep independent configurable base URLs', () => {
  for (const base of ['/app/icons', 'node_modules/widget/resources/icons/', 'https://cdn.example.test/v1/icons/']) {
    const registry = new IconRegistry({ iconsBaseUrl: base });
    assert.equal(registry.get('folder').url, `${base.replace(/\/$/, '')}/folder.svg`);
  }
  const first = new TreeViewController({ iconsBaseUrl: new URL('https://cdn.example.test/first/') });
  const second = new TreeViewController({ iconsBaseUrl: '/second/' });
  assert.equal(first.iconRegistry.get('radar').url, 'https://cdn.example.test/first/radar.svg');
  assert.equal(second.iconRegistry.get('radar').url, '/second/radar.svg');
  const custom = new IconRegistry({ iconsBaseUrl: '/custom/' });
  const third = new TreeViewController({ iconRegistry: custom, iconsBaseUrl: '/ignored/' });
  assert.equal(third.iconRegistry, custom);
});

test('browser icon loading is lazy, cached and uses the configured base', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.window = {};
  globalThis.fetch = async url => {
    requests.push(url);
    return { ok: true, text: async () => '<svg xmlns="http://www.w3.org/2000/svg"/>' };
  };
  try {
    const registry = new IconRegistry({ iconsBaseUrl: '/application/icons/' });
    assert.equal(requests.length, 0);
    await registry.prepare({ icons: ['folder', 'radar'] });
    assert.equal(requests.length, 2);
    await registry.prepare({ icons: ['folder', 'radar'], size: 20 });
    assert.equal(requests.length, 2);
    assert.ok(requests.every(url => url.startsWith('/application/icons/')));
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

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

test('built-in icons are SVG sources and raster cache uses size, colour and DPR', async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const bitmaps = [];
  globalThis.createImageBitmap = async (blob, options) => {
    const bitmap = { blob, options };
    bitmaps.push(bitmap);
    return bitmap;
  };

  try {
    const registry = new IconRegistry({ pixelRatio: 2 });
    assert.equal(registry.get('radar').kind, 'svg');
    registry.register('test-svg', '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M0 0h24v24H0z"/></svg>');

    const [bitmap] = await registry.prepare({ icons: ['test-svg'], size: 15, color: '#12abef', pixelRatio: 2 });
    assert.equal(bitmap.options.resizeWidth, 30);
    assert.match(await bitmap.blob.text(), /#12abef/);

    const calls = [];
    registry.draw({ getTransform: () => ({ a: 2 }), drawImage: (...args) => calls.push(args) }, 'test-svg', 1, 2, 15, '#12abef');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], bitmap);
    assert.equal(bitmaps.length, 1);
  } finally {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  }
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
