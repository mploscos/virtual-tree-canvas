/**
 * @param {number} count
 * @returns {Array<import('../src/core/types.js').TreeNode>}
 */
export function generateTree(count = 10000) {
  const nodes = [{ id: 'root', label: 'Operations Theater', type: 'root', tags: ['root', 'ops'] }];
  const systems = ['Command', 'Air Defense', 'ISR', 'Logistics', 'Mission Planning'];
  const platforms = ['Falcon', 'Hawk', 'Sentinel', 'Atlas', 'Orion', 'Viper'];
  const sensors = ['Radar', 'EO Camera', 'SIGINT', 'IFF', 'Telemetry'];
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
  while (i < count) {
    const system = nodes[1 + (i % systems.length)];
    const platformId = `platform-${i}`;
    nodes.push({
      id: platformId,
      parentId: system.id,
      label: `${platforms[i % platforms.length]}-${100 + (i % 900)}`,
      type: 'platform',
      tags: ['platform', i % 5 === 0 ? 'priority' : 'normal'],
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
      nodes.push({
        id: `${isWarning ? 'warning' : 'track'}-${i}`,
        parentId: platformId,
        label: `${isWarning ? 'Warning' : 'Track'} ${String(i).padStart(5, '0')}`,
        type: isWarning ? 'warning' : 'track',
        tags: [isWarning ? 'warning' : 'track', i % 11 === 0 ? 'hot' : 'stable'],
        data: { ordinal: i },
      });
    }

    for (let task = 0; task < 2 && i < count; task++, i++) {
      nodes.push({
        id: `task-${i}`,
        parentId: platformId,
        label: `${tasks[i % tasks.length]} Task ${i}`,
        type: i % 31 === 0 ? 'error' : 'task',
        tags: ['task', tasks[i % tasks.length].toLowerCase()],
        data: { ordinal: i },
      });
    }
  }

  return nodes.slice(0, count);
}

