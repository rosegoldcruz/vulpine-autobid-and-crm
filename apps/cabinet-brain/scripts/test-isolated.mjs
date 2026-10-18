import { cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const fixture = mkdtempSync(path.join(tmpdir(), 'vulpine-brain-tests-'));
let status = 1;
try {
  cpSync(root, fixture, { recursive: true, filter: source => {
    const relative = path.relative(root, source);
    const first = relative.split(path.sep)[0];
    return !['node_modules', '.next', '.data', '.git'].includes(first) && !relative.endsWith('.tsbuildinfo');
  } });
  symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
  const options = { cwd: fixture, env: { ...process.env, VULPINE_TEST_BUILD_READY: '1' }, stdio: 'inherit' };
  const build = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], options);
  if (build.status !== 0) status = build.status ?? 1;
  else status = spawnSync(process.execPath, [path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run'], options).status ?? 1;
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
process.exitCode = status;
