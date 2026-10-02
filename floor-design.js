/* Per-storey orthogonal massing and programme. Dimensions are schematic inputs. */
(function(root){'use strict';
const E=root.EXPLORE,R=E.rect,clone=x=>JSON.parse(JSON.stringify(x));
function subtract(a,b){if(!E.overlap(a,b))return [a];const q=E.intersection(a,b);return [R(a.x,a.y,a.w,q.y-a.y),R(a.x,q.y+q.h,a.w,a.y+a.h-q.y-q.h),R(a.x,q.y,q.x-a.x,q.h),R(q.x+q.w,q.y,a.x+a.w-q.x-q.w,q.h)].filter(r=>r.w>.001&&r.h>.001).map(r=>({...a,...r,kind:a.kind}));}
function articulationFront(context){
 const poly=context.sitePoly||[],edges=context.siteEdges||[];
 const lane=edges.map((t,i)=>({t,p:poly[i],q:poly[(i+1)%poly.length]})).filter(e=>e.t==="lane"&&e.p&&e.q).sort((a,b)=>Math.hypot(b.q[0]-b.p[0],b.q[1]-b.p[1])-Math.hypot(a.q[0]-a.p[0],a.q[1]-a.p[1]))[0];
 if(!lane)return "top";
 const dx=lane.q[0]-lane.p[0],dy=lane.q[1]-lane.p[1],centre=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]);
 return Math.abs(dx)>=Math.abs(dy)?((lane.p[1]+lane.q[1])/2>centre[1]?"top":"bottom"):((lane.p[0]+lane.q[0])/2>centre[0]?"left":"right");
}
// Plan-setup moves name their own plan sides, so they cut in the plan frame directly; the older moves follow the street front.
function cuts(o,k){const m=o.moves||{},out=frontCuts(o,k),sb=m.setbackSides,rc=m.recess;
 if(sb?.on&&sb.d>0&&k>=sb.from)for(const s of sb.sides||[])out.push(s==='top'?R(0,0,o.W,sb.d):s==='bottom'?R(0,o.D-sb.d,o.W,sb.d):s==='left'?R(0,0,sb.d,o.D):R(o.W-sb.d,0,sb.d,o.D));
 if(rc?.on&&rc.side&&k<=rc.storeys){const along=rc.side==='top'||rc.side==='bottom'?o.W:o.D,w=Math.min(rc.w,along),a=(along-w)*(rc.pos??.5);out.push(rc.side==='top'?R(a,0,w,rc.d):rc.side==='bottom'?R(a,o.D-rc.d,w,rc.d):rc.side==='left'?R(0,a,rc.d,w):R(o.W-rc.d,a,rc.d,w));}
 return out;}
function frontCuts(o,k){const face=o.articulationFront||"top";if(face!=="top"){
 const sideways=face==="left"||face==="right",W=sideways?o.D:o.W,D=sideways?o.W:o.D;
 return frontCuts({...o,W,D,articulationFront:"top"},k).map(q=>face==="bottom"?R(o.W-q.x-q.w,o.D-q.y-q.h,q.w,q.h):face==="left"?R(q.y,o.D-q.x-q.w,q.h,q.w):R(o.W-q.y-q.h,q.x,q.h,q.w));
 }
const m=o.moves||{},out=[];let front=0,rear=0,side=0;if(m.setback4?.on&&k>4)front=m.setback4.d;if(m.stepDown?.on&&k>m.stepDown.storeys)rear=m.stepDown.depth;if(m.roofSet?.on&&k===o.floors){side=m.roofSet.d;front=Math.max(front,side);rear=Math.max(rear,side);}if(front)out.push(R(0,0,o.W,front));if(rear)out.push(R(0,o.D-rear,o.W,rear));if(side)out.push(R(0,0,side,o.D),R(o.W-side,0,side,o.D));if(m.recess?.on&&!m.recess.side&&k<=m.recess.storeys)out.push(R((o.W-m.recess.w)*m.recess.pos,front,m.recess.w,m.recess.d));return out;}
function prepare(g,o){if(!o.floorDesign)return;
 const cs=o.cuts||[];
 if(o.fixedCores){g.cores=clone(o.fixedCores);g.errors=g.errors.filter(s=>!s.includes('template does not fit'));}
 g.cuts=[];for(const key of ['built','corridors'])for(const cut of cs)g[key]=g[key].flatMap(r=>subtract(r,cut));
 // A cut that merely trims a band shrinks it; a cut that would split it stays an obstacle so the band still reaches its corridor.
 for(const cut of cs)g.bands=g.bands.flatMap(b=>{const parts=subtract(b,cut);if(parts.length<=1)return parts;if(!g.cuts.includes(cut))g.cuts.push(cut);return [b];});
 if(root.CORE_LAYOUT&&o.coreLayout)g.errors.push(...root.CORE_LAYOUT.validate(g,o));
 if(root.POLY_PACK)root.POLY_PACK.recover(g,o);
 if(o.typology==='free'&&root.CORRIDOR_NETWORK)g.bands=root.CORRIDOR_NETWORK.bands(g,o);
 g.bands=g.bands.filter(b=>b.ground||g.corridors.some(c=>E.attach(b,c)));
 for(const core of g.cores)if(!g.corridors.some(c=>E.attach(core,c))){if(!(o.typology==='free'&&!(o.freeCorridors&&o.freeCorridors.length)))g.errors.push('A stacked core has lost its corridor connection.');}else if(cs.some(c=>E.overlap(core,c)))g.errors.push('Massing removes part of a stacked core. Reduce the setback or change the core / corridor position.');
 for(const room of o.exclusions){if(Math.abs(g.built.reduce((s,b)=>s+E.area(E.intersection(room,b)),0)-E.area(room))>.001)g.errors.push(`${room.name||'Reservation'} is outside a continuous built area.`);if(g.cores.concat(g.corridors).some(b=>E.overlap(room,b)))g.errors.push(`${room.name||'Reservation'} overlaps a core or corridor.`);}
 for(let i=0;i<o.exclusions.length;i++)for(let j=i+1;j<o.exclusions.length;j++)if(E.overlap(o.exclusions[i],o.exclusions[j]))g.errors.push('Ground programme / exclusions overlap.');
}
function extend(g,units,o){if(!o.floorDesign||o.absorb===false)return;
 // Split the shallow strip behind the lift at its midpoint; each half joins its neighbour.
 for(const c of g.cores.filter(c=>c.kind==='elevator'))for(const b of g.bands){if(b.axis!=='x'||!E.overlap(c,b)||b.entry!=='bottom')continue;
 const h=c.y-b.y;if(h<1.2)continue;
 for(const side of [-1,1]){const u=units.find(u=>Math.abs((side<0?u.x+u.w:u.x)-(side<0?c.x:c.x+c.w))<.02&&Math.abs(u.y-b.y)<.02);if(!u)continue;
 const patch=R(side<0?c.x:c.x+c.w/2,b.y,c.w/2,h),net=R(patch.x+(side>0?o.party/2:0),patch.y+o.wall,patch.w-o.party/2,patch.h-2*o.wall);
 if(net.h<.9||g.cores.concat(g.corridors,o.exclusions,units.filter(v=>v!==u).flatMap(v=>[v,...(v.patches||[])])).some(v=>E.overlap(patch,v)))continue;
 const next=u.net+E.area(net)+o.party/2*net.h;let t=o.types.find(t=>t.key===u.type);if(next>t.max+.01){t=o.types.find(t=>t.share>0&&next>=t.min&&next<=t.max&&u.w-o.party>=t.frontage);if(!t)continue;u.type=t.key;u.beds=t.beds;}
 // Net bridge removes the former side wall where the extension connects.
 const bridge=R(side<0?u.netRect.x+u.netRect.w:patch.x+patch.w,net.y,o.party/2,net.h);
 u.patches=(u.patches||[]).concat(patch);u.netPatches=(u.netPatches||[]).concat(net,bridge);u.net+=E.area(net)+E.area(bridge);
 }
 }
}
// Leftover plate the band fit could not use becomes a unit of its own when it has everything a unit needs: a clear width of at
// least 13 ft (3.96 m) or the minimum unit width if larger, a door onto the corridor and a window face. The largest rectangle
// that fits an enabled type is taken after neighbours have had a chance to absorb the space; remaining slivers are tried again.
function carve(g,units,o){if(o.absorb===false||(o.groundProgram&&o.level===1&&!o.groundUse))return 0;const EPS=1e-4,minW=Math.max(o.minWidth||0,3.96),types=o.types.filter(t=>t.share>0);if(!types.length)return 0;
 const facades=(root.CORRIDOR_NETWORK?.boundaries(g.built,o)||[]).filter(f=>f.eligible),body=u=>u.parts||[u,...(u.patches||[])];let made=0;
 const overlapOn=(r,side,a,z,v)=>{const [lo,hi,at]=side==='top'?[r.x,r.x+r.w,r.y]:side==='bottom'?[r.x,r.x+r.w,r.y+r.h]:side==='left'?[r.y,r.y+r.h,r.x]:[r.y,r.y+r.h,r.x+r.w];return Math.abs(at-v)<EPS?Math.max(0,Math.min(hi,z)-Math.max(lo,a)):0;};
 const inBuilt=(x,y)=>g.built.some(b=>x>b.x+EPS&&x<b.x+b.w-EPS&&y>b.y+EPS&&y<b.y+b.h-EPS),outside=(r,s)=>{const [x,y]=s==='top'?[r.x+r.w/2,r.y-.05]:s==='bottom'?[r.x+r.w/2,r.y+r.h+.05]:s==='left'?[r.x-.05,r.y+r.h/2]:[r.x+r.w+.05,r.y+r.h/2];return !inBuilt(x,y);};
 for(let round=0;round<8;round++){
  let free=g.built.map(r=>({...r}));for(const q of g.cores.concat(g.corridors,g.voids||[],o.exclusions||[],units.flatMap(body)))free=free.flatMap(r=>subtract(r,q));free=free.filter(r=>r.w>EPS&&r.h>EPS);if(!free.length)break;
  const xs=[...new Set(free.flatMap(r=>[r.x,r.x+r.w]).map(v=>+v.toFixed(4)))].sort((a,b)=>a-b),ys=[...new Set(free.flatMap(r=>[r.y,r.y+r.h]).map(v=>+v.toFixed(4)))].sort((a,b)=>a-b);
  const cell=(i,j)=>{const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;return free.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h);},ok=[];for(let i=0;i<xs.length-1;i++){ok.push([]);for(let j=0;j<ys.length-1;j++)ok[i].push(cell(i,j));}
  let best=null;
  for(let i0=0;i0<xs.length-1;i0++)for(let j0=0;j0<ys.length-1;j0++){if(!ok[i0][j0])continue;let jmax=ys.length-1;
   for(let i1=i0;i1<xs.length-1;i1++){let j1=j0;while(j1<jmax&&ok[i1][j1])j1++;jmax=j1;if(jmax===j0)break;
    for(let jj=j0+1;jj<=jmax;jj++){const r=R(xs[i0],ys[j0],xs[i1+1]-xs[i0],ys[jj]-ys[j0]);if(Math.min(r.w,r.h)<minW-EPS||Math.max(r.w,r.h)>3*Math.min(r.w,r.h)+EPS)continue;
     let door=null;for(const c of g.corridors)for(const side of ['top','bottom','left','right']){const [a,z,v]=side==='top'?[c.x,c.x+c.w,c.y+c.h]:side==='bottom'?[c.x,c.x+c.w,c.y]:side==='left'?[c.y,c.y+c.h,c.x+c.w]:[c.y,c.y+c.h,c.x];const len=overlapOn(r,side,a,z,v);if(len>=1.2&&(!door||len>door.len)){const lo=Math.max(side==='top'||side==='bottom'?r.x:r.y,a),mid=lo+len/2;door={side,len,point:side==='top'?[mid,r.y]:side==='bottom'?[mid,r.y+r.h]:side==='left'?[r.x,mid]:[r.x+r.w,mid]};}}
     if(!door)continue;let win=null;for(const f of facades){const len=overlapOn(r,f.side,f.a,f.z,f.v);if(len>=1.2&&(!win||len>win.len))win={side:f.side,face:f.face,len};}if(!win)continue;
     const inset=s=>outside(r,s)?o.wall:g.corridors.concat(g.cores).some(q=>overlapOn(r,s,s==='top'||s==='bottom'?q.x:q.y,s==='top'||s==='bottom'?q.x+q.w:q.y+q.h,s==='top'?q.y+q.h:s==='bottom'?q.y:s==='left'?q.x+q.w:q.x)>EPS)?o.corridorWall:o.party/2;
     const net=R(r.x+inset('left'),r.y+inset('top'),r.w-inset('left')-inset('right'),r.h-inset('top')-inset('bottom')),area=E.area(net),type=types.find(t=>area>=t.min-.01&&area<=t.max+.01&&win.len+EPS>=t.frontage);
     if(!type)continue;if(!best||area>best.area+EPS)best={r,net,area,type,door,win};}}}
  if(!best)break;const {r,net,area,type,door,win}=best;
  units.push({...r,kind:'unit',netRect:net,net:area,type:type.key,beds:type.beds,entry:door.side,face:win.face,windowSide:win.side,door:door.point,frontage:win.len,id:Math.max(0,...units.map(u=>u.id||0))+1,carved:true});made++;}
 return made;}
// Fit within type ranges first. The final pass can exceed a preferred area range
// to absorb a usable adjoining pocket, while retaining compact, connected units.
function absorb(g,units,o,finish=false){if(o.absorb===false||!units.length||(finish&&o.slices?.[o.level])||(o.groundProgram&&o.level===1&&!o.groundUse))return 0;const EPS=1e-4;let gained=0;
 const coalesce=rs=>{let list=rs.map(r=>({...r})),merged=true;while(merged){merged=false;outer:for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];if(Math.abs(a.x-b.x)<EPS&&Math.abs(a.w-b.w)<EPS&&(Math.abs(a.y+a.h-b.y)<EPS||Math.abs(b.y+b.h-a.y)<EPS)){list.splice(j,1);list[i]={...a,y:Math.min(a.y,b.y),h:a.h+b.h};merged=true;break outer;}if(Math.abs(a.y-b.y)<EPS&&Math.abs(a.h-b.h)<EPS&&(Math.abs(a.x+a.w-b.x)<EPS||Math.abs(b.x+b.w-a.x)<EPS)){list.splice(j,1);list[i]={...a,x:Math.min(a.x,b.x),w:a.w+b.w};merged=true;break outer;}}}return list;};
 const body=u=>u.parts||[u,...(u.patches||[])],circ=g.corridors.concat(g.cores),inBuilt=(x,y)=>g.built.some(b=>x>b.x+EPS&&x<b.x+b.w-EPS&&y>b.y+EPS&&y<b.y+b.h-EPS);
 const touches=(r,side,set)=>set.some(q=>side==='top'?Math.abs(q.y+q.h-r.y)<EPS&&Math.min(q.x+q.w,r.x+r.w)-Math.max(q.x,r.x)>EPS:side==='bottom'?Math.abs(q.y-r.y-r.h)<EPS&&Math.min(q.x+q.w,r.x+r.w)-Math.max(q.x,r.x)>EPS:side==='left'?Math.abs(q.x+q.w-r.x)<EPS&&Math.min(q.y+q.h,r.y+r.h)-Math.max(q.y,r.y)>EPS:Math.abs(q.x-r.x-r.w)<EPS&&Math.min(q.y+q.h,r.y+r.h)-Math.max(q.y,r.y)>EPS);
 const outside=(r,side)=>{const [x,y]=side==='top'?[r.x+r.w/2,r.y-.05]:side==='bottom'?[r.x+r.w/2,r.y+r.h+.05]:side==='left'?[r.x-.05,r.y+r.h/2]:[r.x+r.w+.05,r.y+r.h/2];return !inBuilt(x,y);};
 const types=o.types.filter(t=>t.share>0);
 for(let pass=0;pass<6;pass++){let free=g.built.map(r=>({...r}));for(const q of g.cores.concat(g.corridors,g.voids||[],o.exclusions||[],units.flatMap(body)))free=free.flatMap(r=>subtract(r,q));
  // Whole leftover pieces first; a piece too large for one unit is tried again as the strips the fit left, so it can be shared.
  const ok=r=>r.w*r.h>=1&&Math.min(r.w,r.h)>=.6,big=coalesce(free).filter(ok).sort((a,b)=>b.w*b.h-a.w*a.h),strips=free.filter(ok).filter(r=>!big.some(q=>Math.abs(q.x-r.x)<EPS&&Math.abs(q.y-r.y)<EPS&&Math.abs(q.w-r.w)<EPS&&Math.abs(q.h-r.h)<EPS)).sort((a,b)=>b.w*b.h-a.w*a.h);let changed=false;
  // A residual can span several neighbours. Offer each the portion along its own edge.
  const shared=[];for(const r of big)for(const u of units)for(const p of body(u)){
   if(Math.abs(p.y+p.h-r.y)<EPS||Math.abs(p.y-r.y-r.h)<EPS){const a=Math.max(p.x,r.x),z=Math.min(p.x+p.w,r.x+r.w);if(z-a>EPS)shared.push(R(a,r.y,z-a,r.h));}
   if(Math.abs(p.x+p.w-r.x)<EPS||Math.abs(p.x-r.x-r.w)<EPS){const a=Math.max(p.y,r.y),z=Math.min(p.y+p.h,r.y+r.h);if(z-a>EPS)shared.push(R(r.x,a,r.w,z-a));}}
  for(const r of big.concat(strips,shared.filter(ok),finish?big.flatMap(r=>{const horizontal=r.w>=r.h;return horizontal?[R(r.x,r.y,r.w/2,r.h),R(r.x+r.w/2,r.y,r.w/2,r.h)]:[R(r.x,r.y,r.w,r.h/2),R(r.x,r.y+r.h/2,r.w,r.h/2)];}).filter(ok):[])){let best=null;
   for(const u of units)for(const p of body(u))for(const side of ['top','bottom','left','right']){
    // side: the leftover's edge that lies on the unit. Its span must sit within the unit's edge.
    const reach=finish?Math.max(.2,Math.min(1.2,o.depthTolerance??.6)):.2;const on=side==='top'?Math.abs(p.y+p.h-r.y)<EPS&&r.x>=p.x-reach&&r.x+r.w<=p.x+p.w+reach:side==='bottom'?Math.abs(p.y-r.y-r.h)<EPS&&r.x>=p.x-reach&&r.x+r.w<=p.x+p.w+reach:side==='left'?Math.abs(p.x+p.w-r.x)<EPS&&r.y>=p.y-reach&&r.y+r.h<=p.y+p.h+reach:Math.abs(p.x-r.x-r.w)<EPS&&r.y>=p.y-reach&&r.y+r.h<=p.y+p.h+reach;
    if(u.manual||u.edited||!on||root.POLY_PACK&&!root.POLY_PACK.compactShape(body(u).concat([r])))continue;
    const inset=s=>s===side?-o.party/2:outside(r,s)?o.wall:touches(r,s,circ)?o.corridorWall:o.party/2,l=inset('left'),t=inset('top'),net=R(r.x+l,r.y+t,r.w-l-inset('right'),r.h-t-inset('bottom'));
    if(net.w<.6||net.h<.6)continue;const next=u.net+E.area(net),main=u.windowSide||{front:'top',rear:'bottom',left:'left',right:'right'}[u.face],front=(u.frontage||0)+(main&&main!==side&&outside(r,main)?(main==='top'||main==='bottom'?r.w:r.h):0);let type=o.types.find(q=>q.key===u.type);
    if(!type||next>type.max+.01){type=types.find(q=>next>=q.min&&next<=q.max&&front+EPS>=q.frontage);if(!type&&finish&&Math.min(r.w,r.h)>=1.2)type=types.filter(q=>front+EPS>=q.frontage).sort((a,b)=>b.max-a.max)[0];if(!type)continue;}
    const len=side==='top'||side==='bottom'?r.w:r.h;
    // minAbsorb (plan setup): a thin strip joins only as a widening along at least half the unit's edge that keeps the unit compact, never as a tentacle.
    if(Math.min(r.w,r.h)<(o.minAbsorb||0)){const edge=side==='top'||side==='bottom'?p.w:p.h,ps=body(u).concat([r]),x0=Math.min(...ps.map(q=>q.x)),y0=Math.min(...ps.map(q=>q.y)),box=(Math.max(...ps.map(q=>q.x+q.w))-x0)*(Math.max(...ps.map(q=>q.y+q.h))-y0);if(len<.5*edge-EPS||ps.reduce((a,q)=>a+q.w*q.h,0)<.75*box)continue;}
    if(finish&&root.POLY_PACK&&!root.POLY_PACK.connected(root.POLY_PACK.netShape(coalesce(body(u).concat(r)),g,o)))continue;
    if(!best||len>best.len+EPS||Math.abs(len-best.len)<EPS&&next<best.next)best={u,net,next,type,len,front};}
   if(!best)continue;const {u,net,type}=best;
   if(u.parts){u.parts.push({...r});(u.netParts=u.netParts||[u.netRect]).push(net);}else{u.patches=(u.patches||[]).concat({...r});u.netPatches=(u.netPatches||[]).concat(net);}
   gained+=E.area(net);u.net=best.next;u.type=type.key;u.beds=type.beds;u.frontage=best.front;u.absorbed=true;
   if(finish&&root.POLY_PACK){const ps=coalesce(body(u)),ns=root.POLY_PACK.netShape(ps,g,o);const x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y));Object.assign(u,R(x,y,Math.max(...ps.map(p=>p.x+p.w))-x,Math.max(...ps.map(p=>p.y+p.h))-y),{parts:ps,netParts:ns,netRect:ns.reduce((a,b)=>E.area(a)>E.area(b)?a:b),net:ns.reduce((s,p)=>s+E.area(p),0),patches:undefined,netPatches:undefined});u.enlarged=u.net>type.max+.01;
    // the type was chosen from the estimated area; the measured net shape can come in under that type's minimum (a 3-bed
    // at 68 m²): take the largest type the measured area does reach, so no unit is labelled bigger than it is
    if(u.net<type.min-.01){const fit=types.filter(q=>u.net>=q.min-.01&&(u.frontage||0)+EPS>=q.frontage).sort((a,b)=>b.min-a.min)[0];if(fit){u.type=fit.key;u.beds=fit.beds;u.enlarged=u.net>fit.max+.01;}}}
   changed=true;break;}
  if(!changed)break;}
 if(finish&&o.court&&root.POLY_PACK){const P=root.POLY_PACK;
  // Consider connected pockets around a core together, rather than as isolated slivers.
  for(let pass=0;pass<12;pass++){const free=P.free(g.built,g.cores.concat(g.corridors,g.voids||[],o.exclusions||[],units.flatMap(body))),groups=[];
   for(const r of free){const hits=groups.filter(ps=>ps.some(p=>P.connected([p,r],.01)));if(!hits.length)groups.push([r]);else{hits[0].push(r);for(const ps of hits.slice(1)){hits[0].push(...ps);groups.splice(groups.indexOf(ps),1);}}}
   let best=null;for(const ps of groups){const x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y)),w=Math.max(...ps.map(p=>p.x+p.w))-x,h=Math.max(...ps.map(p=>p.y+p.h))-y;
    const offers=[ps,...[R(x,y,w/2,h),R(x+w/2,y,w/2,h),R(x,y,w,h/2),R(x,y+h/2,w,h/2)].map(q=>ps.map(p=>E.intersection(p,q)).filter(p=>E.area(p)>EPS))];
    for(const patch of offers)for(const u of units){if(u.manual||u.edited||!patch.length)continue;const combined=coalesce(body(u).concat(patch));if(!P.compactShape(combined))continue;const ns=P.netShape(combined,g,o);if(!P.connected(ns))continue;const net=ns.reduce((s,p)=>s+E.area(p),0),gain=net-u.net;if(gain<EPS)continue;const type=types.filter(t=>net>=t.min-EPS&&(u.frontage||0)+EPS>=t.frontage).sort((a,b)=>Math.max(0,net-a.max)-Math.max(0,net-b.max)||Math.abs(net-a.target)-Math.abs(net-b.target))[0];if(!type)continue;
     if(!best||gain>best.gain)best={u,combined,ns,net,gain,type};}}
   if(!best)break;const {u,combined:ps,ns,net,gain,type}=best,x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y));Object.assign(u,R(x,y,Math.max(...ps.map(p=>p.x+p.w))-x,Math.max(...ps.map(p=>p.y+p.h))-y),{parts:ps,netParts:ns,netRect:ns.reduce((a,b)=>E.area(a)>E.area(b)?a:b),net,type:type.key,beds:type.beds,patches:undefined,netPatches:undefined,absorbed:true,enlarged:net>type.max+.01});gained+=gain;
  }
 }
 return gained;}
// Enclosed circulation may widen into a residual pocket after homes have had first choice.
function landings(g,units,o){const P=root.POLY_PACK;if(!P||o.absorb===false||o.geometryOnly||!units.length)return;
 // A core spur separated by a thin automatic unit tail should join the main landing directly.
 for(const spur of g.corridors.filter(c=>c.stub&&!c.exterior))for(const main of g.corridors.filter(c=>!c.stub&&!c.landing&&!c.exterior)){
  const horizontal=main.w>=main.h,lo=horizontal?'y':'x',along=horizontal?'x':'y',thick=horizontal?'h':'w',length=horizontal?'w':'h';
  const a=Math.max(main[along],spur[along]),b=Math.min(main[along]+main[length],spur[along]+spur[length]);if(b-a<1.2)continue;
  const p=main[lo]+main[thick]<=spur[lo]+1e-5?main[lo]+main[thick]:spur[lo]+spur[thick],end=main[lo]+main[thick]<=spur[lo]+1e-5?spur[lo]:main[lo];if(end-p<.05||end-p>o.corridor+.001)continue;
  const bridge=horizontal?R(a,p,b-a,end-p):R(p,a,end-p,b-a);if(P.free([bridge],g.built).length||g.cores.concat(o.exclusions||[]).some(q=>E.overlap(q,bridge)))continue;
  const affected=units.filter(u=>P.parts(u).some(q=>E.overlap(q,bridge)));if(!affected.length||affected.some(u=>u.manual||u.edited)||o.slices?.[o.level])continue;
  const trials=affected.map(u=>{const ps=P.free(P.parts(u),[bridge]),ns=P.netShape(ps,{...g,corridors:g.corridors.concat(bridge)},o),net=ns.reduce((s,p)=>s+E.area(p),0),type=o.types.find(t=>t.key===u.type);return {u,ps,ns,net,type};});
  if(trials.some(t=>!t.ps.length||!P.compactShape(t.ps)||!P.connected(t.ns)||t.net<t.type.min-.01||t.u.net-t.net>t.u.net*.1))continue;
  g.corridors.push({...bridge,kind:'circulation',axis:horizontal?'x':'y',landing:true,exterior:false});
  for(const {u,ps,ns,net} of trials){const x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y));Object.assign(u,R(x,y,Math.max(...ps.map(p=>p.x+p.w))-x,Math.max(...ps.map(p=>p.y+p.h))-y),{parts:ps,netParts:ns,netRect:ns.reduce((a,b)=>E.area(a)>E.area(b)?a:b),net,patches:undefined,netPatches:undefined});const doors=P.contacts(ps,g.corridors),valid=doors.some(d=>u.door&&Math.abs(u.door[['top','bottom'].includes(d.entry)?1:0]-d.v)<.001&&u.door[['top','bottom'].includes(d.entry)?0:1]>=d.a+.5&&u.door[['top','bottom'].includes(d.entry)?0:1]<=d.b-.5);if(!valid&&doors.length){const d=doors[0];u.entry=d.entry;u.door=['top','bottom'].includes(d.entry)?[(d.a+d.b)/2,d.v]:[d.v,(d.a+d.b)/2];}}
  // Straighten a small party-wall tooth immediately beside this landing.
  for(const receiver of affected)for(const donor of units){if(donor===receiver||donor.manual||donor.edited)continue;
   for(const tooth of P.parts(donor)){const small=Math.min(tooth.w,tooth.h),long=Math.max(tooth.w,tooth.h),near=R(bridge.x-o.corridor,bridge.y-o.corridor,bridge.w+2*o.corridor,bridge.h+2*o.corridor);if(small>.8||long<1.2||long>4||!E.overlap(tooth,near)||P.shared(receiver,{parts:[tooth]})<long-.001)continue;
    const donorParts=P.free(P.parts(donor),[tooth]),receiverParts=coalesce(P.parts(receiver).concat(tooth));if(!P.compactShape(donorParts)||!P.compactShape(receiverParts))continue;
    const edits=[[donor,donorParts],[receiver,receiverParts]].map(([u,ps])=>{const ns=P.netShape(ps,g,o);return {u,ps,ns,net:ns.reduce((s,p)=>s+E.area(p),0)};});if(edits.some(t=>!P.connected(t.ns)||t.net<o.types.find(q=>q.key===t.u.type).min-.01))continue;
    for(const {u,ps,ns,net} of edits){const x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y));Object.assign(u,R(x,y,Math.max(...ps.map(p=>p.x+p.w))-x,Math.max(...ps.map(p=>p.y+p.h))-y),{parts:ps,netParts:ns,netRect:ns.reduce((a,b)=>E.area(a)>E.area(b)?a:b),net,patches:undefined,netPatches:undefined});}break;
   }
  }

 }
 const added=[];for(let pass=0;pass<8;pass++){const free=coalesce(P.free(g.built,g.cores.concat(g.corridors,g.voids||[],g.cuts||[],o.exclusions||[],units.flatMap(P.parts))));let changed=false;
  for(const r of free){if(E.area(r)<.02||Math.min(r.w,r.h)>o.corridor+.001||Math.max(r.w,r.h)>6||E.area(r)>o.corridor*6)continue;
   const contacts=g.corridors.filter(c=>!c.exterior&&P.shared({parts:[c]},{parts:[r]})>=Math.min(.6,Math.min(r.w,r.h))-.001);if(!contacts.length)continue;
   const nearCore=g.cores.some(c=>P.shared({parts:[c]},{parts:[r]})>.01),strip=Math.min(r.w,r.h)<=.6+.001;if(!nearCore&&!strip)continue;
   const q={...r,kind:'circulation',axis:r.w>=r.h?'x':'y',exterior:false,landing:true};g.corridors.push(q);added.push(q);changed=true;
  }if(!changed)break;
 }
 for(const u of units){if(!added.some(r=>P.shared(u,{parts:[r]})>.001))continue;const ns=P.netShape(P.parts(u),g,o);u.netParts=ns;u.netRect=ns.reduce((a,b)=>E.area(a)>E.area(b)?a:b);u.net=ns.reduce((s,p)=>s+E.area(p),0);u.netPatches=undefined;}
}
const PROGRAMME=[{name:'Lobby',area:30,access:'both',near:'street'},{name:'Loading',area:30,access:'exterior',near:'lane'},{name:'Waste',area:9,access:'exterior',near:'lane'},{name:'Mechanical',area:16,access:'corridor',near:'lane'},{name:'Electrical',area:12,access:'corridor',near:'lane'},{name:'Water entry',area:6,access:'corridor',near:'lane'},{name:'Mail',area:5,access:'corridor',near:'lobby'},{name:'Concierge',area:5,access:'corridor',near:'lobby'}];
// Whatever the plate has left after cores, circulation, cuts and the programme rooms becomes flexible space.
const coalesce=(rs,EPS=1e-5)=>{let list=rs.map(r=>({...r})),merged=true;while(merged){merged=false;outer:for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];if(Math.abs(a.x-b.x)<EPS&&Math.abs(a.w-b.w)<EPS&&(Math.abs(a.y+a.h-b.y)<EPS||Math.abs(b.y+b.h-a.y)<EPS)){list.splice(j,1);list[i]={...a,y:Math.min(a.y,b.y),h:a.h+b.h};merged=true;break outer;}if(Math.abs(a.y-b.y)<EPS&&Math.abs(a.h-b.h)<EPS&&(Math.abs(a.x+a.w-b.x)<EPS||Math.abs(b.x+b.w-a.x)<EPS)){list.splice(j,1);list[i]={...a,x:Math.min(a.x,b.x),w:a.w+b.w};merged=true;break outer;}}}return list;};
function leftoverFlex(g,obstacles,absorbSlivers=true){const EPS=1e-5,out=[];
 const rooms=obstacles.filter(q=>q.name&&q.name!=='Flexible space');
 for(const b of g.bands){let free=(b.parts||[{x:b.x,y:b.y,w:b.w,h:b.h}]).map(r=>({...r}));for(const q of obstacles)free=free.flatMap(r=>subtract(r,q));
  for(const r of coalesce(free)){if(!absorbSlivers||Math.min(r.w,r.h)>=1.2&&r.w*r.h>=4){out.push({x:r.x,y:r.y,w:r.w,h:r.h,name:'Flexible space',on:true});continue;}
   // Sliver: extend a room that shares its full edge.
   const n=rooms.find(q=>(Math.abs(q.x+q.w-r.x)<EPS||Math.abs(r.x+r.w-q.x)<EPS)&&Math.abs(q.y-r.y)<EPS&&Math.abs(q.h-r.h)<EPS)||rooms.find(q=>(Math.abs(q.y+q.h-r.y)<EPS||Math.abs(r.y+r.h-q.y)<EPS)&&Math.abs(q.x-r.x)<EPS&&Math.abs(q.w-r.w)<EPS);
   if(!n)continue;if(Math.abs(n.h-r.h)<EPS&&Math.abs(n.y-r.y)<EPS){n.x=Math.min(n.x,r.x);n.w+=r.w;}else{n.y=Math.min(n.y,r.y);n.h+=r.h;}}}
 return out;}
// Reserve the entrance before distributing other ground-floor rooms.
function entranceLobby(o,g,item){
 const side=o.programmeRecess?.side||o.streetSide||o.articulationFront||'top',W=['left','right'].includes(side)?o.D:o.W,D=['left','right'].includes(side)?o.W:o.D;
 const to=r=>side==='top'?{...r}:side==='bottom'?{...r,y:o.D-r.y-r.h}:side==='left'?{...r,x:r.y,y:r.x,w:r.h,h:r.w}:{...r,x:r.y,y:o.W-r.x-r.w,w:r.h,h:r.w};
 const from=r=>side==='top'?r:side==='bottom'?{...r,y:o.D-r.y-r.h}:side==='left'?{...r,x:r.y,y:r.x,w:r.h,h:r.w}:{...r,x:o.W-r.y-r.h,y:r.x,w:r.h,h:r.w};
 const built=g.built.map(to),corridors=g.corridors.map(to),blocks=g.cores.concat(g.corridors,o.exclusions||[],o.programmeCuts||[]).map(to),recess=o.programmeRecess&&to(o.programmeRecess.rect),front=recess?recess.y+recess.h:0,lo=recess?recess.x:0,hi=recess?recess.x+recess.w:W;
 const unique=xs=>[...new Set(xs.filter(x=>Number.isFinite(x)).map(x=>+x.toFixed(5)))].sort((a,b)=>a-b),xs=unique([0,W,lo,hi,lo-3,lo+3,hi-3,hi+3,(lo+hi)/2,(lo+hi)/2-1.5,(lo+hi)/2+1.5,...built.concat(blocks).flatMap(r=>[r.x,r.x+r.w])]).filter(x=>x>=0&&x<=W);
 const contact=(a,b)=>{const x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);return (Math.abs(a.x+a.w-b.x)<.001||Math.abs(b.x+b.w-a.x)<.001)?y:(Math.abs(a.y+a.h-b.y)<.001||Math.abs(b.y+b.h-a.y)<.001)?x:0;};
 const merge=rs=>{rs=rs.map(r=>({...r}));for(let change=true;change;){change=false;outer:for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){const a=rs[i],b=rs[j],h=Math.abs(a.y-b.y)<.001&&Math.abs(a.h-b.h)<.001&&Math.abs(contact(a,b)-a.h)<.001,v=Math.abs(a.x-b.x)<.001&&Math.abs(a.w-b.w)<.001&&Math.abs(contact(a,b)-a.w)<.001;if(h||v){rs[i]=R(Math.min(a.x,b.x),Math.min(a.y,b.y),h?a.w+b.w:a.w,v?a.h+b.h:a.h);rs.splice(j,1);change=true;break outer;}}}return rs;};
 // Rank the entrance by connected access to both a lift and a stair; the corridor carries that access, so area well past the
 // programme (a lobby wrapping the cores) costs more than a short walk along the corridor.
 const centres=corridors.map(c=>[c.x+c.w/2,c.y+c.h/2]),dist=corridors.map((a,i)=>corridors.map((b,j)=>i===j?0:E.attach(a,b)?Math.hypot(centres[i][0]-centres[j][0],centres[i][1]-centres[j][1]):Infinity));
 for(let k=0;k<dist.length;k++)for(let i=0;i<dist.length;i++)for(let j=0;j<dist.length;j++)dist[i][j]=Math.min(dist[i][j],dist[i][k]+dist[k][j]);
 const targets=kind=>g.cores.filter(c=>kind==='lift'?c.kind==='elevator':['stair','scissor'].includes(c.kind)).flatMap(c=>(root.CORE_LAYOUT?.contacts(c,g.corridors)||[]).flatMap(d=>{const p=to(R(d.point[0],d.point[1],0,0));return corridors.flatMap((q,i)=>p.x>=q.x-.001&&p.x<=q.x+q.w+.001&&p.y>=q.y-.001&&p.y<=q.y+q.h+.001?[{index:i,point:[p.x,p.y]}]:[]);}));
 const lift=targets('lift'),stair=targets('stair'),hasLift=g.cores.some(c=>c.kind==='elevator'),hasStair=g.cores.some(c=>['stair','scissor'].includes(c.kind)),plateArea=built.reduce((s,p)=>s+E.area(p),0);
 let best=null;
 for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++){const x=xs[i],width=xs[j]-x;if(width<1.8||Math.min(xs[j],hi)-Math.max(x,lo)<1.2)continue;
  for(const y of unique([0,front])){const ends=unique([D,front+2,front+3,front+4,front+6,...blocks.flatMap(r=>[r.y,r.y+r.h,r.y+r.h+1.5,r.y+r.h+2])]);
   for(const z of ends){if(z<=front+1.5||z>D+.001)continue;const box=R(x,y,width,z-y);if(!corridors.some(q=>E.overlap(box,q)||contact(box,q)>=.9))continue;
    let ps=built.map(b=>E.intersection(box,b)).filter(p=>E.area(p)>.001);for(const b of blocks)ps=ps.flatMap(p=>subtract(p,b));ps=merge(ps);const area=ps.reduce((n,p)=>n+E.area(p),0);if(area<6||area>Math.min(140,plateArea*.3))continue;
    const entry=ps.find(p=>Math.abs(p.y-front)<.001&&Math.min(p.x+p.w,hi)-Math.max(p.x,lo)>=1.2);if(!entry||!ps.some(p=>corridors.some(q=>contact(p,q)>=.9)))continue;
    const reached=new Set([entry]);for(let changed=true;changed;){changed=false;for(const p of ps)if(!reached.has(p)&&[...reached].some(q=>contact(p,q)>=1.2-.001)){reached.add(p);changed=true;}}if(reached.size!==ps.length)continue;
    const accessIds=corridors.flatMap((q,i)=>ps.filter(p=>contact(p,q)>=.9).map(p=>({index:i,point:[(Math.max(p.x,q.x)+Math.min(p.x+p.w,q.x+q.w))/2,(Math.max(p.y,q.y)+Math.min(p.y+p.h,q.y+q.h))/2]}))),length=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),distance=ids=>ids.length?Math.min(...accessIds.flatMap(a=>ids.map(b=>a.index===b.index?length(a.point,b.point):length(a.point,centres[a.index])+dist[a.index][b.index]+length(centres[b.index],b.point)))):0;
    if(hasLift&&!lift.length||hasStair&&!stair.length)continue;const liftDistance=distance(lift),stairDistance=distance(stair);if(!Number.isFinite(liftDistance+stairDistance))continue;
    const skinny=[x,W-x-width].reduce((s,w)=>s+(w>.1&&w<3.6?(3.6-w)*10:0),0),score=(liftDistance+stairDistance)*8+ps.length*10+skinny+area*.18+Math.max(0,area-1.5*(item.area||30))*1.5+(z-front)*.4+Math.abs(x+width/2-(lo+hi)/2)*.01;if(!best||score<best.score)best={score,parts:[entry,...ps.filter(p=>p!==entry)].map(from),entryPoint:from(R((Math.max(entry.x,lo)+Math.min(entry.x+entry.w,hi))/2,front,0,0))};
   }
  }
 }
 if(!best)return null;let access=null;
 for(const p of best.parts)for(const c of g.corridors){const x0=Math.max(p.x,c.x),x1=Math.min(p.x+p.w,c.x+c.w),y0=Math.max(p.y,c.y),y1=Math.min(p.y+p.h,c.y+c.h);for(const [s,v,len,x,y] of [['top',Math.abs(p.y-c.y-c.h),x1-x0,(x0+x1)/2,p.y],['bottom',Math.abs(p.y+p.h-c.y),x1-x0,(x0+x1)/2,p.y+p.h],['left',Math.abs(p.x-c.x-c.w),y1-y0,p.x,(y0+y1)/2],['right',Math.abs(p.x+p.w-c.x),y1-y0,p.x+p.w,(y0+y1)/2]])if(v<.001&&len>=.9&&(!access||len>access.len))access={side:s,x,y,len};}
 return {name:item.name,on:true,open:true,flexibleArea:true,parts:best.parts,entry:side,entryPoint:{x:best.entryPoint.x,y:best.entryPoint.y,side},door:access&&{side:access.side,x:access.x,y:access.y}};
}
function rooms(o,g){
 if(!o.rooms){const programme=o.programme||PROGRAMME,lobby=programme.find(p=>p.name==='Lobby'&&p.on!==false&&p.area>0);if(lobby){const placed=entranceLobby(o,g,lobby);if(placed)return rooms({...o,rooms:[placed],placeRooms:programme.filter(p=>p.name!=='Lobby').map(p=>p.name)},g);}}
 const baseBlocks=g.cores.concat(g.corridors,o.exclusions||[],o.programmeCuts||[]);
 if(o.rooms){const fixed=o.rooms.flatMap((r,k)=>(r.parts||[{x:r.x,y:r.y,w:r.w,h:r.h}]).map((p,j)=>({x:p.x,y:p.y,w:p.w,h:p.h,name:r.name,on:r.on,open:r.open,flexibleArea:r.flexibleArea,entry:r.entry,entryPoint:r.entryPoint,door:r.door,roomIndex:k,part:j})));
  // Rooms just switched on (o.placeRooms) are placed around the kept ones, which stay where they are.
  const kept=new Set(o.rooms.map(r=>r.name)),missing=(o.programme||PROGRAMME).filter(p=>p.on!==false&&p.area>0&&!kept.has(p.name)&&o.placeRooms?.includes(p.name));
  const added=missing.length?rooms({...o,rooms:undefined,programme:missing,programmeCuts:(o.programmeCuts||[]).concat(fixed.filter(r=>r.on!==false).map(r=>({x:r.x,y:r.y,w:r.w,h:r.h})))},g).filter(r=>r.name!=='Flexible space'&&!r.unplaced&&missing.some(p=>p.name===r.name)).map(r=>({...r,roomIndex:o.rooms.length+missing.findIndex(p=>p.name===r.name)})):[];
  const all=fixed.concat(added),flex=leftoverFlex(g,baseBlocks.concat(all.filter(r=>r.on!==false)),false),next=Math.max(o.rooms.length-1,...added.map(r=>r.roomIndex))+1;return all.concat(flex.map((q,i)=>({...q,roomIndex:next+i})));}
 // Distribute what is left of the plate after cores, circulation and cuts to the programme by target area.
 // Leftover rectangles are the rows. Contact with a corridor, a lift or a stair counts as circulation access;
 // contact with the plate edge counts as exterior access. Deep rows split into a circulation-side and a façade-side row.
 const items=(o.programme||PROGRAMME).map(p=>({...PROGRAMME.find(q=>q.name===p.name),...p})).filter(p=>p.on!==false&&p.area>0),rows=[],EPS=1e-5;
 const blocks=g.cores.concat(g.corridors,o.exclusions||[],o.programmeCuts||[]),circ=g.corridors.concat(g.cores);
 const coalesce=rs=>{let out=rs.map(r=>({...r})),merged=true;while(merged){merged=false;outer:for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){const a=out[i],b=out[j];if(Math.abs(a.x-b.x)<EPS&&Math.abs(a.w-b.w)<EPS&&(Math.abs(a.y+a.h-b.y)<EPS||Math.abs(b.y+b.h-a.y)<EPS)){const y=Math.min(a.y,b.y);out.splice(j,1);out[i]={...a,y,h:a.h+b.h};merged=true;break outer;}if(Math.abs(a.y-b.y)<EPS&&Math.abs(a.h-b.h)<EPS&&(Math.abs(a.x+a.w-b.x)<EPS||Math.abs(b.x+b.w-a.x)<EPS)){const x=Math.min(a.x,b.x);out.splice(j,1);out[i]={...a,x,w:a.w+b.w};merged=true;break outer;}}}return out;};
 const insideBuilt=(x,y)=>g.built.some(b=>x>b.x+EPS&&x<b.x+b.w-EPS&&y>b.y+EPS&&y<b.y+b.h-EPS);
 const edgeTouch=(r,side,set)=>set.some(q=>side==='top'?Math.abs(q.y+q.h-r.y)<EPS&&Math.min(q.x+q.w,r.x+r.w)-Math.max(q.x,r.x)>.3:side==='bottom'?Math.abs(q.y-(r.y+r.h))<EPS&&Math.min(q.x+q.w,r.x+r.w)-Math.max(q.x,r.x)>.3:side==='left'?Math.abs(q.x+q.w-r.x)<EPS&&Math.min(q.y+q.h,r.y+r.h)-Math.max(q.y,r.y)>.3:Math.abs(q.x-(r.x+r.w))<EPS&&Math.min(q.y+q.h,r.y+r.h)-Math.max(q.y,r.y)>.3);
 const exteriorSide=(r,side)=>{const [x,y]=side==='top'?[r.x+r.w/2,r.y-.05]:side==='bottom'?[r.x+r.w/2,r.y+r.h+.05]:side==='left'?[r.x-.05,r.y+r.h/2]:[r.x+r.w+.05,r.y+r.h/2];return !insideBuilt(x,y);};
 for(const b of g.bands){let free=(b.parts||[{x:b.x,y:b.y,w:b.w,h:b.h}]).map(r=>({...r}));for(const q of blocks)free=free.flatMap(r=>subtract(r,q));
  for(const r of coalesce(free)){const ax=b.axis,depth=ax==='x'?r.h:r.w;if(depth<1.5||(ax==='x'?r.w:r.h)<1)continue;
   const cross=ax==='x'?['top','bottom']:['left','right'],lowCirc=edgeTouch(r,cross[0],circ),highCirc=edgeTouch(r,cross[1],circ),hasCirc=lowCirc||highCirc||edgeTouch(r,ax==='x'?'left':'top',circ)||edgeTouch(r,ax==='x'?'right':'bottom',circ),hasExt=['top','bottom','left','right'].some(s=>exteriorSide(r,s));
   const row={b,rect:r,y0:ax==='x'?r.y:r.x,depth,gaps:[ax==='x'?[r.x,r.x+r.w]:[r.y,r.y+r.h]],role:hasCirc&&hasExt?'both':hasCirc?'corridor':hasExt?'exterior':'both',circLow:lowCirc||!highCirc};rows.push(row);}}
 if(!rows.length)return [];
 const rectOf=(row,a,w)=>row.b.axis==='x'?R(a,row.y0,w,row.depth):R(row.y0,a,row.depth,w);
 const dist=(r,segs)=>segs?.length?Math.min(...segs.map(([p,q])=>{const cx=r.x+r.w/2,cy=r.y+r.h/2,dx=q[0]-p[0],dy=q[1]-p[1],t=Math.max(0,Math.min(1,((cx-p[0])*dx+(cy-p[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(cx-p[0]-t*dx,cy-p[1]-t*dy);})):0;
 const gap=(r,q)=>Math.max(0,Math.max(r.x,q.x)-Math.min(r.x+r.w,q.x+q.w))+Math.max(0,Math.max(r.y,q.y)-Math.min(r.y+r.h,q.y+q.h));
 const list=[],placed={};
 const faceSegments=s=>s==='top'?[[[0,0],[o.W,0]]]:s==='bottom'?[[[0,o.D],[o.W,o.D]]]:s==='left'?[[[0,0],[0,o.D]]]:[[[o.W,0],[o.W,o.D]]];
 const street=o.programmeStreet?.length?o.programmeStreet:faceSegments(o.streetSide||o.articulationFront||'top'),lane=o.programmeLane?.length?o.programmeLane:faceSegments({top:'bottom',bottom:'top',left:'right',right:'left'}[o.streetSide||o.articulationFront||'top']);
 const score=(item,r)=>item.anchor?Math.hypot(r.x+r.w/2-item.anchor[0],r.y+r.h/2-item.anchor[1])*10:item.near==='street'?dist(r,street)*10+Math.abs(r.x+r.w/2-o.W/2)*.1:item.near==='lane'?dist(r,lane)*10:item.near==='lobby'&&placed.Lobby?gap(r,placed.Lobby)*10:0;
 // The lobby must open to the street and share a wall with the corridor.
 const place=(item,roles,strict=item.name==='Lobby')=>{let best=null;for(const row of rows){if(!roles.includes(row.role))continue;for(const gp of row.gaps){const w=Math.max(1.5,item.area/row.depth);if(w>gp[1]-gp[0]+.01)continue;const spots=[gp[0],gp[1]-w];if(item.anchor)spots.push(Math.max(gp[0],Math.min(gp[1]-w,(row.b.axis==='x'?item.anchor[0]:item.anchor[1])-w/2)));for(const a of spots){const r=rectOf(row,a,w),hasCirc=['top','bottom','left','right'].some(s=>edgeTouch(r,s,circ)),hasExt=['top','bottom','left','right'].some(s=>exteriorSide(r,s));if(item.access==='both'&&(!hasCirc||!hasExt)||item.access==='corridor'&&!hasCirc||item.access==='exterior'&&!hasExt)continue;if(strict&&o.programmeRecess)continue;if(strict&&!(['top','bottom','left','right'].some(s=>edgeTouch(r,s,g.corridors))&&(o.streetSide?exteriorSide(r,o.streetSide):hasExt)))continue;const sc=score(item,r);if(!best||sc<best.sc)best={row,gp,a,w,r,sc};}}}
  // An unavailable entrance stays unresolved; never silently move it to a non-street room.
  if(!best){list.push({name:item.name,x:.25,y:.25,w:2,h:2,on:false,unplaced:true,target:item.area,entry:item.entry});return;}
  const room={...best.r,name:item.name,on:true,target:item.area,entry:item.entry,row:best.row};list.push(room);placed[item.name]=room;
  best.row.gaps.splice(best.row.gaps.indexOf(best.gp),1,...[[best.gp[0],best.a],[best.a+best.w,best.gp[1]]].filter(([p,q])=>q-p>.01));};
 const pinnedFirst=list=>list.slice().sort((a,b)=>(b.anchor?1:0)-(a.anchor?1:0));
 for(const item of pinnedFirst(items.filter(i=>i.access==='both')))place(item,['both']);
 for(const row of rows.slice()){if(row.depth<6||row.role!=='both')continue;const dc=row.depth/2;
  for(const gp of row.gaps)rows.push({...row,y0:row.circLow?row.y0:row.y0+row.depth-dc,depth:dc,gaps:[gp.slice()],role:'corridor'},{...row,y0:row.circLow?row.y0+dc:row.y0,depth:row.depth-dc,gaps:[gp.slice()],role:'exterior'});
  row.gaps=[];}
 for(const item of pinnedFirst(items.filter(i=>i.access!=='both')))place(item,[item.access,'both']);
 // Slivers widen the neighbouring room in the same row; everything else left becomes flexible space.
 for(const row of rows)for(const [a,z]of row.gaps){if(z-a>=1.5)continue;
  const ax=row.b.axis,n=list.find(r=>r.row===row&&(ax==='x'?Math.abs(r.x+r.w-a)<.01||Math.abs(r.x-z)<.01:Math.abs(r.y+r.h-a)<.01||Math.abs(r.y-z)<.01));if(!n)continue;
  if(ax==='x'){if(Math.abs(n.x-z)<.01)n.x=a;n.w+=z-a;}else{if(Math.abs(n.y-z)<.01)n.y=a;n.h+=z-a;}}
 for(const r of list)delete r.row;
 const flex=leftoverFlex(g,baseBlocks.concat(list.filter(r=>r.on!==false)));return list.concat(flex.map((q,i)=>({...q,roomIndex:list.length+i})));
}
// Plan setup's ground floor use. The leftover is no longer held as flexible space: units are fitted into it. Mixed use first
// scans the street face: wherever the plate behind it is clear (of cores, corridor, rooms) for at least 6 m, up to 12 m deep,
// it becomes commercial units of about 7.5 m frontage, each with its own street door. A cut on the face (the entry recess)
// moves that stretch of shopfront back to the cut.
function useGround(o,rooms,built,blocks,cuts){const EPS=1e-4,front=o.streetSide||o.articulationFront||'top',across=front==='top'||front==='bottom',L=across?o.D:o.W;
 const kept=rooms.filter(q=>q.name!=='Flexible space'),out=[];let n=kept.filter(q=>/^Commercial unit/.test(q.name)).length,index=Math.max(-1,...kept.map(q=>q.roomIndex??-1))+1;
 // (u along the street, t in from the street face) and back
 const ut=r=>front==='top'?{u0:r.x,u1:r.x+r.w,t0:r.y,t1:r.y+r.h}:front==='bottom'?{u0:r.x,u1:r.x+r.w,t0:o.D-r.y-r.h,t1:o.D-r.y}:front==='left'?{u0:r.y,u1:r.y+r.h,t0:r.x,t1:r.x+r.w}:{u0:r.y,u1:r.y+r.h,t0:o.W-r.x-r.w,t1:o.W-r.x};
 const xy=(u0,u1,t0,t1)=>front==='top'?R(u0,t0,u1-u0,t1-t0):front==='bottom'?R(u0,o.D-t1,u1-u0,t1-t0):front==='left'?R(t0,u0,t1-t0,u1-u0):R(o.W-t1,u0,t1-t0,u1-u0);
 if(o.groundUse==='commercial'){const B=built.map(ut).filter(b=>b.t0<EPS),K=blocks.concat(kept.filter(q=>q.on!==false)).map(ut),C=cuts.map(ut).filter(c=>c.t0<EPS);
  const us=[...new Set([...B,...K,...C].flatMap(r=>[r.u0,r.u1]).map(v=>+Math.max(0,Math.min(L,v)).toFixed(4)))].sort((a,b)=>a-b),runs=[];
  for(let i=0;i+1<us.length;i++){const a=us[i],z=us[i+1],m=(a+z)/2,on=r=>r.u0<m&&r.u1>m,b=B.find(on);if(!b||z-a<EPS)continue;
   const start=Math.max(0,...C.filter(on).map(c=>c.t1));let end=Math.min(b.t1,start+12);for(const k of K.filter(on))if(k.t1>start+EPS)end=Math.min(end,Math.max(start,k.t0));
   const last=runs[runs.length-1];if(end-start<6)continue;if(last&&Math.abs(last.z-a)<EPS&&Math.abs(last.start-start)<EPS&&Math.abs(last.end-end)<EPS)last.z=z;else runs.push({a,z,start,end});}
  for(const s of runs){const along=s.z-s.a;if(along<4.5)continue;const bays=Math.max(1,Math.round(along/7.5)),bw=along/bays;
   for(let b=0;b<bays;b++){const u0=s.a+b*bw,r=xy(u0,u0+bw,s.start,s.end),p=xy(u0+bw/2,u0+bw/2,s.start,s.start);
    out.push({...r,name:`Commercial unit ${++n}`,on:true,role:'commercial',entry:front,door:{side:front,x:p.x,y:p.y},roomIndex:index++});}}}
 rooms.splice(0,rooms.length,...kept,...out);rooms.forEach((q,i)=>q.gi=i);}
function entryFor(room,g,prefer=room.entry){const ep=room.entryPoint;if(ep&&(!prefer||prefer===ep.side)&&ep.x>=room.x-.001&&ep.x<=room.x+room.w+.001&&ep.y>=room.y-.001&&ep.y<=room.y+room.h+.001){const [dx,dy]={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]}[ep.side];if(!g.built.some(b=>ep.x+dx*.05>b.x&&ep.x+dx*.05<b.x+b.w&&ep.y+dy*.05>b.y&&ep.y+dy*.05<b.y+b.h))return {...ep,dx,dy};}const inside=(x,y)=>g.built.some(b=>x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h),x=room.x+room.w/2,y=room.y+room.h/2,sides=[{side:'top',x,y:room.y,dx:0,dy:-1},{side:'bottom',x,y:room.y+room.h,dx:0,dy:1},{side:'left',x:room.x,y,dx:-1,dy:0},{side:'right',x:room.x+room.w,y,dx:1,dy:0}].filter(q=>!inside(q.x+q.dx*.4,q.y+q.dy*.4));return sides.find(q=>q.side===prefer)||sides[0]||null;}
// Dingbat ground floor: open parking at grade under the building, entered from the lane, upper floors carried on columns.
// Works in a "lane at y=0" frame so the same rules serve any lane face. Stalls 2.5 × 5.5 m, two-way aisle 6.6 m (Parking By-law 6059 defaults; design inputs).
function parkingLayout(o,built,rooms){
 const sw=o.stallW||2.5,sd=o.stallD||5.5,aw=o.aisleW||6.6,col=.4,face={top:'bottom',bottom:'top',left:'right',right:'left'}[o.articulationFront||'top'],W=o.W,H=o.D,EPS=1e-5; // articulationFront is the street front; the lane is opposite
 const to=r=>face==='top'?{...r}:face==='bottom'?{...r,y:H-r.y-r.h}:face==='left'?{...r,x:r.y,y:r.x,w:r.h,h:r.w}:{...r,x:r.y,y:W-r.x-r.w,w:r.h,h:r.w};
 const from=r=>face==='top'?{...r}:face==='bottom'?{...r,y:H-r.y-r.h}:face==='left'?{...r,x:r.y,y:r.x,w:r.h,h:r.w}:{...r,x:W-r.y-r.h,y:r.x,w:r.h,h:r.w};
 const plate=built.map(to);if(!plate.length)return null;const y0=Math.min(...plate.map(b=>b.y));
 const stalls=[],aisles=[],consumed=[],leftover=[],zones=[];let tuck=0,onAisle=0;
 const flex=rooms.filter(q=>q.name==='Flexible space'&&q.on!==false),others=rooms.filter(q=>q.name!=='Flexible space'&&q.on!==false).map(to);
 for(const q of flex){const r=to(q);
  if(Math.abs(r.y-y0)>.05||r.h<sd-EPS||r.w<sw-EPS)continue;
  // Option T: tuck-under bays straight off the lane. Option A: one internal aisle from the lane with stalls both sides, bays on the rest of the lane edge.
  const T={n:Math.floor(r.w/sw+EPS),stalls:[],aisle:null,used:[]};
  {const n=T.n,x=r.x+(r.w-n*sw)/2;for(let i=0;i<n;i++)T.stalls.push({x:x+i*sw,y:r.y,w:sw,h:sd,dir:'lane'});T.used.push({x:r.x,y:r.y,w:r.w,h:sd});}
  let A=null;
  if(r.h>=sd+aw-EPS&&r.w>=aw+sd-EPS){const sides=r.w>=aw+2*sd-EPS?2:1,ax=sides===2?r.x+(r.w-aw)/2:r.x+sd,rows=Math.floor(r.h/sw+EPS);A={stalls:[],used:[],aisle:{x:ax,y:r.y,w:aw,h:r.h}};
   for(let i=0;i<rows;i++){A.stalls.push({x:ax-sd,y:r.y+i*sw,w:sd,h:sw,dir:'aisle'});if(sides===2)A.stalls.push({x:ax+aw,y:r.y+i*sw,w:sd,h:sw,dir:'aisle'});}
   A.used.push({x:ax-sd,y:r.y,w:aw+sd*(sides===2?2:1),h:r.h});
   for(const [a,b] of [[r.x,ax-sd],[ax+aw+(sides===2?sd:0),r.x+r.w]]){const n=Math.floor((b-a)/sw+EPS);if(n<1)continue;const x=a+(b-a-n*sw)/2;for(let i=0;i<n;i++)A.stalls.push({x:x+i*sw,y:r.y,w:sw,h:sd,dir:'lane'});A.used.push({x:a,y:r.y,w:b-a,h:sd});}
   A.n=A.stalls.length;}
  const pick=A&&A.n>T.n?A:T;
  stalls.push(...pick.stalls);if(pick.aisle)aisles.push(pick.aisle);consumed.push(q);zones.push(...pick.used);
  let rest=[{x:r.x,y:r.y,w:r.w,h:r.h}];for(const u of pick.used)rest=rest.flatMap(p=>root.FLOOR_DESIGN.subtract(p,u));
  for(const p of rest)if(Math.min(p.w,p.h)>=1.2&&p.w*p.h>=4)leftover.push({...q,...from(p)});
 }
 if(!stalls.length)return null;
 tuck=stalls.filter(s=>s.dir==='lane').length;onAisle=stalls.length-tuck;
 // Columns: plate perimeter at ≤7.5 m, plus both aisle edges every third stall. Skip any that land in a core or a room.
 const columns=[],put=(x,y)=>{const c={x,y,w:col,h:col};if(others.some(q=>root.EXPLORE.overlap(c,q))||columns.some(q=>Math.hypot(q.x-x,q.y-y)<1))return;columns.push(c);};
 for(const b of plate){const nx=Math.max(1,Math.ceil((b.w-col)/7.5)),ny=Math.max(1,Math.ceil((b.h-col)/7.5));for(let i=0;i<=nx;i++){const x=b.x+i*(b.w-col)/nx;put(x,b.y);put(x,b.y+b.h-col);}for(let j=1;j<ny;j++){const y=b.y+j*(b.h-col)/ny;put(b.x,y);put(b.x+b.w-col,y);}}
 for(const a of aisles){const n=Math.max(1,Math.round(a.h/(3*sw)));for(let j=0;j<=n;j++){const y=Math.min(a.y+a.h-col,a.y+j*a.h/n);put(a.x-col,y);put(a.x+a.w,y);}}
 const area=stalls.reduce((s,q)=>s+q.w*q.h,0)+aisles.reduce((s,q)=>s+q.w*q.h,0);
 return {on:true,stalls:stalls.map(from),aisles:aisles.map(from),columns:columns.map(from),zones:zones.map(from),count:stalls.length,tuck,onAisle,area,face,consumed,leftover,stall:[sw,sd],aisle:aw};
}
// Align an entrance spur with an adjacent courtyard when the intervening strip
// cannot hold a unit. Preserve its width, exterior endpoint and network contacts.
function alignGroundEntrances(o){
 if(o.absorb===false||o.geometryOnly||o.rooms||o.slices?.[1]||o.unitEdits?.[1]?.length||!o.court)return;
 const court=o.court,eps=1e-4,obstacles=(o.coreLayout||[]).concat(o.exclusions||[],cuts(o,1)),network=(o.freeCorridors||[]).concat(o.stubs||[]);
 o.groundCorridors=(o.groundCorridors||[]).map(c=>{
  if(c.manual||c.locked)return c;
  const vertical=c.h>c.w,a=vertical?'x':'y',b=vertical?'y':'x',w=vertical?'w':'h',h=vertical?'h':'w',extent=vertical?o.D:o.W;
  if(Math.abs(c[b]-court[b])>eps||Math.abs(c[h]-court[h])>eps||!(Math.abs(c[b])<eps||Math.abs(c[b]+c[h]-extent)<eps))return c;
  const gap=c[a]>=court[a]+court[w]-eps?c[a]-court[a]-court[w]:court[a]-c[a]-c[w];
  if(gap<=eps||gap>=Math.max(o.minWidth||0,3.96))return c;
  const q={...c,[a]:c[a]>=court[a]+court[w]-eps?court[a]+court[w]:court[a]-c[w]},sweep=R(Math.min(c.x,q.x),Math.min(c.y,q.y),Math.max(c.x+c.w,q.x+q.w)-Math.min(c.x,q.x),Math.max(c.y+c.h,q.y+q.h)-Math.min(c.y,q.y));
  if(obstacles.some(p=>E.overlap(p,sweep))||(o.groundCorridors||[]).some(p=>p!==c&&E.overlap(p,sweep)))return c;
  const contacts=network.filter(p=>E.attach(p,c)||E.overlap(p,c));if(!contacts.length||contacts.some(p=>!E.attach(p,q)&&!E.overlap(p,q)))return c;
  return {...q,courtAligned:true};
 });
}
function generate(input,context={}){
 const o={...E.defaults(),upperFamily:true,upperFrom:5,upperThree:50,upperScale:1.1,absorb:true,groundProgram:true,...clone(input),articulationFront:articulationFront(context)},work={...o,exclusions:[]};
 if(o.typology==='free'&&!o.freeCorridors?.length){o.groundProgram=false;o.rooms=[];o.parkingOn=false;}
 if(o.geometryOnly){o.groundProgram=false;o.rooms=[];o.shortSpine=false;o.recoverTails=false;}
 const invalid=[];if(!Number.isInteger(o.floors)||o.floors<1||o.floors>12)invalid.push('Storeys must be 1–12.');if(!o.geometryOnly&&(!Number.isFinite(o.upperThree)||o.upperThree<0||o.upperThree>100||!Number.isFinite(o.upperScale)||o.upperScale<1||o.upperScale>1.5||!Number.isInteger(o.upperFrom)||o.upperFrom<1||o.upperFrom>12))invalid.push('Invalid upper-floor mix preference.');for(const m of Object.values(o.moves||{}))for(const key of ['d','depth','w','storeys','pos'])if(m[key]!=null&&(!Number.isFinite(m[key])||m[key]<0))invalid.push('Invalid massing dimension.');if(!o.geometryOnly&&o.pmt&&(!['x','y','w','h','clearance'].every(k=>Number.isFinite(o.pmt[k]))||o.pmt.w<=0||o.pmt.h<=0||o.pmt.clearance<0))invalid.push('PMT dimensions must be finite and positive; buffer must be non-negative.');if(invalid.length)return {ok:false,errors:invalid,o,context};
 alignGroundEntrances(o);
 const rotated=o.axis==='y',sw=r=>({...r,x:r.y,y:r.x,w:r.h,h:r.w});
 if(o.coreLayout&&root.CORE_LAYOUT){const errors=root.CORE_LAYOUT.inputErrors(o.coreLayout,o);if(errors.length)return {ok:false,errors,o,context};}
 const base=E.geometry(rotated?{...work,W:o.D,D:o.W,courtW:o.courtD,courtD:o.courtW,coreLayout:o.coreLayout?.map(root.CORE_LAYOUT?root.CORE_LAYOUT.swap:sw),freeCorridors:(o.freeCorridors||[]).map(sw),court:o.court?sw(o.court):o.court,stubs:(o.stubs||[]).map(sw)}:work);
 if(base.errors.length&&!o.coreLayout)return {ok:false,errors:base.errors,o,context};
 const allCuts=Array.from({length:o.floors},(_,i)=>cuts(o,i+1)).flat().map(r=>rotated?sw(r):r);
 const fixed=clone(base.cores);
 // Translate end cores along their existing corridor so setbacks do not break vertical continuity.
 for(const c of fixed){if(o.coreLayout||!allCuts.some(q=>E.overlap(c,q)))continue;const original={...c};let found=false;
  for(let delta=.25;delta<Math.max(o.W,o.D)&&!found;delta+=.25)for(const sign of [1,-1]){const candidate={...original,x:original.x+delta*sign};if(base.built.some(b=>E.inside(candidate,b))&&!allCuts.some(q=>E.overlap(candidate,q))&&!fixed.some(q=>q!==c&&E.overlap(candidate,q))&&base.corridors.some(q=>E.attach(candidate,q))){Object.assign(c,candidate);found=true;break;}}
 }
 const edgeSegments=kind=>(context.siteEdges||[]).flatMap((t,i)=>t===kind?[[context.sitePoly[i],context.sitePoly[(i+1)%context.sitePoly.length]]]:[]),laneSegments=edgeSegments('lane'),streetSegments=edgeSegments('street'),swapSeg=s=>s.map(p=>[p[1],p[0]]);
 const recessCut=o.moves?.recess?.on?cuts({...o,moves:{recess:o.moves.recess}},1)[0]:null;
 const roomInput={...o,programmeRecess:recessCut?{rect:recessCut,side:o.moves.recess.side||o.articulationFront}:null,programmeCuts:cuts(o,1),programmeLane:laneSegments,programmeStreet:streetSegments};
 const groundBase=o.groundCorridors?.length?E.geometry(rotated?{...work,W:o.D,D:o.W,courtW:o.courtD,courtD:o.courtW,coreLayout:o.coreLayout?.map(root.CORE_LAYOUT?root.CORE_LAYOUT.swap:sw),freeCorridors:(o.freeCorridors||[]).map(sw),court:o.court?sw(o.court):o.court,stubs:(o.stubs||[]).concat(o.groundCorridors).map(sw)}:{...work,stubs:(o.stubs||[]).concat(o.groundCorridors)}):base;
 // Dingbat option, generated layout: stalls and aisle are reserved from the plate first, so service rooms move off the lane edge.
 let parking=null;
 if(o.parkingOn&&!o.geometryOnly&&!o.rooms){const gb={...groundBase,cores:fixed},free=leftoverFlex(gb,gb.cores.concat(gb.corridors,roomInput.programmeCuts.map(r=>rotated?sw(r):r)),false).map(r=>rotated?sw(r):r).map(q=>({...q,name:'Flexible space',on:true}));
  parking=parkingLayout(o,groundBase.built.map(rotated?sw:r=>r),free);if(parking)roomInput.programmeCuts=roomInput.programmeCuts.concat(parking.zones);}
 const groundRooms=rooms(rotated?{...roomInput,W:o.D,D:o.W,streetSide:{top:'left',left:'top',bottom:'right',right:'bottom'}[o.streetSide||o.articulationFront],rooms:o.rooms?.map(r=>({...r,entry:r.entry&&{top:'left',left:'top',bottom:'right',right:'bottom'}[r.entry],entryPoint:r.entryPoint&&{x:r.entryPoint.y,y:r.entryPoint.x,side:{top:'left',left:'top',bottom:'right',right:'bottom'}[r.entryPoint.side]},parts:(r.parts||[{x:r.x,y:r.y,w:r.w,h:r.h}]).map(sw),door:r.door&&{side:{top:'left',left:'top',bottom:'right',right:'bottom'}[r.door.side],x:r.door.y,y:r.door.x}})),programmeRecess:roomInput.programmeRecess?{rect:sw(roomInput.programmeRecess.rect),side:{top:'left',left:'top',bottom:'right',right:'bottom'}[roomInput.programmeRecess.side]}:null,programmeCuts:roomInput.programmeCuts.map(sw),programmeLane:laneSegments.map(swapSeg),programmeStreet:streetSegments.map(swapSeg),programme:o.programme?.map(p=>p.anchor?{...p,anchor:[p.anchor[1],p.anchor[0]]}:p)}:roomInput,{...groundBase,cores:fixed}).map((r,i)=>{const q=rotated?sw(r):r;if(rotated&&q.entryPoint)q.entryPoint={x:q.entryPoint.y,y:q.entryPoint.x,side:{top:'left',left:'top',bottom:'right',right:'bottom'}[q.entryPoint.side]};if(rotated&&q.entry)q.entry={top:'left',left:'top',bottom:'right',right:'bottom'}[q.entry];if(rotated&&q.door)q.door={side:{top:'left',left:'top',bottom:'right',right:'bottom'}[q.door.side],x:q.door.y,y:q.door.x};return {...q,roomIndex:r.roomIndex??i,gi:i,role:r.role||r.name.toLowerCase()};}),levels=[];
 {const hard=groundBase.cores.concat(groundBase.corridors).map(r=>rotated?sw(r):r);for(const q of groundRooms)if(q.name!=='Flexible space'&&q.on!==false&&hard.some(b=>E.overlap(q,b))){q.on=false;q.unplaced=true;q.conflict=true;}}
 if(o.groundUse&&!o.parkingOn&&!o.geometryOnly)useGround(o,groundRooms,groundBase.built.map(rotated?sw:r=>r),fixed.concat(groundBase.corridors).map(rotated?sw:r=>r).concat(o.exclusions||[]),roomInput.programmeCuts);
 // Dingbat option, manual layout: parking takes the flexible remainder after the rooms the user placed.
 if(parking===null&&o.parkingOn&&!o.geometryOnly&&o.rooms){parking=parkingLayout(o,groundBase.built.map(rotated?sw:r=>r),groundRooms);
  if(parking){for(const q of parking.consumed){const i=groundRooms.indexOf(q);if(i>=0)groundRooms.splice(i,1);}parking.leftover.forEach((q,i)=>groundRooms.push({...q,gi:1000+i}));}}
 if(parking){parking.zones.forEach((z,i)=>groundRooms.push({...z,name:'Parking',on:true,gi:2000+i,roomIndex:-1,role:'parking'}));parking.columns=parking.columns.filter(c=>!groundRooms.some(q=>q.on!==false&&q.name!=='Flexible space'&&q.name!=='Parking'&&E.overlap(c,q)));}
 for(let k=1;k<=o.floors;k++){
  const upper=o.upperFamily&&k>=o.upperFrom,types=clone(o.types);
  if(upper&&!o.geometryOnly){const t3=types.find(t=>t.key==='3B'),others=types.filter(t=>t!==t3),sum=others.reduce((s,t)=>s+t.share,0);t3.share=o.upperThree;others.forEach(t=>t.share=sum?t.share/sum*(100-t3.share):0);types.forEach(t=>{t.min*=o.upperScale;t.target*=o.upperScale;t.max*=o.upperScale;});}
  const rr=k===1&&o.groundProgram&&!(o.typology==='free'&&!(o.freeCorridors&&o.freeCorridors.length))?groundRooms:[],exclusions=[...o.exclusions,...rr.filter(r=>r.on!==false)];
  const floorInput=ex=>({...o,types,floors:1,commercial:o.commercial&&k===1&&!(o.groundUse&&!o.parkingOn),floorDesign:true,cuts:cuts(o,k).map(r=>rotated?sw(r):r),fixedCores:fixed,exclusions:ex,level:k,stubs:(o.stubs||[]).concat(k===1?o.groundCorridors||[]:[])});
  const l=E.generate(floorInput(exclusions),context);
  // A pocket blocked from every dwelling can enlarge an automatic lobby along
  // its full edge. Keep manual rooms and the entrance/door positions intact.
  if(k===1&&o.absorb!==false&&!o.rooms&&o.groundUse==='residential'&&l.ok&&root.POLY_PACK){
   const P=root.POLY_PACK,free=coalesce(P.free(l.g.built,l.g.cores.concat(l.g.corridors,l.g.voids||[],l.o.exclusions,l.units.flatMap(P.parts))));
   for(const r of free){if(E.area(r)<.1||l.units.some(u=>P.shared(u,{parts:[r]})>0))continue;
    const lobby=rr.find(p=>p.on!==false&&p.name==='Lobby'&&P.shared({parts:[p]},{parts:[r]})>=Math.min(r.w,r.h)-1e-4);if(!lobby)continue;
    if(!P.compactShape(rr.filter(p=>p.roomIndex===lobby.roomIndex).concat(r)))continue;
    const part={...r,name:lobby.name,role:lobby.role,on:true,roomIndex:lobby.roomIndex,gi:3000+rr.length,absorbed:true};rr.push(part);l.o.exclusions.push(part);
   }
   l.ledger=E.ledger(l.g,l.units,l.o);
  }
  // Ground-floor leftovers that share a wall with a shop become part of it (back of house): commercial space takes the odd
  // pieces a dwelling cannot, instead of leaving them unused.
  if(k===1&&o.groundUse==='commercial'&&l.ok&&root.CORRIDOR_NETWORK){const shops=rr.filter(q=>q.role==='commercial'&&q.on!==false&&!q.unplaced);
   const touch=(a,b)=>{const x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);return Math.abs(x)<1e-4?y:Math.abs(y)<1e-4?x:0;};
   const left=shops.length?root.CORRIDOR_NETWORK.analyse(l.g,l.o,l.units).unserved.filter(r=>r.area>=.5):[];
   for(let grew=true;grew;){grew=false;for(const r of left){if(r.taken)continue;const s=shops.find(q=>touch(q,r)>=1.2-1e-6);if(!s)continue;const part={x:r.x,y:r.y,w:r.w,h:r.h,name:s.name,on:true,role:s.role,entry:s.entry,roomIndex:s.roomIndex,gi:3000+rr.length,absorbed:true};
    rr.push(part);shops.push(part);r.taken=true;l.ledger.unallocated=Math.max(0,l.ledger.unallocated-r.area);l.ledger.exclusions+=r.area;grew=true;}}}
  l.level=k;l.rooms=rr;l.upper=upper;levels.push(l);
 }
 const bad=levels.filter(l=>!l.ok);if(bad.length)return {ok:false,errors:bad.flatMap(l=>l.errors.map(s=>`Floor ${l.level}: ${s}`)),o,context,levels,groundRooms};
 const top=levels[levels.length-1],units=levels.flatMap(l=>l.units.map(u=>({...u,level:l.level}))),count=units.length,net=levels.reduce((s,l)=>s+l.ledger.net,0),countable=levels.reduce((s,l)=>s+l.ledger.built,0)-(parking?parking.area:0),enclosed=levels.reduce((s,l)=>s+l.ledger.enclosed,0),ceiling=(context.permitted||0)*(context.area||0),byType=Object.fromEntries(o.types.map(t=>[t.key,units.filter(u=>u.type===t.key).length])),req=context.mix||{},mixOK=count>0&&((byType['2B']||0)+(byType['3B']||0))/count>=(req.two||0)&&(byType['3B']||0)/count>=(req.three||0),flags=[];
 if(parking){levels[0].parking=parking;flags.push(`Ground parking: ${parking.count} stalls (${parking.tuck} tuck-under off the lane, ${parking.onAisle} on an internal aisle). ${parking.area.toFixed(1)} m² excluded from countable area as at-grade parking; verify the R3 floor-area exclusion and Parking By-law 6059 geometry (${parking.stall[0]} × ${parking.stall[1]} m stalls, ${parking.aisle} m two-way aisle).`);if(parking.tuck)flags.push('Tuck-under stalls manoeuvre in the lane; confirm acceptability with Engineering Services.');flags.push('Open ground floor on columns: soft-storey lateral system and column layout need structural design.');if(o.ftf<2.5)flags.push('Ground floor-to-floor leaves under 2.3 m parking clearance once structure is added.');}
 else if(o.parkingOn&&!o.geometryOnly)flags.push('Parking requested but no stall fits: free the lane edge of programme rooms or widen the plate.');
 if(o.pmt?.on){if(o.pmt.corner&&root.SITE_SERVICES){o.pmt=root.SITE_SERVICES.placePMT(o.pmt,context,levels[0].g.built);for(const l of levels)l.o.pmt=o.pmt;if(!o.pmt.placed)flags.push(o.pmt.reason);}const p=o.pmt,c=p.clearance,q=R(p.x-c,p.y-c,p.w+2*c,p.h+2*c);if(p.placed!==false){if(levels[0].g.built.some(b=>E.overlap(b,q)))flags.push('PMT study buffer overlaps the ground-floor building. Relocate the pad or revise the footprint.');if(context.sitePoly&&![[q.x,q.y],[q.x+q.w,q.y],[q.x+q.w,q.y+q.h],[q.x,q.y+q.h]].every(v=>E.inPoly(v,context.sitePoly)))flags.push('PMT study buffer extends outside the site. Review the site location.');}flags.push('PMT location and clearances await BC Hydro design confirmation.');}
 for(const q of groundRooms)if(q.unplaced)flags.push(`${q.name} could not be placed automatically and is listed unchecked. Enable and position it in the ground programme table.`);
 const lobby=levels[0].rooms.filter(q=>(q.role==='lobby'||q.name==='Lobby')&&q.on!==false);if(lobby.length&&!lobby.some(q=>entryFor(q,levels[0].g)))flags.push('Lobby does not reach an exterior edge: move it or provide an entrance passage.');if(lobby.length&&!lobby.some(p=>levels[0].g.corridors.some(q=>E.attach(p,q))))flags.push('Lobby is disconnected from main circulation.');
 const loading=levels[0].rooms.find(q=>q.name==='Loading');if(loading&&loading.on!==false&&(Math.min(loading.w,loading.h)<3.5||Math.max(loading.w,loading.h)<8.5))flags.push('Loading reservation is shorter than the 3.5 × 8.5 m study target. Confirm a feasible loading class and manoeuvring arrangement.');
 const byIssue=new Map();for(const l of levels)for(const issue of l.fitIssues||[])byIssue.set(issue,(byIssue.get(issue)||[]).concat(l.level));for(const [issue,ls]of byIssue)flags.push(ls.length===levels.length?issue:`Floor ${ls.join(', ')}: ${issue}`);
 if(ceiling&&countable<.9*ceiling){const hints=[];if(context.maxFloors&&o.floors<context.maxFloors)hints.push(`add storeys (up to ${context.maxFloors})`);if(o.typology==='gallery')hints.push('a single-loaded bar is one unit deep, so a double-loaded corridor or a courtyard uses the site depth');if(['court','u'].includes(o.typology))hints.push('a smaller courtyard adds plate area');if(Object.values(o.moves||{}).some(m=>m.on))hints.push('articulation moves remove area');if(o.autoSize===false)hints.push('re-enable the automatic envelope fit');flags.push(`Design reaches ${(100*countable/ceiling).toFixed(0)}% of the permitted floor area${hints.length?': '+hints.join('; '):''}.`);}
 if(!o.geometryOnly&&!mixOK)flags.push('Building bedroom mix is below the selected schedule thresholds.');if(countable>ceiling+.1)flags.push('Current design exceeds the permitted floor-area budget.');if(!o.geometryOnly&&!count)flags.push('No residential units fit. Review permitted window faces, unit areas, frontage and ground reservations.');if(count&&count<=8)flags.push('Review applicable use and density rules for eight or fewer units.');if(o.unitCap&&count>o.unitCap)flags.push('Building exceeds the entered unit cap.');for(const l of levels){if(o.travel&&l.route.max>o.travel)flags.push(`Floor ${l.level}: corridor travel limit exceeded.`);if(o.deadEnd&&l.route.deadEnd>o.deadEnd)flags.push(`Floor ${l.level}: dead-end limit exceeded.`);}
 if(o.typology==='free'&&!(o.freeCorridors&&o.freeCorridors.length)){for(let i=flags.length-1;i>=0;i--)if(/No residential units|reaches \d+% of the permitted|bedroom mix|eight or fewer/.test(flags[i]))flags.splice(i,1);flags.unshift(o.coreLayout?.length?'Cores placed by hand. Generate the corridor from their positions and door faces (Manual adjustments), or press Generate plan to place everything from the brief.':'Empty plate. Pick the design moves in Plan setup, then press Generate plan.');if(o.court)for(const k of o.coreLayout||[])if(E.overlap(k,o.court))flags.push(`${k.kind==='elevator'?'Lift':'Stair'} overlaps the courtyard. Move it onto the plate before Done.`);}
 return {...top,o,context,levels,allUnits:units,groundRooms,parking,count,byType,net,countable,ceiling,remaining:ceiling-countable,achieved:context.area?countable/context.area:0,eff:enclosed?net/enclosed:0,avg:count?net/count:0,mixOK,flags,nRes:o.floors-(o.commercial?1:0),notes:['Each floor is packed independently. Front recess, upper front setback, rear step-down and roof setback cut the same geometry shown in plan and massing. Dimensions are applied to the contained orthogonal design footprint; reference-tab polygon geometry may differ.','Room rectangles include schematic allowances only; equipment, access and fire separation require design.']};
}
function fit(o,ctx){o={...o};if(o.autoFit&&['bar','gallery','free'].includes(o.typology)){const key=o.axis==='y'?'W':'D';o[key]=Math.min(o[key],(o.typology==='gallery'?1:2)*o.maxDepth+o.corridor);}let r=generate(o,ctx);if(!o.autoFit||!r.ok||r.remaining>=-.1)return r;let best=null;for(let s=.99;s>=.4;s-=.02){const q=generate({...o,W:o.W*s,D:o.D*s,autoFit:false},ctx);if(q.ok&&q.remaining>=-.1){best=q;break;}}if(best){best.fitted=true;return best;}r.flags.push('No automatic fit found with these programme and core reservations.');return r;}
function alternatives(o,ctx){const out=[];for(const typology of ['bar','gallery','court','u'])for(const axis of ['x','y'])for(const offset of [.35,.5,.65])for(const stair of [...new Set([o.stair,'two','external'])]){const requested={...o,typology,axis,offset,stair},r=fit(requested,ctx);out.push({...r,requested});}const score=r=>{if(!r.ok||!r.count||r.remaining<-.1)return -1e6;const mix=o.types.reduce((s,t)=>s+Math.abs(r.byType[t.key]/r.count-t.share/100),0);return o.objective==='units'?r.count*10-mix:o.objective==='mix'?-mix*100+r.count*.1:r.count+r.eff*10-mix*15;};return out.sort((a,b)=>score(b)-score(a));}

// Search footprint dimensions under the area budget, keeping the selected unit depth
// where possible. Manual locks apply until the user changes typology or maximizes.
function maximizeFootprint(input,ctx){
 const o={...input,geometryOnly:true,coreLayout:undefined,stubs:undefined,groundCorridors:undefined,slices:undefined,shortSpine:false,recoverTails:false,autoFit:false};
 let W=o.lockW?o.W:ctx.bounds.w,D=o.lockD?o.D:ctx.bounds.h;
 const depthKey=o.axis==='y'?'W':'D',cap=o.typology==='bar'||o.typology==='free'?2*o.maxDepth+o.corridor:o.typology==='gallery'?o.maxDepth+o.corridor:Infinity;
 if(!o['lock'+depthKey]){if(depthKey==='W')W=Math.min(W,cap);else D=Math.min(D,cap);}
 const cache=new Map(),test=(w,d)=>{const key=[w,d].join(',');if(!cache.has(key))cache.set(key,generate({...o,W:w,D:d},ctx));return cache.get(key);};
 const full=test(W,D);if(full.ok&&full.remaining>=0)return {W,D,countable:full.countable};
 let best=null;
 const modes=depthKey==='D'?['W','D','both']:['D','W','both'];
 for(const mode of modes){
  const dims=s=>({W:o.lockW||mode==='D'?W:W*s,D:o.lockD||mode==='W'?D:D*s});
  if((mode==='W'&&o.lockW)||(mode==='D'&&o.lockD)||(o.lockW&&o.lockD))continue;
  let hi=1,lo=null,result=null;
  for(let i=1;i<=32;i++){const scale=1-i*.025,q=dims(scale),r=test(q.W,q.D);if(r.ok&&r.remaining>=0){lo=scale;result={...q,countable:r.countable};break;}hi=scale;}
  if(lo==null)continue;
  for(let i=0;i<16;i++){const mid=(lo+hi)/2,q=dims(mid),r=test(q.W,q.D);if(r.ok&&r.remaining>=0){lo=mid;result={...q,countable:r.countable};}else hi=mid;}
  if(!best||result.countable>best.countable+.02)best=result;
  if(best&&ctx.area*ctx.permitted-best.countable<.02)break;
 }
 return best;
}
root.FLOOR_DESIGN={landings,maximizeFootprint,articulationFront,entryFor,prepare,extend,carve,absorb,cuts,rooms,subtract,generate,densityFit:fit,alternatives,PROGRAMME};
})(typeof window!=='undefined'?window:globalThis);
