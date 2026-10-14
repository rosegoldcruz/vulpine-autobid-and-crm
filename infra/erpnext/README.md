# ERPNext + Frappe HR

Isolated Docker Compose service for the Backoffice ERPNext module at
`/finance/erpnext`. The existing bid tools and operational databases are not
changed. ERPNext is the third-party application requested by the user; its own
MariaDB schema, bench migrations, worker processes, and login are authoritative.
Backoffice visibility uses `finance.read`; ERPNext permissions must also be
assigned inside ERPNext. This is an application launcher, not shared SSO or a
bid/customer data synchronization implementation.

## Versions and upstream

Base: ERPNext 15.122.0 / Frappe 15.123.0, pinned by image digest in Dockerfile.
Added app: Frappe HR 15.64.3. Build assets into the image so every worker,
WebSocket server, and frontend runs the same application code. The HR build's
asset manifest is merged with the upstream manifest; replacing it loses the
Frappe and ERPNext bundle paths. After image changes, clear the shared asset
cache as well as the site cache:

```sh
docker compose exec -T backend bench --site YOUR_SITE execute frappe.cache.delete_value --args '["assets_json"]' --kwargs '{"shared":True}'
docker compose exec -T backend bench --site YOUR_SITE clear-cache
```
Compose follows the service layout in official `frappe/frappe_docker` at
`71a9a3d6dd0ffdba47bb08a2e0817fa217cf643c`. Both short and long queues,
configuration initialization, WebSockets, and persistent sites are included.

## Provision

1. Create a root-owned secrets directory outside Git (mode 0700), containing
   independently generated `db_password` and `admin_password` files. File content
   must be readable by the container's frappe user through Compose secret mounts;
   mode 0444 inside the private host directory meets this requirement. Do not
   print, commit, or put passwords in command history.
2. Copy `.env.example` to `.env` and fill in `ERP_SITE_NAME` (the public hostname)
   and `ERP_SECRETS_DIR` (the absolute secrets directory path).
3. `docker build -t vulpine-erpnext:15.122.0-hrms15.64.3 .`
4. `docker compose config --quiet`
5. `docker compose up -d`
6. `docker compose --profile setup run --rm create-site`
7. `docker compose exec -T backend bench --site YOUR_SITE list-apps`
8. Verify `http://127.0.0.1:8090/api/method/ping` and login locally.

The setup command refuses to overwrite an existing site. If HR installation
fails after site creation, inspect that failure and use `bench --site YOUR_SITE
install-app hrms` after repairing the cause; do not delete the site to retry.
Only loopback port 8090 is published. MariaDB and Redis have no host ports.
Never run `docker compose down -v` on a provisioned installation.

## Public routing

Hostname: `pay.vulpine.llc`, selected by the user. DNS points to VPS
`167.233.89.33`. Obtain TLS before installing `nginx.conf`; it uses the existing
host's TLS/security snippets and forwards only to loopback port 8090. Set
`ERP_PROXY_TRUSTED_IP` to the verified Docker network gateway address so the
frontend accepts client-IP headers only from the host proxy. The outer proxy
replaces incoming forwarded-IP headers. Check the gateway again if the network
is recreated. Verify login, static assets, and `/socket.io/` before setting
`NEXT_PUBLIC_ERPNEXT_URL` to the verified HTTPS origin in Vercel and redeploying.
The application containers drop all Linux capabilities, prohibit privilege
escalation, and have memory, CPU, process, and log-rotation limits.

## First-use setup

Administrator's bootstrap password is in the private `admin_password` file.
Complete ERPNext's setup wizard with verified legal company details, fiscal year,
country, currency, and chart of accounts. Add other companies and explicitly
scope users with ERPNext roles and Company user permissions. No company, tax,
payroll, banking, or opening balance information is invented by this deployment.
Create named user accounts; do not use Administrator as a shared employee login.
Public signups are disabled. Login lockout is configured for five failed
attempts and a 300-second delay. Secure cookies are enforced at the HTTPS proxy;
Gunicorn trusts forwarded protocol only within its unexposed Docker network.

Configure Net 30 payment terms and assign them to the appropriate customers or
invoices. Configure payroll structures, deductions, and employee shifts before
processing payroll. Validate those workflows with the business's actual rules.
Stock is hidden during provisioning; hide other unneeded workspaces through role/workspace settings; hiding
navigation does not disable inventory accounting. Use non-stock items and leave
Update Stock disabled for workflows that must not affect inventory. This change
does not alter existing bid pricing or treat ERP quotations as approved takeoffs.

## Backups, upgrades, recovery

`ERP_SITE_NAME=YOUR_SITE ./backup.sh` creates a bench database backup, public and
private file archives, and site config backup in the persistent site's backups
folder. Copy these backups to the approved off-host backup store, protect the
site config encryption key, and verify a restore before calling disaster
recovery complete. Local volumes alone are not off-host backups. The supplied systemd service and
timer run the database/file backup daily at 04:15 UTC with up to ten minutes of
jitter. Install them under `/etc/systemd/system`, run `systemctl daemon-reload`,
and enable `vulpine-erpnext-backup.timer`. The first backup completed and its
compressed database/file archives passed integrity checks on 2026-10-14;
a full restore and off-host replication have not been verified.

Before upgrades, back up the site and files, record the running image, build a
new pinned image, and test `bench migrate` against a restored copy. Never roll
an old image back onto a migrated database without a matching restored backup.
The scheduler runs Frappe scheduled jobs; off-host retention/restore monitoring
requires integration with the existing backup service.
