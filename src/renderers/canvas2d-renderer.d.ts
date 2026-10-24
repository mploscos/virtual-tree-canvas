export declare class Canvas2DRenderer {
    #private;
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    scene: any;
    themeManager: any;
    visibleNodeIndices: any[];
    constructor({ themeManager }?: {});
    /** @param {HTMLCanvasElement} canvas */
    initialize(canvas: HTMLCanvasElement): void;
    setScene(scene: any): void;
    updateDynamicState(_patches: any): void;
    render(frameState: any): void;
    pick(worldX: any, worldY: any): any;
}
