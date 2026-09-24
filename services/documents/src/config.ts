import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const parsedFiles = new Map<string, Record<string, string>>()

function parseEnvFile(path: string) {
  const cached = parsedFiles.get(path)
  if (cached) return cached
  const values: Record<string, string> = {}
  if (existsSync(path)) {
    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) continue
      const equalsIndex = line.indexOf("=")
      if (equalsIndex < 1) continue
      const key = line.slice(0, equalsIndex).trim()
      let value = line.slice(equalsIndex + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      values[key] = value
    }
  }
  parsedFiles.set(path, values)
  return values
}

const envFiles = [resolve(process.cwd(), ".env"), "/opt/.env", "/opt/.env.local", "/opt/vulpine-engine/.env"]

export function optionalEnv(...keys: string[]) {
  for (const key of keys) {
    const direct = process.env[key]?.trim()
    if (direct) return direct
  }
  for (const file of envFiles) {
    const values = parseEnvFile(file)
    for (const key of keys) {
      const value = values[key]?.trim()
      if (value) return value
    }
  }
  return undefined
}

export function requiredEnv(...keys: string[]) {
  const value = optionalEnv(...keys)
  if (!value) throw new Error(`Missing required env var: ${keys[0]}`)
  return value
}

export function positiveIntegerEnv(name: string, fallback: number) {
  const value = Number(optionalEnv(name) ?? fallback)
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}
