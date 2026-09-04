import { builtinIconUrls } from '../assets/icons.js';

/**
 * Icon source registry for the Canvas2D tree renderer.
 *
 * SVG icons remain editable files, but are decoded to an ImageBitmap (or a
 * small canvas fallback) only once for each size, device-pixel-ratio and
 * colour combination. The render hot path is therefore a single drawImage.
 */
export class IconRegistry {
  constructor({ pixelRatio } = {}) {
    this.icons = new Map();
    this.listeners = new Set();
    this.pixelRatio = pixelRatio ?? devicePixelRatio();
    this.#registerBuiltIns();
  }

  /** Register an SVG string/URL, an image URL, ImageBitmap, or legacy Canvas draw function. */
  register(name, icon) {
    if (!name) throw new Error('Icon name is required');
    if (this.icons.has(name)) return this.icons.get(name);

    if (typeof icon === 'function') {
      const entry = { kind: 'vector', draw: icon };
      this.icons.set(name, entry);
      return entry;
    }

    if (typeof icon === 'string') {
      const source = icon.trim();
      if (source.startsWith('<svg')) return this.#registerSvg(name, { source });
      if (isSvgUrl(source)) return this.#registerSvg(name, { url: source });
      return this.#registerImageUrl(name, source);
    }

    const entry = { kind: 'image', image: icon, loaded: true };
    this.icons.set(name, entry);
    return entry;
  }

  get(name) {
    return this.icons.get(name) ?? this.icons.get('placeholder');
  }

  /** Listen for a decoded icon becoming ready, so hosts can repaint once. */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Starts loading and rasterising a known set of icons ahead of first paint.
   * A colour is part of the cache key because theme colours are baked into SVG
   * assets that use currentColor.
   */
  prepare({ icons = this.icons.keys(), size = 15, color = '#94a3b8', pixelRatio = this.pixelRatio } = {}) {
    return Promise.all([...icons].map((name) => this.#requestRaster(this.get(name), size, color, pixelRatio)));
  }

  draw(ctx, name, x, y, size, color) {
    const icon = this.get(name);
    if (!icon) return;
    if (icon.kind === 'vector') {
      // Kept for backwards compatibility. Built-in icons are all SVG assets.
      icon.draw(ctx, x, y, size, color);
      return;
    }
    if (icon.kind === 'image') {
      if (icon.loaded && icon.image) ctx.drawImage(icon.image, x, y, size, size);
      return;
    }

    const pixelRatio = canvasPixelRatio(ctx, this.pixelRatio);
    const key = rasterKey(size, color, pixelRatio);
    const raster = icon.rasters.get(key);
    if (raster) {
      ctx.drawImage(raster, x, y, size, size);
      return;
    }
    this.#requestRaster(icon, size, color, pixelRatio);
  }

  #registerSvg(name, { source = null, url = null }) {
    const entry = {
      kind: 'svg',
      source,
      url,
      rasters: new Map(),
      pending: new Map(),
      sourcePromise: null,
      error: null,
    };
    this.icons.set(name, entry);
    // Fetching source eagerly moves network and SVG parsing out of scrolling.
    // Avoid file-URL fetch attempts while the package is exercised in Node.
    if (typeof window !== 'undefined') this.#loadSvg(entry);
    return entry;
  }

  #registerImageUrl(name, url) {
    const entry = { kind: 'image', image: null, loaded: false, url };
    this.icons.set(name, entry);
    if (typeof Image === 'undefined') return entry;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      entry.image = image;
      entry.loaded = true;
      this.#notify();
    };
    image.onerror = () => { entry.error = new Error(`Unable to load icon: ${url}`); };
    image.src = url;
    return entry;
  }

  async #requestRaster(icon, size, color, pixelRatio) {
    if (!icon || icon.kind !== 'svg') return null;
    const key = rasterKey(size, color, pixelRatio);
    if (icon.rasters.has(key)) return icon.rasters.get(key);
    if (icon.pending.has(key)) return icon.pending.get(key);

    const pending = this.#loadSvg(icon)
      .then((source) => source && rasterizeSvg(source, size, color, pixelRatio))
      .then((raster) => {
        if (raster) {
          icon.rasters.set(key, raster);
          this.#notify();
        }
        return raster;
      })
      .catch((error) => {
        icon.error = error;
        return null;
      })
      .finally(() => icon.pending.delete(key));
    icon.pending.set(key, pending);
    return pending;
  }

  #loadSvg(icon) {
    if (icon.source) return Promise.resolve(icon.source);
    if (icon.sourcePromise) return icon.sourcePromise;
    if (!icon.url || typeof fetch !== 'function') return Promise.resolve(null);

    icon.sourcePromise = fetch(icon.url)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load SVG icon: ${icon.url}`);
        return response.text();
      })
      .then((source) => {
        icon.source = source;
        return source;
      })
      .catch((error) => {
        icon.error = error;
        return null;
      });
    return icon.sourcePromise;
  }

  #notify() {
    for (const listener of this.listeners) listener();
  }

  #registerBuiltIns() {
    for (const [name, url] of Object.entries(builtinIconUrls)) this.register(name, url);
  }
}

async function rasterizeSvg(source, size, color, pixelRatio) {
  const pixelSize = Math.max(1, Math.round(size * pixelRatio));
  const svg = source.replaceAll('currentColor', color);
  const blob = new Blob([svg], { type: 'image/svg+xml' });

  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, {
        resizeWidth: pixelSize,
        resizeHeight: pixelSize,
        resizeQuality: 'high',
      });
    } catch {
      // Safari and older Chromium versions can reject SVG blobs here. The
      // canvas fallback below still creates one fixed-size raster per key.
    }
  }

  if (typeof Image === 'undefined' || typeof document === 'undefined' || typeof URL === 'undefined') return null;
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(image, 0, 0, pixelSize, pixelSize);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to decode SVG icon: ${url}`));
    image.src = url;
  });
}

function isSvgUrl(value) {
  return /^data:image\/svg\+xml/i.test(value) || /\.svg(?:[?#].*)?$/i.test(value);
}

function rasterKey(size, color, pixelRatio) {
  return `${size}|${pixelRatio}|${color}`;
}

function devicePixelRatio() {
  return Math.max(1, globalThis.devicePixelRatio || 1);
}

function canvasPixelRatio(ctx, fallback) {
  const transform = ctx.getTransform?.();
  return Math.max(1, Math.abs(transform?.a) || fallback || 1);
}
