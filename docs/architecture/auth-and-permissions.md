# Authentication and authorization

ZITADEL remains the only identity provider.

`packages/auth` normalizes ZITADEL project-role claims. `packages/permissions` maps recognized roles to explicit capabilities. Backoffice uses NextAuth's ZITADEL provider and performs capability checks in server route handlers.

The Bids Tracker proxy fails closed when any of the following is true:

- ZITADEL configuration is missing;
- no authenticated session exists;
- the session lacks the operation's capability;
- `BIDS_TRACKER_API_URL` is absent or invalid;
- the upstream service is unavailable.

Sidebar filtering is derived from the same capabilities when authentication is configured. Hiding a navigation item is never treated as authorization.

Before production cutover, the standalone Bids Tracker endpoint must also be restricted to the Backoffice/server integration boundary; today its original Express routes do not authenticate requests.
