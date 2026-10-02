/* Exposed surfaces of an orthogonal solid, ordered with an axis-aligned BSP. */
(function(root){'use strict';
const EPS=1e-6;
function surfaces(boxes){
 const coords=[0,1,2].map(a=>[...new Set(boxes.flatMap(b=>[b.lo[a],b.hi[a]]))].sort((a,b)=>a-b)),groups=new Map();
 const occupied=p=>boxes.find(b=>p.every((v,a)=>v>b.lo[a]-EPS&&v<b.hi[a]+EPS));
 for(let i=1;i<coords[0].length;i++)for(let j=1;j<coords[1].length;j++)for(let k=1;k<coords[2].length;k++){
  const ix=[i,j,k],lo=ix.map((v,a)=>coords[a][v-1]),hi=ix.map((v,a)=>coords[a][v]),mid=lo.map((v,a)=>(v+hi[a])/2),box=occupied(mid);if(!box)continue;
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const at=sign<0?lo[axis]:hi[axis],probe=mid.slice();probe[axis]=at+sign*.0001;if(occupied(probe))continue;
   const axes=[0,1,2].filter(a=>a!==axis),fill=axis===2?box.top:box.side||(['#e3e5e8','#eef0f2'][axis]),key=JSON.stringify([axis,sign,at,fill,box.level]);
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push({x:lo[axes[0]],y:lo[axes[1]],w:hi[axes[0]]-lo[axes[0]],h:hi[axes[1]]-lo[axes[1]]});
  }
 }
 const out=[];
 for(const [key,parts]of groups){let changed=true;while(changed){changed=false;outer:for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
   const a=parts[i],b=parts[j],same=(x,y)=>Math.abs(x-y)<EPS;
   if(same(a.x,b.x)&&same(a.w,b.w)&&(same(a.y+a.h,b.y)||same(b.y+b.h,a.y))){a.y=Math.min(a.y,b.y);a.h+=b.h;parts.splice(j,1);changed=true;break outer;}
   if(same(a.y,b.y)&&same(a.h,b.h)&&(same(a.x+a.w,b.x)||same(b.x+b.w,a.x))){a.x=Math.min(a.x,b.x);a.w+=b.w;parts.splice(j,1);changed=true;break outer;}
  }}
  const [axis,sign,at,fill,level]=JSON.parse(key),axes=[0,1,2].filter(a=>a!==axis);
  for(const r of parts)out.push({axis,sign,at,fill,level,points:[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]].map(p=>{const q=[];q[axis]=at;q[axes[0]]=p[0];q[axes[1]]=p[1];return q;})});
 }
 return out;
}
// A face is on an axis plane (axis, at) or, for surroundings, on a general plane (n, d) with n·p = d.
const normal=f=>f.n||[0,1,2].map(a=>a===f.axis?1:0),offsetOf=f=>f.n?f.d:f.at;
function order(faces,eye){
 if(!faces.length)return [];
 const plane=faces[0],front=[],back=[],same=[],N=normal(plane),d0=offsetOf(plane),dist=p=>N[0]*p[0]+N[1]*p[1]+N[2]*p[2]-d0;
 for(const f of faces){const ds=f.points.map(dist);if(ds.every(d=>Math.abs(d)<EPS)){same.push(f);continue;}if(ds.every(d=>d>=-EPS)){front.push(f);continue;}if(ds.every(d=>d<=EPS)){back.push(f);continue;}
  const split=sign=>{const points=[];for(let i=0;i<f.points.length;i++){const p=f.points[i],q=f.points[(i+1)%f.points.length],a=dist(p)*sign,b=dist(q)*sign;if(a>=-EPS)points.push(p);if((a>EPS&&b<-EPS)||(a<-EPS&&b>EPS)){const t=a/(a-b);points.push(p.map((v,j)=>v+(q[j]-v)*t));}}return {...f,points};};front.push(split(1));back.push(split(-1));
 }
 return N[0]*eye[0]+N[1]*eye[1]+N[2]*eye[2]>=0?[...order(back,eye),...same,...order(front,eye)]:[...order(front,eye),...same,...order(back,eye)];
}
root.MASSING_SURFACES={surfaces,order};
})(typeof window!=='undefined'?window:globalThis);

/* SVG drawing views share the generated rectangles and a common plan scale. */
(function(root){'use strict';
const ink='#111417',colors={S:'#ffffff','1B':'url(#h1)','2B':'url(#h2)','3B':'url(#h3)'},f=n=>Number(n).toFixed(2),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rect=(r,attr='')=>`<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" ${attr}/>`;
const filledShape=(rs,fill)=>`<path d="${rs.map(r=>`M${f(r.x)} ${f(r.y)}h${f(r.w)}v${f(r.h)}h${f(-r.w)}Z`).join(' ')}" fill="${fill}" stroke="none"/>`;
const text=(x,y,s,size=1,attr='')=>`<text x="${f(x)}" y="${f(y)}" font-size="${size}" ${attr}>${esc(s)}</text>`;
const line=(x,y,xx,yy,attr='')=>`<path d="M${f(x)},${f(y)} L${f(xx)},${f(yy)}" fill="none" ${attr}/>`;
// Annotation sizes are sheet units, independent of model metres and site extents.
// Annotation sizes are sheet units, independent of the model-to-sheet scale.
const annotation={size:11,leading:15,ink:'#3d434b'};
const labelWidth=s=>[...String(s)].reduce((w,c)=>w+(/[MW@]/.test(c)?.88:/[il1 .,:/]/.test(c)?.28:.56)*annotation.size,0);
// a label's sheet size; sub: points off the lines under the first (a unit reads number, then type and area 2 pt smaller)
const labelSize=(lines,sub=0)=>({width:Math.max(...lines.map((s,i)=>labelWidth(s)*(i&&sub?(annotation.size-sub)/annotation.size:1)))+8,height:lines.length*annotation.leading-(sub?(lines.length-1)*sub:0)});
function sheetLabel(x,y,lines,attr='',sub=0){const {width,height}=labelSize(lines,sub),lead=annotation.leading-sub;
 return `<g data-annotation="true" data-label-box="${[x-width/2,y-height/2,width,height].map(f).join(' ')}" transform="translate(${f(x)} ${f(y)})" pointer-events="none"><rect x="${f(-width/2)}" y="${f(-height/2)}" width="${f(width)}" height="${height}" fill="#ffffff" fill-opacity=".94" stroke="none"/>${lines.map((s,i)=>text(0,(i-(lines.length-1)/2)*lead+3.7,s,i?annotation.size-sub:annotation.size,`text-anchor="middle" fill="${i?'#59616b':annotation.ink}" stroke="none" ${i?'':'font-weight="500"'} ${attr}`)).join('')}</g>`;}
// One schematic opening schedule drives both plan symbols and massing glazing.
function windows(r){
 if(!r.g||!root.CORRIDOR_NETWORK)return [];
 let solid=r.g.built;for(const q of r.g.corridors.concat(r.g.cores).filter(q=>q.exterior))solid=solid.flatMap(b=>root.FLOOR_DESIGN.subtract(b,q));
 const options={...r.o,edges:{front:true,rear:true,left:true,right:true,...r.o.edges}},facades=root.CORRIDOR_NETWORK.boundaries(solid,options).filter(e=>e.eligible),out=[];
 const cut=(spans,lo,hi)=>spans.flatMap(([a,z])=>hi<=a||lo>=z?[[a,z]]:[[a,Math.max(a,lo)],[Math.min(z,hi),z]].filter(([a,z])=>z-a>.01));
 for(const u of r.units||[]){
  const main=u.face==='court'?(u.windowSide||u.entry):{front:'top',rear:'bottom',left:'left',right:'right'}[u.face],candidates=[];
  for(const edge of root.CORRIDOR_NETWORK.boundaries(u.parts||[u,...(u.patches||[])],options))for(const face of facades){
   if(edge.side!==face.side||Math.abs(edge.v-face.v)>.01)continue;
   let spans=[[Math.max(edge.a,face.a)+.6,Math.min(edge.z,face.z)-.6]];
   if(u.entry===edge.side&&u.door&&Math.abs(u.door[['top','bottom'].includes(edge.side)?1:0]-edge.v)<.05){const at=u.door[['top','bottom'].includes(edge.side)?0:1];spans=cut(spans,at-.75,at+.75);}
   for(const [a,z] of spans)if(z-a>=1.2)candidates.push({side:edge.side,v:edge.v,a,z,count:0,capacity:Math.floor((z-a+.9)/2.1)});
  }
  // Two-bedroom corner units put the pair on the longer usable facade.
  // The packing face is a daylight/entry hint, not a window-count priority.
  candidates.sort((a,b)=>((u.beds===2?((b.z-b.a)-(a.z-a.a)):0))||(b.side===main)-(a.side===main)||(b.z-b.a)-(a.z-a.a)||a.v-b.v||a.a-b.a);
  // Every exterior wall of the unit gets at least one window (its longest usable span, first in the order above); the rest
  // of the budget, one per bedroom plus the living room, goes to the longest walls.
  if(!candidates.length)continue;const firsts=[...new Set(candidates.map(q=>q.side+':'+q.v))].map(k=>candidates.find(q=>q.side+':'+q.v===k));
  firsts.forEach(q=>{q.count=1;});let left=Math.max(0,Math.max(1,Math.min(4,(u.beds||0)+1))-firsts.length);
  for(const q of candidates){const n=Math.min(left,q.capacity-q.count);q.count+=n;left-=n;if(!left)break;}
  let index=0;for(const q of candidates){if(!q.count)continue;const pitch=(q.z-q.a+.9)/q.count;for(let i=0;i<q.count;i++){
   const width=Math.min(index===0?2.1:1.5,pitch-.9),mid=q.a-.45+pitch*(i+.5);
   out.push({id:(r.level||1)+':'+u.id+':'+index++,unit:u.id,side:q.side,v:q.v,a:mid-width/2,z:mid+width/2,sill:.9,height:1.5});
  }}
 }
 return out;
}
function planWindow(w,wall){
 const horizontal=w.side==='top'||w.side==='bottom',sign=w.side==='top'||w.side==='left'?1:-1,at=t=>w.v+sign*t,segment=(a,z,t)=>horizontal?line(a,at(t),z,at(t),'stroke-width=".035"'):line(at(t),a,at(t),z,'stroke-width=".035"'),jamb=a=>horizontal?line(a,at(0),a,at(wall),'stroke-width=".06"'):line(at(0),a,at(wall),a,'stroke-width=".06"');
 const mask=horizontal?{x:w.a,y:Math.min(at(0),at(wall))-.08,w:w.z-w.a,h:wall+.16}:{x:Math.min(at(0),at(wall))-.08,y:w.a,w:wall+.16,h:w.z-w.a};
 return '<g data-window="'+w.id+'" data-window-side="'+w.side+'" data-window-span="'+[w.a,w.z,w.v].join(' ')+'" stroke="#3d434b">'+rect(mask,'fill="#ffffff" stroke="none"')+segment(w.a,w.z,wall*.32)+segment(w.a,w.z,wall*.68)+jamb(w.a)+jamb(w.z)+jamb((w.a+w.z)/2)+'</g>';
}
// the shared drawing title (see DRAW.title): 13px tracked caps in screen pixels, scaled by --u; ' / ' joins as ' · '
function titleBlock(t){return `<g class="dwg-title"><text x="14" y="16" font-size="13" font-weight="600" letter-spacing="0.06em" fill="#111417" dominant-baseline="middle">${esc(String(t).split(' / ').join(' · ').toUpperCase())}</text></g>`;}
function plan(r,opts={}){
 if(opts.coreOnly)r={...r,units:[],o:{...r.o,exclusions:[]}};
 const W=opts.W||900,H=opts.H||620,extent=opts.extent||{W:r.o.W,D:r.o.D},k=Math.min((W-130)/extent.W,(H-175)/extent.D),ox=(W-r.o.W*k)/2,oy=88,fs=11/k;
 if(!r.g)return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${text(30,60,'No drawable arrangement',18)}</svg>`;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(root.EXPLORE.names[r.o.typology])} schematic floor plan" style="font-family:Geist,Arial,Helvetica,sans-serif"><defs><pattern id="unused" width=".4" height=".4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V.4" stroke="#c9ccd0" stroke-width=".018"/></pattern><pattern id="h1" width=".5" height=".5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".5" height=".5" fill="#ffffff"/><path d="M0 0V.5" stroke="#8b9097" stroke-width=".022"/></pattern><pattern id="h2" width=".32" height=".32" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".32" height=".32" fill="#ffffff"/><path d="M0 0V.32" stroke="#8b9097" stroke-width=".022"/></pattern><pattern id="h3" width=".2" height=".2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".2" height=".2" fill="#ffffff"/><path d="M0 0V.2" stroke="#8b9097" stroke-width=".022"/></pattern><pattern id="waste" width=".5" height=".5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><path d="M0 0V.5" stroke="#b3261e" stroke-opacity=".35" stroke-width=".03"/></pattern></defs><rect width="${W}" height="${H}" fill="#ffffff"/>`;
 s+=titleBlock(opts.title||'Typical residential floor');
 s+=`<g transform="translate(${ox},${oy}) scale(${k})" stroke="${ink}" stroke-width="${.7/k}">`;
 s+=rect({x:0,y:0,w:extent.W,h:extent.D},'fill="none" stroke="#8b9097" stroke-dasharray=".6 .3 .1 .3"');
 for(const b of r.g.built)s+=rect(b,`fill="${opts.coreOnly?'#f1f2f4':'url(#unused)'}" stroke-width=".14"`);
 for(const v of r.g.voids){s+=rect(v,'fill="#f6f7f8" stroke="#8b9097" stroke-width=".08"'+(r.o.typology==='free'&&opts.editCores?' data-court-drag="0" role="button" tabindex="0" aria-label="Move courtyard" style="cursor:move;touch-action:none" pointer-events="all"':''));s+=text(v.x+v.w/2,v.y+v.h/2,'COURTYARD',fs*.8,'text-anchor="middle" stroke="none" fill="#6a7079"');s+=text(v.x+v.w/2,v.y+v.h/2+fs*1.5,`${f(v.w)} × ${f(v.h)} m`,fs*.8,'text-anchor="middle" stroke="none" fill="#6a7079"');}
 // Fill all runs first, then stroke only the exposed boundary of their union.
 s+='<g data-corridor-network="true">';for(const c of r.g.corridors)s+=rect(c,'fill="'+(c.exterior?'#d9dce0':'#e6e8eb')+'" stroke="none"');
 const perimeter=root.CORRIDOR_NETWORK?.boundaries(r.g.corridors,{W:r.o.W,D:r.o.D,edges:{}})||[];
 s+='<path data-corridor-outline="true" d="'+perimeter.map(e=>['top','bottom'].includes(e.side)?'M'+f(e.a)+' '+f(e.v)+'H'+f(e.z):'M'+f(e.v)+' '+f(e.a)+'V'+f(e.z)).join(' ')+'" fill="none" stroke="#111417" stroke-width="'+(r.o.corridorWall||.2)+'" stroke-linejoin="miter" pointer-events="none"/>';
 const openEdges=root.CORRIDOR_NETWORK?.exposedEdges(r.g.corridors.filter(c=>c.exterior),r.g,r.o)||[];
 for(const e of openEdges){const h=['top','bottom'].includes(e.side),sg=e.side==='top'||e.side==='left'?1:-1,edge=(v,attr)=>h?line(e.a,v,e.z,v,attr):line(v,e.a,v,e.z,attr);s+='<g data-gallery-guard="true">'+edge(e.v,'stroke="#ffffff" stroke-width=".3"')+edge(e.v,'stroke="#59616b" stroke-width=".055"')+edge(e.v+sg*.12,'stroke="#59616b" stroke-width=".035"')+'</g>';}
 // Ground-level perimeter access remains open through the corridor wall.
 if((r.level||1)===1)for(const e of root.CORRIDOR_NETWORK?.exposedEdges(r.g.corridors.filter(c=>!c.exterior),r.g,r.o)||[]){if(e.face==='court'||e.z-e.a<.9)continue;const mid=(e.a+e.z)/2;s+=['top','bottom'].includes(e.side)?line(mid-.45,e.v,mid+.45,e.v,'stroke="#ffffff" stroke-width=".3"'):line(e.v,mid-.45,e.v,mid+.45,'stroke="#ffffff" stroke-width=".3"');}
 const labelled=r.g.corridors.reduce((best,c)=>!best||Math.max(c.w,c.h)>Math.max(best.w,best.h)?c:best,null);
 for(const [qi,c] of r.g.corridors.entries()){const drag=(opts.editCores||opts.editCorridor),active=opts.selectedCorridor&&['x','y','w','h'].every(k=>Math.abs(c[k]-opts.selectedCorridor[k])<.05);if(drag)s+=rect(c,'fill="'+(active?'#1a56db':'transparent')+'" fill-opacity="'+(active?'.15':'0')+'" stroke="none" data-corridor-drag="'+qi+'" role="button" tabindex="0" aria-label="Select corridor '+(qi+1)+'" style="cursor:move;touch-action:none" pointer-events="all"');if(drag){const hz=c.w>=c.h,cap=.6;for(const end of ['a','z']){const q=hz?{x:end==='a'?c.x-cap/2:c.x+c.w-cap/2,y:c.y,w:cap,h:c.h}:{x:c.x,y:end==='a'?c.y-cap/2:c.y+c.h-cap/2,w:c.w,h:cap};s+=rect(q,'data-corridor-end="'+qi+':'+end+'" fill="#1a56db" fill-opacity="'+(active?'.55':'.28')+'" stroke="none" pointer-events="all" role="slider" aria-label="Adjust corridor length" style="cursor:'+(hz?'ew':'ns')+'-resize;touch-action:none"');}}if(c===labelled&&Math.max(c.w,c.h)>7){const x=c.x+c.w/2,y=c.y+c.h/2;s+=text(x,y,'CORRIDOR',fs*.65,'text-anchor="middle" stroke="none" pointer-events="none"'+(c.h>c.w?' transform="rotate(-90 '+x+' '+y+')"':''));}}s+='</g>';
 const openings=windows(r);
 for(const u of r.units||[]){const selected=opts.selected===u.id;s+=`<g data-unit="${u.id}" role="button" tabindex="0" aria-label="Unit ${root.EXPLORE.unitNo(r.level,u.id)}, ${u.type}, ${f(u.net)} square metres" style="cursor:pointer">`;s+=filledShape(u.parts||[u,...(u.patches||[])],ink);s+=filledShape(u.netParts||[u.netRect,...(u.netPatches||[])],selected?'#dbe6fb':colors[u.type]);
  const cx=u.x+u.w/2,cy=u.y+u.h/2;
  s+=text(cx,cy-fs*.1,String(root.EXPLORE.unitNo(r.level,u.id)),fs,'text-anchor="middle" fill="#111417" stroke="none" font-weight="600"');s+=text(cx,cy+fs*1.2,`${u.type} · ${u.net.toFixed(1)} m²`,fs*9/11,'text-anchor="middle" fill="#3d434b" stroke="none"'); // number, then type and area 2 pt smaller (11 → 9)
  const [dx,dy]=u.door,door=.9;
  if(u.entry==='top'||u.entry==='bottom'){s+=line(dx-door/2,dy,dx+door/2,dy,'stroke="#ffffff" stroke-width=".28"');const sign=u.entry==='top'?1:-1;s+=line(dx-door/2,dy,dx-door/2,dy+sign*door,'stroke-width=".06"');s+=`<path d="M${dx+door/2},${dy} Q${dx+door/2},${dy+sign*door} ${dx-door/2},${dy+sign*door}" fill="none" stroke-width=".04"/>`;}
  else{s+=line(dx,dy-door/2,dx,dy+door/2,'stroke="#ffffff" stroke-width=".28"');const sign=u.entry==='left'?1:-1;s+=line(dx,dy-door/2,dx+sign*door,dy-door/2,'stroke-width=".06"');}
  for(const w of openings.filter(w=>w.unit===u.id))s+=planWindow(w,r.o.wall||.25);

  s+='</g>';
 }
 if(opts.editUnits)for(const u of r.units||[])for(const v of r.units)if(u!==v&&u.band!=null&&u.band===v.band&&Math.abs(u.z-v.a)<.02){const b=r.g.bands[u.band];if(!b)continue;const h=b.axis==='x'?{x:u.z-.4,y:b.y,w:.8,h:b.h}:{x:b.x,y:u.z-.4,w:b.w,h:.8};s+=rect(h,`data-wall="${u.band}:${f(u.z)}" role="slider" aria-label="Party wall between units ${root.EXPLORE.unitNo(r.level,u.id)} and ${root.EXPLORE.unitNo(r.level,v.id)}; drag to move it" fill="#1a56db" fill-opacity=".18" stroke="#1a56db" stroke-width=".045" stroke-dasharray=".2 .14" pointer-events="all" style="cursor:${b.axis==='x'?'ew':'ns'}-resize;touch-action:none"`);}
 // walls made by a hand cut: one handle per cut, dragged like a party wall
 if(opts.editUnits){const seen=new Set();for(const u of r.units||[]){const c=u.cut;if(!c||seen.has(c.edit))continue;const v=(r.units||[]).find(q=>q!==u&&q.cut?.edit===c.edit);if(!v)continue;seen.add(c.edit);const h=c.axis==='x'?{x:c.v-.4,y:c.side[0],w:.8,h:c.side[1]-c.side[0]}:{x:c.side[0],y:c.v-.4,w:c.side[1]-c.side[0],h:.8};s+=rect(h,`data-cut="${c.edit}" role="slider" aria-label="Wall between units ${root.EXPLORE.unitNo(r.level,u.id)} and ${root.EXPLORE.unitNo(r.level,v.id)}; drag to move it" fill="#1a56db" fill-opacity=".18" stroke="#1a56db" stroke-width=".045" stroke-dasharray=".2 .14" pointer-events="all" style="cursor:${c.axis==='x'?'ew':'ns'}-resize;touch-action:none"`);}}
 for(const [ci,c] of r.g.cores.entries()){const wall=r.o.coreWall||.2,drag=opts.editCores||opts.moveCores;s+=`<g ${!drag?`data-core-select="${ci}" role="button" tabindex="0" aria-label="Adjust ${c.kind==='elevator'?'lift':'stair'}" style="cursor:pointer"`:''} ${drag?`data-core-drag="${ci}" tabindex="0" role="button" aria-label="Move ${c.kind==='elevator'?'lift':'stair '+(ci+1)}; use coordinate fields for keyboard editing" style="cursor:move;touch-action:none"`:''}>`;s+=rect(c,'fill="#111417" stroke="none"');s+=rect({x:c.x+wall,y:c.y+wall,w:c.w-2*wall,h:c.h-2*wall},'fill="#ffffff" stroke="none"');if(c.kind==='elevator'){const cabs=Math.max(1,Math.round(Math.max(c.w,c.h)/Math.min(c.w,c.h))),horiz=c.w>=c.h;for(let j=0;j<cabs;j++){const q=horiz?{x:c.x+j*c.w/cabs,y:c.y,w:c.w/cabs,h:c.h}:{x:c.x,y:c.y+j*c.h/cabs,w:c.w,h:c.h/cabs};s+=line(q.x+.2,q.y+.2,q.x+q.w-.2,q.y+q.h-.2,'stroke-width=".05"');s+=line(q.x+q.w-.2,q.y+.2,q.x+.2,q.y+q.h-.2,'stroke-width=".05"');}s+=text(c.x+c.w/2,c.y+c.h/2,cabs>1?`${cabs} LIFTS`:'LIFT',fs*.7,'text-anchor="middle" stroke="none"');}
 else{const horizontal=c.w>c.h,sw=horizontal?c.h:c.w,sl=horizontal?c.w:c.h;const tr=horizontal?`translate(${c.x+c.w},${c.y}) rotate(90)`:`translate(${c.x},${c.y})`;s+=`<g transform="${tr}">`;const land=Math.min(1.1,sl*.22),mid=sw/2;for(let j=0;j<=8;j++){const y=land+j*(sl-2*land)/8;s+=line(.2,y,mid-.08,y,'stroke-width=".035"');s+=line(mid+.08,y,sw-.2,y,'stroke-width=".035"');}if(c.kind==='scissor'){// two separated stairs, each a straight run: a full-length rated wall between them, each landing at its own end
  s+=line(mid,0,mid,sl,'stroke-width=".16"');s+=text(sw*.25,land*.72,'A',fs*.8,'text-anchor="middle" stroke="none" font-weight="600"');s+=text(sw*.75,sl-land*.28,'B',fs*.8,'text-anchor="middle" stroke="none" font-weight="600"');s+=text(sw*.25,sl*.5,'↓',fs,'text-anchor="middle" stroke="none"');s+=text(sw*.75,sl*.5,'↑',fs,'text-anchor="middle" stroke="none"');}
 else{s+=line(mid,land,mid,sl-land,'stroke-width=".06"');s+=text(sw*.25,sl*.5,'↑',fs,'text-anchor="middle" stroke="none"');s+=text(sw*.75,sl*.5,'↓',fs,'text-anchor="middle" stroke="none"');}s+='</g>';}
 const access=root.CORE_LAYOUT?.contacts(c,r.g.corridors)[0];if(c.doorSide||access){const side=c.doorSide||access.side,[dx,dy]=access?.point||root.CORE_LAYOUT?.door(c,side).point||(side==='top'?[c.x+c.w/2,c.y]:side==='bottom'?[c.x+c.w/2,c.y+c.h]:side==='left'?[c.x,c.y+c.h/2]:[c.x+c.w,c.y+c.h/2]),color=access?'#e6e8eb':'#b3261e',marks=root.CORE_LAYOUT?.cars?.(c,side)>1?root.CORE_LAYOUT.openings(c,side).map(q=>q.point):[[dx,dy]];for(const [mx,my] of marks)s+=['top','bottom'].includes(side)?line(mx-.55,my,mx+.55,my,`stroke="${color}" stroke-width=".28"`):line(mx,my-.55,mx,my+.55,`stroke="${color}" stroke-width=".28"`);if(opts.editCores||opts.editCorridor)s+=rect({x:dx-.7,y:dy-.7,w:1.4,h:1.4},`data-core-door="${ci}" fill="#1a56db" fill-opacity=".12" stroke="#1a56db" stroke-width=".05" stroke-dasharray=".2 .12" pointer-events="all" role="button" tabindex="0" aria-label="Drag the door along its wall or onto another face" style="cursor:grab;touch-action:none"`);}
 else{const route=r.g.corridors.find(q=>root.EXPLORE.attach(c,q));if(route){const horizontal=Math.abs(c.y+c.h-route.y)<.05||Math.abs(c.y-route.y-route.h)<.05,dx=horizontal?(Math.max(c.x,route.x)+Math.min(c.x+c.w,route.x+route.w))/2:Math.abs(c.x+c.w-route.x)<.05?c.x+c.w:c.x,dy=horizontal?Math.abs(c.y+c.h-route.y)<.05?c.y+c.h:c.y:(Math.max(c.y,route.y)+Math.min(c.y+c.h,route.y+route.h))/2;s+=horizontal?line(dx-.55,dy,dx+.55,dy,'stroke="#e6e8eb" stroke-width=".25"'):line(dx,dy-.55,dx,dy+.55,'stroke="#e6e8eb" stroke-width=".25"');}}
 if(opts.editCores)s+=rect(c,`fill="none" pointer-events="none" stroke="${opts.selectedCore===ci?'#1a56db':'#8b9097'}" stroke-width=".12" stroke-dasharray=".25 .16"`);s+='</g>';
 if(opts.editCores){const hx=c.x+c.w+.7,hy=c.y+.7;s+=`<g data-core-rotate="${ci}" role="button" tabindex="0" aria-label="Rotate ${c.kind==='elevator'?'lift':'stair'} 90 degrees" style="cursor:pointer" pointer-events="all"><circle cx="${f(hx)}" cy="${f(hy)}" r=".6" fill="#ffffff" stroke="#1a56db" stroke-width=".07"/>${text(hx,hy+fs*.35,'↻',fs*1.05,'text-anchor="middle" fill="#1a56db" stroke="none" font-weight="600"')}</g>`;}}

 // Dingbat parking: stalls, the aisle and the columns that carry the floors above.
 if(r.parking&&!opts.coreOnly){const P=r.parking;s+='<g data-parking="true" pointer-events="none">';
  for(const a of P.aisles){s+=rect(a,'fill="#f6f7f8" stroke="none"');const horiz=a.w>a.h;s+=horiz?line(a.x+.6,a.y+a.h/2,a.x+a.w-.6,a.y+a.h/2,'stroke="#8b9097" stroke-width=".04" stroke-dasharray=".6 .4"'):line(a.x+a.w/2,a.y+.6,a.x+a.w/2,a.y+a.h-.6,'stroke="#8b9097" stroke-width=".04" stroke-dasharray=".6 .4"');}
  for(const q of P.stalls)s+=rect(q,'fill="none" stroke="#8b9097" stroke-width=".035"');
  for(const c of P.columns)s+=rect(c,'fill="#111417" stroke="none"');
  const zone=P.aisles[0]||P.stalls.reduce((m,q)=>q.w*q.h>m.w*m.h?q:m,P.stalls[0]);s+=text(zone.x+zone.w/2,zone.y+zone.h/2,`PARKING · ${P.count} STALLS`,fs*.75,'text-anchor="middle" stroke="none" fill="#3d434b" font-weight="600" letter-spacing=".08"');s+=text(zone.x+zone.w/2,zone.y+zone.h/2+fs,'lane entry · open ground floor on columns',fs*.6,'text-anchor="middle" stroke="none" fill="#6a7079"');
  s+='</g>';}
 // Plate stretch handles: far edges and corner of the footprint. The plate frame starts at 0,0, so these are the free sides.
 if(opts.editCores&&r.o.typology==='free'){const PW=r.o.W,PD=r.o.D,t=.7,st='fill="#1a56db" fill-opacity=".14" stroke="#1a56db" stroke-width=".05" stroke-dasharray=".3 .2" pointer-events="all" role="slider"';
  s+=rect({x:PW-t/2,y:0,w:t,h:PD},'data-plate-edge="W" '+st+' aria-label="Stretch footprint width" style="cursor:ew-resize;touch-action:none"');
  s+=rect({x:0,y:PD-t/2,w:PW,h:t},'data-plate-edge="D" '+st+' aria-label="Stretch footprint depth" style="cursor:ns-resize;touch-action:none"');
  s+=rect({x:PW-.8,y:PD-.8,w:1.6,h:1.6},'data-plate-edge="WD" fill="#1a56db" fill-opacity=".45" stroke="#1a56db" stroke-width=".05" pointer-events="all" role="slider" aria-label="Stretch footprint width and depth" style="cursor:nwse-resize;touch-action:none"');}
 // Unserved plate on residential floors: hatched, with the reason the router gives.
 if(!opts.coreOnly&&root.CORRIDOR_NETWORK&&r.o.typology==='free'&&r.o.freeCorridors&&r.o.freeCorridors.length&&(r.level||1)>1&&r.units){try{const cov=root.CORRIDOR_NETWORK.analyse(r.g,r.o,r.units);s+='<g data-unserved="true" pointer-events="none">';for(const q of cov.unserved){if(q.area<8)continue;s+=rect(q,'fill="url(#waste)" stroke="#b3261e" stroke-width=".04" stroke-dasharray=".3 .2"');const short=/switched off/i.test(q.reason)?'WINDOW FACE OFF':/deeper than/i.test(q.reason)?'TOO DEEP':/corridor contact/i.test(q.reason)?'NO CORRIDOR':/window/i.test(q.reason)?'NO WINDOW FACE':/shallow/i.test(q.reason)?'TOO SHALLOW':/core/i.test(q.reason)?'CORE ACCESS':'NO PAYING RUN';if(Math.min(q.w,q.h)>=2.2)s+=text(q.x+q.w/2,q.y+q.h/2+fs*.25,short,fs*.6,'text-anchor="middle" stroke="none" fill="#b3261e" letter-spacing=".06"');}s+='</g>';}catch(e){}}
 // Ground rooms are sets of rectangles drawn as one shape each; adjacent flexible pieces merge the same way.
 {const wall=(r.o.coreWall||.2)/2,named=r.o.exclusions.filter(q=>q.name),unnamed=r.o.exclusions.filter(q=>!q.name),adj=(a,b)=>((Math.abs(a.x+a.w-b.x)<.02||Math.abs(b.x+b.w-a.x)<.02)&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.3)||((Math.abs(a.y+a.h-b.y)<.02||Math.abs(b.y+b.h-a.y)<.02)&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.3);
  const shape=(parts,fill='#f6f7f8')=>{s+=filledShape(parts,'#111417');const inner=parts.map(p=>({x:p.x+wall,y:p.y+wall,w:Math.max(0,p.w-2*wall),h:Math.max(0,p.h-2*wall)})),bridges=[];for(const a of parts)for(const b of parts){if(a===b)continue;if(Math.abs(a.x+a.w-b.x)<.02){const y0=Math.max(a.y,b.y)+wall,y1=Math.min(a.y+a.h,b.y+b.h)-wall;if(y1>y0)bridges.push({x:a.x+a.w-wall,y:y0,w:2*wall,h:y1-y0});}if(Math.abs(a.y+a.h-b.y)<.02){const x0=Math.max(a.x,b.x)+wall,x1=Math.min(a.x+a.w,b.x+b.w)-wall;if(x1>x0)bridges.push({x:x0,y:a.y+a.h-wall,w:x1-x0,h:2*wall});}}s+=filledShape(inner.concat(bridges),fill);};
  const label=(parts,name)=>{const big=parts.reduce((m,p)=>p.w*p.h>m.w*m.h?p:m),area=parts.reduce((t,p)=>t+p.w*p.h,0);if(big.w<1.6||big.h<1.2)return;const size=fs*.68;if(big.w*big.h<6){s+=text(big.x+big.w/2,big.y+big.h/2+size*.35,name,size,'text-anchor="middle" stroke="none" fill="#111417"');return;}s+=text(big.x+big.w/2,big.y+big.h/2,name,size,'text-anchor="middle" stroke="none" fill="#111417"');s+=text(big.x+big.w/2,big.y+big.h/2+fs,`${area.toFixed(1)} m²`,fs*.65,'text-anchor="middle" stroke="none" fill="#6a7079"');};
  const highlight=parts=>{s+=filledShape(parts,'none').replace('stroke="none"','stroke="#1a56db" stroke-width=".16" stroke-dasharray=".3 .15"');};
  for(const ex of unnamed){s+=rect(ex,'fill="#111417" stroke="none"');s+=rect({x:ex.x+wall,y:ex.y+wall,w:Math.max(0,ex.w-2*wall),h:Math.max(0,ex.h-2*wall)},'fill="#f6f7f8" stroke="none"');}
  const flex=named.filter(q=>q.name==='Flexible space'),seen=new Set();
  flex.forEach((q,i)=>{if(seen.has(i))return;const comp=[i];seen.add(i);for(let k=0;k<comp.length;k++)flex.forEach((p,j)=>{if(!seen.has(j)&&adj(flex[comp[k]],p)){seen.add(j);comp.push(j);}});const parts=comp.map(i=>flex[i]);s+=`<g data-room-group="${parts.map(p=>p.gi).join(',')}" style="${opts.editRooms?'cursor:pointer':''}">`;shape(parts);label(parts,'Flexible space');if(parts.some(p=>p.gi===opts.selectedRoom))highlight(parts);s+='</g>';});
  const byRoom=new Map();for(const q of named){if(q.name==='Flexible space'||q.name==='Parking')continue;if(!byRoom.has(q.roomIndex))byRoom.set(q.roomIndex,[]);byRoom.get(q.roomIndex).push(q);}
  for(const parts of byRoom.values()){const first=parts[0],gi=first.gi;
   s+=`<g data-room-drag="${gi}" style="${opts.editRooms?'cursor:move;touch-action:none':''}">`;shape(parts,first.open?'#e6e8eb':'#f6f7f8');label(parts,first.name);
   if(first.open){s+='<g data-open-lobby="true">';for(const p of parts)for(const q of r.g.corridors){const x0=Math.max(p.x,q.x),x1=Math.min(p.x+p.w,q.x+q.w),y0=Math.max(p.y,q.y),y1=Math.min(p.y+p.h,q.y+q.h);if(x1-x0>.3&&(Math.abs(p.y-q.y-q.h)<.001||Math.abs(p.y+p.h-q.y)<.001)){const y=Math.abs(p.y-q.y-q.h)<.001?p.y:p.y+p.h;s+=line(x0+.1,y,x1-.1,y,'stroke="#e6e8eb" stroke-width=".44"');}if(y1-y0>.3&&(Math.abs(p.x-q.x-q.w)<.001||Math.abs(p.x+p.w-q.x)<.001)){const x=Math.abs(p.x-q.x-q.w)<.001?p.x:p.x+p.w;s+=line(x,y0+.1,x,y1-.1,'stroke="#e6e8eb" stroke-width=".44"');}}s+='</g>';}
   if(first.door&&!first.open){const d=.9,{side,x:px,y:py}=first.door;if(side==='top'||side==='bottom'){const sg=side==='top'?1:-1;s+=line(px-d/2,py,px+d/2,py,'stroke="#ffffff" stroke-width=".28"');s+=line(px-d/2,py,px-d/2,py+sg*d,'stroke-width=".06"');s+=`<path d="M${f(px+d/2)},${f(py)} Q${f(px+d/2)},${f(py+sg*d)} ${f(px-d/2)},${f(py+sg*d)}" fill="none" stroke-width=".04"/>`;}else{const sg=side==='left'?1:-1;s+=line(px,py-d/2,px,py+d/2,'stroke="#ffffff" stroke-width=".28"');s+=line(px,py-d/2,px+sg*d,py-d/2,'stroke-width=".06"');s+=`<path d="M${f(px)},${f(py+d/2)} Q${f(px+sg*d)},${f(py+d/2)} ${f(px+sg*d)},${f(py-d/2)}" fill="none" stroke-width=".04"/>`;}}
   else{const big=parts.reduce((m,p)=>p.w*p.h>m.w*m.h?p:m),y=first.name==='Lobby'?big.y:big.y+big.h;s+=line(big.x+.3,y,big.x+1.3,y,'stroke="#ffffff" stroke-width=".22"');}
   if(parts.some(p=>p.gi===opts.selectedRoom))highlight(parts);
   // Every outer wall segment of the room is a drag target.
   if(opts.editRooms)parts.forEach(p=>{const j=p.part||0;for(const [side,q,cur,covered]of [['left',{x:p.x-.25,y:p.y,w:.5,h:p.h},'ew',parts.some(o=>o!==p&&Math.abs(o.x+o.w-p.x)<.01&&o.y<=p.y+.01&&o.y+o.h>=p.y+p.h-.01)],['right',{x:p.x+p.w-.25,y:p.y,w:.5,h:p.h},'ew',parts.some(o=>o!==p&&Math.abs(o.x-(p.x+p.w))<.01&&o.y<=p.y+.01&&o.y+o.h>=p.y+p.h-.01)],['top',{x:p.x,y:p.y-.25,w:p.w,h:.5},'ns',parts.some(o=>o!==p&&Math.abs(o.y+o.h-p.y)<.01&&o.x<=p.x+.01&&o.x+o.w>=p.x+p.w-.01)],['bottom',{x:p.x,y:p.y+p.h-.25,w:p.w,h:.5},'ns',parts.some(o=>o!==p&&Math.abs(o.y-(p.y+p.h))<.01&&o.x<=p.x+.01&&o.x+o.w>=p.x+p.w-.01)]])if(!covered)s+=rect(q,`data-wallseg="${gi}:${j}:${side}" role="slider" aria-label="Wall of ${esc(first.name)}; drag to move it" fill="#1a56db" fill-opacity=".08" stroke="none" style="cursor:${cur}-resize;touch-action:none"`);});
   s+='</g>';
   if(first.role==='lobby'||first.name==='Lobby'){let en=null;for(const p of parts){en=root.FLOOR_DESIGN?.entryFor(p,r.g,first.entry);if(en)break;}if(en){const {x,y,dx,dy}=en;s+=line(x-dy*.5,y+dx*.5,x+dy*.5,y-dx*.5,'stroke="#ffffff" stroke-width=".3"');s+=`<g ${opts.editRooms?`data-entry-cycle="${gi}" role="button" tabindex="0" aria-label="Move the main entry to the next exterior side" style="cursor:pointer"`:''}>`;s+=rect({x:x+Math.min(0,dx*2.6)-(dx?0:1.2),y:y+Math.min(0,dy*2.6)-(dy?0:1.2),w:dx?2.6:2.4,h:dy?2.6:2.4},'fill="transparent" stroke="none" pointer-events="all"');s+=line(x+dx*2.2,y+dy*2.2,x,y,'stroke="#1a56db" stroke-width=".16"');s+=`<path d="M${x+dx*.65-dy*.35} ${y+dy*.65+dx*.35}L${x} ${y}L${x+dx*.65+dy*.35} ${y+dy*.65-dx*.35}" fill="none" stroke="#1a56db" stroke-width=".16"/>`;s+=text(x+dx*2.8,y+dy*2.8,'MAIN ENTRY',fs*.9,'text-anchor="middle" stroke="none" fill="#1a56db"');s+='</g>';}}
  }}
 if(opts.routes&&r.route){for(let i=0;i<r.route.paths.length;i++){if(opts.selected&&r.units[i].id!==opts.selected)continue;const route=r.route.paths[i],paths=opts.selected?route.toExits||[route]:[route];for(const p of paths)if(p.points.length)s+=`<polyline points="${p.points.map(q=>q.map(f).join(',')).join(' ')}" fill="none" stroke="${p.exit===1?'#1a56db':'#6a7079'}" stroke-width=".12" stroke-dasharray=".25 .15"/>`;}
 for(const e of r.route.exits||[])if(e.point)s+=text(e.point[0],e.point[1]-.5,`EXIT ${e.id}`,fs*.9,'text-anchor="middle" stroke="none" fill="#1a56db" font-weight="600"');}
 // dimension strings and scale bar use metres, not paper scale claims
 s+='<g data-raw-dimensions="true">';
 const dim=(a,b,y,label)=>{s+=line(a,y,b,y,'stroke-width=".04"');s+=line(a,y-.2,a,y+.2,'stroke-width=".05"');s+=line(b,y-.2,b,y+.2,'stroke-width=".05"');s+=text((a+b)/2,y-.3,label,fs*.85,'text-anchor="middle" stroke="none" fill="#6a7079"');};
 dim(0,r.o.W,-1.5,`${r.o.W.toFixed(2)} m`);s+=text(r.o.W+.8,r.o.D/2,`${r.o.D.toFixed(2)} m`,fs*.85,`stroke="none" transform="rotate(90 ${r.o.W+.8} ${r.o.D/2})"`);
 s+='</g></g>';s+=text(W/2,48,'STREET / FRONTAGE',10,'text-anchor="middle" fill="#6a7079" letter-spacing="2"');
 const scale=5*k;s+=`<path d="M30 ${H-23}h${scale}" stroke="${ink}" stroke-width="2"/>`+text(30,H-30,'0',9)+text(30+scale,H-30,'5 m',9,'text-anchor="end"');s+=text(W-25,H-23,'SCHEMATIC · ROOM FIT NOT VERIFIED',9,'text-anchor="end" fill="#6a7079"');return s+'</svg>';
}
function axon(r,opts={}){
 const W=Math.max(320,opts.W||480),H=Math.max(360,opts.H||420);if(!r.g)return '';const modelTop=106,modelBottom=H-70;
 const N=r.o.floors,ftf=r.o.ftf,height=(r.o.commercial?r.o.groundFtf+(N-1)*ftf:N*ftf),extent=opts.extent||{W:r.o.W,D:r.o.D};
 const az=(opts.view?.az??0)*Math.PI/180,el=(opts.view?.el??55)*Math.PI/180,ca=Math.cos(az),sa=Math.sin(az),se=Math.sin(el),ce=Math.cos(el);
 // Plan rotated by azimuth; yr is depth toward the viewer. Elevation tilts the plan.
 const north=r.context?.projectRotation??r.context?.siteRotation??0,na=Math.cos(north),nb=Math.sin(north),rot=(x,y)=>{const px=na*x+nb*y,py=nb*x-na*y;return [px*ca-py*sa,px*sa+py*ca];},raw=(x,y,z)=>{const [xr,yr]=rot(x,y);return [xr,yr*se-z*ce];},cx=opts.context,pts=[0,extent.W].flatMap(x=>[0,extent.D].flatMap(y=>[0,height].map(z=>raw(x,y,z)))).concat(cx?[[cx.band.x0,cx.band.y0],[cx.band.x1,cx.band.y0],[cx.band.x1,cx.band.y1],[cx.band.x0,cx.band.y1]].map(([x,y])=>raw(x,y,0)):[]),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys),k=Math.min((W-60)/(Math.max(...xs)-minX),(modelBottom-modelTop)/(Math.max(...ys)-minY)),p=(x,y,z)=>{const q=raw(x,y,z);return [30+(q[0]-minX)*k,modelTop+(q[1]-minY)*k];};
 const poly=(points,attrs)=>`<polygon points="${points.map(q=>q.map(f).join(',')).join(' ')}" ${attrs}/>`;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Coordinated massing" style="font-family:Geist,Arial,Helvetica,sans-serif"><rect width="${W}" height="${H}" fill="#ffffff"/>`+titleBlock('Massing study');
 // surroundings on the ground: street and lane surface, then the neighbouring parcels
 if(cx){const b=cx.band;s+=poly([p(b.x0,b.y0,0),p(b.x1,b.y0,0),p(b.x1,b.y1,0),p(b.x0,b.y1,0)],'fill="#dcdfe3" stroke="none"');for(const q of cx.parcels)s+=poly(q.poly.map(([x,y])=>p(x,y,0)),'fill="#f7f8f9" stroke="#c9cdd2" stroke-width=".5"');}
 s+=poly([p(0,0,0),p(extent.W,0,0),p(extent.W,extent.D,0),p(0,extent.D,0)],'fill="#f6f7f8" stroke="#c9ccd0" stroke-dasharray="4 3" stroke-width=".6"');
 if(cx)for(const st of cx.streets||[]){const c=cx.lot.reduce((t,v)=>[t[0]+v[0]/cx.lot.length,t[1]+v[1]/cx.lot.length],[0,0]),m=[(st.a[0]+st.b[0])/2,(st.a[1]+st.b[1])/2],L=Math.hypot(m[0]-c[0],m[1]-c[1])||1,q=p(m[0]+(m[0]-c[0])/L*7,m[1]+(m[1]-c[1])/L*7,0),pa=p(st.a[0],st.a[1],0),pb=p(st.b[0],st.b[1],0);let ang=Math.atan2(pb[1]-pa[1],pb[0]-pa[0])*180/Math.PI;if(ang>90)ang-=180;if(ang<=-90)ang+=180;s+=text(q[0],q[1],st.name,11,`text-anchor="middle" dominant-baseline="middle" fill="#3d434b" letter-spacing=".6" stroke="#dcdfe3" stroke-width="3" paint-order="stroke" transform="rotate(${ang.toFixed(1)} ${f(q[0])} ${f(q[1])})"`);}
 s+=text(20,H-38,'Drag to orbit · double-click to realign',11,'fill="#8b9097"');
 const levels=r.levels||Array.from({length:N},(_,i)=>({...r,level:i+1}));
 const boxes=[],CORE_TOP='#c9ccd0',CORE_SIDE='#cfd3d8',WIN='#dbe6fb';
 for(const l of levels){const z0=r.o.commercial?(l.level===1?0:r.o.groundFtf+(l.level-2)*ftf):(l.level-1)*ftf,z1=z0+(r.o.commercial&&l.level===1?r.o.groundFtf:ftf);
 const open=l.g.corridors.filter(c=>c.exterior),openCores=l.g.cores.filter(c=>c.exterior);let solid=l.g.built;for(const q of open.concat(openCores))solid=solid.flatMap(b=>root.FLOOR_DESIGN.subtract(b,q));
 const box=(b,za,zb,top,side)=>boxes.push({lo:[b.x,b.y,za],hi:[b.x+b.w,b.y+b.h,zb],top,side,level:l.level});
 if(l.parking){for(const b of solid)box(b,z0,z0+.25,"#e3e5e8","#c9ccd0");for(const c of l.parking.columns)box(c,z0,z1,"#ffffff",null);for(const c of l.g.cores)box(c,z0,z1,CORE_TOP,CORE_SIDE);for(const q of (l.rooms||[]).filter(q=>q.name!=='Flexible space'&&q.on!==false))box(q,z0,z1,"#ffffff",l.level===opts.floor?"#e7eefb":null);}
 else{// stair and lift shafts are their own solid volumes: service walls, never glazed
  const cs=l.g.cores.filter(c=>!c.exterior);let rest=solid;for(const c of cs)rest=rest.flatMap(b=>root.FLOOR_DESIGN.subtract(b,c));for(const b of rest)box(b,z0,z1,"#ffffff",l.level===opts.floor?"#e7eefb":null);for(const c of cs)box(c,z0,z1,CORE_TOP,CORE_SIDE);}
 for(const q of open)box(q,z0,z0+.3,"#e6e8eb","#c9ccd0");
 for(const e of root.CORRIDOR_NETWORK?.exposedEdges(open,l.g,l.o)||[]){const h=['top','bottom'].includes(e.side),sg=e.side==='top'||e.side==='left'?1:-1,v=e.v+sg*.06,rail=h?{x:e.a,y:v-.03,w:e.z-e.a,h:.06}:{x:v-.03,y:e.a,w:.06,h:e.z-e.a};box(rail,z0+1.05,z0+1.11,"#747d87","#747d87");const n=Math.max(1,Math.ceil((e.z-e.a)/1.5));for(let i=0;i<=n;i++){const t=e.a+(e.z-e.a)*i/n;box({x:(h?t:v)-.03,y:(h?v:t)-.03,w:.06,h:.06},z0+.3,z0+1.05,"#747d87","#747d87");}}

 for(const q of openCores)box(q,z0,z1,"#f6f7f8","#c9ccd0");
 }
 const eye=[(sa*na+ca*nb)*ce,(sa*nb-ca*na)*ce,se];let faces=root.MASSING_SURFACES.surfaces(boxes).filter(face=>face.sign*eye[face.axis]>1e-7);
 faces=faces.flatMap(face=>{
  if(face.axis!==2||face.sign<0)return [face];const l=levels.find(l=>l.level===face.level),xs=face.points.map(p=>p[0]),ys=face.points.map(p=>p[1]);
  let pieces=[{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),fill:face.fill}];
  const marks=(opts.cores?l.g.cores.map(c=>({...c,fill:c.kind==="elevator"?"#dbe6fb":"#c9ccd0"})):[]).concat(l.level===opts.floor?(l.units||[]).filter(u=>u.id===opts.selected).flatMap(u=>(u.parts||[u,...(u.patches||[])]).map(q=>({...q,fill:"#1a56db"}))):[]);
  for(const mark of marks)pieces=pieces.flatMap(q=>{if(!root.EXPLORE.overlap(q,mark))return [q];return root.FLOOR_DESIGN.subtract(q,mark).concat({...root.EXPLORE.intersection(q,mark),fill:mark.fill});});
  return pieces.map(q=>({...face,fill:q.fill,points:[[q.x,q.y,face.at],[q.x+q.w,q.y,face.at],[q.x+q.w,q.y+q.h,face.at],[q.x,q.y+q.h,face.at]]}));
 });
// neighbouring buildings (approximate) join the same depth sort as the design
 if(cx)for(const bld of cx.buildings){let q=bld.poly;if(root.SITE_CONTEXT.area(q)<0)q=q.slice().reverse();const h=bld.h;
  for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.05)continue;const n=[(b[1]-a[1])/L,-(b[0]-a[0])/L,0];if(n[0]*eye[0]+n[1]*eye[1]<=1e-7)continue;
   faces.push({n,d:n[0]*a[0]+n[1]*a[1],ctx:true,fill:"#e1e4e8",points:[[a[0],a[1],0],[b[0],b[1],0],[b[0],b[1],h],[a[0],a[1],h]]});}
  faces.push({n:[0,0,1],d:h,ctx:true,fill:"#eef0f2",points:q.map(([x,y])=>[x,y,h])});}
 const openingsByLevel=new Map(levels.map(l=>[l.level,windows(l)]));
 const windowsOn=face=>{if(face.ctx||face.axis===2||face.fill===CORE_SIDE)return '';
  const side=face.axis===0?(face.sign>0?'right':'left'):(face.sign>0?'bottom':'top'),horizontal=face.axis===1,zs=face.points.map(q=>q[2]),along=face.points.map(q=>q[horizontal?0:1]),z0=Math.min(...zs),z1=Math.max(...zs),lo=Math.min(...along),hi=Math.max(...along),at=face.at+face.sign*.03;
  const seg=(a,b,za,zb)=>horizontal?[[a,at,za],[b,at,za],[b,at,zb],[a,at,zb]]:[[at,a,za],[at,b,za],[at,b,zb],[at,a,zb]];let out='';
  for(const w of openingsByLevel.get(face.level)||[]){if(w.side!==side||Math.abs(w.v-face.at)>.01)continue;const a=Math.max(lo,w.a),b=Math.min(hi,w.z),za=z0+w.sill,zb=Math.min(z1-.3,za+w.height);if(b-a<.01||zb<=za)continue;
   out+='<g data-window="'+w.id+'" data-window-side="'+w.side+'" data-window-span="'+[w.a,w.z,w.v].join(' ')+'">'+poly(seg(a,b,za,zb).map(v=>p(...v)),'fill="'+WIN+'" stroke="#59616b" stroke-width=".65"');
   const mid=(w.a+w.z)/2;if(mid>a&&mid<b)out+=line(...p(...(horizontal?[mid,at,za]:[at,mid,za])),...p(...(horizontal?[mid,at,zb]:[at,mid,zb])),'stroke="#59616b" stroke-width=".5"');out+='</g>';
  }return out;};
 // Rectangle decomposition must not appear as invented lines across a flat roof.
 const roofOutline=face=>{let out='';for(let i=0;i<face.points.length;i++){const a=face.points[i],b=face.points[(i+1)%face.points.length],axis=Math.abs(a[0]-b[0])>.0001?0:1,fixed=1-axis;let spans=[[Math.min(a[axis],b[axis]),Math.max(a[axis],b[axis])]];
  for(const other of faces){if(other===face||other.ctx||other.axis!==2||other.fill!==face.fill||Math.abs(other.at-face.at)>.0001)continue;for(let j=0;j<other.points.length;j++){const c=other.points[j],d=other.points[(j+1)%other.points.length];if(Math.abs(c[fixed]-a[fixed])>.0001||Math.abs(d[fixed]-a[fixed])>.0001)continue;const lo=Math.min(c[axis],d[axis]),hi=Math.max(c[axis],d[axis]);spans=spans.flatMap(([u,v])=>hi<=u||lo>=v?[[u,v]]:[[u,Math.max(u,lo)],[Math.min(v,hi),v]].filter(([u,v])=>v-u>.0001));}}
  for(const [lo,hi] of spans){const c=a.slice(),d=a.slice();c[axis]=lo;d[axis]=hi;out+=line(...p(...c),...p(...d),'stroke="#59616b" stroke-width=".75"');}}
  return out;};
 for(const face of root.MASSING_SURFACES.order(faces,eye)){const roof=!face.ctx&&face.axis===2,tag=!face.ctx&&face.level!=null;if(tag)s+='<g data-floor="'+face.level+'">';s+=poly(face.points.map(q=>p(...q)),`fill="${face.fill}" stroke="${roof?'none':face.ctx?'#aeb4bc':'#59616b'}" stroke-width="${face.ctx?.4:.75}" stroke-linejoin="round"`);if(roof)s+=roofOutline(face);s+=windowsOn(face);if(tag)s+='</g>';}
 const legend=[['#ffffff','Residential'],[CORE_SIDE,'Stair / lift'],[WIN,'Unit windows']];if(cx)legend.push(['#e1e4e8','Context · approx.']);legend.forEach(([fill,label],i)=>{const x=20+(i%2)*(W-40)/2,y=49+Math.floor(i/2)*20;s+='<rect x="'+x+'" y="'+(y-8)+'" width="10" height="10" fill="'+fill+'" stroke="#59616b" stroke-width=".6"/>'+text(x+17,y+1,label,11,'fill="#59616b"');});
 s+=text(20,H-20,`${N} storeys · ${height.toFixed(1)} m${opts.floor?' · floor '+opts.floor+' highlighted':''}`,11,'fill="#8b9097"');return s+'</svg>';
}
function site(r){const lot=r.context.sitePoly;if(!lot)return '';const pmt=r.o.pmt,xs=lot.map(p=>p[0]),ys=lot.map(p=>p[1]),x=Math.min(...xs)-2,y=Math.min(...ys)-2,w=Math.max(...xs)-x+2,h=Math.max(...ys)-y+2;
 let s=`<div class="ex-site"><p class="ex-eyebrow">GROUND / SITE SERVICES · STREET AT TOP · CONFIRM LANE EDGE</p><svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" style="width:100%;max-height:400px;background:#ffffff" role="img" aria-label="Site service reservations"><polygon points="${lot.map(p=>p.join(',')).join(' ')}" fill="#f6f7f8" stroke="#8b9097" stroke-width=".12"/>`;
 for(const b of r.levels[0].g.built)s+=rect(b,'fill="#f1f2f4" stroke="#8b9097" stroke-width=".1"');
 for(const room of r.levels[0].rooms||[]){s+=rect(room,'fill="#eef0f2" stroke="#3d434b" stroke-width=".1"');s+=text(room.x+.15,room.y+room.h/2,room.name,.65,'fill="#35463b"');}
 if(pmt?.on){const c=pmt.clearance;s+=rect({x:pmt.x-c,y:pmt.y-c,w:pmt.w+2*c,h:pmt.h+2*c},'fill="none" stroke="#1a56db" stroke-dasharray=".4 .2" stroke-width=".12"');s+=rect(pmt,'fill="#e7eefb" stroke="#3d434b" stroke-width=".12"');s+=text(pmt.x+pmt.w/2,pmt.y+pmt.h/2,'PMT',.7,'text-anchor="middle"');}return s+'</svg><p class="ex-note">Dashed PMT buffer is an editable study allowance. Vehicle manoeuvring, utility routing, maintenance access and fire exposure are not checked.</p></div>';}
function orientedPlan(r,opts={}){
 if(!r.g)return plan(r,opts);
 const W=Math.max(520,opts.W||900),H=Math.max(460,opts.H||620),rot=r.context?.projectRotation??r.context?.siteRotation;
 const lot=r.context?.sitePoly||[[0,0],[r.o.W,0],[r.o.W,r.o.D],[0,r.o.D]],a=Number.isFinite(rot)?Math.cos(rot):1,b=Number.isFinite(rot)?Math.sin(rot):0,c=b,d=Number.isFinite(rot)?-a:1,project=p=>[a*p[0]+c*p[1],b*p[0]+d*p[1]],pts=lot.map(project),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),k=Math.min((W-180-(opts.schedule||0))/(maxX-minX+4),(H-170)/(maxY-minY+4)),ox=(W-(opts.schedule||0))/2-(minX+maxX)*k/2,oy=H/2-(minY+maxY)*k/2;
 const point=(x,y)=>[ox+k*(a*x+c*y),oy+k*(b*x+d*y)],inverse=(x,y)=>{const X=(x-ox)/k,Y=(y-oy)/k;return [a*X+b*Y,c*X+d*Y];};
 const raw=plan(r,{...opts,W,H}),start=raw.indexOf('<g transform="translate('),bodyStart=raw.indexOf('>',start)+1,end=raw.lastIndexOf('</g>');let body=raw.slice(bodyStart,end);
 // Keep the geometry and all editing hit targets. Annotations are composed once, in sheet coordinates.
 const dimensionStart=body.indexOf('<g data-raw-dimensions="true">');if(dimensionStart>=0)body=body.slice(0,dimensionStart);
 const warningText=body.match(/<g data-unserved="true"[^>]*>([\s\S]*?)<\/g>/)?.[1]||'';
 body=body.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g,'');
 body=body.replace(/stroke-width="([\d.]+)"/g,(all,v)=>+v<=.18?'stroke-width="'+f(Math.max(.4,Math.min(1.4,+v*10))/k)+'"':all);
 const defs=raw.match(/<defs>[\s\S]*?<\/defs>/)?.[0]||'';
 let geometry='<polygon points="'+lot.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="#747d87" stroke-width="'+f(.8/k)+'" stroke-dasharray="'+[8/k,3/k,1/k,3/k].map(f).join(' ')+'"/>'+body;
 const labels=[],placed=[],notes=[],collides=q=>placed.some(p=>q.x<p.x+p.w+4&&q.x+q.w>p.x-4&&q.y<p.y+p.h+4&&q.y+q.h>p.y-4);
 const add=(regions,lines,id,compact,sub=0,strict=false)=>{const {width,height}=labelSize(lines,sub),order=regions.slice().sort((p,q)=>q.w*q.h-p.w*p.h);
  for(const region of order)for(const [dx,dy] of [[0,0],[0,-.2],[0,.2],[-.2,0],[.2,0]]){
   const [x,y]=point(region.x+region.w*(.5+dx),region.y+region.h*(.5+dy)),box={x:x-width/2,y:y-height/2,w:width,h:height};
   const fits=[[box.x,box.y],[box.x+width,box.y],[box.x+width,box.y+height],[box.x,box.y+height]].every(p=>{const [X,Y]=inverse(...p);return X>region.x+.12&&X<region.x+region.w-.12&&Y>region.y+.12&&Y<region.y+region.h-.12;});
   if(fits&&!collides(box)){placed.push(box);labels.push(sheetLabel(x,y,lines,'',sub));return true;}
  }
  if(strict)return false;
  // a unit too small for its label inside: the label sits on the unit's centre anyway, on its white ground, when clear of others
  if(sub&&order[0]){const g=order[0],[x,y]=point(g.x+g.w/2,g.y+g.h/2),box={x:x-width/2,y:y-height/2,w:width,h:height};if(!collides(box)){placed.push(box);labels.push(sheetLabel(x,y,lines,'',sub));return;}}
  if(id!=null){const tag=compact||String(id);add(regions,[tag]);notes.push(((lines[0]===tag||lines[0].startsWith(tag+' /'))?'':tag+' · ')+lines.join(' · '));}
 };
 // Units, one rule on every floor and every plan in the tool: the plan carries the unit number and its type hatch; number, type
 // and area are listed in the unit schedule column at the side (a floor without homes says so there).
 const units=opts.coreOnly?[]:(r.units||[]),no=u=>String(root.EXPLORE.unitNo(r.level,u.id)),regionsOf=u=>u.netParts||[u.netRect,...(u.netPatches||[])],TYPE={S:'Studio','1B':'1 bed','2B':'2 bed','3B':'3 bed'};
 let schedule=null;
 if(!opts.coreOnly&&!opts.schedule)return orientedPlan(r,{...opts,schedule:170});
 if(opts.schedule)schedule=[];
 if(units.length){for(const u of units)if(!add(regionsOf(u),[no(u)],null,null,0,true)){const g=regionsOf(u).slice().sort((p,q)=>q.w*q.h-p.w*p.h)[0],[x,y]=point(g.x+g.w/2,g.y+g.h/2);labels.push(sheetLabel(x,y,[no(u)]));}schedule=units.slice().sort((p,q)=>+no(p)-+no(q)).map(u=>[no(u),TYPE[u.type]||u.type,u.net.toFixed(1)+' m²']);}
 let warningNumber=0;for(const m of warningText.matchAll(/<text x="([^"]+)" y="([^"]+)"[^>]*>([^<]+)<\/text>/g))add([{x:+m[1]-2,y:+m[2]-1,w:4,h:2}],[m[3]],'warning','U'+(++warningNumber));
 const rooms=new Map();if(!opts.coreOnly)for(const q of r.o.exclusions||[]){if(!q.name||q.on===false)continue;const key=q.roomIndex??q.gi??q.name;if(!rooms.has(key))rooms.set(key,[]);rooms.get(key).push(q);}
  // rooms and the courtyard follow the units: their tag on the plan, name and area in the key beside the schedule
 const keyed=(regions,lines,id,tag)=>{if(!opts.schedule)return add(regions,lines,id,tag);add(regions,[tag]);notes.push(tag+' · '+lines.join(' · '));};
 let roomNumber=0;for(const rs of rooms.values()){keyed(rs,[rs[0].name,rs.reduce((s,q)=>s+q.w*q.h,0).toFixed(1)+' m²'],rs[0].name,rs[0].role==='lobby'||rs[0].name==='Lobby'?'L':'R'+(++roomNumber));if(rs[0].role==='lobby'||rs[0].name==='Lobby'){const en=rs.map(q=>root.FLOOR_DESIGN?.entryFor(q,r.g,rs[0].entry)).find(Boolean);if(en)add([{x:en.x+en.dx*2.8-2,y:en.y+en.dy*2.8-.8,w:4,h:1.6}],['MAIN ENTRY'],'entry','ENTRY');}}
 for(const v of r.g.voids)keyed([v],['Courtyard',f(v.w)+' × '+f(v.h)+' m'],'court','C');
 for(const core of r.g.cores){if(core.kind==='elevator')add([core],['LIFT'],'lift','E');else if(core.kind==='scissor')add([core],['SCISSOR STAIR'],'scissor','SC');
  else{const horizontal=core.w>core.h,sw=horizontal?core.h:core.w,sl=horizontal?core.w:core.h,tr=horizontal?'translate('+(core.x+core.w)+','+core.y+') rotate(90)':'translate('+core.x+','+core.y+')';
   geometry+='<g transform="'+tr+'" fill="none" stroke="#3d434b" stroke-width="'+f(.65/k)+'">'+line(sw*.25,sl*.68,sw*.25,sl*.32)+line(sw*.25,sl*.32,sw*.25-.15,sl*.32+.22)+line(sw*.25,sl*.32,sw*.25+.15,sl*.32+.22)+line(sw*.75,sl*.32,sw*.75,sl*.68)+line(sw*.75,sl*.68,sw*.75-.15,sl*.68-.22)+line(sw*.75,sl*.68,sw*.75+.15,sl*.68-.22)+'</g>';}}
 const corridor=r.g.corridors.slice().sort((p,q)=>q.w*q.h-p.w*p.h)[0];if(corridor)add([corridor],[corridor.exterior?'EXTERIOR GALLERY':'CORRIDOR']);
 if(opts.routes)for(const e of r.route?.exits||[])if(e.point)add([{x:e.point[0]-1.5,y:e.point[1]-1.5,w:3,h:3}],['EXIT '+e.id],'exit');
 if(r.parking){const zone=r.parking.aisles[0];if(zone)add([zone],['PARKING · '+r.parking.count+' STALLS'],'parking');}
 if(opts.editCores)for(const [i,core] of r.g.cores.entries()){const [x,y]=point(core.x+core.w+.7,core.y+.7);labels.push('<g pointer-events="none">'+text(x,y+4,'↻',11,'text-anchor="middle" fill="#1a56db"')+'</g>');}
 let dimensions='';const external=[];const rotatedBox=(x,y,w,h,angle)=>{const c=Math.abs(Math.cos(angle*Math.PI/180)),s=Math.abs(Math.sin(angle*Math.PI/180)),bw=w*c+h*s,bh=w*s+h*c;return {x:x-bw/2,y:y-bh/2,w:bw,h:bh};};
 const dimension=(p0,p1,offset,value)=>{const p=point(...p0),q=point(...p1),dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy),centre=point(r.o.W/2,r.o.D/2),sign=((-dy)*((p[0]+q[0])/2-centre[0])+dx*((p[1]+q[1])/2-centre[1]))>=0?1:-1,nx=-dy/L*Math.abs(offset)*sign,ny=dx/L*Math.abs(offset)*sign,aa=[p[0]+nx,p[1]+ny],bb=[q[0]+nx,q[1]+ny];let angle=Math.atan2(dy,dx)*180/Math.PI;if(angle>90)angle-=180;if(angle<=-90)angle+=180;
  dimensions+='<g data-dimension="true" stroke="#59616b" stroke-width=".55">'+line(p[0]+nx*.15,p[1]+ny*.15,aa[0]+nx*.16,aa[1]+ny*.16)+line(q[0]+nx*.15,q[1]+ny*.15,bb[0]+nx*.16,bb[1]+ny*.16)+line(...aa,...bb);
  for(const t of [aa,bb])dimensions+=line(t[0]-2.5,t[1]+2.5,t[0]+2.5,t[1]-2.5,'stroke-width="1"');
  external.push(rotatedBox((aa[0]+bb[0])/2+8*Math.sin(angle*Math.PI/180),(aa[1]+bb[1])/2-8*Math.cos(angle*Math.PI/180),labelWidth(value)+8,15,angle));
  dimensions+='</g><g transform="translate('+f((aa[0]+bb[0])/2)+' '+f((aa[1]+bb[1])/2)+') rotate('+f(angle)+')">'+sheetLabel(0,-8,[value])+'</g>';};
 dimension([0,0],[r.o.W,0],-24,r.o.W.toFixed(2)+' m');dimension([r.o.W,0],[r.o.W,r.o.D],-24,r.o.D.toFixed(2)+' m');
 let streets='';const centre=lot.reduce((s,p)=>[s[0]+p[0]/lot.length,s[1]+p[1]/lot.length],[0,0]);
 (r.context?.siteEdges||[]).forEach((cls,i)=>{if(!['street','lane','open'].includes(cls))return;const p=lot[i],q=lot[(i+1)%lot.length],mid=[(p[0]+q[0])/2,(p[1]+q[1])/2],pa=point(...p),pb=point(...q),m=point(...mid),ctr=point(...centre),dx=m[0]-ctr[0],dy=m[1]-ctr[1],L=Math.hypot(dx,dy)||1;let angle=Math.atan2(pb[1]-pa[1],pb[0]-pa[0])*180/Math.PI;if(angle>90)angle-=180;if(angle<=-90)angle+=180;
  const name=cls==='street'?(r.context.streetNames||[]).find(n=>Math.hypot((n.a[0]+n.b[0])/2-mid[0],(n.a[1]+n.b[1])/2-mid[1])<3)?.name:null;
  const edgeSide=Math.abs(q[0]-p[0])>=Math.abs(q[1]-p[1])?(mid[1]>centre[1]?'bottom':'top'):(mid[0]>centre[0]?'right':'left'),isFront=cls==='street'&&edgeSide===root.FLOOR_DESIGN?.articulationFront(r.context),label=(name||(cls==='street'&&!isFront?'FLANKING STREET':cls.toUpperCase()))+(isFront?' · FRONT':'');let x,y,box;for(let offset=22;offset<=76;offset+=18){x=m[0]+dx/L*offset;y=m[1]+dy/L*offset;box=rotatedBox(x,y,labelWidth(label)+8,15,angle);if(!external.some(q=>box.x<q.x+q.w+4&&box.x+box.w>q.x-4&&box.y<q.y+q.h+4&&box.y+box.h>q.y-4))break;}external.push(box);
  streets+='<g data-site-label="true" transform="translate('+f(x)+' '+f(y)+') rotate('+f(angle)+')">'+sheetLabel(0,0,[label])+'</g>';});
 if(r.level===1&&r.o.pmt?.on&&!opts.coreOnly){const q=r.o.pmt;if(q.placed===true){const clear=q.clearance||0;geometry+=rect({x:q.x-clear,y:q.y-clear,w:q.w+2*clear,h:q.h+2*clear},'fill="none" stroke="#59616b" stroke-dasharray=".4 .2" stroke-width="'+f(.55/k)+'"');geometry+=rect(q,'fill="#eef0f2" stroke="#59616b" stroke-width="'+f(.8/k)+'"');add([q],['PMT'],'PMT');}else if(q.placed===false)notes.push('PMT · no fit at selected corner');}
 const totalH=H+(schedule?0:notes.length*18); // with a schedule, the notes join it in the side column
 // unit-type key: the hatch of each type used on this floor, read right to left from the corner
 const used=['S','1B','2B','3B'].filter(t=>!opts.coreOnly&&(r.units||[]).some(u=>u.type===t)),names={S:'Studio','1B':'1 bed','2B':'2 bed','3B':'3 bed'};let typeKey=used.length?'<defs>'+[['k1',5],['k2',3.2],['k3',2]].map(([id,d])=>'<pattern id="'+id+'" width="'+d+'" height="'+d+'" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="'+d+'" height="'+d+'" fill="#ffffff"/><path d="M0 0V'+d+'" stroke="#8b9097" stroke-width=".8"/></pattern>').join('')+'</defs>':'';const swatch={S:'#ffffff','1B':'url(#k1)','2B':'url(#k2)','3B':'url(#k3)'};used.slice().reverse().forEach((t,i)=>{const x=W-24-(i+1)*64;typeKey+='<rect x="'+x+'" y="'+(totalH-54)+'" width="12" height="12" fill="'+swatch[t]+'" stroke="#3d434b" stroke-width=".8"/>'+text(x+17,totalH-44,names[t],11,'fill="#3d434b"');});
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+totalH+'" role="img" aria-label="Architectural floor plan" style="font-family:Geist,Arial,Helvetica,sans-serif">'+defs+'<rect width="'+W+'" height="'+totalH+'" fill="#ffffff"/>'+titleBlock(opts.title||'Floor '+(r.level||1)+' · plan')+'<g data-plan-frame="true" transform="matrix('+[k*a,k*b,k*c,k*d,ox,oy].join(' ')+')" stroke="#111417" stroke-width="'+f(.6/k)+'">'+geometry+'</g>'+dimensions+streets+labels.join('')+'<path d="M'+(W-32)+' 58V35m-3 6 3-6 3 6" fill="none" stroke="#3d434b" stroke-width="1"/>'+text(W-32,25,r.context?.projectRotation!=null?'PN':'N',11,'text-anchor="middle" fill="#3d434b"')+(schedule?'':notes.map((s,i)=>text(24,H-45+i*18,s,11,'fill="#3d434b"')).join(''))+(schedule?(()=>{const x0=W-24-opts.schedule+14,y0=86;return text(x0,y0,'UNIT SCHEDULE',11,'fill="#59616b" letter-spacing=".06em"')+`<path d="M${x0} ${y0+7}h${opts.schedule-14}" stroke="#c9ccd0" stroke-width="1"/>`+(schedule.length?'':text(x0,y0+26,'No homes on this floor',9,'fill="#59616b"'))+schedule.map(([n,t,a],i)=>text(x0,y0+26+i*17,n,11,'fill="#111417" font-weight="500"')+text(x0+36,y0+26+i*17,t,9,'fill="#59616b"')+text(W-24,y0+26+i*17,a,9,'text-anchor="end" fill="#59616b"')).join('')+(notes.length?(()=>{const y1=y0+26+Math.max(1,schedule.length)*17+14;return text(x0,y1,'KEY',11,'fill="#59616b" letter-spacing=".06em"')+`<path d="M${x0} ${y1+7}h${opts.schedule-14}" stroke="#c9ccd0" stroke-width="1"/>`+notes.map((n,i)=>text(x0,y1+26+i*17,n,9,'fill="#3d434b"')).join('');})():'');})():'')+'<path d="M24 '+(totalH-24)+'h'+f(5*k)+'" stroke="#3d434b" stroke-width="1.5"/>'+text(24,totalH-33,'0',11)+text(24+5*k,totalH-33,'5 m',11,'text-anchor="end"')+typeKey+text(W-24,totalH-24,(r.context?.projectRotation!=null?'PROJECT NORTH':Number.isFinite(rot)?'NORTH UP':'PLAN')+' · SCHEMATIC',11,'text-anchor="end" fill="#59616b"')+'</svg>';
}
root.EXPLORE_DRAW={plan:orientedPlan,axon,site,colors,esc,windows};
})(typeof window!=='undefined'?window:globalThis);
