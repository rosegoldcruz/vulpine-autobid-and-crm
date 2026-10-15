import {money,calculateProject,lookup,quoteDates} from './pricing.mjs';
const safe=s=>String(s??'').replace(/[“”″]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/×/g,'x').replace(/[^\x20-\x7e\n]/g,'?');
export async function generateQuote(PDFLib,data,input,type='customer',templateBytes=null,now=new Date()){
 const state={...input,...quoteDates(now)},result=calculateProject(data,state);if(result.issues.length)throw Error('Resolve unit issues before generating the PDF.');if(!state.project.trim())throw Error('Enter a project name.');
 const {PDFDocument,StandardFonts,rgb}=PDFLib,doc=await PDFDocument.create(),template=await PDFDocument.load(templateBytes||await (await fetch('./proposal-template.pdf')).arrayBuffer()),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),serif=await doc.embedFont(StandardFonts.TimesRoman),gold=rgb(.67,.49,.23),ink=rgb(.13,.14,.13);
 // Original PDF media box has a 7.83pt origin offset; align to its true top.
 const H=850.079956,shortDate=s=>{const [y,m,d]=s.split('-');return m+'/'+d+'/'+y};
 const stamp=(p,schedule=false,addLine=false)=>{const top=schedule?7:76;if(schedule||addLine)p.drawLine({start:{x:487,y:H-top},end:{x:548,y:H-top},thickness:1.8,color:gold});p.drawText(shortDate(state.date),{x:489,y:H-top-11,size:9,font:serif,color:ink})};
 const text=(p,value,x,top,width=120,size=8,b=false,color=ink)=>{value=safe(value);let actual=size;const f=b?bold:font;while(f.widthOfTextAtSize(value,actual)>width&&actual>5.5)actual-=.25;if(f.widthOfTextAtSize(value,actual)>width){while(value.length&&f.widthOfTextAtSize(value+'...',actual)>width)value=value.slice(0,-1);value+='...'}p.drawText(value,{x,y:H-top,size:actual,font:f,color})};
 if(type!=='customer'){const [cover,approach]=await doc.copyPages(template,[0,1]);doc.addPage(cover);doc.addPage(approach);stamp(cover);stamp(approach);text(cover,state.preparedBy.trim()||'Daniel Cruz',34,567,255,27);text(cover,shortDate(state.validUntil),34,649,205,17,true);}
 const activeUnits=result.units.filter(u=>u.repeat>0),rows=activeUnits.flatMap(u=>u.entries.map(r=>({...r,unit:u,extendedQty:r.qty*u.repeat}))),totalCabinets=rows.reduce((s,r)=>s+(lookup(data,r.li,r.sku)?.[5]||0)*r.extendedQty,0),totalHardware=rows.reduce((s,r)=>s+(lookup(data,r.li,r.sku)?.[7]||0)*r.extendedQty,0),finishes=[...new Set(rows.map(r=>r.line))],schedule=type==='customer'?activeUnits:rows,pages=Math.max(1,Math.ceil(schedule.length/20)),amount=type==='purchase'?result.purchase:result.sale;
 const abbreviations=data.lines?.map(l=>l[0])||['WHS','GRS','SDW','MSL','ONB','SBS','SSG','MTS','Euro Classic','Euro Deluxe','Euro Custom'];
 for(let index=0;index<pages;index++){
  const [p]=await doc.copyPages(template,[2]);doc.addPage(p);stamp(p,true);
  // Fill the supplied page-3 form directly; every amount covers all repeated units.
  text(p,state.project+(state.customer?' / '+state.customer:''),108,70,201,9,true);text(p,finishes.length===1?finishes[0]:'Mixed - listed in rows',422,70,144,8);
  if(type!=='customer'){p.drawRectangle({x:29,y:H-43,width:460,height:16,color:rgb(.12,.13,.12)});p.drawText(type==='internal'?'INTERNAL COSTING / SCHEDULE OF MATERIALS':'PURCHASE SCHEDULE / MATERIALS',{x:36,y:H-38,size:9,font:bold,color:rgb(1,1,1)})}
  // Restore the blank body grid to align with the supplied printed column headings.
  for(let j=0;j<20;j++)p.drawRectangle({x:25.5,y:H-114-(j+1)*18.8,width:545,height:18.8,color:j%2?rgb(.94,.925,.89):rgb(1,1,1)});
  for(const x of [25.5,127,245,289,365,443,505,570.5])p.drawLine({start:{x,y:H-114},end:{x,y:H-490},thickness:.3,color:rgb(.85,.82,.76)});
  schedule.slice(index*20,index*20+20).forEach((r,j)=>{
   const top=125+j*18.8;
   if(type==='customer'){
    const families=[...new Set(r.entries.map(i=>data.families?.[i.li]||(i.li<8?'Framed':'Frameless')))];
    text(p,families.join(' / '),30,top,93,7.5,true);text(p,r.name,134,top,107,8,true);text(p,r.repeat,254,top,31,8);
    text(p,money(r.sale),292,top,66,8);text(p,money(r.sale*r.repeat),368,top,68,8);
    text(p,data.countsVerified===false?'Not supplied':r.entries.reduce((s,i)=>s+(lookup(data,i.li,i.sku)?.[5]||0)*i.qty*r.repeat,0),449,top,49,8);
    text(p,data.countsVerified===false?'Not supplied':r.entries.reduce((s,i)=>s+(lookup(data,i.li,i.sku)?.[7]||0)*i.qty*r.repeat,0)+' est.',510,top,54,7);
   }else{const price=type==='purchase'?r.purchase:r.sale,meta=lookup(data,r.li,r.sku);text(p,r.sku,30,top,93,7.5,true);text(p,r.unit.name+' / '+abbreviations[r.li],134,top-3,107,7);text(p,r.qty+' each x '+r.unit.repeat+' units',134,top+5,107,6);text(p,r.extendedQty,254,top,31,8);text(p,money(price),292,top,66,8);text(p,money(price*r.extendedQty),368,top,68,8);text(p,(meta?.[5]||0)*r.extendedQty,449,top,49,8);text(p,(meta?.[7]||0)*r.extendedQty+' est.',510,top,54,7)}
  });
  text(p,money(amount),368,506,70,9,true,rgb(1,1,1));text(p,data.countsVerified===false?'Not supplied':totalCabinets,449,506,49,8,true,rgb(1,1,1));text(p,data.countsVerified===false?'Not supplied':totalHardware+' est.',510,506,54,7,true,rgb(1,1,1));
  const values=[money(amount),'Not separately priced','Not added','Only if listed','Only if listed',money(amount)];values.forEach((v,i)=>text(p,v,201,562+i*18.5,83,8,i===5));
  const snapshot=[result.count,result.units.filter(u=>u.repeat>0).length,data.countsVerified===false?'Not supplied':totalCabinets,data.countsVerified===false?'Not supplied':totalHardware+' (estimate)','Not included unless listed',state.status+' quantities'];snapshot.forEach((v,i)=>text(p,v,438,562+i*18.5,126,8,i===5));
  // Approved specification wording from the supplied Garden Villas, Sunset Ridge,
  // and Gracious Manor proposals. Finish names still come from the selected items.
  const specifications=[...(data.specifications||['HDF','Plywood with maple finish','Plywood','DTC soft-close','Solid wood dovetailed','Undermount soft-close']),finishes.join(', ')];specifications.forEach((v,i)=>text(p,v,215,701+i*14,348,7));
  text(p,state.quoteId+' | '+state.status+' | Valid until '+shortDate(state.validUntil)+' | Schedule '+(index+1)+'/'+pages,29,804,536,8);
  text(p,data.label?data.label+' | '+data.basis:'Cabinets row includes all listed materials. Hardware counts are estimates, not added handle charges.',29,817,536,7);
 }
 // Details retain full descriptions and notes when narrow template cells must abbreviate.
 const needsDetails=state.notes.trim()||state.customer.length>35||state.project.length>40||rows.some(r=>r.unit.name.length>20||r.sku.length>18);
 if(type!=='customer'&&(type==='internal'||needsDetails)){const detail=await PDFDocument.load(await generateInternalReport(PDFLib,data,state,type));const copied=await doc.copyPages(detail,detail.getPageIndices());copied.forEach(p=>doc.addPage(p))}
 if(type==='customer')addAcceptancePage(doc,PDFLib,state,result,{totalCabinets:data.countsVerified===false?null:totalCabinets,totalHardware:data.countsVerified===false?null:totalHardware,finishes,font,bold,gold,ink});
 if(type!=='customer'){const [closing]=await doc.copyPages(template,[3]);doc.addPage(closing);stamp(closing,false,true);}
 doc.setTitle((type==='customer'?'Cabinet proposal':type==='internal'?'Internal costing':'Purchase schedule')+' - '+state.project);doc.setAuthor(state.preparedBy||'Vulpine');doc.setSubject(state.quoteId+' | Generated '+state.date+' | Valid until '+state.validUntil);
 return doc.save();
}
function addAcceptancePage(doc,PDFLib,state,result,{totalCabinets,totalHardware,finishes,font,bold,gold,ink}){
 const {rgb}=PDFLib,width=595.5,height=842.25,page=doc.addPage([width,height]);
 const left=34,right=width-34,contentWidth=right-left,muted=rgb(.39,.4,.39),rule=rgb(.83,.81,.76),paper=rgb(.98,.975,.96);
 page.drawRectangle({x:0,y:0,width,height,color:paper});
 page.drawRectangle({x:0,y:0,width:5,height,color:gold});
 const draw=(value,x,top,size=10,strong=false,color=ink)=>page.drawText(safe(value),{x,y:height-top,size,font:strong?bold:font,color});
 const line=(x1,x2,top,color=rule)=>page.drawLine({start:{x:x1,y:height-top},end:{x:x2,y:height-top},thickness:.65,color});
 const wrap=(value,maxWidth,size=9.5)=>{
  const words=safe(value).split(/\s+/),lines=[];let current='';
  for(let word of words){
   while(font.widthOfTextAtSize(word,size)>maxWidth){let cut=1;while(cut<word.length&&font.widthOfTextAtSize(word.slice(0,cut+1),size)<=maxWidth)cut++;if(current){lines.push(current);current=''}lines.push(word.slice(0,cut));word=word.slice(cut)}
   const next=current?current+' '+word:word;if(font.widthOfTextAtSize(next,size)>maxWidth&&current){lines.push(current);current=word}else current=next;
  }
  if(current)lines.push(current);return lines.length?lines:[''];
 };
 draw('VULPINE',left,51,25,true);draw('BUILT FOR MULTIFAMILY LIVING',left,69,8,false,muted);
 wrap(state.quoteId,240,9).forEach((value,i)=>draw(value,right-font.widthOfTextAtSize(value,9),49+i*12,9,false,muted));
 line(left,right,86,gold);draw('PROJECT SUMMARY',left,119,20,true);
 let top=139;
 const section=label=>{page.drawRectangle({x:left,y:height-top-26,width:contentWidth,height:26,color:ink});draw(label,left+11,top+17,10,true,rgb(1,1,1));top+=26};
 const row=(label,value)=>{const lines=wrap(value,contentWidth-173),rowHeight=Math.max(28,lines.length*12+14);page.drawRectangle({x:left,y:height-top-rowHeight,width:contentWidth,height:rowHeight,color:rgb(1,1,1),borderColor:rule,borderWidth:.5});draw(label,left+11,top+18,8.5,false,muted);lines.forEach((s,i)=>draw(s,left+160,top+18+i*12,9.5));top+=rowHeight};
 section('I. PROJECT INFORMATION');
 row('Project name',state.project);
 row('General contractor / Prepared for',state.customer||'');
 row('Scope','Cabinet and trim supply as listed in this proposal. '+result.count+' units.'+(totalCabinets===null?' Cabinet and hardware counts require review.':' '+totalCabinets+' cabinets; '+totalHardware+' hardware pieces (estimate).'));
 row('Cabinet line / finish',finishes.join(', '));
 row('Proposal date / Valid until',state.date+' / '+state.validUntil);
 row('Proposal total',money(result.sale)+' | '+state.status+' quantities');
 // Notes must never trigger the itemized costing report in a customer proposal.
 // Long notes get their own continuation pages instead of clipping the signatures.
 const noteLines=wrap(state.notes.trim(),contentWidth,9);
 if(state.notes.trim()&&noteLines.length<=5){top+=8;noteLines.forEach(value=>{draw(value,left,top+12,9);top+=12});}
 top+=20;section('II. PREPARED BY');
 row('Company / Contact','Vulpine, LLC | '+(state.preparedBy||'Daniel Cruz'));
 row('Phone / Email','(480) 267-9181 | '+(state.preparedBy==='Mike Musonda'?'info@vulpine.llc':'cruz@vulpine.llc'));
 top+=22;section('III. AUTHORIZATION & ACCEPTANCE');
 // No signature from a reference proposal is copied into a new agreement.
 const signatureTop=top,half=(contentWidth-24)/2,xPositions=[left,left+half+24];
 for(let i=0;i<2;i++){
  const x=xPositions[i];draw(i===0?'VULPINE REPRESENTATIVE':'CLIENT AUTHORIZED REPRESENTATIVE',x,signatureTop+23,8.5,true);
  line(x,x+half,signatureTop+82);draw('Signature',x,signatureTop+95,8,false,muted);
  line(x,x+half,signatureTop+126);draw('Printed name / Title',x,signatureTop+139,8,false,muted);
  line(x,x+half,signatureTop+168);draw('Date',x,signatureTop+181,8,false,muted);
 }
 line(left,right,height-47,gold);draw('VULPINE, LLC  |  PHOENIX, AZ',left,height-29,8,false,muted);
 draw('AUTHORIZATION & ACCEPTANCE',right-170,height-29,8,true,gold);
 if(state.notes.trim()&&noteLines.length>5){
  for(let offset=0;offset<noteLines.length;offset+=48){const notesPage=doc.addPage([width,height]);notesPage.drawText('PROJECT NOTES - '+safe(state.project).slice(0,55),{x:left,y:height-50,size:13,font:bold,color:ink});noteLines.slice(offset,offset+48).forEach((value,i)=>notesPage.drawText(value,{x:left,y:height-82-i*14,size:9,font,color:ink}));}
 }
}
export async function generateInternalReport(PDFLib,data,state,type='customer'){
 const result=calculateProject(data,state);if(result.issues.length)throw Error('Resolve unit issues before generating the PDF.');
 if(!state.project.trim())throw Error('Enter a project name.');
 const {PDFDocument,StandardFonts,rgb}=PDFLib,doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.09,.15,.20),muted=rgb(.38,.42,.46),copper=rgb(.64,.38,.24);let page,y;
 const title=type==='internal'?'INTERNAL COSTING':type==='purchase'?'PURCHASE SCHEDULE':'CUSTOMER QUOTE';
 doc.setTitle(title+' - '+state.project);doc.setAuthor('Vulpine');doc.setSubject('Cabinet project '+state.quoteId);
 const draw=(text,x,yy,size=10,b=false,color=ink)=>page.drawText(safe(text),{x,y:yy,size,font:b?bold:font,color});
 const newPage=()=>{page=doc.addPage([612,792]);draw('VULPINE',42,748,22,true);draw(title,330,750,11,true,copper);draw(state.quoteId+' | '+state.date,330,732,9,false,muted);page.drawLine({start:{x:42,y:715},end:{x:570,y:715},thickness:1,color:rgb(.83,.86,.88)});y=690};
 const room=h=>{if(y-h<60)newPage()};
 const wrap=(text,width,size=10,b=false)=>{let all=[];for(const para of safe(text).split('\n')){let line='';for(let word of para.split(/\s+/)){while((b?bold:font).widthOfTextAtSize(word,size)>width){let cut=1;while(cut<word.length&&(b?bold:font).widthOfTextAtSize(word.slice(0,cut+1),size)<=width)cut++;if(line){all.push(line);line=''}all.push(word.slice(0,cut));word=word.slice(cut)}if((b?bold:font).widthOfTextAtSize(line+' '+word,size)>width&&line){all.push(line);line=word}else line+=(line?' ':'')+word}all.push(line)}return all};
 const text=(value,size=10,b=false)=>{for(const line of wrap(value,528,size,b)){room(size+6);draw(line,42,y,size,b);y-=size+6}};
 const pair=(label,value,b=false)=>{room(21);draw(label,42,y,11,b);draw(value,570-font.widthOfTextAtSize(safe(value),11),y,11,b);y-=21};
 newPage();text(state.project,19,true);text([state.customer&&'Prepared for: '+state.customer,state.email&&'Recipient: '+state.email,state.preparedBy&&'Prepared by: '+state.preparedBy].filter(Boolean).join('\n'));text('Status: '+state.status+' | Unit instances: '+result.count,10,true);y-=8;
 if(type==='internal'){pair('Purchase cost',money(result.purchase));pair('Selling total',money(result.sale));pair('Gross profit',money(result.profit),true);pair('Target / realized margin',state.margin+'% / '+result.actualMargin.toFixed(2)+'%')}
 else pair(type==='purchase'?'Purchase total':'Quote total',money(type==='purchase'?result.purchase:result.sale),true);
 text('Quantities are '+state.status.toLowerCase()+'. Additional tax, freight, assembly and installation are excluded unless listed. Prices in USD.',9);y-=12;
 for(const unit of result.units.filter(u=>u.repeat>0)){
  room(100);text(unit.name+' | '+unit.repeat+' unit'+(unit.repeat===1?'':'s'),14,true);
  const cols=[42,312,370,452,528];
  const tableHead=()=>{room(42);page.drawRectangle({x:42,y:y-7,width:528,height:22,color:rgb(.94,.95,.96)});['Item / finish','Qty / unit','Total qty',type==='purchase'?'Cost each':'Price each','Extended'].forEach((v,i)=>draw(v,cols[i],y,8,true));y-=28};tableHead();
  for(const row of unit.entries){const lines=wrap(row.sku+' - '+row.description+(row.auto?' (auto toe kick)':''),254,9),finish=wrap(row.line,254,8),height=(lines.length+finish.length)*12+12;if(y-height<62){newPage();text(unit.name+' - continued',12,true);tableHead()}
   let yy=y;for(const l of lines){draw(l,42,yy,9);yy-=12}for(const l of finish){draw(l,42,yy,8,false,muted);yy-=12}
   const amount=type==='purchase'?row.purchase:row.sale;
   draw(String(row.qty),cols[1]+10,y,9);draw(String(row.qty*unit.repeat),cols[2]+10,y,9);draw(money(amount),cols[3],y,9);const extended=money(amount*row.qty*unit.repeat);draw(extended,570-font.widthOfTextAtSize(extended,9),y-15,9,true);y-=height;
  }
  pair('One '+unit.name,money(type==='purchase'?unit.purchase:unit.sale));pair(unit.name+' x '+unit.repeat,money((type==='purchase'?unit.purchase:unit.sale)*unit.repeat),true);
  if(type==='internal'){text('Purchase / unit: '+money(unit.purchase)+' | Profit / unit: '+money(unit.profit),9);text('Purchase extended: '+money(unit.purchase*unit.repeat)+' | Profit extended: '+money(unit.profit*unit.repeat),9)}y-=12;
 }
 room(70);pair(type==='purchase'?'TOTAL PURCHASE COST':'TOTAL QUOTE',money(type==='purchase'?result.purchase:result.sale),true);
 if(type==='internal'){pair('TOTAL GROSS PROFIT',money(result.profit),true);text((data.basis?data.basis+'. ':'HCI purchase costs use 0.204 except shipping/delivery, which uses full catalog rates. ')+'Gross margin = profit / selling price. Selling price = purchase cost / (1 - target margin). Prices are rounded per item before multiplying quantities, so realized margin may differ slightly.',9)}
 if(state.notes.trim()){y-=8;text('Project notes',12,true);text(state.notes)}
 text('Estimate only; not an order submission or acceptance. Verify finishes, required parts, cut waste and final quantities before ordering.',9);
 if(type!=='customer')text(data.source?'Source: '+data.source.file+' | '+data.source.basis:'Sources: Highland Cabinetry Colorado Shaker v8-03252026re, price pages 35-39; Euro v3.11.10.25-RE, PDF price pages 15-25. Unavailable prices cannot be quoted.',8);
 if(type==='internal'&&state.comparison){newPage();text('Margin comparison | 1% to 50%',17,true);text('Same unit quantities and purchase cost: '+money(result.purchase)+'. Selling prices rounded per item.',9);for(let m=1;m<=50;m++){room(20);const r=calculateProject(data,state,m);draw(m+'% margin',42,y,10);draw('Sell '+money(r.sale),190,y,10);draw('Profit '+money(r.profit),390,y,10);y-=19}}
 const pages=doc.getPages();pages.forEach((p,i)=>{p.drawText(safe(state.quoteId)+' | '+(type==='internal'?'CONFIDENTIAL - INTERNAL ONLY':state.status),{x:42,y:30,size:8,font,color:muted});p.drawText('Page '+(i+1)+' of '+pages.length,{x:495,y:30,size:8,font,color:muted})});
 return doc.save();
}
