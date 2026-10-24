export declare class TreeSearchIndex {
    #private;
    records: any[];
    results: any[];
    cursor: number;
    lastQuery: string;
    constructor();
    /** @param {import('./tree-model.js').TreeModel} model */
    rebuild(model: import('./tree-model.js').TreeModel): void;
    /** @param {import('./tree-model.js').TreeModel} model */
    invalidate(model: import('./tree-model.js').TreeModel): void;
    /**
     * @param {string} query
     * @param {{ fields?: string[], limit?: number, caseSensitive?: boolean, wholeWord?: boolean }} options
     */
    search(query: string, options?: {
        fields?: string[];
        limit?: number;
        caseSensitive?: boolean;
        wholeWord?: boolean;
    }): any[];
    nextSearchResult(): any;
    previousSearchResult(): any;
    currentSearchResult(): any;
    clear(): void;
}
