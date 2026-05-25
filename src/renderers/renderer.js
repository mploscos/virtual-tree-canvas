/**
 * @typedef {Object} Renderer
 * @property {(canvas: HTMLCanvasElement) => Promise<void> | void} initialize
 * @property {(scene: any) => void} setScene
 * @property {(patches: Array<import('../core/types.js').DynamicPatch>) => void} updateDynamicState
 * @property {(frameState: any) => void} render
 */

export class RendererNotImplemented extends Error {}

