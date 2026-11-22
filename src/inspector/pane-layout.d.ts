export declare const inspectorArrayButtonWidth = 22;
/** @param {{valueType?: string, disabled?: boolean, meta?: {readonly?: boolean}, arrayRemovable?: boolean}|null} [data] */
export declare function inspectorPaneLayout(width: any, depth?: number, indentWidth?: number, editorType?: string, labelEnd?: number, data?: {
    valueType?: string;
    disabled?: boolean;
    meta?: {
        readonly?: boolean;
    };
    arrayRemovable?: boolean;
} | null, editable?: boolean): {
    editorLeft: number;
    editorWidth: number;
    contentWidth: number;
    arrayAddX: number | null;
    arrayRemoveX: number | null;
};
