import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Preserve deployment-specific public settings without keeping .env files in source.
const env = {};
const settings = '/etc/vulpine-platform/ai/build.env';
if (existsSync(settings)) {
  for (const line of readFileSync(settings, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...env, ...process.env }, stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
