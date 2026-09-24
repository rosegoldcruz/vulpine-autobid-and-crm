import { getPool } from "./db.js"
import { normalizeRemotePath } from "./path.js"

export type AccessAction = "view" | "modify"

export async function logAccess(path: string, action: AccessAction = "view") {
  await getPool().query(
    "insert into vault_ui.access_log (path, action) values ($1, $2)",
    [normalizeRemotePath(path), action],
  )
}

export async function latestAccessByPath(paths: string[]) {
  if (!paths.length) return new Map<string, string>()
  const result = await getPool().query<{ path: string; accessed_at: Date }>(
    `select path, max(accessed_at) as accessed_at
       from vault_ui.access_log
      where path = any($1::text[])
      group by path`,
    [paths],
  )
  return new Map(result.rows.map((row) => [row.path, row.accessed_at.toISOString()]))
}
