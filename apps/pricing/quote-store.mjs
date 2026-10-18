import {calculateProject} from './src/pricing.mjs';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
export const projectKey = name => String(name||'Untitled project').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US')||'untitled project';
export class QuoteStore {
 constructor(connectionString){this.pool=new pg.Pool({connectionString,max:4,connectionTimeoutMillis:5000});}
 async init(){await this.pool.query(await fs.readFile(new URL('./deploy/quote-history.sql',import.meta.url),'utf8'));}
 async list(actor){return (await this.pool.query(`SELECT id,project_name,project_key,quote_number,revision,created_by,updated_by,updated_at,state->>'supplier' AS supplier FROM pricing_quotes WHERE org=$1 AND project_key IN (SELECT project_key FROM pricing_projects WHERE org=$1 AND deleted_at IS NULL) ORDER BY updated_at DESC`,[actor.org])).rows;}
 async get(actor,id,db=this.pool){const q=(await db.query('SELECT q.*,p.deleted_at FROM pricing_quotes q JOIN pricing_projects p ON p.org=q.org AND p.project_key=q.project_key WHERE q.id=$1 AND q.org=$2',[id,actor.org])).rows[0];if(!q)throw Object.assign(Error('Quote not found.'),{status:404});return q;}
 async save(actor,state,reference){
  const db=await this.pool.connect();
  try{
   await db.query('BEGIN');
   const clean=structuredClone(state);delete clean._history;
   if(clean.pricingPolicy===2){const catalog=JSON.parse(await fs.readFile(new URL(clean.supplier&&clean.supplier!=='hci'?'./src/suppliers/'+clean.supplier+'.json':'./src/catalog.json',import.meta.url),'utf8'));const result=calculateProject(catalog,clean);clean._calculation={purchase:result.purchase,sale:result.sale,total:result.total,tax:result.tax,charges:result.charges};}
   if(reference?.id){const original=await this.get(actor,reference.id,db);if(original.state.issuedAt||original.state.status==='Issued')throw Object.assign(Error('Issued quotes are immutable. Create a revised draft.'),{status:409});}
   const id=reference?.id||randomUUID(),name=String(clean.project||'').trim().replace(/\s+/g,' ')||'Untitled project';
   await db.query('INSERT INTO pricing_projects(org,project_key,name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[actor.org,projectKey(name),name]);
   const project=(await db.query('SELECT deleted_at FROM pricing_projects WHERE org=$1 AND project_key=$2 FOR SHARE',[actor.org,projectKey(name)])).rows[0];
   if(project.deleted_at)throw Object.assign(Error('This project is in Trash. Restore it before editing.'),{status:409});
   let revision=1;
   if(reference?.id){
    const row=(await db.query('SELECT revision,state FROM pricing_quotes WHERE id=$1 AND org=$2 FOR UPDATE',[id,actor.org])).rows[0];
    if(!row)throw Object.assign(Error('Quote not found.'),{status:404});
    if(row.revision!==reference.revision)throw Object.assign(Error('This quote was changed on another device or by a teammate. Reopen it before editing.'),{status:409});
    revision=row.revision+1;
    await db.query('UPDATE pricing_quotes SET project_name=$1,project_key=$2,quote_number=$3,state=$4,revision=$5,updated_by=$6,updated_at=now() WHERE id=$7 AND org=$8',[name,projectKey(name),clean.quoteId||'',clean,revision,actor.sub,id,actor.org]);
   }else await db.query('INSERT INTO pricing_quotes(id,org,project_name,project_key,quote_number,state,revision,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,1,$7,$7)',[id,actor.org,name,projectKey(name),clean.quoteId||'',clean,actor.sub]);
   await db.query('INSERT INTO pricing_quote_revisions(quote_id,revision,org,state,actor) VALUES($1,$2,$3,$4,$5)',[id,revision,actor.org,clean,actor.sub]);
   await db.query('COMMIT');return {id,revision};
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async addExport(actor,reference,type,format,bytes){const id=randomUUID();await this.get(actor,reference.id);await this.pool.query('INSERT INTO pricing_quote_exports(id,quote_id,revision,org,type,format,bytes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,reference.id,reference.revision,actor.org,type,format,bytes,actor.sub]);return id;}
 async exports(actor,id){await this.get(actor,id);return(await this.pool.query('SELECT id,type,format,revision,created_at FROM pricing_quote_exports WHERE quote_id=$1 AND org=$2 ORDER BY created_at DESC',[id,actor.org])).rows;}
 async download(actor,id){return(await this.pool.query('SELECT bytes,format,type FROM pricing_quote_exports WHERE id=$1 AND org=$2',[id,actor.org])).rows[0];}
 async projects(actor){return(await this.pool.query('SELECT project_key,name,deleted_at FROM pricing_projects WHERE org=$1 ORDER BY name',[actor.org])).rows;}
 async project(actor,name,action){
  name=String(name||'').trim().replace(/\s+/g,' ');if(!name||name.length>120)throw Error('Enter a project name up to 120 characters.');
  const key=projectKey(name);
  if(action==='create')await this.pool.query('INSERT INTO pricing_projects(org,project_key,name) VALUES($1,$2,$3) ON CONFLICT(org,project_key) DO UPDATE SET deleted_at=NULL',[actor.org,key,name]);
  else if(['delete','restore'].includes(action))await this.pool.query('UPDATE pricing_projects SET deleted_at='+ (action==='delete'?'now()':'NULL') +' WHERE org=$1 AND project_key=$2',[actor.org,key]);
  else throw Error('Unknown project action.');
  return {name,key};
 }
 async delete(actor,id,expectedRevision){
  const db=await this.pool.connect();
  try{
   await db.query('BEGIN');
   const row=(await db.query('SELECT revision FROM pricing_quotes WHERE id=$1 AND org=$2 FOR UPDATE',[id,actor.org])).rows[0];
   if(!row)throw Object.assign(Error('Quote not found.'),{status:404});
   if(row.revision!==expectedRevision)throw Object.assign(Error('Quote changed. Reload before deleting.'),{status:409});
   await db.query('INSERT INTO pricing_quote_deletions(quote_id,org,actor,revision) VALUES($1,$2,$3,$4)',[id,actor.org,actor.sub,row.revision]);
   for(const table of ['pricing_quote_exports','pricing_quote_revisions'])await db.query('DELETE FROM '+table+' WHERE quote_id=$1 AND org=$2',[id,actor.org]);
   await db.query('DELETE FROM pricing_quotes WHERE id=$1 AND org=$2',[id,actor.org]);
   await db.query('COMMIT');return{quote_id:id,deleted:true};
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async close(){await this.pool.end();}
}
