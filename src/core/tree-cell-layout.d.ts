/**
 * Share tree-cell positions between painting, hit testing and tooltips.
 */
export declare function treeCellLayout(depth: any, indentWidth: any, hasHierarchy: any, iconSize?: number): {
    chevronX: number | null;
    iconX: number;
    labelX: number;
};
