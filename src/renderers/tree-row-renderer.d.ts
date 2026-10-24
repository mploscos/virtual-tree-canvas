export declare class TreeRowRenderer {
    #private;
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    scene: any;
    iconRegistry: any;
    renderedRows: number;
    iconRenderFrame: number | null;
    invalidate: any;
    preparedIconThemeKey: any;
    stopIconListener: any;
    constructor({ iconRegistry }?: {});
    /**
     * @param {HTMLCanvasElement} canvas
     */
    initialize(canvas: HTMLCanvasElement): void;
    setScene(scene: any): void;
    setInvalidationHandler(invalidate: any): void;
    destroy(): void;
    updateDynamicState(_patches: any): void;
    render(scene: any, time?: number): void;
}
