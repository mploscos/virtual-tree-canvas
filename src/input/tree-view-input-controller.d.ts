export declare class TreeViewInputController {
    #private;
    controller: import("../tree-view-controller.js").TreeViewController;
    canvas: any;
    hoveredId: any;
    resizeDrag: {
        columnId: any;
        startX: number;
        startWidth: any;
    } | null;
    selectionDrag: {
        x: any;
        y: any;
        startX: any;
        startY: any;
        anchor: any;
        additive: any;
        previous: any[];
        endIndex: null;
        active: boolean;
    } | null;
    selectionFrame: any;
    suppressSelectionClick: boolean;
    cellEditor: import("../inspector/cell-editor-manager.js").CellEditorManager | null;
    view: any;
    hoveredHitKey: any;
    /**
     * @param {{
     *   controller: import('../tree-view-controller.js').TreeViewController,
     *   cellEditor?: import('../inspector/cell-editor-manager.js').CellEditorManager | null
     * }} options
     */
    constructor(options: {
        controller: import('../tree-view-controller.js').TreeViewController;
        cellEditor?: import('../inspector/cell-editor-manager.js').CellEditorManager | null;
    });
    destroy(): void;
}
