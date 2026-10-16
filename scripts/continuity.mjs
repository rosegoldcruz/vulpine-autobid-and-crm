import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig, prepareLock, recover, startVault, finishVault, assertSafe, redact, redactData, atomicWrite, safePath } from './vault-memory.mjs'

// Locate this checkout from the entry point, never from the caller's cwd.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const memory = resolve(root, 'docs/continuity')
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trimEnd()
const read = path => readFileSync(path, 'utf8')
const parse = path => {
  try { return JSON.parse(read(path)) } catch { throw new Error('Unable to read valid JSON; inspect input locally without exposing its contents') }
}
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const required = ['last_change', 'verification', 'decisions', 'open_work', 'blockers', 'next_action']

function validate(handoff) {
  for (const key of required) {
    if (['verification', 'decisions', 'open_work', 'blockers'].includes(key)) {
      if (!Array.isArray(handoff[key]) || handoff[key].some(v => typeof v !== 'string' || !v.trim())) {
        throw new Error(`Handoff requires an array of nonempty strings: ${key}`)
      }
    } else if (typeof handoff[key] !== 'string' || !handoff[key].trim()) {
      throw new Error(`Handoff requires nonempty text: ${key}`)
    }
  }
  if (!handoff.verification.length) throw new Error('Record verification, including failures or checks not run')
}

function snapshot() {
  const manifest = parse(resolve(memory, 'sources.json'))
  const sources = {}
  for (const path of manifest) {
    const full = resolve(root, path)
    if (isAbsolute(path) || relative(root, full).startsWith('..') || /(^|\/)\.env(?:\.|$)/.test(path)) {
      throw new Error('Evidence paths must be repository-relative, non-secret source files')
    }
    try { sources[path] = hash(safePath(root, path)) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      sources[path] = null
    }
  }
  return {
    head: git('rev-parse', 'HEAD'),
    branch: git('branch', '--show-current'),
    // Only names/status, never diffs, environment values, remotes or credentials.
    worktree: git('status', '--short'),
    sources,
  }
}

try {
  if (git('rev-parse', '--show-toplevel') !== root) throw new Error('Entry point must be in its own Git root')
  const config = loadConfig(root)
  // flock owns the lock for the worker's entire lifetime and releases it on exit,
  // including SIGKILL. All supported entry points use this same vault-wide lock.
  if (config && !process.argv.includes('--vault-lock-held')) {
    const child = spawnSync('flock', ['-n', '-E', '75', prepareLock(config), process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2), '--vault-lock-held'], { stdio: 'inherit' })
    if (child.error) throw new Error('Linux flock is required for safe vault access')
    if (child.status === 75) console.error('Vault busy: another continuity process holds the lock; retry')
    process.exit(child.status ?? 1)
  }
  if (config) recover(config)
  const [command, input] = process.argv.slice(2)
  if (command === 'start') {
    const live = snapshot()
    const handoff = parse(resolve(memory, 'handoff.json'))
    validate(handoff)
    const saved = handoff.snapshot
    if (!saved?.sources) throw new Error('Missing saved evidence snapshot; run end with a reviewed handoff')
    const drift = Object.keys({ ...saved.sources, ...live.sources }).filter(path => saved.sources[path] !== live.sources[path])
    const vault = config ? startVault(config, input && input !== '--vault-lock-held' ? input : config.default_project) : undefined
    console.log(JSON.stringify(redactData({
      root, live, saved_head: saved.head,
      head_changed: saved.head !== live.head,
      worktree_changed: saved.worktree !== live.worktree,
      evidence_drift: drift,
      warning: 'Saved prose is reviewed session context, not a live health assertion. Recheck changed evidence and task-relevant runtime before modifying.',
      handoff,
      vault,
    }), null, 2))
    for (const path of ['AGENTS.md', 'docs/continuity/current.md', 'docs/continuity/decisions.md']) {
      console.log(`\n--- ${path} ---\n${redact(read(resolve(root, path)))}`)
    }
  } else if (command === 'end' && input) {
    const supplied = parse(resolve(input))
    validate(supplied)
    assertSafe(supplied)
    // Whitelist fields: input cannot override identity, timestamps or evidence.
    const handoff = Object.fromEntries(required.map(key => [key, supplied[key]]))
    const result = {
      ...handoff,
      recorded_at: new Date().toISOString(),
      snapshot: snapshot(),
    }
    if (config) {
      const saved = finishVault(config, supplied, result)
      console.log(JSON.stringify({ vault: saved }))
    } else atomicWrite(resolve(memory, 'handoff.json'), `${JSON.stringify(result, null, 2)}\n`)
    console.log('Saved reviewed handoff to docs/continuity/handoff.json. Review it before committing.')
  } else {
    throw new Error('Usage: node scripts/continuity.mjs start [project] | end /absolute/path/to/reviewed-handoff.json')
  }
} catch (error) {
  console.error(`Continuity failed: ${error.message}`)
  process.exitCode = 1
}
