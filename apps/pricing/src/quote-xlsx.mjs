import {calculateProject, lookup, quoteDates} from './pricing.mjs';

// Export the live pricing snapshot, never the blank configurator or a second pricing engine.
export function createWorkbook(XLSX, data, input) {
  const state=structuredClone(input), result=calculateProject(data,state);
  if(result.issues.length)throw Error('Check the units before exporting: '+result.issues.join(' '));
  const book=XLSX.utils.book_new(), dates=quoteDates();
  book.Props={Title:state.project||'Cabinet purchase bid',Author:state.preparedBy||'Vulpine LLC',Company:'Vulpine LLC'};
  const summary=[['VULPINE LLC — PURCHASE BID'],[state.project||'Untitled project'],
    ['Quote',state.quoteId,'Date',dates.date,'Good until',dates.validUntil],
    ['Quantity status',state.status],[],
    ['Product / finish','Unit type','Qty','Unit price','Total','Total cabinets','Toe kicks','Check']];
  result.units.forEach((u,index)=>{
    const name=index===0?'Unit Type':`Unit Type (${index+1})`, ref="'"+name+"'";
    const rows=[[u.name],['Project',state.project||'Untitled project'],['Units',u.repeat],
      ['Purchase prices only; automatic toe kicks are included once.'],
      ['Item','SKU','Qty per unit','Description','Finish','Unit cost','Line total','Source'],
      ...u.entries.map((x,i)=>[i+1,x.sku,x.qty,x.description,x.line,x.purchase/100,x.purchase*x.qty/100,x.source])];
    const totalRow=rows.length+1;
    rows.push(['TOTAL PER UNIT','','','','','',u.purchase/100]);
    rows.push(['TOTAL FOR '+u.repeat+' UNITS','','','','','',u.purchase*u.repeat/100]);
    const sheet=XLSX.utils.aoa_to_sheet(rows);
    u.entries.forEach((x,i)=>{sheet['G'+(i+6)]={t:'n',f:`ROUND(C${i+6}*F${i+6},2)`,v:x.purchase*x.qty/100,z:'$#,##0.00'};});
    sheet['G'+totalRow]={t:'n',f:u.entries.length?`SUM(G6:G${totalRow-1})`:'0',v:u.purchase/100,z:'$#,##0.00'};
    sheet['G'+(totalRow+1)]={t:'n',f:`ROUND(G${totalRow}*B3,2)`,v:u.purchase*u.repeat/100,z:'$#,##0.00'};
    sheet['!cols']=[6,22,16,56,30,17,20,58].map(wch=>({wch}));
    sheet['!autofilter']={ref:`A5:H${Math.max(5,totalRow-1)}`};
    for(let row=6;row<totalRow;row++)sheet['F'+row].z='$#,##0.00';
    XLSX.utils.book_append_sheet(book,sheet,name);
    const r=summary.length+1;
    summary.push([[...new Set(u.entries.map(x=>x.line))].join(', '),u.name,u.repeat,
      {t:'n',f:`${ref}!G${totalRow}`,v:u.purchase/100,z:'$#,##0.00'},
      {t:'n',f:`ROUND(C${r}*D${r},2)`,v:u.purchase*u.repeat/100,z:'$#,##0.00'},
      data.countsVerified===false?'Not supplied':u.entries.reduce((n,x)=>n+(lookup(data,x.li,x.sku)?.[5]?x.qty*u.repeat:0),0),
      u.entries.filter(x=>x.sku==='TK8').reduce((n,x)=>n+x.qty*u.repeat,0),u.repeat===0?'Excluded':'Checked']);
  });
  const end=summary.length;
  summary.push(['TOTAL','',result.count,'',{t:'n',f:`SUM(E7:E${end})`,v:result.purchase/100,z:'$#,##0.00'}]);
  summary.push([],['Purchase cost snapshot. Selling prices and profit are not included.'],['Internal supplier-cost worksheet. Customer handles/freight charges and sales tax are separate from supplier cost. Installation and assembly excluded unless expressly priced.']);
  if(state.tax?.enabled)summary.push(['Project tax location',state.tax.address.city+', '+state.tax.address.state],['Customer sales tax rate (not supplier purchase tax)',state.tax.lookup.rate],['Tax source',state.tax.lookup.provider],['Tax lookup date',state.tax.lookup.retrievedAt]);
  if(data.source)summary.push(['Supplier',data.label],['Price basis',data.source.basis],['Source workbook',data.source.file],['Source SHA-256',data.source.sha256]);
  const sheet=XLSX.utils.aoa_to_sheet(summary);
  sheet['!cols']=[42,28,12,18,22,18,16,18].map(wch=>({wch}));
  XLSX.utils.book_append_sheet(book,sheet,'Summary Sheet');
  book.SheetNames=['Summary Sheet',...book.SheetNames.filter(x=>x!=='Summary Sheet')];
  return book;
}

export function exportWorkbook(XLSX,data,state){
  const book=createWorkbook(XLSX,data,state);
  const filename=((state.quoteId||'Vulpine')+'_'+(state.project||'Project')+'_Purchase_Bid').replace(/[^a-z0-9_-]/gi,'_')+'.xlsx';
  XLSX.writeFile(book,filename,{bookType:'xlsx',compression:true});
}
