/**
 * @typedef {Object} Renderer
 * @property {(canvas: HTMLCanvasElement) => Promise<void> | void} initialize
 * @property {(scene: any) => void} setScene
 * @property {(patches: Array<import('../core/types.js').DynamicPatch>) => void} updateDynamicState
 * @property {(frameState: any) => void} render
 */
export type Renderer = {
    initialize: (canvas: HTMLCanvasElement) => Promise<void> | void;
    setScene: (scene: any) => void;
    updateDynamicState: (patches: Array<import('../core/types.js').DynamicPatch>) => void;
    render: (frameState: any) => void;
};
export declare class RendererNotImplemented extends Error {
}
