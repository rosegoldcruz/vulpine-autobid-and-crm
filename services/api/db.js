const { execFile } = require("node:child_process")

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function sqlLiteral(value) {
  if (value === null || value === undefined || value === "") {
    return "NULL"
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    throw new Error("Invalid numeric SQL value")
  }
  return String(number)
}

function runSql(sql) {
  const databaseUrl = requiredEnv("DATABASE_URL")

  return new Promise((resolve, reject) => {
    execFile(
      "psql",
      [
        databaseUrl,
        "--no-align",
        "--tuples-only",
        "--quiet",
        "--set",
        "ON_ERROR_STOP=1",
        "--command",
        sql,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message))
          return
        }
        resolve(stdout.trim())
      },
    )
  })
}

async function queryJson(sql, fallback) {
  const output = await runSql(sql)
  if (!output) return fallback
  return JSON.parse(output)
}

module.exports = {
  queryJson,
  requiredEnv,
  runSql,
  sqlLiteral,
  sqlNumber,
}
