#!/bin/bash
set -euo pipefail
umask 077
backup_root=/var/backups/vulpine-security/snapshots
install -d -m 700 "$backup_root"
exec 9>/run/vulpine-security-backup.lock
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
stage=$(mktemp -d "$backup_root/.partial.XXXXXXXX")
trap 'rm -rf -- "$stage"' EXIT

# PostgreSQL credentials stay in the existing container environment.
docker exec vulpine-db sh -c 'pg_dumpall -U "$POSTGRES_USER" --globals-only' > "$stage/postgres-globals.sql"
docker exec vulpine-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT datname FROM pg_database WHERE datistemplate=false ORDER BY datname"' > "$stage/databases.txt"
docker exec vulpine-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT datname,pg_get_userbyid(datdba) FROM pg_database WHERE datistemplate=false ORDER BY datname"' > "$stage/database-owners.txt"
while IFS= read -r db; do
  [[ "$db" =~ ^[A-Za-z0-9_-]+$ ]] || { echo 'Unsupported database name; backup aborted' >&2; exit 1; }
  docker exec vulpine-db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$1" --format=custom' sh "$db" > "$stage/postgres-$db.dump"
  test -s "$stage/postgres-$db.dump"
done < "$stage/databases.txt"

python3 - "$stage" <<'PY'
import pathlib, sqlite3, sys
for source, filename in [
    (pathlib.Path('/var/lib/vulpine-tracker/data/bids.db'), 'bids.db'),
    (pathlib.Path('/var/lib/vulpine-vision/autobidder/cabinet-brain.sqlite'), 'vision.sqlite'),
]:
    with sqlite3.connect(f'file:{source}?mode=ro', uri=True) as src:
        with sqlite3.connect(str(pathlib.Path(sys.argv[1]) / filename)) as dest:
            src.backup(dest)
            if dest.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('SQLite backup integrity verification failed')
PY

# Capture the application filestore; SQLite is snapshotted separately above.
(cd /var/lib/vulpine-vision && find autobidder -type f ! -name '*.sqlite' ! -name '*.sqlite-wal' ! -name '*.sqlite-shm' -print0) > "$stage/vision-files.list"
tar -czf "$stage/vision-filestore.tar.gz" --null --no-recursion -C /var/lib/vulpine-vision -T "$stage/vision-files.list"
tar -czf "$stage/engine-uploads.tar.gz" -C /var/lib/vulpine-engine-api uploads
tar -czf "$stage/operations-state.tar.gz" -C /var/lib vulpine-operations
python3 - "$stage" <<'PY'
import pathlib, shutil, sys, time
base = pathlib.Path('/var/lib/paperclip/.paperclip/instances/default/data/backups')
completed = [p for p in base.glob('*.sql.gz') if p.stat().st_mtime < time.time() - 120]
if not completed:
    raise RuntimeError('Completed Paperclip database backup unavailable')
latest = max(completed, key=lambda p: p.stat().st_mtime)
shutil.copyfile(latest, pathlib.Path(sys.argv[1]) / 'paperclip.sql.gz')
PY

# Retain server trust material only in the private recovery snapshot.
python3 - "$stage" <<'PY_TRUST'
import pathlib, tarfile, sys
paths=[pathlib.Path('/etc/letsencrypt'),pathlib.Path('/root/.ssh/authorized_keys')]
paths.extend(pathlib.Path('/etc/ssh').glob('ssh_host_*'))
with tarfile.open(str(pathlib.Path(sys.argv[1])/'private-trust-state.tar.gz'),'w:gz') as archive:
    for path in paths:
        if path.exists():
            archive.add(path,arcname=str(path).lstrip('/'))
PY_TRUST

# Preserve recovery configuration without exposing it to other host users.
tar -czf "$stage/host-config.tar.gz" -C / etc/nginx etc/systemd/system etc/ssh/sshd_config etc/ssh/sshd_config.d etc/passwd etc/group root/.ssh/known_hosts usr/local/sbin/vulpine-host-ingress usr/local/sbin/vulpine-private-ports-firewall usr/local/sbin/vulpine-security-backup usr/local/sbin/vulpine-security-monitor usr/local/sbin/vulpine-app-run opt/vulpine-platform/services/engine/docker-compose.yml opt/vulpine-platform/services/engine/db/provision-n8n.py opt/vulpine-platform/services/engine/db/provision-api.py
python3 - "$stage" <<'PY'
import pathlib, tarfile, sys
paths = [pathlib.Path('/opt/.env.local')]
paths += [
    pathlib.Path('/var/lib/docker/volumes/vulpine-engine_n8ndata/_data/config'),
    pathlib.Path('/var/lib/paperclip/.paperclip/instances/default/.env'),
    pathlib.Path('/etc/vulpine-operations/runtime.env'),
    pathlib.Path('/root/.pm2/dump.pm2'),
]
paths.extend(pathlib.Path('/etc/vulpine-apps').glob('*.pm2.json'))
paths.extend(pathlib.Path('/etc/vulpine-platform').glob('**/*.env'))
for repo in ['vulpine-platform','hermes-webui']:
    paths.extend(p for p in (pathlib.Path('/opt') / repo).glob('.env*') if p.is_file())
with tarfile.open(str(pathlib.Path(sys.argv[1]) / 'private-environment.tar.gz'), 'w:gz') as archive:
    for path in paths:
        if path.exists():
            archive.add(path, arcname=str(path).lstrip('/'), recursive=False)
PY
(cd "$stage" && sha256sum ./* > SHA256SUMS)
mv "$stage" "$backup_root/$stamp"
trap - EXIT
logger -t vulpine-security-backup 'Private local snapshot completed; off-host recovery remains unverified'
# Delete only snapshots created by this script, after a successful replacement.
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '20*T*Z' -mtime +14 -exec rm -rf -- {} +
