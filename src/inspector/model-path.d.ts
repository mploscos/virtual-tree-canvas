export declare function joinPath(parentPath: any, key: any): string;
export declare function splitPath(path: any): (string | number)[];
export declare function getAtPath(model: any, path: any): any;
export declare function setAtPath(model: any, path: any, nextValue: any): any;
export declare function wildcardPath(path: any): string;
export declare function metaForPath(meta: {} | undefined, path: any): any;
export declare function resolveMetaForPath(meta: {} | undefined, path: any): {
    rule: any;
    hasMeta: boolean;
    source: any;
};
