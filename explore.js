/* R3 exploration engine. Pure geometry, no DOM. All dimensions metres.
   Candidate search is bounded, not a proof of optimality or code compliance. */
(function(root){
'use strict';
const EPS=1e-7;
const rect=(x,y,w,h,kind='')=>({x,y,w,h,kind});
const area=r=>Math.max(0,r.w)*Math.max(0,r.h);
const corners=r=>[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>EPS&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>EPS;
const inside=(a,b)=>a.x>=b.x-EPS&&a.y>=b.y-EPS&&a.x+a.w<=b.x+b.w+EPS&&a.y+a.h<=b.y+b.h+EPS;
const intersection=(a,b)=>rect(Math.max(a.x,b.x),Math.max(a.y,b.y),Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)));
const polyArea=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2);
function inPoly(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++) {const a=poly[j],b=poly[i],cross=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);if(Math.abs(cross)<1e-6&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS)return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function convex(p){let sign=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],c=p[(i+2)%p.length],v=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(v)<1e-6)continue;if(sign&&Math.sign(v)!==sign)return false;sign=Math.sign(v);}return !!sign;}
function fitRect(poly){
 if(!poly||poly.length<3||!convex(poly))return null;
 const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
 let best=null;
 for(const ax of [.35,.5,.65])for(const ay of [.35,.5,.65])for(const ratio of [.65,.8,1,1.25,1.5]){let lo=0,hi=1;for(let i=0;i<30;i++){const s=(lo+hi)/2,r=rect(x+w*ax-w*s*Math.min(1,ratio)/2,y+h*ay-h*s*Math.min(1,1/ratio)/2,w*s*Math.min(1,ratio),h*s*Math.min(1,1/ratio));if(corners(r).every(p=>inPoly(p,poly)))lo=s;else hi=s;}const r=rect(x+w*ax-w*lo*Math.min(1,ratio)/2,y+h*ay-h*lo*Math.min(1,1/ratio)/2,w*lo*Math.min(1,ratio),h*lo*Math.min(1,1/ratio));if(!best||area(r)>area(best))best=r;}
 return best;
}
const TYPES=[{key:'S',label:'Studio',beds:0,target:40,min:35,max:48,share:15,frontage:3.6},{key:'1B',label:'1 bed',beds:1,target:55,min:48,max:65,share:35,frontage:4.8},{key:'2B',label:'2 bed',beds:2,target:80,min:70,max:95,share:40,frontage:6.6},{key:'3B',label:'3 bed',beds:3,target:100,min:90,max:120,share:10,frontage:8.4}];
const defaults=()=>({typology:'bar',W:30,D:24,floors:6,ftf:3,corridor:1.8,courtW:10,courtD:10,barDepth:10,offset:.5,axis:'x',stair:'two',exteriorStair:false,lifts:1,stairW:2.8,stairL:5.2,elevator:3,corePosition:.5,wall:.25,party:.15,corridorWall:.2,coreWall:.2,maxDepth:12.2,depthTolerance:.6,minWidth:3.6,objective:'balanced',autoFit:true,edges:{front:true,rear:true,left:false,right:false},exclusions:[],types:JSON.parse(JSON.stringify(TYPES)),travel:0,deadEnd:0,unitCap:0,commercial:false,groundFtf:4,support:0});
// Unit number: floor × 100 + the unit's index on that floor (floor 1, unit 5 → 105; floor 12, unit 3 → 1203). Display only.
const unitNo=(level,id)=>String((level||1)*100+id);
const names={free:'Cores-first plan',bar:'Double-loaded corridor',gallery:'Single-loaded corridor',court:'Courtyard (middle)',u:'Courtyard (open one side)'};
function attach(a,b){const x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);return (x>=-EPS&&y>.15)||(y>=-EPS&&x>.15);}
function geometry(o){
 const W=o.W,H=o.D,c=o.corridor,sW=o.stairW,sL=o.stairL,exterior=o.exteriorStair===true||o.stair==='external',external=exterior&&(o.stair==='two'||o.stair==='external'),one=o.stair==='one',oneExt=one&&exterior,scissor=o.stair==='scissor';
 const g={bounds:rect(0,0,W,H),built:[],voids:[],corridors:[],cores:[],bands:[],errors:[],notes:[],warnings:[],W,H};
 const addBand=(r,axis,entry,face,eligible=true)=>g.bands.push({...r,axis,entry,face,eligible});
 const cor=(r,exterior=false)=>g.corridors.push({...r,kind:'circulation',exterior});
 const core=(r,kind,exterior=false)=>g.cores.push({...r,kind,exterior});
 let bodyW=W;
 // Exterior stairs get dedicated strips INSIDE the usable envelope, never assumed yard projections.
 if((external||oneExt)&&o.typology!=='free')bodyW=W-sL;
 if(bodyW<6||H<6){g.errors.push('Insufficient space for the circulation and stair reservations.');return g;}
 if(o.typology==='free'){
  // Cores first: an empty plate (optionally with a user-placed courtyard). Corridors arrive only after Done, as o.freeCorridors.
  const plate=rect(0,0,bodyW,H),ct=o.court&&o.court.w>=2&&o.court.h>=2?rect(Math.max(0,Math.min(bodyW-2,o.court.x)),Math.max(0,Math.min(H-2,o.court.y)),o.court.w,o.court.h):null;
  if(ct){ct.w=Math.min(ct.w,bodyW-ct.x);ct.h=Math.min(ct.h,H-ct.y);g.built.push(...root.FLOOR_DESIGN.subtract(plate,ct).filter(r=>r.w>EPS&&r.h>EPS));g.voids.push(ct);}else g.built.push(plate);
  for(const q of o.freeCorridors||[])g.corridors.push({...rect(q.x,q.y,q.w,q.h),kind:'circulation',exterior:!!q.exterior,stub:!!q.stub,axis:q.w>=q.h?'x':'y'});
  if(!g.corridors.length)g.notes.push('Cores first: place stairs, lift and courtyard on the plate, then press Done to generate the corridor.');
 }else if(o.typology==='bar'){
  g.built.push(rect(0,0,bodyW,H));
  const yy=(H-c)*o.offset;
  cor(rect(0,yy,bodyW,c));
  addBand(rect(0,0,bodyW,yy),'x','bottom','front',o.edges.front);
  addBand(rect(0,yy+c,bodyW,H-yy-c),'x','top','rear',o.edges.rear);
 }else if(o.typology==='gallery'){
  const depth=H-c,yy=depth;
  g.built.push(rect(0,0,bodyW,depth+c));cor(rect(0,yy,bodyW,c),o.singleAccess!=='interior');
  addBand(rect(0,0,bodyW,depth),'x','bottom','front',o.edges.front);
 }else{
  const wing=c+3,frontWing=Math.max(wing,c+sL+.1),cw=Math.min(o.courtW,bodyW-2*wing),cd=Math.min(o.courtD,H-(o.typology==='u'?1:2)*frontWing);
  if(cw<2||cd<2){g.errors.push(`Courtyard cannot fit: side wings need ${wing.toFixed(1)} m and the front wing ${frontWing.toFixed(1)} m (stair length) beside the gallery. Increase the footprint or choose a bar typology.`);return g;}
  if(cw<o.courtW-.001||cd<o.courtD-.001)g.warnings.push(`Courtyard reduced to ${cw.toFixed(1)} × ${cd.toFixed(1)} m so side wings keep ${wing.toFixed(1)} m and the front wing ${frontWing.toFixed(1)} m for stairs, gallery and units. Increase the footprint or accept the smaller court.`);
  const ch=cd,bx=(bodyW-cw)/2,by=o.typology==='u'?H-cd:(H-cd)/2;
  g.built.push(rect(0,0,bodyW,by),rect(0,by,bx,H-by),rect(bodyW-bx,by,bx,H-by));
  if(o.typology==='court'){g.built[1].h=H-2*by;g.built[2].h=H-2*by;g.built.push(rect(0,H-by,bodyW,by));}
  g.voids.push(rect(bx,by,cw,ch));
  // Galleries form a connected ring (or U), with units on the outer side.
  cor(rect(0,by-c,bodyW,c),true);
  cor(rect(bx-c,by,c,(o.typology==='court'?H-2*by:H-by)),true);
  cor(rect(bodyW-bx,by,c,(o.typology==='court'?H-2*by:H-by)),true);
  if(o.typology==='court')cor(rect(0,H-by,bodyW,c),true);
  addBand(rect(0,0,bodyW,by-c),'x','bottom','front',o.edges.front);
  if(o.typology==='court')addBand(rect(0,H-by+c,bodyW,by-c),'x','top','rear',o.edges.rear);
  const sideH=o.typology==='court'?H-2*by:H-by;
  addBand(rect(0,by,bx-c,sideH),'y','right',o.edges.left?'left':'court',true);
  addBand(rect(bodyW-bx+c,by,bx-c,sideH),'y','left',o.edges.right?'right':'court',true);
  if(!o.edges.left||!o.edges.right)g.notes.push('Side-wing windows face the courtyard across an access gallery: privacy, fire exposure and natural-light compliance require review.');
 }
 // Corridor links generated from edited core positions (o-frame rects swapped into this frame by the caller).
 for(const s of o.stubs||[]){cor({...rect(s.x,s.y,s.w,s.h),stub:true});if(Math.abs(g.built.reduce((a,b)=>a+area(intersection(s,b)),0)-area(s))>.001)g.errors.push('A corridor link extends outside the floor plate. Regenerate the corridor.');}
 if(o.typology!=='free'){
 const primary=g.corridors[0];
 const topY=primary.y, bottomCorr=g.corridors.find(r=>r.y>topY+1&&r.w>bodyW-.1);
 const placeInternal=(x,route,kind,w=sW,l=sL)=>{
  const front=route===primary;
  const r=rect(x,front?route.y-l:route.y+route.h,w,l,kind);
  core(r,kind);if(!g.built.some(b=>inside(r,b)))g.errors.push(`${kind} template does not fit the wing beside circulation.`);
 };
 if(external||oneExt){
  const y=Math.max(0,Math.min(H-sW,topY+(c-sW)/2));core(rect(bodyW,y,sL,sW),'stair',true);g.built.push(rect(bodyW,y,sL,sW));
  if(external){
   if(bottomCorr){const y2=Math.min(H-sW,bottomCorr.y+(c-sW)/2);core(rect(bodyW,y2,sL,sW),'stair',true);g.built.push(rect(bodyW,y2,sL,sW));}
   else { // reserve other end by subtracting a stair from the bar's front band
    placeInternal(0,primary,'stair');g.cores[g.cores.length-1].exterior=true;
    g.notes.push('One exterior stair is recessed into the opposite end of the wing; both stairs remain inside the envelope.');
   }
  }
 }else if(scissor)placeInternal((bodyW-sW)*o.corePosition,primary,'scissor',sW,Math.max(sL,7.2));
 else if(one)placeInternal((bodyW-sW)*o.corePosition,primary,'stair');
 else {placeInternal(0,primary,'stair');placeInternal(bodyW-sW,bottomCorr||primary,'stair');}
 // Elevator placed in front band next to corridor; position chosen by input, search nearby when blocked.
 const e=o.elevator,ew=e*(o.lifts===2?2:1);
 const locs=[o.corePosition,.35,.65,.15,.85];let elev=null;
 for(const t of locs){const r=rect((bodyW-ew)*t,topY-e,ew,e,'elevator');if(g.built.some(b=>inside(r,b))&&!g.cores.some(k=>overlap(k,r))){elev=r;break;}}
 if(elev)core(elev,'elevator');else g.errors.push('Elevator cannot fit beside the corridor without overlapping a stair.');
 }
 if(root.CORE_LAYOUT&&(o.fixedCores||o.coreLayout))root.CORE_LAYOUT.apply(g,o.fixedCores||o.coreLayout,o);
 if(o.corridorStyle&&root.CORRIDOR_NETWORK)for(const c of g.corridors)c.exterior=o.corridorStyle==='exterior'&&root.CORRIDOR_NETWORK.exteriorAvailable(c,g,o);
 if(o.typology==='free'&&root.CORRIDOR_NETWORK)g.bands=root.CORRIDOR_NETWORK.bands(g,o);
 for(const k of g.cores)if(!inside(k,g.bounds))g.errors.push('A core extends outside the envelope.');
 for(let i=0;i<g.cores.length;i++)for(let j=i+1;j<g.cores.length;j++)if(overlap(g.cores[i],g.cores[j]))g.errors.push('Core templates overlap.');
 if(!(o.typology==='free'&&(o.corridorStale||!(o.freeCorridors&&o.freeCorridors.length))))for(const k of g.cores)if(!g.corridors.some(r=>attach(k,r)))g.errors.push(`${k.kind} has no direct connection to circulation.`);
 for(const ex of o.exclusions){if(!inside(ex,g.bounds))g.errors.push('An exclusion is outside the footprint bounds.');if(g.corridors.some(r=>overlap(r,ex)))g.errors.push('An exclusion obstructs circulation.');if(g.cores.some(r=>overlap(r,ex)))g.errors.push('An exclusion intersects a core.');}
 if(g.corridors.length){const seen=new Set([0]);for(let iter=0;iter<g.corridors.length;iter++)g.corridors.forEach((a,i)=>{if([...seen].some(j=>attach(a,g.corridors[j])))seen.add(i);});if(seen.size!==g.corridors.length)g.errors.push('Circulation is disconnected.');}
 return g;
}
function pack(length,depth,types,o,placed){
 const nd=depth-2*o.wall;if(nd<3||depth>o.maxDepth+.001)return [];
 const shareSum=types.reduce((s,t)=>s+t.share,0);if(!shareSum)return [];
 const choices=types.filter(t=>t.share>0).map(t=>({t,min:Math.max(o.minWidth,t.frontage,t.min/nd)+o.party,max:t.max/nd+o.party,target:t.target/nd+o.party})).filter(t=>t.min<=t.max+.001);
 let beam=[{seq:[],used:0,counts:{}}],all=[];
 const score=s=>{const n=s.seq.length,tot=Object.values(placed).reduce((a,b)=>a+b,0)+n;const mix=types.reduce((a,t)=>a+Math.abs(((placed[t.key]||0)+(s.counts[t.key]||0))/Math.max(1,tot)-t.share/shareSum),0);const capacity=s.seq.reduce((a,k)=>a+k.max,0);const unused=Math.max(0,length-capacity)/Math.max(1,length);return o.objective==='units'?n*10-mix-unused:o.objective==='mix'?n*.35-mix*8-unused*3:n*.65-mix*8-unused*3;};
 for(let n=0;n<Math.min(25,Math.floor(length/Math.max(o.minWidth,2)));n++){
  const next=[];for(const s of beam)for(const ch of choices)if(s.used+ch.min<=length+EPS){const counts={...s.counts,[ch.t.key]:(s.counts[ch.t.key]||0)+1};next.push({seq:s.seq.concat(ch),used:s.used+ch.min,counts});}
  const seen=new Set();beam=next.sort((a,b)=>score(b)-score(a)).filter(s=>{const key=JSON.stringify(s.counts);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,70);all.push(...beam);if(!beam.length)break;
 }
 const best=all.sort((a,b)=>score(b)-score(a))[0];if(!best)return [];
 const widths=best.seq.map(k=>k.min);let rem=length-widths.reduce((a,b)=>a+b,0);
 for(const key of ['target','max']){const room=best.seq.map((k,i)=>Math.max(0,k[key]-widths[i])),sum=room.reduce((a,b)=>a+b,0),give=Math.min(rem,sum);if(sum)widths.forEach((w,i)=>widths[i]+=give*room[i]/sum);rem-=give;}
 return best.seq.map((k,i)=>({type:k.t,width:widths[i],netDepth:nd}));
}
function unitsFor(g,o){const units=[],placed={};
 for(const b of g.bands){if(!b.eligible||b.w<=0||b.h<=0)continue;
  const axis=b.axis,along=axis==='x'?b.w:b.h,depth=axis==='x'?b.h:b.w;
  const origin=axis==='x'?b.x:b.y,blocks=[];
  for(const r of g.cores.concat(o.exclusions,g.cuts||[]))if(overlap(r,b)){const q=intersection(r,b);blocks.push([axis==='x'?q.x:q.y,(axis==='x'?q.x+q.w:q.y+q.h)]);}
  blocks.sort((a,b)=>a[0]-b[0]);const segments=[];let pos=origin+o.wall;
  for(const [a,z]of blocks){if(a>pos+EPS)segments.push([pos,a]);pos=Math.max(pos,z);}if(pos<origin+along-o.wall)segments.push([pos,origin+along-o.wall]);
  for(const [a,z]of segments){let cur=a;
   for(const item of pack(z-a,depth,o.types,o,placed)){
    const r=axis==='x'?rect(cur,b.y,item.width,depth):rect(b.x,cur,depth,item.width);
    const net=axis==='x'?rect(r.x+o.party/2,r.y+o.wall,r.w-o.party,r.h-2*o.wall):rect(r.x+o.wall,r.y+o.party/2,r.w-2*o.wall,r.h-o.party);
    const door=b.entry==='bottom'?[r.x+r.w/2,r.y+r.h]:b.entry==='top'?[r.x+r.w/2,r.y]:b.entry==='right'?[r.x+r.w,r.y+r.h/2]:[r.x,r.y+r.h/2];
    units.push({...r,netRect:net,net:area(net),id:units.length+1,type:item.type.key,beds:item.type.beds,entry:b.entry,face:b.face,door,kind:'unit'});placed[item.type.key]=(placed[item.type.key]||0)+1;cur+=item.width;
   }
  }
 }
 return units;
}
// A coordinate partition measures every occupied cell exactly once. This prevents
// overlapping reservations, exterior gallery area, or voids being double-counted.
function ledger(g,units,o){
 const all=g.built.concat(g.corridors,g.cores,o.exclusions,units.flatMap(u=>[...(u.parts||[u,...(u.patches||[])]),...(u.netParts||[u.netRect,...(u.netPatches||[])])]));const xs=[...new Set(all.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b),ys=[...new Set(all.flatMap(r=>[r.y,r.y+r.h]))].sort((a,b)=>a-b);
 const totals={net:0,walls:0,cores:0,externalStairs:0,corridors:0,galleries:0,exclusions:0,unallocated:0,built:0,enclosed:0};
 const contains=(r,x,y)=>x>r.x-EPS&&x<r.x+r.w+EPS&&y>r.y-EPS&&y<r.y+r.h+EPS;
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
  const x=(xs[i]+xs[i-1])/2,y=(ys[j]+ys[j-1])/2,a=(xs[i]-xs[i-1])*(ys[j]-ys[j-1]);if(a<EPS||!g.built.some(r=>contains(r,x,y)))continue;
  let key='unallocated';const core=g.cores.find(r=>contains(r,x,y)),corr=g.corridors.find(r=>contains(r,x,y));
  if(core)key=core.exterior?'externalStairs':'cores';else if(corr)key=corr.exterior?'galleries':'corridors';else if(o.exclusions.some(r=>contains(r,x,y)))key='exclusions';else {const u=units.find(r=>(r.parts||[r,...(r.patches||[])]).some(q=>contains(q,x,y)));if(u)key=(u.netParts||[u.netRect,...(u.netPatches||[])]).some(q=>contains(q,x,y))?'net':'walls';}
  totals[key]+=a;totals.built+=a;if(key!=='galleries'&&key!=='externalStairs')totals.enclosed+=a;
 }
 return totals;
}
function routeGraph(g,units){
 const nodes=[],edges=[];
 const add=p=>{const i=nodes.findIndex(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6);if(i>=0)return i;nodes.push(p);edges.push([]);return nodes.length-1;};
 const segs=g.corridors.map(r=>r.w>=r.h?[[r.x,r.y+r.h/2],[r.x+r.w,r.y+r.h/2]]:[[r.x+r.w/2,r.y],[r.x+r.w/2,r.y+r.h]]);
 const project=(p,s)=>{const [a,b]=s,t=Math.max(0,Math.min(1,((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/((b[0]-a[0])**2+(b[1]-a[1])**2)));return [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];};
 const links=segs.map(s=>s.map(add));
 // At touching corridor rectangles connect the nearest centerline endpoints, through the junction.
 for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++)if(attach(g.corridors[i],g.corridors[j])){let best=null;for(const a of segs[i]){const b=project(a,segs[j]),d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(!best||d<best.d)best={a,b,d};}for(const b of segs[j]){const a=project(b,segs[i]),d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(!best||d<best.d)best={a,b,d};}const a=add(best.a),b=add(best.b);links[i].push(a);links[j].push(b);edges[a].push([b,best.d]);edges[b].push([a,best.d]);}
 const connect=(p,filter)=>{let best=null;segs.forEach((s,i)=>{if(filter&&!filter(g.corridors[i]))return;const q=project(p,s),d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(!best||d<best.d)best={q,i,d};});if(!best)return null;const n=add(best.q);links[best.i].push(n);return {node:n,extra:best.d};};
 const contact=(c,r)=>{const x0=Math.max(c.x,r.x),x1=Math.min(c.x+c.w,r.x+r.w),y0=Math.max(c.y,r.y),y1=Math.min(c.y+c.h,r.y+r.h);if(x1-x0>.001){if(Math.abs(c.y+c.h-r.y)<.001)return [(x0+x1)/2,r.y];if(Math.abs(c.y-r.y-r.h)<.001)return [(x0+x1)/2,c.y];}if(y1-y0>.001){if(Math.abs(c.x+c.w-r.x)<.001)return [r.x,(y0+y1)/2];if(Math.abs(c.x-r.x-r.w)<.001)return [c.x,(y0+y1)/2];}return null;};
 const reach=p=>p&&connect(p,r=>p[0]>=r.x-EPS&&p[0]<=r.x+r.w+EPS&&p[1]>=r.y-EPS&&p[1]<=r.y+r.h+EPS);
 // A scissor core opening onto the corridor at both end landings is two exits, one per interleaved stair.
 const exits=g.cores.flatMap((c,i)=>{if(!['stair','scissor'].includes(c.kind))return [];const CL=root.CORE_LAYOUT,t=CL?.contacts(c,g.corridors)[0];
  if(c.kind==='scissor'&&t&&CL.cars(c,t.side)>1)return CL.openings(c,t.side).map((q,k)=>({id:`${i+1}${'AB'[k]}`,label:`Scissor stair ${'AB'[k]}`,point:q.point,link:reach(q.point)}));
  const access=CL?t?.point:g.corridors.map(r=>contact(c,r)).find(Boolean);return [{id:i+1,label:c.kind==='scissor'?'Scissor core':`Stair ${i+1}`,point:access,link:reach(access)}];});
 const doors=units.map(u=>u.door&&connect(u.door,r=>u.door[0]>=r.x-EPS&&u.door[0]<=r.x+r.w+EPS&&u.door[1]>=r.y-EPS&&u.door[1]<=r.y+r.h+EPS));
 links.forEach((list,i)=>{const unique=[...new Set(list)].sort((a,b)=>nodes[a][0]-nodes[b][0]||nodes[a][1]-nodes[b][1]);for(let j=1;j<unique.length;j++){const a=unique[j-1],b=unique[j],d=Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1]);edges[a].push([b,d]);edges[b].push([a,d]);}});
 edges.forEach((es,i)=>{const seen=new Set();edges[i]=es.filter(([j])=>{if(j===i||seen.has(j))return false;seen.add(j);return true;});});
 const trees=exits.map(exit=>{const dist=nodes.map(()=>Infinity),prev=nodes.map(()=>null),todo=new Set(nodes.map((_,i)=>i));if(exit.link)dist[exit.link.node]=exit.link.extra;
  while(todo.size){const a=[...todo].reduce((a,b)=>dist[a]<dist[b]?a:b);todo.delete(a);if(!Number.isFinite(dist[a]))break;for(const [b,d]of edges[a])if(dist[a]+d<dist[b]){dist[b]=dist[a]+d;prev[b]=a;}}return {dist,prev};});
 const paths=doors.map((door,ui)=>{const toExits=exits.map((exit,ei)=>{const tree=trees[ei],distance=door?tree.dist[door.node]+door.extra:Infinity,points=[];if(Number.isFinite(distance)){points.push(units[ui].door.slice());let k=door.node;for(let i=0;k!=null&&i<=nodes.length;i++){points.push(nodes[k].slice());k=tree.prev[k];}points.push(exit.point.slice());}return {exit:exit.id,label:exit.label,distance,points};});const best=toExits.reduce((a,b)=>b.distance<a.distance?b:a,{distance:Infinity,points:[],exit:null});return {...best,points:best.points.map(p=>p.slice()),unit:units[ui].id,toExits};});
 // Distance from a non-exit terminal to a junction or exit, along the schematic centerline.
 let deadEnd=0;const deadEnds=[];nodes.forEach((_,start)=>{if(edges[start].length!==1||exits.some(e=>e.link?.node===start))return;let a=start,from=-1,d=0;const pts=[nodes[start].slice()];for(let i=0;i<nodes.length;i++){if(a!==start&&(edges[a].length!==2||exits.some(e=>e.link?.node===a)))break;const e=edges[a].find(e=>e[0]!==from);if(!e)break;d+=e[1];from=a;a=e[0];pts.push(nodes[a].slice());}deadEnd=Math.max(deadEnd,d);if(d>.5)deadEnds.push({length:d,points:pts,toExit:exits.some(e=>e.link?.node===a)});});deadEnds.sort((p,q)=>q.length-p.length);
 return {paths,exits:exits.map(e=>({id:e.id,label:e.label,point:e.point?.slice(),connected:!!e.link})),max:paths.length?Math.max(...paths.map(p=>p.distance)):null,deadEnd,deadEnds,status:!paths.length?'no-unit-doors':paths.some(p=>!Number.isFinite(p.distance))?'disconnected':'measured'};
}
function validate(g,units,o){const errors=[...g.errors],parts=u=>u.parts||[u,...(u.patches||[])];for(const u of units){for(const p of parts(u)){if(Math.abs(g.built.reduce((s,b)=>s+area(intersection(p,b)),0)-area(p))>.001)errors.push(`Unit ${unitNo(o.level,u.id)} is outside the built plate.`);if(g.cores.concat(g.corridors,o.exclusions).some(b=>overlap(p,b)))errors.push(`Unit ${unitNo(o.level,u.id)} overlaps a reservation.`);}if(!g.corridors.some(c=>parts(u).some(p=>attach(p,c))))errors.push(`Unit ${unitNo(o.level,u.id)} has no circulation access.`);const t=o.types.find(t=>t.key===u.type);if(!u.manual&&(u.net<t.min-.01||!u.enlarged&&u.net>t.max*(u.stretched?1.05:1)+.01))errors.push(`Unit ${unitNo(o.level,u.id)} is outside its area range.`);}for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++)if(parts(units[i]).some(a=>parts(units[j]).some(b=>overlap(a,b))))errors.push('Units overlap.');return [...new Set(errors)];}

function generate(input,context={}){
 const o={...defaults(),...input};o.types=input.types||TYPES;const invalid=[];
 for(const k of ['W','D','ftf','corridor','stairW','stairL','elevator','coreWall',...(o.geometryOnly?[]:['wall','party','corridorWall','minWidth','maxDepth'])])if(!Number.isFinite(o[k])||o[k]<=0)invalid.push(`Invalid ${k}.`);
 if(!Number.isInteger(o.floors)||o.floors<1||o.floors>12)invalid.push('Storeys must be an integer from 1 to 12.');
 if(!o.geometryOnly&&o.types.some(t=>![t.min,t.target,t.max,t.share,t.frontage].every(Number.isFinite)||t.min<=0||t.min>t.target||t.target>t.max||t.share<0||t.frontage<=0))invalid.push('Unit inputs require 0 < minimum ≤ target ≤ maximum, positive frontage, and non-negative shares.');
 if(!['free','bar','gallery','court','u'].includes(o.typology)||!['x','y'].includes(o.axis)||!['two','one','external','scissor'].includes(o.stair))invalid.push('Unknown typology, orientation or stair scheme.');
 if(!Number.isFinite(o.offset)||o.offset<.15||o.offset>.85||!Number.isFinite(o.corePosition)||o.corePosition<0||o.corePosition>1)invalid.push('Corridor and core positions are outside their allowed ranges.');
 for(const k of ['courtW','courtD','barDepth'])if(!Number.isFinite(o[k])||o[k]<=0)invalid.push(`Invalid ${k}.`);
 for(const k of ['travel','deadEnd','unitCap'])if(!Number.isFinite(o[k])||o[k]<0)invalid.push(`Invalid ${k}.`);
 if(o.exclusions.some(r=>![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<=0||r.h<=0))invalid.push('Exclusions require finite coordinates and positive dimensions.');
 if(!o.geometryOnly&&Math.abs(o.types.reduce((s,t)=>s+t.share,0)-100)>.01)invalid.push('Requested unit shares must total 100%.');
 if(o.depthTolerance!=null&&(!Number.isFinite(o.depthTolerance)||o.depthTolerance<0||o.depthTolerance>1.2))invalid.push('Extra depth allowance must be between 0 and 1.2 m.');
 if(invalid.length)return {ok:false,errors:invalid,o,context};
 // Rotation transforms all geometry, exclusions and window masks into the working frame.
 const rotated=o.axis==='y';let work={...o};if(rotated){work={...o,W:o.D,D:o.W,courtW:o.courtD,courtD:o.courtW,edges:{front:o.edges.left,rear:o.edges.right,left:o.edges.front,right:o.edges.rear},exclusions:o.exclusions.map(r=>({...r,x:r.y,y:r.x,w:r.h,h:r.w})),stubs:(o.stubs||[]).map(r=>({...r,x:r.y,y:r.x,w:r.h,h:r.w})),freeCorridors:(o.freeCorridors||[]).map(r=>({...r,x:r.y,y:r.x,w:r.h,h:r.w})),court:o.court?{...o.court,x:o.court.y,y:o.court.x,w:o.court.h,h:o.court.w}:o.court,unitEdits:o.unitEdits&&Object.fromEntries(Object.entries(o.unitEdits).map(([k,list])=>[k,list.map(q=>({...q,axis:q.axis&&(q.axis==='x'?'y':'x'),p:q.p&&[q.p[1],q.p[0]],a:q.a&&[q.a[1],q.a[0]],b:q.b&&[q.b[1],q.b[0]]}))]))};}
 const g=geometry(work.floorDesign?{...work,exclusions:[]}:work);if(root.FLOOR_DESIGN)root.FLOOR_DESIGN.prepare(g,work);if(o.geometryOnly&&(o.corridorDraft||o.corridorStale)){g.errors=g.errors.filter(e=>!/no direct connection to circulation|lost its corridor connection|has no corridor connection|Circulation is disconnected/i.test(e));}if(g.errors.length){if(rotated){[...g.built,...g.voids,...g.corridors,...g.cores,...g.bands,g.bounds].forEach(r=>{[r.x,r.y,r.w,r.h]=[r.y,r.x,r.h,r.w];});if(root.CORE_LAYOUT)g.cores.forEach(c=>{c.doorSide=root.CORE_LAYOUT.swap(c).doorSide;});g.W=o.W;g.H=o.D;}return {ok:false,errors:g.errors,g,o,context};}
 const units=o.geometryOnly||o.commercial&&o.floors===1?[]:unitsFor(g,work);
 const fitIssues=[...(g.warnings||[])];
 if(!(o.commercial&&o.floors===1)){
  if(g.bands.length&&!g.bands.some(b=>b.eligible))fitIssues.push('No unit band faces an enabled window edge. Review the window-face inputs for this orientation.');
  const deep=g.bands.filter(b=>b.eligible&&(b.axis==='x'?b.h:b.w)>o.maxDepth+.001);if(deep.length)fitIssues.push(`${deep.length} unit band(s) exceed the ${o.maxDepth.toFixed(1)} m maximum unit depth. Adjust the footprint or corridor position in Shape & cores, or review the depth input.`);
 }
 if(!o.geometryOnly){if(root.POLY_PACK&&work.floorDesign){if(!(o.commercial&&o.floors===1)){root.POLY_PACK.refine(g,units,work);
  // Cores-first plate: corner and end-cap units sometimes claim space plain bands use better, so fit both and keep the higher unit area.
  if(work.typology==='free'&&root.CORRIDOR_NETWORK&&!work.noCaps&&!work.slices?.[work.level]){const g2={...g,bands:root.CORRIDOR_NETWORK.bands(g,{...work,noCaps:true})},u2=[];root.POLY_PACK.refine(g2,u2,work);const net=us=>us.reduce((s,u)=>s+u.net,0);if(net(u2)>net(units)+1e-6){g.bands=g2.bands;units.splice(0,units.length,...u2);}}
  // and once more serving the units either side of a corridor end before the bands along the runs
  if(work.typology==='free'&&root.CORRIDOR_NETWORK&&!work.slices?.[work.level]){const g3={...g,bands:root.CORRIDOR_NETWORK.bands(g,{...work,endFirst:true})},u3=[];root.POLY_PACK.refine(g3,u3,work);const net=us=>us.reduce((s,u)=>s+u.net,0);if(net(u3)>net(units)+1e-6){g.bands=g3.bands;units.splice(0,units.length,...u3);}}
  // and with the dwelling across each corridor end first: the end unit that spans the plate, as terminal dwellings do in side-core plans
  if(work.typology==='free'&&root.CORRIDOR_NETWORK&&!work.slices?.[work.level]){const g4={...g,bands:root.CORRIDOR_NETWORK.bands(g,{...work,capFirst:true})},u4=[];root.POLY_PACK.refine(g4,u4,work);const net=us=>us.reduce((s,u)=>s+u.net,0);if(net(u4)>net(units)+1e-6){g.bands=g4.bands;units.splice(0,units.length,...u4);}}
  if(work.typology==='free'&&root.FLOOR_DESIGN?.absorb){root.FLOOR_DESIGN.absorb(g,units,work);root.FLOOR_DESIGN.carve(g,units,work);root.FLOOR_DESIGN.absorb(g,units,work);root.POLY_PACK.closeGaps(g,units,work);root.FLOOR_DESIGN.absorb(g,units,work,true);}
  // hand cuts and joins replay last, on the fitted units
  if(work.typology==='free')root.POLY_PACK.edits(g,units,work);}}else if(root.FLOOR_DESIGN)root.FLOOR_DESIGN.extend(g,units,work);}
 if(work.typology==='free')root.FLOOR_DESIGN?.landings(g,units,work);
 for(const u of units)if(u.manual){const t=o.types.find(t=>t.key===u.type);if(u.net<t.min-.01||u.net>t.max+.01)fitIssues.push(`Unit ${unitNo(o.level,u.id)} is ${u.net.toFixed(1)} m² after wall editing, outside the ${t.label} range (${t.min}–${t.max} m²).`);}
 for(const u of units)if(u.enlarged)fitIssues.push(`Unit ${unitNo(o.level,u.id)} enlarged to ${u.net.toFixed(1)} m² to absorb adjoining leftover space; above its preferred area range.`);
 const errors=validate(g,units,work),L=ledger(g,units,work),route=routeGraph(g,units);
 if(work.coreLayout&&root.CORE_LAYOUT)errors.push(...root.CORE_LAYOUT.validate(g,work));
 if(route.paths.some(p=>!Number.isFinite(p.distance)))errors.push('A unit has no connected route to a stair.');
 if(!(o.geometryOnly&&o.corridorDraft)&&o.typology==='free'&&o.freeCorridors?.length){const required=o.stair==='one'?1:2;if(route.exits.length<required||route.paths.some(p=>p.toExits.filter(e=>Number.isFinite(e.distance)).length<required))errors.push('Every unit must reach all required stair exits through the continuous corridor network.');}
 if(rotated){const trans=r=>{[r.x,r.y,r.w,r.h]=[r.y,r.x,r.h,r.w];};[...g.built,...g.voids,...g.corridors,...g.cores,...g.bands,...g.bands.flatMap(b=>b.parts||[]),g.bounds].forEach(trans);units.forEach(u=>{[...new Set([u,u.netRect,...(u.parts||[]),...(u.netParts||[]),...(u.patches||[]),...(u.netPatches||[])])].forEach(trans);u.door.reverse();if(u.cut)u.cut={...u.cut,axis:u.cut.axis==='x'?'y':'x'};u.entry={top:'left',bottom:'right',left:'top',right:'bottom'}[u.entry];if(u.windowSide)u.windowSide={top:'left',bottom:'right',left:'top',right:'bottom'}[u.windowSide];u.face={front:'left',rear:'right',left:'front',right:'rear',court:'court'}[u.face];});route.paths.forEach(p=>p.points.forEach(q=>q.reverse()));g.W=o.W;g.H=o.D;}
 if(rotated){g.bands.forEach(b=>b.axis=b.axis==="x"?"y":"x");route.paths.forEach(p=>p.toExits?.forEach(t=>t.points.forEach(q=>q.reverse())));route.exits.forEach(e=>e.point?.reverse());route.deadEnds?.forEach(d=>d.points.forEach(q=>q.reverse()));}
 if(rotated&&root.CORE_LAYOUT)g.cores.forEach(c=>{c.doorSide=root.CORE_LAYOUT.swap(c).doorSide;});
 const nRes=o.floors-(o.commercial?1:0),count=units.length*nRes,byType=Object.fromEntries(o.types.map(t=>[t.key,units.filter(u=>u.type===t.key).length*nRes]));
 const permitted=context.permitted||0,siteArea=context.area||0,countable=L.built*o.floors,achieved=siteArea?countable/siteArea:0;
 const ceiling=permitted*siteArea,remaining=ceiling-countable;
 const flags=[];if(!count)flags.push('No residential units fit the current constraints.');if(count>0&&count<=8)flags.push('Apartment schedule assumes more than eight units; review the applicable use and density rules for this smaller proposal.');if(remaining<-.1&&siteArea)flags.push('Current design exceeds the permitted floor-area budget.');if(o.travel>0&&route.max>o.travel)flags.push('Corridor route exceeds your travel limit.');if(o.deadEnd>0&&route.deadEnd>o.deadEnd)flags.push('Corridor dead end exceeds your limit.');if(o.unitCap>0&&count>o.unitCap)flags.push('Unit count exceeds your entered cap.');
 const req=context.mix||{two:0,three:0},family=(byType['2B']||0)+(byType['3B']||0),three=byType['3B']||0;
 if(count&&(family/ count+EPS<req.two||three/count+EPS<req.three))flags.push('Achieved bedroom mix does not meet the selected schedule’s numeric mix requirement.');
 const eff=L.enclosed?L.net/L.enclosed:0;
 return {ok:!errors.length,errors,flags:flags.concat(fitIssues),fitIssues,g,units,ledger:L,route,o,context,count,byType,nRes,countable,achieved,remaining,ceiling,eff,net:L.net*nRes,avg:units.length?L.net/units.length:0,mixOK:count>0&&family/count+EPS>=req.two&&three/count+EPS>=req.three,notes:g.notes};
}
function densityFit(input,context){
 input={...input};let depthAdjusted=false;
 if(input.autoFit&&['bar','gallery'].includes(input.typology)){const axis=input.axis==='y'?'W':'D',max=(input.typology==='bar'?2:1)*input.maxDepth+input.corridor;if(input[axis]>max){input[axis]=max;depthAdjusted=true;}}
 let result=generate(input,context);if(depthAdjusted&&result.ok){result.fitted=true;result.notes.push(input.typology==='bar'?'Double-loaded reference depth limited to two maximum-depth unit bands plus circulation.':'Single-loaded depth limited to one maximum-depth unit band plus the gallery.');}
 if(!input.autoFit||!result.ok||result.remaining>=-.1||!context.area)return result;
 // Keep all storeys and cores aligned. Uniformly scale the footprint, not the core templates or court.
 let best=null,lo=.15,hi=1;
 for(let i=0;i<24;i++){const s=(lo+hi)/2,scaled={...input,W:input.W*s,D:input.D*s,autoFit:false};const work=scaled.axis==='y'?{...scaled,W:scaled.D,D:scaled.W,courtW:scaled.courtD,courtD:scaled.courtW}:scaled;const g=geometry(work.floorDesign?{...work,exclusions:[]}:work);if(root.FLOOR_DESIGN)root.FLOOR_DESIGN.prepare(g,work);if(g.errors.length){lo=s;continue;}const remaining=context.area*context.permitted-g.built.reduce((sum,r)=>sum+area(r),0)*scaled.floors;if(remaining>=0){best=scaled;lo=s;}else hi=s;}
 if(best){best=generate(best,context);best.notes.push('Footprint reduced uniformly to the countable-area budget; stairs, corridor and courtyard dimensions retained.');best.fitted=true;return best;}
 result.flags.push('Automatic fitting could not reach the density budget while retaining the requested court and core dimensions.');return result;
}
function alternatives(o,context){const out=[];for(const typology of ['bar','gallery','court','u'])for(const axis of ['x','y'])for(const position of [.35,.5,.65])for(const stair of [...new Set([o.stair,'two','external'])]){
 const requested={...o,typology,axis,offset:position,stair};const r=densityFit(requested,context);r.requested=requested;r.key=`${typology}-${axis}-${position}-${stair}`;out.push(r);
 }const score=r=>{if(!r.ok||r.flags.length||!r.count)return -1e6;const mix=o.types.reduce((s,t)=>s+Math.abs((r.byType[t.key]||0)/r.count-t.share/100),0);return o.objective==='units'?r.count*10-mix:o.objective==='mix'?-mix*100+r.count*.1:r.count+r.eff*10-mix*15;};return out.sort((a,b)=>score(b)-score(a));}
root.EXPLORE={unitNo,geometry,routeGraph,attach,intersection,defaults,names,generate,densityFit,alternatives,fitRect,inPoly,convex,rect,area,polyArea,overlap,inside,ledger,validate};
})(typeof window!=='undefined'?window:globalThis);
