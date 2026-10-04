import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

export function signClaim(claim, secret) {
  const payload = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function verifyClaim(token, secret, expected) {
  if (!secret || secret.length < 32 || typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const actual = Buffer.from(signature, 'base64url');
  const wanted = createHmac('sha256', secret).update(payload).digest();
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!c.sub || !c.org || !Number.isFinite(c.exp) || c.exp < Date.now() / 1000 || c.exp > Date.now() / 1000 + 90) return null;
    if (c.module !== expected.module || c.method !== expected.method || c.bodyHash !== expected.bodyHash || c.org !== expected.org) return null;
    return c;
  } catch { return null; }
}
export const hashBody = body => createHash('sha256').update(body).digest('hex');
export function redact(text) {
  return String(text).replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk-|pit-|ghp_|gho_)[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/((?:password|secret|token|api[_-]?key|authorization)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}
export function commercialSummary(bids) {
  const known = bids.filter(b => typeof b.bid_amount === 'number' && Number.isFinite(b.bid_amount));
  const won = known.filter(b => String(b.status).toLowerCase() === 'won');
  const lost = known.filter(b => String(b.status).toLowerCase() === 'lost');
  const active = known.filter(b => ['sent','follow-up'].includes(String(b.status).toLowerCase()));
  const profit = bids.filter(b => typeof b.projected_profit === 'number' && Number.isFinite(b.projected_profit));
  const sum = (rows, field) => rows.reduce((n,b) => n + b[field], 0);
  return { bidCount:bids.length, pipelineValue:sum(active,'bid_amount'), wonValue:sum(won,'bid_amount'), lostValue:sum(lost,'bid_amount'), projectedProfit:profit.length ? sum(profit,'projected_profit') : null, profitCoverage:`${profit.length}/${bids.length}`, unknownValue:bids.length-known.length, revenue:null };
}
export const draftModules = new Set(['projects','leads','contacts','companies','opportunities','emailblaster','sops','intelligence','fox']);
export function validateDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A record is required.');
  const title = String(input.title || '').trim();
  if (!title || title.length > 200) throw new Error('Name must be 1–200 characters.');
  const allowed = ['title','status','company','email','phone','website','category','address','mapsUrl','rating','reviewCount','websiteStatus','scoreEvidence','previewUrl','tier','nextAction','lastTouch','projectId','value','probability','expectedClose','owner','subject','body','sequence','notes','sourceUrl','suppressions'];
  const result = {};
  for (const key of allowed) {
    if (input[key] == null) continue;
    if (typeof input[key] !== 'string' && typeof input[key] !== 'number') throw new Error(`Invalid ${key}.`);
    if (String(input[key]).length > (['body','notes','sequence','suppressions'].includes(key) ? 20000 : 2000)) throw new Error(`${key} is too long.`);
    result[key] = input[key];
  }
  for (const key of ['website','mapsUrl','previewUrl','sourceUrl']) if (result[key]) {
    const url = new URL(String(result[key]));
    if (!['http:','https:'].includes(url.protocol)) throw new Error(`${key} must use HTTP or HTTPS.`);
  }
  for (const key of ['rating','reviewCount','value','probability']) if (result[key] !== undefined && result[key] !== '') {
    const numeric=Number(result[key]);
    if(!Number.isFinite(numeric)||numeric<0||(key==='rating'&&numeric>5)||(key==='probability'&&numeric>100))throw new Error(`Invalid ${key}.`);
    result[key]=numeric;
  }
  // A campaign draft never claims provider delivery.
  return {...result,title};
}

/** Explicit operator assessment, never a claim of automated website inspection. */
export function leadAssessment(record) {
  if(!record.scoreEvidence?.trim())return {assessmentStatus:'Evidence required',opportunityScore:null};
  const website=String(record.websiteStatus||'').toLowerCase();
  if(!['missing','weak','adequate'].includes(website))return {assessmentStatus:'Set website status to missing, weak or adequate',opportunityScore:null};
  const components={websiteGap:website==='missing'?60:website==='weak'?35:0,contactable:record.email||record.phone?20:0,reviewPresence:Number(record.reviewCount)>0?20:0};
  const score=Object.values(components).reduce((a,b)=>a+b,0);
  return {assessmentStatus:'Operator evidence — not automatically verified',opportunityScore:score,assessmentTier:score>=80?'Priority':score>=50?'Review':'Nurture',assessmentComponents:components,assessmentVersion:'operator-evidence-v1'};
}
