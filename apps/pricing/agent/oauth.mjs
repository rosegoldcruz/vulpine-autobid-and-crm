import {BidError} from './schemas.mjs';

// Zitadel JWT access tokens omit scopes. Introspection supplies the actual
// granted scopes and rejects revoked tokens, without trusting client input.
export async function introspectScopes(env,token,claims,request=fetch){
 const clientId=env.ZITADEL_INTROSPECTION_CLIENT_ID,secret=env.ZITADEL_INTROSPECTION_CLIENT_SECRET;
 if(!clientId||!secret)throw new BidError('OAUTH_NOT_CONFIGURED','Token verification is not configured.');
 const encode=value=>new URLSearchParams({v:value}).toString().slice(2);
 let response,data;
 try{
  response=await request(env.ZITADEL_ISSUER.replace(/\/$/,'')+'/oauth/v2/introspect',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
   headers:{'content-type':'application/x-www-form-urlencoded',authorization:'Basic '+Buffer.from(encode(clientId)+':'+encode(secret)).toString('base64')},
   body:new URLSearchParams({token,token_type_hint:'access_token'})
  });
  if(!response.ok)throw new Error('Introspection unavailable');
  data=await response.json();
 }catch{throw new BidError('UNAUTHENTICATED','Access token verification failed.');}
 if(data.active!==true||data.sub!==claims.sub||data.client_id!==(claims.client_id||claims.azp))throw new BidError('UNAUTHENTICATED','Inactive or mismatched access token.');
 return new Set(typeof data.scope==='string'?data.scope.split(/\s+/):[]);
}

export function pricingPermissions(env,roles,granted){
 // Zitadel drops unrecognized custom scopes such as bids.read. Require its
 // actual resource-audience and role scopes, then apply the pricing RBAC map.
 if(!granted.has('urn:zitadel:iam:org:project:id:'+env.ZITADEL_MCP_AUDIENCE+':aud')||!granted.has('urn:zitadel:iam:org:projects:roles'))return [];
 const scopes=[];
 if(roles.some(r=>['admin','estimator','operations','nbc','executive','finance','sales'].includes(r)))scopes.push('bids.read');
 if(roles.some(r=>['admin','estimator','operations','nbc'].includes(r)))scopes.push('bids.write');
 return scopes;
}
