import { Pool } from "pg";
import { serverEnv } from "@/lib/server-env";

let pool: Pool | null = null;

function databaseUrl() {
  const explicit = serverEnv("DATABASE_URL");
  if (explicit) return explicit;

  const password = serverEnv("DB_PASSWORD", "POSTGRES_PASSWORD");
  const user = serverEnv("DB_USER", "POSTGRES_USER") || "vulpine";
  const db = serverEnv("DB_NAME", "POSTGRES_DB") || "vulpine";
  const host = serverEnv("DB_HOST", "POSTGRES_HOST") || "127.0.0.1";
  const port = serverEnv("DB_PORT", "POSTGRES_PORT") || "5432";

  if (!password) {
    throw new Error("Missing database password. Set DATABASE_URL or DB_PASSWORD.");
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }

  return pool;
}
