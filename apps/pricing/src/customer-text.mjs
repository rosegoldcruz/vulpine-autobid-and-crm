// Customer documents identify Vulpine, never the upstream cabinet supplier.
export function customerText(value,data={}){
 let text=String(value??'');
 const names=['Highland Cabinetry Colorado','Highland Cabinetry','Highland','HCI','Rythern','U.S. Cabinet Depot','US Cabinet Depot','USCD',data.label].filter(Boolean).sort((a,b)=>b.length-a.length);
 for(const name of names)text=text.replace(new RegExp('\\b'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),'');
 return text.replace(/ {2,}/g,' ').trim();
}
