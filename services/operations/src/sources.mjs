import fs from 'node:fs/promises';
import path from 'node:path';
import { redact, commercialSummary } from './core.mjs';
import { DatabaseSync } from 'node:sqlite';

const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k,obj[k]]));
export const row = (id,title,status,source,details={},href) => ({id:String(id),title:String(title || id),status:String(status ?? 'Unknown'),source,details, ...(href ? {href}: {})});
export function createSources(env, diagnostic) {
  const base = name => env[name]?.replace(/\/$/,'');
  async function json(url, headers={}) {
    const r = await fetch(url,{headers,signal:AbortSignal.timeout(10000),redirect:'error'});
    if (!r.ok) throw new Error(`Source returned HTTP ${r.status}.`);
    return r.json();
  }
  const tracker = () => {
    if (!env.BIDS_TRACKER_API_TOKEN) throw new Error('Tracker integration authentication is not configured.');
    return json(`${base('OPS_TRACKER_URL')}/api/bids`, { 'x-vulpine-integration-key': env.BIDS_TRACKER_API_TOKEN });
  };
  function vision(module) {
    if(!env.OPS_VISION_DATABASE)throw new Error('Vision read model is not configured.');
    const db=new DatabaseSync(env.OPS_VISION_DATABASE,{readOnly:true});
    try {
      if(module==='projects')return db.prepare('SELECT p.id,p.name,p.status,p.created_at,p.updated_at,j.id AS job_id FROM projects p LEFT JOIN bid_jobs j ON j.project_id=p.id WHERE p.organization_id=? ORDER BY p.updated_at DESC LIMIT 500').all(env.OPS_ORGANIZATION_ID).map(x=>row(`vision:${x.id}:${x.job_id||''}`,x.name,x.status,'Cabinet Brain projects',x,x.job_id?`/bids/vision?job=${encodeURIComponent(x.job_id)}`:'/bids/vision'));
      if(module==='activity'||module==='events')return db.prepare('SELECT id,project_id,actor_id,action,outcome,reason,occurred_at FROM audit_events WHERE organization_id=? ORDER BY occurred_at DESC LIMIT 100').all(env.OPS_ORGANIZATION_ID).map(x=>row(x.id,x.action,x.outcome,'Cabinet Brain audit',x,'/bids/vision'));
      const table={takeoffs:'takeoff_lines',pricing:'estimate_lines',proposals:'export_artifacts',autobid:'job_runs',jobs:'job_runs'}[module];
      if(!table)return [];
      // Table is from a fixed internal allowlist. Organization is a bound value.
      return db.prepare(`SELECT t.*,p.name AS project_name,j.id AS job_id FROM ${table} t JOIN bid_jobs j ON j.id=t.bid_job_id JOIN projects p ON p.id=j.project_id WHERE p.organization_id=? LIMIT 1000`).all(env.OPS_ORGANIZATION_ID).map(x=>row(x.id,x.description||x.project_name,x.status||'Calculated source record',`Cabinet Brain ${table}`,Object.fromEntries(Object.entries(x).filter(([k])=>!['storage_key','checkpoint_json'].includes(k))),`/bids/vision?job=${encodeURIComponent(x.job_id)}`));
    }finally{db.close();}
  }
  const engine = p => json(`${base('OPS_ENGINE_URL')}/api/v1/auto-bid/${p}`);
  async function paperclip(p) {
    const b = base('OPS_PAPERCLIP_URL');
    if (!b || !env.OPS_PAPERCLIP_COMPANY_ID) throw new Error('Paperclip company connection is not configured.');
    return json(`${b}/api/companies/${encodeURIComponent(env.OPS_PAPERCLIP_COMPANY_ID)}/${p}`);
  }
  async function ghl(p) {
    if (!env.GHL_ACCESS_TOKEN || !env.GHL_LOCATION_ID) throw new Error('GHL credentials or location are not configured.');
    return json(`${base('OPS_GHL_URL')}/${p}${p.includes('?')?'&':'?'}locationId=${encodeURIComponent(env.GHL_LOCATION_ID)}`,{Authorization:`Bearer ${env.GHL_ACCESS_TOKEN.startsWith('pit-')?env.GHL_ACCESS_TOKEN:`pit-${env.GHL_ACCESS_TOKEN}`}`,Version:'2021-07-28'});
  }
  async function twilio(resource) {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) throw new Error('Twilio is not configured.');
    const b = base('OPS_TWILIO_URL');
    return json(`${b}/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/${resource}.json?PageSize=100`,{Authorization:`Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`});
  }
  const serviceDefinitions = [
    ['Tracker','OPS_TRACKER_URL','/health','Historical bid ledger','/bids/tracker'],
    ['Cabinet Brain','OPS_VISION_URL','/api/health','Plan intelligence and QA','/bids/vision'],
    ['Documents','OPS_DOCUMENTS_URL','/health','SFTP files and document access','/drive'],
    ['Bid Engine','OPS_ENGINE_URL','/api/v1/auto-bid/stats','Deterministic estimation and catalog','/bids/engine'],
    ['Paperclip','OPS_PAPERCLIP_URL','/api/health','Agent orchestration','/ai/paperclip'],
    ['Hermes','OPS_HERMES_URL','/login','Conversational runtime','/ai/hermes'],
    ['Ollama','OPS_OLLAMA_URL','/api/tags','Local model runtime','/ai/providers'],
    ['n8n','OPS_N8N_URL','/healthz','Workflow automation','/ai/automations'],
  ];
  async function services() {
    return Promise.all(serviceDefinitions.map(async ([name,key,p,role,href]) => {
      const start=Date.now();
      if (!base(key)) return row(name,name,'UNCONFIGURED','Runtime configuration',{role},href);
      try {
        const res=await fetch(`${base(key)}${p}`,{signal:AbortSignal.timeout(5000),redirect:'manual'});
        return row(name,name,res.ok?'UP':res.status===401||res.status===403?'DEGRADED':'DOWN',`HTTP probe ${p}`,{role,endpoint:base(key),httpStatus:res.status,latencyMs:Date.now()-start,checkedAt:new Date().toISOString(),coverage:'HTTP availability only; does not verify every dependency'},href);
      } catch { return row(name,name,'DOWN',`HTTP probe ${p}`,{role,endpoint:base(key),checkedAt:new Date().toISOString(),error:'Probe did not complete'},href); }
    }));
  }
  async function vault(module,query) {
    const root = env.OPS_VAULT_PATH;
    if (!root) throw new Error('Vault path is not configured.');
    const results=[];
    async function walk(dir,depth=0) {
      if (depth>8 || results.length>=500) return;
      for (const e of await fs.readdir(dir,{withFileTypes:true})) {
        if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
        const file=path.join(dir,e.name), relative=path.relative(root,file);
        if(e.isDirectory()) {await walk(file,depth+1);continue;}
        if(!e.isFile() || !e.name.endsWith('.md')) continue;
        if(module==='sops'&&!/sop|skill|command|procedure/i.test(relative)) continue;
        if(module==='intelligence'&&!/concept|compan|research|source|intelligen/i.test(relative)) continue;
        const stat=await fs.stat(file); if(stat.size>512000) continue;
        const content=await fs.readFile(file,'utf8');
        if(query&&!`${relative}\n${content}`.toLowerCase().includes(query.toLowerCase())) continue;
        results.push(row(relative,content.match(/^#\s+(.+)$/m)?.[1]||e.name,'Document-derived',`PAI vault / ${relative}`,{path:relative,modifiedAt:stat.mtime.toISOString(),bytes:stat.size,content:redact(content).slice(0,30000)}));
      }
    }
    await walk(root); return results.sort((a,b)=>b.details.modifiedAt.localeCompare(a.details.modifiedAt));
  }
  async function activity() {
    const d=await paperclip('activity?limit=100');
    return (Array.isArray(d)?d:d.items||[]).map(x=>row(x.id,x.action,x.actorType,'Paperclip activity',pick(x,['createdAt','actorId','entityType','entityId']),env.OPS_PAPERCLIP_PUBLIC_URL));
  }
  async function agents() {
    const d=await paperclip('agents');
    return (Array.isArray(d)?d:d.items||[]).map(x=>row(x.id,x.name,x.status,'Paperclip agents',pick(x,['role','title','adapterType','lastHeartbeatAt','budgetMonthlyCents','spentMonthlyCents']),env.OPS_PAPERCLIP_PUBLIC_URL));
  }
  async function issues() {
    const d=await paperclip('issues?limit=100');
    return (Array.isArray(d)?d:d.items||[]).map(x=>row(x.id,x.title,x.status,'Paperclip issues',pick(x,['identifier','priority','assigneeAgentId','projectId','createdAt','updatedAt','description']),env.OPS_PAPERCLIP_PUBLIC_URL));
  }
  async function backups() {
    if(!env.OPS_BACKUP_PATH) throw new Error('Backup path is not configured.');
    const root=env.OPS_BACKUP_PATH, rows=[];
    async function walk(dir,depth=0) {
      if(depth>3||rows.length>300) return;
      for(const e of await fs.readdir(dir,{withFileTypes:true})) {
        if(e.isSymbolicLink())continue;
        const f=path.join(dir,e.name);
        if(e.isDirectory()) {
          try { await walk(f,depth+1); } catch(error) {
            if(error.code!=='EACCES')throw error;
            const stat=await fs.stat(f);
            rows.push(row(path.relative(root,f),e.name,'Contents restricted','Backup filesystem',{path:path.relative(root,f),modifiedAt:stat.mtime.toISOString(),coverage:'Directory exists; contents not inspected',restoreVerification:'UNKNOWN',offsiteCopy:'UNKNOWN'}));
          }
          continue;
        }
        if(!e.isFile())continue;
        const s=await fs.stat(f);
        rows.push(row(path.relative(root,f),e.name,'Restore unverified','Backup filesystem',{path:path.relative(root,f),bytes:s.size,modifiedAt:s.mtime.toISOString(),restoreVerification:'UNKNOWN',offsiteCopy:'UNKNOWN'}));
      }
    } await walk(root); return rows;
  }
  async function providers() {
    const rows=['OPENAI','ANTHROPIC','GEMINI','QWEN','XAI','GROQ','MISTRAL','DEEPSEEK'].map(name=>row(name,name,env[`OPS_${name}_CONFIGURED`]==='true'?'CONFIGURED':'UNCONFIGURED','Server configuration',{credentialsPresent:env[`OPS_${name}_CONFIGURED`]==='true',health:'Not probed',usage:'Not available'}));
    if(base('OPS_OLLAMA_URL'))try {const d=await json(`${base('OPS_OLLAMA_URL')}/api/tags`);for(const m of d.models||[])rows.push(row(m.name,m.name,'UP','Ollama model list',pick(m,['size','modified_at','details'])));}catch {rows.push(row('ollama','Ollama','DOWN','Live probe'));}
    return rows;
  }
  async function crm(type) {
    if(type==='opportunities') {const d=await ghl('opportunities/search?limit=100');return (d.opportunities||[]).map(x=>row(x.id,x.name,x.status,'GoHighLevel',pick(x,['monetaryValue','pipelineId','pipelineStageId','contact','assignedTo','createdAt','updatedAt']),env.OPS_GHL_PUBLIC_URL));}
    if(type==='inbox') {const d=await ghl('conversations/search?limit=100');return (d.conversations||[]).map(x=>row(x.id,x.fullName||x.contactName||x.lastMessageBody,x.unreadCount?'Unread':'Read','GoHighLevel conversations',pick(x,['contactId','lastMessageBody','lastMessageDate','lastMessageType','unreadCount']),env.OPS_GHL_PUBLIC_URL));}
    const d=await ghl('contacts/?limit=100');
    return (d.contacts||[]).map(x=>row(x.id,[x.firstName,x.lastName].filter(Boolean).join(' ')||x.companyName||x.id,'Contact','GoHighLevel',pick(x,['companyName','email','phone','source','tags','dateAdded','website','address1','city']),env.OPS_GHL_PUBLIC_URL));
  }
  const bidRows = bids => bids.map(b=>row(`bid:${b.id}`,b.project_name,b.status,'Bids Tracker',pick(b,['id','company_name','units','bid_amount','projected_profit','sent_date','sent_time','sent_to','recipient_email','filename','created_at']),'/bids/tracker'));
  async function read(module,query='') {
    const output={records:[],metrics:[],warnings:[],sources:[],links:[],checkedAt:new Date().toISOString()};
    const pending=[];
    function add(name,fn) {
      pending.push((async()=>{
        try {const values=await fn();output.records.push(...values);output.sources.push({name,status:'CONNECTED',count:values.length});}
        catch(error){const message=redact(error.message);output.sources.push({name,status:'ERROR',message});output.warnings.push(`${name}: ${message}`);diagnostic({module,source:name,status:'error',message});}
      })());
    }
    const link=(label,href)=>{if(href)output.links.push({label,href});};
    if(['projects','takeoffs','pricing','proposals','autobid','jobs','activity','events'].includes(module))await add('Canonical Cabinet Brain records',()=>vision(module));
    if(['projects','proposals','revenue','dashboard','companies'].includes(module)) {
      await add('Bids Tracker',async()=>{
        const bids=await tracker();
        if(module==='revenue'||module==='dashboard') {const s=commercialSummary(bids);output.metrics.push(...Object.entries(s).map(([label,value])=>({label,value})));}
        if(module==='companies') return [...new Set(bids.map(b=>b.company_name).filter(Boolean))].map(name=>row(name,name,'Bid relationship','Bids Tracker',{bidCount:bids.filter(b=>b.company_name===name).length},'/bids/tracker'));
        return bidRows(bids);
      });
      if(module==='revenue')output.warnings.push('Bid values and projected profit are not recognized revenue. Accounting revenue is not connected. Unknown statuses are excluded from active pipeline.');
      if(module==='proposals')output.warnings.push('Historical bid references do not establish QA release approval. Open Cabinet Brain for generated export and QA state.');
      link('Open bid ledger','/bids/tracker');link('Open Cabinet Brain','/bids/vision');
    }
    if(['catalog','pricing'].includes(module)) {
      await add('Engine SKU catalog',async()=>{const d=await engine(`sku-catalog?limit=3000&query=${encodeURIComponent(query)}`);return d.skus.map(x=>row(x.id,x.sku_code,x.is_active?'Active':'Inactive','Engine sku_catalog',pick(x,['manufacturer','product_line','model','cabinet_type','width','height','depth','finish','unit_cost','lead_time_days']),'/bids/vision'));});
      output.warnings.push('Catalog unit_cost is a source catalog value. A verified project workbook snapshot is required before quoting. No selling factor, freight, tax or margin is inferred.');link('Open project pricing and QA','/bids/vision');
    }
    if(module==='autobid'||module==='takeoffs') {
      await add('Engine projects',async()=>{const d=await engine('projects?limit=100');return (d.projects||[]).map(x=>row(x.id,x.name||x.project_name,x.status,'Bid Engine',pick(x,['stage','created_at','updated_at','unit_count']),'/bids/vision'));});
      await add('Engine execution state',async()=>{const d=await engine('stats');output.metrics.push(...Object.entries(d).map(([label,value])=>({label,value})));return [];});
      link('Inspect plans, takeoffs and project execution','/bids/vision');
    }
    if(['services','health','integrations','notifications','dashboard'].includes(module)) {
      await add('Runtime probes',async()=>{const rows=await services();return module==='notifications'?rows.filter(r=>r.status!=='UP'):rows;});
    }
    if(['providers','integrations'].includes(module)) await add('Model configuration',providers);
    if(['crm','contacts','companies','opportunities','inbox'].includes(module)) {
      await add('GoHighLevel',()=>crm(module));
      if(module==='crm')await add('GoHighLevel opportunities',()=>crm('opportunities'));
      link('Open GoHighLevel',env.OPS_GHL_PUBLIC_URL);
      output.warnings.push('Provider view is limited to the first 100 records; local drafts are not automatically synchronized to GoHighLevel.');
    }
    if(['paperclip','agents','dashboard'].includes(module)) await add('Paperclip agents',agents);
    if(['paperclip','jobs','notifications','dashboard'].includes(module)) await add('Paperclip work',issues);
    if(['paperclip','notifications'].includes(module)) await add('Paperclip approvals',async()=>{const d=await paperclip('approvals');return (Array.isArray(d)?d:d.items||[]).map(x=>row(x.id,x.type,x.status,'Paperclip approvals',pick(x,['createdAt','requestedByAgentId','decisionNote']),env.OPS_PAPERCLIP_PUBLIC_URL));});
    if(['activity','events','paperclip'].includes(module)) await add('Paperclip activity',activity);
    if(['paperclip','agents','jobs','automations'].includes(module))link('Open Paperclip',env.OPS_PAPERCLIP_PUBLIC_URL);
    if(module==='automations')await add('Paperclip routines',async()=>{const d=await paperclip('routines');return (Array.isArray(d)?d:d.items||d.routines||[]).map(x=>row(x.id,x.name||x.title,x.status,'Paperclip routines',pick(x,['description','trigger','lastRunAt','nextRunAt','createdAt']),env.OPS_PAPERCLIP_PUBLIC_URL));});
    if(['hermes','fox'].includes(module)) {await add('Hermes availability',async()=>(await services()).filter(s=>s.id==='Hermes'));link('Launch Hermes',env.OPS_HERMES_PUBLIC_URL);output.warnings.push('Hermes session content requires its own authenticated runtime. The launch action preserves that access boundary.');}
    if(['vault','search','sops','intelligence','fox'].includes(module))await add('PAI knowledge',()=>vault(module,query));
    if(module==='backups') {await add('Backup artifacts',backups);output.warnings.push('These are detected local artifacts. Restore tests and offsite coverage have not been verified.');}
    if(['sms','calls','phone','recordings','valerie'].includes(module)) {
      const resource=module==='sms'?'Messages':module==='recordings'?'Recordings':module==='phone'?'IncomingPhoneNumbers':'Calls';
      await add('Twilio',async()=>{const d=await twilio(resource);const items=d.messages||d.recordings||d.incoming_phone_numbers||d.calls||[];return items.map(x=>row(x.sid,x.friendly_name||x.from||x.sid,x.status||'Configured','Twilio',pick(x,['from','to','body','date_created','date_sent','duration','direction','error_code','phone_number','capabilities','call_sid','channels']),env.OPS_VOICE_PUBLIC_URL));});
      link('Open voice console',env.OPS_VOICE_PUBLIC_URL);
      output.warnings.push('Provider history is limited to 100 records. Delivery and dialing require the existing voice console; no messages or calls are sent from this read view.');
    }
    if(module==='valerie') {
      await add('Vapi voice agents',async()=>{if(!env.VAPI_PRIVATE_API_KEY&&!env.VAPI_API_KEY)throw new Error('Vapi is not configured.');const d=await json(`${base('OPS_VAPI_URL')}/assistant`,{Authorization:`Bearer ${env.VAPI_PRIVATE_API_KEY||env.VAPI_API_KEY}`});return (Array.isArray(d)?d:[]).map(x=>row(x.id,x.name,'Configured','Vapi',pick(x,['createdAt','updatedAt','firstMessage']),env.OPS_VOICE_PUBLIC_URL));});
    }
    if(module==='leads')output.warnings.push('Agency prospects are operator-entered or imported records. Website scores require recorded evidence. Discovery and preview generation are not connected.');
    if(module==='emailblaster') {output.warnings.push('Campaigns are persisted drafts. Sending, open/click tracking and provider scheduling are not connected; no delivery counts are invented.');link('Open campaign delivery in GoHighLevel',env.OPS_GHL_PUBLIC_URL);}
    await Promise.all(pending);
    return output;
  }
  return {read};
}
