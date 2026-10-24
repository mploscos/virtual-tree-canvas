export declare function createWorkerTreeState(nodes: any): {
    nodes: any;
    idToIndex: Map<any, any>;
    childrenByParent: Map<any, any>;
    parentById: Map<any, any>;
    roots: any[];
    pathById: Map<any, any>;
    records: any;
};
export declare function searchWorkerTree(state: any, query: any, options?: {}): any[];
export declare function rebuildWorkerRows(state: any, options?: {}): {
    rows: any[];
    contentHeight: number;
    contentWidth: number;
};
export declare function getIncludedIdsForQuery(state: any, query: any, candidateIds?: null, options?: {}): {
    matchingIds: any[];
    includedIds: Set<any>;
};
