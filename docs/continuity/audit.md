# Continuity audit — 2026-10-15

## Verified observations

- Starting cwd `/opt` is not a Git project. Multiple independent repositories and
  live services exist; this task selected `/opt/vulpine-platform` using its README,
  workspace and `services/aeon/README.md`, not its directory name alone.
- `/opt/aeon-alpha-omega` is a Git checkout of an API catalog (upstream API-mega-list),
  not an inspected implementation of the requested agent runtime.
- The monorepo's existing `AGENTS.md` has execution, pricing and authorization
  rules but includes older layout and hosting names. Current README/source establish
  `apps/backoffice` and `backoffice.vulpine.llc`; this task adds an explicit precedence
  note rather than rewriting the historical operating contract.
- Existing delivery, architecture, security and migration docs are present. No
  repository engineering-session restore script or persisted session handoff was
  found in tracked filenames or the inspected scripts/docs/AEON boundary.
- Existing Codex local session/history/memory files exist under `/root/.codex`.
  Their private contents were not read or copied; they are not portable project memory.
- The repository had staged moves into `services/bids-tracker`, unstaged tracker
  edits, `.gitignore`, lockfile/system-map changes, and untracked deployment tooling.
  This task must preserve them and use path-scoped commits.
- Operations, bidding, cabinet pricing, Hermes, Paperclip, Nginx and Tailscale
  systemd units report active. An active unit alone is not functional verification.
  Operations loopback `/health` returned status ok. No remote infrastructure,
  customer workflow, provider authorization or deployment was certified.
- `.mcp.json` includes an `obsidian-vault` stdio configuration pointing at the
  accessible `/opt/pai-obsidian/obsidian-vault`. Other configured MCP names include
  GitHub, Google Workspace, Supabase, Paperclip and vendor integrations; configuration
  presence is not authenticated connectivity. Only server names and safe selected
  fields were inspected; credentials and environment values were not emitted.
- Managed-cloud environment-status tooling and `/etc/codex/network-policy.json`
  are not available here. No managed-cloud credential-readiness claim is made.
- No `.github/workflows` directory exists in this checkout. Vercel linkage and
  upstream CI triggers were not audited. No production code or deployment is required
  by this repository-memory implementation.

## Obsidian assessment

The vault exists and is writable. `SCHEMA.md` specifies YAML frontmatter, stable
filenames, wikilinks, index entries, mutation log entries and immutable `raw/`.
`CLAUDE.md` contains historical organizational context and older environment claims;
these require source verification rather than wholesale import into engineering memory.
An existing pricing/project note contains recent supplier decisions and dated API/OAuth
blockers; those are retained in the vault and not promoted into live service facts.

Use a project pointer to this repository's entry point. Repo docs remain canonical
for engineering handoffs; vault notes remain organizational context. There is no
background sync, automatic conflict resolver or graph database. For conflicts,
inspect runtime/source, correct the owning record, and log meaningful vault changes
according to SCHEMA.md. Do not silently merge conflicting copies or edit immutable raw
sources. The vault is not Git-versioned here; it needs its own verified backup policy.

Quartz's `/opt/quartz/content` symlink points at absent
`/home/pai-obsidian/obsidian-vault`. This is a verified publishing-path issue,
not a missing canonical vault. Repair is outside this task; no symlink or publisher
was changed. Do not claim a working public Obsidian publisher.

## Security and scope

No secrets, raw context dump, personal/family/financial history, workbooks, customer
documents or database contents are imported. Start prints only allowlisted memory,
instructions, Git hashes/status filenames and selected source hashes. End accepts
reviewed prose, so operators remain responsible for removing sensitive material
before saving and committing it. It does not automatically sanitize arbitrary text.
No authentication, pricing, database, service, UI or network configuration is changed.
