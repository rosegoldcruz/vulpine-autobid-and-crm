import {QuoteStore} from '../quote-store.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {NodeStreamableHTTPServerTransport} from '@modelcontextprotocol/node';
import {z} from 'zod';




import {verify} from '../server.mjs';
import {BidStore} from './store.mjs';
import {prepareSource} from './sources.mjs';
import {createBidTools} from './tools.mjs';
import {startWorker} from './worker.mjs';
import {introspectScopes,pricingPermissions} from './oauth.mjs';
import {id,state as stateSchema,BidError} from './schemas.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const uuid=s=>id.parse(s);
export async function createBiddingServer(env,{worker=true}={}){
 const root=new URL('../',import.meta.url),catalogs={};
 for(const supplier of ['hci','rythern','uscd'])catalogs[supplier]=JSON.parse(await fs.readFile(new URL(supplier==='hci'?'src/catalog.json':'src/suppliers/'+supplier+'.json',root)));
 const store=new BidStore(env.BIDDING_DATABASE_URL);await store.init();
 const workspace=new QuoteStore(env.QUOTES_DATABASE_URL||env.BIDDING_DATABASE_URL);await workspace.init();
 const bidding=createBidTools({workspace,store,catalogs,env,template:await fs.readFile(new URL('assets/proposal-template.pdf',root)),publicUrl:env.BIDDING_PUBLIC_URL});
 for(const [supplier,catalog]of Object.entries(catalogs))await store.pool.query('INSERT INTO catalog_snapshots(hash,supplier,source,catalog) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[bidding.hashes[supplier],supplier,catalog.source||{},catalog]);
 const issuer=env.ZITADEL_ISSUER?.replace(/\/$/,''),resource=new URL('mcp',env.BIDDING_PUBLIC_URL).href;
 const jwks=issuer?createRemoteJWKSet(new URL(issuer+'/oauth/v2/keys')):null;
 const oauthConfigured=!!(jwks&&env.ZITADEL_MCP_AUDIENCE&&env.ZITADEL_MCP_CLIENT_IDS&&env.ZITADEL_INTROSPECTION_CLIENT_ID&&env.ZITADEL_INTROSPECTION_CLIENT_SECRET);
 const metadata={resource,authorization_servers:issuer?[issuer]:[],scopes_supported:['openid',...(env.ZITADEL_MCP_AUDIENCE?['urn:zitadel:iam:org:project:id:'+env.ZITADEL_MCP_AUDIENCE+':aud']:[]),'urn:zitadel:iam:org:projects:roles'],bearer_methods_supported:['header'],resource_name:'Vulpine Bidding'};
 const json=(res,status,value,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(JSON.stringify(value));};
 const authenticate=async req=>{
  if(!oauthConfigured)throw new BidError('OAUTH_NOT_CONFIGURED','Remote OAuth client registration is not configured.');
  const token=/^Bearer (\S+)$/.exec(req.headers.authorization||'')?.[1];if(!token)throw new BidError('UNAUTHENTICATED','Zitadel access token required.');
  let p;try{p=(await jwtVerify(token,jwks,{issuer,audience:env.ZITADEL_MCP_AUDIENCE,requiredClaims:['exp','sub']})).payload;}catch{throw new BidError('UNAUTHENTICATED','Invalid access token.');}
  if(!env.ZITADEL_MCP_CLIENT_IDS.split(',').includes(p.client_id||p.azp))throw new BidError('FORBIDDEN','OAuth client is not authorized.');
  const roles=p['urn:zitadel:iam:org:project:roles']||{},org=env.OPS_ORGANIZATION_ID;
  const ownRoles=Object.keys(roles).filter(r=>roles[r]&&Object.hasOwn(roles[r],org));
  if(!ownRoles.length)throw new BidError('FORBIDDEN','Organization membership required.');
  const requested=await introspectScopes(env,token,p),scopes=pricingPermissions(env,ownRoles,requested);
  if(!scopes.length)throw new BidError('FORBIDDEN','Bid permission required.');
  return{sub:p.sub,org,scopes};
 };
 const server=http.createServer(async(req,res)=>{
  try{
   const route=new URL(req.url,'http://localhost').pathname;
   if(route==='/health')return json(res,200,{status:'ok',service:'vulpine-bidding',remoteOAuthConfigured:oauthConfigured});
   if(route==='/.well-known/oauth-protected-resource')return json(res,200,metadata);
   if(route.startsWith('/downloads/')&&req.method==='GET'){
    const token=route.slice('/downloads/'.length);if(!/^[a-f0-9-]{72}$/.test(token))throw new BidError('NOT_FOUND','Download expired or not found.');
    const record=await store.getExport(hash(token));if(!record)throw new BidError('NOT_FOUND','Download expired or not found.');
    res.writeHead(200,{'content-type':record.mime,'content-disposition':'attachment; filename="'+record.filename.replace(/[^a-zA-Z0-9_.-]/g,'_')+'"','cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'});res.end(record.bytes);return;
   }
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>3145728)return json(res,413,{error:'Request too large.'});}
   if(route==='/mcp'){
    const origin=req.headers.origin;if(origin&&!String(env.MCP_ALLOWED_ORIGINS||'').split(',').includes(origin))throw new BidError('FORBIDDEN','Origin is not allowed.');
    let actor;try{actor=await authenticate(req);}catch(e){console.warn('MCP authorization rejected:',e.code,e.message);throw e;}
    const mcp=bidding.server(actor),transport=new NodeStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on('close',()=>{transport.close();mcp.close();});await mcp.connect(transport);await transport.handleRequest(req,res,body?JSON.parse(body):undefined);return;
   }
   if(!route.startsWith('/agent/'))throw new BidError('NOT_FOUND','Not found.');
   const claim=verify(req.headers['x-vulpine-operations'],env.OPS_SIGNING_SECRET,{org:env.OPS_ORGANIZATION_ID,path:route.slice(1),method:req.method,bodyHash:hash(body)});
   if(!claim)throw new BidError('UNAUTHENTICATED','Verified back office session required.');
   const actor={sub:claim.sub,org:claim.org,scopes:req.method==='GET'?['bids.read']:['bids.read','bids.write']};
   const a=body?JSON.parse(body):{};
   if(route==='/agent/mcp'){
    const mcp=bidding.server(actor),transport=new NodeStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on('close',()=>{transport.close();mcp.close();});await mcp.connect(transport);await transport.handleRequest(req,res,body?JSON.parse(body):undefined);return;
   }
   if(route==='/agent/jobs'&&req.method==='GET')return json(res,200,{jobs:(await store.list(actor)).map(j=>({id:j.id,project:j.state.project,supplier:j.state.supplier,revision:j.revision,saved:j.saved,updated_at:j.updated_at}))});
   if(route==='/agent/tools'&&req.method==='POST'){
    const input=z.strictObject({name:z.string(),arguments:z.record(z.string(),z.unknown())}).parse(a);
    return json(res,200,await bidding.execute(input.name,input.arguments,actor));
   }
   if(route==='/agent/runs'&&req.method==='POST'){
    const input=z.strictObject({job_id:id,expected_revision:z.number().int().positive(),instruction:z.string().min(1).max(300000)}).parse(a);
    const j=await store.get(actor,input.job_id);if(j.revision!==input.expected_revision)throw new BidError('REVISION_CONFLICT','Bid changed. Reload before continuing.');
    return json(res,202,await store.saveRun(actor,j.id,input.instruction,input.expected_revision));
   }
   if(/^\/agent\/runs\/[^/]+$/.test(route)&&req.method==='GET')return json(res,200,await store.getRun(actor,uuid(route.split('/').at(-1))));
   if(/^\/agent\/jobs\/[^/]+$/.test(route)&&req.method==='GET')return json(res,200,await store.get(actor,uuid(route.split('/').at(-1))));
   if(/^\/agent\/jobs\/[^/]+$/.test(route)&&req.method==='PUT'){
    const input=z.strictObject({expected_revision:z.number().int().positive(),state:stateSchema,reviewed:z.boolean().default(false)}).parse(a),jobId=uuid(route.split('/').at(-1));
    return json(res,200,await store.mutate(actor,jobId,input.expected_revision,'human_update',j=>{
     if(input.state.supplier!==j.state.supplier)throw new BidError('INVALID_SUPPLIER','Create a separate supplier bid.');
     j.state=input.state;j.saved=true;if(input.reviewed)j.exceptions=[];
    }));
   }
   if(/^\/agent\/sources\/[^/]+$/.test(route)&&req.method==='POST'){
    const input=z.strictObject({expected_revision:z.number().int().positive(),name:z.string().min(1).max(200),text:z.string().min(1).max(300000).optional(),pdf_base64:z.string().max(2800000).optional()}).refine(v=>Boolean(v.text)!==Boolean(v.pdf_base64)).parse(a);
    const jobId=uuid(route.split('/').at(-1));await store.get(actor,jobId);
    const source=await prepareSource(input);
    return json(res,200,await store.mutate(actor,jobId,input.expected_revision,'upload_source',j=>{if(j.sources.length>=20)throw new BidError('SOURCE_LIMIT','This bid already has 20 sources.');j.sources.push(source);j.saved=false;}));
   }
   throw new BidError('NOT_FOUND','Not found.');
  }catch(e){const code=e instanceof BidError?e.code:e.name==='ZodError'?'INVALID_INPUT':'INTERNAL_ERROR';const status={UNAUTHENTICATED:401,FORBIDDEN:403,NOT_FOUND:404,REVISION_CONFLICT:409,OAUTH_NOT_CONFIGURED:503,INVALID_INPUT:400}[code]||400;json(res,status,{error:{code,message:e instanceof BidError?e.message:code==='INVALID_INPUT'?'Invalid request.':'Request could not be completed.'}},status===401?{'www-authenticate':'Bearer resource_metadata="'+new URL('.well-known/oauth-protected-resource',env.BIDDING_PUBLIC_URL).href+'"'}:{});}
 });
 const stopWorker=worker?await startWorker({store,bidding,catalogs,env}):()=>{};
 return{server,store,bidding,catalogs,close:async()=>{stopWorker();await new Promise(r=>server.close(r));await store.close();await workspace.close();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const app=await createBiddingServer(process.env);app.server.listen(Number(process.env.BIDDING_PORT||3022),'127.0.0.1');
}
