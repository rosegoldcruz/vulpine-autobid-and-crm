import type { PlatformModuleId } from "./platform-modules"
export type OperationRecord = {id:string; title:string; status:string; source:string; details:Record<string,unknown>; href?:string}
export type OperationsData = {records:OperationRecord[]; metrics:{label:string;value:string|number|null}[]; warnings:string[]; sources:{name:string;status:string;count?:number;message?:string}[]; links:{label:string;href:string}[]; checkedAt:string; canWrite?:boolean}
export const editableModules = new Set<PlatformModuleId>(["projects","leads","contacts","companies","opportunities","emailblaster","sops","intelligence","fox"])
export async function operationsRequest(module:PlatformModuleId,method="GET",body?:unknown,query=""):Promise<OperationsData> {
  const r=await fetch(`/api/operations/${module}${query?`?q=${encodeURIComponent(query)}`:""}`,{method,headers:body?{"content-type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,cache:"no-store"})
  const d=await r.json().catch(()=>null)
  if(!r.ok)throw new Error(d?.error?.message||d?.error||`Request failed (${r.status}).`)
  return d.data??d
}
export function csvValue(value:unknown) {
  let text=typeof value==="object"?JSON.stringify(value):String(value??"")
  if(/^[=+@\-\t\r]/.test(text))text=`'${text}`
  return `"${text.replaceAll('"','""')}"`
}
export function parseCsv(text:string):Record<string,string>[] {
  const rows:string[][]=[];let current:string[]=[],cell="",quoted=false
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===","&&!quoted){current.push(cell);cell=""}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;current.push(cell);if(current.some(Boolean))rows.push(current);current=[];cell=""}else cell+=c}
  if(quoted)throw new Error("Unclosed CSV quote.")
  current.push(cell);if(current.some(Boolean))rows.push(current)
  const keys=rows.shift()?.map(k=>k.trim())||[]
  if(!keys.includes("title"))throw new Error("CSV needs a title column.")
  return rows.map(values=>Object.fromEntries(keys.map((k,i)=>[k,values[i]||""])))
}
