export class IconRegistry {
  constructor() {
    this.icons = new Map();
    this.loading = new Map();
    this.#registerBuiltIns();
  }

  register(name, icon) {
    if (!name) throw new Error('Icon name is required');
    if (this.icons.has(name)) return this.icons.get(name);
    if (typeof icon === 'function') {
      this.icons.set(name, { kind: 'vector', draw: icon });
      return this.icons.get(name);
    }
    if (typeof icon === 'string') {
      if (icon.trim().startsWith('<svg')) return this.#registerSvgString(name, icon);
      return this.#registerUrl(name, icon);
    }
    this.icons.set(name, { kind: 'image', image: icon, loaded: true });
    return this.icons.get(name);
  }

  get(name) {
    return this.icons.get(name) ?? this.icons.get('placeholder');
  }

  draw(ctx, name, x, y, size, color) {
    const icon = this.get(name);
    if (!icon) return;
    if (icon.kind === 'vector') {
      icon.draw(ctx, x, y, size, color);
      return;
    }
    if (icon.loaded && icon.image) {
      ctx.drawImage(icon.image, x, y, size, size);
      return;
    }
    this.get('placeholder')?.draw(ctx, x, y, size, color);
  }

  #registerUrl(name, url) {
    if (this.icons.has(name)) return this.icons.get(name);
    const entry = { kind: 'image', image: null, loaded: false, url };
    this.icons.set(name, entry);
    if (typeof Image !== 'undefined' && !this.loading.has(url)) {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        entry.image = image;
        entry.loaded = true;
        this.loading.delete(url);
      };
      image.src = url;
      this.loading.set(url, image);
    }
    return entry;
  }

  #registerSvgString(name, svg) {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined') {
      this.icons.set(name, { kind: 'svg', svg, loaded: false });
      return this.icons.get(name);
    }
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    return this.#registerUrl(name, url);
  }

  #registerBuiltIns() {
    this.register('placeholder', drawPlaceholder);
    this.register('folder', drawFolder);
    this.register('aircraft', drawAircraft);
    this.register('radar', drawRadar);
    this.register('warning', drawWarning);
    this.register('error', drawError);
    this.register('task', drawTask);
    this.register('track', drawTrack);
  }
}

function drawPlaceholder(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.strokeRect(x + 2.5, y + 2.5, size - 5, size - 5);
}

function drawFolder(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 5);
  ctx.lineTo(x + size * 0.38, y + 5);
  ctx.lineTo(x + size * 0.48, y + 8);
  ctx.lineTo(x + size - 1, y + 8);
  ctx.lineTo(x + size - 1, y + size - 2);
  ctx.lineTo(x + 1, y + size - 2);
  ctx.closePath();
  ctx.fill();
}

function drawAircraft(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.5, y + 1);
  ctx.lineTo(x + size * 0.62, y + size * 0.58);
  ctx.lineTo(x + size - 1, y + size * 0.72);
  ctx.lineTo(x + size * 0.58, y + size * 0.78);
  ctx.lineTo(x + size * 0.54, y + size - 1);
  ctx.lineTo(x + size * 0.46, y + size - 1);
  ctx.lineTo(x + size * 0.42, y + size * 0.78);
  ctx.lineTo(x + 1, y + size * 0.72);
  ctx.lineTo(x + size * 0.38, y + size * 0.58);
  ctx.closePath();
  ctx.fill();
}

function drawRadar(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size * 0.34, -0.4, Math.PI * 1.4);
  ctx.moveTo(x + size / 2, y + size / 2);
  ctx.lineTo(x + size * 0.84, y + size * 0.28);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawWarning(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y + 1);
  ctx.lineTo(x + size - 1, y + size - 2);
  ctx.lineTo(x + 1, y + size - 2);
  ctx.closePath();
  ctx.fill();
}

function drawError(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 5);
  ctx.lineTo(x + size - 5, y + size - 5);
  ctx.moveTo(x + size - 5, y + 5);
  ctx.lineTo(x + 5, y + size - 5);
  ctx.stroke();
}

function drawTask(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 3, y + 2, size - 6, size - 4);
  ctx.beginPath();
  ctx.moveTo(x + 5, y + size * 0.52);
  ctx.lineTo(x + size * 0.42, y + size - 5);
  ctx.lineTo(x + size - 5, y + 5);
  ctx.stroke();
}

function drawTrack(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size * 0.34, 0, Math.PI * 2);
  ctx.moveTo(x + size / 2, y + 1);
  ctx.lineTo(x + size / 2, y + size - 1);
  ctx.moveTo(x + 1, y + size / 2);
  ctx.lineTo(x + size - 1, y + size / 2);
  ctx.stroke();
}
