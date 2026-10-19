import {QuoteStore} from './quote-store.mjs';
import {lookupTax,lookupTransactionTax,manualTax,verifyExemption,taxProvider,verifyTax} from './tax-provider.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {calculateProject} from './src/pricing.mjs';
import {createWorkbook} from './src/quote-xlsx.mjs';
import {generateQuote} from './src/quote-pdf.mjs';
import XLSX from 'xlsx';
import PDFLib from 'pdf-lib';

export function verify(token,secret,expected){
  if(typeof token!=='string'||!secret||secret.length<32)return null;
  const [payload,sig,extra]=token.split('.');if(!payload||!sig||extra)return null;
  const actual=Buffer.from(sig,'base64url'),wanted=createHmac('sha256',secret).update(payload).digest();
  if(actual.length!==wanted.length||!timingSafeEqual(actual,wanted))return null;
  try{const c=JSON.parse(Buffer.from(payload,'base64url'));return c.sub&&c.org===expected.org&&c.module==='pricing'&&c.path===expected.path&&c.method===expected.method&&c.bodyHash===expected.bodyHash&&c.exp>Date.now()/1000&&c.exp<Date.now()/1000+90?c:null;}catch{return null;}
}
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).filter(k=>!['_history','_calculation','supplierDrafts'].includes(k)).sort().map(k=>[k,v[k]])):v);
const hash=s=>createHash('sha256').update(s).digest('hex');
const studioTypes={'.svg':'image/svg+xml','.ico':'image/x-icon','.planmeasure':'application/octet-stream','.txt':'text/plain; charset=utf-8'};
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export async function createServer(env,root=path.dirname(fileURLToPath(import.meta.url))){
  const data=JSON.parse(await fs.readFile(path.join(root,'src/catalog.json')));
  const catalogs={hci:data};
  for(const supplier of ['rythern','uscd'])catalogs[supplier]=JSON.parse(await fs.readFile(path.join(root,'src/suppliers',supplier+'.json')));
  const template=await fs.readFile(path.join(root,'assets/proposal-template.pdf'));
  const signatureBytes=env.VULPINE_SIGNATURE_PATH?await fs.readFile(env.VULPINE_SIGNATURE_PATH):null;
  const respond=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  const history=env.QUOTES_DATABASE_URL?new QuoteStore(env.QUOTES_DATABASE_URL):null;
  if(history)await history.init();
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://internal'),route=url.pathname.slice(1);
      if(route==='health')return respond(res,200,{status:'ok',service:'cabinet-pricing'});
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>(route.startsWith('agent/sources/')?3145728:1048576))return respond(res,413,{error:'Request too large.'});}
      const claim=verify(req.headers['x-vulpine-operations'],env.OPS_SIGNING_SECRET,{org:env.OPS_ORGANIZATION_ID,path:route,method:req.method,bodyHash:hash(body)});
      if(!claim)return respond(res,401,{error:'Verified backoffice session required.'});
      if(history&&req.method==='GET'){
        if(route==='projects')return respond(res,200,{projects:await history.projects(claim),quotes:await history.list(claim)});
        if(/^quotes\/[a-f0-9-]{36}$/.test(route)){const q=await history.get(claim,route.split('/')[1]);return respond(res,200,{archived:!!q.deleted_at,state:{...q.state,_history:{id:q.id,revision:q.revision}},exports:await history.exports(claim,q.id)});}
        if(/^documents\/[a-f0-9-]{36}$/.test(route)){const doc=await history.download(claim,route.split('/')[1]);if(!doc)return respond(res,404,{error:'Document not found.'});res.writeHead(200,{'content-type':types['.'+doc.format],'cache-control':'no-store','content-disposition':'inline; filename="Vulpine-'+doc.type+'.'+doc.format+'"'});res.end(doc.bytes);return;}
      }
      if(route==='tax/status' &&req.method==='GET')return respond(res,200,{configured:!!taxProvider(env),provider:taxProvider(env)});
      if(route==='tax/lookup'&&req.method==='POST'){
        try{return respond(res,200,await lookupTax(JSON.parse(body).address,env));}
        catch(e){return respond(res,e.status||422,{error:e.message});}
      }
      if(route.startsWith('agent/')){
        const upstream=await fetch('http://127.0.0.1:3022/'+route,{method:req.method,headers:{'x-vulpine-operations':req.headers['x-vulpine-operations'],'content-type':'application/json'},body:['GET','HEAD'].includes(req.method)?undefined:body,signal:AbortSignal.timeout(45000)});
        res.writeHead(upstream.status,{'content-type':'application/json','cache-control':'no-store'});res.end(await upstream.text());return;
      }
      if(route==='draft'){
        const dir=path.join(env.CABINET_STORAGE_PATH,hash(claim.org)),filename=path.join(dir,hash(claim.sub)+'.json');
        if(req.method==='GET'){try{return respond(res,200,JSON.parse(await fs.readFile(filename,'utf8')));}catch(e){if(e.code==='ENOENT')return respond(res,200,{draft:null,revision:null});throw e;}}
        if(req.method==='PUT'){
          const input=JSON.parse(body);
          validate(input.draft);
          // Serialize read/check/write to reject stale tabs without losing a newer draft.
          const task=queue.then(async()=>{
            let previous=null;try{previous=JSON.parse(await fs.readFile(filename,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
            if((previous?.revision??null)!==(input.revision??null))return respond(res,409,{error:'This draft changed in another tab. Reload before saving.'});
            if(history)input.draft._history=await history.save(claim,input.draft,input.draft._history);
            const saved={draft:input.draft,revision:randomUUID(),updatedAt:new Date().toISOString(),updatedBy:claim.sub};
            await fs.mkdir(dir,{recursive:true,mode:0o700});const tmp=filename+'.'+randomUUID();await fs.writeFile(tmp,JSON.stringify(saved),{mode:0o600});await fs.rename(tmp,filename);respond(res,200,saved);
          });queue=task.catch(()=>{});await task;return;
        }
        return respond(res,405,{error:'Method not allowed.'});
      }
      if(route==='export'&&req.method==='POST'){
        const input=JSON.parse(body);
        if(input.format==='revise-quote'){if(!history)return respond(res,503,{error:'Project storage unavailable.'});const q=await history.get(claim,input.quote_id);if(q.revision!==input.expected_revision)return respond(res,409,{error:'Quote changed. Reopen before revising.'});const revised={...q.state,pricingPolicy:2,revisionOf:q.quote_number,quoteId:q.quote_number+'-R'+randomUUID().slice(0,6).toUpperCase(),signature:undefined,issuedAt:undefined,status:'Tentative'};delete revised._history;const ref=await history.save(claim,revised,null);return respond(res,200,{state:{...revised,_history:ref}});}
        if(input.format==='tax-exemption')return respond(res,200,verifyExemption(input,env));
        if(input.format==='manual-tax')return respond(res,200,manualTax(input,env,claim.sub));
        if(input.format==='delete-quote'){if(!history)return respond(res,503,{error:'Project storage is unavailable.'});if(!/^[a-f0-9-]{36}$/.test(input.quote_id)||!Number.isInteger(input.expected_revision)||input.expected_revision<1)return respond(res,400,{error:'Quote ID and current revision are required.'});return respond(res,200,await history.delete(claim,input.quote_id,input.expected_revision));}
        if(input.format==='project-action'){if(!history)return respond(res,503,{error:'Project storage is unavailable.'});return respond(res,200,await history.project(claim,input.name,input.action));}
        // Use the existing authenticated, same-origin POST proxy for the read-only rate calculation.
        if(input.format==='tax-rate'){
          try{return respond(res,200,input.state?.pricingPolicy===2?await lookupTransactionTax(input.address,calculateProject(catalogs[input.state.supplier||'hci'],input.state).taxableItems,input.state.date,env):await lookupTax(input.address,env));}
          catch(e){return respond(res,e.status||422,{error:e.message});}
        }
        let {state,type,format}=input;
        if(history&&state?._history){const ref=state._history,saved=await history.get(claim,ref.id);if(saved.revision!==ref.revision||canonical(state)!==canonical(saved.state))return respond(res,409,{error:'Quote changed or contains unsaved edits. Save and reopen it before exporting.'});state={...saved.state,_history:ref};}
        validate(state);if(type==='customer')verifyTax(state.tax,env);
        const data=catalogs[state.supplier||'hci'];if(!data)return respond(res,400,{error:'Unknown supplier.'});
        const result=calculateProject(data,state);if(result.issues.length)return respond(res,422,{error:result.issues.join(' ')});
        let bytes,mime;
        if(format==='xlsx'){bytes=XLSX.write(createWorkbook(XLSX,data,state),{type:'buffer',bookType:'xlsx',compression:true});mime=types['.xlsx'];}
        else if(format==='pdf'&&['customer','internal','purchase','draft'].includes(type)){bytes=await generateQuote(PDFLib,data,state,type,template,new Date(),{signatureBytes});mime=types['.pdf'];}
        else return respond(res,400,{error:'Unknown export format.'});
        if(history){const ref=state._history||await history.save(claim,state,null);const saved=await history.get(claim,ref.id);if(saved.revision!==ref.revision)throw Object.assign(Error('Quote changed. Reopen before exporting.'),{status:409});await history.addExport(claim,ref,type,format,Buffer.from(bytes));}
        res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});res.end(bytes);return;
      }
      if(req.method!=='GET')return respond(res,405,{error:'Method not allowed.'});
      const file=route||'index.html';
      const mime=types[path.extname(file)]||(file.startsWith('studio/')?studioTypes[path.extname(file)]:null);
      if(file.includes('..')||file.includes('\\')||!mime||!/^[-a-zA-Z0-9_./ ()]+$/.test(file))return respond(res,404,{error:'Not found.'});
      const bytes=await fs.readFile(path.join(root,'dist',file));
      res.writeHead(200,{'content-type':mime,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"frame-ancestors 'self'; object-src 'none'; base-uri 'self'"});res.end(bytes);
    }catch(e){respond(res,e.status||(e.code==='ENOENT'?404:400),{error:e.status?e.message:e.code==='ENOENT'?'Not found.':'Could not process the cabinet request.'});}
  });
  server.on('close',()=>history?.close());
  return server;
}
let queue=Promise.resolve();
function validate(s){
  if(!s||s.version!==2||!Number.isInteger(s.margin)||s.margin<1||s.margin>50||!Array.isArray(s.units)||!s.units.length||s.units.length>500)throw Error('Invalid draft.');
  if(s.supplier&&!['hci','rythern','uscd'].includes(s.supplier))throw Error('Invalid supplier.');
  for(const u of s.units){if(typeof u.id!=='string'||typeof u.name!=='string'||!Array.isArray(u.items)||u.items.length>2000)throw Error('Invalid unit.');for(const i of u.items)if(typeof i.sku!=='string'||!Number.isInteger(i.li)||i.li<0||i.li>500||!Number.isFinite(i.qty))throw Error('Invalid item.');}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  for(const name of ['OPS_SIGNING_SECRET','OPS_ORGANIZATION_ID','CABINET_STORAGE_PATH'])if(!process.env[name])throw Error('Missing required env var: '+name);
  const server=await createServer(process.env);server.listen(Number(process.env.CABINET_PORT||3021),'127.0.0.1');
}
