import {z} from 'zod';

const text=z.string().trim().min(1).max(200);
export const id=z.uuid();
export const count=z.number().int().min(0).max(100000);
export const finish=z.number().int().min(0).max(500);
export const item=z.strictObject({sku:text,li:finish,qty:count});
export const unit=z.strictObject({id,name:text,repeat:count,defaultLi:finish,auto:z.boolean(),items:z.array(item).max(2000)});
const tax=z.object({enabled:z.boolean(),address:z.object({street:z.string().max(200),city:z.string().max(100),state:z.string().max(2),zip:z.string().max(10)}),lookup:z.object({provider:z.string(),addressKey:z.string(),rate:z.number(),components:z.array(z.object({name:z.string(),rate:z.number()})).max(30),retrievedAt:z.string(),signature:z.string()}).nullable()});
export const state=z.strictObject({version:z.literal(2),supplier:z.enum(['hci','rythern','uscd']).default('hci'),project:text,status:z.literal('Tentative'),quoteId:text,date:text,validUntil:text,customer:z.string().max(200),email:z.string().max(200),preparedBy:z.enum(['Daniel Cruz','Mike Musonda']),notes:z.string().max(10000),margin:z.number().int().min(1).max(50),comparison:z.boolean(),tax:tax.optional(),units:z.array(unit).max(500)});
export const source=z.strictObject({id,kind:z.enum(['instruction','plan']),name:text,sha256:z.string().length(64),text:z.string().max(300000)});
export const evidence=z.strictObject({source_id:id,quote:z.string().min(1).max(2000)});
export const job=z.strictObject({id,revision:z.number().int().positive(),state,sources:z.array(source),provenance:z.array(z.strictObject({unit_id:id,sku:z.string().nullable(),evidence})),exceptions:z.array(z.string()),catalog_hash:z.string().length(64),saved:z.boolean(),created_at:z.string(),updated_at:z.string()});
const key={job_id:id};
const mutation={...key,expected_revision:z.number().int().positive()};
export const inputs={
 get_project_document:z.strictObject({quote_id:id,document_id:id}),
 list_bid_jobs:z.strictObject({}),
 list_projects:z.strictObject({}),
 get_project_quote:z.strictObject({quote_id:id}),
 save_bid_to_project:z.strictObject(mutation),
 create_bid_job:z.strictObject({project:text,supplier:z.enum(['hci','rythern','uscd']).default('hci'),instruction:z.string().min(1).max(300000)}),
 get_bid_job:z.strictObject(key),
 extract_takeoff:z.strictObject({...key,source_id:id.optional(),expected_revision:z.number().int().positive().optional(),name:text.optional(),text:z.string().min(1).max(300000).optional(),pdf_base64:z.string().max(2800000).optional()}).refine(v=>v.source_id?!v.text&&!v.pdf_base64&&!v.name&&!v.expected_revision:!!v.expected_revision&&!!v.name&&(!!v.text!==!!v.pdf_base64)),
 set_unit_mix:z.strictObject({...mutation,units:z.array(z.strictObject({id:id.optional(),name:text,repeat:count,defaultLi:finish,evidence})).min(1).max(500)}),
 search_catalog:z.strictObject({supplier:z.enum(['hci','rythern','uscd']).default('hci'),query:z.string().max(200),li:finish,limit:z.number().int().min(1).max(50).default(20)}),
 update_bid_items:z.strictObject({...mutation,unit_id:id,items:z.array(item.extend({evidence})).max(2000)}),
 price_bid:z.strictObject(key),
 validate_bid:z.strictObject(key),
 save_bid:z.strictObject(mutation),
 export_bid:z.strictObject({...mutation,format:z.enum(['xlsx','pdf']),type:z.enum(['customer','internal','purchase']).default('customer')})
};
const cents=z.number().int();
export const totals=z.strictObject({purchase:cents,sale:cents,profit:cents,count,margin:z.number(),issues:z.array(z.string())});
const error=z.strictObject({ok:z.literal(false),error:z.strictObject({code:z.string(),message:z.string(),retryable:z.boolean()})});
const success=data=>z.strictObject({ok:z.boolean(),data:data.optional(),error:error.shape.error.optional()}).refine(v=>v.ok?!!v.data&&!v.error:!!v.error&&!v.data);
export const outputs={
 get_project_document:success(z.strictObject({url:z.url(),filename:z.string(),mime_type:z.string(),expires_at:z.string(),sha256:z.string().length(64)})),
 list_bid_jobs:success(z.object({jobs:z.array(z.record(z.string(),z.unknown()))})),
 list_projects:success(z.object({projects:z.array(z.record(z.string(),z.unknown())),quotes:z.array(z.record(z.string(),z.unknown()))})),
 get_project_quote:success(z.object({quote_id:id,revision:z.number().int(),archived:z.boolean(),state:z.record(z.string(),z.unknown()),documents:z.array(z.record(z.string(),z.unknown()))})),
 save_bid_to_project:success(z.object({quote_id:id,revision:z.number().int(),url:z.url(),document_id:id})),
 create_bid_job:success(job),get_bid_job:success(job),set_unit_mix:success(job),update_bid_items:success(job),save_bid:success(job),
 extract_takeoff:success(z.strictObject({source,revision:z.number().int().positive(),review_required:z.literal(true),instructions:z.string()})),
 search_catalog:success(z.strictObject({matches:z.array(z.strictObject({sku:z.string(),description:z.string(),li:finish,available:z.boolean(),required_sku:z.string().nullable()}))})),
 price_bid:success(totals),validate_bid:success(z.strictObject({valid:z.boolean(),issues:z.array(z.string()),human_approval_required:z.literal(true)})),
 export_bid:success(z.strictObject({url:z.url(),filename:z.string(),mime_type:z.string(),expires_at:z.string(),sha256:z.string().length(64)}))
};
export class BidError extends Error{constructor(code,message){super(message);this.code=code;}}
