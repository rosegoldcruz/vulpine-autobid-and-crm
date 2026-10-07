#!/usr/bin/env python3
"""Provision the configured Engine database role and restricted application environment without changing existing secrets."""
import pathlib
import re
import subprocess

env = {}
for line in (pathlib.Path(__file__).resolve().parents[1] / '.env').read_text().splitlines():
    if line.strip() and not line.lstrip().startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('\"\'')
for key in ('ENGINE_DB_USER', 'ENGINE_DB_PASSWORD', 'ENGINE_API_UID', 'ENGINE_API_GID'):
    if not env.get(key):
        raise SystemExit('Missing required env var: ' + key)
role = env['ENGINE_DB_USER']
if not re.fullmatch(r'[a-z][a-z0-9_]{0,62}', role):
    raise SystemExit('ENGINE_DB_USER must be a PostgreSQL role identifier')

def query(sql, sensitive=False):
    if sensitive:
        sql = ('SET log_statement=none; SET log_min_error_statement=panic; '
               'SET log_min_duration_statement=-1; SET log_min_duration_sample=-1;\n' + sql)
    result = subprocess.run([
        'docker', 'exec', '-i', 'vulpine-db', 'sh', '-c',
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt --set ON_ERROR_STOP=on',
    ], input=sql + '\n', capture_output=True, text=True)
    if result.returncode:
        raise SystemExit('Engine database provisioning failed; raw SQL errors suppressed to protect credentials')
    return result.stdout.strip()

if query('SHOW log_statement;') != 'none':
    raise SystemExit('Provisioning requires secret-safe PostgreSQL statement logging')
if query(f"SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='{role}');") == 'f':
    password = env['ENGINE_DB_PASSWORD'].replace("'", "''")
    query(f"CREATE ROLE {role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '{password}';", sensitive=True)
if query(f"SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls FROM pg_roles WHERE rolname='{role}';") != 't':
    raise SystemExit('Configured Engine role has unexpected administrative privileges')
query(f"BEGIN; GRANT CONNECT ON DATABASE vulpine TO {role}; GRANT USAGE ON SCHEMA public TO {role}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO {role}; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO {role}; ALTER DEFAULT PRIVILEGES FOR ROLE vulpine IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO {role}; ALTER DEFAULT PRIVILEGES FOR ROLE vulpine IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO {role}; COMMIT;")
# Keep unrelated administrator credentials out of the application container.
import ast
import os
root = pathlib.Path(__file__).resolve().parents[1]
settings = next(n for n in ast.parse((root / 'shared/config.py').read_text()).body if isinstance(n, ast.ClassDef) and n.name == 'Settings')
allowed = {n.target.id.upper() for n in settings.body if isinstance(n, ast.AnnAssign)}
raw = {line.split('=', 1)[0].strip(): line.split('=', 1)[1] for line in (root / '.env').read_text().splitlines() if '=' in line and not line.lstrip().startswith('#')}
app = {key: value for key, value in raw.items() if key in allowed}
app.update(DATABASE_URL='postgresql+asyncpg://' + role + ':' + env['ENGINE_DB_PASSWORD'] + '@postgres:5432/vulpine', REDIS_URL='redis://redis:6379/0', APP_ENV='production', DEBUG='false', PYTHONDONTWRITEBYTECODE='1', HOME='/tmp')
path = root / '.env.api'
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
os.fchmod(fd, 0o600)
os.fchown(fd, 0, 0)
with os.fdopen(fd, 'w') as private:
    private.write(''.join(key + '=' + value + '\n' for key, value in app.items()))
print('Dedicated Engine database role and restricted application environment verified')
