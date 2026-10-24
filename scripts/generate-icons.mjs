import { readFile, writeFile } from 'node:fs/promises';
import { builtinIconNames } from '../src/assets/icons.js';

const directory = new URL('../resources/icons/', import.meta.url);
const sources = await Promise.all(
    builtinIconNames.map(async (name) => (await readFile(new URL(`${name}.svg`, directory), 'utf8')).trim())
);
const entries = builtinIconNames.map((name, index) =>
    `    ${JSON.stringify(name)}: ${JSON.stringify(sources[index])}`
).join(',\n');
const module = `// Generated from resources/icons by npm run icons:generate.\n` +
    `/** @type {Readonly<Record<string, string>>} */\n` +
    `export const builtinIconSources = Object.freeze({\n${entries}\n});\n`;
await writeFile(new URL('../src/assets/icon-sources.js', import.meta.url), module);
