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
    this.register('point', drawPoint);
    this.register('munition', drawMunition);
    this.register('air', drawAircraft);
    this.register('ground', drawGroundVehicle);
    this.register('surface', drawSurfaceVehicle);
    this.register('subsurface', drawSubsurfaceVehicle);
    this.register('space', drawSpaceVehicle);
    this.register('control', drawControl);
    this.register('situation', drawSituation);
    this.register('damage', drawDamage);
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

function drawPoint(ctx, x, y, size, color) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, y + 1);
  ctx.lineTo(cx, y + size * 0.22);
  ctx.moveTo(cx, y + size * 0.78);
  ctx.lineTo(cx, y + size - 1);
  ctx.moveTo(x + 1, cy);
  ctx.lineTo(x + size * 0.22, cy);
  ctx.moveTo(x + size * 0.78, cy);
  ctx.lineTo(x + size - 1, cy);
  ctx.stroke();
}

function drawMunition(ctx, x, y, size, color) {
  const cx = x + size * 0.5;
  const bodyTop = y + size * 0.25;
  const bodyBottom = y + size * 0.76;
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(cx, y + 1);
  ctx.lineTo(cx + size * 0.17, bodyTop);
  ctx.lineTo(cx - size * 0.17, bodyTop);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(cx - size * 0.11, bodyTop, size * 0.22, bodyBottom - bodyTop);

  ctx.beginPath();
  ctx.moveTo(cx - size * 0.11, y + size * 0.63);
  ctx.lineTo(x + 1, y + size - 2);
  ctx.lineTo(cx - size * 0.11, y + size * 0.82);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + size * 0.11, y + size * 0.63);
  ctx.lineTo(x + size - 1, y + size - 2);
  ctx.lineTo(cx + size * 0.11, y + size * 0.82);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, bodyTop + 1);
  ctx.lineTo(cx, bodyBottom - 1);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.12, bodyBottom);
  ctx.lineTo(cx, y + size - 1);
  ctx.lineTo(cx + size * 0.12, bodyBottom);
  ctx.stroke();
}

function drawGroundVehicle(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  const bodyY = y + size * 0.42;
  ctx.fillRect(x + size * 0.16, bodyY, size * 0.68, size * 0.26);
  ctx.fillRect(x + size * 0.34, y + size * 0.26, size * 0.28, size * 0.2);
  ctx.fillRect(x + size * 0.62, y + size * 0.34, size * 0.3, size * 0.06);
  ctx.beginPath();
  ctx.arc(x + size * 0.28, y + size * 0.76, size * 0.09, 0, Math.PI * 2);
  ctx.arc(x + size * 0.5, y + size * 0.76, size * 0.09, 0, Math.PI * 2);
  ctx.arc(x + size * 0.72, y + size * 0.76, size * 0.09, 0, Math.PI * 2);
  ctx.fill();
}

function drawSurfaceVehicle(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + size * 0.58);
  ctx.lineTo(x + size * 0.82, y + size * 0.58);
  ctx.lineTo(x + size - 1, y + size * 0.72);
  ctx.lineTo(x + size * 0.18, y + size * 0.82);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(x + size * 0.34, y + size * 0.34, size * 0.24, size * 0.2);
  ctx.fillRect(x + size * 0.46, y + size * 0.18, size * 0.08, size * 0.18);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.18, y + size * 0.88);
  ctx.quadraticCurveTo(x + size * 0.34, y + size * 0.78, x + size * 0.5, y + size * 0.88);
  ctx.quadraticCurveTo(x + size * 0.66, y + size * 0.98, x + size * 0.82, y + size * 0.88);
  ctx.stroke();
}

function drawSubsurfaceVehicle(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x + size * 0.5, y + size * 0.58, size * 0.38, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + size * 0.44, y + size * 0.28, size * 0.12, size * 0.18);
  ctx.fillRect(x + size * 0.38, y + size * 0.26, size * 0.24, size * 0.06);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.16, y + size * 0.86);
  ctx.quadraticCurveTo(x + size * 0.32, y + size * 0.78, x + size * 0.5, y + size * 0.86);
  ctx.quadraticCurveTo(x + size * 0.68, y + size * 0.94, x + size * 0.84, y + size * 0.86);
  ctx.stroke();
}

function drawSpaceVehicle(ctx, x, y, size, color) {
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeRect(x + size * 0.12, y + size * 0.32, size * 0.24, size * 0.36);
  ctx.strokeRect(x + size * 0.64, y + size * 0.32, size * 0.24, size * 0.36);
  ctx.beginPath();
  ctx.moveTo(x + size * 0.36, cy);
  ctx.lineTo(x + size * 0.64, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.42, size * 0.18, -0.45, 0, Math.PI * 2);
  ctx.stroke();
}

function drawControl(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.3;
  const cx = x + size * 0.5;
  const baseY = y + size * 0.68;

  ctx.beginPath();
  ctx.moveTo(x + size * 0.22, baseY);
  ctx.lineTo(x + size * 0.78, baseY);
  ctx.lineTo(x + size * 0.88, y + size * 0.88);
  ctx.lineTo(x + size * 0.12, y + size * 0.88);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  ctx.lineTo(x + size * 0.42, y + size * 0.32);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + size * 0.4, y + size * 0.28, size * 0.13, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + size * 0.66, y + size * 0.78, size * 0.055, 0, Math.PI * 2);
  ctx.arc(x + size * 0.78, y + size * 0.78, size * 0.055, 0, Math.PI * 2);
  ctx.fill();
}

function drawSituation(ctx, x, y, size, color) {
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.25;

  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.moveTo(cx - size * 0.42, cy);
  ctx.lineTo(cx + size * 0.42, cy);
  ctx.moveTo(cx, cy - size * 0.42);
  ctx.lineTo(cx, cy + size * 0.42);
  ctx.stroke();

  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x + size * 0.82, y + size * 0.26);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + size * 0.68, y + size * 0.38, size * 0.055, 0, Math.PI * 2);
  ctx.arc(x + size * 0.36, y + size * 0.62, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

function drawDamage(ctx, x, y, size, color) {
  const cx = x + size * 0.5;
  const cy = y + size * 0.52;
  const r = size * 0.42;

  ctx.beginPath();
  ctx.moveTo(cx, y + 1);
  ctx.lineTo(cx + r * 0.28, cy - r * 0.28);
  ctx.lineTo(x + size - 1, y + size * 0.2);
  ctx.lineTo(cx + r * 0.55, cy + r * 0.05);
  ctx.lineTo(x + size * 0.92, y + size * 0.76);
  ctx.lineTo(cx + r * 0.22, cy + r * 0.32);
  ctx.lineTo(cx + r * 0.08, y + size - 1);
  ctx.lineTo(cx - r * 0.18, cy + r * 0.34);
  ctx.lineTo(x + size * 0.14, y + size * 0.86);
  ctx.lineTo(cx - r * 0.42, cy + r * 0.12);
  ctx.lineTo(x + 1, y + size * 0.38);
  ctx.lineTo(cx - r * 0.3, cy - r * 0.18);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.13, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.08, y + size * 0.08);
  ctx.lineTo(x + size * 0.2, y + size * 0.2);
  ctx.moveTo(x + size * 0.84, y + size * 0.88);
  ctx.lineTo(x + size * 0.94, y + size * 0.98);
  ctx.moveTo(x + size * 0.9, y + size * 0.06);
  ctx.lineTo(x + size * 0.82, y + size * 0.18);
  ctx.stroke();
}
