# Vulpine Engine frontend

The existing AI frontend now runs from this monorepo under PM2 vulpine-ai.
Its original deployment public API base was preserved in
/etc/vulpine-platform/ai/build.env; the build command loads it without committing
the environment value. Run corepack pnpm --filter @vulpine/ai build from the
monorepo root. Caller environment values override the deployment file.

This migration preserves the frontend's established API integration and does not
weaken Engine authentication or add privileged credentials to browser code.
