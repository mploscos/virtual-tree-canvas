export declare class PointerController {
    #private;
    canvas: any;
    viewport: any;
    renderer: any;
    onHover: any;
    onClick: any;
    dragging: boolean;
    lastX: number;
    lastY: number;
    downX: number;
    downY: number;
    constructor({ canvas, viewport, renderer, onHover, onClick }: {
        canvas: any;
        onClick: any;
        onHover: any;
        renderer: any;
        viewport: any;
    });
    destroy(): void;
}
