#!/usr/bin/env python3
"""Provision the configured n8n role/database without changing existing secrets."""
import pathlib
import re
import subprocess

env = {}
for line in (pathlib.Path(__file__).resolve().parents[1] / '.env').read_text().splitlines():
    if line.strip() and not line.lstrip().startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('\"\'')
for key in ('N8N_DB_USER', 'N8N_DB_PASSWORD'):
    if not env.get(key):
        raise SystemExit('Missing required env var: ' + key)
role = env['N8N_DB_USER']
if not re.fullmatch(r'[a-z][a-z0-9_]{0,62}', role):
    raise SystemExit('N8N_DB_USER must be a PostgreSQL role identifier')

def query(sql, sensitive=False):
    if sensitive:
        sql = ('SET log_statement=none; SET log_min_error_statement=panic; '
               'SET log_min_duration_statement=-1; SET log_min_duration_sample=-1;\n' + sql)
    result = subprocess.run([
        'docker', 'exec', '-i', 'vulpine-db', 'sh', '-c',
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt --set ON_ERROR_STOP=on',
    ], input=sql + '\n', capture_output=True, text=True)
    if result.returncode:
        raise SystemExit('n8n database provisioning failed; raw SQL errors suppressed to protect credentials')
    return result.stdout.strip()

if query('SHOW log_statement;') != 'none':
    raise SystemExit('Provisioning requires secret-safe PostgreSQL statement logging')
if query(f"SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='{role}');") == 'f':
    password = env['N8N_DB_PASSWORD'].replace("'", "''")
    query(f"CREATE ROLE {role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '{password}';", sensitive=True)
if query(f"SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls FROM pg_roles WHERE rolname='{role}';") != 't':
    raise SystemExit('Configured n8n role has unexpected administrative privileges')
if query("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='vulpine_n8n');") == 'f':
    query(f'CREATE DATABASE vulpine_n8n OWNER {role};')
if query("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='vulpine_n8n';") != role:
    raise SystemExit('Existing n8n database has a different owner; no ownership changes performed')
print('Dedicated n8n database and role verified; existing credentials unchanged')
