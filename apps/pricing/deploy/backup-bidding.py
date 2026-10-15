#!/usr/bin/env python3
"""Root timer: dedicated bidding database only. Does not touch other databases."""
from pathlib import Path
import json,subprocess,os,datetime
os.umask(0o077)
target=Path('/var/backups/vulpine-bidding')
target.mkdir(parents=True,exist_ok=True,mode=0o700)
config=json.loads(subprocess.check_output(['docker','inspect','vulpine-db']))[0]['Config']['Env']
admin=dict(x.split('=',1) for x in config)['POSTGRES_USER']
filename=target/('bidding-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.dump')
with filename.open('wb') as output:
 subprocess.run(['docker','exec','vulpine-db','pg_dump','-U',admin,'-Fc','vulpine_bidding'],stdout=output,check=True)
subprocess.run(['docker','exec','-i','vulpine-db','pg_restore','--list'],stdin=filename.open('rb'),stdout=subprocess.DEVNULL,check=True)
print('Dedicated bidding backup created; archive manifest verified.')
