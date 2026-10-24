export declare class TreeSelectionManager extends EventTarget {
    selected: Set<any>;
    hovered: any;
    focused: any;
    constructor();
    setHover(id: any): void;
    select(id: any, additive?: boolean): void;
    toggle(id: any): void;
    clear(): void;
    toPatches(): {
        id: any;
        state: {
            selected: boolean;
        };
    }[];
}
