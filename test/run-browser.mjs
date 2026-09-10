import { fileURLToPath } from 'node:url';
import { runBrowser } from './browser/harness.mjs';
const result = await runBrowser(fileURLToPath(new URL('../', import.meta.url)));
console.log(JSON.stringify(result, null, 2));
if (!Array.isArray(result) || result.some(test => !test.passed)) process.exitCode = 1;
