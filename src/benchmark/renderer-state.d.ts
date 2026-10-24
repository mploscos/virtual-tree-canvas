export declare function captureTreeViewState(controller: any): {
    scrollX: any;
    scrollY: any;
    selection: any;
    focusedId: any;
    searchQuery: any;
    searchResults: any;
    searchCursor: any;
    searchMatches: Set<any>;
    filterQuery: any;
    sort: any;
    columns: any;
    expanded: Set<any>;
    theme: any;
};
export declare function restoreTreeViewState(controller: any, state: any): void;
export declare function sceneSignature(scene: any): {
    visibleRange: any;
    viewport: {
        scrollX: any;
        scrollY: any;
        width: any;
        height: any;
        contentWidth: any;
        contentHeight: any;
    };
    columns: any;
    rows: any;
    selection: any[];
    hoverNodeId: any;
    focusNodeId: any;
    searchMatches: any[];
    sort: any;
    filterQuery: any;
};
