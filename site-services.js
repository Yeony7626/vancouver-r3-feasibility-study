/* PMT reservations are anchored to actual lane endpoints, in site coordinates. */
(function(root){'use strict';
const E=root.EXPLORE;
function laneCorners(ctx){
 const poly=ctx.sitePoly||[],segments=(ctx.siteEdges||[]).flatMap((t,i)=>t==='lane'&&poly[i]?[[poly[i],poly[(i+1)%poly.length]]]:[]);
 segments.sort((a,b)=>Math.hypot(b[1][0]-b[0][0],b[1][1]-b[0][1])-Math.hypot(a[1][0]-a[0][0],a[1][1]-a[0][1]));
 if(!segments.length)return null;
 const [a,b]=segments[0],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],centre=poly.reduce((q,p)=>[q[0]+p[0]/poly.length,q[1]+p[1]/poly.length],[0,0]),out=[mid[0]-centre[0],mid[1]-centre[1]],right=p=>(p[0]-mid[0])*out[1]-(p[1]-mid[1])*out[0];
 return right(a)<right(b)?{left:a,right:b,lane:[a,b]}:{left:b,right:a,lane:[a,b]};
}
function placePMT(input,ctx,built=[]){
 const p={...input},corners=laneCorners(ctx),fail=reason=>({...p,placed:false,reason});
 if(!corners)return fail('No classified lane edge: a lane-corner PMT location cannot be established.');
 const anchor=corners[p.corner==='left'?'left':'right'];p.anchor=anchor.slice();
 const c=p.clearance,w=p.w+2*c,h=p.h+2*c;if(![w,h,c].every(Number.isFinite)||w<=0||h<=0||c<0)return fail('Enter positive PMT dimensions and a non-negative study buffer.');
 const poly=ctx.sitePoly;if(!E.convex(poly))return fail('PMT corner placement needs review on this non-convex site.');
 // The pad itself must sit inside the site and clear of the building, as close to the chosen lane corner as possible.
 // The dashed buffer is a study allowance: overlapping the building or the property line is flagged, not forbidden.
 const verts=r=>[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]],candidates=[],reach=10;
 for(let dx=-reach;dx<=reach+.001;dx+=.25)for(let dy=-reach;dy<=reach+.001;dy+=.25){const pad={x:anchor[0]+dx-p.w/2,y:anchor[1]+dy-p.h/2,w:p.w,h:p.h};
  if(!verts(pad).every(v=>E.inPoly(v,poly))||built.some(b=>E.overlap(pad,b)))continue;
  const buffer={x:pad.x-c,y:pad.y-c,w,h},clean=verts(buffer).every(v=>E.inPoly(v,poly))&&!built.some(b=>E.overlap(buffer,b));
  candidates.push({pad,score:Math.hypot(dx,dy)+(clean?0:4)});
 }
 candidates.sort((a,b)=>a.score-b.score);
 if(!candidates.length)return fail(`The ${p.corner} lane corner cannot accommodate the PMT pad. Revise the footprint or selected corner.`);
 const q=candidates[0].pad;return {...p,x:q.x,y:q.y,placed:true,reason:null};
}
root.SITE_SERVICES={laneCorners,placePMT};
})(typeof window!=='undefined'?window:globalThis);
