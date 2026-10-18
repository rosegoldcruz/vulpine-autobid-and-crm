import {calculateProject,money,linesFor,lookup} from './pricing.mjs';
import {customerIssues,customerNotes} from './proposal-policy.mjs';
const safe=s=>String(s??'').replace(/[“”″]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/×/g,'x').replace(/[^\x20-\x7e\n]/g,'?');
export async function generateProposal(PDFLib,data,state,type,templateBytes,options={}){
 const {PDFDocument,StandardFonts,rgb}=PDFLib,result=calculateProject(data,state),missing=customerIssues(data,state,result),customer=type==='customer'||type==='draft';
 if(type==='customer'&&missing.length)throw Object.assign(Error('Customer-ready export blocked:\n'+missing.join('\n')),{status:422});
 if(result.issues.length)throw Object.assign(Error(result.issues.join('\n')),{status:422});
 const doc=await PDFDocument.create(),source=await PDFDocument.load(templateBytes||await(await fetch('./proposal-template.pdf')).arrayBuffer());
 const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),gold=rgb(.67,.49,.23),ink=rgb(.13,.14,.13),muted=rgb(.38,.39,.38),paper=rgb(.98,.975,.96),lineColor=rgb(.82,.8,.75);
 const W=612,H=792,L=35,R=577;
 const draw=(p,value,x,y,size=9,strong=false,color=ink)=>p.drawText(safe(value),{x,y,size,font:strong?bold:font,color});
 const wrap=(value,width,size=9,strong=false)=>{const f=strong?bold:font,out=[];for(const para of safe(value).split('\n')){let row='';for(let word of para.split(/\s+/)){while(f.widthOfTextAtSize(word,size)>width){let n=1;while(n<word.length&&f.widthOfTextAtSize(word.slice(0,n+1),size)<=width)n++;if(row){out.push(row);row='';}out.push(word.slice(0,n));word=word.slice(n);}const next=row?row+' '+word:word;if(f.widthOfTextAtSize(next,size)>width&&row){out.push(row);row=word;}else row=next;}out.push(row);}return out;};
 const branded=(title)=>{const p=doc.addPage([W,H]);p.drawRectangle({x:0,y:0,width:W,height:H,color:paper});p.drawRectangle({x:0,y:0,width:5,height:H,color:gold});draw(p,'VULPINE',L,749,24,true);draw(p,title,L,710,16,true);p.drawLine({start:{x:L,y:732},end:{x:R,y:732},color:gold,thickness:1});draw(p,state.quoteId,R-bold.widthOfTextAtSize(safe(state.quoteId),8),752,8,true,muted);draw(p,state.date+' | Valid until '+state.validUntil,L,25,8,false,muted);return p;};
 const artwork=async index=>{const original=source.getPage(index),box=original.getMediaBox(),embedded=await doc.embedPage(original,{left:box.x,bottom:box.y,right:box.x+box.width,top:box.y+box.height}),scale=Math.min(W/box.width,H/box.height);const p=doc.addPage([W,H]);p.drawRectangle({x:0,y:0,width:W,height:H,color:paper});p.drawPage(embedded,{x:(W-box.width*scale)/2,y:(H-box.height*scale)/2,width:box.width*scale,height:box.height*scale});if(index===0)p.drawRectangle({x:(W-box.width*scale)/2,y:0,width:5*scale,height:H,color:paper});return p;};
 const cover=await artwork(0);draw(cover,state.preparedBy||'Daniel Cruz',38,255,21);draw(cover,state.validUntil,38,179,14,true);draw(cover,state.date,501,704,8);
 const approach=await artwork(1);draw(approach,state.date,501,704,8);
 if(type==='draft'){const banner=p=>{p.drawRectangle({x:L,y:41,width:R-L,height:22,color:paper});draw(p,'INTERNAL DRAFT - INCOMPLETE / NOT FOR CUSTOMER SUBMISSION',L+6,48,9,true,gold);};banner(cover);banner(approach);}
 const charges=result.charges,active=result.units.filter(u=>u.repeat>0);
 // Fill the approved schedule artwork; all artwork is uniformly fitted to Letter.
 if(customer)for(let offset=0;offset<active.length;offset+=20){
  const original=source.getPage(2),box=original.getMediaBox(),scale=Math.min(W/box.width,H/box.height),dx=(W-box.width*scale)/2,dy=(H-box.height*scale)/2,p=await artwork(2);
  const cell=(value,x,top,width=100,size=8,strong=false,color=ink)=>{let v=safe(value),actual=size,f=strong?bold:font;while(f.widthOfTextAtSize(v,actual)>width&&actual>5.5)actual-=.25;if(f.widthOfTextAtSize(v,actual)>width){while(v&&f.widthOfTextAtSize(v+'...',actual)>width)v=v.slice(0,-1);v+='...';}draw(p,v,dx+(x-box.x)*scale,dy+(850.079956-top-box.y)*scale,actual*scale,strong,color);};
  cell(state.project+' / '+(state.customer||'GC PENDING'),108,70,201,8,true);cell(state.projectInfo?.cabinetLine||'Line pending',422,70,144,8);
  active.slice(offset,offset+20).forEach((u,i)=>{const top=125+i*18.8;cell([...new Set(u.entries.map(r=>data.families?.[r.li]||(r.li<8?'Framed':'Frameless')))].join('/'),30,top,93,7,true);cell(u.name,134,top,107,7,true);cell(u.repeat,254,top,31,8);cell(money(u.sale),292,top,66,8);cell(money(u.sale*u.repeat),368,top,68,8);cell(u.entries.reduce((s,r)=>s+(lookup(data,r.li,r.sku)?.[5]||0)*r.qty*u.repeat,0),449,top,49,8);cell(u.entries.reduce((s,r)=>s+(r.handleCount??lookup(data,r.li,r.sku)?.[7]??0)*r.qty*u.repeat,0),510,top,54,8);});
  cell(money(result.cabinetSale),368,506,70,9,true,rgb(1,1,1));cell(charges?.boxes,449,506,49,8,true,rgb(1,1,1));cell(charges?.handles.quantity,510,506,54,8,true,rgb(1,1,1));
  [money(result.cabinetSale),money(charges?.handles.amount||0),result.tax.amount===null||!state.tax?.enabled&&!state.tax?.exemption?'Pending verification':money(result.tax.amount),money(charges?.freight.amount||0),charges?.installation.status==='excluded'?'Excluded':money(charges.installation.amount),result.total===null?'Subtotal '+money(result.sale):money(result.total)].forEach((v,i)=>cell(v,201,562+i*18.5,83,7,i===5));
  [charges?charges.counts.apartments+' apts + '+charges.counts.amenities+' areas':result.count,charges?.counts.groups,charges?.boxes,charges?.handles.quantity,charges?.installation.status==='excluded'?'Excluded':'Priced and included',type==='draft'?'Internal draft':'Cabinet supply'].forEach((v,i)=>cell(v,438,562+i*18.5,126,8,i===5));
  [...(data.specifications||['HDF','Plywood with maple finish','Plywood','DTC soft-close','Solid wood dovetailed','Undermount soft-close']),state.projectInfo?.finishBasis||'Finish pending verification'].forEach((v,i)=>cell(v,215,701+i*14,348,7));
  if(result.total===null){p.drawRectangle({x:dx+(34-box.x)*scale,y:dy+(850.079956-661-box.y)*scale,width:164*scale,height:18*scale,color:rgb(.94,.925,.89)});cell('SUBTOTAL BEFORE TAX',36,654,160,8,true);}
  cell(state.quoteId+' | '+(type==='draft'?'INTERNAL DRAFT - NOT FOR SUBMISSION':'PREPARED PROPOSAL')+' | '+state.date,29,804,536,8);
 }

 let page,y;
 const next=title=>{page=branded(title);y=680;};
 const room=h=>{if(y-h<65)next('CONTINUED');};
 const text=(value,size=9,strong=false)=>{for(const line of wrap(value,R-L,size,strong)){room(size+5);draw(page,line,L,y,size,strong);y-=size+5;}y-=5;};
 const heading=title=>{room(42);page.drawRectangle({x:L,y:y-7,width:R-L,height:22,color:ink});draw(page,title,L+9,y,10,true,rgb(1,1,1));y-=30;};
 const pair=(label,value,strong=false)=>{const a=wrap(label,330,9,strong),b=wrap(value,180,9,strong),height=Math.max(a.length,b.length)*14+9;room(height);a.forEach((line,i)=>draw(page,line,L,y-i*14,9,strong));b.forEach((line,i)=>draw(page,line,R-180,y-i*14,9,strong));y-=height;};
 next(type==='draft'?'INTERNAL PROPOSAL DRAFT':type==='customer'?'CABINET PROPOSAL':'INTERNAL COSTING / PURCHASE');
 heading('PROJECT INFORMATION');
 pair('Project',state.project||'MISSING - project name');pair('General contractor / customer',state.customer||'MISSING - GC/company');
 if(state.projectInfo?.contact)pair('Project contact',[state.projectInfo.contact,state.email].filter(Boolean).join(' | '));
 pair('Delivery address',(state.tax?.address?Object.values(state.tax.address).filter(Boolean).join(', '):'')||'MISSING - verified delivery address');
 pair('Cabinet line',state.projectInfo?.cabinetLine||'MISSING - cabinet line');
 text('Finish basis: '+(state.projectInfo?.finishBasis||[...new Set(active.flatMap(u=>u.entries.map(r=>r.line)))].join(', ')));
 if(charges){pair('Apartments / named amenity areas',charges.counts.apartments+' apartments / '+charges.counts.amenities+' areas');pair('Apartment type groups / cabinet boxes',charges.counts.groups+' groups / '+charges.boxes+' boxes');pair('Accessories / decorative handles',charges.accessories+' accessories / '+charges.handles.quantity+' handles');}
 heading('PRICE SUMMARY');
 pair('Cabinet and material supply',money(customer?result.cabinetSale:result.purchase));
 if(charges&&type!=='purchase'){
  pair('Decorative handles: '+charges.handles.chargedQuantity+' x '+money(charges.handles.rate),money(charges.handles.amount));
  if(charges.handles.includedQuantity)text(charges.handles.includedQuantity+' handles included within cabinet/material lines; charged once.');
  pair('Shipping: '+charges.freight.quantity+' units/areas x '+money(charges.freight.rate),money(charges.freight.amount));
  if(charges.freight.approval)text('Freight override: '+charges.freight.approval);
  for(const [label,item]of [['Installation',charges.installation],['Assembly',charges.assembly]])pair(label,item.status==='excluded'?'Excluded':money(item.amount)+' - priced and included');
 }
 if(type!=='purchase'){
  pair('Selling subtotal before tax',money(result.sale),true);
  pair('Taxable amount',result.tax.taxableAmount==null?'PENDING - verification required':money(result.tax.taxableAmount));
  pair('Sales tax rate',result.tax.exemption?'Exempt - documented':result.tax.rate==null||!state.tax?.enabled?'PENDING - verification required':(result.tax.rate*100).toFixed(4)+'%');
  pair('Sales tax',result.tax.amount==null||(!state.tax?.enabled&&!state.tax?.exemption)?'PENDING - verification required':money(result.tax.amount));
  pair(type==='draft'?'Priced scope subtotal (tax pending if unresolved)':'GRAND TOTAL',result.total==null||(!state.tax?.enabled&&!state.tax?.exemption)?money(result.sale)+' + tax pending':money(result.total),true);
  if(state.tax?.lookup)text('Tax source: '+state.tax.lookup.provider+' | Applicable date: '+(state.tax.lookup.applicableDate||state.date)+' | Verified: '+state.tax.lookup.retrievedAt);
  if(state.tax?.exemption)text('Tax exemption: '+state.tax.exemption.reason+' | Authority: '+state.tax.exemption.authority+' | Evidence: '+state.tax.exemption.document);
 }
 if(!customer){heading('SUPPLIER COSTS');pair('Cabinets/materials cost',money(result.purchase));if(charges){pair('Handle supplier cost',charges.handles.supplierCost==null?'Unverified - separate from selling charge':money(charges.handles.supplierCost));pair('Actual freight supplier cost',charges.freight.supplierCost==null?'Unverified - separate from selling charge':money(charges.freight.supplierCost));}if(type==='internal')pair('Cabinet/material margin',state.margin+'%');}
 if(type==='draft'&&missing.length){room(45+missing.reduce((sum,value)=>sum+wrap(value,R-L).length*14+5,0));heading('REQUIRED BEFORE CUSTOMER-READY EXPORT');missing.forEach(value=>text(value));}
 next('UNIT TYPE / AREA SCHEDULE');
 text('Each schedule is extended by its actual quantity. Cabinet amounts below exclude separately priced handles and freight.');
 for(const u of active){
  heading(u.name+' | '+(u.areas?.length?u.areas.length+' named areas / 1 combined schedule':u.repeat+' '+(u.kind==='amenity'?'named area':'apartments')));
  pair('Cabinet supply per '+(u.kind==='amenity'?'area':'apartment'),money(type==='purchase'?u.purchase:u.sale));pair('Extended cabinet supply x '+u.repeat,money((type==='purchase'?u.purchase:u.sale)*u.repeat),true);
  const counts=u.entries.reduce((r,item)=>{const m=lookup(data,item.li,item.sku);r.boxes+=(m?.[5]||0)*item.qty*u.repeat;r.handles+=(item.handleCount??m?.[7]??0)*item.qty*u.repeat;return r;},{boxes:0,handles:0});
  if(u.areas?.length)text('Named areas: '+u.areas.join(', ')+'. Island included within its kitchen.');
  text(counts.boxes+' cabinet boxes | '+counts.handles+' decorative handles | '+[...new Set(u.entries.map(i=>i.line))].join(', '));
  if(!customer)for(const row of u.entries)pair(row.sku+' | '+row.line+' | '+row.qty+' x '+u.repeat+' = '+row.qty*u.repeat,money((type==='purchase'?row.purchase:row.sale)*row.qty*u.repeat));
 }
 next('SCOPE & PRICING BASIS');
 for(const [title,value]of Object.entries(customerNotes(state))){heading(title.toUpperCase());text(value);}
 if(state.projectInfo?.mixEvidence){heading('PROJECT QUANTITY BASIS');text(state.projectInfo.mixEvidence);}
 next('PREPARED PROPOSAL / ACCEPTANCE');
 text(state.project||'Project name pending',13,true);text(state.customer||'General contractor/company pending');
 heading('VULPINE REPRESENTATIVE');
 if(state.signature?.approved&&state.signature.quoteId===state.quoteId&&state.preparedBy==='Daniel Cruz'){
  if(!options.signatureBytes)throw Object.assign(Error('Approved Daniel Cruz signature asset is unavailable.'),{status:422});
  const signature=await doc.embedPng(options.signatureBytes),dimensions=signature.scaleToFit(205,83);room(145);page.drawImage(signature,{x:L,y:y-dimensions.height,width:dimensions.width,height:dimensions.height});y-=dimensions.height+17;
 }else{room(80);y-=55;page.drawLine({start:{x:L,y},end:{x:L+240,y},color:lineColor,thickness:.6});y-=17;}
 text(state.preparedBy||'Daniel Cruz',11,true);text('VULPINE',10,true);
 text('Prepared proposal. Customer acceptance and signing date are not completed.');
 heading('CUSTOMER AUTHORIZED REPRESENTATIVE');
 for(const label of ['Customer signature','Printed name / title','Signing date']){room(66);y-=40;page.drawLine({start:{x:L,y},end:{x:R,y},color:lineColor,thickness:.6});draw(page,label,L,y-14,8,false,muted);y-=28;}
 await artwork(3);
 const pages=doc.getPages();pages.forEach((p,i)=>{if(i>1&&i<pages.length-1){draw(p,(type==='draft'?'INTERNAL DRAFT | ':'')+state.quoteId+' | '+(i+1)+' / '+pages.length,350,25,8,false,muted);}});
 doc.setTitle((type==='draft'?'Internal revised draft':'Cabinet proposal')+' - '+state.project);doc.setAuthor(state.preparedBy||'Vulpine LLC');doc.setSubject('VULPINE proposal | '+state.quoteId+' | Closing artwork is final page');
 return doc.save();
}
