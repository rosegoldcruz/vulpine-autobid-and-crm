// Keep both workspaces mounted: switching views must not discard either draft.
const switcher=document.createElement('nav');
switcher.className='workspaceSwitch';switcher.setAttribute('aria-label','Pricing workspace');
switcher.innerHTML='<div role="group" aria-label="Choose workspace"><button type="button" id="pricingView" aria-pressed="true">Pricing</button><button type="button" id="studioView" aria-pressed="false" aria-controls="planStudio">Plan Studio</button></div><span id="studioStorageNote" hidden>Plans save on this device. Use Studio’s Export backup to keep a copy.</span>';
document.querySelector('.top').after(switcher);
const panel=document.createElement('section');panel.id='planStudio';panel.hidden=true;panel.setAttribute('aria-label','Plan Studio');
const frame=document.createElement('iframe');frame.title='Plan Measure Studio';frame.allow='fullscreen';panel.append(frame);switcher.after(panel);
const pricing=document.querySelector('.app'),totals=document.querySelector('.bar');
function showStudio(open){
 if(open&&!frame.hasAttribute('src'))frame.src='./studio/index.html';
 panel.hidden=!open;pricing.hidden=open;totals.hidden=open;
 document.body.classList.toggle('studioOpen',open);
 document.getElementById('pricingView').setAttribute('aria-pressed',String(!open));
 document.getElementById('studioView').setAttribute('aria-pressed',String(open));
 document.getElementById('studioStorageNote').hidden=!open;
}
document.getElementById('pricingView').onclick=()=>showStudio(false);
document.getElementById('studioView').onclick=()=>showStudio(true);
