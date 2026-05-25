/**
 * Builds the renderer scene from cold-path layout data and hot-path state maps.
 */
export function createScene(model, layout) {
  const idToLayoutIndex = new Map(layout.nodes.map((node) => [node.id, node.index]));
  return {
    model,
    layout,
    idToLayoutIndex,
    dynamicState: model.dynamicState,
  };
}

