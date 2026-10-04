// Isolated local QA. Never signs sessions or writes records against production.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { createOperationsServer } from '../../services/operations/src/server.mjs';

const store=await mkdtemp(join(tmpdir(),'vulpine-operations-e2e-'));
const sources=process.env.OPERATIONS_TEST_SOURCE_ENV?parseEnv(await readFile(process.env.OPERATIONS_TEST_SOURCE_ENV,'utf8')):{};
const secret=randomBytes(48).toString('hex');
const server=createOperationsServer({...sources,OPS_SIGNING_SECRET:secret,OPS_ORGANIZATION_ID:'384685301395732101',OPS_STORAGE_PATH:store});
await new Promise(resolve=>server.listen(3021,'127.0.0.1',resolve));
const child=spawn('corepack',['pnpm','--filter','@vulpine/backoffice','exec','next','dev','--hostname','127.0.0.1','--port','3199'],{stdio:'inherit',env:{...process.env,NEXTAUTH_URL:'http://127.0.0.1:3199',NEXTAUTH_SECRET:'isolated-operations-e2e-secret-not-production',ZITADEL_ISSUER:'https://identity.invalid',ZITADEL_CLIENT_ID:'isolated-test',ZITADEL_AUDIENCE:'isolated-test',ZITADEL_CLIENT_SECRET:'',OPERATIONS_API_URL:'http://127.0.0.1:3021',OPERATIONS_API_SECRET:secret,BIDS_TRACKER_API_URL:'',VISION_API_URL:'',DRIVE_API_URL:''}});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;child.kill('SIGTERM');server.close();await rm(store,{recursive:true,force:true});}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());child.on('exit',()=>{void stop();});
