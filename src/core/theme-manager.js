export const darkTheme = {
  rowHeight: 28,
  indentWidth: 18,
  font: '12px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  monoFont: '12px "JetBrains Mono", "Cascadia Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, monospace',
  colors: {
    background: '#0a0f1c',
    row: '#0a0f1c',
    rowAlt: '#0c1322',
    rowGroup: '#101827',
    rowHover: '#111b2d',
    rowActive: '#15243a',
    rowSelected: '#16345f',
    rowHighlighted: '#27144a',
    rowFocus: '#38bdf8',
    text: '#e8edf4',
    textStrong: '#f8fafc',
    textMuted: '#8ea0b5',
    textSubtle: '#617086',
    guide: '#1b2637',
    chevron: '#8ea0b5',
    focus: '#38bdf8',
    progressTrack: '#182235',
    progressFill: '#3dd889',
    control: '#121b2b',
    controlHover: '#17263a',
    controlActive: '#1c3350',
    badgeFill: '#132132',
    badgeText: '#ffffff',
    border: '#1b2637',
    borderStrong: '#2b3b52',
    shadow: 'rgba(0,0,0,.24)',
  },
  types: {
    root: { icon: 'folder', color: '#38bdf8' },
    system: { icon: 'folder', color: '#818cf8' },
    platform: { icon: 'aircraft', color: '#60a5fa' },
    air: { icon: 'air', color: '#60a5fa' },
    ground: { icon: 'ground', color: '#a3e635' },
    surface: { icon: 'surface', color: '#22d3ee' },
    subsurface: { icon: 'subsurface', color: '#38bdf8' },
    space: { icon: 'space', color: '#c084fc' },
    munition: { icon: 'munition', color: '#fb7185' },
    sensor: { icon: 'radar', color: '#34d399' },
    track: { icon: 'track', color: '#a78bfa' },
    geometry: { icon: 'point', color: '#38bdf8' },
    control: { icon: 'control', color: '#f59e0b' },
    situation: { icon: 'situation', color: '#2dd4bf' },
    damage: { icon: 'damage', color: '#fb7185' },
    warning: { icon: 'warning', color: '#facc15' },
    error: { icon: 'error', color: '#ef4444' },
    task: { icon: 'task', color: '#f97316' },
    bus: { icon: 'bus', color: '#22d3ee' },
    object: { icon: 'inspector-object', color: '#7dd3fc' },
    array: { icon: 'inspector-array', color: '#a78bfa' },
    string: { icon: 'inspector-value', color: '#94a3b8' },
    number: { icon: 'inspector-value', color: '#34d399' },
    boolean: { icon: 'inspector-value', color: '#22c55e' },
    null: { icon: 'inspector-value', color: '#64748b' },
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
    rowAlt: '#f8fafc',
    rowGroup: '#f1f5f9',
    rowHover: '#edf2f7',
    rowActive: '#e0f2fe',
    rowSelected: '#dbeafe',
    rowHighlighted: '#f3e8ff',
    rowFocus: '#0284c7',
    text: '#0f172a',
    textStrong: '#020617',
    textMuted: '#64748b',
    textSubtle: '#94a3b8',
    guide: '#cbd5e1',
    chevron: '#64748b',
    focus: '#0284c7',
    progressTrack: '#e2e8f0',
    progressFill: '#16a34a',
    control: '#ffffff',
    controlHover: '#f1f5f9',
    controlActive: '#e0f2fe',
    badgeText: '#ffffff',
    badgeFill: '#e2e8f0',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    shadow: 'rgba(15,23,42,.1)',
  },
};

export const tacticalTheme = {
  ...darkTheme,
  colors: {
    background: '#050806',
    row: '#050806',
    rowAlt: '#07100a',
    rowGroup: '#0a1710',
    rowHover: '#0d1f13',
    rowActive: '#102c1a',
    rowSelected: '#12351f',
    rowHighlighted: '#372b0a',
    rowFocus: '#7ddc92',
    text: '#d7ffe3',
    textStrong: '#edfff2',
    textMuted: '#7fa88c',
    textSubtle: '#5f806a',
    guide: '#183321',
    chevron: '#7fa88c',
    focus: '#7ddc92',
    progressTrack: '#102217',
    progressFill: '#45d483',
    badgeText: '#031006',
    badgeFill: '#102217',
    border: '#183321',
    borderStrong: '#295337',
    shadow: 'rgba(0,0,0,.3)',
  },
  types: {
    ...darkTheme.types,
    root: { icon: 'folder', color: '#7ddc92' },
    platform: { icon: 'aircraft', color: '#93c572' },
    air: { icon: 'air', color: '#93c572' },
    ground: { icon: 'ground', color: '#c7f36f' },
    surface: { icon: 'surface', color: '#67e8f9' },
    subsurface: { icon: 'subsurface', color: '#7dd3fc' },
    space: { icon: 'space', color: '#d8b4fe' },
    munition: { icon: 'munition', color: '#ff8fab' },
    sensor: { icon: 'radar', color: '#45d483' },
    track: { icon: 'track', color: '#d6f264' },
    geometry: { icon: 'point', color: '#7ddc92' },
    control: { icon: 'control', color: '#ffd166' },
    situation: { icon: 'situation', color: '#8be9d9' },
    damage: { icon: 'damage', color: '#ff8fab' },
    warning: { icon: 'warning', color: '#ffd166' },
    error: { icon: 'error', color: '#ff5c5c' },
    bus: { icon: 'bus', color: '#67e8f9' },
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
