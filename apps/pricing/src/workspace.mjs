export function mountWorkspace({flush,startQuote,getReference,onArchive,onError}){
 const sidebar=document.createElement('aside');sidebar.className='projectSidebar';sidebar.setAttribute('aria-label','Project workspace');
 const toggle=document.createElement('button');toggle.className='workspaceToggle secondary';toggle.textContent='☰ Projects';toggle.setAttribute('aria-expanded','true');
 document.querySelector('.topRight').prepend(toggle);document.body.append(sidebar);document.body.classList.add('workspaceOpen');
 toggle.onclick=()=>{const open=document.body.classList.toggle('workspaceOpen');toggle.setAttribute('aria-expanded',String(open));};
 if(matchMedia('(max-width: 900px)').matches)toggle.click();
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){onError(e);}finally{b.disabled=false;}};return b;};
 async function action(name,action){const r=await fetch('./export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({format:'project-action',name,action})});const result=await r.json();if(!r.ok)throw Error(result.error);return result;}
 async function refresh(){
  const r=await fetch('./projects',{cache:'no-store'});if(!r.ok)throw Error('Project history could not load. Your current quote is retained.');const data=await r.json();
  sidebar.replaceChildren();const title=document.createElement('h2');title.textContent='Projects';sidebar.append(title);
  const hint=document.createElement('p');hint.textContent='Shared with your Vulpine team. Quotes and documents stay here.';sidebar.append(hint);
  const projectName=document.createElement('input');projectName.placeholder='New project name';projectName.maxLength=120;projectName.setAttribute('aria-label','New project name');sidebar.append(projectName);
  sidebar.append(button('+ New project',async()=>{const name=projectName.value;if(!name.trim()){projectName.focus();return;}await flush();await action(name,'create');await startQuote(name.trim());}));
  sidebar.append(button('Refresh history',refresh));
  const search=document.createElement('input');search.type='search';search.placeholder='Find a project';search.setAttribute('aria-label','Find a project');sidebar.append(search);
  const list=document.createElement('div');sidebar.append(list);
  const draw=()=>{list.replaceChildren();for(const p of data.projects.filter(p=>!p.deleted_at&&p.name.toLowerCase().includes(search.value.toLowerCase()))){
   const group=document.createElement('details');group.open=data.quotes.some(q=>q.project_key===p.project_key&&q.id===getReference()?.id);
   const summary=document.createElement('summary');summary.textContent=p.name;group.append(summary);
   group.append(button('+ New quote',()=>startQuote(p.name)));
   for(const q of data.quotes.filter(q=>q.project_key===p.project_key)){
    const row=document.createElement('div');row.className='historyQuote';
    row.append(button((q.id===getReference()?.id?'● ':'')+(q.quote_number||'Draft')+' · '+(q.supplier||'hci').toUpperCase(),async()=>{await flush();location.assign('./index.html?quote='+q.id);}));
    const date=document.createElement('small');date.textContent=new Date(q.updated_at).toLocaleString();row.append(date);
    row.append(button('Saved PDFs & Excel',async()=>{const r=await fetch('./quotes/'+q.id);if(!r.ok)throw Error('Documents could not load.');const saved=await r.json();const docs=document.createElement('div');docs.className='savedDocuments';for(const d of saved.exports){const a=document.createElement('a');a.href='./documents/'+d.id;a.target='_blank';a.rel='noopener';a.textContent=d.type+' '+d.format.toUpperCase()+' · '+new Date(d.created_at).toLocaleString();docs.append(a);}if(!saved.exports.length)docs.textContent='Generate a PDF or Excel file to save it here.';row.querySelector('.savedDocuments')?.remove();row.append(docs);}));group.append(row);
   }
   group.append(button('Move project to Trash',async()=>{await flush();await action(p.name,'delete');if(data.quotes.some(q=>q.project_key===p.project_key&&q.id===getReference()?.id))onArchive(true);await refresh();}));list.append(group);
  }};search.oninput=draw;draw();
  const trash=document.createElement('details');const label=document.createElement('summary');label.textContent='Trash';trash.append(label);for(const p of data.projects.filter(p=>p.deleted_at))trash.append(button('Restore '+p.name,async()=>{await action(p.name,'restore');onArchive(false);await refresh();}));sidebar.append(trash);
 }
 // Preserve the existing draft in history before listing projects for the first time.
 flush().then(refresh).catch(onError);
}
