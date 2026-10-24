/**
 * Resolve an optional external directory of built-in SVG files.
 * @param {string | URL} iconsBaseUrl Directory URL, with or without a trailing slash.
 */
export declare function createBuiltinIconUrls(iconsBaseUrl: string | URL): Readonly<{
    [k: string]: string;
}>;
export declare const builtinIconNames: readonly string[];
