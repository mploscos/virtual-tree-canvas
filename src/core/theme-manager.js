export const darkTheme = {
  rowHeight: 28,
  indentWidth: 18,
  font: '12px system-ui, sans-serif',
  colors: {
    background: '#0b1020',
    row: '#0b1020',
    rowHover: '#111827',
    rowSelected: '#1e3a8a',
    rowHighlighted: '#3b0764',
    text: '#e5e7eb',
    textMuted: '#94a3b8',
    guide: '#1f2937',
    chevron: '#94a3b8',
    focus: '#38bdf8',
    progressTrack: '#1f2937',
    progressFill: '#22c55e',
    badgeText: '#ffffff',
    border: '#1f2937',
  },
  types: {
    root: { icon: 'folder', color: '#38bdf8' },
    system: { icon: 'folder', color: '#818cf8' },
    platform: { icon: 'aircraft', color: '#60a5fa' },
    sensor: { icon: 'radar', color: '#34d399' },
    track: { icon: 'track', color: '#a78bfa' },
    warning: { icon: 'warning', color: '#facc15' },
    error: { icon: 'error', color: '#ef4444' },
    task: { icon: 'task', color: '#f97316' },
  },
  statuses: {
    0: { label: 'OK', color: '#22c55e' },
    1: { label: 'WARN', color: '#facc15' },
    2: { label: 'ERR', color: '#ef4444' },
  },
};

export const lightTheme = {
  ...darkTheme,
  colors: {
    background: '#f8fafc',
    row: '#ffffff',
    rowHover: '#e2e8f0',
    rowSelected: '#bfdbfe',
    rowHighlighted: '#f3e8ff',
    text: '#0f172a',
    textMuted: '#64748b',
    guide: '#cbd5e1',
    chevron: '#64748b',
    focus: '#0284c7',
    progressTrack: '#e2e8f0',
    progressFill: '#16a34a',
    badgeText: '#ffffff',
    border: '#e2e8f0',
  },
};

export const tacticalTheme = {
  ...darkTheme,
  colors: {
    background: '#050806',
    row: '#050806',
    rowHover: '#0d1f13',
    rowSelected: '#12351f',
    rowHighlighted: '#372b0a',
    text: '#d7ffe3',
    textMuted: '#7fa88c',
    guide: '#183321',
    chevron: '#7fa88c',
    focus: '#7ddc92',
    progressTrack: '#102217',
    progressFill: '#45d483',
    badgeText: '#031006',
    border: '#183321',
  },
  types: {
    ...darkTheme.types,
    root: { icon: 'folder', color: '#7ddc92' },
    platform: { icon: 'aircraft', color: '#93c572' },
    sensor: { icon: 'radar', color: '#45d483' },
    track: { icon: 'track', color: '#d6f264' },
    warning: { icon: 'warning', color: '#ffd166' },
    error: { icon: 'error', color: '#ff5c5c' },
  },
};

export const themes = {
  dark: darkTheme,
  light: lightTheme,
  tactical: tacticalTheme,
};

export class ThemeManager extends EventTarget {
  constructor(theme = darkTheme) {
    super();
    this.theme = normalizeTheme(theme);
  }

  setTheme(theme) {
    this.theme = normalizeTheme(theme);
    this.dispatchEvent(new Event('change'));
  }

  get() {
    return this.theme;
  }

  /** @param {import('./types.js').TreeNode} node @param {import('./types.js').NodeDynamicState} state */
  resolveNodeStyle(node, state = {}) {
    const typeRule = this.theme.types[node?.type ?? ''] ?? {};
    const statusRule = this.resolveStatus(state.status);
    return {
      icon: state.icon ?? node?.icon ?? typeRule.icon ?? 'placeholder',
      color: state.color ?? typeRule.color ?? this.theme.colors.progressFill,
      typeColor: typeRule.color ?? this.theme.colors.progressFill,
      status: statusRule,
      font: this.theme.font,
      colors: this.theme.colors,
    };
  }

  resolveStatus(status) {
    const key = status ?? 0;
    return this.theme.statuses[key] ?? { label: String(key), color: this.theme.colors.textMuted };
  }
}

function normalizeTheme(theme = {}) {
  const base = mergeTheme(darkTheme, theme);
  return {
    ...base,
    // Compatibility aliases for the graph renderer and older row renderer code.
    background: base.colors.background,
    nodeFill: base.colors.progressTrack,
    nodeStroke: base.colors.border,
    edge: base.colors.guide,
    label: base.colors.text,
    mutedLabel: base.colors.textMuted,
    selected: base.colors.focus,
    selectedRow: base.colors.rowSelected,
    highlighted: base.colors.rowHighlighted,
    highlightedRow: base.colors.rowHighlighted,
    hoverRow: base.colors.rowHover,
    rowBorder: base.colors.border,
    focusOutline: base.colors.focus,
    indentGuide: base.colors.guide,
    chevron: base.colors.chevron,
    chevronMuted: base.colors.textMuted,
    progress: base.colors.progressFill,
  };
}

function mergeTheme(base, override) {
  return {
    ...base,
    ...override,
    colors: { ...base.colors, ...(override.colors ?? {}) },
    types: { ...base.types, ...(override.types ?? {}) },
    statuses: { ...base.statuses, ...(override.statuses ?? {}) },
  };
}

