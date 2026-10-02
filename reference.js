/* Immutable maximum-capacity reference. No unit-fit assumptions or design moves. */
(function(root){'use strict';
const R=root.RULES,E=root.ENV,D=root.DRAW,fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('en-CA',{maximumFractionDigits:d}):'—';
function compute(site,I){
 I={...I,regime:'now'};
 const toa=R.toaOf(site),trig={bmrInToa:I.bmr&&(I.toaOverride==null?toa.toa:I.toaOverride),social:I.social},fsr=R.fsr(site,I.tenure,trig),H=R.height(trig);
 const fail=message=>({fail:message,fsr,H,mass:{ok:false,error:message}});
 if(fsr.fsr==null)return fail(fsr.steps[0]);
 if(![I.ftfRes,I.ftfComm,I.roofAllow].every(Number.isFinite)||I.ftfRes<=0||I.ftfComm<=0||I.roofAllow<0||!Number.isInteger(I.storeyCap)||I.storeyCap<0)return fail('Enter positive floor heights, a non-negative roof allowance, and a whole-number storey cap.');
 const nHeight=I.commGF?Math.floor((H.m-I.roofAllow-I.ftfComm)/I.ftfRes)+1:Math.floor((H.m-I.roofAllow)/I.ftfRes);
 const N=Math.min(12,I.storeyCap||12,nHeight);if(N<1)return fail('No storey fits the entered height assumptions.');
 const Env=E.envelope(site,I.regime,N);if(Env.error)return fail(Env.error);
 const off=Object.fromEntries(Object.entries(root.MASS.moves).map(([k,v])=>[k,{...v,on:false}]));
 const envelopePlates=E.plates(Env,N,I.ftfRes,I.commGF?I.ftfComm:null,off),FAp=fsr.fsr*site.area,envGross=envelopePlates.reduce((s,p)=>s+p.area,0);
 let plates=envelopePlates.map(p=>({...p,poly:p.poly.map(q=>q.slice())})),fit=null;
 // Preserve the maximum selected storey count and pull the rear face forward.
 if(envGross>FAp){let lo=Env.yMin,hi=Env.yMax;for(let i=0;i<55;i++){const y=(lo+hi)/2,poly=E.clipHalf(Env.env,[0,y],0,1,0);if(Math.abs(D.area(poly))*N>FAp)hi=y;else lo=y;}
  plates=plates.map(p=>{const poly=E.clipHalf(p.poly,[0,lo],0,1,0),area=Math.abs(D.area(poly));return {...p,poly,area,net:area};});fit={mode:'depth',depthDrawn:lo-Env.yMin,removed:envGross-FAp,dropped:0,partialTop:false};
 }
 // Typical floor plate: the user may take less than the envelope allows; the rear face comes forward on every storey.
 const typ=Math.min(1,N-1),plateMax=envelopePlates[typ].area;
 if(I.plateTarget>0&&plates[typ].area>I.plateTarget+.5){let lo=Env.yMin,hi=Env.yMax;const ref=plates[typ].poly;for(let i=0;i<55;i++){const y=(lo+hi)/2,a=Math.abs(D.area(E.clipHalf(ref,[0,y],0,1,0)));if(a>I.plateTarget)hi=y;else lo=y;}plates=plates.map(p=>{const poly=E.clipHalf(p.poly,[0,lo],0,1,0),area=Math.abs(D.area(poly));return {...p,poly,area,net:area};});fit={...(fit||{}),mode:'plate',plateTarget:I.plateTarget};}
 const G=plates.reduce((s,p)=>s+p.net,0),usedH=plates.at(-1).z1+I.roofAllow;
 const mass={ok:true,Env,N,H,roofAllowance:I.roofAllow,plates,footprint:plates[0].net,gross:G,startGross:envGross,costs:[],rearStoreys:N,typicalPlate:plates[Math.min(1,N-1)].area,typicalPoly:plates[Math.min(1,N-1)].poly,fit,ghost:fit?{plates:envelopePlates,N}:null,balcony:null};
 return {fail:null,mass,fsr,H,N,nByHeight:nHeight,plateMax,plateTypical:plates[typ].area,usedH,FAp,G,countable:G,fsrUsed:G/site.area,utilization:FAp?G/FAp:0,envGross,footprint:mass.footprint,binding:envGross>FAp?'density':'envelope',mixReq:R.FA[I.regime].mix(site.zone,I.tenure),toa};
}
// Massing has two linked parameters. Storeys set the plate (largest that fits the envelope and the permitted area);
// a plate sets the storeys (as many as the permitted area allows, up to the height limit). A request beyond either
// limit is flagged and drawn at the limit, never as impossible geometry.
let ask={n:null,p:null};const cfgCache={key:null,list:null};
function configurations(site,I,r){const key=JSON.stringify([site.ids,{...I,storeyCap:0,plateTarget:0,massingConfirmed:0}]);if(cfgCache.key===key)return cfgCache.list;const list=[];
 for(let n=1;n<=Math.min(12,r.nByHeight||1);n++){const q=compute(site,{...I,storeyCap:n,plateTarget:0});if(!q.fail)list.push({n:q.N,plate:q.plateTypical,total:q.G,fsr:q.fsrUsed,max:q.plateMax});}
 cfgCache.key=key;cfgCache.list=list;return list;}
// Below about 280 m² a floor cannot plan well: two exit stairs, a lift and the corridor between them take 50–70 m², leaving
// room for one or two homes. On a lower-density site the height limit spreads the permitted area that thin, so the most storeys
// that still give a workable plate is recommended instead.
const PLATE_MIN=280;
// Compared against the default massing: the most storeys the height limit allows, up to six.
function recommend(site,I){const r=compute(site,{...I,storeyCap:6,plateTarget:0});if(!r||r.fail)return null;const list=configurations(site,I,r).filter(c=>c.n<=r.N),top=list.at(-1);if(!top||top.plate>=PLATE_MIN)return null;
 // only worth it when fewer storeys really buys plate: an envelope-capped plate stays the same size however low it goes
 const gain=list.filter(c=>c.n<top.n&&c.plate>=top.plate*1.15),pick=gain.filter(c=>c.plate>=PLATE_MIN).at(-1)||gain.at(-1);return pick&&pick.n>=2?{n:pick.n,plate:pick.plate,top:top.n,topPlate:top.plate,min:PLATE_MIN}:null;}
const advice=rc=>`At ${rc.top} storeys each floor is about ${fmt(rc.topPlate,0)} m²: two exit stairs, a lift and a corridor leave room for only one or two homes. ${rc.n} storeys gives about ${fmt(rc.plate,0)} m² per floor.`;
const figs=r=>[['Storeys',String(r.N)],['Floor plate',fmt(r.plateTypical,0)+' m²'],['Total floor area',fmt(r.G,0)+' m²'],['FSR',`${fmt(r.fsrUsed,2)} / ${fmt(r.fsr.fsr,2)}`]];
function capState(site,I,r){const c=I.massingConfirmed;if(!c||c.site!==JSON.stringify(site.ids))return 'todo';return c.N===r.N&&Math.abs(c.P-r.plateTypical)<1?'done':'stale';}
function confirmMassing(site,I,r){I.massingConfirmed={N:r.N,P:r.plateTypical,t:Date.now(),site:JSON.stringify(site.ids)};ask={n:null,p:null};root.APP.showTab('massing');}
function liveBox(site,I,r){const box=document.createElement('div');box.className='ref-live';const list=configurations(site,I,r),rc=recommend(site,I),pMax=Math.ceil(Math.max(r.plateMax,...list.map(c=>c.max))/5)*5;
 box.innerHTML=`<section><h3>Massing</h3>
  <div class="ref-pair"><label for="ref-n">Number of storeys</label><input type="range" data-m="n" min="1" max="12" step="1" value="${r.N}" aria-label="Number of storeys"><input id="ref-n" type="number" data-m="n" min="1" max="12" step="1" value="${r.N}"></div>
  <div class="ref-pair"><label for="ref-p">Floor plate area · m²</label><input type="range" data-m="p" min="40" max="${pMax}" step="5" value="${Math.round(r.plateTypical)}" aria-label="Floor plate area"><input id="ref-p" type="number" data-m="p" min="40" step="5" value="${Math.round(r.plateTypical)}"></div>
  <p class="ref-total" data-out="total"></p><p class="ref-flag" data-out="flag" role="status" hidden></p></section>
  <section><h3>Possible configurations</h3><div class="ref-configs"><div class="ref-cfg-head" aria-hidden="true"><span>Storeys</span><span>Plate</span><span>Total</span><span>FSR</span></div>${list.map(c=>`<button data-cfg="${c.n}" aria-pressed="false"${rc&&rc.n===c.n?' class="ref-rec" title="Recommended"':''}><b>${c.n}${rc&&rc.n===c.n?' <small>Rec.</small>':''}</b><span>${fmt(c.plate,0)} m²</span><span>${fmt(c.total,0)} m²</span><span>${fmt(c.fsr,2)}</span></button>`).join('')}</div>
  ${rc?`<p class="ref-advice">${advice(rc)}</p>`:''}<p class="ex-note">Each row is the largest plate that fits the envelope and the permitted area at that height. Pick one, or set a smaller plate above.</p></section>`;
 bindLive(box,site,I);syncLive(box,r,I);return box;}
function syncLive(box,r,I){if(!box||r.fail)return;const act=document.activeElement,q=s=>box.querySelector(s);
 box.querySelectorAll('[data-m="n"]').forEach(el=>{if(el!==act)el.value=ask.n??r.N;});box.querySelectorAll('[data-m="p"]').forEach(el=>{if(el!==act)el.value=Math.round(ask.p??r.plateTypical);});
 const top=r.mass.plates.at(-1).z1;q('[data-out="total"]').innerHTML=`<b>${r.N}</b> storeys × <b>${fmt(r.plateTypical,0)}</b> m² = <b>${fmt(r.G,0)}</b> m² of ${fmt(r.FAp,0)} m² permitted · ${top.toFixed(1)} m drawn${I.roofAllow?` + ${I.roofAllow.toFixed(1)} m roof allowance = ${(top+I.roofAllow).toFixed(1)} m height`:` height`}`;
 const flags=[];if(ask.n!=null&&ask.n>r.nByHeight)flags.push(`${ask.n} storeys is outside the maximum: the height limit allows ${r.nByHeight}. Shown at ${r.N}.`);
 if(ask.p!=null&&ask.p>r.FAp)flags.push(`${fmt(ask.p,0)} m² on one storey is outside the maximum: the permitted area is ${fmt(r.FAp,0)} m².`);
 else if(ask.p!=null&&ask.p>r.plateTypical+2)flags.push(`${fmt(ask.p,0)} m² is outside the maximum: at ${r.N} storeys the envelope and permitted area allow ${fmt(r.plateTypical,0)} m² per floor. Shown at that size.`);
 const f=q('[data-out="flag"]');f.hidden=!flags.length;f.textContent=flags.join(' ');
 box.querySelectorAll('[data-cfg]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.cfg===r.N&&!(I.plateTarget>0&&r.mass.fit?.mode==='plate'))));}
function bindLive(box,site,I){
 const apply=(k,v,commit)=>{if(!Number.isFinite(v))return;if(k==='n'){v=Math.max(1,Math.round(v));ask={n:v,p:null};I.storeyCap=Math.min(12,v);I.plateTarget=0;}
  else{v=Math.max(1,v);ask={n:null,p:v};const r0=compute(site,{...I,storeyCap:0,plateTarget:0}),nH=Math.min(12,r0.nByHeight||1);I.storeyCap=Math.max(1,Math.min(nH,Math.floor((r0.FAp||0)/v+1e-6)));I.plateTarget=v;}
  box.querySelectorAll(`[data-m="${k}"]`).forEach(el=>{if(el!==document.activeElement)el.value=v;});
  if(commit)root.APP.refresh();else render(site,I,compute(site,I),true);};
 box.querySelectorAll('[data-m]').forEach(el=>{el.oninput=()=>{if(el.value!=='')apply(el.dataset.m,+el.value,false);};el.onchange=()=>{if(el.value!=='')apply(el.dataset.m,+el.value,true);};});
 box.querySelectorAll('[data-cfg]').forEach(b=>b.onclick=()=>{ask={n:null,p:null};I.storeyCap=+b.dataset.cfg;I.plateTarget=0;root.APP.refresh();});}
const surroundings=r=>root.SITE_CONTEXT?.on&&r.mass?.Env?.fr?root.SITE_CONTEXT.near(r.mass.Env.fr,r.mass.Env.fr.local):null;
// While dragging, only the drawings' contents and the figures change, so the controls keep the pointer.
function redraw(site,I,r){const swap=(id,svg)=>{const old=document.getElementById(id)?.querySelector('.ex-canvas svg');if(old)old.innerHTML=svg.innerHTML;};
 swap('ref-axon',root.MASS.drawMassing({...r.mass,roofAllowance:0,roofNote:I.roofAllow},{label:'maximum reference',context:surroundings(r)}));swap('ref-section',root.MASS.drawSection(r.mass,site,I));}
function render(site,I,r,keep){
 const $=id=>document.getElementById(id),esc=root.EXPLORE_DRAW.esc,SH=root.WORKSPACE_SHELL,shell=!!SH&&SH.isOn(),field=(id,label,value,step)=>`<label class="ex-field">${label}<input data-reference="${id}" type="number" value="${value}" step="${step}" min="0"></label>`;
 if(keep&&!r.fail){const box=document.querySelector('.ref-live');if(box&&$('ref-axon')){redraw(site,I,r);syncLive(box,r,I);SH?.figures(figs(r));return;}}
 $('reference-tab').innerHTML=`<h2 class="ex-title">Reference assumptions</h2><p class="ex-note">Independent of your design edits. Maximum under the selected encoded rules, yard standards and entered height assumptions; not a VBBL-approved building.</p>
 <p class="ex-status">Current encoded zoning rules · building code: ${esc(window.RULES?.VBBL?.source||"VBBL")}. One active rule set; later-dated amendments are not selectable. Verify project applicability with the linked City sources.</p>
 <label class="ex-field">Tenure<select data-reference="tenure"><option value="rental" ${I.tenure==='rental'?'selected':''}>100% rental</option><option value="other" ${I.tenure==='other'?'selected':''}>Strata / other</option></select></label>
 <label class="ex-field">TOA status<select data-reference="toaOverride"><option value="auto" ${I.toaOverride==null?'selected':''}>Station-distance estimate</option><option value="yes" ${I.toaOverride===true?'selected':''}>Confirmed in TOA</option><option value="no" ${I.toaOverride===false?'selected':''}>Confirmed outside TOA</option></select></label>
 ${[['bmr','20% below-market rental'],['social','100% social housing'],['commGF','Commercial ground floor']].map(([key,label])=>`<label class="ex-check"><input data-reference="${key}" type="checkbox" ${I[key]?'checked':''}>${label}</label>`).join('')}
 <div class="ref-live-slot"></div>${field('ftfRes','Residential floor-to-floor · m',I.ftfRes,.1)}${field('ftfComm','Commercial floor-to-floor · m',I.ftfComm,.1)}${field('roofAllow','Roof allowance · m (counted in height; shown on the section only)',I.roofAllow,.1)}
 <p class="ex-note">FSR utilization = reference countable area ÷ permitted area. Residential net-to-enclosed efficiency is calculated later, from a unit plan. No area exclusions are claimed here or in the design, so countable area equals gross floor area. The site estimate on step 1 shows the exclusions the by-law would allow.</p><button id="ref-design" class="btn">Continue to plan setup →</button>`;
 $('reference-tab').querySelectorAll('[data-reference]').forEach(el=>el.onchange=()=>{const k=el.dataset.reference;I[k]=k==='toaOverride'?el.value==='auto'?null:el.value==='yes':el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:+el.value;root.APP.refresh();});
 $('ref-design').onclick=()=>{if(!r.fail)confirmMassing(site,I,r);};
 if(r.fail){SH?.hide();$('u-stage').innerHTML=`<div class="ex-empty"><h2>No massing for this site</h2><p>${esc(r.fail)}</p></div>`;return;}
 const metric=(label,value,note)=>`<div class="ex-metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
 $('u-stage').innerHTML=`<div class="ex-top"><div><span class="ex-eyebrow">01 / MASSING · ZONING CAPACITY REFERENCE</span><h1>Maximum massing<span class="ex-version"> / before design moves</span></h1></div></div>
 <div class="ex-metrics">${metric('PERMITTED FSR',fmt(r.fsr.fsr,2),esc(r.fsr.clause))}${metric('REFERENCE FSR',fmt(r.fsrUsed,2),`${fmt(r.utilization*100,1)}% of density used`)}${metric('OVERALL HEIGHT',fmt(r.usedH)+' m',`${r.N} storeys · ${fmt(r.H.m)} m zoning ceiling`)}${metric('COUNTABLE AREA',fmt(r.countable,0)+' m²','No area exclusions claimed')}</div>
 <p class="ex-caption">${esc(site.addr)} · ${esc(site.zone)} · ${fmt(site.area)} m² site. ${r.binding==='density'?'Density controls the solid mass; dashed outline shows the larger yard-and-height envelope.':'The selected yard-and-height envelope limits the reference before all density can be used.'}</p>
 ${root.WORKSPACE_VIEW.toolbar('Focus section')}<div class="ref-drawings" data-workspace="reference"><div id="ref-plan" class="ex-plan"></div><div id="ref-section" class="ex-plan"></div><div id="ref-axon" class="ex-side"></div></div>
 <div class="ex-bottom"><section><h2 class="ex-title">Transparent arithmetic</h2><table class="ex-table"><tbody><tr><td>Permitted countable area</td><td>${fmt(r.fsr.fsr,2)} × ${fmt(site.area,2)} = ${fmt(r.FAp,2)} m²</td></tr><tr><td>Reference FSR</td><td>${fmt(r.countable,2)} ÷ ${fmt(site.area,2)} = ${fmt(r.fsrUsed,3)}</td></tr><tr><td>Density utilization</td><td>${fmt(r.countable,2)} ÷ ${fmt(r.FAp,2)} = ${fmt(r.utilization*100,1)}%</td></tr><tr><td>Height</td><td>${I.commGF?`${fmt(I.ftfComm)} + ${r.N-1} × ${fmt(I.ftfRes)}`:`${r.N} × ${fmt(I.ftfRes)}`} + ${fmt(I.roofAllow)} = ${fmt(r.usedH)} m</td></tr></tbody></table></section>
 <section><h2 class="ex-title">Zoning ≠ building-code approval</h2><p class="ex-note">Height, FSR and yards use the project's encoded zoning scenario. Rear yards include its guideline-standard assumptions. Confirm those values and the effective amendments against the applicable schedule. No VBBL exit strategy has been selected here.</p><p class="ex-note">Construction type, fire protection, exit count and independence, stair geometry, accessibility, discharge and in-unit travel remain unverified. The next tab tests spatial possibilities, not permission to build.</p><p class="ex-note"><a href="https://vancouver.ca/your-government/zoning-development-bylaw.aspx" target="_blank" rel="noopener">City zoning schedules</a> · <a href="https://vancouver.ca/your-government/vancouver-building-bylaw.aspx" target="_blank" rel="noopener">City VBBL source</a> · <a href="service-guidance.html" target="_blank">Service guidance</a></p></section></div>`;
 $('reference-tab').querySelectorAll(':scope > .u-schedule').forEach(n=>n.remove());
 {const mm=$('u-stage').querySelector('.ex-metrics');if(mm){const slot=document.createElement('div');slot.className='u-schedule';const eye=$('u-stage').querySelector('.ex-top .ex-eyebrow');if(eye){const cell=document.createElement('div');cell.className='tb-sheet';cell.appendChild(eye);const proj=document.createElement('span');proj.className='tb-project';proj.textContent=($('v-addr')?.textContent||'').trim();cell.appendChild(proj);slot.appendChild(cell);}slot.appendChild(mm);$('reference-tab').prepend(slot);}}
 const massing=()=>root.MASS.drawMassing({...r.mass,roofAllowance:0,roofNote:I.roofAllow},{label:'maximum reference',context:surroundings(r),rot:orbit,orbit:true});
 $('ref-axon').innerHTML=root.WORKSPACE_VIEW.panel('reference-mass','Massing',massing().outerHTML);
 $('ref-plan').innerHTML=r.mass?.ok?root.WORKSPACE_VIEW.panel('reference-plan','Site plan',root.MASS.drawSitePlan({...r.mass,roofAllowance:0},site,I,{k:root.MASS.commonK(r.mass)}).outerHTML):'';
 $('ref-section').innerHTML=root.WORKSPACE_VIEW.panel('reference-section','Height section',root.MASS.drawSection(r.mass,site,I).outerHTML);
 root.WORKSPACE_VIEW.bind($('u-stage'));bindOrbit(massing);
 const box=liveBox(site,I,r),state=capState(site,I,r);
 if(shell){const st=root.UNITS_UI?.current?root.UNITS_UI.states():{};SH.render({step:'capacity',states:{...st,capacity:state},site:site.addr,views:[{id:'site',label:'Plan',node:$('ref-plan').querySelector('.ex-view')},{id:'plan',label:'Section',node:$('ref-section').querySelector('.ex-view')},{id:'massing',label:'3D',node:$('ref-axon').querySelector('.ex-view')}],split:['site','massing'],defaultView:'split',figures:figs(r),mode:box,more:$('reference-tab'),primary:{label:state==='stale'?'Confirm new massing →':'Continue to plan setup →',onClick:()=>confirmMassing(site,I,r),id:'ws-go'},secondary:[],status:`${site.zone} · ${fmt(site.area)} m² site · ${r.binding==='density'?'density controls the mass; dashed outline is the larger envelope':'the yard-and-height envelope controls the mass'}`});}
 else $('reference-tab').querySelector('.ref-live-slot').appendChild(box);
}
// Drag the massing sideways to orbit it (plan-oblique azimuth); double-click returns to the standard 30°.
let orbit=30;
function bindOrbit(draw){const canvas=document.getElementById('u-stage')?.querySelector('[data-view="reference-mass"] .ex-canvas');if(!canvas)return;const redraw=()=>{const svg=canvas.querySelector('svg');if(svg)svg.replaceChildren(...draw().childNodes);};
 canvas.style.cursor='grab';canvas.ondblclick=()=>{orbit=30;redraw();};
 canvas.onpointerdown=e=>{if(e.button!==0||canvas.dataset.pan==='true')return;e.preventDefault();const x0=e.clientX,a0=orbit,id=e.pointerId;canvas.style.cursor='grabbing';
  const move=v=>{if(v.pointerId!==id)return;orbit=a0-(v.clientX-x0)*.5;redraw();};
  const end=v=>{if(v.pointerId!==id)return;canvas.style.cursor='grab';window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);};}
root.REFERENCE={compute,render,recommend,advice,PLATE_MIN};
})(window);
