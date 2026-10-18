#!/usr/bin/env node
// Explicit administrative provisioning; credentials are captured directly into
// the approved private operations environment and never printed.
import fs from 'node:fs'
import {parseEnv} from 'node:util'
import {spawnSync} from 'node:child_process'
const env=parseEnv(fs.readFileSync('/opt/vulpine-platform/infra/erpnext/.env','utf8'))
const site=env.ERP_SITE_NAME
if(!/^[a-zA-Z0-9.-]+$/.test(site))throw Error('Invalid ERP site.')
const script=`import json, frappe
frappe.init(site=${JSON.stringify(site)})
frappe.connect()
frappe.set_user('Administrator')
name='aeon-agents@vulpine.llc'
if not frappe.db.exists('User',name):
    available=[r for r in ['System Manager','Accounts Manager','Sales Manager','HR Manager'] if frappe.db.exists('Role',r)]
    doc=frappe.get_doc({'doctype':'User','email':name,'first_name':'AEON Agent Integration','enabled':1,'user_type':'System User','send_welcome_email':0,'roles':[{'role':r} for r in available]})
    doc.insert(ignore_permissions=True)
doc=frappe.get_doc('User',name)
if not doc.api_key:
    from frappe.core.doctype.user.user import generate_keys
    generate_keys(name)
    doc.reload()
secret=doc.get_password('api_secret')
frappe.db.commit()
print('AEON_AGENT_CONFIG='+json.dumps({'key':doc.api_key,'secret':secret}))
frappe.destroy()
`
const r=spawnSync('docker',['exec','-i','-w','/home/frappe/frappe-bench/sites','vulpine-erpnext-backend-1','/home/frappe/frappe-bench/env/bin/python','-'],{input:script,encoding:'utf8',maxBuffer:1024*1024})
if(r.status!==0){fs.writeFileSync('/tmp/erp-agent-provision-error.log',r.stderr,{mode:0o600});throw Error('ERPNext integration provisioning failed; inspect its private local log.')}
const line=r.stdout.split('\n').find(s=>s.startsWith('AEON_AGENT_CONFIG='))
if(!line)throw Error('ERP integration result missing.')
const d=JSON.parse(line.slice('AEON_AGENT_CONFIG='.length))
if(!d.key||!d.secret)throw Error('ERP integration credential generation failed.')
const file='/etc/vulpine-operations/runtime.env'
const values={OPS_ERPNEXT_URL:'http://127.0.0.1:8090',OPS_ERPNEXT_HOST:site,OPS_ERPNEXT_API_KEY:d.key,OPS_ERPNEXT_API_SECRET:d.secret}
const kept=fs.readFileSync(file,'utf8').split('\n').filter(line=>!Object.keys(values).some(key=>line.startsWith(key+'=')))
fs.writeFileSync(file,kept.join('\n').trimEnd()+'\n'+Object.entries(values).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600})
console.log('Dedicated ERPNext agent integration configured; no credentials printed.')
