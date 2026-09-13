/**
 * Resolve built-in SVG resources independently of the bundled JavaScript location.
 * @param {string | URL} [iconsBaseUrl] Directory URL, with or without a trailing slash.
 */
export function createBuiltinIconUrls(iconsBaseUrl) {
  const base = String(iconsBaseUrl ?? new URL('../../resources/icons/', import.meta.url)).replace(
    /\/+$/,
    ''
  );
  return Object.freeze(
    Object.fromEntries(builtinIconNames.map((name) => [name, `${base}/${name}.svg`]))
  );
}

export const builtinIconNames = Object.freeze([
  'aircraft',
  'bicycle',
  'bird',
  'box',
  'building',
  'bus-vehicle',
  'calendar',
  'car',
  'cat',
  'child',
  'clock',
  'cloud',
  'control',
  'damage',
  'data-bus',
  'database',
  'dog',
  'drone',
  'error',
  'fish',
  'flower',
  'fog',
  'folder',
  'globe',
  'grip',
  'ground',
  'heart',
  'helicopter',
  'insect',
  'inspector-array',
  'inspector-object',
  'inspector-value',
  'leaf',
  'link',
  'lock',
  'moon',
  'munition',
  'network',
  'people',
  'person',
  'pin',
  'placeholder',
  'point',
  'radar',
  'rain',
  'seedling',
  'sensor',
  'server',
  'ship',
  'situation',
  'snow',
  'space',
  'star',
  'star-filled',
  'trash',
  'storm',
  'subsurface',
  'sun',
  'surface',
  'task',
  'thermometer',
  'track',
  'tree',
  'warning',
  'wind'
]);
