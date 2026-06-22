const MAX_HEADER_BYTES = 1024 * 1024

function parseMultipart(contentType, body) {
  const boundaryMatch = /boundary=(?:(?:"([^"]+)")|([^;]+))/i.exec(contentType || "")
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
  if (!boundary) {
    throw new Error("Missing multipart boundary")
  }

  if (body.length < 1) return []

  const delimiter = Buffer.from(`--${boundary}`)
  const parts = []
  let cursor = 0

  while (cursor < body.length) {
    const boundaryIndex = body.indexOf(delimiter, cursor)
    if (boundaryIndex === -1) break

    let partStart = boundaryIndex + delimiter.length
    if (body[partStart] === 45 && body[partStart + 1] === 45) break
    if (body[partStart] === 13 && body[partStart + 1] === 10) partStart += 2

    const nextBoundary = body.indexOf(delimiter, partStart)
    if (nextBoundary === -1) break

    let part = body.subarray(partStart, nextBoundary)
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2)
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"))
    if (headerEnd === -1 || headerEnd > MAX_HEADER_BYTES) {
      cursor = nextBoundary
      continue
    }

    const rawHeaders = part.subarray(0, headerEnd).toString("utf8")
    const data = part.subarray(headerEnd + 4)
    const headers = parseHeaders(rawHeaders)
    const disposition = headers["content-disposition"] || ""
    const name = /name="([^"]+)"/i.exec(disposition)?.[1]
    const filename = /filename="([^"]*)"/i.exec(disposition)?.[1]

    if (!name) continue

    parts.push({
      name,
      filename,
      mimeType: headers["content-type"] || "application/octet-stream",
      data,
    })

    cursor = nextBoundary
  }

  return parts
}

function parseHeaders(rawHeaders) {
  const headers = {}
  for (const line of rawHeaders.split("\r\n")) {
    const separator = line.indexOf(":")
    if (separator === -1) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()
    headers[key] = value
  }
  return headers
}

module.exports = {
  parseMultipart,
}
