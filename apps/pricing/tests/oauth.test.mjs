import test from 'node:test';
import assert from 'node:assert/strict';
import {introspectScopes,pricingPermissions} from '../agent/oauth.mjs';

const env={ZITADEL_ISSUER:'https://issuer.example',ZITADEL_INTROSPECTION_CLIENT_ID:'verifier',ZITADEL_INTROSPECTION_CLIENT_SECRET:'test-only'};
const claims={sub:'user',azp:'approved-client',scope:'bids.write'};
const active={active:true,sub:'user',client_id:'approved-client',scope:'openid bids.read'};
const reply=data=>async()=>({ok:true,json:async()=>data});
test('pricing permissions require both supported resource scopes and a pricing role',()=>{
 const config={ZITADEL_MCP_AUDIENCE:'pricing-project'};
 const grants=['urn:zitadel:iam:org:project:id:pricing-project:aud','urn:zitadel:iam:org:projects:roles'];
 assert.deepEqual(pricingPermissions(config,['admin'],new Set(grants)),['bids.read','bids.write']);
 for(const role of ['sales','executive','finance'])assert.deepEqual(pricingPermissions(config,[role],new Set(grants)),['bids.read']);
 assert.deepEqual(pricingPermissions(config,['unrelated'],new Set(grants)),[]);
 for(const granted of [[],[grants[0]],[grants[1]],['bids.read','bids.write']])assert.deepEqual(pricingPermissions(config,['admin'],new Set(granted)),[]);
});
test('uses granted introspection scopes rather than JWT or requested scopes',async()=>{
 const scopes=await introspectScopes(env,'access-token',claims,async(url,options)=>{
  assert.equal(url,'https://issuer.example/oauth/v2/introspect');
  assert.equal(options.redirect,'error');assert.equal(options.method,'POST');
  assert.equal(options.body.get('token'),'access-token');
  assert.equal(options.headers.authorization,'Basic '+Buffer.from('verifier:test-only').toString('base64'));
  return {ok:true,json:async()=>active};
 });
 assert.deepEqual([...scopes],['openid','bids.read']);
 assert.equal(scopes.has('bids.write'),false);
});
test('rejects revoked, mismatched, failed and unconfigured verification',async()=>{
 for(const data of [{...active,active:false},{...active,sub:'another-user'},{...active,client_id:'other-client'}]){
  await assert.rejects(introspectScopes(env,'token',claims,reply(data)),{code:'UNAUTHENTICATED'});
 }
 await assert.rejects(introspectScopes(env,'token',claims,async()=>({ok:false})),{code:'UNAUTHENTICATED'});
 await assert.rejects(introspectScopes(env,'token',claims,async()=>{throw new Error('network');}),{code:'UNAUTHENTICATED'});
 await assert.rejects(introspectScopes({},'token',claims,reply(active)),{code:'OAUTH_NOT_CONFIGURED'});
 assert.equal((await introspectScopes(env,'token',claims,reply({...active,scope:undefined}))).size,0);
});
