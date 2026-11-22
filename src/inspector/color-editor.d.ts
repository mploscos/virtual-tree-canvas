/**
 * Create the inspector's live sRGB picker.
 * @param {{document: Document, label: string, value: unknown, alpha: boolean,
 *   onInput: (value: string) => void}} options
 */
export declare function createColorEditor({ document, label, value, alpha, onInput }: {
    document: Document;
    label: string;
    value: unknown;
    alpha: boolean;
    onInput: (value: string) => void;
}): {
    panel: HTMLDivElement;
    hex: HTMLInputElement;
    commit: () => boolean;
};
/** @param {Document} document @param {string} color */
export declare function colorSchemeFor(document: Document, color: string): "dark" | "light";
