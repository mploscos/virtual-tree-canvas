/**
 * Create the inspector's live sRGB picker.
 * @param {{document: Document, label: string, value: unknown, alpha: boolean,
 *   onInput: (value: string) => void}} options
 */
export function createColorEditor({ document, label, value, alpha, onInput }) {
  const panel = document.createElement('div');
  panel.className = 'vtc-editor vtc-editor-color';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', label);
  Object.assign(panel.style, {
    display: 'grid', gap: '8px', padding: '10px', borderRadius: '7px',
    boxSizing: 'border-box', overflow: 'auto', overscrollBehavior: 'contain'
  });

  const plane = document.createElement('div');
  plane.tabIndex = 0;
  plane.setAttribute('role', 'slider');
  plane.setAttribute('aria-label', 'Saturation and brightness');
  plane.setAttribute('aria-description', 'Left and right adjust saturation. Up and down adjust brightness.');
  plane.setAttribute('aria-valuemin', '0');
  plane.setAttribute('aria-valuemax', '100');
  Object.assign(plane.style, {
    position: 'relative', height: '96px', overflow: 'hidden', borderRadius: '4px',
    backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
    cursor: 'crosshair', touchAction: 'none', outlineOffset: '-2px'
  });
  const marker = document.createElement('span');
  Object.assign(marker.style, {
    position: 'absolute', width: '10px', height: '10px', border: '2px solid white',
    borderRadius: '50%', boxSizing: 'border-box', boxShadow: '0 0 2px 1px #000',
    transform: 'translate(-50%, -50%)', pointerEvents: 'none'
  });
  plane.append(marker);
  panel.append(plane);

  const hue = addRange(document, panel, 'Hue', 359);
  const opacity = alpha ? addRange(document, panel, 'Opacity', 100, true) : null;
  const hexLabel = document.createElement('label');
  hexLabel.style.cssText = CONTROL_ROW_STYLE;
  hexLabel.append('HEX');
  const field = document.createElement('span');
  field.style.cssText = 'display:grid;position:relative;min-width:0';
  const hex = document.createElement('input');
  hex.type = 'text';
  hex.spellcheck = false;
  hex.maxLength = alpha ? 9 : 7;
  Object.assign(hex.style, {
    width: '100%', minWidth: '0', height: '28px', boxSizing: 'border-box',
    font: 'inherit', color: 'inherit', background: 'transparent', borderRadius: '5px',
    border: '1px solid var(--vtc-color-border)', padding: '3px 30px 3px 7px'
  });
  const preview = document.createElement('span');
  preview.className = 'vtc-color-swatch';
  preview.setAttribute('aria-hidden', 'true');
  Object.assign(preview.style, {
    position: 'absolute', top: '5px', right: '5px', width: '18px', height: '18px',
    boxSizing: 'border-box', pointerEvents: 'none', borderRadius: '3px',
    border: '1px solid var(--vtc-color-border)', backgroundSize: 'auto,8px 8px'
  });
  field.append(hex, preview);
  hexLabel.append(field);
  panel.append(hexLabel);

  let state = toHsv(readColor(document, value));
  if (!alpha) state.opacity = 255;
  let current = formatColor(state);
  const sync = () => {
    plane.style.backgroundColor = 'hsl(' + state.hue + ' 100% 50%)';
    marker.style.left = 'clamp(7px, ' + (state.saturation * 100) + '%, calc(100% - 7px))';
    marker.style.top = 'clamp(7px, ' + ((1 - state.brightness) * 100) + '%, calc(100% - 7px))';
    const saturation = Math.round(state.saturation * 100);
    plane.setAttribute('aria-valuenow', String(saturation));
    plane.setAttribute('aria-valuetext', saturation + '% saturation, ' +
      Math.round(state.brightness * 100) + '% brightness');
    hue.input.value = String(Math.round(state.hue) % 360);
    if (opacity) {
      const percentage = Math.round(state.opacity * 100 / 255);
      opacity.input.value = String(percentage);
      opacity.input.setAttribute('aria-valuetext', percentage + '%');
      opacity.output.textContent = percentage + '%';
    }
    hex.value = current;
    hex.setCustomValidity('');
    preview.style.backgroundImage = 'linear-gradient(' + current + ',' + current +
      '), repeating-conic-gradient(#c0c0c0 0% 25%, white 0% 50%)';
  };
  const publish = () => {
    const next = formatColor(state);
    const changed = current !== next;
    current = next;
    sync();
    if (changed) onInput(current);
  };
  const pick = (event) => {
    const rect = plane.getBoundingClientRect();
    state.saturation = clamp((event.clientX - rect.x) / rect.width);
    state.brightness = 1 - clamp((event.clientY - rect.y) / rect.height);
    publish();
  };
  plane.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    plane.setPointerCapture(event.pointerId);
    pick(event);
  });
  plane.addEventListener('pointermove', (event) => {
    if (plane.hasPointerCapture(event.pointerId)) pick(event);
  });
  plane.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    if (event.key === 'ArrowLeft') state.saturation = clamp(state.saturation - step);
    else if (event.key === 'ArrowRight') state.saturation = clamp(state.saturation + step);
    else if (event.key === 'ArrowDown') state.brightness = clamp(state.brightness - step);
    else if (event.key === 'ArrowUp') state.brightness = clamp(state.brightness + step);
    else return;
    event.preventDefault();
    publish();
  });
  hue.input.addEventListener('input', () => {
    state.hue = hue.input.valueAsNumber;
    publish();
  });
  if (opacity) {
    opacity.input.addEventListener('input', () => {
      state.opacity = Math.round(opacity.input.valueAsNumber * 255 / 100);
      publish();
    });
  }
  const commitHex = () => {
    const color = parseHex(hex.value);
    if (!color || (!alpha && color[3] !== 255)) {
      hex.setCustomValidity(alpha ? 'Enter a HEX colour, with optional opacity.' : 'Enter an opaque HEX colour.');
      return false;
    }
    if (hex.value !== current) {
      state = toHsv(color);
      publish();
    }
    return true;
  };
  hex.addEventListener('input', () => hex.setCustomValidity(''));
  hex.addEventListener('change', commitHex);

  sync();
  return { panel, hex, commit: commitHex };
}

const CONTROL_ROW_STYLE =
  'display:grid;grid-template-columns:52px minmax(0,1fr);gap:6px;align-items:center';

function addRange(document, panel, text, max, showValue = false) {
  const label = document.createElement('label');
  label.style.cssText = CONTROL_ROW_STYLE;
  label.append(text);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(max);
  input.style.cssText = 'width:100%;min-width:0;margin:0;accent-color:var(--vtc-color-accent)';
  label.append(input);
  let output = null;
  if (showValue) {
    output = document.createElement('span');
    output.style.cssText = 'text-align:right;font-variant-numeric:tabular-nums';
    output.setAttribute('aria-hidden', 'true');
    label.style.gridTemplateColumns += ' 30px';
    label.append(output);
  }
  panel.append(label);
  return { input, output };
}

/** @param {Document} document @param {string} color */
export function colorSchemeFor(document, color) {
  const [red, green, blue] = readColor(document, color);
  return (red * 0.2126 + green * 0.7152 + blue * 0.0722) < 128 ? 'dark' : 'light';
}

function readColor(document, value) {
  if (typeof value === 'string') {
    const hex = parseHex(value);
    if (hex) return hex;
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = value;
    const normalized = ctx.fillStyle;
    if (normalized.startsWith('rgba(')) {
      const [red, green, blue, alpha] = normalized.slice(5, -1).split(',').map(Number);
      return [red, green, blue, Math.round(alpha * 255)];
    }
    const rgb = parseHex(normalized);
    if (rgb) return rgb;
  }
  return [0, 0, 0, 255];
}

function parseHex(value) {
  let match = /^#?([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value.trim())?.[1];
  if (!match) return null;
  if (match.length < 5) match = [...match].map((digit) => digit.repeat(2)).join('');
  if (match.length === 6) match += 'ff';
  return match.match(/../g).map((pair) => Number.parseInt(pair, 16));
}

function toHsv([red, green, blue, opacity]) {
  const max = Math.max(red, green, blue);
  const spread = max - Math.min(red, green, blue);
  let hue = 0;
  if (spread) {
    if (max === red) hue = (green - blue) / spread;
    else if (max === green) hue = 2 + (blue - red) / spread;
    else hue = 4 + (red - green) / spread;
  }
  return { hue: (hue * 60 + 360) % 360, saturation: max ? spread / max : 0,
    brightness: max / 255, opacity };
}

function formatColor({ hue, saturation, brightness, opacity }) {
  const channels = [5, 3, 1].map((offset) => {
    const k = (offset + hue / 60) % 6;
    return Math.round(255 * brightness * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1))));
  });
  if (opacity !== 255) channels.push(opacity);
  return '#' + channels.map((channel) => channel.toString(16).padStart(2, '0')).join('');
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}
