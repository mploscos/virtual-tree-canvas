export declare class CellEditorManager {
    #private;
    controller: any;
    canvas: any;
    view: any;
    host: any;
    editable: boolean;
    overlay: HTMLInputElement | HTMLSelectElement | null;
    rangeDrag: {
        hit: any;
        data: any;
        node: any;
    } | null;
    overlayKind: string | null;
    overlayNode: any;
    stopFilter: any;
    stopTheme: any;
    onMouseMove: (event: any) => void;
    onMouseUp: () => void;
    constructor({ controller, host }: {
        controller: any;
        host?: null | undefined;
    });
    setEditable(enabled: any): void;
    destroy(): void;
    close(): void;
    /**
     * Keep an in-progress edit while values refresh; cancel if its editor changes.
     */
    reconcile(nodes: any): void;
    handlePointerDown(event: any, hit: any): boolean;
    handleClick(event: any, hit: any): any;
    handleHeaderClick(_event: any, hit: any): boolean;
}
