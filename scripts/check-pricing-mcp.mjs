#!/usr/bin/env node
// Read-only discovery using existing private agent credentials. Never prints them.
import fs from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {inputs} from '../apps/pricing/agent/schemas.mjs';

const clients=process.argv.slice(2);
if(!clients.length)clients.push('codex');
for(const client of clients){
 assert.match(client,/^[a-z][a-z0-9-]{0,50}$/,'Expected a registered client name.');
 const {endpoint,token}=JSON.parse(await fs.readFile(join(homedir(),'.config/vulpine-mcp/clients',client+'.json'),'utf8'));
 assert.equal(endpoint,'https://backoffice.vulpine.llc/api/mcp','Unexpected credential destination.');
 assert.equal(typeof token,'string','Missing private credential.');
 let id=0;
 const rpc=async(method,params)=>{
  const response=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+token,accept:'application/json, text/event-stream','content-type':'application/json','mcp-protocol-version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),redirect:'error',signal:AbortSignal.timeout(45000)});
  assert.equal(response.ok,true,client+': HTTP '+response.status);
  const result=await response.json();
  assert.ok(!result.error,client+': MCP discovery failed.');
  return result.result;
 };
 const init=await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'vulpine-pricing-discovery-check',version:'1'}});
 const {tools}=await rpc('tools/list',{});
 const expected=Object.keys(inputs).sort(),names=tools.map(t=>t.name).sort();
 assert.deepEqual(names.filter(n=>expected.includes(n)),expected,client+': pricing inventory differs from source.');
 const fields=tools.find(t=>t.name==='set_bid_details').inputSchema.properties;
 for(const field of ['customer','email','preparedBy','notes','projectInfo','customerSections'])assert.ok(fields[field],client+': missing '+field);
 console.log(JSON.stringify({client,server:init.serverInfo,pricingTools:expected.length,totalTools:names.length,tools:names}));
}
