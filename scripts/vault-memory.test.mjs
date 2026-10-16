import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync, spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, existsSync, readdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'aeon-vault-test-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  const root = join(base, 'repo'), vault = join(base, 'vault')
  const put = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text) }
  for (const file of ['continuity.mjs', 'vault-memory.mjs']) {
    put(join(root, 'scripts', file), '')
    copyFileSync(fileURLToPath(new URL(file, import.meta.url)), join(root, 'scripts', file))
  }
  put(join(root, 'AGENTS.md'), 'Fixture startup: continuity start\n')
  put(join(root, 'docs/continuity/current.md'), 'Project fixture; preserve existing teal design.\n')
  put(join(root, 'docs/continuity/decisions.md'), 'Preserve authenticated workflow.\n')
  put(join(root, 'docs/continuity/sources.json'), '["AGENTS.md"]')
  const handoff = { last_change: 'Fixture baseline', verification: ['Fixture initialized'], decisions: ['Preserve teal design'], open_work: ['Inspect fixture task'], blockers: [], next_action: 'Inspect fixture source' }
  put(join(root, 'docs/continuity/handoff.json'), JSON.stringify({ ...handoff, snapshot: { sources: {} } }))
  put(join(vault, 'projects/Test.md'), '---\ntitle: Test\ncreated: 2026-10-15\nupdated: 2026-10-15\ntype: project\ntags: [project]\nsources: [fixture]\nconfidence: high\ncontested: false\n---\n# Test\n\nIdentity: Test Company. Design: preserve teal.\nDecision: use existing stack. Source: [[sources/Reference]].\nOpen task: run verification. Next action: inspect source.\n')
  put(join(vault, 'companies/Test.md'), '# Test Company\nVerified fixture identity.\n')
  put(join(vault, 'people/Engineer.md'), '# Fixture Engineer\nRole: verification.\n')
  put(join(vault, 'sources/Reference.md'), '# Source\nExisting fixture evidence.\n')
  put(join(vault, 'raw/immutable.md'), 'Do not modify source material.\n')
  put(join(vault, 'index.md'), '# Index\n- [[projects/Test]]\n')
  put(join(vault, 'log.md'), '# Mutation log\nExisting entry.\n')
  const config = { vault, default_project: 'test', projects: { test: { identity: 'Test Company project', note: 'projects/Test.md', records: [{ role: 'project', path: 'projects/Test.md' }, { role: 'identity', path: 'companies/Test.md' }, { role: 'person', path: 'people/Engineer.md' }, { role: 'source', path: 'sources/Reference.md' }] } } }
  put(join(root, 'docs/continuity/vault.json'), JSON.stringify(config))
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
  git('init', '-q'); git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture')
  const run = (args, env = {}) => spawnSync(process.execPath, [join(root, 'scripts/continuity.mjs'), ...args], { cwd: tmpdir(), encoding: 'utf8', env: { ...process.env, ...env } })
  const parse = result => { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout.split('\n--- AGENTS.md ---')[0]) }
  const start = () => parse(run(['start']))
  const input = session => {
    const data = { ...handoff, session_id: session.vault.session_id, last_change: 'Verified fixture result', confirmed_facts: [{ statement: 'Fixture source check passed', evidence: ['node fixture-check: passed'] }], assumptions: ['External fixture provider not checked'] }
    const file = join(base, `${data.session_id}.json`)
    put(file, JSON.stringify(data))
    return { file, data }
  }
  const killOn = target => {
    const module = join(base, 'fault.mjs')
    put(module, `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module'; const rename=fs.renameSync; fs.renameSync=(a,b)=>{if(b===process.env.AEON_TEST_KILL_TARGET&&process.env.AEON_TEST_BEFORE_RENAME)process.kill(process.pid,'SIGKILL'); rename(a,b); if(b===process.env.AEON_TEST_KILL_TARGET)process.kill(process.pid,'SIGKILL')}; syncBuiltinESMExports();`)
    return { NODE_OPTIONS: `--import=${module}`, AEON_TEST_KILL_TARGET: target }
  }
  return { base, root, vault, put, run, start, input, killOn, config }
}
const read = path => readFileSync(path, 'utf8')

test('vault → fresh process → verified completion → second fresh process, indexed and logged once', t => {
  const f = fixture(t), first = f.start(), input = f.input(first)
  assert.equal(first.vault.identity, 'Test Company project')
  const context = first.vault.records.map(r => r.content).join('\n')
  for (const fact of ['preserve teal', 'use existing stack', 'sources/Reference', 'Open task', 'Next action', 'Fixture Engineer']) assert.ok(context.includes(fact))
  assert.equal(f.run(['end', input.file]).status, 0)
  const second = f.start()
  const latest = second.vault.records.find(r => r.role === 'latest-result')
  for (const fact of ['Verified fixture result', 'Fixture source check passed', 'node fixture-check: passed', 'Assumptions (unconfirmed)', 'External fixture provider not checked', 'Next action']) assert.ok(latest.content.includes(fact))
  const before = ['index.md', 'log.md', 'projects/Test.md'].map(p => read(join(f.vault, p)))
  assert.equal(f.run(['end', input.file]).status, 0)
  assert.deepEqual(['index.md', 'log.md', 'projects/Test.md'].map(p => read(join(f.vault, p))), before)
  assert.equal(readdirSync(join(f.vault, 'sources/aeon-sessions/test')).length, 1)
  assert.equal(read(join(f.vault, 'raw/immutable.md')), 'Do not modify source material.\n')
  f.put(input.file, JSON.stringify({ ...input.data, next_action: 'Altered retry' }))
  assert.equal(f.run(['end', input.file]).status, 1)
})

test('later sessions inherit accumulated decisions as well as the newest result', t => {
  const f = fixture(t), a = f.input(f.start())
  assert.equal(f.run(['end', a.file]).status, 0)
  const b = f.input(f.start())
  f.put(b.file, JSON.stringify({ ...b.data, decisions: ['Keep existing source authority'], last_change: 'Second verified result' }))
  assert.equal(f.run(['end', b.file]).status, 0)
  const fresh = f.start()
  const note = fresh.vault.records.find(r => r.path === 'projects/Test.md').content
  assert.ok(note.includes('Preserve teal design'))
  assert.ok(note.includes('Keep existing source authority'))
  assert.ok(fresh.vault.records.find(r => r.role === 'latest-result').content.includes('Second verified result'))
})

test('stale sessions and external note edits fail without overwriting or duplicating work', t => {
  const f = fixture(t), a = f.input(f.start()), b = f.input(f.start())
  assert.equal(f.run(['end', a.file]).status, 0)
  const saved = read(join(f.vault, 'projects/Test.md'))
  assert.match(f.run(['end', b.file]).stderr, /context conflict/)
  assert.equal(read(join(f.vault, 'projects/Test.md')), saved)
  const c = f.input(f.start())
  f.put(join(f.vault, 'companies/Test.md'), '# A human changed this note\n')
  assert.match(f.run(['end', c.file]).stderr, /context conflict/)
  assert.equal(read(join(f.vault, 'companies/Test.md')), '# A human changed this note\n')
  assert.equal(readdirSync(join(f.vault, 'sources/aeon-sessions/test')).length, 1)
})

test('simultaneous processes serialize or report busy; exact retry adds one result', async t => {
  const f = fixture(t), input = f.input(f.start())
  const run = () => new Promise(resolve => {
    const child = spawn(process.execPath, [join(f.root, 'scripts/continuity.mjs'), 'end', input.file], { cwd: tmpdir() })
    let err = ''; child.stderr.on('data', b => { err += b }); child.on('exit', status => resolve({ status, err }))
  })
  const results = await Promise.all([run(), run()])
  assert.ok(results.some(r => r.status === 0))
  for (const r of results) assert.ok(r.status === 0 || r.status === 75, r.err)
  assert.equal(f.run(['end', input.file]).status, 0)
  assert.equal(readdirSync(join(f.vault, 'sources/aeon-sessions/test')).length, 1)
})

test('SIGKILL after journal or each individual file rename recovers idempotently on fresh startup', async t => {
  for (const stage of ['journal', 'source', 'project', 'index', 'log', 'handoff', 'receipt']) {
    await t.test(stage, t => {
      const f = fixture(t), start = f.start(), input = f.input(start), id = start.vault.session_id
      const target = {
        journal: join(f.vault, `.aeon/transactions/${id}.json`), source: join(f.vault, `sources/aeon-sessions/test/${id}.md`), project: join(f.vault, 'projects/Test.md'), index: join(f.vault, 'index.md'), log: join(f.vault, 'log.md'), handoff: join(f.root, 'docs/continuity/handoff.json'), receipt: join(f.vault, `.aeon/receipts/${id}.json`),
      }[stage]
      assert.notEqual(f.run(['end', input.file], f.killOn(target)).status, 0)
      assert.ok(existsSync(join(f.vault, `.aeon/transactions/${id}.json`)))
      const restored = f.start()
      assert.ok(restored.vault.records.some(r => r.role === 'latest-result' && r.content.includes('Verified fixture result')))
      assert.equal(f.run(['end', input.file]).status, 0)
      assert.equal(readdirSync(join(f.vault, '.aeon/transactions')).length, 0)
      assert.equal(read(join(f.vault, 'index.md')).split(`session ${id}]]`).length - 1, 1)
      assert.equal(read(join(f.vault, 'log.md')).split(`AEON session ${id}`).length - 1, 1)
    })
  }
})

test('recovery detects intervening manual edits and leaves journal and edits intact', t => {
  const f = fixture(t), start = f.start(), input = f.input(start), id = start.vault.session_id
  const original = read(join(f.vault, 'projects/Test.md'))
  assert.notEqual(f.run(['end', input.file], f.killOn(join(f.vault, `sources/aeon-sessions/test/${id}.md`))).status, 0)
  f.put(join(f.vault, 'projects/Test.md'), original + '\nHuman change while interrupted.\n')
  const result = f.run(['start'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Recovery conflict/)
  assert.ok(read(join(f.vault, 'projects/Test.md')).includes('Human change'))
  assert.ok(existsSync(join(f.vault, `.aeon/transactions/${id}.json`)))
  // Explicit reconciliation restoring the expected baseline permits roll-forward.
  f.put(join(f.vault, 'projects/Test.md'), original)
  assert.equal(f.run(['start']).status, 0)
})

test('interruptions before atomic rename leave retryable temp files, never partial canonical records', async t => {
  for (const stage of ['journal', 'source']) await t.test(stage, t => {
    const f = fixture(t), first = f.start(), input = f.input(first), id = first.vault.session_id
    const target = join(f.vault, stage === 'journal' ? `.aeon/transactions/${id}.json` : `sources/aeon-sessions/test/${id}.md`)
    const result = f.run(['end', input.file], { ...f.killOn(target), AEON_TEST_BEFORE_RENAME: '1' })
    assert.notEqual(result.status, 0)
    assert.ok(!existsSync(target))
    assert.ok(existsSync(`${target}.aeon-tmp`))
    const fresh = f.start()
    if (stage === 'source') assert.ok(fresh.vault.records.some(r => r.role === 'latest-result'))
    assert.equal(f.run(['end', input.file]).status, 0)
    assert.ok(!existsSync(`${target}.aeon-tmp`))
    assert.equal(readdirSync(join(f.vault, 'sources/aeon-sessions/test')).length, 1)
  })
})

test('secrets are redacted on load and rejected before repository, vault or journal persistence', t => {
  const f = fixture(t)
  const secret = 'sk-proj-' + 'syntheticCredentialForFixtureOnly123456'
  f.put(join(f.vault, 'companies/Test.md'), `# Test\nOPENAI_API_KEY=${secret}\npassword: fixture-password-value\n`)
  const first = f.start()
  const text = JSON.stringify(first)
  assert.ok(!text.includes(secret)); assert.ok(!text.includes('fixture-password-value'))
  const input = f.input(first), prior = read(join(f.root, 'docs/continuity/handoff.json'))
  for (const value of [secret, 'password: fixture-only-password', '{"password":"fixture-only-password"}', 'Bearer synthetic-bearer-value', 'postgres://user:fixture-pass@localhost/db', '-----BEGIN PRIVATE KEY-----\nfixture-only\n-----END PRIVATE KEY-----']) {
    f.put(input.file, JSON.stringify({ ...input.data, last_change: value }))
    const result = f.run(['end', input.file])
    assert.equal(result.status, 1)
    assert.ok(!result.stderr.includes(value))
    assert.equal(read(join(f.root, 'docs/continuity/handoff.json')), prior)
    assert.equal(readdirSync(join(f.vault, '.aeon/transactions')).length, 0)
    assert.ok(!existsSync(join(f.vault, 'sources/aeon-sessions')))
  }
  f.put(input.file, JSON.stringify({ ...input.data, password: 'fixture-only-password' }))
  assert.equal(f.run(['end', input.file]).status, 1)
  f.put(input.file, secret)
  const malformed = f.run(['end', input.file])
  assert.equal(malformed.status, 1)
  assert.ok(!malformed.stderr.includes(secret))
})

test('unknown selection, missing evidence and symlink context are rejected', t => {
  const f = fixture(t)
  assert.equal(f.run(['start', 'missing']).status, 1)
  const input = f.input(f.start())
  f.put(input.file, JSON.stringify({ ...input.data, confirmed_facts: [{ statement: 'Unproven', evidence: [] }] }))
  assert.equal(f.run(['end', input.file]).status, 1)
  rmSync(join(f.vault, 'companies/Test.md'))
  symlinkSync(join(f.root, 'AGENTS.md'), join(f.vault, 'companies/Test.md'))
  assert.equal(f.run(['start']).status, 1)
})
