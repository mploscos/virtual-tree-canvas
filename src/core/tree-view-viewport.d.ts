export declare class TreeViewViewport extends EventTarget {
    rowHeight: number;
    indentWidth: number;
    headerHeight: number;
    renderInsetX: number;
    renderInsetY: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
    contentWidth: number;
    contentHeight: number;
    zoom: number;
    scrollbarSize: number;
    verticalScrollbarVisible: boolean;
    horizontalScrollbarVisible: boolean;
    constructor({ rowHeight, indentWidth, headerHeight }?: {
        headerHeight?: number | undefined;
        indentWidth?: number | undefined;
        rowHeight?: number | undefined;
    });
    get contentViewportWidth(): number;
    get rowViewportHeight(): number;
    resize(width: any, height: any): void;
    setContentSize(width: any, height: any): void;
    setScrollbarState({ size, vertical, horizontal }?: {
        horizontal?: boolean | undefined;
        size?: number | undefined;
        vertical?: boolean | undefined;
    }): boolean;
    scrollBy(dx: any, dy: any): void;
    scrollTo(x: any, y: any): void;
    /** @param {number} rowIndex @param {'start' | 'center' | 'end' | 'nearest'} align */
    scrollRowIntoView(rowIndex: number, align?: 'start' | 'center' | 'end' | 'nearest'): void;
    clamp(): void;
}
