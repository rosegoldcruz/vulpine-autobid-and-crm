import { createHmac, createHash } from "node:crypto"
import { normalizeCorrelationId } from "@vulpine/contracts"
import { capabilitiesForRoles, hasCapability, roles } from "@vulpine/permissions"
import { requireCapability } from "@/lib/require-capability"
import { apiError } from "@/lib/api-response"
import { platformModules } from "@/lib/platform-modules"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const writeCapabilities={projects:"bids.write",leads:"crm.write",contacts:"crm.write",companies:"crm.write",opportunities:"crm.write",emailblaster:"crm.write",sops:"drive.write",intelligence:"drive.write",fox:"backoffice.access"} as const
async function proxy(request:Request,context:{params:Promise<{module:string}>}) {
  const {module}=await context.params, correlationId=normalizeCorrelationId(request.headers.get("x-correlation-id"))
  const entry=platformModules.find(m=>m.id===module)
  if(!entry)return apiError("NOT_FOUND","Unknown workspace.",correlationId,404)
  const write=request.method!=="GET"
  const writeCap=writeCapabilities[module as keyof typeof writeCapabilities]
  if(write&&!writeCap)return apiError("FORBIDDEN","This source is read-only.",correlationId,403)
  const auth=await requireCapability(write?writeCap:entry.capability,correlationId)
  if("response" in auth)return auth.response
  // Next's internal request URL may use localhost behind a reverse proxy.
  // Trust the configured public auth origin, never an arbitrary forwarded host.
  const publicOrigin=new URL(process.env.NEXTAUTH_URL||request.url).origin
  if(write&&request.headers.get("origin")!==publicOrigin)return apiError("FORBIDDEN","Same-origin requests are required.",correlationId,403)
  const user=auth.session.user
  if(!write&&["users","permissions","settings"].includes(module))return Response.json({records:module==="permissions"?roles.map(role=>({id:role,title:role,status:user.roles.includes(role)?"Assigned to you":"Defined",source:"packages/permissions",details:{capabilities:capabilitiesForRoles([role])}})):[{id:user.id,title:user.name||user.email||user.id,status:"Authenticated",source:"ZITADEL session",details:{id:user.id,name:user.name,email:user.email,organizationId:user.organizationId,roles:user.roles,capabilities:capabilitiesForRoles(user.roles)}}],metrics:[],sources:[{name:"Verified session",status:"CONNECTED"}],warnings:module==="users"?["Only the current verified identity is shown. ZITADEL directory enumeration is not configured."]:[],links:[],checkedAt:new Date().toISOString()},{headers:{"cache-control":"no-store"}})
  const base=process.env.OPERATIONS_API_URL,secret=process.env.OPERATIONS_API_SECRET
  if(!base||!secret)return apiError("UPSTREAM_NOT_CONFIGURED","Operations connection is not configured.",correlationId,503)
  if(!user.id||!user.organizationId)return apiError("FORBIDDEN","Verified user and organization are required.",correlationId,403)
  const body=write?await request.text():""
  if(Buffer.byteLength(body)>1024*1024)return apiError("FORBIDDEN","Request too large.",correlationId,413)
  const claims={sub:user.id,org:user.organizationId,module,method:request.method,exp:Math.floor(Date.now()/1000)+60,bodyHash:createHash("sha256").update(body).digest("hex")}
  const payload=Buffer.from(JSON.stringify(claims)).toString("base64url")
  const token=`${payload}.${createHmac("sha256",secret).update(payload).digest("base64url")}`
  try {
    const url=new URL(`${base.replace(/\/$/,"")}/modules/${module}`)
    const q=new URL(request.url).searchParams.get("q");if(q)url.searchParams.set("q",q.slice(0,200))
    const r=await fetch(url,{method:request.method,headers:{"content-type":"application/json","x-vulpine-operations":token},body:write?body:undefined,cache:"no-store",signal:AbortSignal.timeout(55000)})
    const data=await r.json()
    if(!write&&r.ok)data.canWrite=Boolean(writeCap&&hasCapability(user.roles,writeCap))
    return Response.json(data,{status:r.status,headers:{"cache-control":"no-store","x-correlation-id":correlationId}})
  }catch{return apiError("UPSTREAM_UNAVAILABLE","Operations service could not be reached. Retry or inspect Services.",correlationId,502)}
}
export const GET=proxy
export const POST=proxy
export const PATCH=proxy
export const DELETE=proxy
