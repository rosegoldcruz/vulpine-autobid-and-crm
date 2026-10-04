import http from 'node:http';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyClaim, hashBody, draftModules, validateDraft, redact, leadAssessment } from './core.mjs';
import { createSources, row } from './sources.mjs';

export function createOperationsServer(env) {
  const logs=[];
  const diagnostic = event => {logs.unshift({id:randomUUID(),time:new Date().toISOString(),...event});logs.splice(250);};
  const sources=createSources(env,diagnostic);
  const storeRoot=env.OPS_STORAGE_PATH;
  let queue=Promise.resolve();
  const folder=org=>path.join(storeRoot,createHash('sha256').update(org).digest('hex'));
  async function readStore(org) {try{return JSON.parse(await fs.readFile(path.join(folder(org),'records.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {records:[],events:[]};throw e;}}
  async function writeStore(org,store) {
    await fs.mkdir(folder(org),{recursive:true,mode:0o700});
    const tmp=path.join(folder(org),`${randomUUID()}.tmp`);
    await fs.writeFile(tmp,JSON.stringify(store),{mode:0o600});
    await fs.rename(tmp,path.join(folder(org),'records.json'));
  }
  function respond(res,status,body) {res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));}
  return http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://operations.internal');
    if(req.method==='GET'&&url.pathname==='/health')return respond(res,200,{status:'ok',service:'vulpine-operations',version:1});
    const match=/^\/modules\/([a-z]+)$/.exec(url.pathname);
    if(!match)return respond(res,404,{error:'Unknown operation.'});
    const module=match[1]; let body='';
    try {
      for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1024*1024)return respond(res,413,{error:'Request too large.'});}
      const claim=verifyClaim(req.headers['x-vulpine-operations'],env.OPS_SIGNING_SECRET,{module,method:req.method,org:env.OPS_ORGANIZATION_ID,bodyHash:hashBody(body)});
      if(!claim)return respond(res,401,{error:'A valid organization-scoped integration request is required.'});
      if(req.method==='GET') {
        const data=await sources.read(module,(url.searchParams.get('q')||'').slice(0,200));
        const store=await readStore(claim.org);
        data.records.push(...store.records.filter(r=>r.module===module).map(r=>row(r.id,r.title,r.status||'Draft','Operator workspace',{...r,...(module==='leads'?leadAssessment(r):{})},undefined)));
        if(['activity','events'].includes(module))data.records.push(...store.events.map(e=>row(e.id,e.action,'Recorded','Backoffice audit',e)));
        if(module==='logs')data.records=logs.map(e=>row(e.id,e.message||e.source,e.status,'Operations adapter',{time:e.time,module:e.module,source:e.source}));
        return respond(res,200,data);
      }
      if(!draftModules.has(module)||!['POST','PATCH','DELETE'].includes(req.method))return respond(res,405,{error:'This source is read-only.'});
      let input;try{input=JSON.parse(body);}catch{return respond(res,400,{error:'Invalid JSON.'});}
      const task=queue.then(async()=>{
        const store=await readStore(claim.org);
        const existing=store.records.find(r=>r.id===input.id&&r.module===module);
        if(req.method!=='POST'&&!existing)return {status:404,body:{error:'Record not found.'}};
        if(req.method!=='POST'&&input.updatedAt!==existing.updatedAt)return {status:409,body:{error:'This record changed. Refresh before saving.'}};
        if(req.method==='DELETE')store.records=store.records.filter(r=>r!==existing);
        else {
          let clean;
          try { clean=validateDraft(input); } catch(error) { return {status:400,body:{error:error.message}}; }
          if(module==='emailblaster'&&!['Draft','Paused','Ready for review'].includes(clean.status||'Draft'))return {status:400,body:{error:'Campaign delivery must be performed in the configured provider.'}};
          const saved={...clean,id:existing?.id||randomUUID(),module,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:existing?.createdBy||claim.sub,updatedBy:claim.sub};
          if(existing)store.records[store.records.indexOf(existing)]=saved;else store.records.push(saved);
        }
        store.events.unshift({id:randomUUID(),action:`${module}.${req.method.toLowerCase()}`,actor:claim.sub,recordId:input.id||store.records.at(-1)?.id,time:new Date().toISOString()});
        store.events=store.events.slice(0,5000);
        await writeStore(claim.org,store);
        return {status:200,body:{saved:true}};
      });
      queue=task.catch(()=>{});
      const result=await task;return respond(res,result.status,result.body);
    }catch(error){diagnostic({module,status:'error',message:redact(error.message)});respond(res,error instanceof TypeError?400:500,{error:'The operation could not be completed. Inspect Operations logs or retry.'});}
  });
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const env={...process.env};
  for(const filename of (process.env.OPS_ENV_FILES||'').split(',').filter(Boolean))Object.assign(env,parseEnv(readFileSync(filename,'utf8')));
  if(!env.OPS_SIGNING_SECRET||env.OPS_SIGNING_SECRET.length<32||!env.OPS_ORGANIZATION_ID||!env.OPS_STORAGE_PATH)throw new Error('Operations signing, organization and storage configuration are required.');
  createOperationsServer(env).listen(Number(env.OPS_PORT||3020),'127.0.0.1',()=>console.log('Operations adapter listening on loopback.'));
}
