/**
 * Supported TreeView configuration options and defaults.
 */
export declare const treeViewDefaults: Readonly<{
    mode: "tree";
    presentation: "pane";
    nodes: readonly never[];
    model: null;
    meta: null;
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
}>;
export declare const treeViewOptionNames: readonly string[];
export declare function validateTreeViewOptions(options: any): void;
