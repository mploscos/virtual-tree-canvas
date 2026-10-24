/** DOM tooltip shared by framework adapters and standalone canvas hosts. */
export declare class TreeTooltip {
    #private;
    controller: any;
    canvas: any;
    host: any;
    pointer: {
        clientX: any;
        clientY: any;
    } | null;
    targetKey: any;
    element: any;
    stops: any[];
    constructor({ controller, host }: {
        controller: any;
        host?: any;
    });
    onMove: (event: any) => void;
    /** Refresh a visible tooltip without requiring another mousemove event. */
    refresh: () => void;
    hide: () => void;
    onLeave: () => void;
    destroy(): void;
}
