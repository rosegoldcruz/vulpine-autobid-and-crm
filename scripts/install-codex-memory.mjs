import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { atomicWrite } from './vault-memory.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(process.env.CODEX_HOME ?? '/root/.codex')
for (const name of ['AGENTS.md', 'hooks.json']) {
  const content = readFileSync(resolve(root, 'infra/codex', name), 'utf8')
  const destination = resolve(target, name)
  if (existsSync(destination) && readFileSync(destination, 'utf8') !== content) throw new Error(`Existing ${name} differs; merge explicitly rather than overwriting`)
  atomicWrite(destination, content)
}
console.log('Installed global AEON instructions and SessionStart definition. Hook execution still requires /hooks trust; no trust state or sandbox settings changed.')
