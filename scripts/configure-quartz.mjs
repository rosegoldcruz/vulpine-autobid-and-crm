import { readFileSync, existsSync, lstatSync, readlinkSync, symlinkSync, renameSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { atomicWrite } from './vault-memory.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const quartz = resolve(process.argv[2] ?? '/opt/quartz')
const vault = realpathSync(JSON.parse(readFileSync(resolve(repo, 'docs/continuity/vault.json'), 'utf8')).vault)
const content = resolve(quartz, 'content')
try { if (!lstatSync(content).isSymbolicLink()) throw new Error('Refusing to replace a real content directory') } catch (e) { if (e.code !== 'ENOENT') throw e }
const config = resolve(quartz, 'quartz.ts')
const original = readFileSync(config, 'utf8')
const managed = readFileSync(resolve(repo, 'infra/quartz/quartz.ts'), 'utf8')
const expected = 'import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"\n\nconst config = await loadQuartzConfig()\nexport default config\nexport const layout = await loadQuartzLayout()\n'
if (original !== expected && original !== managed) throw new Error('Quartz config has unrelated edits; reconcile before installation')
if (!existsSync(resolve(quartz, 'aeon-quartz.ts.backup'))) atomicWrite(resolve(quartz, 'aeon-quartz.ts.backup'), original)
// Install restrictive policy first, then fix the source. Never run a build or deploy.
atomicWrite(resolve(quartz, 'aeon-privacy.mjs'), readFileSync(resolve(repo, 'infra/quartz/privacy.mjs'), 'utf8'))
atomicWrite(resolve(quartz, 'aeon-privacy.d.mts'), readFileSync(resolve(repo, 'infra/quartz/privacy.d.mts'), 'utf8'))
atomicWrite(config, managed)
if (!existsSync(content) || readlinkSync(content) !== vault) {
  const temporary = resolve(quartz, 'content.aeon-next')
  if (existsSync(temporary)) throw new Error('Unexpected pending Quartz symlink; inspect before retry')
  symlinkSync(vault, temporary)
  renameSync(temporary, content)
}
console.log('Quartz source corrected; explicit private-note policy installed; Assets disabled. No build or publication performed.')
