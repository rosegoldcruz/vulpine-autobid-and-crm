import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import {BidError} from './schemas.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function prepareSource(input){
 let text=input.text,sha256=text?hash(text):null;
 if(input.pdf_base64){
  const bytes=Buffer.from(input.pdf_base64,'base64');if(bytes.length>2097152||bytes.subarray(0,5).toString()!=='%PDF-')throw new BidError('INVALID_INPUT','Upload a PDF schedule smaller than 2 MB.');
  sha256=hash(bytes);const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vulpine-plan-'));
  try{const file=path.join(dir,'schedule.pdf');await fs.writeFile(file,bytes,{mode:0o600});const result=await promisify(execFile)('/usr/bin/pdftotext',['-layout','-nopgbrk',file,'-'],{timeout:20000,maxBuffer:1200000});text=result.stdout.trim();}
  catch{throw new BidError('INVALID_INPUT','The PDF text could not be extracted. Upload its schedule as text.');}
  finally{await fs.rm(dir,{recursive:true,force:true});}
  if(!text)throw new BidError('REVIEW_REQUIRED','This PDF has no extractable text. Upload the schedule as text; scanned drawings require a human takeoff.');
  if(text.length>300000)throw new BidError('INVALID_INPUT','Upload only the relevant schedule pages.');
 }
 return{id:randomUUID(),kind:'plan',name:input.name,text,sha256};
}
