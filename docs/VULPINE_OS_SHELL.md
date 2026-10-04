# Vulpine OS: additive Backoffice expansion

## Scope and preservation contract

The canonical product surface remains `apps/backoffice` in
`/opt/vulpine-platform`, hosted at `backoffice.vulpine.llc`.
This implementation expands the visual shell; it does not claim to migrate or
connect every backend service.

Preserved unchanged:

- The live Bids Tracker component, KPI calculations, edit/upload workflows,
  proxy, and authoritative data.
- Cabinet Brain / Plan Room, evidence review, pipeline controls, Vision proxy,
  and estimating boundaries.
- Drive component, file operations, storage ownership, and existing proxy.
- Existing ZITADEL provider/session callbacks, role normalization, and
  `packages/permissions` role grants.
- Existing Settings, CRM, Revenue, campaigns, and Bid Engine components.
- Standalone repositories and rollback sources. No source repository is deleted,
  archived, copied wholesale, or cut over by this change.

The old dashboard's permanent KPI loading placeholders are replaced with a
searchable module directory and links to existing workspaces. No bid values or
financial metrics are created, changed, or inferred by this directory.
Synthetic success notifications and the invented sidebar email are removed.

## Canonical module registry

`apps/backoffice/lib/platform-modules.ts` declares module IDs, URLs, groups,
read-access capabilities, purposes, and integration boundaries.
This is the shared input for navigation, directory links, metadata, visibility,
and new server-route authorization.

| Group | Surfaces |
| --- | --- |
| Core | Command Center |
| Projects | Projects, Documents, Activity |
| Sales | CRM, Leads, Opportunities, Companies, Contacts, Campaigns |
| Bidding | Bids Tracker, Cabinet Brain, Bid Engine, Takeoffs, Pricing, Proposals, SKU Catalog |
| AI | Fox, Hermes, Agents, Paperclip, Model Providers, Automations |
| Communications | Inbox, SMS, Dialer, Calls, Recordings, Valérie |
| Knowledge | Vault, Search, SOPs, Intelligence |
| Operations | Drive, Jobs, Events, Notifications, Backups |
| Finance | Revenue |
| System | Integrations, Services, Health, Logs, Users, Permissions, Settings |

The existing explicit routes `/bids/tracker`, `/bids/vision`, and `/drive`
remain authoritative. The catch-all page handles only registered additional
paths, including a `/dashboard` alias. Unregistered paths return `notFound()`.
Navigation now changes the URL instead of toggling an unaddressable local tab;
refresh, direct links, and browser history work.

## Authorization and data boundary

No second role model is introduced. Every module uses an existing capability
from `packages/permissions`. Administration, model-provider configuration,
automation management, and backups require `settings.manage`; sales surfaces
require CRM capabilities; knowledge requires `drive.read`.
Shell access is not authorization for future API mutations. Each service adapter
must continue checking action-specific capabilities server-side.

New routes redirect unauthenticated users to the existing sign-in flow while
preserving their intended callback path. Sessions lacking the required
capability redirect to the access-required page. Unknown roles have no modules.
When auth configuration is missing, new production pages expose no workspace;
local development retains the existing shell-preview convention. Private
provider tokens and integration credentials are never added to client props.

## Honest unfinished surfaces

A new, unconnected surface shows its purpose, integration boundary, capability,
related module links, and links back to established workspaces. It does not
produce fake records, simulated conversations, invented SKU mappings, online
badges, campaign totals, worker counts, backup success, or operational logs.
The registry's existing-workspace label describes an implemented UI, not a
health probe or a guarantee that its upstream service is currently available.

Hermes is the interaction runtime, Fox is an agent/product on that runtime,
Paperclip is orchestration, and Valérie is a voice agent through AEON. These
pages are integration surfaces, not new implementations of those systems.
Obsidian remains the proposed canonical knowledge source; Quartz is a renderer,
not a parallel knowledge database. Supply remains a separate public app.

## Mobile interaction

The desktop sidebar scrolls independently within the viewport. On mobile the
existing bottom navigation keeps Home, Tracker, Brain, and Drive reachable.
More opens the existing Vaul drawer, now with grouped modules and real search.
Navigation targets are at least 44px; module buttons wrap rather than truncate
long names. New content uses single-column cards on narrow screens, not
compressed desktop tables. Existing spring transitions remain in place.

## Verification

Registry tests check route uniqueness, path resolution, legacy route stability,
unknown-role denial, and exact agreement between navigation and server access
for every role/module pair. Browser tests cover directory filtering, direct
module navigation, browser history, mobile drawer filtering/navigation, touch
targets, horizontal overflow, honest notifications, and unknown-route 404s.
Existing Tracker and Cabinet Brain browser regression suites are also run.
Test-only network fixtures never become application records.

## Integration order after the shell

1. Inventory the deployed upstream service and its current API/security contract.
2. Implement a same-origin authenticated Backoffice adapter using shared
   contracts, action-specific permissions, correlation IDs, and server secrets.
3. Connect the surface to actual service records, including loading, empty,
   denied, unavailable, and failure states.
4. Verify authorized and unauthorized behavior before enabling mutations.
5. Prove the module on desktop/mobile and production, preserve rollback, then
   update the registry's implemented-workspace designation where appropriate.

No DNS, ZITADEL console, database migration, provider configuration, or backend
process change is required for the visual-shell expansion.
