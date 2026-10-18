import { existsSync, readFileSync } from "node:fs";

const parsedFiles = new Map<string, Record<string, string>>();

function parseEnvFile(path: string) {
  if (parsedFiles.has(path)) {
    return parsedFiles.get(path)!;
  }

  const values: Record<string, string> = {};
  if (!existsSync(path)) {
    parsedFiles.set(path, values);
    return values;
  }

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    // An unprivileged service must not receive access to unrelated host secrets.
    // Missing configuration remains unavailable instead of crashing at import.
    if ((error as NodeJS.ErrnoException).code !== "EACCES") throw error;
    parsedFiles.set(path, values);
    return values;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 1) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  parsedFiles.set(path, values);
  return values;
}

export function serverEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }

  const hostValues = parseEnvFile("/opt/.env");
  for (const key of keys) {
    if (hostValues[key]) return hostValues[key];
  }

  const engineValues = parseEnvFile("/opt/vulpine-engine/.env");
  for (const key of keys) {
    if (engineValues[key]) return engineValues[key];
  }

  return "";
}
