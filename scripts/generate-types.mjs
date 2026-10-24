import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = await mkdtemp(path.join(tmpdir(), 'vtc-types-'));
const tsc = process.env.TSC_BIN || path.join(root, 'node_modules/typescript/bin/tsc');

async function collectSources(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectSources(file));
    else if (entry.name.endsWith('.js')) files.push(file);
  }
  return files;
}

async function copyDeclarations(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    if (entry.isDirectory()) await copyDeclarations(from);
    else if (entry.name.endsWith('.d.ts') && from !== path.join(out, 'index.d.ts')) {
      const destination = path.join(root, 'src', path.relative(out, from));
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(from, destination);
    }
  }
}

try {
  const sources = await collectSources(path.join(root, 'src'));
  const result = spawnSync(process.execPath, [
    tsc, '--allowJs', '--declaration', '--emitDeclarationOnly', '--outDir', out,
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    '--skipLibCheck', '--noEmitOnError', 'false', ...sources
  ], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exitCode = result.status || 1;
  else await copyDeclarations(out);
} finally {
  await rm(out, { recursive: true, force: true });
}
