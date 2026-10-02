/* Fixed-door rectilinear routing, then marginal unit-yield coverage. Metres. */
(function(root){'use strict';
const E=root.EXPLORE,EPS=1e-5,R=E.rect,area=rs=>rs.reduce((s,r)=>s+E.area(r),0);
const subtract=(rs,blocks)=>{for(const b of blocks)rs=rs.flatMap(r=>root.FLOOR_DESIGN.subtract(r,b));return rs;};
const union=rs=>{const out=[];for(const r of rs)out.push(...subtract([r],out));return out;};
function compact(rs){rs=rs.map(r=>({...r}));let changed=true;while(changed){changed=false;outer:for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){const a=rs[i],b=rs[j],h=Math.abs(a.y-b.y)<EPS&&Math.abs(a.h-b.h)<EPS&&(Math.abs(a.x+a.w-b.x)<EPS||Math.abs(b.x+b.w-a.x)<EPS),v=Math.abs(a.x-b.x)<EPS&&Math.abs(a.w-b.w)<EPS&&(Math.abs(a.y+a.h-b.y)<EPS||Math.abs(b.y+b.h-a.y)<EPS);if(!h&&!v)continue;rs[i]=R(Math.min(a.x,b.x),Math.min(a.y,b.y),h?a.w+b.w:a.w,v?a.h+b.h:a.h);rs.splice(j,1);changed=true;break outer;}}return rs;}
const covered=(r,rs)=>Math.abs(area(rs.map(b=>E.intersection(r,b)))-E.area(r))<.001;
const contains=(rs,x,y)=>rs.some(r=>x>r.x-EPS&&x<r.x+r.w+EPS&&y>r.y-EPS&&y<r.y+r.h+EPS);
const unique=xs=>[...new Set(xs.map(x=>+x.toFixed(6)))].sort((a,b)=>a-b);
function boundaries(built,o){
 const lines=new Map();
 for(const r of built)for(const [side,v,a,z]of [['top',r.y,r.x,r.x+r.w],['bottom',r.y+r.h,r.x,r.x+r.w],['left',r.x,r.y,r.y+r.h],['right',r.x+r.w,r.y,r.y+r.h]]){
  const horizontal=side==='top'||side==='bottom',points=unique([a,z,...built.flatMap(b=>horizontal?[b.x,b.x+b.w]:[b.y,b.y+b.h]).filter(p=>p>a&&p<z)]);
  for(let i=1;i<points.length;i++){const lo=points[i-1],hi=points[i],mid=(lo+hi)/2,x=horizontal?mid:v+(side==='left'?-.001:.001),y=horizontal?v+(side==='top'?-.001:.001):mid;if(contains(built,x,y))continue;
   const exterior=side==='top'&&Math.abs(v)<EPS?'front':side==='bottom'&&Math.abs(v-o.D)<EPS?'rear':side==='left'&&Math.abs(v)<EPS?'left':side==='right'&&Math.abs(v-o.W)<EPS?'right':null;
   const key=[side,v,exterior||'court'].join(':');if(!lines.has(key))lines.set(key,{side,v,face:exterior||'court',eligible:exterior?!!o.edges[exterior]:true,intervals:[]});lines.get(key).intervals.push([lo,hi]);
  }
 }
 const out=[];for(const l of lines.values()){l.intervals.sort((a,b)=>a[0]-b[0]);const merged=[];for(const s of l.intervals){const prev=merged.at(-1);if(prev&&s[0]<=prev[1]+EPS)prev[1]=Math.max(prev[1],s[1]);else merged.push(s.slice());}for(const [a,z]of merged)out.push({...l,a,z});}return out;
}
// Edges that actually face the exterior or an open courtyard, not another room.
function exposedEdges(rects,g,o){const outside=boundaries(g.built,{...o,edges:o.edges||{}}),out=[];
 for(const e of boundaries(rects,{...o,edges:o.edges||{}}))for(const f of outside){if(e.side!==f.side||Math.abs(e.v-f.v)>.01)continue;const a=Math.max(e.a,f.a),z=Math.min(e.z,f.z);if(z-a>.01)out.push({...e,a,z});}return out;}
function exteriorAvailable(c,g,o){return exposedEdges([c],g,o).some(e=>(['top','bottom'].includes(e.side)===(c.w>=c.h))&&e.z-e.a>=Math.max(1.2,Math.max(c.w,c.h)*.35));}
function bands(g,o){
 const candidates=[],facades=boundaries(g.built,o),blocks=g.cores.concat(g.corridors,o.exclusions||[]);
 for(const f of facades){if(!f.eligible)continue;const horizontal=f.side==='top'||f.side==='bottom';
  for(const c of g.corridors){if((c.axis||((c.w>=c.h)?'x':'y'))!==(horizontal?'x':'y'))continue;
   const a=Math.max(f.a,horizontal?c.x:c.y),z=Math.min(f.z,horizontal?c.x+c.w:c.y+c.h);if(z-a<o.minWidth-EPS)continue;
   const end=f.side==='top'?c.y:f.side==='bottom'?c.y+c.h:f.side==='left'?c.x:c.x+c.w,depth=(f.side==='top'||f.side==='left')?end-f.v:f.v-end;
   if(depth<3-EPS||depth>o.maxDepth+EPS)continue;
   const r=horizontal?R(a,Math.min(f.v,end),z-a,depth):R(Math.min(f.v,end),a,depth,z-a);
   const parts=subtract(g.built.map(b=>E.intersection(r,b)).filter(b=>E.area(b)>EPS),blocks);if(!parts.length)continue;
   candidates.push({...r,parts,axis:horizontal?'x':'y',entry:{top:'bottom',bottom:'top',left:'right',right:'left'}[f.side],face:f.face,windowSide:f.side,eligible:true});
  }
 }
 // End units: a pocket between a window face and a corridor that runs perpendicular to it. The corridor end reaches the face; the unit
 // is entered from the corridor side and takes its window from the face, so the first unit along the corridor is the one that fits.
 if(!o.noEndUnits)for(const f of facades){if(!f.eligible)continue;const horizontal=f.side==='top'||f.side==='bottom';
  for(const c of g.corridors){const cAxis=c.axis||((c.w>=c.h)?'x':'y');if(cAxis!==(horizontal?'y':'x'))continue;
   // a remainder narrower than a unit between the pocket and the far wall joins the pocket, as for end caps
   const far=horizontal?(f.side==='top'?o.D-f.v:f.v):(f.side==='left'?o.W-f.v:f.v),along=o.noCaps?Math.min(o.maxDepth,horizontal?c.h:c.w):far-o.maxDepth<Math.max(o.minWidth||0,3.96)?far:o.maxDepth;if(o.noCaps&&along<3-EPS)continue;const lo=horizontal?(f.side==='top'?f.v:f.v-along):(f.side==='left'?f.v:f.v-along),cLo=horizontal?c.y:c.x,cHi=cLo+(horizontal?c.h:c.w);if(Math.min(lo+along,cHi)-Math.max(lo,cLo)<1.2-EPS)continue;if(o.noCaps){const near=horizontal?(f.side==='top'?Math.abs(c.y-f.v):Math.abs(c.y+c.h-f.v)):(f.side==='left'?Math.abs(c.x-f.v):Math.abs(c.x+c.w-f.v));if(near>o.corridor+.05)continue;} // search keeps the strict rule; fitting uses the wide one
   for(const dir of [-1,1]){let r;
    // the pocket spans the plate beside the corridor; the face (a recess can split it) must give it at least one unit width of window
    if(horizontal){const x0=Math.max(0,dir<0?c.x-o.maxDepth:c.x+c.w),x1=Math.min(o.W,dir<0?c.x:c.x+c.w+o.maxDepth);r=R(x0,f.side==='top'?f.v:f.v-along,x1-x0,along);}
    else{const y0=Math.max(0,dir<0?c.y-o.maxDepth:c.y+c.h),y1=Math.min(o.D,dir<0?c.y:c.y+c.h+o.maxDepth);r=R(f.side==='left'?f.v:f.v-along,y0,along,y1-y0);}
    if(r.w<o.minWidth-EPS||r.h<o.minWidth-EPS||Math.min(f.z,horizontal?r.x+r.w:r.y+r.h)-Math.max(f.a,horizontal?r.x:r.y)<o.minWidth-EPS)continue;
    const all=subtract(g.built.map(b=>E.intersection(r,b)).filter(b=>E.area(b)>EPS),blocks),parts=all.filter(p=>horizontal?Math.abs(dir<0?p.x+p.w-c.x:p.x-(c.x+c.w))<.05:Math.abs(dir<0?p.y+p.h-c.y:p.y-(c.y+c.h))<.05);
    // pieces joined to the corridor-side piece by a shared edge belong to the same pocket (a recess can split the face off it)
    
    for(let grew=true;grew;){grew=false;for(const p of all)if(!parts.includes(p)&&parts.some(q=>{const x=Math.min(p.x+p.w,q.x+q.w)-Math.max(p.x,q.x),y=Math.min(p.y+p.h,q.y+q.h)-Math.max(p.y,q.y);return Math.abs(x)<EPS?y>=1.2:Math.abs(y)<EPS&&x>=1.2;})){parts.push(p);grew=true;}}
    if(!parts.length||!o.noCaps&&!parts.some(p=>horizontal?Math.abs((f.side==='top'?p.y:p.y+p.h)-f.v)<.05:Math.abs((f.side==='left'?p.x:p.x+p.w)-f.v)<.05))continue;
    // A corridor that stops short of the face leaves a strip one corridor wide beyond its end. The whole strip goes to the
    // narrower of the two pockets beside it (the first on a tie), so the party wall carries on the line of a corridor wall
    // instead of stepping to the centre line.
    const short=horizontal?(f.side==='top'?c.y-f.v:f.v-c.y-c.h):(f.side==='left'?c.x-f.v:f.v-c.x-c.w);
    const wide=d=>horizontal?(d<0?c.x-Math.max(0,c.x-o.maxDepth):Math.min(o.W,c.x+c.w+o.maxDepth)-c.x-c.w):(d<0?c.y-Math.max(0,c.y-o.maxDepth):Math.min(o.D,c.y+c.h+o.maxDepth)-c.y-c.h);
    if(short>.05&&(dir<0?wide(-1)<=wide(1):wide(1)<wide(-1))){const s=horizontal?R(c.x,f.side==='top'?f.v:c.y+c.h,c.w,short):R(f.side==='left'?f.v:c.x+c.w,c.y,short,c.h);parts.push(...subtract(g.built.map(b=>E.intersection(s,b)).filter(b=>E.area(b)>EPS),blocks));}
    const bb=parts.reduce((m,p)=>({x:Math.min(m.x,p.x),y:Math.min(m.y,p.y),X:Math.max(m.X,p.x+p.w),Y:Math.max(m.Y,p.y+p.h)}),{x:1e9,y:1e9,X:-1e9,Y:-1e9});
    candidates.push({...R(bb.x,bb.y,bb.X-bb.x,bb.Y-bb.y),parts,axis:horizontal?'y':'x',entry:horizontal?(dir<0?'right':'left'):(dir<0?'bottom':'top'),face:f.face,windowSide:f.side,eligible:true,end:true});
   }
  }
 }
 // End caps: the space beyond a corridor run's end, entered through that end, when a window face lies within one unit depth.
 if(!o.noEndUnits&&!o.noCaps)for(const q of g.corridors){const h=(q.axis||((q.w>=q.h)?'x':'y'))==='x',span=h?q.h:q.w;if(span<1.2-EPS)continue;
  for(const end of ['a','z']){const d=o.maxDepth,mid=h?q.y+q.h/2:q.x+q.w/2,span2=h?o.D:o.W,minW=Math.max(o.minWidth||0,3.96);let r;
   // The cap spans one unit depth either side of the corridor's centre line; a remainder narrower than a unit up to the plate
   // edge joins the cap, since nothing else can reach it and a strip left behind would be unusable.
   let lo=Math.max(0,mid-d/2),hi=Math.min(span2,mid+d/2);if(lo<minW)lo=0;if(span2-hi<minW)hi=span2;
   if(h){const x0=end==='a'?Math.max(0,q.x-d):q.x+q.w,x1=end==='a'?q.x:Math.min(o.W,q.x+q.w+d);r=R(x0,lo,x1-x0,hi-lo);}
   else{const y0=end==='a'?Math.max(0,q.y-d):q.y+q.h,y1=end==='a'?q.y:Math.min(o.D,q.y+q.h+d);r=R(lo,y0,hi-lo,y1-y0);}
   if(r.w<3-EPS||r.h<3-EPS)continue;
   // the face beyond the end first, then either side
   const want=h?(end==='a'?['left','top','bottom']:['right','top','bottom']):(end==='a'?['top','left','right']:['bottom','left','right']);
   const f=want.map(s=>facades.find(f=>f.eligible&&f.side===s&&(s==='top'||s==='bottom'?Math.abs(f.v-(s==='top'?r.y:r.y+r.h))<.05&&Math.min(f.z,r.x+r.w)-Math.max(f.a,r.x)>=o.minWidth:Math.abs(f.v-(s==='left'?r.x:r.x+r.w))<.05&&Math.min(f.z,r.y+r.h)-Math.max(f.a,r.y)>=o.minWidth))).find(Boolean);if(!f)continue;
   const parts=subtract(g.built.map(b=>E.intersection(r,b)).filter(b=>E.area(b)>EPS),blocks);if(!parts.length)continue;
   const endFace=h?(end==='a'?'right':'left'):(end==='a'?'bottom':'top');
   candidates.push({...r,parts,axis:h?'y':'x',entry:endFace,face:f.face,windowSide:f.side,eligible:true,end:true,cap:true});}}
 // Assign each patch once; compound corner units retain their remaining shape.
 // Caps come last: a cap takes only what the units beside the corridor leave. endFirst serves the units either side of a
 // corridor end before the bands along the runs (the packer fits both orders and keeps the better).
 const rank=b=>b.cap?(o.capFirst?0:2):b.end?(o.endFirst?0:1):(o.endFirst?1:0);candidates.sort((a,b)=>rank(a)-rank(b)||area(b.parts)-area(a.parts)||a.x-b.x||a.y-b.y);
 const out=[],used=[];
 // A band too small for the smallest unit type does not claim its patch: a neighbouring band (an end unit reaching the same
 // corridor) may need that patch for its door.
 const minArea=Math.min(...(o.types||[]).filter(t=>t.share>0).map(t=>t.min),Infinity);
 for(const b of candidates){const parts=compact(subtract(b.parts,used));if(area(parts)<1||!b.end&&Number.isFinite(minArea)&&area(parts)<minArea)continue;out.push({...b,parts});used.push(...parts);}
 const rest=subtract(g.built,blocks.concat(used));for(const r of rest)out.push({...r,parts:[r],axis:'x',entry:'bottom',face:'front',eligible:false,ground:true});
 return out;
}
function analyse(g,o,units){
 const unserved=subtract(g.built,g.cores.concat(g.corridors,o.exclusions||[],units.flatMap(u=>u.parts||[u,...(u.patches||[])]))),facades=boundaries(g.built,o).filter(f=>f.eligible),minArea=Math.min(...o.types.filter(t=>t.share>0).map(t=>t.min)),regions=[];
 for(const r of unserved){if(E.area(r)<.05)continue;const cx=r.x+r.w/2,cy=r.y+r.h/2;
  const nearWindow=facades.some(f=>{const h=f.side==='top'||f.side==='bottom',along=h?cx:cy,dist=Math.abs((h?cy:cx)-f.v);return along>=f.a-EPS&&along<=f.z+EPS&&dist<=o.maxDepth+EPS;});
  const nearFace=boundaries(g.built,o).filter(f=>!f.eligible).find(f=>{const h=f.side==='top'||f.side==='bottom',along=h?cx:cy;return along>=f.a-EPS&&along<=f.z+EPS&&Math.abs((h?cy:cx)-f.v)<=o.maxDepth+EPS;});
  const touchesCorridor=g.corridors.some(q=>E.attach(r,q));
  let reason=!nearWindow&&nearFace?`Its window face (${nearFace.face}) is switched off in Walls & window faces`:!nearWindow?'No window face within the maximum unit depth':touchesCorridor&&Math.min(r.w,r.h)>=3&&E.area(r)>=minArea?`Reaches the corridor and a window face, but is deeper than the ${o.maxDepth} m unit depth in one direction`:Math.min(r.w,r.h)<Math.max(o.minWidth||0,3.96)?'Narrower than 13 ft (3.96 m): too shallow for a unit on its own, and no neighbouring unit can take it':E.area(r)<minArea?'Smaller than the smallest enabled unit type':!touchesCorridor?'Reaches a facade but has no corridor contact, and no neighbouring unit can take it':!touchesCorridor&&g.cores.some(c=>E.attach(r,c))?'Blocked by a core or its required door access':'Within reach of a window face, but no corridor run serving it pays for itself under the current unit rules';
  regions.push({...r,area:E.area(r),reason});
 }
 return {unserved:regions,unservedArea:regions.reduce((s,r)=>s+r.area,0)};
}
class Heap{
 constructor(){this.a=[];}
 push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p][0]<=v[0])break;a[i]=a[p];i=p;}a[i]=v;}
 pop(){const a=this.a,first=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=v[0])break;a[i]=a[j];i=j;}a[i]=v;}return first;}
}
function* routeSteps(input){
 const o={...E.defaults(),...input,noCaps:true},cores=(o.coreLayout||[]).map(c=>({...c})),cw=o.corridor,half=cw/2,errors=[];
 if(!cores.length)return {corridors:[],errors:['Place the stairs and lift before Done.']};
 errors.push(...root.CORE_LAYOUT.inputErrors(cores,o));
 let built=[R(0,0,o.W,o.D)];if(o.court)built=subtract(built,[o.court]);
 // Shared corridor must survive every articulated storey.
 // sharedCutsFrom: storeys below it clip their own copy of the corridor at their cuts (plan setup routes on the full plate: a recess or setback only shortens the run on the floors it touches).
 const perFloor=Array.from({length:o.floors},(_,i)=>root.FLOOR_DESIGN.cuts({...o,articulationFront:o.articulationFront||'top'},i+1)),cuts=perFloor.filter((_,i)=>i+1>=(o.sharedCutsFrom||1)).flat();built=subtract(built,cuts);
  cores.forEach((c,n)=>{if(covered(c,built))return;const label=c.kind==='elevator'?'Lift':'Stair '+(n+1),floors=[];let depth=0;
   perFloor.forEach((fc,i)=>{for(const q of fc){const w=Math.min(c.x+c.w,q.x+q.w)-Math.max(c.x,q.x),h=Math.min(c.y+c.h,q.y+q.h)-Math.max(c.y,q.y);if(w>1e-6&&h>1e-6){if(!floors.includes(i+1))floors.push(i+1);depth=Math.max(depth,Math.min(w,h));}}});
   errors.push(floors.length?`${label} reaches ${depth.toFixed(2)} m into the upper-storey setback on floor${floors.length>1?'s '+floors[0]+'–'+floors.at(-1):' '+floors[0]}. Move it ${depth.toFixed(2)} m clear, or switch the setback off under More settings. Its position was kept.`:`${label} crosses the courtyard or the plate boundary. Its position was kept.`);});
 for(let i=0;i<cores.length;i++)for(let j=0;j<i;j++)if(E.overlap(cores[i],cores[j]))errors.push('Placed cores overlap. Separate them before Done.');
 if(errors.length)return {corridors:[],errors};
 const valid=r=>r.w>EPS&&r.h>EPS&&covered(r,built)&&!cores.concat(o.exclusions||[]).some(c=>E.overlap(c,r));
 const square=p=>R(p[0]-half,p[1]-half,cw,cw),facades=boundaries(built,o),xs=[half,o.W-half],ys=[half,o.D-half],anchors=[],strips=[];
 for(const c of cores){const h=c.doorSide==='top'||c.doorSide==='bottom',lo=h?c.x:c.y,length=h?c.w:c.h,v=c.doorSide==='top'?c.y-half:c.doorSide==='bottom'?c.y+c.h+half:c.doorSide==='left'?c.x-half:c.x+c.w+half;
  if(root.CORE_LAYOUT.cars?.(c)>1){const ops=root.CORE_LAYOUT.openings(c).map(q=>h?[q.point[0],v]:[v,q.point[1]]),strip=R(Math.min(ops[0][0],ops[1][0])-half,Math.min(ops[0][1],ops[1][1])-half,Math.abs(ops[0][0]-ops[1][0])+cw,Math.abs(ops[0][1]-ops[1][1])+cw);
   const ok=valid(strip);if(!ok)errors.push(`${c.kind==='scissor'?'Scissor stair':'Lift'} doors have no ${cw.toFixed(1)} m-wide corridor along both openings. Its position was kept.`);anchors.push(ok?ops:[]);strips.push(ok?{...strip,axis:h?'x':'y'}:null);for(const p of ops){xs.push(p[0]);ys.push(p[1]);}continue;}
  strips.push(null);
  const d=root.CORE_LAYOUT.door(c),positions=c.doorOffset==null?[lo+length/2,lo+Math.min(half,length/2),lo+length-Math.min(half,length/2)]:[(d.a+d.b)/2,d.b-half,d.a+half];
  const ps=unique(positions).map(a=>h?[a,v]:[v,a]).filter(p=>valid(square(p))&&root.CORE_LAYOUT.contacts(c,[square(p)]).length);
  if(!ps.length)errors.push(`${c.kind==='elevator'?'Lift':'Stair'} door has no ${cw.toFixed(1)} m-wide route into the plate. Its position was kept.`);anchors.push(ps);for(const p of ps){xs.push(p[0]);ys.push(p[1]);}
 }
 if(errors.length)return {corridors:[],errors};
 for(const r of built.concat(cores,o.exclusions||[])){xs.push(r.x-half,r.x+r.w+half,r.x+half,r.x+r.w-half);ys.push(r.y-half,r.y+r.h+half,r.y+half,r.y+r.h-half);}
 // Façade-depth lines and courtyard galleries are coverage candidates, not just core links.
 for(const f of facades){const arr=f.side==='top'||f.side==='bottom'?ys:xs,sign=f.side==='top'||f.side==='left'?1:-1;for(const d of [half,Math.min(8,o.maxDepth)+half,Math.min(10,o.maxDepth)+half,o.maxDepth+half])arr.push(f.v+sign*d);}
 for(const r of o.freeCorridors||[]){xs.push(r.x+half,r.x+r.w-half);ys.push(r.y+half,r.y+r.h-half);}
 xs.push(o.W/2);ys.push(o.D/2);if(o.layoutType==='gallery'){xs.push(o.W-half);ys.push(o.D-half);}
 const X=unique(xs.filter(x=>x>=half-EPS&&x<=o.W-half+EPS)),Y=unique(ys.filter(y=>y>=half-EPS&&y<=o.D-half+EPS)),nodes=[],byKey=new Map(),key=(x,y)=>[+x.toFixed(6),+y.toFixed(6)].join(',');
 for(const x of X)for(const y of Y)if(valid(square([x,y]))){byKey.set(key(x,y),nodes.length);nodes.push({p:[x,y],edges:[]});}
 const run=(a,b)=>R(Math.min(a[0],b[0])-half,Math.min(a[1],b[1])-half,Math.abs(a[0]-b[0])+cw,Math.abs(a[1]-b[1])+cw);
 for(const n of nodes){const [x,y]=n.p,i=X.indexOf(x),j=Y.indexOf(y),a=byKey.get(key(x,y));for(const p of [[X[i+1],y],[x,Y[j+1]]]){if(p.some(v=>v===undefined))continue;const b=byKey.get(key(...p));if(b==null||!valid(run(n.p,p)))continue;const distance=Math.abs(x-p[0])+Math.abs(y-p[1]);n.edges.push([b,distance]);nodes[b].edges.push([a,distance]);}}
 const terminals=anchors.map(ps=>ps.map(p=>byKey.get(key(...p))).filter(i=>i!=null));
 const search=sources=>{const dist=nodes.map(()=>Infinity),prev=nodes.map(()=>null),heap=new Heap();for(const i of sources){dist[i]=0;heap.push([0,i]);}while(heap.a.length){const [d,i]=heap.pop();if(d>dist[i]+EPS)continue;for(const [j,len]of nodes[i].edges){const next=d+len;if(next<dist[j]-EPS){dist[j]=next;prev[j]=i;heap.push([next,j]);}}}return {dist,prev};};
 const path=(tree,end)=>{const ps=[];for(let i=end;i!=null;i=tree.prev[i])ps.push(i);return ps;};
 const simplify=rs=>{const out=[];for(const r of rs){const axis=r.axis||(r.w>=r.h?'x':'y'),existing=out.find(q=>q.axis===axis&&(axis==='x'?Math.abs(q.y-r.y)<EPS&&r.x<=q.x+q.w+EPS&&q.x<=r.x+r.w+EPS:Math.abs(q.x-r.x)<EPS&&r.y<=q.y+q.h+EPS&&q.y<=r.y+r.h+EPS));if(existing){if(axis==='x'){const x=Math.min(existing.x,r.x);existing.w=Math.max(existing.x+existing.w,r.x+r.w)-x;existing.x=x;}else{const y=Math.min(existing.y,r.y);existing.h=Math.max(existing.y+existing.h,r.y+r.h)-y;existing.y=y;}}else out.push({...r,axis,kind:'circulation'});}return out.filter((r,i)=>!out.some((q,j)=>i!==j&&E.inside(r,q)&&(E.area(q)>E.area(r)+EPS||j<i)));};
 const rectangles=ps=>ps.length===1?[square(nodes[ps[0]].p)]:ps.slice(1).map((id,i)=>({...run(nodes[ps[i]].p,nodes[id].p),axis:nodes[ps[i]].p[0]===nodes[id].p[0]?'y':'x'}));
 // a path that reaches a two-car lift brings the corridor strip along both of its openings
 const withStrips=(cs,network)=>{let out=cs;strips.forEach((s,i)=>{if(s&&terminals[i].some(id=>network.has(id))&&!root.CORE_LAYOUT.contacts(cores[i],out).length)out=simplify(out.concat(s));});return out;};
 const seeds=[];
 for(const start of terminals[0]){const network=new Set([start]);let corridors=withStrips([square(nodes[start].p)],network),failed=false;
  for(let step=1;step<cores.length;step++){const missing=terminals.filter((ts,i)=>!root.CORE_LAYOUT.contacts(cores[i],corridors).length);if(!missing.length)break;const tree=search(network);let end=null;for(const ts of missing)for(const id of ts)if(end==null||tree.dist[id]<tree.dist[end])end=id;if(end==null||!Number.isFinite(tree.dist[end])){failed=true;break;}const ps=path(tree,end);ps.forEach(id=>network.add(id));corridors=withStrips(simplify(corridors.concat(rectangles(ps))),network);}
  if(!failed&&cores.every(c=>root.CORE_LAYOUT.contacts(c,corridors).length))seeds.push(corridors);
 }
 if(!seeds.length){const name=c=>c.kind==='elevator'?'Lift':c.kind==='scissor'?'Scissor core':'Stair';
  const reach=new Set(terminals[0]);for(const q of [...reach]){for(const [j]of nodes[q].edges)if(!reach.has(j)){reach.add(j);}}let grew=true;while(grew){grew=false;for(const q of [...reach])for(const [j]of nodes[q].edges)if(!reach.has(j)){reach.add(j);grew=true;}}
  const unreached=cores.map((c,i)=>({c,i})).filter(({i})=>i>0&&!terminals[i].some(id=>reach.has(id))).map(({c,i})=>`${name(c)} ${i+1} door at (${(c.x).toFixed(1)}, ${(c.y).toFixed(1)}), face ${c.doorSide}`);
  const why=[];if(!input.__probe){const probe=(label,patch)=>{const r=route({...input,__probe:true,...patch});if(!r.errors.length)why.push(label);};if((o.exclusions||[]).length)probe('a fixed reservation blocks the route',{exclusions:[]});if(cuts.length)probe('a massing cut on an upper floor blocks the route',{moves:{}});if(cw>1.2)probe(`a ${(cw-.6).toFixed(1)} m corridor would fit; ${cw.toFixed(1)} m does not`,{corridor:Math.max(1.2,cw-.6)});}
  return {corridors:[],errors:[`No continuous ${cw.toFixed(1)} m corridor reaches every core door${unreached.length?': '+unreached.join('; '):''}.${why.length?' Likely cause: '+why.join('; ')+'.':''} Change a door face, width or placement, then press Done.`]};}
 const measure=cs=>area(union(cs));
 const existing=simplify(o.freeCorridors||[]),connected=rs=>{if(!rs.length)return false;const seen=new Set([0]);for(let k=0;k<rs.length;k++)rs.forEach((r,i)=>{if([...seen].some(j=>E.attach(r,rs[j])))seen.add(i);});return seen.size===rs.length;};
 const retain=existing.length&&existing.every(valid)&&connected(existing)&&cores.every(c=>root.CORE_LAYOUT.contacts(c,existing).length)?existing:[];
 const geometry=cs=>{const g={built,cores,corridors:cs,voids:o.court?[o.court]:[],cuts:[],bands:[]};g.bands=bands(g,o);return g;};
 const packing=cs=>{const g=geometry(cs),units=[];root.POLY_PACK.refine(g,units,{...o,axis:'x',floorDesign:true,level:1,slices:undefined,exclusions:o.exclusions||[],shortSpine:false,recoverTails:false});return {g,units,net:units.reduce((s,u)=>s+u.net,0)};};
 const deadEnds=cs=>{const graph=new Map(),add=(i,j)=>{if(!graph.has(i))graph.set(i,new Set());graph.get(i).add(j);};const ids=nodes.map((n,i)=>cs.some(r=>contains([r],...n.p))?i:-1).filter(i=>i>=0),inside=new Set(ids);for(const i of ids)for(const [j]of nodes[i].edges)if(inside.has(j)&&covered(run(nodes[i].p,nodes[j].p),union(cs)))add(i,j);return ids.filter(i=>(graph.get(i)?.size||0)===1&&!terminals.some(ts=>ts.includes(i))).length;};
 // Link every core door to a network with straight stubs along the grid; null when a door cannot be reached.
 const linkDoors=(cs,network)=>{let out=cs;for(let step=0;step<=cores.length;step++){const missing=terminals.filter((ts,i)=>!root.CORE_LAYOUT.contacts(cores[i],out).length);if(!missing.length)break;const tree=search([...network]);let end=null;for(const ts of missing)for(const id of ts)if(end==null||tree.dist[id]<tree.dist[end])end=id;if(end==null||!Number.isFinite(tree.dist[end]))return null;const ps=path(tree,end);ps.forEach(id=>network.add(id));out=withStrips(simplify(out.concat(rectangles(ps).map(r=>({...r,stub:true})))),network);}return cores.every(c=>root.CORE_LAYOUT.contacts(c,out).length)?out:null;};

 // Frontage first. Efficiency is decided by which faces have windows and how deep the plate is, not by where the doors happen to sit,
 // so the planned seeds are full-length spines one unit depth in from each window face (or centred when one run serves both sides),
 // alone, paired, or joined as an L. Doors are then reached with stubs. These compete with the shortest-path seed on fitted yield.
 const snap=(arr,v)=>{let best=null;for(const x of arr)if(best==null||Math.abs(x-v)<Math.abs(best-v))best=x;return best!=null&&Math.abs(best-v)<=.6?best:null;};
 const spineAt=(axis,v)=>{const k=axis==='x'?1:0,ids=nodes.map((n,i)=>Math.abs(n.p[k]-v)<EPS?i:-1).filter(i=>i>=0).sort((a,b)=>nodes[a].p[1-k]-nodes[b].p[1-k]);let best=null,cur=[];const close=()=>{if(cur.length>1){const r=run(nodes[cur[0]].p,nodes[cur[cur.length-1]].p);if((axis==='x'?r.w:r.h)>=3*cw&&(!best||E.area(r)>E.area(best.r)))best={r:{...r,axis},ids:cur.slice()};}cur=[];};for(const id of ids){if(cur.length&&!nodes[cur[cur.length-1]].edges.some(([j])=>j===id))close();cur.push(id);}close();return best;};
 const lineY=new Set(),lineX=new Set();
 for(const f of facades){if(!f.eligible)continue;const sign=f.side==='top'||f.side==='left'?1:-1,v=f.v+sign*(o.maxDepth+half);const s=snap(f.side==='top'||f.side==='bottom'?Y:X,v);if(s!=null)(f.side==='top'||f.side==='bottom'?lineY:lineX).add(s);}
 if(o.D<=2*o.maxDepth+cw+EPS){const s=snap(Y,o.D/2);if(s!=null)lineY.add(s);}if(o.W<=2*o.maxDepth+cw+EPS){const s=snap(X,o.W/2);if(s!=null)lineX.add(s);}
 // A door face is also a spine line: a run that kisses the door needs no stub and leaves no jog.
 cores.forEach((c,i)=>{const h=c.doorSide==='top'||c.doorSide==='bottom';for(const p of anchors[i]||[]){if(h){const s=snap(Y,p[1]);if(s!=null)lineY.add(s);}else{const s=snap(X,p[0]);if(s!=null)lineX.add(s);}}});
 const spX=[...lineY].map(v=>spineAt('x',v)).filter(Boolean),spY=[...lineX].map(v=>spineAt('y',v)).filter(Boolean);
 const combos=[...spX.map(s=>[s]),...spY.map(s=>[s])];if(o.layoutType==='gallery'){const edge=spineAt(o.axis==='y'?'y':'x',o.axis==='y'?o.W-half:o.D-half);if(edge)combos.unshift([edge]);}
 for(let i=0;i<spX.length;i++)for(let j=i+1;j<spX.length;j++)if(Math.abs(spX[i].r.y-spX[j].r.y)>=cw+3)combos.push([spX[i],spX[j]]);
 for(let i=0;i<spY.length;i++)for(let j=i+1;j<spY.length;j++)if(Math.abs(spY[i].r.x-spY[j].r.x)>=cw+3)combos.push([spY[i],spY[j]]);
 for(const a of spX)for(const b of spY)combos.push([a,b]);
 for(const b of spY){const xs=spX.filter(a=>E.overlap(a.r,b.r)||E.attach(a.r,b.r)||true);for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)if(Math.abs(xs[i].r.y-xs[j].r.y)>=cw+3)combos.push([xs[i],b,xs[j]]);}
 for(const a of spX){for(let i=0;i<spY.length;i++)for(let j=i+1;j<spY.length;j++)if(Math.abs(spY[i].r.x-spY[j].r.x)>=cw+3)combos.push([spY[i],a,spY[j]]);}
 // Spines that do not meet (a core sits at the crossing) are joined by the shortest run before the doors are linked; a seed that is not one network is discarded.
 const preferred=o.layoutType;const eligibleCombos=preferred==='double'?combos.filter(cs=>cs.every(c=>c.r.axis===(o.axis==='y'?'y':'x'))):preferred==='gallery'?combos.filter(cs=>cs.length===1&&Math.abs((o.axis==='y'?cs[0].r.x:cs[0].r.y)-(o.axis==='y'?o.W-cw:o.D-cw))<.05):combos;
 const bound=combo=>{const cs=simplify(combo.map(s=>s.r));const g=geometry(cs);return area(g.bands.filter(b=>b.eligible).flatMap(b=>b.parts))-measure(cs);};
 const shortlist=eligibleCombos.map(c=>({c,b:bound(c)})).sort((a,b)=>b.b-a.b).slice(0,o.quick?3:14).map(x=>x.c);
 const planned=[];for(const combo of shortlist){yield;let cs=[combo[0].r];const network=new Set(combo[0].ids);let ok=true;for(const s of combo.slice(1)){if(!cs.some(r=>E.attach(r,s.r))){const tree=search([...network]);let end=null;for(const id of s.ids)if(Number.isFinite(tree.dist[id])&&(end==null||tree.dist[id]<tree.dist[end]))end=id;if(end==null){ok=false;break;}const ps=path(tree,end);ps.forEach(id=>network.add(id));cs=simplify(cs.concat(rectangles(ps)));}cs=simplify(cs.concat([s.r]));s.ids.forEach(id=>network.add(id));}if(!ok)continue;const linked=linkDoors(cs,network);if(linked&&connected(linked))planned.push(linked);}
 seeds.sort((a,b)=>measure(a)-measure(b));
 let protect=retain;const starts=[{cs:seeds[0],label:'shortest path'}];if(retain.length)starts.push({cs:retain,label:'kept'});
 // A corridor the user dragged is the network: keep its runs, relink the doors with straight stubs, then grow only what pays.
 if(o.fixedNetwork){const all=simplify(o.freeCorridors||[]),own=simplify((o.freeCorridors||[]).filter(r=>!r.stub));
  if(all.some(r=>!valid(r)))return {corridors:[],errors:['The moved corridor leaves the plate or crosses a core. Move it back onto clear plate.']};
  const nodesOf=rs=>{const u=union(rs);return nodes.map((n,i)=>covered(square(n.p),u)?i:-1).filter(i=>i>=0);};
  // Join separated pieces by the shortest grid path, so a moved run reconnects to the rest of the network.
  const joinAll=rs=>{for(let guard=0;guard<rs.length+2;guard++){if(connected(rs))return rs;const comp=[0];for(let k=0;k<comp.length;k++)rs.forEach((r,i)=>{if(!comp.includes(i)&&E.attach(r,rs[comp[k]]))comp.push(i);});const tree=search(nodesOf(comp.map(i=>rs[i])));const others=nodesOf(rs.filter((_,i)=>!comp.includes(i)));let end=null;for(const id of others)if(Number.isFinite(tree.dist[id])&&tree.dist[id]>EPS&&(end==null||tree.dist[id]<tree.dist[end]))end=id;if(end==null)return null;rs=simplify(rs.concat(rectangles(path(tree,end)).map(r=>({...r,stub:true}))));}return connected(rs)?rs:null;};
  let net=joinAll(all);if(net)net=linkDoors(net,new Set(nodesOf(net)));if(net)net=joinAll(net);
  if(!net)return {corridors:[],errors:['The moved corridor cannot be joined to the rest of the network or to every core door. Move it closer, or turn a door face toward it.']};
  protect=own;starts.length=0;starts.push({cs:net,label:'kept'});}
 const quick=cs=>packing(cs).net-measure(cs);
 // Connect only: the least corridor that reaches every door. Coverage is offered to the user afterwards (Extend), not decided here.
 if(o.connectOnly&&!o.fixedNetwork){const cs=seeds[0],p=packing(cs),info=analyse(p.g,o,p.units);
  return {corridors:cs,errors:[],report:{strategy:'connect',baselineCorridorArea:measure(cs),baselineUnitArea:p.net,corridorArea:measure(cs),unitArea:p.net,addedCorridorArea:0,gainedUnitArea:0,extensions:[],prunedCorridorArea:0,deadEnds:deadEnds(cs),economicallyRejected:[],rerouted:false,alternatives:[],...info}};}
 if(!o.fixedNetwork&&planned.length&&['double','gallery','point'].includes(o.layoutType)&&!retain.length)starts.length=0;
 if(!o.fixedNetwork)starts.push(...planned.map(cs=>({cs,score:quick(cs)})).sort((a,b)=>b.score-a.score).slice(0,3).map(p=>({cs:p.cs,label:'planned spine'})));

 // Grow a start: coverage branches that pay for themselves, then prune, then trim run ends that serve nothing.
 function* grow(start){let corridors=start.cs,current=packing(corridors);const baseline={corridorArea:measure(corridors),unitArea:current.net},extensions=[];let economicallyRejected=0;
  for(let iteration=0;iteration<(o.quick?2:nodes.length);iteration++){
   yield;
   const corridorUnion=union(corridors),sources=nodes.map((n,i)=>covered(square(n.p),corridorUnion)?i:-1).filter(i=>i>=0),tree=search(sources),seen=new Set(),candidates=[];
   for(let id=0;id<nodes.length;id++){if(id%32===0)yield;if(tree.dist[id]<EPS||!Number.isFinite(tree.dist[id]))continue;const ps=path(tree,id),next=simplify(corridors.concat(rectangles(ps))),signature=JSON.stringify(next);if(seen.has(signature))continue;seen.add(signature);
    const added=measure(next)-measure(corridors);if(added<EPS)continue;const g=geometry(next),potential=area(g.bands.filter(b=>b.eligible).flatMap(b=>b.parts));
    if(potential<=current.net+added)continue;candidates.push({next,added,potential});
   }
   candidates.sort((a,b)=>(b.potential-b.added)-(a.potential-a.added)||a.added-b.added);
   let best=null;
   o.onProgress?.({iteration,candidates:candidates.length,runs:corridors.length,net:current.net,label:start.label});
   let checked=0;for(const candidate of candidates){if(o.quick&&checked>=10)break;if(checked++%8===0)yield;if(best&&candidate.potential-current.net<best.score-EPS)continue;const fit=packing(candidate.next),gain=fit.net-current.net;if(gain<=candidate.added+EPS){economicallyRejected++;continue;}const score=gain;
    if(!best||score>best.score+EPS){best={...candidate,fit,gain,score};}
    else if(Math.abs(score-best.score)<EPS){const ends=deadEnds(candidate.next),bestEnds=best.ends??deadEnds(best.next);best.ends=bestEnds;if(ends<bestEnds||ends===bestEnds&&candidate.added<best.added)best={...candidate,fit,gain,score,ends};}
   }
   if(!best)break;
   corridors=best.next;current=best.fit;extensions.push({corridorArea:best.added,unitArea:best.gain});
  }
  let prunedCorridorArea=0,pruned=true;
  while(pruned){yield;pruned=false;for(let i=0;i<corridors.length;i++){const next=corridors.filter((_,j)=>j!==i);if(start.label==='kept'&&protect.some(r=>!covered(r,union(next))))continue;if(!next.length||!cores.every(c=>root.CORE_LAYOUT.contacts(c,next).length)||!connected(next))continue;
    const saving=measure(corridors)-measure(next);if(saving<EPS)continue;const fit=packing(next);if(fit.net<current.net-EPS)continue;prunedCorridorArea+=saving;corridors=next;current=fit;pruned=true;break;
   }}
  for(let i=0;i<corridors.length;i++)for(const end of ['a','z']){for(let guard=0;guard<40;guard++){const r=corridors[i],horiz=r.axis==='x'||(r.axis==null&&r.w>=r.h),len=horiz?r.w:r.h;if(len-1<cw+EPS)break;const q=horiz?(end==='a'?{...r,x:r.x+1,w:r.w-1}:{...r,w:r.w-1}):(end==='a'?{...r,y:r.y+1,h:r.h-1}:{...r,h:r.h-1});const next=corridors.map((c,j)=>j===i?q:c);if(start.label==='kept'&&protect.some(rr=>!covered(rr,union(next))))break;if(!cores.every(c=>root.CORE_LAYOUT.contacts(c,next).length)||!connected(next))break;const fit=packing(next);if(fit.net<current.net-EPS)break;prunedCorridorArea+=measure(corridors)-measure(next);corridors=next;current=fit;yield;}}
  for(let pass=0;pass<4;pass++){let merged=false;
   for(let i=0;i<corridors.length&&!merged;i++)for(let j=i+1;j<corridors.length&&!merged;j++){const a=corridors[i],b=corridors[j],hz=(a.w>=a.h);if(hz!==(b.w>=b.h))continue;const k=hz?'y':'x',along=hz?'x':'y',size=hz?'w':'h';const off=Math.abs(a[k]-b[k]);if(off<EPS||off>cw+.05)continue;
    const lo=Math.min(a[along],b[along]),hi=Math.max(a[along]+a[size],b[along]+b[size]);if(hi-lo>a[size]+b[size]+cw+EPS)continue;
    for(const pos of [a[k],b[k]]){const run={...a,[k]:pos,[along]:lo,[size]:hi-lo,axis:hz?'x':'y',kind:'circulation'};const rest=corridors.filter((r,n)=>n!==i&&n!==j&&!(E.inside(r,{...run,[k]:Math.min(a[k],b[k]),[hz?'h':'w']:off+cw})));const next=simplify(rest.concat([run]));yield;
     if(!run[size]||!valid(run)||!cores.every(c=>root.CORE_LAYOUT.contacts(c,next).length)||!connected(next))continue;if(start.label==='kept'&&protect.some(rr=>!covered(rr,union(next))))continue;const fit=packing(next);if(fit.net-measure(next)<current.net-measure(corridors)-8)continue; // a straight run is worth up to 8 m² of units
     prunedCorridorArea+=measure(corridors)-measure(next);corridors=next;current=fit;merged=true;break;}}
   if(!merged)break;}
  return {label:start.label,corridors,current,baseline,extensions,prunedCorridorArea,economicallyRejected};}
 if(o.quick){const best=starts.slice().sort((a,b)=>quick(b.cs)-quick(a.cs))[0];starts.length=0;starts.push(best);} // preview: one seed, short growth
 const grown=[];for(const s of starts){if(!connected(s.cs))continue;grown.push(yield* grow(s));}
 for(const g of grown){const route=E.routeGraph(g.current.g,g.current.units),travel=o.travel||30,dead=o.deadEnd||6;g.route=route;g.routePenalty=Math.max(0,(route.max||0)-travel)+Math.max(0,route.deadEnd-dead);}
 grown.sort((a,b)=>a.routePenalty-b.routePenalty||b.current.net-a.current.net||measure(a.corridors)-measure(b.corridors)||a.route.max-b.route.max);
 const win=grown[0];let corridors=win.corridors,current=win.current;const baseline=win.baseline,extensions=win.extensions,prunedCorridorArea=win.prunedCorridorArea,economicallyRejected=win.economicallyRejected;
 const report={baselineCorridorArea:baseline.corridorArea,baselineUnitArea:baseline.unitArea,corridorArea:measure(corridors),unitArea:current.net,addedCorridorArea:measure(corridors)-baseline.corridorArea,gainedUnitArea:current.net-baseline.unitArea,extensions,prunedCorridorArea,deadEnds:deadEnds(corridors),economicallyRejected,strategy:win.label,rerouted:!!retain.length&&win.label!=='kept',alternatives:grown.slice(0,3).map(g=>({label:g.label,corridorArea:measure(g.corridors),unitArea:g.current.net,corridors:g.corridors})),...analyse(current.g,o,current.units)};
 return {corridors,errors:[],report};
}
// Several solves compete on fitted unit area net of corridor: the kept network (if any), a fresh one, and a fresh one scored without end-unit pockets (greedy growth sometimes does better without them; the engine still fills pockets afterwards).
function* compareSteps(input){return yield* routeSteps(input);}
function route(input){const steps=compareSteps(input);let step;do{step=steps.next();}while(!step.done);return step.value;}
async function routeAsync(input){const steps=compareSteps(input);for(;;){const step=steps.next();if(step.done)return step.value;await new Promise(resolve=>setTimeout(resolve,0));}}
root.CORRIDOR_NETWORK={route,routeAsync,bands,analyse,boundaries,exposedEdges,exteriorAvailable};
})(typeof window!=='undefined'?window:globalThis);
/* Apartment planning assumptions and reversible corridor edits. */
(function(root){'use strict';const E=root.EXPLORE,C=()=>root.CORE_LAYOUT;
function type(o){return o.layoutType&&o.layoutType!=='auto'?o.layoutType:Math.min(o.W,o.D)<=14?'gallery':Math.max(o.W,o.D)<=26&&Math.max(o.W,o.D)/Math.min(o.W,o.D)<1.25?'point':'double';}
function seed(o){const t=type(o),vertical=o.axis==='y',W=vertical?o.D:o.W,D=vertical?o.W:o.D,c=o.corridor,sw=o.stairW,sl=o.stairL,ew=o.elevator*(o.lifts===2?2:1),y=t==='gallery'?D-c: D/2-c/2,remote=Math.min(W-sw-.5,Math.max(W*.8-sw/2,W-sw-5)),a=t==='point'?Math.max(.3,(W-9-sw)/2):Math.max(.3,Math.min(5-sw/2,W*.2-sw/2,remote-9)),out=[];
const core=(id,kind,x,w,h)=>({id,kind,x,y:y-h,w,h,rotation:0,doorSide:'bottom',exterior:kind==='stair'&&!!o.exteriorStair});
out.push(core('core-0',o.stair==='scissor'?'scissor':'stair',a,sw,o.stair==='scissor'?Math.max(sl,7.2):sl));if(o.stair!=='one'&&o.stair!=='scissor')out.push(core('core-1','stair',t==='point'?Math.min(remote,a+9):remote,sw,sl));out.push(core('lift','elevator',a+sw+.3,ew,o.elevator));const rs=vertical?out.map(C().swap):out;
if(rs.some(r=>r.x<0||r.y<0||r.x+r.w>o.W||r.y+r.h>o.D||(o.court&&E.overlap(r,o.court)))||rs.some((r,i)=>rs.slice(0,i).some(q=>E.overlap(r,q))))return null;return rs;}
function check(level){const o=level.o,g=level.g,L=level.ledger,route=level.route,warnings=[];if(!g||!L)return {warnings,efficiency:0};const efficiency=L.built?L.net/L.built:0,travel=o.travel||30,dead=o.deadEnd||6,stairs=g.cores.filter(c=>c.kind==='stair'),required=o.stair==='one'?1:2;
if(level.units?.length&&efficiency<.75)warnings.push('Net unit / gross floor area is below the 75–85% study target.');
if(stairs.length<required)warnings.push('The selected arrangement does not provide the required modelled stairs.');
if(route?.paths.some(p=>p.toExits.filter(e=>Number.isFinite(e.distance)).length<required))warnings.push('A unit does not reach all required stairs through circulation.');
if(route?.max>travel)warnings.push('Nearest-stair corridor travel exceeds '+travel+' m.');if(route?.deadEnd>dead)warnings.push('Dead-end corridor exceeds '+dead+' m.');
const points=(route?.exits||[]).filter(e=>e.point).map(e=>e.point),screen=Math.min(9,Math.hypot(o.W,o.D)/2);let separation=null;if(points.length>1){separation=Math.min(...points.flatMap((p,i)=>points.slice(i+1).map(q=>Math.hypot(p[0]-q[0],p[1]-q[1]))));if(separation<screen&&o.stair!=='scissor')warnings.push('Stair doors are less than '+screen.toFixed(1)+' m apart in plan; review exit remoteness.');}
if(o.stair==='one')warnings.push('Single-stair eligibility is not established by this study.');return {efficiency,warnings,travelLimit:travel,deadEndLimit:dead,separation,screen};}
function move(o,index,delta){const input=JSON.parse(JSON.stringify(o)),rs=input.freeCorridors||[],r=rs[index];if(!r)return null;const h=r.w>=r.h,k=h?'y':'x',size=h?'h':'w',old={...r},d=Math.round(delta*10)/10;r[k]+=d;delete r.stub; // a run the user moves is theirs
// Follow the moved run with attached cores; stretch cross-runs at their junction.
/* cores stay where the user placed them; doors are relinked to the moved run afterwards */
for(let i=0;i<rs.length;i++){const q=rs[i];if(i===index||!E.attach(q,old)||(q.w>=q.h)===h)continue;const center=old[k]+old[size]/2,start=q[k],end=start+q[size];if(Math.abs(start-center)<o.corridor+.01){q[k]+=d;q[size]-=d;}else if(Math.abs(end-center)<o.corridor+.01)q[size]+=d;else if(center>=start&&center<=end){if(r[k]<start){q[size]+=start-r[k];q[k]=r[k];}if(r[k]+r[size]>q[k]+q[size])q[size]=r[k]+r[size]-q[k];}}
// a cross-run squeezed below one corridor width is dropped rather than blocking the move; the relink lays fresh door links
input.freeCorridors=rs.filter((q,i)=>i===index||(q.w>=o.corridor-.001&&q.h>=o.corridor-.001));input.autoFit=false;input.autoSize=false;delete input.slices;delete input.corridorReport;return input;}
root.APARTMENT_PLAN={type,seed,check,move};
})(typeof window!=='undefined'?window:globalThis);
