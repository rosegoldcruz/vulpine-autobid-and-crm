import assert from "node:assert/strict"
import test from "node:test"
import AdmZip from "adm-zip"
import { extractZipFiles } from "../src/parsers.js"

test("ZIP ingestion preserves supported nested evidence and ignores unrelated files", () => {
  const zip = new AdmZip()
  zip.addFile("nested/plans/A101.pdf", Buffer.from("%PDF-1.4 sample"))
  zip.addFile("nested/pricing/cabinets.csv", Buffer.from("sku,cabinet_code,unit_cost\nX1,B24,123\n"))
  zip.addFile("nested/readme.txt", Buffer.from("ignore"))
  const names = extractZipFiles(zip.toBuffer()).map((file) => file.name)
  assert.deepEqual(names, ["nested/plans/A101.pdf", "nested/pricing/cabinets.csv"])
})
