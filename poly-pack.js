/* Bounded polygon-strip planning: connected orthogonal units, actual door intervals,
   reusable wall offsets and corridor-tail recovery. No room-level compliance claim. */
(function(root){'use strict';const E=root.EXPLORE,F=root.FLOOR_DESIGN,R=E.rect,EPS=1e-5;
const parts=u=>u.parts||[u,...(u.patches||[])],nets=u=>u.netParts||[u.netRect,...(u.netPatches||[])],sum=rs=>rs.reduce((s,r)=>s+E.area(r),0);
// Schematic shape screen, not a room-fit claim. Reject long residual strips and sparse wrapping shapes.
function compactShape(rs){if(!rs.length)return false;const w=Math.max(...rs.map(r=>r.x+r.w))-Math.min(...rs.map(r=>r.x)),h=Math.max(...rs.map(r=>r.y+r.h))-Math.min(...rs.map(r=>r.y));return Math.min(w,h)>EPS&&Math.max(w,h)<=3*Math.min(w,h)+EPS&&sum(rs)>=.6*w*h-EPS;}
function free(rs,blocks){for(const b of blocks)rs=rs.flatMap(r=>F.subtract(r,b));return rs;}
const at=(rs,x,y)=>rs.some(r=>x>r.x-EPS&&x<r.x+r.w+EPS&&y>r.y-EPS&&y<r.y+r.h+EPS);
function connected(rs,min=.8){if(!rs.length)return false;const seen=new Set([0]);for(let n=0;n<rs.length;n++)rs.forEach((a,i)=>{if([...seen].some(j=>{const b=rs[j],x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);return (x>=min&&y>=-EPS)||(y>=min&&x>=-EPS);}))seen.add(i);});return seen.size===rs.length;}
function netShape(rs,g,o){let out=rs.map(r=>({...r}));const xs=[...new Set(rs.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b),ys=[...new Set(rs.flatMap(r=>[r.y,r.y+r.h]))].sort((a,b)=>a-b),cuts=[];
 const thickness=(x,y)=>at(g.cores.concat(o.exclusions),x,y)?0:at(g.corridors,x,y)?(o.corridorWall||.2):!at(g.built,x,y)?o.wall:o.party/2;
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){const x=xs[i-1],y=ys[j-1],w=xs[i]-x,h=ys[j]-y;if(!at(rs,x+w/2,y+h/2))continue;
 for(const side of ['left','right','top','bottom']){const xx=side==='left'?x-.001:side==='right'?x+w+.001:x+w/2,yy=side==='top'?y-.001:side==='bottom'?y+h+.001:y+h/2;if(at(rs,xx,yy))continue;const d=thickness(xx,yy);if(!d)continue;cuts.push(side==='left'?R(x,y,d,h):side==='right'?R(x+w-d,y,d,h):side==='top'?R(x,y,w,d):R(x,y+h-d,w,d));}}
 return free(out,cuts);
}
function contacts(rs,cs){const out=[];for(const r of rs)for(const c of cs){for(const [entry,v,a,b] of [['top',r.y,Math.max(r.x,c.x),Math.min(r.x+r.w,c.x+c.w)],['bottom',r.y+r.h,Math.max(r.x,c.x),Math.min(r.x+r.w,c.x+c.w)],['left',r.x,Math.max(r.y,c.y),Math.min(r.y+r.h,c.y+c.h)],['right',r.x+r.w,Math.max(r.y,c.y),Math.min(r.y+r.h,c.y+c.h)]]){const edge=entry==='top'?c.y+c.h:entry==='bottom'?c.y:entry==='left'?c.x+c.w:c.x;if(Math.abs(v-edge)<EPS&&b-a>=1.2)out.push({entry,v,a,b});}}return out.sort((a,b)=>(b.b-b.a)-(a.b-a.a));}
// Window frontage: the longest run of the band's window face. With g, a part edge stepped back from that face by up to 3 m (the
// back of an entry recess) counts too, when nothing built lies in front of it.
function frontage(rs,b,g){const side=b.windowSide|| (b.face==='court'?b.entry:b.face==='front'?'top':b.face==='rear'?'bottom':b.face),h=side==='top'||side==='bottom',segments=[];
 // the parts of an edge with nothing built directly in front of it
 const open=(e,a,z,out)=>{let iv=[[a,z]];for(const q of g.built){const inFront=h?(out<0?q.y<e-.005&&q.y+q.h>=e-.005:q.y<=e+.005&&q.y+q.h>e+.005):(out<0?q.x<e-.005&&q.x+q.w>=e-.005:q.x<=e+.005&&q.x+q.w>e+.005);if(!inFront)continue;const lo=h?q.x:q.y,hi=lo+(h?q.w:q.h);iv=iv.flatMap(([p,t])=>hi<=p||lo>=t?[[p,t]]:[[p,lo],[hi,t]].filter(([m,n])=>n-m>EPS));}return iv;};
 for(const r of rs){const out=side==='top'||side==='left'?-1:1,e=h?(out<0?r.y:r.y+r.h):(out<0?r.x:r.x+r.w),f=h?(out<0?b.y:b.y+b.h):(out<0?b.x:b.x+b.w),a=h?r.x:r.y,z=a+(h?r.w:r.h);
  if(Math.abs(e-f)<EPS)segments.push([a,z]);else if(g&&Math.abs(e-f)<=3.05)segments.push(...open(e,a,z,out));}
 segments.sort((a,b)=>a[0]-b[0]);let best=0,start=0,end=-Infinity;for(const [a,z]of segments){if(a>end+EPS){start=a;end=z;}else end=Math.max(end,z);best=Math.max(best,end-start);}return best-(b.face==='court'?.9:0);}
// manual: a user-drawn interval keeps its unit even outside the type ranges; the nearest type by target area is assigned and the range gap is flagged upstream.
function candidate(b,a,z,g,o,manual){const region=b.axis==='x'?R(a,b.y,z-a,b.h):R(b.x,a,b.w,z-a),rs=free(b.parts?b.parts.map(p=>E.intersection(p,region)).filter(p=>E.area(p)>EPS):[region],g.cores.concat(g.corridors,o.exclusions,g.cuts||[]));if(!rs.length||!connected(rs)||(!manual&&!compactShape(rs)))return null;if(!manual&&(sum(rs)<Math.min(...o.types.filter(t=>t.share>0).map(t=>t.min))||frontage(rs,b,g)<Math.max(o.minWidth,Math.min(...o.types.filter(t=>t.share>0).map(t=>t.frontage)))-EPS))return null;const ns=netShape(rs,g,o),net=sum(ns);if(!ns.length||!connected(ns)||(!manual&&net<Math.min(...o.types.filter(t=>t.share>0).map(t=>t.min))))return null;const doors=contacts(rs,g.corridors);if(!doors.length)return null;const width=frontage(rs,b,g),choices=manual?o.types:o.types.filter(t=>t.share>0&&net>=t.min-EPS&&net<=t.max+EPS&&width>=Math.max(o.minWidth,t.frontage)-EPS);if(!choices.length)return null;
 const gap=t=>Math.max(t.min-net,net-t.max,0),t=choices.slice().sort((a,b)=>gap(a)-gap(b)||Math.abs(net-a.target)-Math.abs(net-b.target))[0],d=doors[0],mid=(d.a+d.b)/2,door=['top','bottom'].includes(d.entry)?[mid,d.v]:[d.v,mid];return {...region,a,z,parts:rs,netParts:ns,netRect:ns.reduce((a,b)=>E.area(a)>E.area(b)?a:b),net,type:t.key,beds:t.beds,kind:'unit',entry:d.entry,face:b.face,windowSide:b.windowSide||(b.face==='court'?b.entry:({front:'top',rear:'bottom'}[b.face]||b.face)),door,frontage:width,manual:!!manual||undefined};
}
// Units from user-set wall positions along a band. Intervals narrower than the minimum width, or left with under half the
// smallest type's area once cores and corridors are taken out, stay unallocated.
function manualBand(b,cuts,g,o){const start=b.axis==='x'?b.x:b.y,end=start+(b.axis==='x'?b.w:b.h),xs=[...new Set([start,end,...cuts.filter(p=>p>start+EPS&&p<end-EPS)])].sort((p,q)=>p-q),units=[];for(let i=1;i<xs.length;i++){if(xs[i]-xs[i-1]<o.minWidth-EPS)continue;const u=candidate(b,xs[i-1],xs[i],g,o,true);if(u&&u.net>=.5*Math.min(...o.types.map(t=>t.min)))units.push(u);}return units;}
function bandFit(b,g,o){if(!b.eligible||Math.min(b.w,b.h)<2||(b.axis==='x'?b.h:b.w)>o.maxDepth+.001)return [];
 const start=b.axis==='x'?b.x:b.y,end=start+(b.axis==='x'?b.w:b.h),axis=b.axis;
 const grid=Number.isFinite(o.planningGrid)?Math.max(.3,o.planningGrid):.6,points=[start,end];for(let x=Math.ceil((start+.001)/grid)*grid;x<end;x+=grid)points.push(+x.toFixed(6));for(const r of g.cores)points.push(Math.max(start,Math.min(end,axis==='x'?r.x:r.y)),Math.max(start,Math.min(end,axis==='x'?r.x+r.w:r.y+r.h)));for(const c of g.cores){points.push(Math.max(start,Math.min(end,axis==='x'?c.x+c.w/2:c.y+c.h/2)));}const xs=[...new Set(points)].sort((a,b)=>a-b),states=xs.map(()=>null);states[0]={units:[],score:0};let best=states[0];
 for(let j=1;j<xs.length;j++){if(states[j-1]){const sl=axis==='x'?R(xs[j-1],b.y,xs[j]-xs[j-1],b.h):R(b.x,xs[j-1],b.w,xs[j]-xs[j-1]),unused=sum(free(b.parts?b.parts.map(p=>E.intersection(p,sl)).filter(p=>E.area(p)>EPS):[sl],g.cores.concat(g.corridors,o.exclusions,g.cuts||[])));states[j]={units:states[j-1].units,score:states[j-1].score-unused*.3};}for(let i=0;i<j;i++){if(!states[i]||xs[j]-xs[i]<o.minWidth)continue;const u=candidate(b,xs[i],xs[j],g,o);if(!u)continue;const prev=states[i],units=prev.units.concat(u),mix=o.types.reduce((s,t)=>s+Math.abs(units.filter(u=>u.type===t.key).length/units.length-t.share/100),0),oldMix=prev.units.length?o.types.reduce((s,t)=>s+Math.abs(prev.units.filter(u=>u.type===t.key).length/prev.units.length-t.share/100),0):0,score=prev.score+u.net+(u.beds>=2&&faceCount(u.parts,g)>=2?3:0)+(o.objective==='units'?10:2)-(o.objective==='mix'?10:3)*(mix-oldMix);if(!states[j]||score>states[j].score)states[j]={units,score};}if(states[j]&&states[j].score>best.score)best=states[j];}
 return best.units;
}
const cache=new Map();
// Allow a bounded depth overrun to close residual strips, not to seed deeper units.
// Unlike adding a skinny annex, this moves a boundary; recompute walls on the complete union.
function closeGaps(g,units,o){if(o.absorb===false||!units.length||o.slices?.[o.level])return;
 const allowance=Math.max(0,Math.min(1.2,o.depthTolerance??.6));if(!allowance)return;
 const merge=rs=>{const out=rs.map(r=>R(r.x,r.y,r.w,r.h));for(let changed=true;changed;){changed=false;outer:for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){const a=out[i],b=out[j],h=Math.abs(a.y-b.y)<EPS&&Math.abs(a.h-b.h)<EPS&&(Math.abs(a.x+a.w-b.x)<EPS||Math.abs(b.x+b.w-a.x)<EPS),v=Math.abs(a.x-b.x)<EPS&&Math.abs(a.w-b.w)<EPS&&(Math.abs(a.y+a.h-b.y)<EPS||Math.abs(b.y+b.h-a.y)<EPS);if(!h&&!v)continue;out[i]=R(Math.min(a.x,b.x),Math.min(a.y,b.y),h?a.w+b.w:a.w,v?a.h+b.h:a.h);out.splice(j,1);changed=true;break outer;}}return out;};
 for(let pass=0;pass<32;pass++){
  const gaps=merge(free(g.built,g.cores.concat(g.corridors,g.voids||[],g.cuts||[],o.exclusions||[],units.flatMap(parts)))).filter(r=>Math.min(r.w,r.h)<=allowance+EPS&&Math.min(r.w,r.h)>EPS);
  let best=null;
  for(const gap of gaps)for(const u of units){if(u.manual||u.edited)continue;
   // Clip the strip to this unit's adjoining frontage, merging compound pieces first.
   const vertical=gap.w<gap.h,adjacent=merge(parts(u)),slices=merge(adjacent.flatMap(p=>{const touches=vertical?Math.abs(p.x+p.w-gap.x)<EPS||Math.abs(gap.x+gap.w-p.x)<EPS:Math.abs(p.y+p.h-gap.y)<EPS||Math.abs(gap.y+gap.h-p.y)<EPS;if(!touches)return [];const a=Math.max(vertical?gap.y:gap.x,vertical?p.y:p.x),z=Math.min(vertical?gap.y+gap.h:gap.x+gap.w,vertical?p.y+p.h:p.x+p.w);return z>a+EPS?[vertical?R(gap.x,a,gap.w,z-a):R(a,gap.y,z-a,gap.h)]:[];}));
   for(const r of slices){
   const widening=adjacent.some(p=>r.w<=allowance+EPS&&r.h>=p.h*.5-EPS&&r.y>=p.y-EPS&&r.y+r.h<=p.y+p.h+EPS&&(Math.abs(p.x+p.w-r.x)<EPS||Math.abs(r.x+r.w-p.x)<EPS)||r.h<=allowance+EPS&&r.w>=p.w*.5-EPS&&r.x>=p.x-EPS&&r.x+r.w<=p.x+p.w+EPS&&(Math.abs(p.y+p.h-r.y)<EPS||Math.abs(r.y+r.h-p.y)<EPS));
   if(!widening)continue;const ps=merge(parts(u).concat(r));if(!compactShape(ps))continue;
   // Reaching the facade replaces a party-wall allowance with the exterior wall;
   // net area can decrease slightly even though the occupied footprint grows.
   const ns=netShape(ps,g,o),net=sum(ns);if(!connected(ns))continue;
   const types=o.types.filter(t=>t.share>0&&net>=t.min-EPS&&net<=t.max+EPS&&(u.frontage||0)>=Math.max(o.minWidth,t.frontage)-EPS),cur=o.types.find(t=>t.key===u.type),stretch=!types.length&&cur&&net<=cur.max*1.05+EPS,type=types.find(t=>t.key===u.type)||types.sort((a,b)=>Math.abs(net-a.target)-Math.abs(net-b.target))[0]||(stretch?cur:null);if(!type)continue; // a gap may push a unit up to 5% past its type rather than stay a gap
   const x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y)),q={...u,...R(x,y,Math.max(...ps.map(p=>p.x+p.w))-x,Math.max(...ps.map(p=>p.y+p.h))-y),kind:'unit',parts:ps,netParts:ns,netRect:ns.reduce((a,b)=>E.area(a)>E.area(b)?a:b),net,type:type.key,beds:type.beds,patches:undefined,netPatches:undefined,absorbed:true,stretched:!!stretch||u.stretched};
   if(!best||E.area(r)>best.area+EPS)best={index:units.indexOf(u),unit:q,area:E.area(r)};
   }
  }
  if(!best)break;units[best.index]=best.unit;
 }
}
function cachedBand(b,g,o){const near=R(b.x-.01,b.y-.01,b.w+.02,b.h+.02),local={...g,cores:g.cores.filter(r=>E.overlap(r,near)),corridors:g.corridors.filter(r=>E.overlap(r,near))};const key=JSON.stringify([b,g.built,local.cores,local.corridors,o.exclusions,o.types,o.wall,o.party,o.corridorWall,o.minWidth,o.maxDepth,o.objective,o.planningGrid]);if(cache.has(key))return JSON.parse(cache.get(key));const units=bandFit(b,local,o);cache.set(key,JSON.stringify(units));if(cache.size>500)cache.delete(cache.keys().next().value);return units;}
// Compare bounded corridor-end changes with a complete unit refit. Keep cores fixed.
function shortSpine(g,o,baseline){
 if(!o.shortSpine||o.typology!=='bar'||g.corridors.length!==1||g.bands.length!==2||g.built.length!==1)return baseline;
 const original=g.corridors[0],bands=g.bands.map(b=>({...b}));
 if(bands.some(b=>b.axis!=='x'||Math.abs(b.x-original.x)>EPS||Math.abs(b.w-original.w)>EPS))return baseline;
 const score=us=>{const n=us.length,net=us.reduce((s,u)=>s+u.net,0),mix=o.types.reduce((s,t)=>s+Math.abs(us.filter(u=>u.type===t.key).length/Math.max(1,n)-t.share/100),0);return net+(o.objective==='units'?10:2)*n-(o.objective==='mix'?10:3)*mix;};
 let best=baseline,bestScore=score(best),chosen=null;
 // Lengths are search samples, not clearance requirements.
 for(const side of ['left','right'])for(const length of [1,1.5,2,3,4])for(const recipient of [0,1]){
  if(original.w-length<o.corridor)continue;
  const c={...original,x:original.x+(side==='left'?length:0),w:original.w-length};
  // Preserve a usable shared boundary to each core and any previously connected service room.
  if(g.cores.concat(o.exclusions.filter(r=>contacts([r],[original]).length)).some(r=>!contacts([r],[c]).length))continue;
  const trial={...g,corridors:[c],bands:bands.map(b=>({...b}))},b=trial.bands[recipient];
  if(b.entry==='bottom')b.h+=original.h;else{b.y-=original.h;b.h+=original.h;}
  const us=trial.bands.flatMap(b=>cachedBand(b,trial,o));
  if(E.validate(trial,us,o).length||(o.coreLayout&&root.CORE_LAYOUT?.validate(trial,o).length))continue;
  const nextScore=score(us);if(nextScore>bestScore+.01){bestScore=nextScore;best=us;chosen=trial;}
 }
 if(chosen){g.corridors=chosen.corridors;g.bands=chosen.bands;g.notes.push('Short-spine study: a corridor end was reassigned to a wrapping dwelling after refitting units and preserving core/service connections. Fixed cores and gross floor area are unchanged; room layouts and egress compliance remain unverified.');}
 else g.notes.push('Short-spine study: no tested corridor-end change improved the unit-layout score while preserving connections. This bounded search is not proof that no better plan exists.');
 return best;
}
function refine(g,units,o){if(!o.floorDesign)return;let proposed=g.bands.flatMap((b,i)=>{const cuts=o.slices?.[o.level]?.[i];return (cuts?manualBand(b,cuts,g,o):cachedBand(b,g,o)).map(u=>({...u,band:i}));});proposed=shortSpine(g,o,proposed);units.splice(0,units.length,...proposed);units.forEach((u,i)=>{u.id=i+1;u.end=!!g.bands[u.band]?.end;const sides=new Set();for(const f of root.CORRIDOR_NETWORK?.boundaries(g.built,o)||[]){if(!f.eligible)continue;for(const r of parts(u)){const h=f.side==='top'||f.side==='bottom',edge=f.side==='top'?r.y:f.side==='bottom'?r.y+r.h:f.side==='left'?r.x:r.x+r.w,lo=h?r.x:r.y,hi=lo+(h?r.w:r.h);if(Math.abs(edge-f.v)<EPS&&Math.min(hi,f.z)-Math.max(lo,f.a)>1.2)sides.add(f.side);}}u.corner=sides.size>=2;});}

function recover(g,o){if(!o.floorDesign||o.recoverTails===false||!['court','u'].includes(o.typology))return;for(const b of g.bands.filter(b=>b.axis==='y'))for(const end of ['top','bottom']){const y=end==='top'?b.y-o.corridor:b.y+b.h,c=g.corridors.find(c=>Math.abs(c.y-y)<EPS&&c.w>c.h&&c.x<=b.x+EPS&&c.x+c.w>=b.x+b.w-EPS);if(!c)continue;const tail=R(b.x,y,b.w,c.h);if(g.cores.some(k=>E.attach(k,tail))||o.exclusions.some(k=>E.overlap(k,tail)))continue;const remains=F.subtract(c,tail);if(!remains.length)continue;g.corridors.splice(g.corridors.indexOf(c),1,...remains);if(end==='top')b.y-=tail.h;b.h+=tail.h;g.notes.push('Unused gallery end reclaimed for a unit; doors are reselected on the retained corridor.');}}
// ---------- Hand edits that do not depend on strips ----------
// o.unitEdits[level] is a list replayed after packing: {op:'cut',p,axis,v} splits the unit holding point p along the line
// axis = v ('x': a wall at x = v); {op:'join',a,b} merges the units holding points a and b when they share a wall. Points,
// not ids, so an edit survives a refit that renumbers units; an edit that no longer fits is skipped and listed in g.editIssues.
const holds=(u,p)=>parts(u).some(r=>p[0]>r.x+EPS&&p[0]<r.x+r.w-EPS&&p[1]>r.y+EPS&&p[1]<r.y+r.h-EPS);
const shared=(p,q)=>{let s=0;for(const a of parts(p))for(const b of parts(q)){const x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(Math.abs(x)<EPS&&y>0)s+=y;else if(Math.abs(y)<EPS&&x>0)s+=x;}return s;};
// Longest stretch of edge with nothing built in front of it: the window run.
// Number of plan sides with at least 2.4 m of open window run: 2 or more is a corner unit.
function faceCount(rs,g){return ['top','bottom','left','right'].filter(side=>exposedSide(rs,g,side)>=2.4-EPS).length;}
function exposed(rs,g){return Math.max(...['top','bottom','left','right'].map(side=>exposedSide(rs,g,side)));}
function exposedSide(rs,g,side){let best=0;{const h=side==='top'||side==='bottom';let run=0;
 for(const r of rs){const e=side==='top'?r.y:side==='bottom'?r.y+r.h:side==='left'?r.x:r.x+r.w,out=side==='top'||side==='left'?-.01:.01,a=h?r.x:r.y,z=a+(h?r.w:r.h);let iv=[[a,z]];
  for(const q of g.built.concat(g.cores,g.corridors)){const inFront=h?e+out>q.y&&e+out<q.y+q.h:e+out>q.x&&e+out<q.x+q.w;if(!inFront)continue;const lo=h?q.x:q.y,hi=lo+(h?q.w:q.h);iv=iv.flatMap(([p,t])=>hi<=p||lo>=t?[[p,t]]:[[p,lo],[hi,t]].filter(([m,n])=>n-m>EPS));}
  run+=iv.reduce((s,[p,t])=>s+t-p,0);}best=Math.max(best,run);}return best;}
function unitFrom(rs,base,g,o){const ns=netShape(rs,g,o),net=sum(ns),doors=contacts(rs,g.corridors),types=o.types.filter(t=>t.share>0),pool=types.length?types:o.types;if(!ns.length||!doors.length)return null;
 const gap=t=>Math.max(t.min-net,net-t.max,0),t=pool.slice().sort((a,b)=>gap(a)-gap(b)||Math.abs(net-a.target)-Math.abs(net-b.target))[0],d=doors[0],mid=(d.a+d.b)/2;
 const x0=Math.min(...rs.map(r=>r.x)),y0=Math.min(...rs.map(r=>r.y)),x1=Math.max(...rs.map(r=>r.x+r.w)),y1=Math.max(...rs.map(r=>r.y+r.h));
 return {...base,...R(x0,y0,x1-x0,y1-y0),kind:'unit',parts:rs,netParts:ns,netRect:ns.reduce((a,b)=>E.area(a)>E.area(b)?a:b),patches:undefined,netPatches:undefined,net,type:t.key,beds:t.beds,entry:d.entry,door:['top','bottom'].includes(d.entry)?[mid,d.v]:[d.v,mid],band:null,manual:true,edited:true};}
// Both halves of a cut must stay connected, hold the smallest unit type, keep a corridor door and a window run.
function halves(u,axis,v,g,o){const lo=[],hi=[];for(const r of parts(u)){const a=axis==='x'?r.x:r.y,z=a+(axis==='x'?r.w:r.h);
  if(v>a+EPS&&v<z-EPS){lo.push(axis==='x'?R(r.x,r.y,v-r.x,r.h):R(r.x,r.y,r.w,v-r.y));hi.push(axis==='x'?R(v,r.y,r.x+r.w-v,r.h):R(r.x,v,r.w,r.y+r.h-v));}else(z<=v+EPS?lo:hi).push({...r});}
 const types=o.types.filter(t=>t.share>0),min=Math.min(...(types.length?types:o.types).map(t=>t.min)),front=Math.max(o.minWidth||0,Math.min(...(types.length?types:o.types).map(t=>t.frontage)));
 const good=rs=>rs.length&&connected(rs)&&sum(netShape(rs,g,o))>=min-EPS&&contacts(rs,g.corridors).length&&exposed(rs,g)>=front-EPS;
 return good(lo)&&good(hi)?[lo,hi]:null;}
// The most even straight cut (either direction, 0.1 m steps outward from the middle) that leaves two workable units.
function splitLine(u,g,o){const ps=parts(u),x0=Math.min(...ps.map(r=>r.x)),y0=Math.min(...ps.map(r=>r.y)),x1=Math.max(...ps.map(r=>r.x+r.w)),y1=Math.max(...ps.map(r=>r.y+r.h)),out=[];
 for(const [axis,a,z] of [['x',x0,x1],['y',y0,y1]])for(let v=Math.round((a+(o.minWidth||3))*10)/10;v<=z-(o.minWidth||3)+EPS;v=Math.round((v+.1)*10)/10){const hs=halves(u,axis,v,g,o);if(hs)out.push({axis,v,odd:Math.abs(sum(hs[0])-sum(hs[1]))});}
 return out.sort((p,q)=>p.odd-q.odd)[0]||null;}
function edits(g,units,o){const list=o.unitEdits?.[o.level];if(!list?.length)return;g.editIssues=[];
 list.forEach((e,i)=>{if(e.op==='cut'){const k=units.findIndex(u=>holds(u,e.p));const hs=k<0?null:halves(units[k],e.axis,e.v,g,o),pair=hs&&hs.map(rs=>unitFrom(rs,units[k],g,o));
   if(!pair||pair.some(q=>!q)){g.editIssues.push(i);return;}const [p,q]=pair,side=e.axis==='x'?[Math.max(p.y,q.y),Math.min(p.y+p.h,q.y+q.h)]:[Math.max(p.x,q.x),Math.min(p.x+p.w,q.x+q.w)];pair.forEach(u=>u.cut={edit:i,axis:e.axis,v:e.v,side});units.splice(k,1,...pair);}
  // retype: a unit whose area sits in the overlap of two type ranges takes the other type (a large 2-bed planned as a 3-bed)
  else if(e.op==='type'){const k=units.findIndex(u=>holds(u,e.p)),t=(o.types||[]).find(t=>t.key===e.key);if(k<0||!t||!(units[k].net>=t.min-EPS&&units[k].net<=t.max+EPS)){g.editIssues.push(i);return;}units[k]={...units[k],type:t.key,beds:t.beds};}
  else if(e.op==='join'){const k=units.findIndex(u=>holds(u,e.a)),m=units.findIndex(u=>holds(u,e.b));if(k<0||m<0||k===m||shared(units[k],units[m])<1.2-EPS){g.editIssues.push(i);return;}
   const u=unitFrom(parts(units[k]).concat(parts(units[m])),{...units[k],cut:undefined},g,o);if(!u){g.editIssues.push(i);return;}units.splice(Math.max(k,m),1);units.splice(Math.min(k,m),1,u);}});
 units.forEach((u,i)=>{u.id=i+1;});}
root.POLY_PACK={closeGaps,compactShape,edits,splitLine,shared,parts,nets,free,connected,netShape,contacts,refine,recover};
})(typeof window!=='undefined'?window:globalThis);
