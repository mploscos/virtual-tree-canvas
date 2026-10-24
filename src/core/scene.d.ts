/**
 * Builds the renderer scene from cold-path layout data and hot-path state maps.
 */
export declare function createScene(model: any, layout: any): {
    model: any;
    layout: any;
    idToLayoutIndex: Map<any, any>;
    dynamicState: any;
};
