const crypto = require("node:crypto")
const fs = require("node:fs/promises")
const path = require("node:path")
const { requiredEnv } = require("./db")

function sanitizeFilename(filename) {
  return String(filename || "upload.bin")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "upload.bin"
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

async function storeCabinetFile(jobId, fileType, upload) {
  const storageRoot = requiredEnv("STORAGE_ROOT")
  const safeName = sanitizeFilename(upload.filename)
  const fileId = crypto.randomUUID()
  const relativePath = path.join("cabinet-bid-engine", jobId, fileType, `${fileId}-${safeName}`)
  const absolutePath = path.join(storageRoot, relativePath)

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, upload.data)

  return {
    file_type: fileType,
    original_filename: safeName,
    storage_key: relativePath,
    mime_type: upload.mimeType || "application/octet-stream",
    size_bytes: upload.data.length,
    sha256_hash: sha256(upload.data),
  }
}

module.exports = {
  sha256,
  storeCabinetFile,
}
