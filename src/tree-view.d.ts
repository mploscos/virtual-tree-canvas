import { TreeViewController } from './tree-view-controller.js';
import { TreeFilterBar } from './input/tree-filter-bar.js';
/**
 * Mount a tree or inspector with a canvas, filter controls and editors.
 */
export declare class TreeView {
    host: any;
    document: any;
    window: any;
    destroyed: boolean;
    flushing: boolean;
    scheduled: boolean;
    pending: any;
    refreshPending: boolean;
    options: {
        mode: "tree";
        presentation: "pane";
        columns: null;
        theme: "dark";
        flatRoot: true;
        enforceMeta: false;
        filter: true;
        filterPlacement: "auto";
        markUpdated: true;
        editable: true;
        rowActions: readonly never[];
        rowDrag: null;
        rowReorder: false;
        multiSelect: false;
        scrollChaining: false;
        initialExpandDepth: 1;
        rowHeight: undefined;
        indentWidth: undefined;
        showHeader: true;
        headerHeight: 28;
        iconResolver: null;
        fontFamily: null;
        nodes: never[];
        model: {};
        meta: {};
    };
    element: any;
    canvasHost: any;
    canvas: any;
    _controller: TreeViewController;
    filterBar: TreeFilterBar;
    stopTheme: () => void;
    fontFamily: any;
    constructor(host: any, options?: {});
    get controller(): TreeViewController;
    /**
     * Merge options; several changes in one task are applied once.
     */
    configure(patch: any): this;
    flush(): void;
    syncLayout(): void;
    applyTheme(): void;
    refreshFont: () => void;
    syncTheme(): void;
    setData(nodes: any): void;
    setModel(model: any, meta?: any): void;
    setColumns(columns: any): void;
    setTheme(theme: any): void;
    on(type: any, listener: any): () => void;
    off(type: any, listener: any): void;
    setDynamicState(patches: any): void;
    setInspectorValue(path: any, value: any, options: any): boolean;
    setFilter(query: any, options: any): void;
    clearFilter(): void;
    getRowOrder(parentId: any): string[];
    moveRow(id: any, index: any, options: any): boolean;
    moveRowBy(id: any, offset: any, options: any): boolean;
    getSelection(): any[];
    setSelection(ids: any): void;
    clearSelection(): void;
    search(query: any, options: any): any[];
    clearSearch(): void;
    getSearchState(): {
        query: string;
        results: any[];
        cursor: number;
        current: any;
        count: number;
    };
    nextSearchResult(): any;
    previousSearchResult(): any;
    focusNode(id: any, options: any): boolean;
    scrollToNode(id: any, align: any): boolean;
    expandAll(): void;
    collapseAll(): void;
    registerIcon(name: any, source: any): any;
    destroy(): void;
}
