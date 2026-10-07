# Dedicated n8n database provisioning

Configure `N8N_DB_USER=vulpine_n8n_app` and a real securely generated `N8N_DB_PASSWORD` in the private `.env` (mode 0600). Start PostgreSQL, then run `python3 db/provision-n8n.py` before starting n8n.

The command creates only missing role/database objects, rejects privileged or differently owned existing objects, and never rotates an existing role password. It does not wipe databases or run workflows. Production recovery restores roles and the n8n database from the private PostgreSQL backups; preserve the matching private environment and n8n encryption configuration.

The runtime n8n container uses its dedicated database owner, without PostgreSQL superuser, create-role, create-database or RLS-bypass privileges. Existing engine and application roles remain unchanged.
