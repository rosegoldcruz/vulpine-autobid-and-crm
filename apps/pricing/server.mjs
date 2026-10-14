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
const hash=s=>createHash('sha256').update(s).digest('hex');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export async function createServer(env,root=path.dirname(fileURLToPath(import.meta.url))){
  const data=JSON.parse(await fs.readFile(path.join(root,'src/catalog.json')));
  const template=await fs.readFile(path.join(root,'assets/proposal-template.pdf'));
  const respond=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://internal'),route=url.pathname.slice(1);
      if(route==='health')return respond(res,200,{status:'ok',service:'cabinet-pricing'});
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1048576)return respond(res,413,{error:'Request too large.'});}
      const claim=verify(req.headers['x-vulpine-operations'],env.OPS_SIGNING_SECRET,{org:env.OPS_ORGANIZATION_ID,path:route,method:req.method,bodyHash:hash(body)});
      if(!claim)return respond(res,401,{error:'Verified backoffice session required.'});
      if(route==='draft'){
        const dir=path.join(env.CABINET_STORAGE_PATH,hash(claim.org)),filename=path.join(dir,hash(claim.sub)+'.json');
        if(req.method==='GET'){try{return respond(res,200,JSON.parse(await fs.readFile(filename,'utf8')));}catch(e){if(e.code==='ENOENT')return respond(res,200,{draft:null,revision:null});throw e;}}
        if(req.method==='PUT'){
          const input=JSON.parse(body);validate(input.draft);
          // Serialize read/check/write to reject stale tabs without losing a newer draft.
          const task=queue.then(async()=>{
            let previous=null;try{previous=JSON.parse(await fs.readFile(filename,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
            if((previous?.revision??null)!==(input.revision??null))return respond(res,409,{error:'This draft changed in another tab. Reload before saving.'});
            const saved={draft:input.draft,revision:randomUUID(),updatedAt:new Date().toISOString(),updatedBy:claim.sub};
            await fs.mkdir(dir,{recursive:true,mode:0o700});const tmp=filename+'.'+randomUUID();await fs.writeFile(tmp,JSON.stringify(saved),{mode:0o600});await fs.rename(tmp,filename);respond(res,200,saved);
          });queue=task.catch(()=>{});await task;return;
        }
        return respond(res,405,{error:'Method not allowed.'});
      }
      if(route==='export'&&req.method==='POST'){
        const {state,type,format}=JSON.parse(body);validate(state);
        const result=calculateProject(data,state);if(result.issues.length)return respond(res,422,{error:result.issues.join(' ')});
        let bytes,mime;
        if(format==='xlsx'){bytes=XLSX.write(createWorkbook(XLSX,data,state),{type:'buffer',bookType:'xlsx',compression:true});mime=types['.xlsx'];}
        else if(format==='pdf'&&['customer','internal','purchase'].includes(type)){bytes=await generateQuote(PDFLib,data,state,type,template);mime=types['.pdf'];}
        else return respond(res,400,{error:'Unknown export format.'});
        res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});res.end(bytes);return;
      }
      if(req.method!=='GET')return respond(res,405,{error:'Method not allowed.'});
      const file=route||'index.html';
      if(file.includes('..')||file.includes('\\')||!types[path.extname(file)]||!/^[-a-zA-Z0-9_./ ()]+$/.test(file))return respond(res,404,{error:'Not found.'});
      const bytes=await fs.readFile(path.join(root,'dist',file));
      res.writeHead(200,{'content-type':types[path.extname(file)],'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"frame-ancestors 'self'; object-src 'none'; base-uri 'self'"});res.end(bytes);
    }catch(e){respond(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Not found.':'Could not process the cabinet request.'});}
  });
}
let queue=Promise.resolve();
function validate(s){
  if(!s||s.version!==2||!Number.isInteger(s.margin)||s.margin<1||s.margin>50||!Array.isArray(s.units)||!s.units.length||s.units.length>500)throw Error('Invalid draft.');
  for(const u of s.units){if(typeof u.id!=='string'||typeof u.name!=='string'||!Array.isArray(u.items)||u.items.length>2000)throw Error('Invalid unit.');for(const i of u.items)if(typeof i.sku!=='string'||!Number.isInteger(i.li)||i.li<0||i.li>10||!Number.isFinite(i.qty))throw Error('Invalid item.');}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  for(const name of ['OPS_SIGNING_SECRET','OPS_ORGANIZATION_ID','CABINET_STORAGE_PATH'])if(!process.env[name])throw Error('Missing required env var: '+name);
  const server=await createServer(process.env);server.listen(Number(process.env.CABINET_PORT||3021),'127.0.0.1');
}
