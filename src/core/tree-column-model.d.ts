/** Compare raw column values consistently in the main thread and tree worker. */
export declare function compareSortValues(aValue: unknown, bValue: unknown): number;
export declare const builtInColumns: {
    tree: {
        id: string;
        label: string;
        width: number;
        minWidth: number;
        align: string;
        kind: string;
        value: (node: any) => any;
    };
    status: {
        id: string;
        label: string;
        width: number;
        minWidth: number;
        align: string;
        kind: string;
        value: (_node: any, state: any) => any;
    };
    value: {
        id: string;
        label: string;
        width: number;
        minWidth: number;
        align: string;
        kind: string;
        value: (_node: any, state: any) => any;
    };
    progress: {
        id: string;
        label: string;
        width: number;
        minWidth: number;
        align: string;
        kind: string;
        value: (_node: any, state: any) => any;
    };
    type: {
        id: string;
        label: string;
        width: number;
        minWidth: number;
        align: string;
        kind: string;
        value: (node: any) => any;
    };
    updated: {
        id: string;
        label: string;
        width: number;
        minWidth: number;
        align: string;
        kind: string;
        value: (_node: any, state: any) => any;
    };
};
export declare class TreeColumnModel {
    #private;
    columns: any[];
    contentWidth: number;
    sort: {
        columnId: null;
        direction: null;
    };
    rowReorder: boolean | undefined;
    rowActionCount: any;
    constructor(columns?: {
        id: string;
        label: string;
        width: number;
        minWidth: number;
        align: string;
        kind: string;
        value: (node: any) => any;
    }[]);
    setColumns(columns?: {
        id: string;
        label: string;
        width: number;
        minWidth: number;
        align: string;
        kind: string;
        value: (node: any) => any;
    }[]): void;
    setRowReorder(enabled: any): void;
    setRowActions(count: any): void;
    /**
     * @param {number} x
     */
    getColumnAt(x: number): any;
    getColumn(id: any): any;
    resizeColumn(id: any, width: any): boolean;
    moveColumn(id: any, targetIndex: any): boolean;
    setSort(columnId: any, direction: any): boolean;
    getResizeHandleAt(x: any, tolerance?: number): any;
}
export declare function defaultTreeTableColumns(): {
    id: string;
    label: string;
    width: number;
    minWidth: number;
    align: string;
    kind: string;
    value: (_node: any, state: any) => any;
}[];
