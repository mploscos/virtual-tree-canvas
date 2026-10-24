import { formatInspectorValue, resolveEditorType, valueTypeOf } from './editor-resolver.js';
import { joinPath, resolveMetaForPath } from './model-path.js';

export class ModelInspectorBuilder {
  arrayItemTitle(meta, arrayPath, index, item) {
    return inspectorArrayItemTitle(meta, arrayPath, index, item);
  }

  build(model, meta = {}, options = {}) {
    const nodes = [];
    const context = {
      meta,
      enforceMeta: Boolean(options.enforceMeta),
    };
    if (options.flatRoot && model && typeof model === 'object' && !Array.isArray(model)) {
      for (const [childKey, childValue] of Object.entries(model)) {
        this.#visit({ nodes, value: childValue, key: childKey, path: childKey, parentId: null, context });
      }
      return nodes;
    }
    this.#visit({ nodes, value: model, key: 'model', path: '', parentId: null, context });
    return nodes;
  }

  #visit({ nodes, value, key, path, parentId, context, arrayIndex = null, arrayItemTitle = '' }) {
    const { rule, hasMeta } = resolveMetaForPath(context.meta, path);
    const valueType = valueTypeOf(value);
    const editorType = resolveEditorType(value, rule);
    const id = inspectorNodeId(path);
    const label = rule.label ?? labelForKey(key, value, rule);
    const structural = valueType === 'object' || valueType === 'array';
    const metaDisabled = context.enforceMeta && !hasMeta && !structural;
    nodes.push({
      id,
      parentId,
      label,
      type: rule.type ?? inspectorNodeType(valueType, editorType),
      icon: rule.icon,
      data: {
        inspector: true,
        path,
        key,
        arrayIndex,
        arrayItemTitle,
        value,
        valueText: formatInspectorValue(value, rule),
        valueType,
        editorType,
        meta: rule,
        hasMeta,
        readonly: Boolean(rule.readonly || metaDisabled || editorType === 'readonly' || structural),
        disabled: Boolean(rule.disabled || metaDisabled),
      },
    });

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const childPath = joinPath(path, index);
        const itemTitle = this.arrayItemTitle(context.meta, path, index, item);
        this.#visit({
          nodes,
          value: item,
          key: itemTitle || `[${index}]`,
          path: childPath,
          parentId: id,
          context,
          arrayIndex: index,
          arrayItemTitle: itemTitle ? String(itemTitle) : '',
        });
      });
    } else if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) {
        this.#visit({ nodes, value: childValue, key: childKey, path: joinPath(path, childKey), parentId: id, context });
      }
    }
  }
}

function inspectorArrayItemTitle(meta, arrayPath, index, item) {
  const { rule: arrayRule } = resolveMetaForPath(meta, arrayPath);
  const { rule: itemRule } = resolveMetaForPath(meta, joinPath(arrayPath, index));
  const title = itemRule.label ?? arrayRule.itemTitle?.(index, item) ?? arrayItemSummary(item);
  return title == null ? '' : String(title);
}

function arrayItemSummary(value) {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (!value || typeof value !== 'object') return '';
  for (const key of ['name', 'label', 'title', 'id']) {
    const field = value[key];
    if ((typeof field === 'string' && field.trim()) || typeof field === 'number')
      return String(field);
  }
  const preview = Object.entries(value)
    .filter(([, field]) => field === null || ['string', 'number', 'boolean'].includes(typeof field))
    .slice(0, 2)
    .map(([key, field]) => `${key}: ${formatInspectorValue(field)}`)
    .join(' · ');
  if (preview) return preview;
  const count = Object.keys(value).length;
  return count ? `Object (${count})` : 'Empty object';
}

export function inspectorNodeId(path) {
  return `model:${path || '$'}`;
}

export function inspectorColumns() {
  return [
    {
      id: 'property',
      label: 'Property',
      width: 300,
      minWidth: 160,
      align: 'left',
      kind: 'tree',
      sortable: false,
      value: (node) => node.label ?? node.id,
    },
    {
      id: 'value',
      label: 'Value',
      width: 260,
      minWidth: 140,
      align: 'left',
      kind: 'inspectorValue',
      sortable: false,
      value: (node) => node.data?.valueText ?? '',
    },
    {
      id: 'type',
      label: 'Type',
      width: 96,
      minWidth: 72,
      align: 'left',
      kind: 'inspectorType',
      sortable: false,
      value: (node) => node.data?.valueType ?? '',
    },
    {
      id: 'description',
      label: 'Description',
      width: 220,
      minWidth: 120,
      align: 'left',
      kind: 'inspectorDescription',
      sortable: false,
      value: (node) => node.data?.meta?.description ?? '',
    },
  ];
}

export function inspectorPaneColumns() {
  return [
    {
      id: 'pane',
      label: 'Inspector',
      width: 560,
      minWidth: 260,
      align: 'left',
      kind: 'inspectorPane',
      sortable: false,
      value: (node) => node.label ?? node.id,
    },
  ];
}

function labelForKey(key, value, meta) {
  if (meta.label) return meta.label;
  if (typeof key === 'number') return `[${key}]`;
  return String(key);
}

function inspectorNodeType(valueType, editorType) {
  if (valueType === 'array') return 'array';
  if (valueType === 'object') return 'object';
  if (editorType === 'button') return 'task';
  return valueType;
}
