import { Pool } from "pg"
import { optionalEnv, requiredEnv } from "./config.js"

let pool: Pool | undefined

export function getPool() {
  const connectionString = optionalEnv("DATABASE_URL") ?? `postgresql://${encodeURIComponent(optionalEnv("DB_USER", "POSTGRES_USER") ?? "vulpine")}:${encodeURIComponent(requiredEnv("DB_PASSWORD", "POSTGRES_PASSWORD"))}@${optionalEnv("DB_HOST", "POSTGRES_HOST") ?? "127.0.0.1"}:${optionalEnv("DB_PORT", "POSTGRES_PORT") ?? "5432"}/${optionalEnv("DB_NAME", "POSTGRES_DB") ?? "vulpine"}`
  pool ??= new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
  })
  return pool
}
