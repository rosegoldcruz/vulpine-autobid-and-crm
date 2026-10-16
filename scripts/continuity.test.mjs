import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(new URL('./continuity.mjs', import.meta.url))

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'aeon-continuity-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
  put('scripts/continuity.mjs', '')
  copyFileSync(entry, join(root, 'scripts/continuity.mjs'))
  copyFileSync(fileURLToPath(new URL('./vault-memory.mjs', import.meta.url)), join(root, 'scripts/vault-memory.mjs'))
  put('AGENTS.md', 'Start: node scripts/continuity.mjs start\n')
  put('docs/continuity/current.md', 'Project: Vulpine Platform\nDesign: preserve existing teal tokens\n')
  put('docs/continuity/decisions.md', 'Preserve approved design and server authorization.\n')
  put('docs/continuity/sources.json', JSON.stringify(['AGENTS.md', 'docs/continuity/current.md', 'source.txt']))
  put('source.txt', 'verified source\n')
  git('init', '-q')
  git('add', '.')
  git('-c', 'user.name=Continuity Test', '-c', 'user.email=continuity@example.invalid', 'commit', '-qm', 'fixture baseline')
  const run = (...args) => spawnSync(process.execPath, [join(root, 'scripts/continuity.mjs'), ...args], {
    cwd: tmpdir(), encoding: 'utf8',
  })
  const input = join(root, '.git/reviewed.json')
  const handoff = {
    last_change: 'Added verified continuity entry point',
    verification: ['Fixture source inspected; independent restore to be tested'],
    decisions: ['Preserve approved design'],
    open_work: ['Reconcile existing tracker edits'],
    blockers: [],
    next_action: 'Inspect tracker changes with their owner',
  }
  writeFileSync(input, JSON.stringify(handoff))
  return { root, put, git, run, input, handoff }
}

test('a separate process restores five required handoff facts from an unrelated cwd', t => {
  const f = fixture(t)
  f.put('unrelated.txt', 'user work must survive')
  assert.equal(f.run('end', f.input).status, 0)
  const restored = f.run('start')
  assert.equal(restored.status, 0, restored.stderr)
  const data = JSON.parse(restored.stdout.split('\n--- AGENTS.md ---')[0])
  assert.equal(data.root, f.root)
  assert.deepEqual(data.handoff.last_change, f.handoff.last_change)
  assert.deepEqual(data.handoff.decisions, f.handoff.decisions)
  assert.deepEqual(data.handoff.open_work, f.handoff.open_work)
  assert.equal(data.handoff.next_action, f.handoff.next_action)
  assert.match(restored.stdout, /Project: Vulpine Platform/)
  assert.match(restored.stdout, /preserve existing teal tokens/)
  assert.deepEqual(data.evidence_drift, [])
  assert.equal(readFileSync(join(f.root, 'unrelated.txt'), 'utf8'), 'user work must survive')
})

test('source drift, deletion and new commits are reported instead of silently trusting memory', t => {
  const f = fixture(t)
  assert.equal(f.run('end', f.input).status, 0)
  f.put('source.txt', 'changed after handoff')
  f.git('add', 'source.txt')
  f.git('-c', 'user.name=Continuity Test', '-c', 'user.email=continuity@example.invalid', 'commit', '-qm', 'change source')
  let data = JSON.parse(f.run('start').stdout.split('\n--- AGENTS.md ---')[0])
  assert.equal(data.head_changed, true)
  assert.deepEqual(data.evidence_drift, ['source.txt'])
  rmSync(join(f.root, 'source.txt'))
  data = JSON.parse(f.run('start').stdout.split('\n--- AGENTS.md ---')[0])
  assert.equal(data.live.sources['source.txt'], null)
  assert.equal(data.worktree_changed, true)
})

test('invalid handoffs and secret evidence paths fail without replacing the previous handoff', t => {
  const f = fixture(t)
  assert.equal(f.run('end', f.input).status, 0)
  const saved = readFileSync(join(f.root, 'docs/continuity/handoff.json'), 'utf8')
  writeFileSync(f.input, JSON.stringify({ ...f.handoff, verification: [] }))
  assert.equal(f.run('end', f.input).status, 1)
  assert.equal(readFileSync(join(f.root, 'docs/continuity/handoff.json'), 'utf8'), saved)
  f.put('docs/continuity/sources.json', '[".env.local"]')
  assert.equal(f.run('start').status, 1)
  assert.equal(readFileSync(join(f.root, 'docs/continuity/handoff.json'), 'utf8'), saved)
})
