/* Plan setup: the user picks design moves with buttons; the picks form a visible design brief; the tool generates the
   best-working floor plan from the brief and the confirmed massing. Stairs, lift and corridor are placed first, then units.
   Best = highest net-to-gross, then the shortest corridor, among layouts whose exit routes stay within the VBBL limits.
   The search is bounded (a few dozen core arrangements), not a proof of the optimum. Pure logic and HTML strings;
   units_ui.js binds the buttons and runs the search. */
(function(root){'use strict';
const F=()=>root.FLOOR_DESIGN,C=()=>root.CORE_LAYOUT,E=()=>root.EXPLORE;
// Planning assumptions, not code values: court clear width (CDDG S1.4.3), the shallowest usable unit, recess depths.
// A court narrower than COURT_MIN but at least WELL_MIN is kept as a light well: allowed on small lots, flagged for review.
const COURT_MIN=7.3,WELL_MIN=4.5,UNIT_MIN=6,RECESS={shallow:1.5,deep:3},SETBACKS=[1.5,2.5,3.5],KEEP=5;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';
const COMPASS=['N','E','S','W'],WORD={N:'north',E:'east',S:'south',W:'west'},SIDES=['top','bottom','left','right'];
const LABEL={layout:{double:'Double-loaded corridor',gallery:'Single-loaded corridor',point:'Central core'},stairs:{two:'Two exit stairs',one:'One exit stair',scissor:'Scissor stair'},ground:{residential:'Residential ground floor',commercial:'Mixed use · commercial units at grade'}};
const clone=x=>JSON.parse(JSON.stringify(x));

// Which compass direction each plan side faces, as the oriented plan draws it (project north up).
function compass(ctx){const rot=ctx?.projectRotation??ctx?.siteRotation??0,a=Math.cos(rot),b=Math.sin(rot),dirs={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]},n={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]},out={};
 for(const s of SIDES){const [x,y]=n[s],sx=a*x+b*y,sy=b*x-a*y;out[s]=COMPASS.reduce((best,k)=>dirs[k][0]*sx+dirs[k][1]*sy>dirs[best][0]*sx+dirs[best][1]*sy?k:best,'N');}
 return out;}
const sideOf=(ctx,k)=>SIDES.includes(k)?k:SIDES.find(s=>compass(ctx)[s]===k);
// What each plan side faces on the site: the street (with its name), the lane, or a side yard.
function frontages(ctx){const front=F().articulationFront(ctx),cp=compass(ctx),poly=ctx?.sitePoly||[],cls=ctx?.siteEdges||[],names=ctx?.streetNames||[],n={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]},out={};
 const c=poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);
 for(const side of SIDES){let best=null;
  poly.forEach((p,i)=>{const q=poly[(i+1)%poly.length],m=[(p[0]+q[0])/2,(p[1]+q[1])/2],L=Math.hypot(q[0]-p[0],q[1]-p[1])||1;let nx=(q[1]-p[1])/L,ny=-(q[0]-p[0])/L;if(nx*(m[0]-c[0])+ny*(m[1]-c[1])<0){nx=-nx;ny=-ny;}if(nx*n[side][0]+ny*n[side][1]<.7)return;const reach=m[0]*n[side][0]+m[1]*n[side][1];if(!best||reach>best.reach)best={reach,i,m};});
  const kind=best?cls[best.i]||'side':side===front?'street':'side',name=kind==='street'&&best?names.find(q=>Math.hypot((q.a[0]+q.b[0])/2-best.m[0],(q.a[1]+q.b[1])/2-best.m[1])<3)?.name:'';
  const word=kind==='street'?(name?'Street · '+name:'Street'):kind==='lane'?'Lane':kind==='open'?'Open edge':'Side';
  out[side]={side,kind,compass:cp[side],front:side===front,label:`${word} (${cp[side]})`};}
 return out;}

// The plan side on a street. articulationFront (opposite the longest lane) can pick an interior side on a corner-lane site.
function streetSide(ctx){const fr=frontages(ctx),f=F().articulationFront(ctx);return fr[f].kind==='street'?f:SIDES.find(s=>fr[s].kind==='street')||f;}
function defaults(ctx,I,o){const f=streetSide(ctx);return {layout:'double',lifts:1,stairs:'two',court:'none',sideCourt:'none',recess:'none',recessSide:f,recessPos:'middle',setback:0,setbackFrom:Math.max(2,Math.min(4,o?.floors||4)),setbackSides:[compass(ctx)[f]],ground:I?.commGF?'commercial':'residential',courtW:null,courtH:null};}
// Every ground room is optional: the floor starts as units (and shops in mixed use); rooms are switched on by the user.
// The lobby is on by default; every other ground room is switched on by the user.
function programme(){return [{name:'Lobby',area:30,access:'both',near:'street',on:true},{name:'Loading',area:30,access:'exterior',near:'lane',on:false},{name:'Amenity',area:40,access:'corridor',near:'any',on:false},{name:'Bike room',area:25,access:'both',near:'lane',on:false},{name:'Garbage / recycling',area:9,access:'exterior',near:'lane',on:false},{name:'Mail',area:5,access:'corridor',near:'lobby',on:false},{name:'Electrical',area:12,access:'corridor',near:'lane',on:false},{name:'Mechanical',area:16,access:'corridor',near:'lane',on:false},{name:'Water entry',area:6,access:'corridor',near:'lane',on:false},{name:'Concierge',area:5,access:'corridor',near:'lobby',on:false}];}

// A click on a brief button. Only one courtyard at a time.
function pick(b,key,value){b=clone(b);
 if(key==='lifts'||key==='setback'||key==='setbackFrom')b[key]=+value;
 else if(key==='courtW'||key==='courtH')b[key]=value===''||value==null||!(+value>0)?null:Math.round(+value*10)/10;
 else if(key==='courtAuto'){b.courtW=null;b.courtH=null;}
 else if(key==='setbackSide'){const on=b.setbackSides.includes(value);b.setbackSides=on?b.setbackSides.filter(k=>k!==value):COMPASS.filter(k=>k===value||b.setbackSides.includes(k));}
 else b[key]=value;
 if(key==='court'&&value!=='none')b.sideCourt='none';if(key==='sideCourt'&&value!=='none')b.court='none';
 return b;}
function clear(b,key,base){if(key==='all')return clone(base);b=clone(b);if(key==='setback')b.setback=0;else if(key==='recess'){b.recess='none';b.recessPos='middle';}else b[key]=base[key];if(key==='court'||key==='sideCourt'){b.courtW=null;b.courtH=null;}return b;}
function lines(b,ctx,base,o){const fr=frontages(ctx),out=[{key:'stairs',text:LABEL.stairs[b.stairs]},{key:'lifts',text:b.lifts===2?'2 lifts':'1 lift'},{key:'layout',text:LABEL.layout[b.layout]}];
 const size=()=>{const c=o?courtSize(o,b,ctx):null;return c?` · ${fmt(c.w)} × ${fmt(c.h)} m${b.courtW||b.courtH?' (set)':''}`:'';};
 if(b.court!=='none')out.push({key:'court',text:'Central courtyard'+size()});
 if(b.sideCourt!=='none')out.push({key:'sideCourt',text:`Side courtyard open to the ${WORD[b.sideCourt]} (${fr[sideOf(ctx,b.sideCourt)]?.label||b.sideCourt})${size()}`});
 if(b.recess!=='none')out.push({key:'recess',text:`${b.recess==='deep'?'Deep':'Shallow'} entry recess ${RECESS[b.recess]} m · ${fr[b.recessSide]?.label||b.recessSide}${b.recessPos&&b.recessPos!=='middle'?`, ${b.recessPos} corner`:''}`});
 if(b.setback>0)out.push({key:'setback',text:`Setback ${b.setback} m on ${b.setbackSides.length?b.setbackSides.join(', '):'no side yet'} from level ${b.setbackFrom} up`});
 out.push({key:'ground',text:LABEL.ground[b.ground]});
 return out.map(l=>({...l,changed:l.key==='setback'||l.key==='recess'||l.key==='court'||l.key==='sideCourt'||b[l.key]!==base[l.key]}));}

// ---------- Code screens for the stair choice ----------
function estimateUnits(o,b){const types=o.types||[],share=types.reduce((s,t)=>s+t.share,0)||1,avg=types.reduce((s,t)=>s+t.target*t.share,0)/share||60,court=b.court!=='none'||b.sideCourt!=='none'?.8:1,res=o.floors-(b.ground==='commercial'?1:.5);return Math.max(0,Math.round(o.W*o.D*court*.72*Math.max(0,res)/avg));}
function exits(o,ctx,b){const one=root.RULES?.EGRESS?.one||{storeyCap:6,unitCap:30},N=o.floors,est=estimateUnits(o,b),out={two:{ok:true,note:''}};
 // Vancouver's space-efficient scissor stair: two exits in one core, residential up to 6 storeys, building area 600 m² at most.
 {const sc=root.RULES?.VBBL?.scissor||{storeyCap:6,areaCap:600},area=o.W*o.D-(o.court?o.court.w*o.court.h:0);
  out.scissor=N>sc.storeyCap?{ok:false,note:`Scissor stair: allowed up to ${sc.storeyCap} storeys; this massing has ${N}. Reduce storeys in step 1, or use two stairs.`}
   :area>sc.areaCap+1e-6?{ok:false,note:`Scissor stair: building area limited to ${sc.areaCap} m²; this plate is about ${Math.round(area)} m². Use two stairs, or a smaller plate.`}
   :b.ground==='commercial'?{ok:false,note:'Scissor stair: VBBL 2025 3.4.2.3.(5) applies only to a building residential throughout, so shops at grade rule it out. Use two stairs, or a residential ground floor.'}
   :{ok:true,note:`Scissor stair: one core holding both exit stairs, a door at each end landing. Residential up to ${sc.storeyCap} storeys, building area ${Math.round(area)} of ${sc.areaCap} m²; the distance between the two exit doors need not exceed ${sc.sepCap??4.5} m (VBBL 2025 3.4.2.3.(5)).${b.ground==='commercial'?' The provision is for buildings residential throughout: commercial at grade does not qualify.':''} The air-leakage barrier between the stairs is not modelled.`};}
 // VBBL 2025 Subsection 3.2.10 (By-law 14576): one exterior exit stair, ≤ 6 storeys, ≤ 6 units per floor on storeys 1–3 and
 // ≤ 4 above. The per-floor estimate can only flag the option; the generated plan's real counts are checked afterwards.
 const se=root.RULES?.VBBL?.singleExit||{storeyCap:6,unitsLow:6,unitsHigh:4,travel:25},perFloor=Math.round(est/Math.max(1,N));
 if(N>se.storeyCap)out.one={ok:false,note:`One exit stair: allowed up to ${se.storeyCap} storeys (VBBL 2025 3.2.10); this massing has ${N}. Reduce storeys in step 1, or use two stairs.`};
 else if(N>2&&perFloor>(N>3?se.unitsHigh:se.unitsLow))out.one={ok:true,conditional:true,note:`One exit stair: conditional. About ${perFloor} units per floor are estimated; VBBL 2025 3.2.10 allows ${se.unitsLow} per floor on storeys 1–3 and ${se.unitsHigh} above. Larger units, or two stairs, avoid the question.`};
 else out.one={ok:true,note:N<=2?'One exit stair: 2 storeys or fewer, so VBBL 3.4.2.1.(2) may allow one exit; occupant load, floor area and travel limits still apply.':`One exit stair under VBBL 2025 3.2.10: the one exit is an exterior stair reached by an exterior exit passageway (this tool draws the stair inside the plate), ≤ ${se.unitsLow} units per floor on storeys 1–3 and ≤ ${se.unitsHigh} above, travel ≤ ${se.travel} m, sprinklered throughout. About ${perFloor} units per floor estimated.`};
 return out;}
function limits(o){const V=root.RULES?.VBBL,sp=o.sprinklered!==false;return {travel:o.travel>0?o.travel:sp?V?.travel?.sprinklered||45:V?.travel?.other||30,dead:o.deadEnd>0?o.deadEnd:V?.deadEnd?.v||6};}

// ---------- Brief → engine input ----------
// Wing: the plate depth a corridor with its units needs. Around a courtyard the corridor runs along the court with the units
// toward the exterior walls (study 19), so a wing is one unit deep plus the corridor whatever the layout; a deeper wing
// can still carry units on both sides of its corridor.
const courtWing=(layout,o,depth=UNIT_MIN)=>depth+o.corridor;
// Elsewhere (setbacks) a wing is the plate depth a corridor with its units needs: units on one side or both.
const wing=(layout,o,depth=UNIT_MIN)=>(layout==='gallery'?1:2)*depth+o.corridor;
// The plate a courtyard at this wing depth sits in: the confirmed massing plate, at least big enough to hold the wings and the
// court (min clear), scaled until the plate less the court gives back the massing's floor area without exceeding it (a larger
// plate would overshoot the permitted density), and inside the envelope.
function courtPlate(o,b,ctx,depth,min=WELL_MIN){const mp=o.massPlate||{W:o.W,D:o.D,court:0},A0=mp.W*mp.D-(mp.court||0),bw=ctx?.bounds?.w||Infinity,bh=ctx?.bounds?.h||Infinity,fl=v=>Math.floor(v*10+1e-6)/10;
 if(b.court==='none'&&b.sideCourt==='none'||depth==null){
  // A double-loaded plate deeper than two units and the corridor leaves windowless middles and oversized units: keep the
  // floor area and stretch it along the envelope instead, as far as the envelope allows.
  const deep=2*(o.maxDepth||12.2)+(o.corridor||1.8),W=mp.W,D=mp.D,P=W*D;if(b.layout!=='double'||Math.min(W,D)<=deep+.3)return {W,D};
  if(W<=D){const nD=Math.min(fl(bh),fl(P/deep));return {W:Math.max(deep,Math.min(W,fl(P/nD))),D:Math.max(D,nD)};}
  const nW=Math.min(fl(bw),fl(P/deep));return {W:Math.max(W,nW),D:Math.max(deep,Math.min(D,fl(P/nW)))};}
 const g=courtWing(b.layout,o,depth),s=b.court!=='none'?null:sideOf(ctx,b.sideCourt),across=s==='top'||s==='bottom',minW=b.court!=='none'||across?2*g+min:g+min,minD=b.court!=='none'||!across?2*g+min:g+min;
 if(minW>fl(bw)+1e-6||minD>fl(bh)+1e-6)return null;
 const at=k=>{const W=Math.min(fl(bw),Math.max(minW,fl(mp.W*k))),D=Math.min(fl(bh),Math.max(minD,fl(mp.D*k))),q=courtRect({...o,W,D},b,ctx,depth,min);return {W,D,net:W*D-(q?q.w*q.h:0)};};
 // wings this deep already hold more than the massing floor area at their smallest: not this depth
 let lo=.01,hi=4;if(at(lo).net>A0*1.01)return null;if(at(hi).net<A0)return at(hi);for(let i=0;i<40;i++){const m=(lo+hi)/2;if(at(m).net<=A0)lo=m;else hi=m;}const r=at(lo);return {W:r.W,D:r.D};}
const courtFits=(o,b,ctx,d,min=WELL_MIN)=>{const p=courtPlate(o,b,ctx,d,min);return !!p&&!!courtRect({...o,...p},b,ctx,d,min);};
// An explicit size (brief.courtW along plan x, courtH along plan y) is clamped between the light-well minimum and the widest
// court that leaves every wing a unit and a corridor; auto takes the plate minus the wings at the given depth.
function courtRect(o,b,ctx,depth,min=WELL_MIN){if(b.court==='none'&&b.sideCourt==='none')return null;const g=courtWing(b.layout,o,depth),gm=courtWing(b.layout,o),W=o.W,D=o.D,r=v=>Math.round(v*10)/10,fit=(v,auto,max)=>v>0?Math.max(min,Math.min(max,v)):auto;
 if(b.court!=='none'){const w=fit(b.courtW,W-2*g,W-2*gm),h=fit(b.courtH,D-2*g,D-2*gm);return w>=min-1e-6&&h>=min-1e-6?{x:r((W-w)/2),y:r((D-h)/2),w:r(w),h:r(h),kind:'court'}:null;}
 const s=sideOf(ctx,b.sideCourt),across=s==='top'||s==='bottom',w=fit(b.courtW,across?W-2*g:W-g,across?W-2*gm:W-gm),h=fit(b.courtH,across?D-g:D-2*g,across?D-gm:D-2*gm);if(w<min-1e-6||h<min-1e-6)return null;
 return {x:r(s==='left'?0:s==='right'?W-w:(W-w)/2),y:r(s==='top'?0:s==='bottom'?D-h:(D-h)/2),w:r(w),h:r(h),kind:'u',side:s};}
// The court as the generator would place it for this brief, or null.
function courtSize(o,b,ctx){const d=courtDepths(o,b,ctx)[0],p=d==null?null:courtFits(o,b,ctx,d,COURT_MIN)?courtPlate(o,b,ctx,d,COURT_MIN):courtPlate(o,b,ctx,d);return p?courtRect({...o,...p},b,ctx,d):null;}
// Wing depths tried for a courtyard: deeper wings mean a smaller court and more units, up to the maximum unit depth.
function courtDepths(o,b,ctx){if(b.court==='none'&&b.sideCourt==='none')return [null];if(b.courtW>0||b.courtH>0)return courtFits(o,b,ctx,UNIT_MIN)?[UNIT_MIN]:[];const all=[o.maxDepth||12.2,10,8,UNIT_MIN].filter((d,i,a)=>a.indexOf(d)===i),full=all.filter(d=>courtFits(o,b,ctx,d,COURT_MIN));
 // A full courtyard whenever one fits; only then a light well, so a small lot still gets its court.
 return (full.length?full:all.filter(d=>courtFits(o,b,ctx,d))).slice(0,2);}
function apply(o,b,ctx,depth){const x=clone(o);
 Object.assign(x,{typology:'free',layoutType:b.layout,lifts:b.lifts,stair:b.stairs,groundUse:b.ground,commercial:b.ground==='commercial',groundProgram:true,autoFit:false,autoSize:false,unitsGenerated:false,corridorStale:false,shortSpine:false,recoverTails:false,brief:b,streetSide:streetSide(ctx),sharedCutsFrom:x.floors+1,minAbsorb:2.4});
 for(const k of ['coreLayout','freeCorridors','stubs','slices','unitEdits','rooms','groundCorridors','corridorReport','planStale','planStudy'])delete x[k];
 // The courtyard is cut from the plate, so the plate grows to keep the floor area the massing confirmed (and with it the FSR),
 // keeping its proportions and staying inside the envelope; without a courtyard it returns to the massing size.
 // (a study saved before the massing plate was recorded starts from its plate, unless a courtyard was already applied)
 const mp=x.massPlate||(!o.court?{W:o.W,D:o.D,court:0}:null);if(mp){x.massPlate=mp;const p=(courtFits(x,b,ctx,depth,COURT_MIN)?courtPlate(x,b,ctx,depth,COURT_MIN):courtPlate(x,b,ctx,depth))||{W:mp.W,D:mp.D};x.W=p.W;x.D=p.D;}
 x.court=depth==null?null:courtRect(x,b,ctx,depth);
 const m=x.moves=x.moves||{};m.recess={...(m.recess||{}),on:b.recess!=='none',d:RECESS[b.recess]||RECESS.shallow,w:m.recess?.w||4,pos:recessPos(b),storeys:1,side:b.recessSide};
 // The entry recess is the lobby's front door: the lobby is steered behind it and opens onto it.
 const s=b.recessSide,d=RECESS[b.recess]||0,c=recessCentre(x),at={top:[c,d+2],bottom:[c,x.D-d-2],left:[d+2,c],right:[x.W-d-2,c]}[s];
 x.programme=(x.programme||programme()).map(p=>p.name!=='Lobby'?p:b.recess!=='none'?{...p,anchor:at,anchorBy:'brief',entry:s}:p.anchorBy==='brief'?(({anchor,anchorBy,entry,...rest})=>rest)(p):p);
 m.setbackSides={on:b.setback>0&&b.setbackSides.length>0,d:b.setback,from:b.setbackFrom,sides:b.setbackSides.map(k=>sideOf(ctx,k)).filter(Boolean)};
 return x;}

// ---------- Fit checks, in plain language, each with the nearest option that works ----------
function problems(o,ctx,b){const out=[],W=o.W,D=o.D,fr=frontages(ctx),ex=exits(o,ctx,b),kind={double:'units on both sides',gallery:'units on one side',point:'units around the core'}[b.layout];
 const courtOK=bb=>bb.court==='none'&&bb.sideCourt==='none'||!(bb.layout==='point'&&bb.court!=='none')&&courtDepths(o,bb,ctx)[0]!=null;
 const nearestCourt=()=>{const lane=SIDES.find(s=>fr[s].kind==='lane'),order=[lane,...SIDES.filter(s=>s!==lane)].filter(Boolean).map(s=>fr[s].compass),tries=[];
  if(b.court!=='none')for(const k of order)tries.push({patch:{court:'none',sideCourt:k},label:`side courtyard open to the ${WORD[k]}`});else for(const k of order.filter(k=>k!==b.sideCourt))tries.push({patch:{sideCourt:k},label:`side courtyard open to the ${WORD[k]}`});
  if(b.layout!=='gallery'){tries.push({patch:{layout:'gallery'},label:'single-loaded corridor around the courtyard'});for(const k of order)tries.push({patch:{layout:'gallery',court:'none',sideCourt:k},label:`single-loaded corridor, side courtyard open to the ${WORD[k]}`});}
  tries.push({patch:{court:'none',sideCourt:'none'},label:'no courtyard'});return tries.find(t=>courtOK({...b,...t.patch}));};
 if(b.court!=='none'&&b.layout==='point')out.push({key:'court',text:'A central core sits in the middle of the plate, exactly where a central courtyard would go.',...nearestCourt()});
 else if(!courtOK(b)){const g=courtWing(b.layout,o);
  if(b.court!=='none')out.push({key:'court',text:`A central courtyard needs a ${fmt(g)} m wing (a corridor along the court with units to the outside) on every side and at least ${WELL_MIN} m clear in the middle (${COURT_MIN} m for a full courtyard; a light well below that): ${fmt(2*g+WELL_MIN)} m each way. The plate can grow to keep its floor area, but the envelope is only ${fmt(ctx?.bounds?.w??W)} × ${fmt(ctx?.bounds?.h??D)} m.`,...nearestCourt()});
  else{const s=sideOf(ctx,b.sideCourt),across=s==='top'||s==='bottom';out.push({key:'sideCourt',text:`A side courtyard open to the ${WORD[b.sideCourt]} needs ${fmt(2*g+WELL_MIN)} m along that side and ${fmt(g+WELL_MIN)} m of depth (a ${fmt(g)} m wing, corridor along the court and units outside, around at least ${WELL_MIN} m clear; ${COURT_MIN} m for a full courtyard). The envelope is ${fmt(across?(ctx?.bounds?.w??W):(ctx?.bounds?.h??D))} m along it and ${fmt(across?(ctx?.bounds?.h??D):(ctx?.bounds?.w??W))} m deep.`,...nearestCourt()});}}
 if((b.court!=='none'||b.sideCourt!=='none')&&courtOK(b)){const d=courtDepths(o,b,ctx)[0],c=d!=null&&courtSize(o,b,ctx);
  if(c&&(b.courtW>0&&Math.abs(c.w-b.courtW)>.05||b.courtH>0&&Math.abs(c.h-b.courtH)>.05))out.push({key:b.court!=='none'?'court':'sideCourt',level:'warn',text:`Courtyard set to ${fmt(c.w)} × ${fmt(c.h)} m, not ${fmt(b.courtW||c.w)} × ${fmt(b.courtH||c.h)} m: each wing needs at least ${fmt(courtWing(b.layout,o))} m for a corridor with units, and the court at least ${WELL_MIN} m.`});if(c&&Math.min(c.w,c.h)<COURT_MIN-1e-6)out.push({key:b.court!=='none'?'court':'sideCourt',level:'warn',text:`Only a light well fits this plate: about ${fmt(c.w)} × ${fmt(c.h)} m, under the ${COURT_MIN} m courtyard width (CDDG S1.4.3, applied by analogy). Daylight, privacy and fire separation across it need review.`});}
 if(b.setback>0&&b.setbackSides.length){const plate=bb=>{const ss=bb.setbackSides.map(k=>sideOf(ctx,k)),d=bb.setback;return {w:W-d*ss.filter(s=>s==='left'||s==='right').length,h:D-d*ss.filter(s=>s==='top'||s==='bottom').length};},ok=bb=>{if(!(bb.setback>0)||!bb.setbackSides.length)return true;const p=plate(bb);return Math.min(p.w,p.h)>=wing(bb.layout,o)-1e-6;};
  if(!ok(b)){const p=plate(b),tries=[];for(const d of SETBACKS.filter(d=>d<b.setback).reverse())tries.push({patch:{setback:d},label:`${d} m setback on the same sides`});
   const front=fr[streetSide(ctx)].compass;if(b.setbackSides.length>1)tries.push({patch:{setbackSides:b.setbackSides.includes(front)?[front]:[b.setbackSides[0]]},label:`${b.setback} m setback on ${b.setbackSides.includes(front)?front:b.setbackSides[0]} only`});tries.push({patch:{setback:0},label:'no upper-floor setback'});
   out.push({key:'setback',text:`A ${b.setback} m setback on ${b.setbackSides.join(', ')} leaves levels ${b.setbackFrom}+ only ${fmt(p.w)} × ${fmt(p.h)} m: too narrow for a corridor with ${kind} (needs ${fmt(wing(b.layout,o))} m).`,...tries.find(t=>ok({...b,...t.patch}))});}}
 if(b.setback>0&&b.setbackFrom>o.floors)out.push({key:'setback',level:'warn',text:`The setback starts at level ${b.setbackFrom}, above the top storey (${o.floors}), so it has no effect.`,patch:{setbackFrom:o.floors},label:`start the setback at level ${o.floors}`});
 if(b.recess!=='none'){const s=b.recessSide,along=s==='top'||s==='bottom'?W:D,across=s==='top'||s==='bottom'?D:W,d=RECESS[b.recess],w=o.moves?.recess?.w||4;
  const behind=UNIT_MIN+o.corridor;if(along<w+2||across-d<behind)out.push({key:'recess',text:`A ${b.recess} entry recess (${w} × ${d} m) does not leave the ground floor enough room on the ${fr[s].label}: it needs ${fmt(w+2)} m of frontage and ${fmt(d+behind)} m of plate depth (the recess, then a room and the corridor behind it).`,...(b.recess==='deep'&&along>=w+2&&across-RECESS.shallow>=behind?{patch:{recess:'shallow'},label:'a shallow entry recess'}:{patch:{recess:'none'},label:'no entry recess'})});}
 if(b.ground==='commercial'&&ctx?.height){const h=(o.groundFtf||4)+(o.floors-1)*o.ftf+(ctx.roof||0);if(h>ctx.height+.01)out.push({key:'ground',text:`A commercial ground floor is ${fmt(o.groundFtf||4)} m tall, so ${o.floors} storeys reach ${fmt(h)} m, over the ${fmt(ctx.height)} m height limit.`,patch:{ground:'residential'},label:'a residential ground floor'});}
 if(!ex[b.stairs]?.ok)out.push({key:'stairs',text:ex[b.stairs].note,patch:{stairs:'two'},label:'two exit stairs'});
 if(b.layout==='point'&&(Math.max(W,D)>30||Math.max(W,D)/Math.min(W,D)>1.4))out.push({key:'layout',level:'warn',text:`A central core suits a compact plate, up to about 26 m each way. This one is ${fmt(W)} × ${fmt(D)} m, so the far ends get long corridors; a double-loaded corridor usually does better here.`,patch:{layout:'double'},label:'double-loaded corridor'});
 if(b.layout==='gallery'&&Math.min(W,D)>(o.maxDepth||12.2)+o.corridor+3&&b.court==='none'&&b.sideCourt==='none')out.push({key:'layout',level:'warn',text:`A single-loaded corridor serves one unit depth (up to ${fmt(o.maxDepth||12.2)} m). This plate is ${fmt(Math.min(W,D))} m deep, so the generator adds corridor or leaves plate unused.`,patch:{layout:'double'},label:'double-loaded corridor'});
 return out.map(p=>({level:'block',...p,patch:p.patch||null}));}

// ---------- Core arrangements to try ----------
// Search increments and the ranking band are study settings, not regulatory dimensions.
// Entry recess position along its frontage, as seen from the street looking at the building. Plan y runs down the page, so
// facing the building from the top frontage the viewer's left is +x, from the bottom it is −x, from the left −y, from the right +y.
const RECESS_POS=['left','middle','right'];
const recessPos=b=>{const p=b.recessPos||'middle';if(p==='middle')return .5;const left={top:1,bottom:0,left:0,right:1}[b.recessSide]??.5;return p==='left'?left:1-left;};
const recessCentre=x=>{const r=x.moves?.recess||{},along=r.side==='top'||r.side==='bottom'?x.W:x.D,w=Math.min(r.w||4,along);return (along-w)*(r.pos??.5)+w/2;};
const SEARCH={refineSteps:[1.2,.6,.3],refineBudget:6,refineCandidates:3,band:.01,minEvaluated:8};
// Mixed use: arrangements that keep the cores behind a commercial strip this deep compete with the rest.
const SHOP=12;
// Everything a stacked core must stay clear of: the plate edge, the courtyard, and every storey's cuts.
function blockers(x,ctx){const cuts=[],front=F().articulationFront(ctx);for(let k=1;k<=x.floors;k++)cuts.push(...F().cuts({...x,articulationFront:front},k));
 return cs=>!cs.some(q=>q.x<-1e-6||q.y<-1e-6||q.x+q.w>x.W+1e-6||q.y+q.h>x.D+1e-6)&&!cs.some((q,i)=>cs.slice(0,i).some(p=>E().overlap(p,q)))&&!cs.some(q=>(x.court&&E().overlap(q,x.court))||cuts.some(k=>E().overlap(q,k)));}
const rnd=v=>Math.round(v*100)/100;
// Corridor-line families. In a frame where the corridor runs along x: stairs spaced along one corridor line with the lift beside
// a stair or centred, cores on either side of the line, mirrored end for end, in both orientations; at the default spacing also
// the second stair across the corridor and stairs turned to lie along it.
function lineSeeds(x,ctx,ok){const out=[],seen=new Set(),Cl=C(),front=F().articulationFront(ctx),shop=x.groundUse==='commercial';
 for(const axis of ['x','y']){const v=axis==='y',W=v?x.D:x.W,D=v?x.W:x.D,c=x.corridor,ew=x.elevator*(x.lifts===2?2:1),eh=x.elevator,court=x.court&&(v?{x:x.court.y,y:x.court.x,w:x.court.h,h:x.court.w}:x.court),point=x.layoutType==='point',one=x.stair==='one';
  const shopSide=x.streetSide||front,street=v?{top:'left',left:'top',bottom:'right',right:'bottom'}[shopSide]:shopSide,ys=new Set(x.layoutType==='gallery'?[D-c,0]:[D/2-c/2]);if(court){ys.add(court.y-c);ys.add(court.y+court.h);}
  if(shop&&street==='top')ys.add(SHOP-c);if(shop&&street==='bottom')ys.add(D-SHOP);
  // A plate too narrow to load both sides: the corridor may also run along a long wall, cores across the rest of the width.
  if((!x.layoutType||x.layoutType==='double')&&D<2*UNIT_MIN+c){ys.add(0);ys.add(rnd(D-c));}
  const dead=Math.max(0,(root.RULES?.VBBL?.deadEnd?.v||6)-2);
  // Stairs in line with the corridor at its ends: each stair turned to run along the corridor, against the exterior wall,
  // its door on the short end facing the corridor, so the corridor runs stair to stair with no dead end and the units take
  // both sides. The lift sits mid-run on either side.
  {const sl=x.stairL,sw=x.stairW;if(W>=2*sl+ew+2)for(const y0 of ys)for(const dy of [c/2-sw/2,0,c-sw])for(const lb of [false,true])for(const mirror of one?[false,true]:[false]){
   // each stair as close to its end wall as every storey's setbacks and recesses allow
   const sy=rnd(y0+dy),cores=[],fit=(k,end)=>{for(let t=0;t<=4+1e-9;t=rnd(t+.1)){const q={id:k,kind:'stair',x:rnd(end?W-sl-t:t),y:sy,w:sl,h:sw,rotation:0,doorSide:end?'left':'right',exterior:!!x.exteriorStair};if(ok(v?[Cl.swap(q)]:[q]))return q;}return null;};
   const A=fit('core-0',mirror),B=one?null:fit('core-1',true);
   // One stair in line at the far end of the corridor, turned 90° against the end wall, the other at the planning spacing near
   // the opposite end (study 24: the street-end stair turned into the corner beside the entry). The corridor stops at its door.
   if(!one&&!point&&!lb&&!mirror)for(const end of [true,false]){const I=fit('core-1',end);if(!I)continue;const tw=x.stairW,tl=x.stairL,ta=Math.max(.3,Math.min(5-tw/2,W*.2-tw/2));
    for(const below of [false,true]){const S={id:'core-0',kind:'stair',x:rnd(end?ta:W-ta-tw),y:rnd(below?y0+c:y0-tl),w:tw,h:tl,rotation:0,doorSide:below?'top':'bottom',exterior:!!x.exteriorStair},Lf={id:'lift',kind:'elevator',x:rnd((W-ew)/2),y:rnd(below?y0+c:y0-eh),w:ew,h:eh,rotation:0,doorSide:below?'top':'bottom'};
     const hc=[S,I,Lf],lo=end?S.x:I.x+sl,hi=end?I.x:S.x+tw,run={x:lo,y:y0,w:rnd(hi-lo),h:c},cs=v?hc.map(Cl.swap):hc,line=v?{x:run.y,y:run.x,w:run.h,h:run.w,axis:'y'}:{...run,axis:'x'},key=axis+JSON.stringify(cs.map(q=>[q.x,q.y,q.w]));
     if(run.w<=0||seen.has(key)||!ok(cs)||x.court&&E().overlap(line,x.court))continue;seen.add(key);
     out.push({axis,cores:cs,line,drawn:true,family:`line-${axis}-inline-end`,label:`${axis==='x'?'along the frontage':'along the depth'} · far stair in line at the corridor end · lift mid-run`});}}
   if(!A||!one&&!B)continue;cores.push(A);if(B)cores.push(B);
   // the lift mid-run, or tucked against a stair so the unit band either side stays whole
   const lifts=[(W-ew)/2,...(one?[]:[A.x+sl,B.x-ew])];for(const lx of lifts){const core3=[...cores,{id:'lift',kind:'elevator',x:rnd(lx),y:rnd(lb?y0+c:y0-eh),w:ew,h:eh,rotation:0,doorSide:lb?'top':'bottom'}];
   const lo=one?(mirror?0:A.x+sl):A.x+sl,hi=one?(mirror?A.x:W):B.x,run={x:lo,y:y0,w:rnd(hi-lo),h:c},cs=v?core3.map(Cl.swap):core3,line=v?{x:run.y,y:run.x,w:run.h,h:run.w,axis:'y'}:{...run,axis:'x'},key=axis+JSON.stringify(cs.map(q=>[q.x,q.y,q.w]));
   if(seen.has(key)||!ok(cs)||x.court&&E().overlap(line,x.court))continue;seen.add(key);
   out.push({axis,cores:cs,line,drawn:true,family:`line-${axis}-inline${lx===lifts[0]?'':'-lift'}`,label:`${axis==='x'?'along the frontage':'along the depth'} · stairs in line at the corridor ends · lift ${lx===lifts[0]?'mid-run':'beside a stair'}`});}}}
  // Compact: the two stairs only as far apart as exit separation needs, centred with the lift between them, so the corridor is
  // no longer than the stairs require and the units wrap the plate ends. On a plate too shallow to load both sides the corridor
  // runs beside cores set against a long wall, leaving the far side a full unit deep.
  const need=Math.min(Math.hypot(x.W,x.D)/2,9)+.2;
  for(const rot of [false,true]){const sw=rot?x.stairL:x.stairW,sl=rot?x.stairW:x.stairL,remote=Math.min(W-sw-.5,Math.max(W*.8-sw/2,W-sw-5)),cd=Math.max(sl,eh),compact=!one&&!point&&need>=sw+ew+.3&&W>=need+sw+1?{a:rnd((W-sw-need)/2),s2:rnd((W-sw+need)/2),compact:true}:null;
   const narrow=(!x.layoutType||x.layoutType==='double')&&D<2*UNIT_MIN+c&&D-cd-c>=4.5,yr=new Set([...(narrow?[rnd(cd),rnd(D-cd-c)]:[]),...ys]);
   const spreads=rot?[null,compact].filter((v,i)=>i===0||v):one||point?[null,{a:.3,end:true}]:[null,{a:Math.max(.3,c/2+dead-sw/2),s2:Math.min(W-sw-.3,W-c/2-dead-sw/2)},{a:0,s2:W-sw,ends:true},compact].filter((v,i)=>i===0||v);
   if(!rot&&shop&&(street==='left'||street==='right'))spreads.push({a:SHOP+.3,s2:one||point?SHOP+.3:Math.min(W-sw-.3,W-c/2-dead-sw/2)});
   for(const spread of spreads){const a=spread?spread.a:one?(W-sw-ew)/2:point?Math.max(.3,(W-9-sw)/2):Math.max(.3,Math.min(5-sw/2,W*.2-sw/2,remote-9)),s2=spread?.s2??(point?Math.min(remote,a+9):remote);if(!one&&s2-a<sw+ew+.3)continue;
    for(const y0 of spread?.compact?yr:ys)for(const below of [false,true])for(const mirror of [false,true])for(const lift of one?['stair']:spread?.compact?['centre']:['stair','centre'])for(const split of one||spread?[false]:[false,true]){
     const y=(h,b)=>b?y0+c:y0-h,door=b=>b?'top':'bottom',m=(q,w)=>mirror?W-q-w:q;
     const cores=[{id:'core-0',kind:'stair',x:rnd(m(a,sw)),y:rnd(y(sl,below)),w:sw,h:sl,rotation:0,doorSide:door(below),exterior:!!x.exteriorStair}];
     if(!one)cores.push({id:'core-1',kind:'stair',x:rnd(m(s2,sw)),y:rnd(y(sl,split?!below:below)),w:sw,h:sl,rotation:0,doorSide:door(split?!below:below),exterior:!!x.exteriorStair});
     const lx=lift==='centre'?(W-ew)/2:a+sw;cores.push({id:'lift',kind:'elevator',x:rnd(m(lx,ew)),y:rnd(y(eh,below)),w:ew,h:eh,rotation:0,doorSide:door(below)});
     const cs=v?cores.map(Cl.swap):cores,key=axis+JSON.stringify(cs.map(q=>[q.x,q.y,q.w]));if(seen.has(key)||!ok(cs))continue;seen.add(key);
     const L=v?{x:y0,y:0,w:c,h:x.D,axis:'y'}:{x:0,y:y0,w:x.W,h:c,axis:'x'},line=x.court&&E().overlap(L,x.court)||cs.some(q=>E().overlap(L,q))?null:L;
     out.push({axis,cores:cs,line,family:`line-${axis}-${spread?.compact?'compact':rot?'turned':spread?.end?'end':spread?.ends?'ends':spread?.a>SHOP?'shop':spread?'near':'planning'}${split?'-split':''}`,label:`${axis==='x'?'along the frontage':'along the depth'} · ${spread?.compact?(rot?'stairs turned along the corridor, ':'')+'stairs just far enough apart':rot?'stairs turned along the corridor':spread?spread.end?'core group at the plate end':spread.ends?'stairs at the plate ends':spread.a>SHOP?'core group behind the shop strip':'stairs near the ends':'stairs at planning spacing'}${split?' · stairs on opposite sides':''} · ${mirror?'mirrored':'as seeded'} · lift ${lift==='centre'?'centred':'beside a stair'}`});}}}}
 return out;}
// Entrance-led families, one per street frontage (corner sites get one per street). In a frame with the street at y = 0, an entry
// spine runs from the street inward; the primary stair and the lift sit on it just behind the entry (either side of the spine or
// stacked on one side), and a second stair, when the brief has two, sits at the far (lane) end to serve the rest of the plate.
function entranceSeeds(x,ctx,ok){const fr=frontages(ctx),out=[],seen=new Set(),c=x.corridor,sw=x.stairW,sl=x.stairL,ew=x.elevator*(x.lifts===2?2:1),eh=x.elevator,one=x.stair==='one';
 const streets=SIDES.filter(s=>fr[s].kind==='street');if(!streets.length)streets.push(x.streetSide||'top');
 const flip={top:'top',bottom:'bottom',left:'left',right:'right'},toO=(s,FW,FD)=>(r,door)=>{
  const R=s==='top'?{x:r.x,y:r.y,w:r.w,h:r.h}:s==='bottom'?{x:r.x,y:FD-r.y-r.h,w:r.w,h:r.h}:s==='left'?{x:r.y,y:r.x,w:r.h,h:r.w}:{x:FD-r.y-r.h,y:r.x,w:r.h,h:r.w};
  const d=s==='top'?flip[door]:s==='bottom'?{top:'bottom',bottom:'top',left:'left',right:'right'}[door]:s==='left'?{top:'left',bottom:'right',left:'top',right:'bottom'}[door]:{top:'right',bottom:'left',left:'top',right:'bottom'}[door];
  return {...R,x:rnd(R.x),y:rnd(R.y),doorSide:d};};
 for(const s of streets){const across=s==='top'||s==='bottom',FW=across?x.W:x.D,FD=across?x.D:x.W,T=toO(s,FW,FD),rec=x.moves?.recess?.on&&x.moves.recess.side===s?x.moves.recess:null;
  const offs=[...new Set([rec?rec.d+.3:.3,x.groundUse==='commercial'?Math.min(SHOP,FD-sl-6):null,Math.min(6,FD*.3)].filter(v=>v!=null&&v>=0).map(v=>Math.round(v*10)/10))];
  for(const ex of [...new Set([FW/2,FW*.35,FW*.65].map(v=>Math.round(v*10)/10))])for(const y0 of offs)for(const hand of [1,-1])for(const group of ['split','stack']){
   const L=ex-c/2,Rr=ex+c/2,left=w=>L-w,right=()=>Rr,cores=[];
   // stair w along the frontage, sl deep; lift 3 m along the frontage, ew deep (two lifts stack along the spine)
   const stairX=group==='split'?(hand>0?left(sw):right()):(hand>0?right():left(sw)),liftX=hand>0?right():left(eh);
   cores.push({id:'core-0',kind:'stair',...T({x:stairX,y:group==='stack'?y0+ew:y0,w:sw,h:sl},stairX<ex?'right':'left'),rotation:0,exterior:!!x.exteriorStair});
   cores.push({id:'lift',kind:'elevator',...T({x:liftX,y:y0,w:eh,h:ew},liftX<ex?'right':'left'),rotation:0});
   if(!one){const sx=hand>0?left(sw):right();cores.splice(1,0,{id:'core-1',kind:'stair',...T({x:sx,y:FD-sl-.3,w:sw,h:sl},sx<ex?'right':'left'),rotation:0,exterior:!!x.exteriorStair});}
   const key=JSON.stringify(cores.map(q=>[q.x,q.y]));if(seen.has(key)||!ok(cores))continue;seen.add(key);
   for(const axis of ['x','y'])out.push({axis,cores:cores.map(q=>({...q})),family:`entry-${s}-${group}`,label:`entrance-led · ${fr[s].label} · ${group==='split'?'stair and lift either side of the entry':'stair and lift together beside the entry'}${one?'':' · second stair toward the far side'} · ${axis==='x'?'frontage':'depth'} spine`});}}
 return out;}
// A core group (cores touching each other) that stops short of an exterior wall by no more than a corridor width leaves a
// sliver no room can use; the group is pushed flush to that wall instead, unless its door faces the wall or the move is
// blocked. Wider gaps stay: a unit can wrap into them.
function flush(cs,x,ok){const W=x.W,D=x.D,snap=(x.corridor||1.8)+.05,out=cs.map(q=>({...q})),seen=new Set();
 for(const q of out){if(seen.has(q))continue;const grp=[q];for(let i=0;i<grp.length;i++)for(const p of out)if(!grp.includes(p)&&E().attach(p,grp[i]))grp.push(p);grp.forEach(p=>seen.add(p));
  for(const side of SIDES){const x0=Math.min(...grp.map(p=>p.x)),y0=Math.min(...grp.map(p=>p.y)),x1=Math.max(...grp.map(p=>p.x+p.w)),y1=Math.max(...grp.map(p=>p.y+p.h)),gap={left:x0,right:W-x1,top:y0,bottom:D-y1}[side];
   if(gap<=.05||gap>=snap)continue;const facing=grp.filter(p=>{const e={left:p.x,right:p.x+p.w,top:p.y,bottom:p.y+p.h}[side];return Math.abs(e-({left:x0,right:x1,top:y0,bottom:y1}[side]))<.05;});if(facing.some(p=>p.doorSide===side))continue;
   const d={left:[-gap,0],right:[gap,0],top:[0,-gap],bottom:[0,gap]}[side],moved=grp.map(p=>({...p,x:rnd(p.x+d[0]),y:rnd(p.y+d[1])})),trial=out.map(p=>{const i=grp.indexOf(p);return i<0?p:moved[i];});
   if(ok(trial))grp.forEach((p,i)=>Object.assign(p,moved[i]));}}
 // then each core on its own, so a core sticking out of its group's line still meets the wall
 for(const q of out)for(const side of SIDES){const gap={left:q.x,right:W-q.x-q.w,top:q.y,bottom:D-q.y-q.h}[side];if(gap<=.05||gap>=snap||q.doorSide===side)continue;const t={...q,x:rnd(side==='left'?0:side==='right'?W-q.w:q.x),y:rnd(side==='top'?0:side==='bottom'?D-q.h:q.y)};if(ok(out.map(p=>p===q?t:p)))Object.assign(q,t);}
 return out;}
// Courtyard-loop families: with the corridor around the courtyard, the stairs sit on its exterior side at opposite ends of
// the loop (long side along the run, door onto it) and the lift in the middle of a run, so every unit reaches an exterior wall.
const OPP={top:'bottom',bottom:'top',left:'right',right:'left'};
function courtLanding(x){const q=x.court;if(!q||q.kind!=='u'||x.stair!=='one')return null;
 const side=q.side||'bottom',swap=side==='left'||side==='right',W=swap?x.D:x.W,D=swap?x.W:x.D;
 const to=r=>side==='top'?{...r,y:D-r.y-r.h}:side==='right'?{...r,x:r.y,y:r.x,w:r.h,h:r.w}:side==='left'?{...r,x:r.y,y:x.W-r.x-r.w,w:r.h,h:r.w}:{...r};
 const back=r=>side==='top'?{...r,y:D-r.y-r.h}:side==='right'?{...r,x:r.y,y:r.x,w:r.h,h:r.w}:side==='left'?{...r,x:x.W-r.y-r.h,y:r.x,w:r.h,h:r.w}:{...r};
 const a=to(q),cw=x.corridor,ew=x.elevator*(x.lifts===2?2:1),width=x.stairL+ew,deep=Math.max(x.stairW,x.elevator),gx=a.x+(a.w-width)/2,gy=a.y-deep;
 if(gy-cw<2.4||gx-cw<4.5||W-gx-width-cw<4.5)return null;
 const door={bottom:'top',top:'bottom',right:'left',left:'right'}[side],cores=[{id:'core-0',kind:'stair',x:gx,y:gy,w:x.stairL,h:x.stairW,exterior:!!x.exteriorStair},{id:'lift',kind:'elevator',x:gx+x.stairL,y:gy,w:ew,h:x.elevator}].map(r=>({...back(r),rotation:0,doorSide:door}));
 const left=Math.min(gx,a.x)-cw,right=Math.max(gx+width,a.x+a.w),start=gy-cw,end=a.y+Math.min(a.h*.5,6),network=[{x:left,y:start,w:right-left+cw,h:cw},{x:left,y:start,w:cw,h:end-start},{x:right,y:start,w:cw,h:end-start}].map(r=>{const t=back(r);return {...t,axis:t.w>=t.h?'x':'y'};});
 return {axis:swap?'y':'x',cores,network,family:'court-landing',label:'compact core at courtyard base · short wing corridors'};
}
function ringSeeds(x,ok){const ring=courtRing({...x,coreLayout:[]});if(!ring)return [];const out=[],seen=new Set(),sw=x.stairW,sl=x.stairL,ew=x.elevator*(x.lifts===2?2:1),eh=x.elevator,one=x.stair==='one',q=x.court;
 // a core of along × deep on the exterior side of run r at position t (0 start, 1 end, .5 middle), door onto the run
 const place=(r,t,along,deep,kind,id)=>{const h=r.axis==='x',outSide=h?(r.y+r.h/2<q.y+q.h/2?'top':'bottom'):(r.x+r.w/2<q.x+q.w/2?'left':'right'),len=h?r.w:r.h,a=(h?r.x:r.y)+Math.max(0,Math.min(len-along,(len-along)*t)),w=h?along:deep,d=h?deep:along;
  const c={id,kind,w,h:d,rotation:0,doorSide:OPP[outSide],x:h?a:outSide==='left'?r.x-deep:r.x+r.w,y:h?(outSide==='top'?r.y-deep:r.y+r.h):a};return {...c,x:rnd(c.x),y:rnd(c.y),...(kind==='stair'?{exterior:!!x.exteriorStair}:{})};};
 for(const [i,r1] of ring.entries())for(const [j,r2] of ring.entries()){if(!one&&j<i)continue;if(one&&j!==i)continue;for(const [t1,t2] of one?[[0,0],[1,1]]:[[0,1],[1,0]])for(const [al,dp] of [[sl,sw]])for(const lr of ring.slice().sort((m,n)=>Math.max(n.w,n.h)-Math.max(m.w,m.h)).slice(0,2)){
   const cores=[place(r1,t1,al,dp,'stair','core-0')];if(!one)cores.push(place(r2,t2,al,dp,'stair','core-1'));cores.push(place(lr,.5,ew,eh,'elevator','lift'));
   if(!one){const [p,m]=cores,d=Math.hypot(p.x+p.w/2-m.x-m.w/2,p.y+p.h/2-m.y-m.h/2);if(d<.6*Math.hypot(q.w+2*x.corridor,q.h+2*x.corridor))continue;}const key=JSON.stringify(cores.map(p=>[p.x,p.y,p.w]));if(seen.has(key)||!ok(cores))continue;seen.add(key);out.push({axis:'x',cores,ring:true,family:'court-loop',label:`corridor around the courtyard · stairs at ${one?'one end':'opposite ends'} · lift mid-run`});}}
 return out;}
// Compact landing (precedents P02, P08, P10): the stair and lift side by side, on a facade or at the plate centre, with one
// short landing in front of them that is the whole corridor; the dwellings open off it and the outer ones wrap its ends. One
// exit stair only: two stairs on one landing would sit closer than the exit separation allows.
function landingSeeds(x,ctx,ok){if(x.stair!=='one'||x.court)return [];const out=[],seen=new Set(),fr=frontages(ctx),sw=x.stairW,sl=x.stairL,ew=x.elevator*(x.lifts===2?2:1),eh=x.elevator,L=2.4,exterior=!!x.exteriorStair;
 const sides=[...new Set([SIDES.find(q=>fr[q].kind==='street')||x.streetSide||'top',SIDES.find(q=>fr[q].kind==='lane')].filter(Boolean))];
 // frame: the facade at y = 0; plan rectangles and door sides mapped back per facade
 const toO=(s,FD)=>r=>s==='top'?{...r}:s==='bottom'?{...r,y:FD-r.y-r.h}:s==='left'?{...r,x:r.y,y:r.x,w:r.h,h:r.w}:{...r,x:FD-r.y-r.h,y:r.x,w:r.h,h:r.w},door=(s,d)=>({top:{top:'top',bottom:'bottom',left:'left',right:'right'},bottom:{top:'bottom',bottom:'top',left:'left',right:'right'},left:{top:'left',bottom:'right',left:'top',right:'bottom'},right:{top:'right',bottom:'left',left:'top',right:'bottom'}})[s][d];
 const add=(s,FW,FD,gx,gy,back,ext,where)=>{const T=toO(s,FD),gw=sw+ew,depth=Math.max(sl,eh),dd=back?'top':'bottom',ly=back?gy-L:gy+depth;
  const cores=[{id:'core-0',kind:'stair',...T({x:gx,y:back?gy+depth-sl:gy,w:sw,h:sl}),rotation:0,doorSide:door(s,dd),exterior},{id:'lift',kind:'elevator',...T({x:gx+sw,y:back?gy+depth-eh:gy,w:ew,h:eh}),rotation:0,doorSide:door(s,dd)}].map(q=>({...q,x:rnd(q.x),y:rnd(q.y)}));
  const lb=T({x:gx-ext,y:ly,w:gw+2*ext,h:L}),line={...lb,x:rnd(Math.max(0,lb.x)),y:rnd(lb.y),w:rnd(lb.w),h:rnd(lb.h),axis:lb.w>=lb.h?'x':'y'},key=JSON.stringify(cores.map(q=>[q.x,q.y]))+ext+back;
  if(seen.has(key)||!ok(cores)||cores.some(q=>E().overlap(q,line))||line.x+line.w>x.W+1e-6||line.y+line.h>x.D+1e-6||line.y<-1e-6)return;seen.add(key);
  out.push({axis:line.axis,cores,line,drawn:true,family:`landing-${where}`,label:`compact landing · stair and lift ${where==='centre'?'at the plate centre':'on the '+fr[s].label} · landing ${fmt(line.w>=line.h?line.w:line.h)} m`});};
 for(const s of sides){const across=s==='top'||s==='bottom',FW=across?x.W:x.D,FD=across?x.D:x.W,gw=sw+ew;
  // on the facade, or as close to it as every storey's setbacks and recesses allow
  for(const ex of [...new Set([FW/2,FW*.35,FW*.65].map(v=>rnd(v-gw/2)))])for(const ext of [0,1.2,2.4])for(let gy=0;gy<=4+1e-9;gy=rnd(gy+.1)){const n=out.length;add(s,FW,FD,ex,gy,false,ext,s);if(out.length>n)break;}
  // at the plate centre, the landing on either side of the core
  for(const back of [false,true])for(const ext of [0,1.2,2.4])add(s,FW,FD,rnd(FW/2-gw/2),rnd(FD/2-Math.max(sl,eh)/2),back,ext,'centre');}
 return out;}
// Central core for a single-core scheme (one exit stair, or a scissor core): the stair and lift sit at mid-depth across the
// plate with a short lobby corridor along them, so the homes take the four quadrants and every door is a few steps from the
// core (after the architect's single-egress and scissor-stair reference plans). The stair lies along the lobby (its doors at
// the landings) or across it; the lift sits beside the stair or across the lobby; the lobby spans the plate or stops a
// dead-end length past the core.
function centralSeeds(x,ok){if(x.stair!=='one'||x.exteriorStair||x.court)return [];const out=[],seen=new Set(),Cl=C(),c=x.corridor,ew=x.elevator*(x.lifts===2?2:1),eh=x.elevator,arm=Math.max(2,(root.RULES?.VBBL?.deadEnd?.v||6)-.3);
 for(const axis of ['x','y']){const v=axis==='y',W=v?x.D:x.W,D=v?x.W:x.D;
  for(const along of x.scissorCore?[true]:[true,false]){const sw=along?x.stairL:x.stairW,sh=along?x.stairW:x.stairL;
   for(const across of [false,true]){const gw=across?Math.max(sw,ew):sw+ew;if(gw+4>W)continue;
    for(const below of [true,false])for(const mirror of [false,true]){if(across&&mirror)continue;
     const depth=across?0:Math.max(sh,eh),y0=rnd(across?D/2-c/2:below?D/2-(c+depth)/2:D/2-(c+depth)/2+depth),gx=rnd((W-gw)/2),top=b=>b?'top':'bottom';
     const stair={id:'core-0',kind:'stair',x:rnd(mirror?gx+gw-sw:gx),y:rnd(below?y0+c:y0-sh),w:sw,h:sh,rotation:0,doorSide:top(below),exterior:false};
     const lift=across?{id:'lift',kind:'elevator',x:rnd((W-ew)/2),y:rnd(below?y0-eh:y0+c),w:ew,h:eh,rotation:0,doorSide:top(!below)}:{id:'lift',kind:'elevator',x:rnd(mirror?gx:gx+sw),y:rnd(below?y0+c:y0-eh),w:ew,h:eh,rotation:0,doorSide:top(below)};
     for(const reach of [Infinity,arm]){const a0=rnd(Math.max(0,gx-reach)),a1=rnd(Math.min(W,gx+gw+reach));if(reach!==Infinity&&a0<=0&&a1>=W)continue;
      const cs=v?[stair,lift].map(Cl.swap):[stair,lift],line=v?{x:y0,y:a0,w:c,h:a1-a0,axis:'y'}:{x:a0,y:y0,w:a1-a0,h:c,axis:'x'},key=axis+JSON.stringify(cs.map(q=>[q.x,q.y,q.w]))+line.w+line.h;
      if(seen.has(key)||!ok(cs))continue;seen.add(key);
      out.push({axis,cores:cs,line,drawn:true,family:`central-${axis}`,label:`central core · lobby ${axis==='x'?'across the frontage':'along the depth'}${reach===Infinity?'':' · short lobby'} · stair ${along?'along':'across'} the lobby · lift ${across?'across the lobby':'beside the stair'}`});}}}}}
 return out;}
// A scissor core is seeded as a single interior stair of scissor length, then typed: its two doors come from the core itself.
function seeds(x,ctx){if(x.stair==='scissor'){const y={...x,stair:'one',stairL:Math.max(x.stairL,7.2),exteriorStair:false,scissorCore:true},ok=blockers(y,ctx),seen=new Set();
  return centralSeeds(y,ok).concat(ringSeeds(y,ok),entranceSeeds(y,ctx,ok),lineSeeds(y,ctx,ok)).map(q=>({...q,cores:flush(q.cores,y,ok).map(c=>c.kind==='stair'?{...c,kind:'scissor',exterior:false}:c)})).filter(q=>{const k=q.axis+JSON.stringify(q.cores.map(p=>[p.x,p.y,p.w]));if(seen.has(k))return false;seen.add(k);return true;});}
 const ok=blockers(x,ctx),seen=new Set();const landing=courtLanding(x);return (landing&&ok(landing.cores)?[landing]:[]).concat(centralSeeds(x,ok),ringSeeds(x,ok),landingSeeds(x,ctx,ok),entranceSeeds(x,ctx,ok),lineSeeds(x,ctx,ok)).map(q=>({...q,cores:flush(q.cores,x,ok)})).filter(q=>{const k=q.axis+JSON.stringify(q.cores.map(p=>[p.x,p.y,p.w]));if(seen.has(k))return false;seen.add(k);return true;});}

// ---------- Ground-floor entrance and discharge ----------
// Openings: where ground-floor circulation meets the outside, and which frontage it faces. A corridor end or side on the outer
// face of the plate (the entry recess included) is an opening; so is the exterior side of a switched-on Lobby that touches the
// corridor. A stair beside an exterior wall is not assumed to discharge there.
function openings(l,ctx){const g=l.g,EPS=1e-4,fr=frontages(ctx),inBuilt=(px,py)=>g.built.some(b=>px>b.x+EPS&&px<b.x+b.w-EPS&&py>b.y+EPS&&py<b.y+b.h-EPS),out=[];
 for(const q of g.corridors)for(const [side,p,probe] of [['top',[q.x+q.w/2,q.y],[q.x+q.w/2,q.y-.3]],['bottom',[q.x+q.w/2,q.y+q.h],[q.x+q.w/2,q.y+q.h+.3]],['left',[q.x,q.y+q.h/2],[q.x-.3,q.y+q.h/2]],['right',[q.x+q.w,q.y+q.h/2],[q.x+q.w+.3,q.y+q.h/2]]])
  if(!inBuilt(...probe))out.push({p,side,kind:fr[side]?.kind||'side',via:'corridor',extra:0});
 // a lobby drawn in several parts is one room: the entry on one part may reach the corridor through another
 const lobbies=(l.rooms||[]).filter(r=>r.on!==false&&/lobby/i.test(r.name));
 for(const part of lobbies){const en=F().entryFor(part,g),room=en&&(lobbies.find(p=>g.corridors.some(c=>E().attach(p,c)))),q=room&&g.corridors.find(c=>E().attach(room,c));if(!en||!q)continue;
  const hx=Math.min(room.x+room.w,q.x+q.w)-Math.max(room.x,q.x),cp=hx>.15?[(Math.max(room.x,q.x)+Math.min(room.x+room.w,q.x+q.w))/2,Math.abs(room.y+room.h-q.y)<.05?q.y:q.y+q.h]:[Math.abs(room.x+room.w-q.x)<.05?q.x:q.x+q.w,(Math.max(room.y,q.y)+Math.min(room.y+room.h,q.y+q.h))/2];
  out.push({p:cp,side:en.side,kind:fr[en.side]?.kind||'side',via:'lobby',extra:Math.abs(en.x-cp[0])+Math.abs(en.y-cp[1])});}
 return out;}
// Walkable distances along the ground-floor corridor graph, measured separately: street or lane opening → lift (the everyday
// entrance) and each exit stair → its nearest street or lane opening (discharge). Street is preferred, the lane next; a side yard
// does not count. Nothing found stays unresolved (null), never 0.
function routes(r,ctx){const l=r.levels?.[0];if(!l?.g)return null;const g=l.g,ops=openings(l,ctx),stairs=g.cores.filter(c=>c.kind==='stair'||c.kind==='scissor'),lift=g.cores.find(c=>c.kind==='elevator');
 const K=k=>k==='street'?0:k==='lane'?1:2,doors=ops.map((q,i)=>({id:i+1,door:q.p}));
 const dist=cores=>{if(!doors.length||!cores.length)return [];const rg=E().routeGraph({...g,cores:cores.map(c=>({...c,kind:'stair'}))},doors);return rg.paths.map((p,i)=>p.toExits.map(t=>Number.isFinite(t.distance)?t.distance+ops[i].extra:null));};
 const toStairs=dist(stairs),toLift=lift?dist([lift]):toStairs.map(row=>[row.find(v=>v!=null)??null]),pick=col=>{let best=null;ops.forEach((q,i)=>{const d=col(i),k=K(q.kind);if(d==null||k>1)return;if(!best||k<best.k||k===best.k&&d<best.d)best={k,d,kind:q.kind,side:q.side,via:q.via};});return best;};
 // A stair whose face lies on a street or lane wall on the ground floor discharges straight out through its own exterior door.
 const EPS=1e-4,outside=(px,py)=>!g.built.some(b=>px>b.x+EPS&&px<b.x+b.w-EPS&&py>b.y+EPS&&py<b.y+b.h-EPS),frs=frontages(ctx);
 const direct=c=>{let best=null;for(const [side,px,py] of [['top',c.x+c.w/2,c.y-.3],['bottom',c.x+c.w/2,c.y+c.h+.3],['left',c.x-.3,c.y+c.h/2],['right',c.x+c.w+.3,c.y+c.h/2]]){const kind=frs[side]?.kind||'side',k=K(kind);if(k>1||!outside(px,py))continue;if(!best||k<best.k)best={k,d:0,kind,side,via:'stair door'};}return best;};
 const via=stairs.map((c,si)=>pick(i=>toStairs[i]?.[si]??null)),discharge=via.map((v,si)=>{const d=direct(stairs[si]);return d&&(!v||d.k<=v.k)?d:v;});
 return {entrance:pick(i=>toLift[i]?.[0]??null),discharge,lift:!!lift,openings:ops};}
// When no ground-floor corridor reaches a street (or, for discharge, the lane), try a straight ground-floor entry corridor from the
// network to that frontage: through the entry recess, at the lift door, or at a stair door. It exists on the ground floor only.
function addEntrance(input,r,ctx){const rt=routes(r,ctx);if(!rt||rt.entrance?.k===0&&rt.discharge.every(Boolean))return {x:input,r};
 const fr=frontages(ctx),l=r.levels[0],g=l.g,cw=input.corridor,half=cw/2,want=SIDES.filter(s=>fr[s].kind==='street').concat(rt.discharge.every(Boolean)?[]:SIDES.filter(s=>fr[s].kind==='lane'));
 // candidate stubs are gathered first, then fitted shortest first; the first that gives a street entrance and a discharge for
 // every stair ends the search (a shorter stub costs less floor)
 let best=null;const stubs=[];for(const s of want){const across=s==='top'||s==='bottom',rec=input.moves?.recess?.on&&input.moves.recess.side===s?input.moves.recess:null,at=[];
  // through the recess, on the line of each corridor run that points at this frontage, or level with a core door
  if(rec)at.push(recessCentre(input));for(const q of g.corridors)if((q.w>=q.h)!==across)at.push(across?q.x+q.w/2:q.y+q.h/2,across?q.x-half:q.y-half,across?q.x+q.w+half:q.y+q.h+half);for(const c of g.cores){const d=C().door(c);at.push(across?d.point[0]:d.point[1]);
   // beside each core, where a stub costs least floor: the core and the stub together take one strip
   at.push(across?c.x-half:c.y-half,across?c.x+c.w+half:c.y+c.h+half);}
  at.push(half,(across?input.W:input.D)-half);
  for(const v of [...new Set(at.map(q=>Math.round(q*10)/10))]){const lo=v-half,hi=v+half;
   // the nearest corridor edge the stub can meet, running straight in from the frontage
   const head=g.corridors.filter(q=>across?q.x<=lo+.01&&q.x+q.w>=hi-.01:q.y<=lo+.01&&q.y+q.h>=hi-.01).map(q=>s==='top'?q.y:s==='bottom'?q.y+q.h:s==='left'?q.x:q.x+q.w);
   const side=g.corridors.filter(q=>across?Math.abs(q.x-hi)<.01||Math.abs(q.x+q.w-lo)<.01:Math.abs(q.y-hi)<.01||Math.abs(q.y+q.h-lo)<.01).map(q=>s==='top'?q.y+cw:s==='bottom'?q.y+q.h-cw:s==='left'?q.x+cw:q.x+q.w-cw),hits=head.concat(side);if(!hits.length)continue;
   const e=s==='top'||s==='left'?Math.min(...hits):Math.max(...hits),stub=s==='top'?{x:lo,y:0,w:cw,h:e}:s==='bottom'?{x:lo,y:e,w:cw,h:input.D-e}:s==='left'?{x:0,y:lo,w:e,h:cw}:{x:e,y:lo,w:input.W-e,h:cw};
   if(Math.min(stub.w,stub.h)<cw-1e-6||Math.max(stub.w,stub.h)<.3||g.cores.concat(input.exclusions||[]).some(q=>E().overlap(q,stub)))continue;
   const q={x:rnd(stub.x),y:rnd(stub.y),w:rnd(stub.w),h:rnd(stub.h)};if(!stubs.some(p=>p.x===q.x&&p.y===q.y&&p.w===q.w&&p.h===q.h))stubs.push(q);}}
 for(const q of stubs.sort((a,b)=>a.w*a.h-b.w*b.h)){const trial={...input,groundCorridors:(input.groundCorridors||[]).concat(q)},g2=F().generate({...trial,geometryOnly:false,corridorDraft:false},ctx);if(!g2.ok)continue;
  const t=routes(g2,ctx),k=(t.entrance?t.entrance.k:3)+(t.discharge.every(Boolean)?0:2);if(!best||k<best.k||k===best.k&&g2.net>best.r.net)best={k,x:trial,r:g2};if(best.k===0)break;}
 const k0=(rt.entrance?rt.entrance.k:3)+(rt.discharge.every(Boolean)?0:2);return best&&best.k<k0?{x:best.x,r:best.r}:{x:input,r};}

// ---------- Checks: gate first, rank second ----------
// Each check: {id, status: pass | fail | unknown | notApplicable, category, scope, source, message}.
// category: geometry (engine), enacted (encoded current rule), draft (unverified text: never a verified pass),
// report (always shown, never gates: nothing implemented can verify it yet).
const quota=(N,mix)=>({family:Math.ceil((mix?.two||0)*N-1e-9),three:Math.ceil((mix?.three||0)*N-1e-9)});
// Exit separation: the least straight-line distance between two stair doors, and the VBBL 3.4.2.3 minimum for it, half the
// floor's greatest diagonal but no more than 9 m where a public corridor serves the floor. The plate stands in for the floor.
function separation(x){const st=(x.coreLayout||[]).filter(c=>c.kind==='stair'||c.kind==='scissor');if(st.length<2)return null;const pts=st.map(c=>C().door(c).point);let d=Infinity;
 for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)d=Math.min(d,Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1]));return {d,need:Math.min(Math.hypot(x.W,x.D)/2,9)};}
// Longest dead end on a floor. A ground-floor entrance stub that ends at a door on the plate edge leads outside, so it is an
// exit route, not a dead end.
function deadOf(l,x){const ds=l.route?.deadEnds;if(!ds)return l.route?.deadEnd;const W=x.W,D=x.D,out=p=>p[0]<.05||p[1]<.05||p[0]>W-.05||p[1]>D-.05,inStub=p=>(x.groundCorridors||[]).some(q=>p[0]>=q.x-.05&&p[0]<=q.x+q.w+.05&&p[1]>=q.y-.05&&p[1]<=q.y+q.h+.05);
 const kept=ds.filter(d=>!(l.level===1&&out(d.points[0])&&inStub(d.points[0])));return kept.length?Math.max(...kept.map(d=>d.length)):0;}
function checks(r,x,ctx){const out=[],add=(id,status,category,source,message,scope='building')=>out.push({id,status,category,scope,source,message});
 const V=root.RULES?.VBBL,lim=limits(x),lv=r.levels||[],units=r.allUnits||[],N=units.length,paths=lv.flatMap(l=>l.route?.paths||[]);
 // an upper floor that fits no unit is a failed layout, not an unmeasured one
 // an upper floor with no unit, or a building with no dwelling at all, is not a plan
 const empty=r.ok?(r.levels||[]).find(l=>l.level>1&&!(l.units||[]).length)||(!(r.allUnits||[]).length&&(r.levels||[])[0]):null;
 add('geometry',r.ok&&!empty?'pass':'fail','geometry','Engine',!r.ok?(r.errors||['Geometry blocked.'])[0]:empty?`Floor ${empty.level} fits no unit.`:'No overlapping spaces; every core reaches the corridor.');
 const unreached=paths.filter(p=>!Number.isFinite(p.distance)).length;
 add('access',!paths.length?'unknown':unreached?'fail':'pass','geometry','Engine',!paths.length?'No unit doors to measure.':unreached?`${unreached} unit door${unreached>1?'s have':' has'} no connected route to an exit stair.`:'Every unit door reaches an exit stair along the corridor.');
 // Unknown or non-finite routes stay unresolved; they never become 0 m.
 const travel=paths.length&&!unreached?Math.max(...paths.map(p=>p.distance)):null,sp=x.sprinklered!==false;
 add('travel',travel==null?'unknown':travel<=lim.travel+1e-6?'pass':'fail','enacted',x.travel>0?'Entered study limit':`VBBL ${V?.travel?.clause||'3.4.2.5.(1)'} · ${sp?'sprinklered (assumed)':'not sprinklered'}`,travel==null?'Travel distance unresolved.':`Longest unit-door route ${fmt(travel)} m against ${lim.travel} m. A corridor screen, not full exit compliance.`);
 const ends=lv.filter(l=>l.units?.length).map(l=>deadOf(l,x)),dead=ends.length&&ends.every(Number.isFinite)?Math.max(...ends):null;
 add('deadEnd',dead==null?'unknown':dead<=lim.dead+1e-6?'pass':'fail','enacted',x.deadEnd>0?'Entered study limit':`VBBL ${V?.deadEnd?.clause||'3.3.1.9.(5)'}`,dead==null?'Dead-end length unresolved.':`Longest dead end ${fmt(dead)} m against ${lim.dead} m.`);
 // Family mix counts dwellings by bedrooms (2+ includes 3+); commercial premises and rooms are not dwellings.
 const mix=ctx?.mix;if(!mix)add('mix','unknown','enacted','R3 §2.2.6','No unit-mix requirement resolved for this site.');
 else{const q=quota(N,mix),fam=units.filter(u=>(u.beds||0)>=2).length,three=units.filter(u=>(u.beds||0)>=3).length;add('mix',fam>=q.family&&three>=q.three?'pass':'fail','enacted',`R3 ${mix.clause||'§2.2.6'}`,`${N} dwellings need ${q.family} with 2+ bedrooms (${fam} planned), including ${q.three} with 3+ (${three} planned).`);}
 add('density',!r.ceiling?'unknown':r.countable<=r.ceiling+.1?'pass':'fail','enacted','R3 FSR · step 1 reference',!r.ceiling?'No floor-area ceiling resolved.':`${fmt(r.countable,0)} m² countable against ${fmt(r.ceiling,0)} m² permitted.`);
 // Court width is a design guideline: a light well is kept, and flagged, rather than refused.
 if(x.court){const m=Math.min(x.court.w,x.court.h),full=m>=COURT_MIN-1e-6;add('court',full?'pass':'fail','guideline','CDDG S1.4.3 · applied by analogy',full?`Courtyard ${fmt(x.court.w)} × ${fmt(x.court.h)} m clear.`:`Light well ${fmt(x.court.w)} × ${fmt(x.court.h)} m, under the ${COURT_MIN} m courtyard width: daylight, privacy and fire separation across it need review.`);}
 if(N<=8)add('useBranch','unknown','enacted','R3 §2.2',`${N} dwellings: at eight or fewer the apartment provisions may not apply; the applicable use branch needs checking.`);
 if(x.stair==='scissor'){const sc=V?.scissor||{storeyCap:6,areaCap:600},A=Math.max(0,...(r.levels||[]).map(l=>(l.g?.built||[]).reduce((t,b)=>t+b.w*b.h,0))),two=(r.levels||[]).filter(l=>(l.units||[]).length).every(l=>(l.route?.exits||[]).filter(e=>e.point).length>=2);
  add('scissor',x.floors>sc.storeyCap||A>sc.areaCap+1e-6||!two?'fail':'unknown','enacted','VBBL 2025 3.4.2.3.(5)–(6)',!two?'The scissor core needs a door at each end landing onto the corridor on every floor.':x.floors>sc.storeyCap||A>sc.areaCap+1e-6?`Scissor stair limited to ${sc.storeyCap} storeys and ${sc.areaCap} m² building area: ${x.floors} storeys, ${fmt(A,0)} m².`:`Two exits through one scissor core, ${x.floors} storeys, ${fmt(A,0)} m² building area; the exit doors need be no more than ${sc.sepCap??4.5} m apart (3.4.2.3.(5)). The air-leakage barrier and smoke-tight separation between the stairs: verify.`);}
 // VBBL 2025 Subsection 3.2.10 (By-law 14576): the measurable limits fail the plan; the exterior stair and passageway it requires
 // (the tool draws the stair inside the plate) stay unresolved, never a pass.
 if(x.stair==='one'){const se=V?.singleExit||{storeyCap:6,height:18,unitsLow:6,unitsHigh:4,travel:25},src=`VBBL 2025 ${se.clause||'3.2.10'} (${se.bylaw||'By-law 14576'})`;
  if(x.floors<=(V?.oneExitStoreys?.v||2))add('singleExit','unknown','enacted','VBBL 2025 3.4.2.1.(2)',`${x.floors} storeys: one exit may be allowed by 3.4.2.1.(2) (occupant load ≤ 60, floor area and travel limits).`);
  else{const up=(x.commercial?x.groundFtf+(x.floors-2)*x.ftf:(x.floors-1)*x.ftf),over=lv.filter(l=>(l.units||[]).length>(l.level<=3?se.unitsLow:se.unitsHigh)),far=travel!=null&&travel>se.travel+1e-6,bad=[x.floors>se.storeyCap?`${x.floors} storeys, over ${se.storeyCap}`:'',up>se.height+1e-6?`uppermost floor ${fmt(up)} m above the first, over ${se.height} m`:'',over.length?`floor${over.length>1?'s':''} ${over.map(l=>l.level).join(', ')} over the ${se.unitsLow} / ${se.unitsHigh} units per floor`:'',far?`longest route ${fmt(travel)} m, over ${se.travel} m`:''].filter(Boolean);
   add('singleExit',bad.length?'fail':'unknown','enacted',src,bad.length?`One exit stair: ${bad.join('; ')}.`:`Within the 3.2.10 limits the plan shows (storeys, units per floor, travel). The one exit must be an exterior stair reached by an exterior exit passageway, ≥ 50% open: this plan draws an interior stair, so that is unresolved.`);}}
 // Everyday entrance and emergency discharge, measured separately on the ground floor; unresolved stays unresolved.
 const rt=routes(r,ctx);if(rt){const e=rt.entrance,ds=rt.discharge,ok=ds.length&&ds.every(Boolean);
  {const sp=separation(x);if(sp)add('separation',sp.d>=sp.need-1e-6?'pass':'fail','enacted','VBBL 3.4.2.3',`Exit stairs ${fmt(sp.d)} m apart, door to door, against ${fmt(sp.need)} m (half the floor diagonal, 9 m at most with a public corridor).`);}
  // lobby: on the street side and on the corridor, so the entrance reaches a stair and the lifts without passing through a unit
  {const lb=(r.levels?.[0]?.rooms||[]).filter(q=>q.name==='Lobby'&&q.on!==false&&!q.unplaced),g0=r.levels?.[0]?.g;if(lb.length&&g0){const onCorr=lb.some(q=>g0.corridors.some(k=>E().attach(q,k))),face=x.streetSide||'top',open=(px,py)=>!g0.built.some(b=>px>b.x&&px<b.x+b.w&&py>b.y&&py<b.y+b.h),along=(q,f)=>{const n=Math.max(2,Math.ceil((f==='top'||f==='bottom'?q.w:q.h)/.5));return Array.from({length:n},(_,i)=>(i+.5)/n);},street=lb.some(q=>along(q,face).some(t=>face==='top'?open(q.x+t*q.w,q.y-.05):face==='bottom'?open(q.x+t*q.w,q.y+q.h+.05):face==='left'?open(q.x-.05,q.y+t*q.h):open(q.x+q.w+.05,q.y+t*q.h)));
   add('lobby',onCorr&&street?'pass':'unknown','geometry','Ground floor',onCorr&&street?'Lobby on the street side, opening onto the corridor that serves the stairs and lifts.':!street?'The lobby does not reach the street face: the main entrance is unresolved.':'The lobby does not open onto the corridor: residents would pass through another room to reach a stair or lift.');}}
  add('entrance',e?'pass':'unknown','geometry','Ground-floor route',e?`Entrance from the ${e.kind} to the ${rt.lift?'lift':'stair'}: ${fmt(e.d)} m along the ${e.via}.`:'No ground-floor corridor or lobby reaches the street or lane: the entrance route is unresolved.');
  add('discharge',ok?'pass':'unknown','geometry','Ground-floor route',ok?ds.map((d,i)=>`stair ${i+1} to the ${d.kind} ${fmt(d.d)} m`).join(', ').replace(/^./,m=>m.toUpperCase())+'. Walkable along the corridor; exit separation and discharge design need review.':'A stair has no walkable ground-floor route to the street or lane: its discharge is unresolved.');}
 add('rooms','unknown','report','R3 §4.4','Bedroom counts are schematic capacity. Room layouts and a window for every habitable room are not verified yet.');
 return out;}
// pass: every implemented gating check passes. study: something is unresolved or a draft rule fails. fail: a geometry or
// encoded rule fails; such a plan is never applied automatically.
function tier(cs){if(cs.some(c=>c.status==='fail'&&(c.category==='geometry'||c.category==='enacted')))return 'fail';return cs.some(c=>c.category!=='report'&&(c.status==='unknown'||c.status==='fail'))?'study':'pass';}

// ---------- Dead-end trim ----------
// The router packs units without end caps, so it never sees the gain from cutting a run that carries on past the last
// door it serves. Here each dead end is cut back, longest first: flush with its junction, else leaving a short hook.
// Every trial refits all floors (caps and leftovers as the plan will show them) and is kept when it loses no net area,
// or, for a dead end over the limit, no more than the corridor it removes.
function trimDeadEnds(input,r,ctx){let x=input,cur=r;const cw=x.corridor,half=cw/2,lim=limits(x).dead,memo=new Map(),gen=q=>{const k=JSON.stringify(q.freeCorridors);if(!memo.has(k))memo.set(k,F().generate({...q,geometryOnly:false,corridorDraft:false},ctx));return memo.get(k);};
 const corr=g=>(g.levels||[]).reduce((s,l)=>s+(l.ledger?.corridors||0),0)/Math.max(1,(g.levels||[]).length),near=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<half+.05;
 for(let it=0;it<8;it++){const ends=(cur.levels||[]).flatMap(l=>l.route?.deadEnds||[]).filter(d=>d.length>=1.2).sort((p,q)=>q.length-p.length);let done=false;
  for(const d of ends){const p=d.points[0],cs=x.freeCorridors||[],i=cs.findIndex(c=>{const h=c.w>=c.h;return near(p,h?[c.x,c.y+c.h/2]:[c.x+c.w/2,c.y])||near(p,h?[c.x+c.w,c.y+c.h/2]:[c.x+c.w/2,c.y+c.h]);});
   if(i<0)continue;const c=cs[i],h=c.w>=c.h,k=h?'x':'y',size=h?'w':'h',atStart=near(p,h?[c.x,c.y+c.h/2]:[c.x+c.w/2,c.y]);
   // Stop the run at its last door. The run past the junction's far face is the dead end less half a width; stops from flush
   // with the junction to one step short of the tip are tried (at most a dozen), the flats either side taking the corridor beyond
   // the stop. Comparable unit areas and mixes prefer the shorter corridor.
   // Within the limit the current run competes and a stop may not lose unit area. Over the limit only stops that bring the dead
   // end within it count, and only while they keep 80% of the unit area: a plan that passes by giving up more is not a fix, and
   // the search tries core positions that avoid the dead end instead.
   // within the limit, short dead ends are left and the sweep is coarser; over it, every 0.6 m counts
   const over=d.length>lim+1e-6;if(!over&&d.length<2.4)continue;const span=d.length-half-.5,top=over?Math.min(span,lim-half-.3):span,step=Math.max(over?.6:1.2,Math.ceil(top/11/.3)*.3),keeps=[0];for(let v=step;v<=top+1e-6;v+=step)keeps.push(Math.round(v*10)/10);if(over&&top>0&&!keeps.includes(Math.round(top*10)/10))keeps.push(Math.round(top*10)/10);
   // within the limit the current plan competes too, and a stop may not lose unit area
   // Also try the last-door stop, with 0.6 m beyond its centre, considering every floor.
   const axis=h?0:1,tip=atStart?c[k]:c[k]+c[size],doors=cur.levels.flatMap(l=>l.units.filter(u=>u.door&&Math.abs(u.door[1-axis]-(h?c.y+half:c.x+half))<=half+.05&&u.door[axis]>=c[k]&&u.door[axis]<=c[k]+c[size]).map(u=>Math.abs(u.door[axis]-tip)));
   if(doors.length){const cut=Math.min(...doors)-.6,keep=d.length-half-cut;if(cut>=.5&&keep>=0&&keep<=top)keeps.push(keep);}
   const tried=over?[]:[{trial:x,g:cur}];
   for(const keep of keeps){const cut=Math.round((d.length-half-keep)*10)/10;if(cut<.5)continue;const len=Math.round((c[size]-cut)*10)/10;
    let next=cs.map((q,j)=>j!==i?{...q}:{...q,[size]:len,...(atStart?{[k]:Math.round((q[k]+cut)*10)/10}:{})}).filter(q=>Math.min(q.w,q.h)>=cw-1e-6);
    // a run cut back to a bare junction square folds into the run it crosses, so that run's band reaches the corner
    const sq=next.find(q=>Math.max(q.w,q.h)<=cw+.05);if(sq){const t=next.find(q=>q!==sq&&E().overlap(q,sq));if(t){const th=t.w>=t.h,a=th?'x':'y',sz=th?'w':'h',lo=Math.min(t[a],sq[a]),hi=Math.max(t[a]+t[sz],sq[a]+sq[sz]);Object.assign(t,{[a]:lo,[sz]:Math.round((hi-lo)*10)/10});next=next.filter(q=>q!==sq);}}
    next=next.filter((q,j)=>!next.some((v,m)=>m!==j&&E().inside(q,v)));
    if(!next.length)continue;const trial={...x,freeCorridors:next},g=gen(trial);if(!g.ok)continue;
    const stop=h?[atStart?c.x+cut:c.x+len,c.y+half]:[c.x+half,atStart?c.y+cut:c.y+len];
    if(g.levels.some((l,j)=>cur.levels[j].units.length&&!l.units.length||l.route.deadEnd>Math.max(lim,cur.levels[j].route.deadEnd)+.01||over&&l.route.deadEnds.some(e=>near(e.points[0],stop)&&e.length>lim+.01)))continue;
    tried.push({trial,g});}
   // Preserve unit area (and, within the limit, the number of homes); among comparable fits, reclaim corridor before
   // fine-tuning the mix.
   const gross=cur.levels.reduce((s,l)=>s+(l.ledger?.built||0),0)||1,mix=g=>{const us=g.allUnits||[],N=us.length||1;return (x.types||[]).reduce((s,t)=>s+Math.abs(us.filter(u=>u.type===t.key).length/N-t.share/100),0);},floor=over?.8*usable(cur,x):usable(cur,x)-.5,big=g=>(g.allUnits||[]).some(u=>{const t=(x.types||[]).find(t=>t.key===u.type);return t&&u.net>t.max*1.05+.01;}),bigNow=big(cur),pool=tried.filter(t=>usable(t.g,x)>=floor&&(t.g.count||0)>=Math.floor((cur.count||0)*.85)&&(bigNow||!big(t.g)||(t.g.count||0)>=(cur.count||0))),top1=Math.max(...pool.map(t=>usable(t.g,x)),-Infinity);
   const fits=pool.filter(t=>usable(t.g,x)>=top1-SEARCH.band*gross),bestMix=Math.min(...fits.map(t=>mix(t.g)),Infinity);
   const best=fits.filter(t=>mix(t.g)<=bestMix+.05).sort((p,q)=>corr(p.g)-corr(q.g)||mix(p.g)-mix(q.g))[0];
   if(best&&best.g!==cur){x=best.trial;cur=best.g;done=true;}
   if(done)break;}
  if(!done)break;}
 return {x,r:cur};}

// ---------- Family quota repair ----------
// When the building falls short of the 2+/3+ bedroom minimums, merge neighbouring units in one strip into a family unit,
// fewest-loss pairs first, floor by floor, re-counting N after every merge (a merge shrinks the denominator too). When no strip
// holds such a pair (a small plate packed in several strips), two units sharing a wall are joined into one, as a user edit would.
function repairMix(input,r,ctx){if(!ctx?.mix)return {x:input,r};let x=input,cur=r;const tried=new Set(),inner=u=>{const p=(u.parts||[u]).reduce((a,b)=>a.w*a.h>=b.w*b.h?a:b);return [rnd(p.x+p.w/2),rnd(p.y+p.h/2)];};
 for(let it=0;it<24;it++){const us=cur.allUnits||[],N=us.length,q=quota(N,ctx.mix),fam=us.filter(u=>(u.beds||0)>=2).length,three=us.filter(u=>(u.beds||0)>=3).length;if(fam>=q.family&&three>=q.three)break;
  const need=three<q.three?3:2,type=(x.types||[]).filter(t=>t.beds>=need).sort((a,b)=>a.beds-b.beds)[0];if(!type)break;let best=null;
  for(const l of cur.levels)for(const u of l.units)for(const v of l.units){if(u===v||u.band==null||u.band!==v.band||Math.abs(u.z-v.a)>.05||(u.beds||0)>=need||(v.beds||0)>=need)continue;
   const key=[l.level,u.band,u.z.toFixed(2)].join(':'),net=u.net+v.net;if(tried.has(key)||net<type.min*.97||net>type.max*1.03)continue;const cost=Math.abs(net-type.target)+((u.beds||0)>=2||(v.beds||0)>=2?40:0);if(!best||cost<best.cost)best={l,u,v,key,cost};}
  if(!best){const P=root.POLY_PACK;let jb=null;if(P)for(const l of cur.levels)for(let i=0;i<l.units.length;i++)for(let j=i+1;j<l.units.length;j++){const u=l.units[i],v=l.units[j],net=u.net+v.net;if((u.beds||0)>=need||(v.beds||0)>=need||net<type.min*.97||net>type.max*1.03||P.shared(u,v)<1.2)continue;
    const key='j'+l.level+JSON.stringify([inner(u),inner(v)]),cost=Math.abs(net-type.target)+((u.beds||0)>=2||(v.beds||0)>=2?40:0);if(!tried.has(key)&&(!jb||cost<jb.cost))jb={l,u,v,key,cost};}
   if(!jb){let rb=null;for(const l of cur.levels)for(const u of l.units){const key='t'+l.level+JSON.stringify(inner(u));if((u.beds||0)>=need||u.net<type.min||u.net>type.max||tried.has(key))continue;if(!rb||u.net>rb.u.net)rb={l,u,key};}
    if(!rb)break;tried.add(rb.key);const lv=rb.l.level,trial={...x,unitEdits:{...(x.unitEdits||{}),[lv]:[...(x.unitEdits?.[lv]||[]),{op:'type',p:inner(rb.u),key:type.key}]}},g=F().generate({...trial,geometryOnly:false,corridorDraft:false},ctx);
    if(g.ok&&(g.allUnits||[]).filter(w=>(w.beds||0)>=need).length>us.filter(w=>(w.beds||0)>=need).length){x=trial;cur=g;}continue;}
   tried.add(jb.key);const lv=jb.l.level,trial={...x,unitEdits:{...(x.unitEdits||{}),[lv]:[...(x.unitEdits?.[lv]||[]),{op:'join',a:inner(jb.u),b:inner(jb.v)}]}},g=F().generate({...trial,geometryOnly:false,corridorDraft:false},ctx);
   if(g.ok&&(g.allUnits||[]).filter(w=>(w.beds||0)>=need).length>us.filter(w=>(w.beds||0)>=need).length){x=trial;cur=g;}continue;}
  tried.add(best.key);
  const {l,u}=best,b=l.g.bands[u.band],start=b.axis==='x'?b.x:b.y,end=start+(b.axis==='x'?b.w:b.h),cuts=[...new Set([start,end,...l.units.filter(w=>w.band===u.band).flatMap(w=>[w.a,w.z])])].sort((p,q)=>p-q).filter(c=>Math.abs(c-u.z)>.05);
  const trial={...x,slices:{...(x.slices||{}),[l.level]:{...(x.slices?.[l.level]||{}),[u.band]:cuts}}},g=F().generate({...trial,geometryOnly:false,corridorDraft:false},ctx);
  if(g.ok&&(g.allUnits||[]).filter(w=>(w.beds||0)>=need).length>us.filter(w=>(w.beds||0)>=need).length){x=trial;cur=g;}}
 return {x,r:cur};}

// ---------- Measures and ranking ----------
// Physical ratios are reported as measured. The rank score also subtracts the net of awkward units (parts filling under 60% of
// their bounding box), but it is never shown as an area ratio. Circulation is ranked by centreline length; the ground-floor
// entrance stub is counted once, on the ground floor, like any other corridor.
// Slivers: unit parts under 1.2 m wide (a strip left between a core and a wall, a stepped party wall). Counted against the rank
// score like awkward shapes, never against the reported area.
const oversized=(r,x)=>(r.allUnits||[]).reduce((s,u)=>{const t=(x.types||[]).find(t=>t.key===u.type);return s+2*Math.max(0,u.net-(t?.max||Infinity)*1.15);},0);
const usable=(r,x)=>{const ts=(x.types||[]).filter(t=>t.share>0),average=ts.reduce((s,t)=>s+t.target*t.share,0)/(ts.reduce((s,t)=>s+t.share,0)||1);return r.net-oversized(r,x)-(x.court&&average?2*Math.max(0,r.net-(r.allUnits||[]).length*average*1.2):0);};
// A thin part is a sliver unless its whole long side runs along another part of the same unit: then it is only the step of a
// notched room (a stair turned into a corner, study 24), not a strip a room cannot use.
const step=(p,ps)=>ps.some(q=>q!==p&&(p.h>=p.w?(Math.abs(p.x+p.w-q.x)<.02||Math.abs(q.x+q.w-p.x)<.02)&&Math.min(p.y+p.h,q.y+q.h)-Math.max(p.y,q.y)>=.9*p.h:(Math.abs(p.y+p.h-q.y)<.02||Math.abs(q.y+q.h-p.y)<.02)&&Math.min(p.x+p.w,q.x+q.w)-Math.max(p.x,q.x)>=.9*p.w));
const slivers=units=>units.reduce((s,u)=>{const ps=u.parts||[u];return s+ps.filter(p=>Math.min(p.w,p.h)<1.2&&!step(p,ps)).reduce((a,p)=>a+p.w*p.h,0);},0);
const awkward=units=>units.reduce((s,u)=>{const ps=u.parts||[u,...(u.patches||[])],x0=Math.min(...ps.map(p=>p.x)),y0=Math.min(...ps.map(p=>p.y)),box=(Math.max(...ps.map(p=>p.x+p.w))-x0)*(Math.max(...ps.map(p=>p.y+p.h))-y0),fill=box?ps.reduce((a,p)=>a+p.w*p.h,0)/box:1;return s+u.net*Math.max(0,1-fill/.6);},0);
function measure(r,x,cs,ctx){const lv=r.levels||[],gross=lv.reduce((s,l)=>s+(l.ledger?.built||0),0),shop=(r.groundRooms||[]).filter(q=>q.role==='commercial'&&q.on!==false).reduce((s,q)=>s+q.w*q.h,0),odd=awkward(r.allUnits||[]),get=id=>cs.find(c=>c.id===id);
 const paths=lv.flatMap(l=>l.route?.paths||[]),travel=paths.length&&paths.every(p=>Number.isFinite(p.distance))?Math.max(...paths.map(p=>p.distance)):null,ends=lv.filter(l=>l.units?.length).map(l=>deadOf(l,x)),dead=ends.length&&ends.every(Number.isFinite)?Math.max(...ends):null;
 const units=r.allUnits||[],N=units.length,mixDist=N?(x.types||[]).reduce((s,t)=>s+Math.abs(units.filter(u=>u.type===t.key).length/N-t.share/100),0):1,rt=ctx?routes(r,ctx):null,ds=rt?.discharge||[];
 return {ng:gross?(r.net+shop)/gross:0,resNg:gross?r.net/gross:0,score:gross?(usable(r,x)-odd-slivers(r.allUnits||[])+shop)/gross:0,shop,awkward:odd,slivers:slivers(r.allUnits||[]),gross,
  corridor:lv.length?lv.reduce((s,l)=>s+(l.ledger?.corridors||0)+(l.ledger?.galleries||0),0)/lv.length:0,corridorLength:lv.length?lv.reduce((s,l)=>s+(l.g?.corridors||[]).reduce((a,c)=>a+Math.max(c.w,c.h),0),0)/lv.length:0,
  entranceKind:rt?.entrance?rt.entrance.k:2,entranceLen:rt?.entrance?.d??null,dischargeKind:ds.length&&ds.every(Boolean)?Math.max(...ds.map(d=>d.k)):2,dischargeLen:ds.length&&ds.every(Boolean)?ds.reduce((s,d)=>s+d.d,0):null,
  separation:separation(x)?.d??null,sepKey:(()=>{const sp=separation(x);return !sp||sp.d>=Math.max(sp.need,.5*Math.max(x.W,x.D))?Infinity:sp.d;})(),travel,dead,limit:limits(x),within:get('travel')?.status==='pass'&&get('deadEnd')?.status==='pass',mixDist,count:N,tier:tier(cs)};}
// Reports describe the current geometry, even after a corridor or unit edit.
function currentReport(r,x,ctx){if(!r.ok||!r.count)return null;const cs=checks(r,x,ctx);return {...x.planReport,...measure(r,x,cs,ctx),checks:cs};}
// Every automatic corridor action gets the same complete refit as Generate plan.
// Unit generation after a hand edit deliberately does not call this: its corridor is fixed.
function finishCorridor(input,ctx,result){let x={...input},r=result||F().generate({...x,geometryOnly:false,corridorDraft:false},ctx);
 if(!r.ok||!r.count){delete x.planReport;return {x,r};}
 const before=r.levels[Math.min(1,r.levels.length-1)];
 // Reconsider courtyard access when a prior automatic trim left oversized homes.
 const ring=courtRing(x);if(ring&&oversized(r,x)>0&&!x.fixedNetwork){const trial={...x,freeCorridors:ring.concat((x.freeCorridors||[]).filter(c=>c.stub))},candidate=F().generate({...trial,geometryOnly:false,corridorDraft:false},ctx);if(candidate.ok&&usable(candidate,x)>usable(r,x)){x=trial;r=candidate;}}
 ({x,r}=trimDeadEnds(x,r,ctx));({x,r}=addEntrance(x,r,ctx));
 const l=r.levels[Math.min(1,r.levels.length-1)],rp=x.corridorReport||{},area=q=>q.ledger.corridors+q.ledger.galleries;
 x={...x,planReport:currentReport(r,x,ctx),corridorReport:{...rp,extensions:rp.extensions||[],optimized:true,deadEnds:l.route.deadEnds.length,baselineCorridorArea:area(before),baselineUnitArea:before.ledger.net,corridorArea:area(l),unitArea:l.ledger.net,addedCorridorArea:area(l)-area(before),gainedUnitArea:l.ledger.net-before.ledger.net,prunedCorridorArea:area(before)-area(l),...root.CORRIDOR_NETWORK.analyse(l.g,l.o,l.units)}};
 return {x,r};}
const ORDER={pass:0,study:1,fail:2};
// Eligibility first (pass, then study, then fail), then a resolved street or lane entrance and stair discharge. Within that, candidates within SEARCH.band of the best usable net-to-gross
// are compared on exit stairs set further apart (while a pair is closer than half the plate's longer side), then the shorter
// dead end (by more than 1 m), then access before efficiency: street entrance, then street or lane discharge, then shorter entrance and
// discharge routes, then the shorter corridor, then the closer unit mix. Outside the band, usable net-to-gross decides.
function rankAll(fs){const best={},group={};for(const f of fs)best[f.m.tier]=Math.max(best[f.m.tier]??-1,f.m.score);
 const open=f=>f.m.entranceKind===2||f.m.dischargeKind===2?1:0;
 // Around a courtyard the corridor runs along the court with the units on the exterior walls (study 19): that layout is
 // preferred when it comes within a few points of the best and carries more homes than the best-scoring plan (t03: 59
 // against 48); with no more homes, the shorter, more efficient plan wins (study 25).
 const lead={};for(const f of fs)if(f.m.score>=best[f.m.tier]-1e-9)lead[f.m.tier]=f.r?.count||0;
 const ring=f=>f.ring&&f.m.score>=best[f.m.tier]-.06&&(f.r?.count||0)>(lead[f.m.tier]||0)?1:0,gk=f=>f.m.tier+ring(f);for(const f of fs)group[gk(f)]=Math.max(group[gk(f)]??-1,f.m.score);
 const inBand=f=>f.m.score>=group[gk(f)]-SEARCH.band-1e-9,len=f=>(f.m.entranceLen??99)+(f.m.dischargeLen??99);
 // Homes before a few points of efficiency: a plan within 3 points that carries a fifth more homes (3 or more) wins, so a
 // short lobby that merges two quadrants into one oversized home does not beat four homes around the core (s02: 10 against 15).
 const many=(p,q)=>{const a=p.r?.count||0,b=q.r?.count||0;return Math.abs(a-b)>=Math.max(3,.2*Math.max(a,b))&&Math.abs(p.m.score-q.m.score)<=.03?b-a:0;};
 return fs.sort((p,q)=>(ORDER[p.m.tier]-ORDER[q.m.tier])||(open(p)-open(q))||(ring(q)-ring(p))||many(p,q)||(inBand(q)-inBand(p))||(inBand(p)&&inBand(q)?(p.m.sepKey!==q.m.sepKey&&!(Math.abs(q.m.sepKey-p.m.sepKey)<=1)?(q.m.sepKey>p.m.sepKey?1:-1):0)||(Math.abs((p.m.dead??0)-(q.m.dead??0))>1?(p.m.dead??0)-(q.m.dead??0):0)||(Math.abs((q.r?.count||0)-(p.r?.count||0))>=Math.max(2,.05*(p.r?.count||0))?(q.r?.count||0)-(p.r?.count||0):0)||(p.m.entranceKind-q.m.entranceKind)||(p.m.dischargeKind-q.m.dischargeKind)||(len(p)-len(q))||(p.m.corridorLength-q.m.corridorLength)||(p.m.mixDist-q.m.mixDist):0)||(q.m.score-p.m.score));}
const better=(a,b)=>rankAll([b,a])[0]===a;

// One candidate through the whole pipeline: corridor growth, units on every floor, a ground-floor entrance if needed, dead-end
// trim, family-mix repair, checks. Returns null when the geometry fails.
// Corridor around the courtyard: a run along each courtyard side whose wing is deep enough for the corridor and a unit behind
// it, joined at the corners, so the units take the exterior walls (a U for a courtyard open to one side). Only for core
// arrangements clear of it; the router links their doors to it.
function courtRing(x){const q=x.court;if(!q)return null;const c=x.corridor,deep=d=>d>=c+4.5-1e-6,n=deep(q.y),so=deep(x.D-q.y-q.h),w=deep(q.x),e=deep(x.W-q.x-q.w);
 const runs=[n&&{x:q.x-(w?c:0),y:q.y-c,w:q.w+(w?c:0)+(e?c:0),h:c,axis:'x'},so&&{x:q.x-(w?c:0),y:q.y+q.h,w:q.w+(w?c:0)+(e?c:0),h:c,axis:'x'},w&&{x:q.x-c,y:q.y-(n?c:0),w:c,h:q.h+(n?c:0)+(so?c:0),axis:'y'},e&&{x:q.x+q.w,y:q.y-(n?c:0),w:c,h:q.h+(n?c:0)+(so?c:0),axis:'y'}].filter(Boolean);
 const out=runs.map(r=>({...r,x:rnd(Math.max(0,r.x)),y:rnd(Math.max(0,r.y))}));return out.length&&!out.some(r=>(x.coreLayout||[]).some(k=>E().overlap(r,k)))?out:null;}
// A corridor-line seed is also tried with the plainest corridor: one straight run along its line across the plate (cut back
// at the ends by the dead-end trim), since the router's door-to-door network can wander where a single run serves better.
async function evaluate(seed,ctx,b,solve,errors){const front=F().articulationFront(ctx),tries=[['',()=>solve({...seed.x,quick:true,articulationFront:front})]];
 // a drawn corridor that already reaches every core door is kept as drawn; otherwise the router links the doors to it
 const drawn=cs=>(seed.x.coreLayout||[]).every(k=>C().contacts(k,cs).length)?Promise.resolve({corridors:cs,report:null,errors:[]}):solve({...seed.x,freeCorridors:cs,fixedNetwork:true,quick:true,articulationFront:front});
 if(seed.network)tries.push([' · compact courtyard landing',()=>drawn(seed.network)]);
 if(seed.line)tries.push([' · straight corridor',()=>drawn([seed.line])]);
 const ring=courtRing(seed.x);if(ring)tries.push([' · corridor around the courtyard',()=>drawn(ring)]);
 // refinement re-runs only the corridor variant that won for this arrangement
 let best=null;for(const [tag,job] of seed.only!=null?tries.filter(t=>t[0]===seed.only):tries){const res=await job();if(res.errors?.length){errors.push(res.errors[0]);continue;}
  let input={...seed.x,freeCorridors:res.corridors,corridorReport:res.report,stubs:[],groundCorridors:[],unitsGenerated:true,briefApplied:JSON.stringify(b)},r=F().generate({...input,geometryOnly:false,corridorDraft:false},ctx);if(!r.ok){errors.push(r.errors[0]);continue;}
  ({x:input,r}=finishCorridor(input,ctx,r));({x:input,r}=repairMix(input,r,ctx));const cs=checks(r,input,ctx),f={o:input,r,checks:cs,m:measure(r,input,cs,ctx),label:seed.label.replace(/ · (straight corridor|corridor around the courtyard)/,'')+tag,tag,family:seed.family,seed,ring:/courtyard/.test(tag)||!!seed.ring};if(!best||better(f,best))best=f;}
 return best;}
// Local refinement: move one core, or the whole core group, a step at a time along both plan axes (1.2 m, then 0.6, then 0.3),
// re-laying the corridor and refitting every floor each time; keep a move only when it ranks better. Bounded by an evaluation budget.
async function refine(f,ctx,b,solve,errors,progress,ok){let cur=f,evals=0;const n=f.seed.x.coreLayout.length;
 for(const step of SEARCH.refineSteps){let moved=true;
  while(moved&&evals<SEARCH.refineBudget){moved=false;
   const moves=[];for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){moves.push(cs=>cs.map(q=>({...q,x:rnd(q.x+dx),y:rnd(q.y+dy)})));for(let i=0;i<n;i++)moves.push(cs=>cs.map((q,j)=>j===i?{...q,x:rnd(q.x+dx),y:rnd(q.y+dy)}:q));}
   for(const mv of moves){if(evals>=SEARCH.refineBudget)break;const cs=flush(mv(cur.seed.x.coreLayout),cur.seed.x,ok);if(!ok(cs)||JSON.stringify(cs)===JSON.stringify(cur.seed.x.coreLayout))continue;evals++;progress(`Refining ${cur.label.split(' · ')[0]} · ${evals} of ${SEARCH.refineBudget} · best so far ${(cur.m.ng*100).toFixed(1)}% net / gross, ${cur.r.count} units`);
    const t=await evaluate({...cur.seed,only:cur.tag,x:{...cur.seed.x,coreLayout:cs}},ctx,b,solve,errors);if(t)progress(`Refining ${cur.label.split(' · ')[0]} · ${evals} of ${SEARCH.refineBudget}`,{stage:2,sketch:sketchOf(t.o,t.r),best:{count:Math.max(cur.r.count,0),ng:cur.m.ng}});if(t&&better(t,cur)){cur={...t,label:cur.label.replace(/ · refined.*$/,'')+' · refined'};moved=true;break;}}}}
 return cur;}

// Screen every arrangement with the quick door-linking solve, then take the best of each family through the full pipeline; when
// none of that passes, the next few are tried. The most promising distinct families are then refined locally.
// A candidate as the waiting panel draws it: the typical floor's plate, courtyard, cores, corridor and unit outlines, in plan
// metres. Only what a line drawing needs; nothing here feeds the search.
function sketchOf(x,r,corridors){const rr=q=>({x:q.x,y:q.y,w:q.w,h:q.h}),l=r?.levels?.find(v=>v.level>1&&v.units?.length)||r?.levels?.[0],g=l?.g;
 return {W:x.W,D:x.D,built:g?g.built.map(rr):[{x:0,y:0,w:x.W,h:x.D}],voids:(g?g.voids||[]:x.court?[x.court]:[]).map(rr),cores:(g?g.cores:x.coreLayout||[]).map(q=>({...rr(q),kind:q.kind})),corridors:(g?g.corridors:corridors||x.freeCorridors||[]).map(rr),units:(l?.units||[]).flatMap(u=>(u.parts||[u]).map(rr))};}
async function search(o,ctx,b,{solve,progress=()=>{},keep=KEEP,rounds=3,refineOn=true}={}){const front=F().articulationFront(ctx),cands=[],errors=[];
 for(const depth of courtDepths(o,b,ctx)){const x=apply(o,b,ctx,depth);for(const s of seeds(x,ctx))cands.push({x:{...x,axis:s.axis,coreLayout:s.cores},line:s.line,network:s.network,ring:s.ring,drawn:s.drawn,label:s.label,family:s.family});}
 if(!cands.length)return {best:null,errors:['No stair and lift position fits clear of the courtyard and every setback.'],tried:0,finals:[]};
 for(const [i,c] of cands.entries()){progress(`Placing stairs and lift · ${i+1} of ${cands.length}`);const loop=c.network||(c.ring?courtRing(c.x):c.drawn?[c.line]:null),res=await solve(loop?{...c.x,freeCorridors:loop,fixedNetwork:true,quick:true,connectOnly:true,articulationFront:front}:{...c.x,quick:true,connectOnly:true,articulationFront:front});if(res.errors?.length){errors.push(res.errors[0]);continue;}progress(`Placing stairs and lift · ${i+1} of ${cands.length}`,{stage:0,sketch:sketchOf(c.x,null,res.corridors)});const plate=c.x.W*c.x.D-(c.x.court?c.x.court.w*c.x.court.h:0);c.screen=(res.report?.unitArea||0)/plate-(res.report?.corridorArea||0)/plate*.01;}
 // The best of each family first, so the shortlist holds genuinely different arrangements; then the rest in screen order.
 const ranked=cands.filter(c=>c.screen!=null).sort((p,q)=>q.screen-p.screen),order=[],used=new Set();
 // the corridor around a courtyard and the stairs in line at the corridor ends are always tried in the first round
 for(const pick of [ranked.find(c=>c.ring),ranked.find(c=>c.drawn&&!c.family.startsWith('landing')),ranked.find(c=>c.family.startsWith('landing'))])if(pick&&!used.has(pick.family+pick.x.axis)){used.add(pick.family+pick.x.axis);order.push(pick);}
 for(const c of ranked)if(!used.has(c.family+c.x.axis)){used.add(c.family+c.x.axis);order.push(c);}for(const c of ranked)if(!order.includes(c))order.push(c);
 const finals=[],lead=()=>{const live=finals.filter(f=>f.m.tier!=='fail');if(!live.length)return '';const t=rankAll(live.slice())[0];return ` · best so far ${(t.m.ng*100).toFixed(1)}% net / gross, ${t.r.count} units`;};
 for(let round=0;round<rounds;round++){const batch=order.slice(round*keep,(round+1)*keep);if(!batch.length)break;
  for(const [i,c] of batch.entries()){progress(`Laying the corridor and fitting units · ${round*keep+i+1} of ${Math.min(order.length,rounds*keep)}${lead()}`);const f=await evaluate(c,ctx,b,solve,errors);if(f){finals.push(f);const live=finals.filter(q=>q.m.tier!=='fail'),t=live.length?rankAll(live.slice())[0]:null;progress(`Laying the corridor and fitting units · ${round*keep+i+1} of ${Math.min(order.length,rounds*keep)}${lead()}`,{stage:1,sketch:sketchOf(f.o,f.r),best:t?{count:t.r.count,ng:t.m.ng}:null});}}
  // stop once a workable plan is in hand, unless failing layouts still score well above it (a fix may be one step away)
  const live=finals.filter(f=>f.m.tier!=='fail'),top=Math.max(0,...finals.map(f=>f.m.score)),good=Math.max(0,...live.map(f=>f.m.score));
  if(live.length&&(round+1)*keep>=SEARCH.minEvaluated&&good>=top-.05)break;}
 rankAll(finals);
 if(refineOn&&finals.length){const ok=blockers(finals[0].seed.x,ctx),picks=[],fams=new Set();for(const f of finals)if(!fams.has(f.family)&&picks.length<SEARCH.refineCandidates){fams.add(f.family);picks.push(f);}
  for(const f of picks){const t=await refine(f,ctx,b,solve,errors,progress,ok);if(t!==f)finals.push(t);}rankAll(finals);}
 return {best:finals[0]||null,finals,errors,tried:cands.length};}

// Briefs one step simpler than the chosen one, in the order a designer would give things up.
function relaxations(b){const out=[];
 for(const d of SETBACKS.filter(d=>d<b.setback).reverse())out.push({patch:{setback:d},label:`a ${d} m setback`});if(b.setback>0)out.push({patch:{setback:0},label:'no upper-floor setback'});
 if(b.recess==='deep')out.push({patch:{recess:'shallow'},label:'a shallow entry recess'});if(b.recess!=='none')out.push({patch:{recess:'none'},label:'no entry recess'});
 if(b.court!=='none')out.push({patch:{court:'none'},label:'no central courtyard'});if(b.sideCourt!=='none')out.push({patch:{sideCourt:'none'},label:'no side courtyard'});
 if(b.lifts===2)out.push({patch:{lifts:1},label:'one lift'});if(b.stairs==='one')out.push({patch:{stairs:'two'},label:'two exit stairs'});if(b.layout!=='double')out.push({patch:{layout:'double'},label:'a double-loaded corridor'});
 return out;}
function plainError(e){if(!e)return 'No arrangement of stairs, lift and corridor fits this brief.';if(/No continuous .* corridor reaches every core door/.test(e))return 'No continuous corridor can reach both stairs and the lift with this brief.';if(/setback/i.test(e))return 'A setback cuts through every workable stair and lift position.';if(/courtyard/i.test(e))return 'The courtyard leaves no workable position for the stairs, lift and corridor.';if(/no connected route to a stair|reach all required stair/i.test(e))return 'Some units cannot reach both exit stairs through the corridor.';return e;}
const failText=cs=>cs.filter(c=>c.status==='fail'&&c.category!=='report').map(c=>c.message).join(' ');
const summary=(m,r,res)=>`${m.tier==='pass'?'Plan generated':'Plan generated as a study'}: ${r.count} units${m.shop?` + ${fmt(m.shop,0)} m² commercial`:''} · ${fmt(m.ng*100)}% net / gross${m.shop?` (residential ${fmt(m.resNg*100)}%)`:''} · ${fmt(m.corridorLength,1)} m corridor per floor · longest exit route ${m.travel==null?'unresolved':fmt(m.travel)+' m'} (limit ${m.limit.travel} m). Best of ${res.tried} stair and lift arrangements.`;

async function generate(o,ctx,{solve,progress}={}){const b=o.brief,block=problems(o,ctx,b).filter(p=>p.level==='block');
 if(block.length)return {ok:false,message:block[0].text,patch:block[0].patch,label:block[0].label};
 const res=await search(o,ctx,b,{solve,progress}),best=res.best,pack=f=>({...f.o,planReport:{...f.m,checks:f.checks,tried:res.tried,label:f.label}});
 if(best&&best.m.tier!=='fail'){const open=best.checks.filter(c=>c.category!=='report'&&c.status!=='pass').map(c=>c.message);
  // the next best layouts from other families, for the user to compare and switch to: only genuine near-equals (same tier,
  // within 3 points of net-to-gross, at most one unit fewer, no more awkward area), never a weaker plan offered as a choice
  const near=f=>f.m.tier===best.m.tier&&f.m.ng>=best.m.ng-.03&&f.r.count>=best.r.count-1&&(f.m.awkward||0)<=(best.m.awkward||0)+5&&(f.m.slivers||0)<=(best.m.slivers||0);
  const seen=new Set([best.family]),alternatives=[];for(const f of rankAll(res.finals.filter(f=>f.m.tier!=='fail').slice())){if(alternatives.length>=2)break;if(seen.has(f.family)||!near(f))continue;seen.add(f.family);alternatives.push({o:pack(f),label:f.label,tier:f.m.tier,ng:f.m.ng,count:f.r.count,corridor:f.m.corridorLength});}
  return {ok:true,tier:best.m.tier,checks:best.checks,alternatives,o:pack(best),r:best.r,summary:summary(best.m,best.r,res)+(open.length?' Unresolved: '+open.join(' '):'')};}
 // Nothing passed: no plan is applied. The best failing layout is offered as a diagnostic study, with a simpler brief that works.
 const study=best?{o:{...pack(best),planStudy:true},r:best.r,checks:best.checks}:null,why=best?`No layout found in this search passes: ${failText(best.checks)}`:plainError(res.errors[0]);
 for(const step of relaxations(b)){progress?.(`Nothing passes yet · trying ${step.label}`);const r=await search(o,ctx,{...b,...step.patch},{solve,progress:()=>{},keep:1,rounds:2});if(r.best&&r.best.m.tier!=='fail')return {ok:false,message:`${why} With ${step.label} it works.`,patch:step.patch,label:step.label,study};}
 return {ok:false,message:why+' No simpler brief found in this search passes either.',study};}

// ---------- Wizard: one question at a time in the centre; the brief and previews sit at the side ----------
// Each step: its tab label and the brief keys it sets (so it shows only its own fit problems).
// The corridor that suits the stair choice: one stair or a scissor core puts both exits in one place, so the homes wrap a
// central core; two stairs need distance between them, so a corridor runs stair to stair. A recommendation only.
function layoutFor(stairs){return stairs==='one'||stairs==='scissor'?{layout:'point',why:`Recommended with ${stairs==='one'?'one exit stair':'a scissor stair'}: a central core, every home a short walk from the one core.`}:{layout:'double',why:'Recommended with two exit stairs: a corridor running stair to stair keeps them apart and serves homes on both sides.'};}
const STEPS=[{id:'ground',tab:'Build',keys:['ground']},{id:'stairs',tab:'Stairs',keys:['stairs']},{id:'lifts',tab:'Lifts',keys:['lifts']},{id:'layout',tab:'Layout',keys:['layout']},{id:'court',tab:'Courtyard',keys:['court','sideCourt']},{id:'recess',tab:'Entry',keys:['recess','recessPos']},{id:'setback',tab:'Setback',keys:['setback']},{id:'review',tab:'Brief',keys:null}];
const stepOf=key=>STEPS.findIndex(s=>s.keys?.includes(key));
// Courtyard is one question: none, central, or open to one side (then which side; the lane side by default).
function courtKind(b){return b.court!=='none'?'central':b.sideCourt!=='none'?'side':'none';}
function pickCourt(b,value,ctx){const fr=frontages(ctx),lane=SIDES.find(s=>fr[s].kind==='lane');return value==='central'?{...b,court:'central',sideCourt:'none'}:value==='side'?{...b,court:'none',sideCourt:b.sideCourt!=='none'?b.sideCourt:fr[lane||'bottom'].compass}:{...b,court:'none',sideCourt:'none'};}
// Court size inputs, named by compass so they read the same whichever way the plan is drawn. Empty = auto.
function courtSizeRow(o,b,ctx){const c=courtSize(o,b,ctx);if(!c)return '';const cp=compass(ctx),nsKey=cp.top==='N'||cp.top==='S'?'courtH':'courtW',ewKey=nsKey==='courtH'?'courtW':'courtH',g=courtWing(b.layout,o),set=b.courtW>0||b.courtH>0;
 const num=(key,label)=>`<label class="ps-num">${label}<input type="number" data-brief-num="${key}" value="${fmt(key==='courtW'?c.w:c.h)}" min="${WELL_MIN}" step=".5" aria-label="Courtyard ${label}"> m</label>`;
 return `<div class="ps-sub"><h3>Size${set?'':' · auto'}</h3><div class="ws-tools">${num(nsKey,'North–south')}${num(ewKey,'East–west')}${set?'<button data-brief="courtAuto" data-value="1">Auto</button>':''}</div><p class="ex-note">Auto is the widest court that leaves each wing a corridor with units (${fmt(g)} m). At least ${WELL_MIN} m; a full courtyard is ${COURT_MIN} m or more.</p></div>`;}
function wizard(o,ctx,I,state={}){const b=o.brief,fr=frontages(ctx),ex=exits(o,ctx,b),probs=problems(o,ctx,b),step=Math.max(0,Math.min(STEPS.length-1,state.step||0)),S=STEPS[step],changed=o.briefApplied!==JSON.stringify(b);
 // A card that finishes its question moves on to the next one; a card that opens a follow-up (which side, from which level) stays.
 const card=(key,value,title,sub,on,opts={})=>`<button class="ps-choice" data-brief="${key}" data-value="${esc(value)}" ${opts.stay?'':'data-advance'} aria-pressed="${!!on}" ${opts.disabled?'disabled':''}><b>${esc(title)}</b>${opts.rec?`<em class="ps-rec">Recommended</em>`:''}<span>${esc(sub)}</span>${opts.note?`<small>${esc(opts.note)}</small>`:''}</button>`;
 const chip=(key,value,label,on)=>`<button data-brief="${key}" data-value="${esc(value)}" aria-pressed="${!!on}">${esc(label)}</button>`;
 const sub=(title,body)=>`<div class="ps-sub"><h3>${title}</h3><div class="ws-tools">${body}</div></div>`;
 const face=c=>`${c} · ${(fr[sideOf(ctx,c)]?.label||'').replace(/ \([NESW]\)$/,'')}`;
 const issue=(p,i)=>`<div class="ps-problem ${p.level==='warn'?'warn':''}" role="${p.level==='warn'?'status':'alert'}"><p>${esc(p.text)}</p>${p.patch?`<button data-brief-fix="${i}">Nearest option that works: ${esc(p.label)}</button>`:''}</div>`;
 const mine=probs.map((p,i)=>({p,i})).filter(({p})=>!S.keys||S.keys.includes(p.key)),lvls=Array.from({length:Math.max(0,o.floors-1)},(_,i)=>i+2);
 let q='';
 if(S.id==='ground')q=`<h2>What do you want to build?</h2><p class="ps-lead">Start with the use. Everything else fits around it.</p><div class="ps-choices">${card('ground','residential','A residential building','Homes on every floor. The ground floor holds the lobby, loading and more homes.',b.ground==='residential')}${card('ground','commercial','Mixed use','Shops along the street at grade, each with its own door. Homes above and behind.',b.ground==='commercial')}</div>`;
 else if(S.id==='layout'){const rec=layoutFor(b.stairs);q=`<h2>How should people reach their homes?</h2><p class="ps-lead">This sets the corridor, which decides how much of each floor becomes homes. ${esc(rec.why)}</p><div class="ps-choices">${card('layout','double','Double-loaded corridor','A central corridor with homes on both sides. Usually the most efficient.',b.layout==='double',{rec:rec.layout==='double'})}${card('layout','gallery','Single-loaded corridor','Homes on one side of a corridor or open gallery. Every home gets more daylight.',b.layout==='gallery',{rec:rec.layout==='gallery'})}${card('layout','point','Central core','Homes wrap a compact stair and lift core. Suits small, square plates.',b.layout==='point',{rec:rec.layout==='point'})}</div>`;}
 else if(S.id==='lifts')q=`<h2>How many lifts?</h2><p class="ps-lead">A second lift adds a shaft on every floor.</p><div class="ps-choices">${card('lifts',1,'One lift','Enough for most buildings of this size.',b.lifts===1)}${card('lifts',2,'Two lifts','Side by side. Service continues when one is down.',b.lifts===2)}</div>`;
 else if(S.id==='stairs')q=`<h2>How many exit stairs?</h2><p class="ps-lead">Options this site and massing cannot support are greyed out, with the reason.</p><div class="ps-choices">${card('stairs','two','Two exit stairs','The standard arrangement. Every floor has two ways out.',b.stairs==='two')}${card('stairs','one','One exit stair','Saves a stair on every floor. Limited by storeys and unit count.',b.stairs==='one',{disabled:!ex.one.ok&&b.stairs!=='one',note:ex.one.note.replace(/^One exit stair: /,'')})}${card('stairs','scissor','Scissor stair','Two exits in one compact core.',b.stairs==='scissor',{disabled:!ex.scissor.ok&&b.stairs!=='scissor',note:ex.scissor.note.replace(/^Scissor stair: /,'')})}</div>`;
 else if(S.id==='court'){const k=courtKind(b);q=`<h2>Do you want a courtyard?</h2><p class="ps-lead">A courtyard brings light into a deep plate, at the cost of floor area.</p><div class="ps-choices">${card('courtKind','none','No courtyard','The whole plate is building.',k==='none')}${card('courtKind','central','Central courtyard','Enclosed on all sides, open to the sky.',k==='central')}${card('courtKind','side','Open to one side','A U-shape around a court that opens to one edge.',k==='side',{stay:true})}</div>${k==='side'?sub('Open toward',COMPASS.map(c=>chip('sideCourt',c,face(c),b.sideCourt===c)).join('')):''}${k!=='none'?courtSizeRow(o,b,ctx):''}`;}
 else if(S.id==='recess')q=`<h2>Do you want an entry recess?</h2><p class="ps-lead">A cut-back in the ground floor that marks the main entrance. Upper floors are not affected.</p><div class="ps-choices">${card('recess','none','No recess','The ground floor meets the street flush.',b.recess==='none')}${card('recess','shallow',`Shallow · ${RECESS.shallow} m`,'A covered doorway.',b.recess==='shallow',{stay:true})}${card('recess','deep',`Deep · ${RECESS.deep} m`,'A small forecourt in front of the door.',b.recess==='deep',{stay:true})}</div>${b.recess!=='none'?sub('On which frontage',SIDES.map(s=>chip('recessSide',s,fr[s].label,b.recessSide===s)).join(''))+sub('Where along it (as seen from the street)',RECESS_POS.map(p=>chip('recessPos',p,p==='middle'?'Middle':p==='left'?'Left corner':'Right corner',(b.recessPos||'middle')===p)).join('')):''}`;
 else if(S.id==='setback')q=`<h2>Step back the upper floors?</h2><p class="ps-lead">Trims the top of the building on the sides you pick. Units on those floors are refitted.</p><div class="ps-choices">${card('setback',0,'No setback','Every floor keeps the full plate.',!(b.setback>0))}${SETBACKS.map(d=>card('setback',d,`${d} m`,d<2?'A narrow ledge.':d<3?'A usable terrace.':'A generous terrace.',b.setback===d,{stay:true})).join('')}</div>${b.setback>0?sub('From level',lvls.map(k=>chip('setbackFrom',k,String(k),b.setbackFrom===k)).join(''))+sub('On sides',COMPASS.map(c=>chip('setbackSide',c,face(c),b.setbackSides.includes(c))).join('')):''}`;
 else q=`<h2>Your brief</h2><p class="ps-lead">Check the picks, then generate. Stairs, lift and corridor are placed first, units fill the rest, and the most efficient layout that works is kept. Click a line to change it.</p><ol class="ps-brief ps-brief-big">${lines(b,ctx,defaults(ctx,I,o),o).map(l=>`<li><button class="ps-link" data-brief-step="${stepOf(l.key)}">${esc(l.text)}</button></li>`).join('')}</ol>
  ${state.failure?`<div class="ps-problem" role="alert"><p>${esc(state.failure.message)}</p>${state.failure.patch?`<button data-brief-fix="failure">Use ${esc(state.failure.label)}</button>`:''}${state.failure.study?`<button data-brief-study>Open the failing layout as a study</button>`:''}</div>`:''}
  <p class="ex-note" role="status">${o.briefApplied?o.planStale?'The massing changed in step 1 since the plan was generated: generate it again.':changed?'The brief has changed since the plan was generated.':'The current plan was generated from this brief.'+(o.planReport?` ${o.planReport.count} units · ${fmt(o.planReport.ng*100)}% net / gross.`:''):'No plan generated yet.'}</p>
  ${(()=>{const again=!state.busy&&o.briefApplied&&!changed&&!o.planStale;return `<button id="ps-generate" class="${again?'btn ps-again':'ex-primary ps-go'}" ${state.busy?'disabled':''}>${state.busy?esc(state.busy):again?'Regenerate plan':'Generate plan'}</button>`;})()}`;
 return `<div class="ps-wiz"><nav class="ps-steps" aria-label="Plan setup questions">${STEPS.map((s,i)=>`<button data-brief-step="${i}" ${i===step?'aria-current="step"':''} class="${probs.some(p=>p.level==='block'&&s.keys?.includes(p.key))?'bad':''}"><b>${i+1}</b> ${s.tab}</button>`).join('')}</nav>
 <section class="ps-q" aria-live="polite">${q}${mine.map(({p,i})=>issue(p,i)).join('')}</section>
 <div class="ps-nav">${step>0?`<button data-brief-step="${step-1}">← Back</button>`:'<span></span>'}${step<STEPS.length-1?`<button class="ex-primary" data-brief-step="${step+1}">${step===STEPS.length-2?'Review brief →':'Next →'}</button>`:''}</div></div>`;}
// Side panel: the brief so far; each line jumps back to its question, × clears it.
function side(o,ctx,I){const b=o.brief;return `<section><h3>Design brief</h3><ol class="ps-brief">${lines(b,ctx,defaults(ctx,I,o),o).map(l=>`<li><button class="ps-link" data-brief-step="${stepOf(l.key)}">${esc(l.text)}</button>${l.changed?`<button data-brief-clear="${l.key}" aria-label="Clear: ${esc(l.text)}" title="Clear">×</button>`:''}</li>`).join('')}</ol><div class="ws-tools"><button data-brief-clear="all">Clear all</button></div></section>`;}

root.PLAN_SETUP={layoutFor,centralSeeds,courtLanding,landingSeeds,finishCorridor,currentReport,ringSeeds,courtRing,flush,RECESS_POS,recessPos,SEARCH,routes,openings,addEntrance,rankAll,refine,entranceSeeds,lineSeeds,checks,tier,quota,repairMix,trimDeadEnds,courtSize,defaults,programme,pick,pickCourt,clear,lines,exits,problems,apply,seeds,search,generate,wizard,side,STEPS,compass,frontages,limits,measure,COURT_MIN,WELL_MIN,RECESS,SETBACKS};
})(typeof window!=='undefined'?window:globalThis);
