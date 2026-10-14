import assert from "node:assert/strict"
import test from "node:test"
import { erpnextUrl } from "../apps/backoffice/lib/erpnext.ts"
import { canAccessModule, moduleForPath } from "../apps/backoffice/lib/platform-modules.ts"

test("ERPNext accepts HTTPS origins without credentials or injected paths", () => {
  assert.equal(erpnextUrl("https://erp.example.com/"), "https://erp.example.com")
  for (const value of [undefined, "", "garbage", "javascript:alert(1)", "http://erp.example.com", "https://user:password@erp.example.com", "https://erp.example.com/other", "https://erp.example.com/?token=secret", "https://erp.example.com/#secret"]) {
    assert.equal(erpnextUrl(value), undefined)
  }
})

test("ERPNext routes and navigation use existing finance permissions", () => {
  assert.equal(moduleForPath("/finance/erpnext")?.id, "erpnext")
  for (const role of ["admin", "finance", "executive"]) assert.equal(canAccessModule([role], "erpnext"), true)
  for (const role of ["sales", "estimator", "unknown"]) assert.equal(canAccessModule([role], "erpnext"), false)
})
