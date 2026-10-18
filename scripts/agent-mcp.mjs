#!/usr/bin/env node
// Stdio adapter for clients that cannot load an HTTP bearer credential from disk.
// Credentials stay in a private local file, never in client argv or the repository.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
const client = process.argv[2]
if (!/^[a-z][a-z0-9-]{0,50}$/.test(client || '')) throw new Error('Expected a registered client name.')
const { endpoint, token } = JSON.parse(await readFile(join(homedir(), '.config/vulpine-mcp/clients', `${client}.json`), 'utf8'))
if (endpoint !== 'https://backoffice.vulpine.llc/api/mcp' || typeof token !== 'string' || token.length < 32) throw new Error('Invalid agent connection configuration.')
let protocol = '2025-11-25'
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (!line.trim()) continue
  let message
  try {
    message = JSON.parse(line)
    const response = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${token}`, accept: 'application/json, text/event-stream', 'content-type': 'application/json', 'mcp-protocol-version': protocol }, body: JSON.stringify(message), redirect: 'error', signal: AbortSignal.timeout(45000) })
    if (!response.ok) throw new Error(`MCP endpoint returned HTTP ${response.status}.`)
    if (response.status === 202 || response.status === 204) continue
    const result = await response.json()
    if (message.method === 'initialize' && result.result?.protocolVersion) protocol = result.result.protocolVersion
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch {
    if (message?.id !== undefined) process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: 'Backoffice connection failed. Check endpoint availability and private client credentials.' } })}\n`)
    else process.stderr.write('Backoffice notification failed.\n')
  }
}
