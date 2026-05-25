/**
 * @param {number} count
 * @returns {Array<import('../src/core/types.js').TreeNode>}
 */
export function generateTree(count = 10000) {
  const nodes = [{ id: 'root', label: 'Operations Theater', type: 'root', tags: ['root', 'ops'] }];
  const systems = ['Command', 'Air Defense', 'ISR', 'Logistics', 'Mission Planning'];
  const platforms = [
    { label: 'air', type: 'air', tags: ['air', 'platform'] },
    { label: 'ground', type: 'ground', tags: ['ground', 'platform'] },
    { label: 'surface', type: 'surface', tags: ['surface', 'platform'] },
    { label: 'sub', type: 'subsurface', tags: ['subsurface', 'platform'] },
    { label: 'space', type: 'space', tags: ['space', 'platform'] },
  ];
  const sensors = ['Radar', 'Emitter Beam', 'EO Camera', 'SIGINT', 'IFF', 'Telemetry'];
  const tasks = ['Patrol', 'Track', 'Inspect', 'Relay', 'Intercept'];

  for (const [index, label] of systems.entries()) {
    nodes.push({
      id: `system-${index}`,
      parentId: 'root',
      label: `${label} System`,
      type: 'system',
      tags: ['system', label.toLowerCase().replaceAll(' ', '-')],
    });
  }

  let i = nodes.length;
  let platformCursor = 0;
  while (i < count) {
    const system = nodes[1 + (i % systems.length)];
    const platformId = `platform-${i}`;
    const platform = platforms[platformCursor % platforms.length];
    platformCursor++;
    nodes.push({
      id: platformId,
      parentId: system.id,
      label: `${platform.label}-${100 + (i % 900)}`,
      type: platform.type,
      tags: ['platform', ...platform.tags, i % 5 === 0 ? 'priority' : 'normal'],
      data: { ordinal: i },
    });
    i++;
    if (i >= count) break;

    for (let s = 0; s < 3 && i < count; s++, i++) {
      nodes.push({
        id: `sensor-${i}`,
        parentId: platformId,
        label: `${sensors[(i + s) % sensors.length]} ${i}`,
        type: i % 19 === 0 ? 'warning' : 'sensor',
        tags: ['sensor', sensors[(i + s) % sensors.length].toLowerCase().replaceAll(' ', '-')],
        data: { ordinal: i },
      });
    }

    for (let t = 0; t < 4 && i < count; t++, i++) {
      const isWarning = i % 23 === 0;
      const isMunition = !isWarning && i % 17 === 0;
      const isGeometry = !isWarning && !isMunition && i % 13 === 0;
      nodes.push({
        id: `${isWarning ? 'warning' : isMunition ? 'munition' : isGeometry ? 'point' : 'track'}-${i}`,
        parentId: platformId,
        label: `${isWarning ? 'Warning' : isMunition ? 'Mini Missile' : isGeometry ? 'Pointer' : 'Track'} ${String(i).padStart(5, '0')}`,
        type: isWarning ? 'warning' : isMunition ? 'munition' : isGeometry ? 'geometry' : 'track',
        tags: [isWarning ? 'warning' : isMunition ? 'munition' : isGeometry ? 'geometry' : 'track', i % 11 === 0 ? 'hot' : 'stable'],
        data: { ordinal: i },
      });
    }

    for (let task = 0; task < 2 && i < count; task++, i++) {
      const isControl = i % 29 === 0;
      const isSituation = !isControl && i % 37 === 0;
      nodes.push({
        id: `${isControl ? 'control' : isSituation ? 'situation' : 'task'}-${i}`,
        parentId: platformId,
        label: `${isControl ? 'Control' : isSituation ? 'Situation' : `${tasks[i % tasks.length]} Task`} ${i}`,
        type: i % 31 === 0 ? 'error' : isControl ? 'control' : isSituation ? 'situation' : 'task',
        tags: [isControl ? 'control' : isSituation ? 'situation' : 'task', tasks[i % tasks.length].toLowerCase()],
        data: { ordinal: i },
      });
    }
  }

  return nodes.slice(0, count);
}
