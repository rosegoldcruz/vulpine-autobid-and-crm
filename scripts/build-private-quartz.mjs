#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const quartz='/opt/quartz'
const nginx=await fs.readFile('/etc/nginx/sites-available/brain.vulpine.llc','utf8')
if(!/auth_basic\s+"AEON Vault"/.test(nginx)||!/auth_basic_user_file\s+\/etc\/nginx\/\.htpasswd\.brain;/.test(nginx)||/auth_basic\s+off/.test(nginx))throw Error('The private vault requires the existing Nginx authentication gate.')
const config=JSON.parse(await fs.readFile(path.join(repo,'docs/continuity/vault.json'),'utf8'))
if(await fs.realpath(path.join(quartz,'content'))!==await fs.realpath(config.vault))throw Error('Quartz does not point to the approved vault.')
for(const [source,target] of [['infra/quartz/privacy.mjs','aeon-privacy.mjs'],['infra/quartz/privacy.d.mts','aeon-privacy.d.mts'],['infra/quartz/quartz.ts','quartz.ts']])await fs.copyFile(path.join(repo,source),path.join(quartz,target))
const root='/var/lib/aeon-quartz-private'
await fs.mkdir(root+'/releases',{recursive:true,mode:0o755})
const output=root+'/releases/'+Date.now()
const log='/tmp/aeon-private-quartz-build.log'
const fd=(await fs.open(log,'w',0o600))
const built=spawnSync(process.execPath,['quartz/bootstrap-cli.mjs','build','--output',output],{cwd:quartz,env:{...process.env,AEON_QUARTZ_PRIVATE_VIEW:'1',AEON_QUARTZ_PRIVATE_OUTPUT:output},stdio:['ignore',fd.fd,fd.fd]})
await fd.close()
if(built.status!==0)throw Error('Private Quartz build failed. Inspect its private local build log.')
await fs.access(path.join(output,'index.html'))
const tmp=root+'/current-next'
await fs.symlink(output,tmp)
await fs.rename(tmp,root+'/current')
console.log(JSON.stringify({privateOutput:output,homePage:true,authentication:'Existing Nginx Basic Auth required',publicBuildPolicy:'unchanged'}))
