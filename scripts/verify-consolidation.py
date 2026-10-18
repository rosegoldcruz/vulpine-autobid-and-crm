#!/usr/bin/env python3
"""Read-only checks for the owner-authorized /opt monorepo cutover."""
import json
import os
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path('/opt/vulpine-platform')
report = json.loads((ROOT / 'infra/consolidation/result.json').read_text())
removed = [entry['removed'] for entry in report['deleted']]
for path in removed:
    assert path.startswith('/opt/') and not path.startswith('/opt/vulpine-supply')
    assert not os.path.lexists(path), f'Obsolete location still exists: {path}'

def obsolete(value):
    return any(value == old or value.startswith(old + '/') or value.startswith(old + ' (deleted)') for old in removed)

def output(*args):
    return subprocess.check_output(args, text=True)

apps = json.loads(output('pm2', 'jlist'))
for app in apps:
    env = app['pm2_env']
    assert env['status'] == 'online', app['name']
    assert env['pm_cwd'].startswith(str(ROOT)), app['name']
    for value in [env['pm_cwd'], env['pm_exec_path'], *env.get('args', [])]:
        assert not obsolete(str(value)), app['name']
print(f'PM2: {len(apps)} applications online from the monorepo')

for name in ['vulpine-cabinet-pricing', 'vulpine-bidding', 'vulpine-operations']:
    assert output('systemctl', 'is-active', name).strip() == 'active', name
    cwd = output('systemctl', 'show', name, '--property=WorkingDirectory', '--value').strip()
    assert cwd.startswith(str(ROOT)), name
print('systemd: pricing, bidding and operations use canonical source')

for name in output('docker', 'ps', '--format', '{{.Names}}').splitlines():
    container = json.loads(output('docker', 'inspect', name))[0]
    for mount in container['Mounts']:
        assert not obsolete(mount['Source']), name
    if name in ['vulpine-api', 'vulpine-db', 'vulpine-redis', 'vulpine-n8n']:
        cwd = container['Config']['Labels']['com.docker.compose.project.working_dir']
        assert cwd.startswith(str(ROOT)), name
print('Containers: canonical Engine Compose; no mounts from deleted locations')

# Inspect kernel references, never traverse /home or excluded application trees.
for process in Path('/proc').iterdir():
    if not process.name.isdigit():
        continue
    candidates = [process / 'cwd', process / 'exe']
    try:
        candidates += list((process / 'fd').iterdir())
    except OSError:
        pass
    for link in candidates:
        try:
            target = os.readlink(link)
        except OSError:
            continue
        assert not obsolete(target), f'Process {process.name} still uses {target}'
print('Processes: no working directories or open files depend on removed locations')

for name, url in {
    'AI': 'http://127.0.0.1:3015/',
    'Cabinet Brain': 'http://127.0.0.1:3000/api/health',
    'Tracker': 'http://127.0.0.1:4400/health',
    'Drive backend': 'http://127.0.0.1:3017/health',
    'Pricing': 'http://127.0.0.1:3021/health',
    'Bidding': 'http://127.0.0.1:3022/health',
    'Engine': 'http://127.0.0.1:8000/health',
    'Automations': 'http://127.0.0.1:5678/healthz',
}.items():
    with urllib.request.urlopen(url, timeout=15) as response:
        assert response.status == 200, name
    print(f'{name}: HTTP 200')
print(f'Consolidation verified: {len(removed)} obsolete locations removed; /home and Vulpine Supply excluded')
