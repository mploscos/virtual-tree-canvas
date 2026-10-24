export declare class PatchBatcher {
    /** @type {Map<string, import('./types.js').NodeDynamicState>} */
    pending: Map<string, import('./types.js').NodeDynamicState>;
    constructor();
    /** @param {string} id @param {import('./types.js').NodeDynamicState} state */
    set(id: string, state: import('./types.js').NodeDynamicState): void;
    /** @param {Array<import('./types.js').DynamicPatch>} patches */
    addMany(patches: Array<import('./types.js').DynamicPatch>): void;
    flush(): {
        id: string;
        state: import("./types.js").NodeDynamicState;
    }[];
    clear(): void;
    get size(): number;
}
