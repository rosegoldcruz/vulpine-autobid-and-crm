import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { startupContext } from './codex-session-start.mjs'

function fixture(t) {
  const base = mkdtempSync(resolve(tmpdir(), 'aeon-startup-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  const root = resolve(base, 'repo'), vault = resolve(base, 'vault')
  const put = (p, text) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text) }
  put(resolve(root, 'docs/continuity/vault.json'), JSON.stringify({ vault, default_project: 'fixture' }))
  put(resolve(vault, 'entities/AEON.md'), '# AEON fixture direction\nAPI_KEY=synthetic-fixture-value\n')
  put(resolve(vault, 'companies/SNRG Labs.md'), '# SNRG fixture identity\n')
  return { base, root, put }
}
test('outside a registered project loads organizational memory, excludes secrets and avoids wrong-project restoration', t => {
  const f = fixture(t)
  const text = startupContext(f.root, { cwd: f.base })
  assert.match(text, /AEON fixture direction/)
  assert.match(text, /SNRG fixture identity/)
  assert.match(text, /No project selected/)
  assert.ok(!text.includes('synthetic-fixture-value'))
})
test('inside a registered project invokes continuity and delivers its session/result context', t => {
  const f = fixture(t)
  f.put(resolve(f.root, 'scripts/continuity.mjs'), `console.log(JSON.stringify({root:${JSON.stringify(f.root)},live:{head:'fixture-head'},evidence_drift:[],handoff:{last_change:'Fixture completed work',verification:['passed'],decisions:['Keep design'],open_work:[],next_action:'Next fixture task'},vault:{session_id:'fixture-session'}}));`)
  const text = startupContext(f.root, { cwd: f.root })
  assert.match(text, /fixture-session/)
  assert.match(text, /Fixture completed work/)
  assert.match(text, /Next fixture task/)
})
test('a failed continuity restore cannot masquerade as loaded project memory', t => {
  const f = fixture(t)
  f.put(resolve(f.root, 'scripts/continuity.mjs'), 'process.exit(75)')
  assert.throws(() => startupContext(f.root, { cwd: f.root }), /restore failed/)
})
