import { readFile } from "node:fs/promises"
import { getPool } from "./db.js"

const pool = getPool()
try {
  const sql = await readFile(new URL("../db/migrations/001_access_log.sql", import.meta.url), "utf8")
  await pool.query(sql)
  console.info("Documents access-history migration applied.")
} finally {
  await pool.end()
}
