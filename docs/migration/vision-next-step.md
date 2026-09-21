# Vision boundary extraction — completed 2026-09-21

The source-preserving slice described below is now implemented. The detailed evidence, runtime contract, rollback plan, and remaining gaps are recorded in [`vision-integration-report.md`](./vision-integration-report.md).

Do not copy the current `/opt/vulpine-vision` tree blindly: it already has uncommitted AEON, chat, integration, validation, and test work.

The next implementation slice is a source-preserving Vision boundary extraction:

1. Record the exact Vision commit plus its dirty-file manifest and copy the working tree into a temporary audit directory, excluding `.git`, `.next`, `node_modules`, environment files, and runtime data.
2. Diff its `docs/LEADS_VISION_HANDOFF_CONTRACT.md`, `tests/leads-handoff-contract.test.ts`, and `lib/platform` contract code against `packages/contracts`.
3. Promote only the Leads → Vision request/response schema, correlation-ID behavior, integration authentication contract, and contract tests into `packages/contracts`; do not move persistence or UI state into the package.
4. Copy server-only ingestion/domain modules into `services/vision` with their existing tests and server dependencies. Preserve `estimator intelligence` as disabled/quarantined code and add a regression assertion that no consolidation route activates it.
5. Extract the existing Vision UI into a Backoffice module at `/bids/vision`, replacing only its transport layer with `packages/sdk` calls to the server-owned Vision API.
6. Verify the existing Leads handoff tests, Vision unit/integration tests, Backoffice typecheck/build, and an authenticated `/bids/vision` browser flow before any traffic or DNS change.

The first concrete code change was the contract/test promotion in step 3. It created the stable seam used to split the UI from processing without rewriting Vision or activating quarantined estimator behavior.
