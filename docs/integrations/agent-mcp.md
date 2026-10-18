# Backoffice agent access

Endpoint: `https://backoffice.vulpine.llc/api/mcp` (Streamable HTTP, stateless JSON responses).

The first release exposes `list_workspaces` and `read_workspace` only. Authorized workspaces are projects, leads, contacts, companies and opportunities. Each client has a separate revocable bearer credential, SHA-256 digest, fixed organization and explicit workspace list. Browser sessions do not grant machine access. No write, arbitrary proxy, shell, file, approval, export, or send tools are exposed.

`MCP_CLIENTS_JSON` is a server-only array of `{id, tokenHash, organizationId, modules}`. An absent, empty or malformed registry fails closed with 503; an unknown credential receives 401. Add digests through the Vercel production environment and redeploy; removing a digest revokes that client after deployment. `MCP_ALLOWED_ORIGINS` optionally permits explicit browser origins; no origins are allowed by default. Browser CORS/OAuth onboarding is a separate integration requirement.

The route calls the existing operations service using short-lived organization-bound HMAC claims and GET requests only. It preserves source warnings and paginates records (maximum 50 per call). Audit messages include client, module, outcome and record count, excluding credentials, queries and business records. Returned records are untrusted data.

## Local clients

`scripts/agent-mcp.mjs <client-id>` translates MCP stdio messages to the authenticated HTTP endpoint. It reads `~/.config/vulpine-mcp/clients/<client-id>.json` with `{endpoint, token}`. Keep that directory mode 700 and files mode 600. Never put these credentials in repository files or command arguments. The adapter uses Node 22+ native fetch and has no model/provider dependency.

Configuration formats:

- Claude Code and Qwen Code: `mcpServers.vulpine-backoffice = {command: "node", args: [absoluteAdapterPath, clientId]}` in their user settings.
- Codex: `codex mcp add vulpine-backoffice -- node <absoluteAdapterPath> codex`.
- GitHub Copilot CLI: `copilot mcp add vulpine-backoffice -- node <absoluteAdapterPath> copilot`.
- OpenCode: `mcp.vulpine-backoffice = {type: "local", command: ["node", absoluteAdapterPath, "opencode"], enabled: true}`.
- Hermes: `mcp_servers.vulpine-backoffice` with `command: node` and `args: [absoluteAdapterPath, hermes]`.

Muse/MetaMuse models configured in OpenCode and Hermes receive tools through their host's MCP connection. Provider endpoints themselves are not MCP client configurations. Actual model tool selection still needs a model session check.

Restart existing sessions to discover newly configured tools. A transport probe does not certify that a model called a tool correctly.

## Other surfaces requested by the owner

Scope includes GitHub, Qwen, Muse, Claude, Codex, ChatGPT, MetaMuse, Copilot, Grok, Grokbot, OpenCode, Cursor and Hermes. This list is a requirement, not a claim of completed onboarding.

- GitHub Copilot CLI is the GitHub surface configured on this host. GitHub-hosted coding agents require their own repository/environment configuration.
- Desktop/web ChatGPT, Claude connectors and Cursor require configuration in the actual client/account/device. A server-local config does not update another device.
- Grok/Grokbot require identification of the actual host runtime and its supported tool configuration. A provider API key alone does not prove a client is connected.
- The bearer-authenticated first release does not implement OAuth discovery or account connector enrollment. Do not claim hosted connectors have been enabled or tested.

## Verification

`corepack pnpm exec tsx --test tests/mcp.test.ts` checks fail-closed credentials, MCP initialization/discovery, read-only tool registration, permission enforcement, write rejection, request size, origins, organization-bound read claims, pagination and source warnings. Backoffice TypeScript and targeted ESLint checks also apply. Verify deployment with an unauthenticated rejection, authenticated `initialize`, `tools/list`, and a real `read_workspace` request. Never print returned private records during a connectivity test.

Protocol implementation uses the [official MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server).
