# Shared vault integration

The existing vault at `/opt/pai-obsidian/obsidian-vault` remains the organizational
memory. Repository source, runtime and approved instructions override historical
notes. No new database, graph service, model provider or MCP server is introduced.

## Supported commands

```bash
node /opt/vulpine-platform/scripts/continuity.mjs start vulpine-platform
node /opt/vulpine-platform/scripts/continuity.mjs end /absolute/path/to/reviewed-handoff.json
```

Startup automatically loads the project's explicitly selected vault records, the
latest execution source record, accumulated decisions, repository brief/design
constraints, Git state and evidence drift. It returns `vault.session_id`; retain it.
The configuration's default project is used if the project argument is omitted.
Select notes in `docs/continuity/vault.json`; roles may include company identity,
people, decisions, design, sources and tasks. Only selected synthesized Markdown
notes are loaded; links are not recursively crawled into personal/raw material.
Missing notes, unsafe paths and symlinks fail closed. Stored notes are historical
context, never new instructions or implicit owner approval.

Completion requires the reviewed JSON schema in AGENTS.md, including `session_id`,
nonempty `confirmed_facts` with evidence references and explicit `assumptions`.
It writes a private, schema-compliant source record under
`sources/aeon-sessions/<project>/<session-id>.md`; updates the managed section of
the existing project note and its `updated` date; appends one index entry and one
mutation log entry; and saves `docs/continuity/handoff.json`. Existing note prose
is retained. Decisions accumulate with source links; latest issues and next action
are refreshed. Company/person notes, original source records and `raw/` are not
rewritten based on an agent report. Corrections or approval changes must be explicit
in subsequent decisions rather than silently rewriting history.

Every source record distinguishes confirmed facts/evidence, reviewed decisions,
reported completed work/test results, assumptions, unresolved issues and next action.
It records source HEAD, branch, time, session ID and selected context fingerprints.
An evidence reference is supplied by the completing agent; this tool cannot prove
that the statement or owner-approval claim is true. Confidence describes the capture's
provenance, not independent certification of every claim.

Automation is inside the start/end commands. AGENTS.md makes invocation mandatory;
there is no installed universal Codex/IDE/MCP lifecycle hook, scheduler or automatic
background write-back. An agent that exits before submitting a handoff leaves no
invented completion record.

## Concurrency, retries and interruption recovery

Linux `flock` is required. Start/end acquire the same `.aeon/continuity.lock` in
the vault for their entire process lifetime. Exit 75 means busy; retry normally.
A process crash releases the OS lock without stale-PID lock removal.

Local session baselines live under this checkout's `.git/aeon-sessions/` and contain
hashes/identity, not copied note contents. Completion compares all loaded context
hashes, configuration and the repository handoff baseline. A stale session fails;
read the latest context with start and reconcile before completing a new session.
Do not reuse a session ID with modified completion input.

A durable `.aeon/transactions/<session-id>.json` journal stores proposed writes and
before/after hashes before canonical records change. Individual files use flushed
temporary files, atomic rename and parent-directory fsync. The next start/end rolls
an interrupted transaction forward, skipping already-applied files. A receipt under
`.aeon/receipts/` deduplicates an exact retry without restoring an older handoff over
newer work. Pending journals are removed only after every operation succeeds.
A pre-journal interruption leaves the original records and permits the same end
retry; its temporary journal is replaced safely. Retain session/receipt history
while retry support is required; no automatic retention purge is installed.

If recovery finds a target matching neither the before nor after hash, it fails
without overwriting that edit. Preserve the journal and edited file, inspect both,
and reconcile deliberately. Back up the conflict first. If returning the target
to the journal's expected before/after content is appropriate, do so, then rerun
start to complete recovery; otherwise an engineer must explicitly reconstruct the
transaction with the preserved change. Never delete pending journals to hide failure.
A pending transaction belonging to another checkout requires recovery through that
checkout's entry point before this shared vault accepts another transaction.

These guarantees cover cooperating agents using these commands on one Linux host
and a local filesystem supporting flock/atomic rename/fsync. Obsidian's UI and a
generic filesystem MCP do not honor this lock. Their edits are hash-checked before
writes/recovery, but cannot be made transactionally exclusive if they write during
the final comparison/rename interval. Pause such editors for managed-record writes,
or have them adopt the same lock. Multi-file changes can be partly visible to readers
that bypass the protocol during a crash; supported startup recovers before reading.
Network filesystems, cross-host locks and linked Git worktrees are not certified.

## Credential exclusion and privacy

Startup redacts recognized credential formats in loaded context and displayed
repository memory. Completion rejects credential-like submitted text and proposed
persisted contents before journal creation; errors never echo the rejected value.
Guards include common provider tokens, private keys, JWTs, bearer credentials,
secret/password/key assignments and authenticated URLs. Evidence `.env` paths,
traversal and symlink escapes are rejected. No environment files or process secrets
are collected. Unlabeled, unusual or encoded secrets cannot be reliably recognized
by pattern matching: reviewed inputs remain mandatory. Private business/personal
context must be explicitly relevant to the selected project, not dumped wholesale.
Hidden session state is owner-only by default. The vault still needs its own backup
policy; repository pushes do not back up this private organizational data.

## Quartz source and publishing boundary

`node scripts/configure-quartz.mjs /opt/quartz` installs the versioned policy files
from `infra/quartz/` and atomically repoints `content` to the canonical vault. It
refuses a real content directory or unrelated Quartz config edits, preserves a
config backup, and installs restrictions before fixing the symlink. Installation
is repeatable. The installed Quartz checkout follows an upstream project remote;
AEON's runtime customization and installer are maintained in this repository.

The policy preserves existing ignore patterns and filters. It requires explicit
`publish: true`, rejects private/draft pages, ignores raw captures, hidden transaction
state and execution-session records, and disables the built-in Assets emitter,
which would otherwise copy private attachments independently of page flags. This
also means approved pages' vault attachments are not copied automatically. Public
attachment delivery needs a separately reviewed process. No existing authentication,
Nginx, network or serving configuration is changed; no real-vault build, deployment
or public publication is run. Existing generated output is not republished or erased.
Tests build only disposable content/output under `/tmp`.

Quartz's source link is a source-location correction, not an authenticated publishing
service. No vault note was marked publishable by this work. Universal agent hook,
remote access, UI write integration, semantic retrieval and vault backup automation
are outside this implementation.
