/** A view of controller filter state. No duplicated query or toggle state. */
export declare class TreeFilterBar {
    controller: any;
    element: any;
    input: any;
    caseButton: any;
    wholeButton: any;
    stop: any;
    constructor(controller: any, document: any);
    button(document: any, label: any, title: any): any;
    onInput: () => any;
    onCase: () => void;
    onWhole: () => void;
    toggle(key: any): void;
    sync(): void;
    setVisible(visible: any): void;
    destroy(): void;
}
