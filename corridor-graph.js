/* Corridors as editable centrelines. The user edits nodes and segments; corridor rectangles of the set width are generated
   around them. All segments stay orthogonal: moving a node re-routes any segment that would go diagonal as an L. Metres. */
(function(root){'use strict';
const TOL=.08,key=p=>p.map(v=>v.toFixed(2)).join(',');
// Rectangles (as the router and engine store them) to a graph of nodes and orthogonal edges.
function fromRects(rects,cw){const half=cw/2,segs=[],pts=[];
 for(const r of rects||[]){const h=r.w>=r.h;if(h){const y=r.y+r.h/2,x1=r.x+half,x2=r.x+r.w-half;if(x2-x1<TOL)pts.push([(x1+x2)/2,y]);else segs.push([[x1,y],[x2,y]]);}else{const x=r.x+r.w/2,y1=r.y+half,y2=r.y+r.h-half;if(y2-y1<TOL)pts.push([x,(y1+y2)/2]);else segs.push([[x,y1],[x,y2]]);}}
 // A run whose end sits inside a crossing corridor (rectangles overlap at a T) is extended onto that corridor's centreline.
 for(const s of segs)for(const end of [0,1]){const p=s[end],h=Math.abs(s[0][1]-s[1][1])<TOL,dir=end?1:-1;
  for(const t of segs){if(t===s)continue;const th=Math.abs(t[0][1]-t[1][1])<TOL;if(th===h)continue;
   if(h){const x=t[0][0],y0=Math.min(t[0][1],t[1][1]),y1=Math.max(t[0][1],t[1][1]),gap=(x-p[0])*dir;if(gap>TOL&&gap<=cw+TOL&&p[1]>y0-half-TOL&&p[1]<y1+half+TOL){p[0]=x;break;}}
   else{const y=t[0][1],x0=Math.min(t[0][0],t[1][0]),x1=Math.max(t[0][0],t[1][0]),gap=(y-p[1])*dir;if(gap>TOL&&gap<=cw+TOL&&p[0]>x0-half-TOL&&p[0]<x1+half+TOL){p[1]=y;break;}}}}
 const nodes=[],find=p=>{let i=nodes.findIndex(q=>Math.abs(q[0]-p[0])<TOL&&Math.abs(q[1]-p[1])<TOL);if(i<0){nodes.push([+p[0].toFixed(3),+p[1].toFixed(3)]);i=nodes.length-1;}return i;};
 for(const s of segs){find(s[0]);find(s[1]);}for(const p of pts)find(p);
 // crossings become junctions
 for(const a of segs)for(const b of segs){if(a===b)continue;const ah=Math.abs(a[0][1]-a[1][1])<TOL,bh=Math.abs(b[0][1]-b[1][1])<TOL;if(ah===bh)continue;const H=ah?a:b,V=ah?b:a,x=V[0][0],y=H[0][1];
  if(x>Math.min(H[0][0],H[1][0])-TOL&&x<Math.max(H[0][0],H[1][0])+TOL&&y>Math.min(V[0][1],V[1][1])-TOL&&y<Math.max(V[0][1],V[1][1])+TOL)find([x,y]);}
 const edges=[];
 for(const s of segs){const h=Math.abs(s[0][1]-s[1][1])<TOL,k=h?0:1,lo=Math.min(s[0][k],s[1][k]),hi=Math.max(s[0][k],s[1][k]),c=s[0][1-k];
  const on=nodes.map((p,i)=>({p,i})).filter(({p})=>Math.abs(p[1-k]-c)<TOL&&p[k]>lo-TOL&&p[k]<hi+TOL).sort((a,b)=>a.p[k]-b.p[k]);
  for(let j=1;j<on.length;j++){const e=[on[j-1].i,on[j].i];if(e[0]!==e[1]&&!edges.some(f=>(f[0]===e[0]&&f[1]===e[1])||(f[0]===e[1]&&f[1]===e[0])))edges.push(e);}}
 return tidy({nodes,edges});}
// Graph to corridor rectangles, one per straight run: collinear edges through a junction stay one rectangle, as the router
// lays them, so unit fitting sees the same bands. A lone node is a square landing.
function toRects(g,cw){const half=cw/2,out=[],used=new Set(),hz=([a,b])=>Math.abs(g.nodes[a][1]-g.nodes[b][1])<TOL;
 const next=(k,at)=>{const h=hz(g.edges[k]),from=g.edges[k][0]===at?g.edges[k][1]:g.edges[k][0],dir=Math.sign(h?g.nodes[at][0]-g.nodes[from][0]:g.nodes[at][1]-g.nodes[from][1]);
  return g.edges.findIndex((e,j)=>{if(j===k||used.has(j)||(e[0]!==at&&e[1]!==at)||hz(e)!==h)return false;const o=e[0]===at?e[1]:e[0];return Math.sign(h?g.nodes[o][0]-g.nodes[at][0]:g.nodes[o][1]-g.nodes[at][1])===dir;});};
 g.edges.forEach((e,k)=>{if(used.has(k))return;used.add(k);const pts=[g.nodes[e[0]],g.nodes[e[1]]];for(const end of [0,1]){let at=e[end],kk=k;for(;;){const j=next(kk,at);if(j<0)break;used.add(j);at=g.edges[j][0]===at?g.edges[j][1]:g.edges[j][0];pts.push(g.nodes[at]);kk=j;}}
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x=Math.min(...xs)-half,y=Math.min(...ys)-half;out.push({x:+x.toFixed(3),y:+y.toFixed(3),w:+(Math.max(...xs)-Math.min(...xs)+cw).toFixed(3),h:+(Math.max(...ys)-Math.min(...ys)+cw).toFixed(3),kind:'circulation',axis:hz(e)?'x':'y'});});
 g.nodes.forEach((p,i)=>{if(!g.edges.some(e=>e[0]===i||e[1]===i))out.push({x:p[0]-half,y:p[1]-half,w:cw,h:cw,kind:'circulation',axis:'x'});});return out;}
// Keep the router's own rectangle (and its flags) wherever a rebuilt run matches one exactly.
function keepFlags(rects,prev){return rects.map(r=>{const q=(prev||[]).find(p=>['x','y','w','h'].every(k=>Math.abs(p[k]-r[k])<.02));return q?{...q}:r;});}
const clone=g=>({nodes:g.nodes.map(p=>p.slice()),edges:g.edges.map(e=>e.slice())});
// Merge coincident nodes, drop zero-length edges and orphans, and join straight runs through degree-2 nodes.
function tidy(g){g=clone(g);let changed=true;
 while(changed){changed=false;
  for(let i=0;i<g.nodes.length&&!changed;i++)for(let j=i+1;j<g.nodes.length&&!changed;j++)if(Math.abs(g.nodes[i][0]-g.nodes[j][0])<TOL&&Math.abs(g.nodes[i][1]-g.nodes[j][1])<TOL){g.edges=g.edges.map(e=>e.map(v=>v===j?i:v>j?v-1:v));g.nodes.splice(j,1);changed=true;}
  const before=g.edges.length;g.edges=g.edges.filter(e=>e[0]!==e[1]).filter((e,k,a)=>a.findIndex(f=>(f[0]===e[0]&&f[1]===e[1])||(f[0]===e[1]&&f[1]===e[0]))===k);if(g.edges.length!==before)changed=true;
  for(let i=0;i<g.nodes.length&&!changed;i++){const inc=g.edges.map((e,k)=>({e,k})).filter(({e})=>e[0]===i||e[1]===i);if(inc.length!==2)continue;const o=inc.map(({e})=>e[0]===i?e[1]:e[0]),p=g.nodes[i],a=g.nodes[o[0]],b=g.nodes[o[1]];
   const straight=(Math.abs(a[1]-p[1])<TOL&&Math.abs(b[1]-p[1])<TOL&&(a[0]-p[0])*(b[0]-p[0])<0)||(Math.abs(a[0]-p[0])<TOL&&Math.abs(b[0]-p[0])<TOL&&(a[1]-p[1])*(b[1]-p[1])<0);
   if(straight&&!g.keep?.includes(key(p))){g.edges=g.edges.filter((_,k)=>k!==inc[0].k&&k!==inc[1].k);g.edges.push([o[0],o[1]]);changed=true;}}}
 // renumber, removing nodes no edge uses unless they are landings in an edge-less graph
 if(g.edges.length){const used=[...new Set(g.edges.flat())].sort((a,b)=>a-b),map=new Map(used.map((v,i)=>[v,i]));g.nodes=used.map(i=>g.nodes[i]);g.edges=g.edges.map(e=>e.map(v=>map.get(v)));}
 return g;}
// Move nodes together (map index -> point). Any edge that would turn diagonal becomes an L through an elbow that keeps the fixed end's direction.
function moveNodes(g0,moves,valid=()=>true){const g=clone(g0),old=new Map();for(const [i,p] of Object.entries(moves)){old.set(+i,g.nodes[i].slice());g.nodes[i]=[+p[0].toFixed(3),+p[1].toFixed(3)];}
 const moved=new Set(old.keys()),n0=g.edges.length;
 for(let k=0;k<n0;k++){const [a,b]=g.edges[k],A=g.nodes[a],B=g.nodes[b];if(Math.abs(A[0]-B[0])<TOL||Math.abs(A[1]-B[1])<TOL)continue;
  const i=moved.has(a)?a:b,j=i===a?b:a,n=g.nodes[i],q=g.nodes[j],o=old.get(i)||n,wasH=Math.abs((old.get(j)||q)[1]-o[1])<TOL;
  const elbowA=wasH?[n[0],q[1]]:[q[0],n[1]],elbowB=wasH?[q[0],n[1]]:[n[0],q[1]],elbow=valid(q,elbowA,n)?elbowA:valid(q,elbowB,n)?elbowB:elbowA;
  g.nodes.push(elbow);const m=g.nodes.length-1;g.edges[k]=[j,m];g.edges.push([m,i]);}
 return tidy(g);}
function moveNode(g,i,p,valid){return moveNodes(g,{[i]:p},valid);}
// Shift an edge across its own axis by d; both ends move together and their other connections re-route.
function moveEdge(g,k,d,valid){const [a,b]=g.edges[k],h=Math.abs(g.nodes[a][1]-g.nodes[b][1])<TOL,sh=p=>h?[p[0],p[1]+d]:[p[0]+d,p[1]];return moveNodes(g,{[a]:sh(g.nodes[a]),[b]:sh(g.nodes[b])},valid);}
function deleteEdge(g0,k){const g=clone(g0);g.edges.splice(k,1);return tidy(g);}
// Split edge k at point p (projected onto it); returns [graph, node index].
function splitAt(g0,k,p){const g=clone(g0),[a,b]=g.edges[k],A=g.nodes[a],B=g.nodes[b],h=Math.abs(A[1]-B[1])<TOL,q=h?[Math.min(Math.max(p[0],Math.min(A[0],B[0])),Math.max(A[0],B[0])),A[1]]:[A[0],Math.min(Math.max(p[1],Math.min(A[1],B[1])),Math.max(A[1],B[1]))];
 let i=g.nodes.findIndex(n=>Math.abs(n[0]-q[0])<TOL&&Math.abs(n[1]-q[1])<TOL);if(i<0){g.nodes.push(q);i=g.nodes.length-1;g.edges.splice(k,1,[a,i],[i,b]);}return [g,i];}
// Connect two points (existing nodes or new ones) with a straight run, or an L when they are not aligned.
function connect(g0,p,q,valid=()=>true){const g=clone(g0),node=pt=>{let i=g.nodes.findIndex(n=>Math.abs(n[0]-pt[0])<TOL&&Math.abs(n[1]-pt[1])<TOL);if(i<0){g.nodes.push([+pt[0].toFixed(3),+pt[1].toFixed(3)]);i=g.nodes.length-1;}return i;};
 const a=node(p),b=node(q);if(a===b)return g;const A=g.nodes[a],B=g.nodes[b];
 if(Math.abs(A[0]-B[0])<TOL||Math.abs(A[1]-B[1])<TOL){g.edges.push([a,b]);return tidy(g);}
 const e1=[B[0],A[1]],e2=[A[0],B[1]],elbow=valid(A,e1,B)?e1:valid(A,e2,B)?e2:e1,m=node(elbow);g.edges.push([a,m],[m,b]);return tidy(g);}
// A corridor run from a to b through elbow e is valid if both legs, at corridor width, stay on the plate and clear of obstacles.
function legsValid(cw,okRect){const half=cw/2,leg=(p,q)=>({x:Math.min(p[0],q[0])-half,y:Math.min(p[1],q[1])-half,w:Math.abs(p[0]-q[0])+cw,h:Math.abs(p[1]-q[1])+cw});return (a,e,b)=>okRect(leg(a,e))&&okRect(leg(e,b));}
function nearestEdge(g,p){let best=null;g.edges.forEach(([a,b],k)=>{const A=g.nodes[a],B=g.nodes[b],h=Math.abs(A[1]-B[1])<TOL,q=h?[Math.min(Math.max(p[0],Math.min(A[0],B[0])),Math.max(A[0],B[0])),A[1]]:[A[0],Math.min(Math.max(p[1],Math.min(A[1],B[1])),Math.max(A[1],B[1]))],d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(!best||d<best.d)best={k,q,d};});return best;}
root.CORRIDOR_GRAPH={fromRects,toRects,keepFlags,tidy,moveNode,moveNodes,moveEdge,deleteEdge,splitAt,connect,legsValid,nearestEdge};
})(typeof window!=='undefined'?window:globalThis);
