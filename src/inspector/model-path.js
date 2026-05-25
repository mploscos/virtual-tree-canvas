export function joinPath(parentPath, key) {
  return parentPath ? `${parentPath}.${key}` : String(key);
}

export function splitPath(path) {
  if (!path) return [];
  return String(path).split('.').filter(Boolean).map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

export function getAtPath(model, path) {
  let value = model;
  for (const part of splitPath(path)) {
    if (value == null) return undefined;
    value = value[part];
  }
  return value;
}

export function setAtPath(model, path, nextValue) {
  const parts = splitPath(path);
  if (!parts.length) throw new Error('Cannot replace root model value through setAtPath');
  let target = model;
  for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
  const key = parts[parts.length - 1];
  const oldValue = target[key];
  target[key] = nextValue;
  return oldValue;
}

export function wildcardPath(path) {
  return String(path)
    .split('.')
    .map((part) => (/^\d+$/.test(part) ? '*' : part))
    .join('.');
}

export function metaForPath(meta = {}, path) {
  return resolveMetaForPath(meta, path).rule;
}

export function resolveMetaForPath(meta = {}, path) {
  const exact = meta[path];
  if (exact) return { rule: exact, hasMeta: true, source: path };
  const wildcard = wildcardPath(path);
  const wildcardRule = meta[wildcard];
  if (wildcardRule) return { rule: wildcardRule, hasMeta: true, source: wildcard };
  return { rule: {}, hasMeta: false, source: '' };
}
