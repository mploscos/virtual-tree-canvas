export function valueTypeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value === 'object' ? 'object' : typeof value;
}

export function resolveEditorType(value, meta = {}) {
  const valueType = valueTypeOf(value);
  if (meta.button) return 'button';
  if (meta.options) return 'select';
  if (meta.color) return 'color';
  if (valueType === 'boolean') return 'checkbox';
  if (valueType === 'number' && (meta.min !== undefined || meta.max !== undefined)) return 'range';
  if (valueType === 'number') return 'number';
  if (valueType === 'string') return 'text';
  if (valueType === 'object') return 'group';
  if (valueType === 'array') return 'array';
  if (valueType === 'null') return 'text';
  return 'readonly';
}

export function formatInspectorValue(value, meta = {}) {
  if (meta.button) return meta.button;
  if (meta.options) {
    const match = Object.entries(meta.options).find(([, optionValue]) => optionValue === value);
    if (match) return match[0];
  }
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') return Array.isArray(value) ? `Array(${value.length})` : 'Object';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  return String(value);
}
