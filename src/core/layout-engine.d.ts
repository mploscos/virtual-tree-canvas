/**
 * Simple top-down hierarchical layout. Replaceable by design.
 */
export declare class TreeLayoutEngine {
    nodeWidth: any;
    nodeHeight: any;
    levelGap: any;
    rowGap: any;
    constructor(options?: {});
    /**
     * @param {import('./tree-model.js').TreeModel} model
     */
    layout(model: import('./tree-model.js').TreeModel): {
        nodes: import("./types.js").LayoutNode[];
        edges: {
            sourceIndex: number;
            targetIndex: number;
        }[];
        bounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        typeMap: Map<any, any>;
        iconMap: Map<any, any>;
    };
}
