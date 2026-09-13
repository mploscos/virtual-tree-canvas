import { fileURLToPath } from 'node:url';
import { runBrowser } from '../../test/browser/harness.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const result = await runBrowser(root, '/scripts/diagnostics/profile-dynamic-updates.html');
console.log(JSON.stringify(result, null, 2));
