import { fileURLToPath } from 'node:url';
import { runBrowser } from './browser/harness.mjs';
const result = await runBrowser(fileURLToPath(new URL('../', import.meta.url)));
console.log(JSON.stringify(result, null, 2));
if (!Array.isArray(result) || result.some(test => !test.passed)) process.exitCode = 1;
const transferResult = await runBrowser(
  fileURLToPath(new URL('../', import.meta.url)), '/test/browser/transfer.html'
);
console.log(JSON.stringify(transferResult, null, 2));
if (!Array.isArray(transferResult) || transferResult.some(test => !test.passed)) process.exitCode = 1;
const siteResult = await runBrowser(
  fileURLToPath(new URL('../', import.meta.url)), '/test/browser/site.html'
);
console.log(JSON.stringify(siteResult, null, 2));
if (!Array.isArray(siteResult) || siteResult.some(test => !test.passed)) process.exitCode = 1;
