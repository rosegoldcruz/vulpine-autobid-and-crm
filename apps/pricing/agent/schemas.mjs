import {z} from 'zod';

const text=z.string().trim().min(1).max(200);
export const id=z.uuid();
export const count=z.number().int().min(0).max(100000);
export const finish=z.number().int().min(0).max(500);
export const item=z.strictObject({sku:text,li:finish,qty:count,boxCount:z.number().int().min(0).max(1).optional(),configurationBasis:z.string().min(1).max(2000).optional(),handleCount:count.optional(),handlesIncluded:z.boolean().optional(),handleInclusion:text.optional(),assemblyId:text.optional()});
export const unit=z.strictObject({id,name:text,repeat:count,defaultLi:finish,auto:z.boolean(),items:z.array(item).max(2000),kind:z.enum(['apartment','amenity']).optional(),areaId:text.optional(),areas:z.array(text).max(100).optional()});
const tax=z.object({enabled:z.boolean(),mode:z.enum(['automatic','manual']).optional(),address:z.object({street:z.string().max(200),city:z.string().max(100),state:z.string().max(2),zip:z.string().max(10)}),lookup:z.object({provider:z.string(),manual:z.boolean().optional(),enteredBy:z.string().optional(),addressKey:z.string(),rate:z.number(),components:z.array(z.object({name:z.string(),rate:z.number()})).max(30),retrievedAt:z.string(),signature:z.string(),applicableDate:z.string().optional(),lineAmounts:z.record(z.string(),z.number()).optional(),taxableItems:z.record(z.string(),z.boolean()).optional(),taxAmount:z.number().int().optional(),taxableAmounts:z.record(z.string(),z.number()).optional()}).nullable(),exemption:z.object({reason:text,document:z.string().min(1),authority:text,validFrom:text,validUntil:text,addressKey:z.string(),signature:z.string()}).optional()});
export const state=z.strictObject({version:z.literal(2),supplier:z.enum(['hci','rythern','uscd']).default('hci'),project:text,status:z.literal('Tentative'),quoteId:text,date:text,validUntil:text,customer:z.string().max(200),email:z.string().max(200),preparedBy:z.enum(['Daniel Cruz','Mike Musonda']),notes:z.string().max(10000),margin:z.number().int().min(1).max(50),comparison:z.boolean(),pricingPolicy:z.literal(2).optional(),projectInfo:z.record(z.string(),z.unknown()).optional(),charges:z.record(z.string(),z.unknown()).optional(),customerSections:z.record(z.string(),z.string()).optional(),signature:z.object({approved:z.boolean(),quoteId:text}).optional(),revisionOf:text.optional(),tax:tax.optional(),units:z.array(unit).max(500)});
export const source=z.strictObject({id,kind:z.enum(['instruction','plan']),name:text,sha256:z.string().length(64),text:z.string().max(300000)});
export const evidence=z.strictObject({source_id:id,quote:z.string().min(1).max(2000)});
export const job=z.strictObject({id,revision:z.number().int().positive(),state,sources:z.array(source),provenance:z.array(z.strictObject({unit_id:id,sku:z.string().nullable(),evidence})),exceptions:z.array(z.string()),catalog_hash:z.string().length(64),saved:z.boolean(),created_at:z.string(),updated_at:z.string()});
const key={job_id:id};
const mutation={...key,expected_revision:z.number().int().positive()};
const details={customer:z.string().max(200).optional(),email:z.string().max(200).optional(),preparedBy:state.shape.preparedBy.optional(),notes:state.shape.notes.optional(),date:state.shape.date.optional(),validUntil:state.shape.validUntil.optional(),projectInfo:state.shape.projectInfo,charges:state.shape.charges,customerSections:state.shape.customerSections,signature:state.shape.signature,tax:state.shape.tax};
const quoteMutation={quote_id:id,expected_revision:z.number().int().positive()};
const taxRequest={mode:z.enum(['manual','automatic','exempt']).default('manual'),address:tax.shape.address.optional(),rate_percent:z.number().min(0).max(100).optional(),exemption:z.strictObject({reason:text,document:z.string().min(1).max(10000),authority:text,validFrom:text,validUntil:text}).optional()};
export const inputs={
 delete_bid:z.strictObject(mutation),
 delete_project_quote:z.strictObject({quote_id:id,expected_revision:z.number().int().positive()}),
 set_bid_details:z.strictObject({...mutation,...details}),
 set_project_quote_details:z.strictObject({...quoteMutation,...details}),
 set_project_quote_items:z.strictObject({...quoteMutation,unit_id:id,items:z.array(item).max(2000),basis:z.string().trim().min(1).max(10000)}),
 set_project_quote_cabinet_details:z.strictObject({...quoteMutation,units:z.array(z.strictObject({unit_id:id,kind:z.enum(['apartment','amenity']).optional(),auto:z.boolean().optional(),items:z.array(z.strictObject({sku:text,li:finish,boxCount:z.number().int().min(0).max(1),handleCount:count,configurationBasis:z.string().min(1).max(2000)})).max(2000).default([])})).min(1).max(500)}),
 revise_project_quote:z.strictObject(quoteMutation),
 set_bid_tax:z.strictObject({...mutation,...taxRequest}),
 set_project_quote_tax:z.strictObject({...quoteMutation,...taxRequest}),
 export_project_quote:z.strictObject({...quoteMutation,format:z.enum(['pdf','xlsx']),type:z.enum(['customer','draft','internal','purchase']).default('customer')}),
 set_bid_margin:z.strictObject({...mutation,margin:z.number().int().min(1).max(50)}),
 set_project_quote_margin:z.strictObject({quote_id:id,expected_revision:z.number().int().positive(),margin:z.number().int().min(1).max(50)}),
 get_project_document:z.strictObject({quote_id:id,document_id:id}),
 list_bid_jobs:z.strictObject({}),
 list_projects:z.strictObject({}),
 get_project_quote:z.strictObject({quote_id:id,include_calculation_lines:z.boolean().default(false)}),
 save_bid_to_project:z.strictObject({...mutation,type:z.enum(['customer','draft']).default('draft'),scope_notes:z.string().max(10000).optional()}),
 create_bid_job:z.strictObject({project:text,supplier:z.enum(['hci','rythern','uscd']).default('hci'),instruction:z.string().min(1).max(300000),margin:z.number().int().min(1).max(50).default(20)}),
 get_bid_job:z.strictObject(key),
 extract_takeoff:z.strictObject({...key,source_id:id.optional(),expected_revision:z.number().int().positive().optional(),name:text.optional(),text:z.string().min(1).max(300000).optional(),pdf_base64:z.string().max(2800000).optional()}).refine(v=>v.source_id?!v.text&&!v.pdf_base64&&!v.name&&!v.expected_revision:!!v.expected_revision&&!!v.name&&(!!v.text!==!!v.pdf_base64)),
 set_unit_mix:z.strictObject({...mutation,units:z.array(z.strictObject({id:id.optional(),name:text,repeat:count,defaultLi:finish,auto:z.boolean().optional(),kind:z.enum(['apartment','amenity']).optional(),areaId:text.optional(),areas:z.array(text).max(100).optional(),evidence})).min(1).max(500)}),
 search_catalog:z.strictObject({supplier:z.enum(['hci','rythern','uscd']).default('hci'),query:z.string().max(200),li:finish,limit:z.number().int().min(1).max(50).default(20)}),
 update_bid_items:z.strictObject({...mutation,unit_id:id,items:z.array(item.extend({evidence})).max(2000)}),
 price_bid:z.strictObject(key),
 validate_bid:z.strictObject(key),
 save_bid:z.strictObject(mutation),
 export_bid:z.strictObject({...mutation,scope_notes:z.string().max(10000).optional(),format:z.enum(['xlsx','pdf']),type:z.enum(['customer','internal','purchase','draft']).default('customer')})
};
const cents=z.number().int();
export const totals=z.strictObject({purchase:cents,sale:cents.describe('Customer subtotal before tax, including separately billed shipping; not product revenue'),revenue:cents.describe('Cabinets and handles revenue only; excludes shipping, services and tax').optional(),productCost:cents.describe('Cabinet and known handle supplier costs only; excludes freight').optional(),actualMargin:z.number().describe('Product profit divided by cabinets and handles revenue, percent').optional(),profit:cents.describe('Cabinets and handles revenue minus productCost; see profitBasis for unverified costs'),count,margin:z.number(),issues:z.array(z.string()),total:cents.nullable().optional(),tax:z.record(z.string(),z.unknown()).optional(),charges:z.record(z.string(),z.unknown()).nullable().optional(),costsComplete:z.boolean().optional(),profitBasis:z.string().optional(),customerReady:z.boolean().optional(),missingFields:z.array(z.string()).optional()});
const error=z.strictObject({ok:z.literal(false),error:z.strictObject({code:z.string(),message:z.string(),retryable:z.boolean()})});
const success=data=>z.strictObject({ok:z.boolean(),data:data.optional(),error:error.shape.error.optional()}).refine(v=>v.ok?!!v.data&&!v.error:!!v.error&&!v.data);
export const outputs={
 delete_bid:success(z.strictObject({job_id:id,deleted:z.literal(true)})),
 delete_project_quote:success(z.strictObject({quote_id:id,deleted:z.literal(true)})),
 set_bid_details:success(job),
 set_bid_tax:success(job),
 set_project_quote_items:success(z.object({quote_id:id,revision:z.number().int(),state:z.record(z.string(),z.unknown()),totals,documents:z.array(z.record(z.string(),z.unknown()))})),
 set_project_quote_cabinet_details:success(z.object({quote_id:id,revision:z.number().int(),state:z.record(z.string(),z.unknown()),totals,documents:z.array(z.record(z.string(),z.unknown()))})),
 revise_project_quote:success(z.object({quote_id:id,revision:z.number().int(),state:z.record(z.string(),z.unknown()),totals,documents:z.array(z.record(z.string(),z.unknown()))})),
 set_project_quote_details:success(z.object({quote_id:id,revision:z.number().int(),state:z.record(z.string(),z.unknown()),totals,documents:z.array(z.record(z.string(),z.unknown()))})),
 set_project_quote_tax:success(z.object({quote_id:id,revision:z.number().int(),state:z.record(z.string(),z.unknown()),totals,documents:z.array(z.record(z.string(),z.unknown()))})),
 export_project_quote:success(z.object({quote_id:id,revision:z.number().int(),document_id:id,url:z.url(),filename:z.string(),mime_type:z.string(),expires_at:z.string(),sha256:z.string().length(64)})),
 set_bid_margin:success(job),
 set_project_quote_margin:success(z.object({quote_id:id,revision:z.number().int(),state:z.record(z.string(),z.unknown()),totals,documents:z.array(z.record(z.string(),z.unknown()))})),
 get_project_document:success(z.strictObject({url:z.url(),filename:z.string(),mime_type:z.string(),expires_at:z.string(),sha256:z.string().length(64)})),
 list_bid_jobs:success(z.object({jobs:z.array(z.record(z.string(),z.unknown()))})),
 list_projects:success(z.object({projects:z.array(z.record(z.string(),z.unknown())),quotes:z.array(z.record(z.string(),z.unknown()))})),
 get_project_quote:success(z.object({quote_id:id,revision:z.number().int(),archived:z.boolean(),state:z.record(z.string(),z.unknown()),calculation:z.record(z.string(),z.unknown()).optional(),missingFields:z.array(z.string()).optional(),documents:z.array(z.record(z.string(),z.unknown()))})),
 save_bid_to_project:success(z.object({quote_id:id,revision:z.number().int(),url:z.url(),document_id:id})),
 create_bid_job:success(job),get_bid_job:success(job),set_unit_mix:success(job),update_bid_items:success(job),save_bid:success(job),
 extract_takeoff:success(z.strictObject({source,revision:z.number().int().positive(),review_required:z.literal(true),instructions:z.string()})),
 search_catalog:success(z.strictObject({matches:z.array(z.strictObject({sku:z.string(),description:z.string(),li:finish,available:z.boolean(),required_sku:z.string().nullable()}))})),
 price_bid:success(totals),validate_bid:success(z.strictObject({valid:z.boolean(),issues:z.array(z.string()),human_approval_required:z.literal(true)})),
 export_bid:success(z.strictObject({url:z.url(),filename:z.string(),mime_type:z.string(),expires_at:z.string(),sha256:z.string().length(64)}))
};
export class BidError extends Error{constructor(code,message){super(message);this.code=code;}}
