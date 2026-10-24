/**
 * Pointer interaction for manual row order and selected-row data dragging.
 */
export declare class RowReorderInput {
    controller: any;
    canvas: any;
    view: any;
    gesture: {
        id: any;
        part: any;
        payload: any;
        items: {
            nodeId: any;
            payload: any;
            label: any;
        }[];
        sourceSelected: any;
        pointerId: any;
        startX: number;
        startY: number;
        point: {
            x: number;
            y: number;
        };
        reorder: any;
        dragging: boolean;
    } | null;
    frame: any;
    previousTouchAction: any;
    stops: any[];
    status: any;
    dragBadge: any;
    dragGhost: any;
    suppressClick: boolean | undefined;
    constructor(controller: any);
    syncMode(): void;
    onDown: (event: any) => void;
    onMove: (event: any) => void;
    onUp: (event: any) => void;
    onCancel: (event: any) => void;
    onKey: (event: any) => void;
    point(event: any): {
        x: number;
        y: number;
    };
    updateTarget(): void;
    scheduleScroll(): void;
    emitDrag(type: any, originalEvent: any): void;
    resolveDragItems(source: any, sourcePayload: any): {
        nodeId: any;
        payload: any;
        label: any;
    }[];
    updateDragBadge(event: any): void;
    updateDragGhost(event: any): void;
    cancel: (notify?: boolean) => void;
    destroy(): void;
}
