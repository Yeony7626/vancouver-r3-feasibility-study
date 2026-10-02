/* Review report: code summary (zoning and VBBL Part 3), exit distances per unit, the unit matrix as edited, and the R3
   unit-mix check. Every limit comes from RULES (zoning) or RULES.VBBL (building code) with its clause. Checks are
   schematic: they read the drawn plan, not construction documents. */
(function(root){'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('en-CA',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
const pct=v=>Number.isFinite(v)?(v*100).toFixed(1).replace(/\.0$/,'')+'%':'—';
const STATUS={pass:'Meets',fail:'Does not meet',verify:'Verify',info:'Note'};
const badge=s=>`<span class="rv-status rv-${s}">${STATUS[s]}</span>`;
const TYPES=['S','1B','2B','3B'];
const table=(head,body)=>`<table class="rv-table"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;

// Height from the first-storey floor to the uppermost floor level, as VBBL 2025 3.2.2.51 and 3.2.2.48 measure it.
function upperFloor(o){return o.commercial?(o.floors>1?o.groundFtf+(o.floors-2)*o.ftf:0):(o.floors-1)*o.ftf;}
function buildingArea(r){return Math.max(0,...(r.levels||[]).map(l=>(l.g?.built||[]).reduce((s,b)=>s+b.w*b.h,0)));}
function construction(o,r,sprinklered){const V=root.RULES.VBBL,N=o.floors,A=buildingArea(r),H=upperFloor(o);
 if(!sprinklered)return N<=3?{status:'verify',value:`Not sprinklered, ${N} storeys`,note:'Unsprinklered Group C options (3.2.2.50, 3.2.2.53, 3.2.2.54) are not encoded here.'}:{status:'fail',value:`Not sprinklered, ${N} storeys`,note:'Articles 3.2.2.47 to 3.2.2.52 all require the building to be sprinklered throughout above 3 storeys.'};
 for(const c of V.construction){if(N>c.maxStoreys)continue;if(c.height&&H>c.height+1e-6)continue;const lim=c.areaAll??c.area?.[N]??Infinity;if(A>lim+1e-6)continue;
  return {status:'pass',value:`${c.label} · Article ${c.article}`,note:`${N} storeys${c.maxStoreys<Infinity?' ≤ '+c.maxStoreys:''}${c.height?`, uppermost floor ${fmt(H)} m ≤ ${c.height} m`:''}, building area ${fmt(A,0)} m²${Number.isFinite(lim)?' ≤ '+lim.toLocaleString('en-CA')+' m²':''}.`,clause:c.article};}
 return {status:'fail',value:'No Group C Article fits',note:`${N} storeys, building area ${fmt(A,0)} m².`};}

// Per floor: worst door-to-exit travel, dead end, and the separation between the two exits.
function exitsFor(l,o,sprinklered){const V=root.RULES.VBBL,route=l.route||{},paths=route.paths||[],exits=(route.exits||[]).filter(e=>e.point),limit=sprinklered?V.travel.sprinklered:V.travel.other;
 const units=paths.map(p=>{const to=(p.toExits||[p]).filter(t=>Number.isFinite(t.distance)).sort((a,b)=>a.distance-b.distance);const u=(l.units||[]).find(u=>u.id===p.unit);return {id:p.unit,type:u?.type,near:to[0]?.distance,nearLabel:to[0]?.label,second:to[1]?.distance,reached:!!to.length};});
 const worst=units.filter(u=>u.reached).reduce((m,u)=>!m||u.near>m.near?u:m,null);
 const xs=(l.g?.built||[]).flatMap(b=>[b.x,b.x+b.w]),ys=(l.g?.built||[]).flatMap(b=>[b.y,b.y+b.h]),diag=xs.length?Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)):0;
 let sep=null;if(exits.length>=2){let best=0;for(let i=0;i<exits.length;i++)for(let j=i+1;j<exits.length;j++){const a=exits[i].point,b=exits[j].point;best=Math.max(best,Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]));}sep=best;}
 const sepReq=Math.min(o.stair==='scissor'?V.scissor.sepCap??4.5:V.exitSeparation.cap,diag/2);
 return {level:l.level,units,worst,limit,deadEnd:route.deadEnd,exitCount:exits.length,sep,sepReq,unreached:units.filter(u=>!u.reached).length};}

function matrix(r,o){const rows=(r.levels||[]).filter(l=>(l.units||[]).length).map(l=>{const c=Object.fromEntries(TYPES.map(t=>[t,0]));let net=0;for(const u of l.units){c[u.type]=(c[u.type]||0)+1;net+=u.net;}return {level:l.level,c,total:l.units.length,net,edited:!!(o.slices?.[l.level]||o.unitEdits?.[l.level]?.length)};});
 const tot=Object.fromEntries(TYPES.map(t=>[t,rows.reduce((s,q)=>s+q.c[t],0)])),count=rows.reduce((s,q)=>s+q.total,0),net=rows.reduce((s,q)=>s+q.net,0);
 const avg=Object.fromEntries(TYPES.map(t=>{const us=(r.levels||[]).flatMap(l=>l.units||[]).filter(u=>u.type===t);return [t,us.length?us.reduce((s,u)=>s+u.net,0)/us.length:null];}));
 return {rows,tot,count,net,avg,target:Object.fromEntries((o.types||[]).map(t=>[t.key,t.share/100]))};}

function mixCheck(M,ctx){const req=ctx.mix||{two:0,three:0},n=M.count,two=(M.tot['2B']||0)+(M.tot['3B']||0),three=M.tot['3B']||0,need=(share,have)=>Math.max(0,Math.ceil(share*n-have-1e-9));
 return {req,n,two,three,twoShare:n?two/n:0,threeShare:n?three/n:0,twoOK:n>0&&two/n>=req.two-1e-9,threeOK:n>0&&three/n>=req.three-1e-9,needTwo:need(req.two,two),needThree:need(req.three,three)};}

function summary(r,ctx,o,opts={}){const V=root.RULES.VBBL,sp=opts.sprinklered!==false,rows=[],N=o.floors,height=(o.commercial?o.groundFtf+(N-1)*o.ftf:N*o.ftf)+(ctx.roof||0);
 const floors=(r.levels||[]).filter(l=>(l.units||[]).length).map(l=>exitsFor(l,o,sp)),M=matrix(r,o),mix=mixCheck(M,ctx);
 // zoning
 rows.push({group:'Zoning',item:'Floor space ratio',clause:ctx.fsrClause?'R3 '+ctx.fsrClause:'R3 schedule',req:`≤ ${fmt(ctx.permitted,2)}`,value:fmt(r.achieved,2),status:r.achieved<=ctx.permitted+1e-6?'pass':'fail'});
 rows.push({group:'Zoning',item:'Building height',clause:ctx.heightClause?'R3 '+ctx.heightClause:'R3 schedule',req:`≤ ${fmt(ctx.height)} m`,value:`${fmt(height)} m`,status:height<=ctx.height+1e-6?'pass':'fail',note:ctx.roof?`Includes the ${fmt(ctx.roof)} m roof allowance.`:''});
 rows.push({group:'Zoning',item:'Unit mix: 2 or more bedrooms',clause:ctx.mix?.clause||'§2.2.6',req:`≥ ${pct(mix.req.two)} of units`,value:`${mix.two} of ${mix.n} · ${pct(mix.twoShare)}`,status:mix.twoOK?'pass':'fail',note:mix.twoOK?'':`${mix.needTwo} more unit${mix.needTwo===1?'':'s'} with 2+ bedrooms needed.`});
 if(mix.req.three)rows.push({group:'Zoning',item:'Unit mix: 3 or more bedrooms',clause:ctx.mix?.clause||'§2.2.6',req:`≥ ${pct(mix.req.three)} of units`,value:`${mix.three} of ${mix.n} · ${pct(mix.threeShare)}`,status:mix.threeOK?'pass':'fail',note:mix.threeOK?'':`${mix.needThree} more 3-bedroom unit${mix.needThree===1?'':'s'} needed.`});
 // building code
 const c=construction(o,r,sp);
 rows.push({group:'Building code',item:'Occupancy and construction',clause:c.clause?'Art. '+c.clause:'3.2.2.47–52',req:'Group C (residential)',value:c.value,status:c.status,note:c.note});
 rows.push({group:'Building code',item:'Sprinklered throughout',clause:'3.2.2.47–52',req:'Required by the Group C Articles above 3 storeys',value:sp?'Assumed yes':'No',status:sp?'info':(N>3?'fail':'verify'),note:'A design assumption, set in the side panel.'});
 const minExits=floors.length?Math.min(...floors.map(f=>f.exitCount)):0;
 // A single-stair plan above 2 storeys is tested against VBBL 2025 Subsection 3.2.10 (3.4.2.1.(1) excepts it), not 2 exits
 const runs=list=>list.reduce((g,q)=>{const p=g[g.length-1];if(p&&p.n===q.n&&p.cap===q.cap&&p.z===q.level-1)p.z=q.level;else g.push({n:q.n,cap:q.cap,a:q.level,z:q.level});return g;},[]);
 const SE=V.singleExit,single=o.stair==='one'&&N>V.oneExitStoreys.v&&SE;
 if(single){const up=upperFloor(o),per=floors.map(f=>({level:f.level,n:f.units.length,cap:f.level<=3?SE.unitsLow:SE.unitsHigh})),over=per.filter(q=>q.n>q.cap),far=floors.reduce((m,f)=>Math.max(m,f.worst?.near||0),0),bad=[N>SE.storeyCap?`${N} storeys > ${SE.storeyCap}`:'',up>SE.height+1e-6?`uppermost floor ${fmt(up)} m > ${SE.height} m`:'',over.length?runs(over).map(g=>`${g.n} homes on floor${g.a===g.z?' '+g.a:'s '+g.a+'–'+g.z} (max ${g.cap})`).join(', '):'',far>SE.travel+1e-6?`travel ${fmt(far)} m > ${SE.travel} m`:''].filter(Boolean),most=per.reduce((m,q)=>Math.max(m,q.n),0);
  rows.push({group:'Building code',item:'Single exterior exit stair',clause:'Subsection '+SE.clause,req:`≤ ${SE.storeyCap} storeys, ≤ ${SE.height} m · ≤ ${SE.unitsLow} homes per floor (storeys 1–3), ≤ ${SE.unitsHigh} above · travel ≤ ${SE.travel} m`,value:bad.length?bad.join('; '):`${N} storeys · up to ${most} homes per floor · travel ${fmt(far)} m`,status:bad.length?'fail':'verify',note:`${SE.bylaw}, in force 20 Jan 2026. The one exit is an exterior stair reached by an exterior exit passageway (≥ 50% open, ≥ 45 min separation): this plan draws an interior stair, so that arrangement, ≤ ${SE.persons} persons per floor and the fire alarm need verifying.`});}
 else rows.push({group:'Building code',item:'Number of exits per floor',clause:V.exitsMin.clause,req:`≥ ${V.exitsMin.v}`,value:floors.length?`${minExits} (fewest on any floor)`:'—',status:!floors.length?'verify':minExits>=V.exitsMin.v?'pass':N<=V.oneExitStoreys.v?'verify':'fail',note:minExits<V.exitsMin.v?(N<=V.oneExitStoreys.v?'3.4.2.1.(2) may allow one exit: check occupant load, floor area and travel limits.':'Fewer than 2 exits: only a single exterior exit stair under Subsection 3.2.10 is permitted above 2 storeys.'):''});
 if(o.stair==='scissor'){const A=buildingArea(r),ok=N<=V.scissor.storeyCap&&A<=V.scissor.areaCap+1e-6,two=floors.every(f=>f.exitCount>=2);
  rows.push({group:'Building code',item:'Scissor stair',clause:V.scissor.clause,req:`Residential throughout · ≤ ${V.scissor.storeyCap} storeys · building area ≤ ${V.scissor.areaCap} m²`,value:`${N} storeys · ${fmt(A,0)} m²${o.commercial?' · commercial at grade':''}`,status:!ok||o.commercial||!two?'fail':'pass',note:(!two?'The scissor core needs a door at each end landing onto the corridor on every floor. ':'')+(o.commercial?'Commercial at grade: 3.4.2.3.(5) applies only to a building residential throughout. ':'')+'The air-leakage barrier between the stairways (3.4.2.3.(6)) and the smoke-tight separation (3.4.4.4.(2)–(3)) are not modelled: verify.'});}
 const worst=floors.reduce((m,f)=>f.worst&&(!m||f.worst.near>m.near)?{...f.worst,level:f.level}:m,null),unreached=floors.reduce((s,f)=>s+f.unreached,0),limit=sp?V.travel.sprinklered:V.travel.other;
 rows.push({group:'Building code',item:'Travel distance to an exit',clause:V.travel.clause,req:`≤ ${limit} m${sp?' (sprinklered)':''}`,value:worst?`${fmt(worst.near)} m · unit ${root.EXPLORE.unitNo(worst.level,worst.id)}, floor ${worst.level}`:'—',status:!worst?'verify':unreached?'fail':worst.near<=limit+1e-6?'pass':'fail',note:(unreached?`${unreached} unit door${unreached===1?'':'s'} with no route to a stair. `:'')+'Measured from each unit door along the corridor (3.4.2.4.(2)).'});
 const dead=floors.length?Math.max(...floors.map(f=>f.deadEnd||0)):null,over=(r.levels||[]).filter(l=>(l.units||[]).length).map(l=>({level:l.level,n:(l.route?.deadEnds||[]).filter(q=>q.length>V.deadEnd.v+1e-6).length})).filter(q=>q.n);
 rows.push({group:'Building code',item:'Dead-end corridor',clause:V.deadEnd.clause,req:`≤ ${V.deadEnd.v} m`,value:dead==null?'—':`${fmt(dead)} m (longest)`,status:dead==null?'verify':dead<=V.deadEnd.v+1e-6?'pass':'fail',note:(over.length?`Over the limit: ${over.map(q=>q.n+' on floor '+q.level).join(', ')}. `:'')+'Measured along the corridor centreline from the closed end to the first junction or exit; shown on the Review plan (red over the limit).'});
 const sepF=floors.filter(f=>f.sep!=null),sepWorst=sepF.reduce((m,f)=>!m||f.sep-f.sepReq<m.sep-m.sepReq?f:m,null);
 if(single);else if(o.stair==='scissor')rows.push({group:'Building code',item:'Distance between exits',clause:'3.4.2.3.(5)',req:sepWorst?`≥ ${fmt(sepWorst.sepReq)} m (scissor: need not exceed ${fmt(V.scissor.sepCap??4.5)} m)`:`need not exceed ${fmt(V.scissor.sepCap??4.5)} m`,value:sepWorst?`${fmt(sepWorst.sep)} m (floor ${sepWorst.level})`:'—',status:!sepWorst?'verify':sepWorst.sep>=sepWorst.sepReq-1e-6?'pass':'fail',note:'For a scissor stair in a building residential throughout, ≤ 6 storeys and ≤ 600 m² building area, the least distance between the two exit doors need not exceed 4.5 m. Measured door to door along the corridor.'});
 else rows.push({group:'Building code',item:'Distance between exits',clause:V.exitSeparation.clause,req:sepWorst?`≥ ${fmt(sepWorst.sepReq)} m`:'≥ half the floor diagonal, 9 m cap',value:sepWorst?`${fmt(sepWorst.sep)} m (floor ${sepWorst.level})`:'—',status:!sepWorst?'verify':sepWorst.sep>=sepWorst.sepReq-1e-6?'pass':'fail',note:'Along the corridor between stair doors (orthogonal approximation of the smoke path, 3.4.2.3.(3)).'});
 rows.push({group:'Building code',item:'Public corridor width',clause:V.corridorWidth.clause,req:`≥ ${fmt(V.corridorWidth.v*1000,0)} mm`,value:`${fmt((o.corridor||0)*1000,0)} mm`,status:(o.corridor||0)>=V.corridorWidth.v-1e-6?'pass':'fail',note:'Corridor width as set, taken as clear width.'});
 if(o.travel>0&&worst){const t=rows.find(q=>q.item==='Travel distance to an exit');t.note=`Your study limit ${fmt(o.travel)} m: ${worst.near<=o.travel+1e-6?'meets':'exceeds'}. `+t.note;}
 const study=studyChecks(r,o,ctx),verify=[...rows.filter(q=>q.status==='verify').map(q=>({item:q.item,note:q.note||''})),...study.filter(q=>q.status==='unknown').map(q=>({item:q.item,note:q.message})),
  ...(sp?[{item:'Sprinklered throughout',note:'Assumed, not checked.'}]:[]),...NOT_CHECKED.map(item=>({item,note:'Not checked by this study.'}))];
 const counts=rows.reduce((s,q)=>(s[q.status]=(s[q.status]||0)+1,s),{});
 return {rows,floors,M,mix,sprinklered:sp,counts,study,verify,tally:{meet:counts.pass||0,fail:counts.fail||0,studyFail:study.filter(q=>q.status==='fail').length,verify:verify.length}};}

// Plan-setup checks the code table does not already report (the light well, an entered travel or dead-end limit, ground
// floor routes, draft single-exit text). A failure here changes the headline but is not a code failure.
const STUDY={geometry:'Plan geometry',travel:'Travel, your study limit',deadEnd:'Dead end, your study limit',court:'Courtyard width',useBranch:'Use branch, 8 or fewer homes',lobby:'Lobby position',entrance:'Entrance route',discharge:'Stair discharge'};
const NOT_CHECKED=['Fire separations','Occupant load','Stair and door dimensions','Accessibility','Spatial separation','Windows to habitable rooms'];
function studyChecks(r,o,ctx){let cs=[];try{cs=root.PLAN_SETUP?.checks&&o.unitsGenerated?root.PLAN_SETUP.checks(r,o,ctx):[];}catch(e){cs=[];}
 const out=cs.filter(q=>STUDY[q.id]&&(q.id!=='travel'||o.travel>0)&&(q.id!=='deadEnd'||o.deadEnd>0)).map(q=>({...q,item:STUDY[q.id]}));
 // a mixed-use brief: report what the ground floor actually holds
 if(o.commercial||o.groundUse==='commercial'){const shops=(r.levels?.[0]?.rooms||[]).filter(q=>q.role==='commercial'&&q.on!==false&&!q.unplaced),area=shops.reduce((s,q)=>s+q.w*q.h,0),front=shops.reduce((s,q)=>s+(q.entry==='left'||q.entry==='right'?q.h:q.w),0);
  out.push({id:'groundUse',item:'Ground floor: shops at grade',source:'Your brief',status:shops.length?'pass':'fail',message:shops.length?`${shops.length} commercial unit${shops.length===1?'':'s'} · ${fmt(area,0)} m² · ${fmt(front)} m of street frontage: as briefed.`:'The brief asks for shops at grade, but none fit on the ground floor.'});}
 return out;}

// extra {r,o}: the generated result and options, for the feasibility summary drawn above the tables (summary-sheet.js)
function html(rep,ctx,extra={}){const {rows,floors,M,mix}=rep,V=root.RULES.VBBL,rowId=q=>root.SUMMARY_SHEET?' id="rv-row-'+root.SUMMARY_SHEET.key(q.item)+'"':'';
 const codeRows=['Zoning','Building code'].map(g=>`<tr class="rv-group"><td colspan="5">${g}</td></tr>`+rows.filter(q=>q.group===g).map(q=>`<tr${rowId(q)}><td>${esc(q.item)}${q.note?`<small>${esc(q.note)}</small>`:''}</td><td class="rv-mono">${esc(q.clause)}</td><td>${esc(q.req)}</td><td class="rv-mono">${esc(q.value)}</td><td>${badge(q.status)}</td></tr>`).join('')).join('');
 const exitRows=floors.map(f=>f.units.map((u,i)=>`<tr${i?'':' class="rv-floor-start"'}><td class="rv-mono">${i?'':String(f.level).padStart(2,'0')}</td><td class="rv-mono">${root.EXPLORE.unitNo(f.level,u.id)} · ${esc(u.type||'')}</td><td class="rv-mono">${u.reached?fmt(u.near)+' m':'no route'}</td><td class="rv-mono">${Number.isFinite(u.second)?fmt(u.second)+' m':'—'}</td><td>${badge(!u.reached?'fail':u.near<=f.limit+1e-6?'pass':'fail')}</td></tr>`).join('')).join('');
 const mRows=M.rows.map(q=>`<tr><td class="rv-mono">${String(q.level).padStart(2,'0')}${q.edited?' <i title="Edited by hand: split, merged or walls moved">edited</i>':''}</td>${TYPES.map(t=>`<td class="rv-mono">${q.c[t]||'·'}</td>`).join('')}<td class="rv-mono"><b>${q.total}</b></td><td class="rv-mono">${fmt(q.net,0)}</td></tr>`).join('');
 const share=t=>M.count?M.tot[t]/M.count:0;
 const mFoot=`<tr class="rv-total"><td>Total</td>${TYPES.map(t=>`<td class="rv-mono">${M.tot[t]}</td>`).join('')}<td class="rv-mono"><b>${M.count}</b></td><td class="rv-mono">${fmt(M.net,0)}</td></tr><tr><td>Share</td>${TYPES.map(t=>`<td class="rv-mono">${pct(share(t))}</td>`).join('')}<td></td><td></td></tr><tr><td>Generator target</td>${TYPES.map(t=>`<td class="rv-mono">${pct(M.target[t])}</td>`).join('')}<td></td><td></td></tr><tr><td>Average m²</td>${TYPES.map(t=>`<td class="rv-mono">${M.avg[t]?fmt(M.avg[t],0):'—'}</td>`).join('')}<td></td><td class="rv-mono">${M.count?fmt(M.net/M.count,0):'—'}</td></tr>`;
 const bar=(label,have,need)=>{const w=Math.min(100,have*100);return `<div class="rv-mixbar"><span>${label}</span><div class="rv-track"><div class="rv-fill ${have>=need-1e-9?'ok':'short'}" style="width:${w}%"></div><div class="rv-need" style="left:${need*100}%" title="Required ${pct(need)}"></div></div><b class="rv-mono">${pct(have)} / ${pct(need)}</b></div>`;};
 const c=rep.counts;
 const top=root.SUMMARY_SHEET&&extra.r?root.SUMMARY_SHEET.html(rep,extra.r,ctx,extra.o):'';
 return `<div class="rv">${top}
  <header class="rv-head"><div><span class="rv-eyebrow">04 / REVIEW</span><h2>Code summary</h2><p>${esc(ctx.addr||'')} · ${esc(ctx.zone||'')} · ${rep.sprinklered?'sprinklered throughout (assumed)':'not sprinklered'}</p></div>${tallyHtml(rep.tally,'rv-counts')}</header>
  <section>${table(['Requirement','Clause','Required','This design','Status'],codeRows)}<p class="rv-note">Zoning limits from the encoded R3 rules. Building code limits from ${esc(V.source)}. A schematic check of the drawn plan, not a building permit review: fire separations, occupant load, stair and door dimensions, accessibility and spatial separation are not checked.</p></section>
  ${studyHtml(rep)}
  <section><h3>Exit distances</h3><p class="rv-note">From each unit's door to the nearest stair along the corridor, as ${V.travelFrom.clause} allows for suites opening onto a public corridor. Limit ${floors[0]?.limit??'—'} m (${V.travel.clause}).</p>${table(['Floor','Unit','Nearest exit','Second exit','Status'],exitRows||'<tr><td colspan="5">Generate units to measure exit distances.</td></tr>')}</section>
  <section><h3>Unit matrix</h3><p class="rv-note">From the current plan, including your splits, merges and wall moves.</p>${table(['Floor','Studio','1 bed','2 bed','3 bed','Units','Net m²'],mRows+mFoot)}</section>
  <section><h3>R3 unit mix · ${esc(mix.req.clause||ctx.mix?.clause||'§2.2.6')}</h3>${bar('2 or more bedrooms',mix.twoShare,mix.req.two)}${mix.req.three?bar('3 bedrooms',mix.threeShare,mix.req.three):''}
   <p class="rv-note">${mix.twoOK&&(mix.threeOK||!mix.req.three)?'The unit mix meets the R3 requirement.':[!mix.twoOK?`${mix.needTwo} more unit${mix.needTwo===1?'':'s'} with 2 or more bedrooms`:'',mix.req.three&&!mix.threeOK?`${mix.needThree} more 3-bedroom unit${mix.needThree===1?'':'s'}`:''].filter(Boolean).join(' and ')+' needed. Merge smaller units, or raise the 2 and 3 bed targets and regenerate.'}</p></section>
 </div>`;}
// One tally everywhere: code checks, the study's own limits, and what is left to verify.
function tallyHtml(t,cls){const g=(name,body)=>`<span class="rv-g"><span class="rv-gname">${name}</span>${body}</span>`;return `<div class="${cls}">${g('Code',`<span class="rv-pass"><b>${t.meet}</b> meet</span><span class="rv-fail"><b>${t.fail}</b> do not meet</span>`)}${g('Your study',`<span class="${t.studyFail?'rv-fail':'rv-pass'}"><b>${t.studyFail}</b> not met</span>`)}${g('To verify',`<span class="rv-verify"><b>${t.verify}</b></span>`)}</div>`;}
function studyHtml(rep){const st=rep.study.filter(q=>q.status!=='unknown'),status=q=>q.status==='pass'?'pass':'fail';
 return `<section id="rv-study"><h3>Study checks</h3><p class="rv-note">Checks this study sets beyond the code table: limits you entered, the courtyard, the ground-floor routes. Not met here means the plan needs work, not that the code is failed.</p>${st.length?table(['Check','Source','Result','Status'],st.map(q=>`<tr id="rv-row-study-${q.id}"><td>${esc(q.item)}</td><td class="rv-mono">${esc(q.source)}</td><td>${esc(q.message)}</td><td>${badge(status(q))}</td></tr>`).join('')):''}
  <h3 id="rv-row-verify">To verify</h3><ul class="rv-verify-list">${rep.verify.map(q=>`<li><b>${esc(q.item)}</b> ${esc(q.note)}</li>`).join('')}</ul></section>`;}
root.REVIEW={tallyHtml,summary,html,matrix,mixCheck,exitsFor,construction};
})(typeof window!=='undefined'?window:globalThis);
