import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, mkdirSync, existsSync, lstatSync, realpathSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve, dirname, relative, isAbsolute } from 'node:path'

const digest = text => createHash('sha256').update(text).digest('hex')
const read = file => existsSync(file) ? readFileSync(file, 'utf8') : null
const fingerprint = file => { const text = read(file); return text === null ? null : digest(text) }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// Fail closed on common credential formats, assignments, private keys and authenticated URLs.
// No raw values are included in errors. Arbitrary unlabeled secrets still require review.
export function redact(text) {
  return text
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/(?:sk-(?:proj-)?|gh[pousr]_|github_pat_|xox[baprs]-|AIza)[A-Za-z0-9_\-]{12,}/g, '[REDACTED TOKEN]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED JWT]')
    .replace(/\b[A-Z0-9_]*(?:API_KEY|SECRET|PASSWORD|ACCESS_TOKEN|REFRESH_TOKEN|PRIVATE_KEY)[A-Z0-9_]*["']?\s*[=:]\s*["']?[^\s,"'\]}]+/gi, '[REDACTED ASSIGNMENT]')
    .replace(/\b(?:token|password|secret|api[-_ ]?key)["']?\s*[=:]\s*["']?[^\s,"'\]}]+/gi, '[REDACTED ASSIGNMENT]')
    .replace(/\bBearer\s+[A-Za-z0-9_.~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@[^\s]+/gi, '[REDACTED CREDENTIAL URL]')
}
export function redactData(value) {
  if (typeof value === 'string') return redact(value)
  if (Array.isArray(value)) return value.map(redactData)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactData(item)]))
  return value
}
export function assertSafe(value) {
  if (typeof value === 'string' && redact(value) !== value) throw new Error('Credential-like content rejected; remove secrets before retrying')
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (/(?:api[-_ ]?key|secret|password|(?:access|refresh|auth)[_-]?token|private[_-]?key)/i.test(key) && item) throw new Error('Credential-like field rejected; remove secrets before retrying')
      assertSafe(item)
    }
  }
}

// Reject symlinks at every component, including missing targets' existing parents.
export function safePath(root, path) {
  if (typeof path !== 'string' || isAbsolute(path) || !path || path.split(/[\\/]/).some(p => p === '..' || p === '.env' || p.startsWith('.env.'))) throw new Error('Unsafe memory path')
  const full = resolve(root, path)
  if (relative(root, full).startsWith('..')) throw new Error('Memory path escapes root')
  let current = root
  for (const part of relative(root, full).split('/')) {
    current = resolve(current, part)
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('Symlink memory path rejected')
    // existsSync follows links, including broken links; lstat must also reject those.
    try { if (lstatSync(current).isSymbolicLink()) throw new Error('Symlink memory path rejected') } catch (e) { if (e.code !== 'ENOENT') throw e }
  }
  return full
}
function syncDir(path) { const fd = openSync(path, 'r'); try { fsyncSync(fd) } finally { closeSync(fd) } }
export function atomicWrite(file, content) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.aeon-tmp`
  // The vault lock serializes writers. A leftover temp from a crash is safe to replace.
  if (existsSync(temp)) unlinkSync(temp)
  const fd = openSync(temp, 'wx', 0o600)
  try { writeFileSync(fd, content); fsyncSync(fd) } finally { closeSync(fd) }
  renameSync(temp, file)
  syncDir(dirname(file))
}
export function loadConfig(root) {
  const file = resolve(root, 'docs/continuity/vault.json')
  if (!existsSync(file)) return null // Existing non-vault fixtures/checkouts retain their protocol.
  const config = JSON.parse(readFileSync(file, 'utf8'))
  const vault = realpathSync(config.vault)
  if (!lstatSync(vault).isDirectory()) throw new Error('Vault must be an existing directory')
  return { ...config, vault, hash: digest(readFileSync(file)), root }
}
export function prepareLock(config) {
  const state = safePath(config.vault, '.aeon')
  mkdirSync(state, { recursive: true, mode: 0o700 })
  return safePath(config.vault, '.aeon/continuity.lock')
}
function projectConfig(config, key) {
  const project = config.projects[key]
  if (!/^[a-z0-9-]+$/.test(key) || !project || !project.records?.length) throw new Error('Unknown or incomplete vault project selection')
  if (!project.records.some(r => r.path === project.note)) throw new Error('Project note must be selected context')
  for (const record of project.records) {
    if (!record.path.endsWith('.md') || /^(raw|inbox)\//.test(record.path)) throw new Error('Select synthesized Markdown context, not raw captures')
    safePath(config.vault, record.path)
  }
  return project
}
const sessionPath = (config, id) => {
  if (!uuid.test(id ?? '')) throw new Error('A valid session_id from start is required')
  return safePath(config.root, `.git/aeon-sessions/${id}.json`)
}
function operation(config, scope, path, content, before) {
  assertSafe(content)
  safePath(scope === 'vault' ? config.vault : config.root, path)
  return { scope, path, before, after: digest(content), content }
}
function applyTransaction(config, transaction) {
  if (transaction.root !== config.root || transaction.vault !== config.vault) throw new Error('Pending recovery belongs to another checkout; run its continuity entry point first')
  const entries = transaction.operations.map(op => {
    if (!['vault', 'repo'].includes(op.scope)) throw new Error('Invalid recovery scope')
    if (op.scope === 'repo' && op.path !== 'docs/continuity/handoff.json') throw new Error('Invalid recovery repository target')
    if (op.scope === 'vault' && !/^(projects\/|sources\/aeon-sessions\/|\.aeon\/receipts\/|index\.md$|log\.md$)/.test(op.path)) throw new Error('Invalid recovery vault target')
    assertSafe(op.content)
    if (digest(op.content) !== op.after) throw new Error('Corrupt recovery content')
    return { ...op, full: safePath(op.scope === 'vault' ? config.vault : config.root, op.path) }
  })
  // Preflight every target before any recovery write, preserving external edits.
  for (const op of entries) {
    if (![op.before, op.after].includes(fingerprint(op.full))) throw new Error(`Recovery conflict at ${op.path}; preserve journal and reconcile manually`)
  }
  for (const op of entries) {
    const current = fingerprint(op.full)
    if (current === op.after) continue
    if (current !== op.before) throw new Error(`Concurrent edit at ${op.path}; retry after reconciliation`)
    atomicWrite(op.full, op.content)
  }
}
export function recover(config) {
  const directory = safePath(config.vault, '.aeon/transactions')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  for (const name of readdirSync(directory).filter(n => n.endsWith('.json')).sort()) {
    const file = safePath(config.vault, `.aeon/transactions/${name}`)
    applyTransaction(config, JSON.parse(read(file)))
    unlinkSync(file)
    syncDir(directory)
  }
}
export function startVault(config, key) {
  const project = projectConfig(config, key)
  const records = project.records.map(record => {
    const full = safePath(config.vault, record.path)
    const text = read(full)
    if (text === null) throw new Error(`Missing selected vault context: ${record.path}`)
    return { ...record, sha256: digest(text), status: 'Stored context; verify against source/runtime', content: redact(text) }
  })
  const note = records.find(r => r.path === project.note).content
  const latest = note.match(new RegExp(`<!-- aeon-latest:${key}:([0-9a-f-]+) -->`))?.[1]
  if (latest) {
    if (!uuid.test(latest)) throw new Error('Invalid latest vault session reference')
    const path = `sources/aeon-sessions/${key}/${latest}.md`
    const text = read(safePath(config.vault, path))
    if (text === null) throw new Error('Latest session source record is missing')
    records.push({ role: 'latest-result', path, sha256: digest(text), status: 'Agent-reviewed result with provenance; not independent approval', content: redact(text) })
  }
  const id = randomUUID()
  const session = { id, project: key, root: config.root, vault: config.vault, config_hash: config.hash, started_at: new Date().toISOString(), context: Object.fromEntries(records.map(r => [r.path, r.sha256])), handoff_hash: fingerprint(resolve(config.root, 'docs/continuity/handoff.json')) }
  atomicWrite(sessionPath(config, id), JSON.stringify(session, null, 2) + '\n')
  return { project: key, identity: project.identity, session_id: id, records }
}
function list(items) { return items.length ? items.map(item => `- ${item.replaceAll('\n', '\n  ')}`).join('\n') : '- None recorded.' }
export function finishVault(config, supplied, result) {
  assertSafe(supplied)
  const file = sessionPath(config, supplied.session_id)
  if (!existsSync(file)) throw new Error('Unknown session_id; run start and review its context first')
  const session = JSON.parse(read(file))
  const key = session.project
  const project = projectConfig(config, key)
  const inputHash = digest(JSON.stringify(supplied))
  const receiptPath = `.aeon/receipts/${session.id}.json`
  const receipt = read(safePath(config.vault, receiptPath))
  if (receipt !== null) {
    if (JSON.parse(receipt).input_hash !== inputHash) throw new Error('Session already completed with different input; start a new session')
    return { duplicate: true, session_id: session.id }
  }
  if (session.root !== config.root || session.vault !== config.vault || session.config_hash !== config.hash) throw new Error('Session configuration changed; start again and reconcile')
  for (const [path, sha] of Object.entries(session.context)) {
    if (fingerprint(safePath(config.vault, path)) !== sha) throw new Error(`Vault context conflict at ${path}; start again and reconcile`)
  }
  if (session.handoff_hash !== fingerprint(resolve(config.root, 'docs/continuity/handoff.json'))) throw new Error('Repository handoff changed since start; reconcile before completion')
  const facts = supplied.confirmed_facts
  if (!Array.isArray(facts) || !facts.length || facts.some(f => typeof f.statement !== 'string' || !f.statement.trim() || !Array.isArray(f.evidence) || !f.evidence.length || f.evidence.some(e => typeof e !== 'string' || !e.trim()))) throw new Error('confirmed_facts require statements and nonempty evidence references')
  if (!Array.isArray(supplied.assumptions) || supplied.assumptions.some(a => typeof a !== 'string' || !a.trim())) throw new Error('assumptions must be an explicit array of nonempty strings (or [])')
  const date = result.recorded_at.slice(0, 10)
  const path = `sources/aeon-sessions/${key}/${session.id}.md`
  const link = `[[${path.slice(0, -3)}|${key} session ${session.id}]]`
  const content = `---\ntitle: ${JSON.stringify(`${key} session ${session.id}`)}\ncreated: ${date}\nupdated: ${date}\ntype: source\ntags: [aeon, execution, review]\nsources: [${JSON.stringify(`${config.root}@${result.snapshot.head}`)}]\nconfidence: high\ncontested: false\npublish: false\n---\n# ${key} session ${session.id}\n\nProject: [[${project.note.slice(0, -3)}]]\n\n## Provenance\n\nRecorded: ${result.recorded_at} (UTC). Session started: ${session.started_at}.\nRepository: ${config.root}; branch: ${result.snapshot.branch}; source HEAD: ${result.snapshot.head}.\nAgent-reviewed report; evidence references are supplied by the completing agent, not independent certification or owner approval. Confidence applies to capture provenance, not every underlying claim.\n\nSelected context fingerprints:\n${list(Object.entries(session.context).map(([p,h]) => `${p}: ${h}`))}\n\n## Completed work (reported)\n\n${result.last_change}\n\n## Confirmed facts with evidence\n\n${list(facts.map(f => `${f.statement}\nEvidence: ${f.evidence.join('; ')}`))}\n\n## Reviewed decisions (approval must be explicit)\n\n${list(result.decisions)}\n\n## Test and verification results (reported, including failures)\n\n${list(result.verification)}\n\n## Assumptions (unconfirmed)\n\n${list(supplied.assumptions)}\n\n## Unresolved issues and open tasks\n\n${list(result.open_work)}\n\n## Blockers\n\n${list(result.blockers)}\n\n## Next action\n\n${result.next_action}\n`
  const noteFile = safePath(config.vault, project.note)
  const original = read(noteFile)
  if (!original.startsWith('---\n') || !/^updated: .+$/m.test(original)) throw new Error('Project note must follow existing YAML schema')
  const begin = `<!-- aeon-context:${key} -->`, end = `<!-- /aeon-context:${key} -->`
  const previousDecisions = original.match(/<!-- aeon-decisions -->\n([\s\S]*?)\n<!-- \/aeon-decisions -->/)?.[1] ?? ''
  const decisions = previousDecisions ? previousDecisions.split('\n') : []
  for (const decision of result.decisions) {
    const line = `- ${decision.replaceAll('\n', ' ')} — ${link}`
    if (!decisions.some(d => d.startsWith(`- ${decision.replaceAll('\n', ' ')} — `))) decisions.push(line)
  }
  const block = `${begin}\n## Shared organizational memory — latest verified session\n\nThis managed section supersedes earlier pointer-only integration status above.\nLatest result: ${link}\n<!-- aeon-latest:${key}:${session.id} -->\nRead that source record for completed work, evidence-backed facts, assumptions and verification. Earlier records remain in the index and mutation log.\n\n### Accumulated reviewed decisions (approval must be explicit)\n<!-- aeon-decisions -->\n${decisions.join('\n')}\n<!-- /aeon-decisions -->\n\n### Current unresolved issues\n${list([...result.open_work, ...result.blockers])}\n\n### Next action\n${result.next_action}\n\nStartup and completion commands load/write this vault automatically when invoked; no universal lifecycle hook or public publishing is installed.\n${end}`
  let updated = original
  if (original.includes(begin)) {
    const a = original.indexOf(begin), b = original.indexOf(end, a)
    if (b < 0 || original.indexOf(begin, a + begin.length) >= 0) throw new Error('Conflicting managed project sections')
    updated = original.slice(0, a) + block + original.slice(b + end.length)
  } else updated = original.trimEnd() + '\n\n' + block + '\n'
  updated = updated.replace(/^updated: .+$/m, `updated: ${date}`)
  const originalHashes = {}
  const append = (name, addition) => {
    const text = read(safePath(config.vault, name))
    if (text === null) throw new Error(`Missing required vault ${name}`)
    originalHashes[name] = digest(text)
    return text.trimEnd() + '\n\n' + addition + '\n'
  }
  result.vault = { project: key, session_id: session.id, record: path }
  const index = append('index.md', `- ${link} — reviewed execution result; private source record.`)
  const log = append('log.md', `## ${result.recorded_at} — AEON session ${session.id}\n\n- Updated [[${project.note.slice(0,-3)}]], indexed ${link}, and saved repository handoff.\n- Provenance: ${config.root}@${result.snapshot.head}; confirmed facts/evidence, assumptions and unresolved work are separated in the source record.`)
  const operations = [
    operation(config, 'vault', path, content, null),
    operation(config, 'vault', project.note, updated, session.context[project.note]),
    operation(config, 'vault', 'index.md', index, originalHashes['index.md']),
    operation(config, 'vault', 'log.md', log, originalHashes['log.md']),
    operation(config, 'repo', 'docs/continuity/handoff.json', JSON.stringify(result, null, 2) + '\n', session.handoff_hash),
    operation(config, 'vault', receiptPath, JSON.stringify({ input_hash: inputHash, session_id: session.id, root: config.root, record: path }) + '\n', null),
  ]
  const transaction = { root: config.root, vault: config.vault, operations }
  const journal = safePath(config.vault, `.aeon/transactions/${session.id}.json`)
  atomicWrite(journal, JSON.stringify(transaction, null, 2) + '\n')
  applyTransaction(config, transaction)
  unlinkSync(journal)
  syncDir(dirname(journal))
  return { duplicate: false, ...result.vault }
}
