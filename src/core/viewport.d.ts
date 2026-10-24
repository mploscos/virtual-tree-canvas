export declare class TreeViewport extends EventTarget {
    x: number;
    y: number;
    zoom: number;
    width: number;
    height: number;
    minZoom: number;
    maxZoom: number;
    constructor();
    resize(width: any, height: any): void;
    pan(dx: any, dy: any): void;
    zoomAt(screenX: any, screenY: any, factor: any): void;
    focus(bounds: any): void;
    getWorldBounds(padding?: number): {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    screenToWorld(screenX: any, screenY: any): {
        x: number;
        y: number;
    };
    worldToScreen(worldX: any, worldY: any): {
        x: number;
        y: number;
    };
}
