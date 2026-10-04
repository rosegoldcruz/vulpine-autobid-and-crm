import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import type { BrowserContext } from '@playwright/test'
const require=createRequire(resolve('apps/backoffice/package.json'))
const {encode}=require('next-auth/jwt') as {encode:(args:Record<string,unknown>)=>Promise<string>}
export async function localAuth(context:BrowserContext,roles=['admin']) {
  if(!process.env.OPERATIONS_AUTH_QA)return
  const base=process.env.PLAYWRIGHT_BASE_URL||''
  if(new URL(base).hostname!=='127.0.0.1')throw new Error('Test sessions are restricted to local QA.')
  const token=await encode({secret:'isolated-operations-e2e-secret-not-production',token:{sub:'isolated-qa-user',name:'Local QA',email:'qa@example.invalid',roles,organizationId:'384685301395732101'},maxAge:3600})
  await context.addCookies([{name:'next-auth.session-token',value:token,url:base,httpOnly:true,sameSite:'Lax'}])
}
