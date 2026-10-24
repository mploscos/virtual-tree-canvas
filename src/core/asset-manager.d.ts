export declare class AssetManager {
    images: Map<any, any>;
    iconIndices: Map<any, any>;
    constructor();
    registerIcon(name: any): any;
    loadImage(name: any, url: any): Promise<HTMLImageElement>;
    getImage(name: any): any;
}
