/* Surroundings for the 3D views: neighbouring parcels and their buildings within a band around the site, in the site's local
   frame. Parcel outlines are City geometry; the gaps between them are the streets and lane. Neighbour footprints and heights
   are the stated guess in window.CONTEXT (parcel inset, height by zone), so the drawings label them as approximate. */
(function(root){'use strict';
const RADIUS=15,cache=new Map();
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[i],r=p[(i+1)%p.length];a+=q[0]*r[1]-r[0]*q[1];}return a/2;};
const inside=(pt,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
// Sutherland–Hodgman against an axis-aligned rectangle.
function clip(poly,b){let out=poly;for(const [k,v,keep] of [[0,b.x0,1],[0,b.x1,-1],[1,b.y0,1],[1,b.y1,-1]]){const src=out;out=[];if(!src.length)break;
 for(let i=0;i<src.length;i++){const p=src[i],q=src[(i+1)%src.length],pin=(p[k]-v)*keep>=0,qin=(q[k]-v)*keep>=0;if(pin)out.push(p);if(pin!==qin){const t=(v-p[k])/(q[k]-p[k]);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}}
 return out.length>=3&&Math.abs(area(out))>.5?out:null;}
/* fr: the site frame (fr.T maps UTM to local metres); lot: the site polygon in that frame; offset: subtracted from every point,
   so callers working in another origin (the design plate) get their own coordinates. Returns null when no data is loaded. */
function near(fr,lot,{radius=RADIUS,offset=[0,0],site=root.SITE?.current?.()}={}){const C=root.CONTEXT;if(!C||!fr?.T||!lot?.length)return null;
 const key=JSON.stringify([site?.ids,lot.map(p=>p.map(v=>+v.toFixed(2))),radius,offset]);if(cache.has(key))return cache.get(key);
 const [ox,oy]=C.origin,xs=lot.map(p=>p[0]),ys=lot.map(p=>p[1]),band={x0:Math.min(...xs)-radius,x1:Math.max(...xs)+radius,y0:Math.min(...ys)-radius,y1:Math.max(...ys)+radius};
 const toLocal=q=>fr.T([ox+q[0]/10,oy+q[1]/10]),reach=radius+80,parcels=[],buildings=[];
 for(const it of C.items){const p0=toLocal(it.ring[0]);if(p0[0]<band.x0-reach||p0[0]>band.x1+reach||p0[1]<band.y0-reach||p0[1]>band.y1+reach)continue;
  const ring=it.ring.map(toLocal),c=ring.reduce((s,p)=>[s[0]+p[0]/ring.length,s[1]+p[1]/ring.length],[0,0]);if(inside(c,lot))continue;
  const g=clip(ring,band);if(!g)continue;parcels.push({poly:g,zone:it.z});
  const fp=it.fp&&clip(it.fp.map(toLocal),band);if(fp&&Math.abs(area(fp))>=6)buildings.push({poly:fp,parcel:g,h:it.h,zone:it.z});}
 const sh=p=>[p[0]-offset[0],p[1]-offset[1]],out={radius,band:{x0:band.x0-offset[0],x1:band.x1-offset[0],y0:band.y0-offset[1],y1:band.y1-offset[1]},parcels:parcels.map(q=>({...q,poly:q.poly.map(sh)})),buildings:buildings.map(q=>({...q,poly:q.poly.map(sh),parcel:q.parcel.map(sh)})),streets:streets(site,fr).map(q=>({...q,a:sh(q.a),b:sh(q.b)})),lot:lot.map(sh)};
 if(cache.size>40)cache.clear();cache.set(key,out);return out;}
/* Street names for the site's street edges, from parcel addresses. A parcel votes for an edge when one of its street edges runs
   parallel to it on the same line (a neighbour along the street) or 10–32 m across it (the far side of the street). Lots with a
   single street edge vote; corner lots do not, because their address is often on the other street. No vote, no name.
   A name votes only for an edge parallel to its street: each name's axis is the length-weighted mean of the street edges of
   all single-street lots that carry it, so a split tax lot addressed to the avenue cannot name the cross street. */
const nameOf=a=>(a||'').replace(/^\s*[\d-]+[A-Z]?\s+/,'').trim();
let axes=null,axesP=null;
function axisOf(P){if(axes&&axesP===P)return axes;axes=new Map();axesP=P;for(const q of P){if(!q.utm||!q.ecls)continue;const js=q.ecls.map((c,j)=>c==='street'?j:-1).filter(j=>j>=0);if(js.length!==1)continue;
  const u=q.utm,p0=u[js[0]],p1=u[(js[0]+1)%u.length],dx=p1[0]-p0[0],dy=p1[1]-p0[1],L=Math.hypot(dx,dy);if(L<3)continue;const t=2*Math.atan2(dy,dx),nm=nameOf(q.addr),v=axes.get(nm)||[0,0,0,0];v[0]+=L*Math.cos(t);v[1]+=L*Math.sin(t);v[2]+=L;v[3]++;axes.set(nm,v);}
 return axes;}
// true unless the name's street clearly runs across direction d (a unit vector); a curving street, or one seen on under 8 lots, passes
const along=(P,nm,d)=>{const v=axisOf(P).get(nm);if(!v||v[3]<8||Math.hypot(v[0],v[1])<.8*v[2])return true;const f=Math.atan2(v[1],v[0])/2;return Math.abs(Math.cos(f)*d[1]-Math.sin(f)*d[0])<.26;};
function streets(site,fr){const P=root.SITE?.P;if(!P||!site?.utm||!site.ecls||!fr?.T)return [];const own=new Set(site.ids||[]),ring=site.utm,n=ring.length,out=[];
 for(let i=0;i<n;i++){if(site.ecls[i]!=='street')continue;const a=ring[i],b=ring[(i+1)%n],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<3)continue;
  const d=[(b[0]-a[0])/L,(b[1]-a[1])/L],nr=[-d[1],d[0]],votes=new Map(),vote=(nm,w)=>{if(nm)votes.set(nm,(votes.get(nm)||0)+w);};
  P.forEach((q,k)=>{if(own.has(k)||!q.utm||!q.ecls)return;const u=q.utm;if(Math.abs(u[0][0]-a[0])>220||Math.abs(u[0][1]-a[1])>220)return;const js=q.ecls.map((c,j)=>c==='street'?j:-1).filter(j=>j>=0);
   for(const j of js){const p0=u[j],p1=u[(j+1)%u.length],l=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);if(l<3)continue;const e=[(p1[0]-p0[0])/l,(p1[1]-p0[1])/l];if(Math.abs(e[0]*d[1]-e[1]*d[0])>.26)continue;
    const m=[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2],off=Math.abs((m[0]-a[0])*nr[0]+(m[1]-a[1])*nr[1]),t=(m[0]-a[0])*d[0]+(m[1]-a[1])*d[1];if(t<-160||t>L+160)continue;
    if(js.length===1&&(off<3||(off>10&&off<32))){const nm=nameOf(q.addr);if(along(P,nm,d))vote(nm,1);}}});
  const best=[...votes].sort((x,y)=>y[1]-x[1])[0];out.push({name:best?.[0]||null,a:fr.T(a),b:fr.T(b),d});}
 // The site's own address names one of its streets: give it to the single street edge the vote left unnamed, if it runs that way.
 const own0=nameOf(String(site.addr||'').split(' + ')[0].replace(/ \(\d+ parcels\)$/,'')),blank=out.filter(q=>!q.name);if(own0&&blank.length===1&&!out.some(q=>q.name===own0)&&along(P,own0,blank[0].d))blank[0].name=own0;
 return out.filter(q=>q.name).map(({d,...q})=>q);}
// Viewer preference, kept per browser.
let on=true;try{on=localStorage.getItem('r3-context')!=='off';}catch(e){}
root.SITE_CONTEXT={near,streets,area,RADIUS,get on(){return on;},set on(v){on=!!v;try{localStorage.setItem('r3-context',on?'on':'off');}catch(e){}}};
})(typeof window!=='undefined'?window:globalThis);
