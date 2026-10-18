import {quoteDates} from './pricing.mjs';
export function newQuote(now=new Date(),id=()=>crypto.randomUUID()) {
 return {version:2,pricingPolicy:2,projectInfo:{apartments:0,mixEvidence:'',cabinetLine:'',finishBasis:'',addressEvidence:''},supplier:'hci',finish:0,project:'',status:'Tentative',quoteId:'VP-'+quoteDates(now).date.replaceAll('-','')+'-'+id().slice(0,8).toUpperCase(),...quoteDates(now),customer:'',email:'',preparedBy:'Daniel Cruz',notes:'',margin:20,comparison:false,tax:{enabled:true,address:{street:'',city:'',state:'',zip:''},lookup:null},units:[{id:id(),name:'Unit 01',repeat:1,auto:true,defaultLi:0,items:[]}]};
}
