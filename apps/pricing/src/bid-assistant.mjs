export function mountBidAssistant({currentJob,flush}){
 const panel=document.createElement('details');panel.className='bidAssistant';
 panel.innerHTML=`<summary>Auto Bid <small>Powered by AEON</small></summary><div class="assistantBody"><p>Enter units and exact SKUs. Prices come from your selected supplier catalog.</p><div class="assistantFields"><label>Project name<input id="agentProject" maxlength="120"></label><label>Supplier<select id="agentSupplier"><option value="hci">HCI Colorado</option><option value="rythern">Rythern · DDP</option><option value="uscd">U.S. Cabinet Depot</option></select></label></div><label>Instructions<textarea id="agentInstruction" rows="4" placeholder="Include unit names, counts, SKUs, quantities and finish. Missing information will be flagged for review."></textarea></label><label>Schedule or plans (PDF or text)<input id="agentFile" type="file" accept=".pdf,.txt,.csv"></label><div class="assistantActions"><button type="button" id="agentStart" class="primary">${currentJob?'Update this bid':'Create bid draft'}</button><button type="button" id="agentRefresh" class="secondary">Refresh saved bids</button></div><div id="agentProgress" role="status" aria-live="polite"></div><div id="agentDownloads"></div><div id="agentJobs"></div><p class="hint">Drafts require human review. This assistant cannot send proposals or place orders.</p></div>`;
 document.querySelector('.projectBar').before(panel);
 const el=id=>panel.querySelector('#'+id);
 const request=async(path,method='GET',body)=>{const r=await fetch('./agent/'+path,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'}),v=await r.json();if(!r.ok)throw Error(v.error?.message||v.error||'Request failed.');return v;};
 const tool=async(name,args)=>{const v=await request('tools','POST',{name,arguments:args});if(!v.ok)throw Error(v.error.message);return v.data;};
 const link=(job,text)=>{const a=document.createElement('a');a.href='./index.html?bid='+encodeURIComponent(job.id);a.textContent=text;return a;};
 async function refresh(){const value=await request('jobs');el('agentJobs').replaceChildren();for(const j of value.jobs){const row=document.createElement('p');row.append(link(j,j.project+' · '+j.supplier+' · '+(j.saved?'Saved':'In progress')));el('agentJobs').append(row);}}
 el('agentRefresh').onclick=()=>refresh().catch(e=>el('agentProgress').textContent=e.message);
 el('agentStart').onclick=async()=>{
  el('agentStart').disabled=true;el('agentDownloads').replaceChildren();
  try{
   await flush();const instruction=el('agentInstruction').value.trim();if(!instruction)throw Error('Enter bidding instructions first.');
   let j=currentJob?await request('jobs/'+currentJob.id):await tool('create_bid_job',{project:el('agentProject').value.trim(),supplier:el('agentSupplier').value,instruction});
   const file=el('agentFile').files[0];
   if(file){
    if(file.size>2*1024*1024)throw Error('Upload a schedule PDF smaller than 2 MB, or export its schedule as text.');
    let value;
    if(file.name.toLowerCase().endsWith('.pdf')){const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));value={pdf_base64:btoa(binary)};}
    else value={text:await file.text()};
    j=await request('sources/'+j.id,'POST',{expected_revision:j.revision,name:file.name,...value});
   }
   const run=await request('runs','POST',{job_id:j.id,expected_revision:j.revision,instruction});
   sessionStorage.setItem('vulpine-agent-run',run.id);await poll(run.id);
  }catch(e){el('agentProgress').textContent=e.message;el('agentStart').disabled=false;}
 };
 async function poll(runId){
  const run=await request('runs/'+runId);el('agentProgress').textContent=(run.payload.events.at(-1)?.message||run.status)+(run.payload.message?'\n'+run.payload.message:'');
  if(['queued','running'].includes(run.status)){setTimeout(()=>poll(runId).catch(e=>{el('agentProgress').textContent=e.message;el('agentStart').disabled=false;}),2000);return;}
  sessionStorage.removeItem('vulpine-agent-run');el('agentStart').disabled=false;
  el('agentDownloads').replaceChildren(link({id:run.job_id},'Open draft in Pricing'));
  for(const file of run.payload.exports||[]){const a=document.createElement('a');a.href=file.url;a.textContent=file.filename;a.rel='noreferrer';el('agentDownloads').append(a);}
  await refresh();
 }
 if(currentJob){
  el('agentProject').value=currentJob.state.project;el('agentSupplier').value=currentJob.state.supplier;el('agentProject').disabled=el('agentSupplier').disabled=true;
  const review=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Review source evidence and exceptions';review.append(summary);
  for(const message of currentJob.exceptions){const p=document.createElement('p');p.textContent=message;review.append(p);}
  for(const proof of currentJob.provenance){const p=document.createElement('p'),unit=currentJob.state.units.find(u=>u.id===proof.unit_id);p.textContent=(unit?.name||'Unit')+' / '+(proof.sku||'Unit count')+': '+proof.evidence.quote;review.append(p);}
  const approve=document.createElement('button');approve.type='button';approve.className='secondary';approve.textContent='I reviewed the source quantities';approve.onclick=async()=>{try{await flush();const j=await request('jobs/'+currentJob.id);await request('jobs/'+j.id,'PUT',{expected_revision:j.revision,state:j.state,reviewed:true});location.reload();}catch(e){el('agentProgress').textContent=e.message;}};
  review.append(approve);panel.querySelector('.assistantBody').append(review);
 }
 panel.addEventListener('toggle',()=>{if(panel.open)refresh().catch(e=>el('agentProgress').textContent=e.message);});
 const pending=sessionStorage.getItem('vulpine-agent-run');if(pending){panel.open=true;el('agentStart').disabled=true;poll(pending).catch(e=>{el('agentProgress').textContent=e.message;el('agentStart').disabled=false;});}
}
