import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Deliberate allowlist: personal vault pages are never imported into bid access.
const page='/opt/pai-obsidian/obsidian-vault/projects/Vulpine Pricing and Agent Access.md';
export async function syncPricingMemory(store){
 let body;try{body=await fs.readFile(page,'utf8');}catch(e){if(e.code==='ENOENT')return;throw e;}
 const hash=createHash('sha256').update(body).digest('hex');
 await store.pool.query('INSERT INTO knowledge_documents(path,hash,body) VALUES($1,$2,$3) ON CONFLICT(path) DO UPDATE SET hash=EXCLUDED.hash,body=EXCLUDED.body,updated_at=now() WHERE knowledge_documents.hash<>EXCLUDED.hash',[page,hash,body]);
}
export async function readPricingMemory(store){return(await store.pool.query('SELECT body,hash,updated_at FROM knowledge_documents WHERE path=$1',[page])).rows[0]||null;}
