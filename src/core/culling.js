export function rectsIntersect(a, b) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function cullLayoutNodes(layoutNodes, worldBounds) {
  const visible = [];
  for (const node of layoutNodes) {
    if (rectsIntersect(node, worldBounds)) visible.push(node.index);
  }
  return visible;
}

