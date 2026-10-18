import pg from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {BidError,job as jobSchema} from './schemas.mjs';

export class BidStore{
 constructor(connectionString){this.pool=new pg.Pool({connectionString,max:5,connectionTimeoutMillis:5000});}
 async init(){await this.pool.query(`
  CREATE TABLE IF NOT EXISTS bid_jobs(id uuid PRIMARY KEY,org text NOT NULL,owner text NOT NULL,revision integer NOT NULL,payload jsonb NOT NULL);
  CREATE TABLE IF NOT EXISTS bid_job_revisions(job_id uuid NOT NULL,revision integer NOT NULL,org text NOT NULL,owner text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(job_id,revision));
  CREATE TABLE IF NOT EXISTS bid_audit(id uuid PRIMARY KEY,at timestamptz NOT NULL DEFAULT now(),org text NOT NULL,actor text NOT NULL,job_id uuid,action text NOT NULL,revision integer,outcome text NOT NULL);
  CREATE TABLE IF NOT EXISTS bid_exports(id text PRIMARY KEY,job_id uuid NOT NULL,org text NOT NULL,owner text NOT NULL,expires bigint NOT NULL,filename text NOT NULL,mime text NOT NULL,bytes bytea NOT NULL);
  CREATE TABLE IF NOT EXISTS bid_runs(id uuid PRIMARY KEY,job_id uuid NOT NULL,org text NOT NULL,owner text NOT NULL,status text NOT NULL,payload jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS catalog_snapshots(hash text PRIMARY KEY,supplier text NOT NULL,source jsonb NOT NULL,catalog jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS knowledge_documents(path text PRIMARY KEY,hash text NOT NULL,body text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX IF NOT EXISTS bid_jobs_owner ON bid_jobs(org,owner);
  CREATE INDEX IF NOT EXISTS bid_runs_status ON bid_runs(status,updated_at);`);}
 async audit(actor,action,jobId=null,revision=null,outcome='ok',db=this.pool){
  await db.query('INSERT INTO bid_audit(id,org,actor,job_id,action,revision,outcome) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),actor.org,actor.sub,jobId,action,revision,outcome]);
 }
 async get(actor,id,db=this.pool,lock=false){
  const {rows}=await db.query('SELECT payload FROM bid_jobs WHERE id=$1 AND org=$2 AND owner=$3'+(lock?' FOR UPDATE':''),[id,actor.org,actor.sub]);
  if(!rows[0])throw new BidError('NOT_FOUND','Bid not found or access denied.');return rows[0].payload;
 }
 async list(actor){return(await this.pool.query("SELECT payload FROM bid_jobs WHERE org=$1 AND owner=$2 ORDER BY (payload->>'updated_at') DESC LIMIT 100",[actor.org,actor.sub])).rows.map(r=>r.payload);}
 async transaction(fn){const db=await this.pool.connect();try{await db.query('BEGIN');const value=await fn(db);await db.query('COMMIT');return value;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 async create(actor,value){
  const parsed=jobSchema.parse(value);
  return this.transaction(async db=>{await db.query('INSERT INTO bid_jobs VALUES($1,$2,$3,$4,$5)',[parsed.id,actor.org,actor.sub,parsed.revision,parsed]);await db.query('INSERT INTO bid_job_revisions(job_id,revision,org,owner,payload) VALUES($1,$2,$3,$4,$5)',[parsed.id,parsed.revision,actor.org,actor.sub,parsed]);await this.audit(actor,'create_bid_job',parsed.id,parsed.revision,'ok',db);return parsed;});
 }
 async mutate(actor,id,revision,action,fn){
  return this.transaction(async db=>{
   const value=await this.get(actor,id,db,true);if(value.revision!==revision)throw new BidError('REVISION_CONFLICT','Bid changed. Reload it before applying changes.');
   await db.query('INSERT INTO bid_job_revisions(job_id,revision,org,owner,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[id,value.revision,actor.org,actor.sub,value]);
   await fn(value);value.revision++;value.updated_at=new Date().toISOString();const parsed=jobSchema.parse(value);
   await db.query('UPDATE bid_jobs SET revision=$1,payload=$2 WHERE id=$3 AND org=$4 AND owner=$5',[parsed.revision,parsed,id,actor.org,actor.sub]);
   await db.query('INSERT INTO bid_job_revisions(job_id,revision,org,owner,payload) VALUES($1,$2,$3,$4,$5)',[id,parsed.revision,actor.org,actor.sub,parsed]);
   await this.audit(actor,action,id,parsed.revision,'ok',db);return parsed;
  });
 }
 async delete(actor,id,revision){
  return this.transaction(async db=>{
   const j=await this.get(actor,id,db,true);
   if(j.revision!==revision)throw new BidError('REVISION_CONFLICT','Bid changed. Reload before deleting.');
   if((await db.query("SELECT id FROM bid_runs WHERE job_id=$1 AND org=$2 AND owner=$3 AND status IN ('queued','running')",[id,actor.org,actor.sub])).rowCount)throw new BidError('RUN_ACTIVE','Wait for the active bid run to finish before deleting.');
   await this.audit(actor,'delete_bid',id,revision,'ok',db);
   for(const table of ['bid_exports','bid_runs','bid_job_revisions'])await db.query('DELETE FROM '+table+' WHERE job_id=$1 AND org=$2 AND owner=$3',[id,actor.org,actor.sub]);
   await db.query('DELETE FROM bid_jobs WHERE id=$1 AND org=$2 AND owner=$3',[id,actor.org,actor.sub]);
   return{job_id:id,deleted:true};
  });
 }
 async putExport(actor,j,record){await this.pool.query('INSERT INTO bid_exports VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[record.id,j.id,actor.org,actor.sub,record.expires,record.filename,record.mime,record.bytes]);}
 async getExport(id){return(await this.pool.query('SELECT filename,mime,bytes FROM bid_exports e WHERE id=$1 AND expires>$2 AND (EXISTS (SELECT 1 FROM bid_jobs j WHERE j.id=e.job_id AND j.org=e.org AND j.owner=e.owner) OR EXISTS (SELECT 1 FROM pricing_quotes q WHERE q.id=e.job_id AND q.org=e.org))',[id,Date.now()])).rows[0];}
 async saveRun(actor,jobId,instruction,revision){
  return this.transaction(async db=>{
   const j=await this.get(actor,jobId,db,true);
   if(j.revision!==revision)throw new BidError('REVISION_CONFLICT','Bid changed. Reload before continuing.');
   if((await db.query("SELECT id FROM bid_runs WHERE job_id=$1 AND status IN ('queued','running')",[jobId])).rowCount)throw new BidError('RUN_ACTIVE','This bid already has an active run.');
   if(!j.sources.some(s=>s.kind==='instruction'&&s.text===instruction)){
    await db.query('INSERT INTO bid_job_revisions(job_id,revision,org,owner,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[jobId,j.revision,actor.org,actor.sub,j]);
    j.sources.push({id:randomUUID(),kind:'instruction',name:'User instructions',sha256:createHash('sha256').update(instruction).digest('hex'),text:instruction});j.revision++;j.saved=false;j.updated_at=new Date().toISOString();
    await db.query('UPDATE bid_jobs SET revision=$1,payload=$2 WHERE id=$3',[j.revision,jobSchema.parse(j),jobId]);
    await db.query('INSERT INTO bid_job_revisions(job_id,revision,org,owner,payload) VALUES($1,$2,$3,$4,$5)',[jobId,j.revision,actor.org,actor.sub,j]);
   }
   const id=randomUUID();await db.query('INSERT INTO bid_runs(id,job_id,org,owner,status,payload) VALUES($1,$2,$3,$4,$5,$6)',[id,jobId,actor.org,actor.sub,'queued',{instruction,events:[]}]);await this.audit(actor,'start_agent',jobId,j.revision,'ok',db);return{id,status:'queued'};
  });
 }
 async getRun(actor,id){const row=(await this.pool.query('SELECT id,job_id,status,payload,updated_at FROM bid_runs WHERE id=$1 AND org=$2 AND owner=$3',[id,actor.org,actor.sub])).rows[0];if(!row)throw new BidError('NOT_FOUND','Run not found.');return row;}
 async claimRun(){return this.transaction(async db=>{const row=(await db.query("SELECT * FROM bid_runs WHERE status='queued' ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];if(!row)return null;await db.query("UPDATE bid_runs SET status='running',updated_at=now() WHERE id=$1",[row.id]);return row;});}
 async updateRun(id,status,payload){await this.pool.query('UPDATE bid_runs SET status=$1,payload=$2,updated_at=now() WHERE id=$3',[status,payload,id]);}
 async close(){await this.pool.end();}
}
