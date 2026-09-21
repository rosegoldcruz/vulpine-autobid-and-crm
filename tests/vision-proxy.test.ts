import assert from "node:assert/strict"
import test from "node:test"
import { resolveVisionRoute } from "../apps/backoffice/lib/vision-proxy.ts"

test("Vision proxy grants only the four deterministic workflow operations", () => {
  assert.deepEqual(resolveVisionRoute("POST", "projects"), { capability: "vision.write", upstreamPath: "/api/projects", blocked: false })
  assert.deepEqual(resolveVisionRoute("POST", "uploads"), { capability: "vision.write", upstreamPath: "/api/uploads", blocked: false })
  assert.equal(resolveVisionRoute("GET", "jobs/job-1")?.capability, "vision.read")
  assert.equal(resolveVisionRoute("POST", "jobs/job-1/process")?.capability, "vision.write")
  assert.equal(resolveVisionRoute("DELETE", "projects/project-1"), null)
})

test("Vision proxy blocks estimator intelligence before upstream resolution", () => {
  for (const path of ["jobs/a/approve-unit-mix", "jobs/a/resolve", "jobs/a/export", "pricing", "takeoff/create"]) {
    assert.equal(resolveVisionRoute("POST", path)?.blocked, true, path)
  }
})
