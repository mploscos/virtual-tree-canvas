export declare class ModelInspectorBuilder {
    #private;
    arrayItemTitle(meta: any, arrayPath: any, index: any, item: any): string;
    build(model: any, meta?: {}, options?: {}): any[];
}
export declare function inspectorNodeId(path: any): string;
export declare function inspectorColumns(): {
    id: string;
    label: string;
    width: number;
    minWidth: number;
    align: string;
    kind: string;
    sortable: boolean;
    value: (node: any) => any;
}[];
export declare function inspectorPaneColumns(): {
    id: string;
    label: string;
    width: number;
    minWidth: number;
    align: string;
    kind: string;
    sortable: boolean;
    value: (node: any) => any;
}[];
