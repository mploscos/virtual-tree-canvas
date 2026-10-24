/** Accessible buttons for visible rows. Actions and their meaning belong to the host. */
export declare class RowActions {
    #private;
    controller: any;
    buttons: Map<any, any>;
    buttonsByNodeId: Map<any, any>;
    actionsById: Map<any, any>;
    visibleRowsById: Map<any, any>;
    preparedIcons: Set<any>;
    fullUpdates: number;
    incrementalUpdates: number;
    themeToken: number;
    theme: any;
    stopIconListener: any;
    element: any;
    constructor(controller: any);
    /** @param {object} scene @param {{full?: boolean, dirtyNodeIds?: Set<string>}} invalidation */
    render(scene: object, invalidation?: {
        full?: boolean;
        dirtyNodeIds?: Set<string>;
    }): void;
    destroy(): void;
}
