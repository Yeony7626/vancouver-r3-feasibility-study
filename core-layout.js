/* Editable stacked core rectangles, in metres. Orthogonal quarter-turns only. */
(function(root){'use strict';const E=root.EXPLORE,EPS=1e-5;
const swapSide={top:'left',bottom:'right',left:'top',right:'bottom'};
// Offset is measured from the wall's smaller X/Y coordinate; the schematic opening is 1.2 m.
function door(c,side=c.doorSide,offset=c.doorOffset){const horizontal=['top','bottom'].includes(side),length=horizontal?c.w:c.h,position=Math.max(.6,Math.min(length-.6,offset??(['stair','scissor'].includes(c.kind)&&length>(horizontal?c.h:c.w)+EPS?.7:length/2))),a=(horizontal?c.x:c.y)+position,v=side==='top'?c.y:side==='bottom'?c.y+c.h:side==='left'?c.x:c.x+c.w;return {side,offset:position,a:a-.6,b:a+.6,point:horizontal?[a,v]:[v,a]};}
function projectDoor(c,x,y){const faces=[['top',Math.abs(y-c.y)],['bottom',Math.abs(y-c.y-c.h)],['left',Math.abs(x-c.x)],['right',Math.abs(x-c.x-c.w)]].sort((a,b)=>a[1]-b[1]),side=faces[0][0];return door(c,side,Math.round((['top','bottom'].includes(side)?x-c.x:y-c.y)*10)/10);}
function swap(c){return {...c,x:c.y,y:c.x,w:c.h,h:c.w,doorSide:swapSide[c.doorSide]||c.doorSide};}
// Two lifts share one block (door side 5.4 m or longer): each car has its own 1.2 m opening, centred on its half of the door
// side, and both must open onto the corridor. A scissor core holds two interleaved stairs whose landings sit at opposite ends:
// on its long side it has two doors, one at each end landing, so the core is two exits.
function cars(c,side=c.doorSide){const h=side==='top'||side==='bottom';if(c.kind==='scissor')return (h?c.w:c.h)>(h?c.h:c.w)+EPS?2:1;if(c.kind!=='elevator')return 1;return (h?c.w:c.h)>=5.4-EPS?2:1;}
function openings(c,side=c.doorSide){if(cars(c,side)<2)return [door(c,side)];const h=side==='top'||side==='bottom',lo=h?c.x:c.y,L=h?c.w:c.h,v=side==='top'?c.y:side==='bottom'?c.y+c.h:side==='left'?c.x:c.x+c.w;
 return (c.kind==='scissor'?[lo+.7,lo+L-.7]:[lo+L/4,lo+3*L/4]).map(m=>({side,offset:m-lo,a:m-.6,b:m+.6,point:h?[m,v]:[v,m]}));}
// A stair door on its long side opens from a landing, at one end of the flights, not mid-flight: the landing zone that fits inside
// the corridor contact, nearest the contact centre; on the short side (all landing) and for lifts, the contact centre.
function landing(c,side,a,b){const h=side==='top'||side==='bottom',L=h?c.w:c.h,other=h?c.h:c.w,mid=(a+b)/2;if(!['stair','scissor'].includes(c.kind)||L<=other+EPS)return mid;
 const lo=h?c.x:c.y,hi=lo+L,at=[lo+.7,hi-.7].filter(m=>m-.6>=a-EPS&&m+.6<=b+EPS).sort((p,q)=>Math.abs(p-mid)-Math.abs(q-mid));return at.length?at[0]:mid;}
function contacts(c,corridors){const out=[];for(const q of corridors){for(const [side,v,edge,a,b]of [
 ['top',c.y,q.y+q.h,Math.max(c.x,q.x),Math.min(c.x+c.w,q.x+q.w)],
 ['bottom',c.y+c.h,q.y,Math.max(c.x,q.x),Math.min(c.x+c.w,q.x+q.w)],
 ['left',c.x,q.x+q.w,Math.max(c.y,q.y),Math.min(c.y+c.h,q.y+q.h)],
 ['right',c.x+c.w,q.x,Math.max(c.y,q.y),Math.min(c.y+c.h,q.y+q.h)]]){
 const d=door(c,side),two=cars(c,side)>1,ops=two?openings(c,side):null;if(Math.abs(v-edge)<EPS&&b-a>=1.2-EPS&&(!c.doorSide||side===c.doorSide)&&(two?a<=ops[0].a+EPS&&b>=ops[1].b-EPS:c.doorOffset==null||(a<=d.a+EPS&&b>=d.b-EPS)))out.push({side,v,a,b,point:c.doorOffset!=null?d.point:(m=>side==='top'||side==='bottom'?[m,v]:[v,m])(landing(c,side,a,b))});
 }}return out.sort((a,b)=>(b.b-b.a)-(a.b-a.a));}
function seed(g){return g.cores.map((c,i)=>({...c,id:c.id||`core-${i}`,rotation:c.rotation||0,doorSide:c.doorSide||contacts(c,g.corridors)[0]?.side||'bottom'}));}
function rotate(c,angle){const delta=((angle-(c.rotation||0))%360+360)%360,turns=delta/90;if(!Number.isInteger(turns))return c;let side=c.doorSide,offset=c.doorOffset,w=c.w,h=c.h;for(let i=0;i<turns;i++){if(offset!=null&&['left','right'].includes(side))offset=h-offset;side={top:'right',right:'bottom',bottom:'left',left:'top'}[side];[w,h]=[h,w];}return {...c,x:c.x+(c.w-w)/2,y:c.y+(c.h-h)/2,w,h,rotation:angle,doorSide:side,...(offset!=null?{doorOffset:offset}:{})};}
// A door that opens onto the plate edge or against another core or obstacle is turned to an open side: the side touching a
// corridor first, then the open side nearest a corridor. A door with open space in front of it is kept as it is.
function faceDoor(c,g,W,D,obstacles=[]){const EP=.05,out=side=>{const d=door(c,side),h=side==='top'||side==='bottom',v=d.point[h?1:0],o=side==='top'||side==='left'?-.3:.3;return h?{x:d.a,y:Math.min(v,v+o),w:d.b-d.a,h:.3}:{x:Math.min(v,v+o),y:d.a,w:.3,h:d.b-d.a};};
 const open=side=>{const r=out(side);return r.x>=-EP&&r.y>=-EP&&r.x+r.w<=W+EP&&r.y+r.h<=D+EP&&!obstacles.some(b=>E.overlap(r,b));};
 if(c.doorSide&&open(c.doorSide))return c;const free={...c,doorSide:undefined,doorOffset:undefined},touch=contacts(free,g.corridors||[]).map(t=>t.side).filter(open);
 const gap=side=>{const p=door(free,side).point;return Math.min(Infinity,...(g.corridors||[]).map(q=>Math.hypot(Math.max(q.x-p[0],0,p[0]-q.x-q.w),Math.max(q.y-p[1],0,p[1]-q.y-q.h))));};
 const side=touch[0]||['top','bottom','left','right'].filter(open).sort((a,b)=>gap(a)-gap(b))[0];return side?{...free,doorSide:side}:c;}
function snap(c,g,index,exclusions=[]){const candidates=[];for(const q of g.corridors){const n={...c},s=c.doorSide;
 if(s==='top'||s==='bottom'){n.y=s==='top'?q.y+q.h:q.y-c.h;n.x=Math.max(q.x+1.2-c.w,Math.min(q.x+q.w-1.2,c.x));}
 else{n.x=s==='left'?q.x+q.w:q.x-c.w;n.y=Math.max(q.y+1.2-c.h,Math.min(q.y+q.h-1.2,c.y));}
 if(c.doorOffset!=null){if(s==='top'||s==='bottom')n.x=Math.max(q.x+.6-c.doorOffset,Math.min(q.x+q.w-.6-c.doorOffset,n.x));else n.y=Math.max(q.y+.6-c.doorOffset,Math.min(q.y+q.h-.6-c.doorOffset,n.y));}
 if(!E.inside(n,g.bounds)||!contacts(n,[q]).length||g.corridors.some(r=>E.overlap(n,r))||g.cores.some((r,i)=>i!==index&&E.overlap(n,r))||exclusions.some(r=>E.overlap(n,r)))continue;
 if(!c.exterior&&Math.abs(g.built.reduce((s,b)=>s+E.area(E.intersection(n,b)),0)-E.area(n))>.001)continue;
 candidates.push(n);
 }return candidates.sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0]||null;}
function inputErrors(layout,o){if(!Array.isArray(layout))return ['Core layout must be an array.'];const stairs=layout.filter(c=>c.kind!=='elevator').length,expected=['one','scissor'].includes(o.stair)?1:2,errors=[];
 if(stairs!==expected||layout.filter(c=>c.kind==='elevator').length!==1)errors.push('Core layout must retain the selected stair count and one lift. Regenerate starting cores after changing exit strategy.');
 for(const c of layout){if(!['x','y','w','h'].every(k=>Number.isFinite(c[k]))||c.w<=0||c.h<=0||![0,90,180,270].includes(c.rotation||0)||!['top','bottom','left','right'].includes(c.doorSide)||!['stair','scissor','elevator'].includes(c.kind))errors.push('Cores require finite positive dimensions, a door side and a 0°, 90°, 180° or 270° rotation.');}
 for(const c of layout)if(c.doorOffset!=null&&(!Number.isFinite(c.doorOffset)||c.doorOffset<.6-EPS||c.doorOffset>(['top','bottom'].includes(c.doorSide)?c.w:c.h)-.6+EPS))errors.push('Door position must keep the full 1.2 m opening on its core wall.');return errors;
}
function apply(g,layout,o){const old=g.cores;g.errors=g.errors.filter(s=>!s.includes('template does not fit')&&!s.includes('Elevator cannot fit'));
 // External stair footprints follow their edited positions, within the planning envelope.
 g.built=g.built.filter(b=>!old.some(c=>c.exterior&&Math.abs(E.area(E.intersection(c,b))-E.area(b))<EPS));
 g.cores=layout.map(c=>({...c}));
 for(const c of g.cores.filter(c=>c.exterior)){let parts=[{x:c.x,y:c.y,w:c.w,h:c.h}];for(const b of g.built)parts=parts.flatMap(p=>root.FLOOR_DESIGN.subtract(p,b));g.built.push(...parts);}
 if(o.coreLayout)g.errors.push(...inputErrors(layout,o));
}
function validate(g,o){const errors=[],placing=o.typology==='free'&&(!!o.corridorStale||!(o.freeCorridors&&o.freeCorridors.length));for(const c of g.cores){const label=c.kind==='elevator'?'Lift':'Stair';if(!E.inside(c,g.bounds))errors.push(`${label} extends outside the planning envelope.`);
 const covered=g.built.reduce((s,b)=>s+E.area(E.intersection(c,b)),0);if(!placing&&Math.abs(covered-E.area(c))>.001)errors.push(`${label} is outside this floor plate or crosses a courtyard / setback.`);
 if(!placing&&!(o.geometryOnly&&o.corridorDraft)&&!contacts(c,g.corridors).length)errors.push(`${label} door side has no corridor connection at least 1.2 m long (schematic contact test, not VBBL clearance).`);
 if(!o.corridorStale&&g.corridors.some(q=>E.overlap(c,q)))errors.push(`${label} overlaps circulation. Move it beside the corridor, not into it.`);
 if(o.exclusions.some(q=>E.overlap(c,q)))errors.push(`${label} overlaps a service room or fixed reservation.`);
 }for(let i=0;i<g.cores.length;i++)for(let j=i+1;j<g.cores.length;j++)if(E.overlap(g.cores[i],g.cores[j]))errors.push('Edited core reservations overlap.');return [...new Set(errors)];}
const swapRect=r=>({...r,x:r.y,y:r.x,w:r.h,h:r.w}),label=c=>c.kind==='elevator'?'Lift':c.kind==='scissor'?'Scissor core':'Stair';
// Straight corridor link from a core's door face to the nearest corridor. Two shapes: perpendicular run from the face, or a strip along the face toward a corridor beside it.
function stubFor(core,g,w){const flip=['left','right'].includes(core.doorSide),c=flip?{...swapRect(core),doorSide:core.doorSide==='left'?'top':'bottom'}:core,corridors=flip?g.corridors.map(swapRect):g.corridors,built=flip?g.built.map(swapRect):g.built,cores=(flip?g.cores.map(swapRect):g.cores).filter(k=>k.id!==core.id),cx=c.x+(c.doorOffset??c.w/2),top=c.doorSide==='top',out=[];
 for(const q of corridors){
  const x0=Math.max(q.x,c.x),x1=Math.min(q.x+q.w,c.x+c.w);
  if(x1-x0>=1.2-EPS&&(top?q.y+q.h<=c.y+EPS:q.y>=c.y+c.h-EPS)){let sx=Math.max(x0-w+1.2,Math.min(x1-1.2,cx-w/2));const y0=top?q.y+q.h:c.y+c.h,y1=top?c.y:q.y;out.push({x:sx,y:y0,w,h:y1-y0});}
  const sy=top?c.y-w:c.y+c.h,y0=Math.max(q.y,sy),y1=Math.min(q.y+q.h,sy+w);
  if(y1-y0>=1.2-EPS){if(q.x+q.w<=c.x+EPS)out.push({x:q.x+q.w,y:sy,w:c.x+c.w-q.x-q.w,h:w});if(q.x>=c.x+c.w-EPS)out.push({x:c.x,y:sy,w:q.x-c.x,h:w});}
 }
 const ok=s=>s.w>EPS&&s.h>EPS&&Math.abs(built.reduce((a,b)=>a+E.area(E.intersection(s,b)),0)-E.area(s))<.001&&!cores.some(k=>E.overlap(s,k));
 const best=out.filter(s=>ok(s)&&contacts(c,[s]).length).sort((a,b)=>E.area(a)-E.area(b))[0];return best?(flip?swapRect(best):best):null;}
// Reads edited core positions and door faces; aligns a bar spine to them when possible, then links the remaining cores.
function connect(o){const rotated=o.axis==='y',cores=(o.coreLayout||[]).map(c=>rotated?swap(c):{...c}),base={...o,exclusions:[],stubs:[],coreLayout:cores,...(rotated?{W:o.D,D:o.W,courtW:o.courtD,courtD:o.courtW}:{})};let offset=o.offset;
 if(o.typology==='bar'){const c=o.corridor,H=base.D,cands=cores.map(k=>k.doorSide==='top'?(k.y-c)/(H-c):k.doorSide==='bottom'?(k.y+k.h)/(H-c):null).filter(v=>v!=null),valid=cands.filter(v=>v>=.15&&v<=.85),score=v=>cands.filter(u=>Math.abs(u-v)<1e-6).length;if(valid.length)offset=valid.sort((a,b)=>score(b)-score(a)||Math.abs(a-o.offset)-Math.abs(b-o.offset))[0];}
 const g=E.geometry({...base,offset}),stubs=[],errors=[];
 for(const k of g.cores){if(contacts(k,g.corridors).length)continue;const s=stubFor(k,{...g,corridors:g.corridors.concat(stubs)},o.corridor);if(s)stubs.push({...s,kind:'circulation',for:k.id});else errors.push(`${label(k)}: no straight corridor link from its door face. Change the door face or move the core.`);}
 return {offset,stubs:rotated?stubs.map(swapRect):stubs,errors};}
function route(o){return root.CORRIDOR_NETWORK.route(o);}
root.CORE_LAYOUT={cars,openings,faceDoor,door,projectDoor,swap,seed,rotate,snap,contacts,inputErrors,apply,validate,connect,route};
})(typeof window!=='undefined'?window:globalThis);
