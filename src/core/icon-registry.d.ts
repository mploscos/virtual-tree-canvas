/**
 * Icon source registry for the Canvas2D tree renderer.
 *
 * SVG icons remain editable files, but are decoded to an ImageBitmap (or a
 * small canvas fallback) only once for each size, device-pixel-ratio and
 * colour combination. The render hot path is therefore a single drawImage.
 */
export declare class IconRegistry {
    #private;
    icons: Map<any, any>;
    listeners: Set<any>;
    pixelRatio: any;
    constructor({ pixelRatio, iconsBaseUrl }?: {});
    /** Register an SVG string/URL, an image URL, ImageBitmap, or legacy Canvas draw function. */
    register(name: any, icon: any): any;
    get(name: any): any;
    /** Listen for a decoded icon becoming ready, so hosts can repaint once. */
    onChange(listener: any): () => boolean;
    /**
     * Starts loading and rasterising a known set of icons ahead of first paint.
     * A colour is part of the cache key because theme colours are baked into SVG
     * assets that use currentColor.
     */
    prepare({ icons, size, color, pixelRatio }?: {
        color?: string | undefined;
        icons?: MapIterator<any> | undefined;
        pixelRatio?: any;
        size?: number | undefined;
    }): Promise<any[]>;
    draw(ctx: any, name: any, x: any, y: any, size: any, color: any): void;
}
