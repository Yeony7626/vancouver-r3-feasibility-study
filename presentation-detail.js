/* Local architectural finishes and planting. All added detail is illustrative;
   opening positions, plate boundaries and circulation remain design geometry. */
(function(root){'use strict';
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function finish(color,kind='mineral'){
 const T=root.THREE,size=256,data=new Uint8Array(size*size*4),rand=random(819);for(let y=0;y<size;y++)for(let x=0;x<size;x++){let value=244+rand()*11;if(kind==='brick'){const course=Math.floor(y/32),joint=y%32<2||(x+(course%2)*64)%128<2;value=joint?191:231+rand()*20;}if(kind==='timber')value=x%32<2?178:222+14*Math.sin(x*.8)+rand()*12;if(kind==='asphalt')value=206+rand()*48;const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;}
 const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(kind==='brick'?1/.48:kind==='timber'?1:2,kind==='brick'?1/.6:kind==='timber'?.25:2);texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
 const mat=new T.MeshStandardMaterial({color,map:texture,bumpMap:texture,bumpScale:kind==='brick'?.004:kind==='timber'?.008:.003,roughness:kind==='asphalt'?.94:.83,side:T.DoubleSide});mat.userData.finish=kind;return mat;
}
function quad(points,mat,parent,tag){const T=root.THREE,vs=points.map(p=>new T.Vector3(p[0],p[2],-p[1])),geo=new T.BufferGeometry().setFromPoints(vs);geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();const flat=points.every(p=>Math.abs(p[2]-points[0][2])<1e-5),axis=Math.abs(points[1][0]-points[0][0])>Math.abs(points[1][1]-points[0][1])?0:1;geo.setAttribute('uv',new T.Float32BufferAttribute(points.flatMap(p=>flat?[p[0],p[1]]:[p[axis],p[2]]),2));const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;if(tag)mesh.userData.detail=tag;parent.add(mesh);return mesh;}
function shell(solid,l,z,h,wall,parent,entrance,accents){
 const openings=root.EXPLORE_DRAW.windows(l).map(w=>({...w,base:z+w.sill,top:Math.min(z+h-.25,z+w.sill+w.height)}));
 if(entrance)openings.push({side:entrance.side,v:['top','bottom'].includes(entrance.side)?entrance.y:entrance.x,a:(['top','bottom'].includes(entrance.side)?entrance.x:entrance.y)-.65,z:(['top','bottom'].includes(entrance.side)?entrance.x:entrance.y)+.65,base:.08,top:2.43});
 for(const e of root.CORRIDOR_NETWORK.boundaries(solid,{...l.o,edges:{front:true,rear:true,left:true,right:true}})){
  const horizontal=['top','bottom'].includes(e.side),lo=Math.min(...solid.map(p=>horizontal?p.y:p.x)),hi=Math.max(...solid.map(p=>horizontal?p.y+p.h:p.x+p.w)),recessed=e.v>lo+.1&&e.v<hi-.1,finish=recessed&&accents?accents.timber:wall,sign=['top','left'].includes(e.side)?-1:1,pt=(a,b,depth=0)=>horizontal?[a,e.v-sign*depth,b]:[e.v-sign*depth,a,b];let pieces=[{x:e.a,y:z,w:e.z-e.a,h}];
  for(const w of openings.filter(w=>w.side===e.side&&Math.abs(w.v-e.v)<.01)){const cut={x:w.a,y:w.base,w:w.z-w.a,h:w.top-w.base};pieces=pieces.flatMap(p=>root.FLOOR_DESIGN.subtract(p,cut));const lo=Math.max(e.a,w.a),hi=Math.min(e.z,w.z);if(hi<=lo)continue;const corners=[[lo,w.base],[hi,w.base],[hi,w.top],[lo,w.top]];for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];quad([pt(...a),pt(...b),pt(...b,.18),pt(...a,.18)],finish,parent,'window-reveal');}}
  for(const p of pieces)quad([pt(p.x,p.y),pt(p.x+p.w,p.y),pt(p.x+p.w,p.y+p.h),pt(p.x,p.y+p.h)],finish,parent,'facade');
  if(accents){
   const stroke=(a,b,radius)=>{const T=root.THREE,start=new T.Vector3(a[0],a[2],-a[1]),end=new T.Vector3(b[0],b[2],-b[1]),delta=end.clone().sub(start),mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,delta.length(),5),accents.ink);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());mesh.userData.detail='project-outline';parent.add(mesh);};
   stroke(pt(e.a,z,-.012),pt(e.a,z+h,-.012),.026);stroke(pt(e.z,z,-.012),pt(e.z,z+h,-.012),.026);
   stroke(pt(e.a,z+h-.018,-.012),pt(e.z,z+h-.018,-.012),.018);
   // A shallow band and fine joints articulate existing walls without moving them.
   const strip=(a,b,base,top,mat,tag)=>top>base&&quad([pt(a,base,-.009),pt(b,base,-.009),pt(b,top,-.009),pt(a,top,-.009)],mat,parent,tag);
   strip(e.a,e.z,z+h-.12,z+h,accents.coping,'floor-edge');
   if(!recessed&&wall.userData.finish!=='brick')for(let a=Math.ceil(e.a/1.5)*1.5;a<e.z;a+=1.5)for(const p of pieces){if(a<=p.x+.015||a>=p.x+p.w-.015)continue;strip(a-.004,a+.004,p.y,Math.min(p.y+p.h,z+h-.12),accents.joint,'panel-joint');}
   if(recessed)for(let a=Math.ceil(e.a/.12)*.12;a<e.z;a+=.12)for(const p of pieces){if(a<=p.x+.01||a>=p.x+p.w-.01)continue;strip(a-.006,a+.006,p.y,p.y+p.h,accents.joint,'timber-joint');}
  }
 }
 // Slabs close each level without filling the window recesses with solid boxes.
 for(const p of solid)for(const height of [z+.03,z+h])quad([[p.x,p.y,height],[p.x+p.w,p.y,height],[p.x+p.w,p.y+p.h,height],[p.x,p.y+p.h,height]],wall,parent,'slab');
}
function windowDressing(w,base,top,parent,style){
 const T=root.THREE,horizontal=['top','bottom'].includes(w.side),sign=['top','left'].includes(w.side)?-1:1;
 let seed=17;for(const ch of w.id)seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
 const rand=random(seed),warm=style==='warm'&&rand()>.6,width=w.z-w.a;
 const mat=new T.MeshStandardMaterial({color:warm?0xc9b79a:0xaaa79d,roughness:1,side:T.DoubleSide,emissive:warm?0x8b6136:0,emissiveIntensity:.22});
 const pt=(a,z,depth)=>horizontal?[a,w.v-sign*depth,z]:[w.v-sign*depth,a,z];
 quad([pt(w.a,base,.65),pt(w.z,base,.65),pt(w.z,top,.65),pt(w.a,top,.65)],mat,parent,'interior-backing');
 const fabric=new T.MeshStandardMaterial({color:0xe7e0d2,roughness:1,side:T.DoubleSide}),cover=.15+rand()*.25,vertices=[],indices=[];
 for(const left of [true,false]){const a=left?w.a:w.z-width*cover,b=left?w.a+width*cover:w.z,n=Math.ceil((b-a)/.04);
 for(let i=0;i<n;i++){const x=a+(b-a)*i/n,y=a+(b-a)*(i+1)/n,d=.29+(i%2)*.025;
 const offset=vertices.length/3;for(const p of [pt(x,base,d),pt(y,base,.315-(i%2)*.025),pt(y,top,.315-(i%2)*.025),pt(x,top,d)])vertices.push(p[0],p[2],-p[1]);indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();const curtains=new T.Mesh(geometry,fabric);curtains.userData.detail='curtain';curtains.receiveShadow=true;parent.add(curtains);
}
function tree(x,y,parent,seed=1,scale=1){const T=root.THREE,rand=random(seed),trunk=new T.MeshStandardMaterial({color:0x71634e,roughness:1}),leaf=new T.MeshStandardMaterial({color:0xffffff,roughness:.88,side:T.DoubleSide});
 const shape=new T.Shape();shape.moveTo(0,-1);shape.bezierCurveTo(.65,-.45,.5,.55,0,1);shape.bezierCurveTo(-.5,.55,-.65,-.45,0,-1);const geo=new T.ShapeGeometry(shape,4),n=5200,leaves=new T.InstancedMesh(geo,leaf,n),dummy=new T.Object3D(),lobes=[];
 function branch(a,b,r){const start=new T.Vector3(...a),end=new T.Vector3(...b),d=end.clone().sub(start),mesh=new T.Mesh(new T.CylinderGeometry(r*.4,r,d.length(),7),trunk);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());mesh.castShadow=true;parent.add(mesh);}
 branch([x,.1,-y],[x,4.5*scale,-y],.16*scale);
 for(let k=0;k<12;k++){const angle=k*2.399,radius=(1+rand())*scale,end=[x+Math.cos(angle)*radius,(3.8+rand()*2)*scale,-y+Math.sin(angle)*radius];branch([x,(2.3+rand())*scale,-y],end,.055*scale);lobes.push(end);}
 for(let i=0;i<n;i++){const a=rand()*Math.PI*2,v=rand()*2-1,r=Math.cbrt(rand()),rad=Math.sqrt(1-v*v),c=lobes[i%lobes.length];dummy.position.set(c[0]+Math.cos(a)*rad*r*1.15*scale,c[1]+v*r*1.4*scale,c[2]+Math.sin(a)*rad*r*1.15*scale);dummy.rotation.set(rand()*Math.PI,rand()*Math.PI,rand()*Math.PI);const s=(.04+rand()*.03)*scale;dummy.scale.set(s,s*1.2,s);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,new T.Color().setHSL(.22+rand()*.06,.2+rand()*.18,.24+rand()*.13));}
 leaves.castShadow=true;leaves.receiveShadow=true;leaves.userData.detail='foliage';parent.add(leaves);
}
function planting(r,parent){const T=root.THREE,lot=r.context?.sitePoly;if(!lot?.length)return;const ground=r.levels[0],entry=(ground.rooms||[]).find(p=>p.entryPoint&&p.on!==false)?.entryPoint,rand=random(307),locations=[],xs=lot.map(p=>p[0]),ys=lot.map(p=>p[1]);
 for(let x=Math.min(...xs)+.8;x<Math.max(...xs)-.8;x+=1.3)for(let y=Math.min(...ys)+.8;y<Math.max(...ys)-.8;y+=1.3){
  if(!root.EXPLORE.inPoly([x,y],lot)||ground.g.built.some(p=>x>p.x-.6&&x<p.x+p.w+.6&&y>p.y-.6&&y<p.y+p.h+.6))continue;
  if(entry&&(['top','bottom'].includes(entry.side)?Math.abs(x-entry.x)<1.5:Math.abs(y-entry.y)<1.5))continue;
  if((r.o.groundCorridors||[]).some(p=>x>p.x-.8&&x<p.x+p.w+.8||y>p.y-.8&&y<p.y+p.h+.8))continue;
  if(locations.length<120)locations.push([x,y]);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-.025,0,0,.025,0,0,.04,.3,.06,-.01,.3,.06,.14,.65,.16],3));geo.setIndex([0,1,2,0,2,3,3,2,4]);geo.computeVertexNormals();const mat=new T.MeshStandardMaterial({color:0x7d8961,roughness:1,side:T.DoubleSide}),mesh=new T.InstancedMesh(geo,mat,locations.length*32),dummy=new T.Object3D();let n=0;
 for(const [x,y]of locations)for(let i=0;i<32;i++){dummy.position.set(x+(rand()-.5)*.5,.1,-y+(rand()-.5)*.5);dummy.rotation.y=rand()*Math.PI*2;dummy.scale.setScalar(.7+rand()*.5);dummy.updateMatrix();mesh.setMatrixAt(n++,dummy.matrix);}mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.detail='planting';parent.add(mesh);
}
// Context footprints are estimates: vary housing forms without claiming surveyed buildings.
function neighbourhoodForms(around){const out=[];for(const b of around?.buildings||[]){const p=(b.parcel||b.poly).filter((q,i,a)=>i===0||Math.hypot(q[0]-a[0][0],q[1]-a[0][1])>.001);if(!/^(R1|R3|R5|RT|RS)/.test(b.zone||'')||p.length!==4){out.push({...b,form:'apartment'});continue;}
 let i=0;for(let j=1;j<4;j++)if(Math.hypot(...p[(j+1)%4].map((v,k)=>v-p[j][k]))<Math.hypot(...p[(i+1)%4].map((v,k)=>v-p[i][k])))i=j;
 const a=p[i],b1=p[(i+1)%4],d=p[(i+3)%4],w=Math.hypot(b1[0]-a[0],b1[1]-a[1]),depth=Math.hypot(d[0]-a[0],d[1]-a[1]);
 if(w<5||depth<9){out.push({...b,form:'apartment'});continue;}
 const seed=Math.abs(Math.round(a[0]*37+a[1]*71)),rand=random(seed),style=seed%4,pt=(u,v)=>[a[0]+(b1[0]-a[0])*u+(d[0]-a[0])*v,a[1]+(b1[1]-a[1])*u+(d[1]-a[1])*v],poly=(x,y,X,Y)=>[pt(x,y),pt(X,y),pt(X,Y),pt(x,Y)];
 const form=style===0?'cottage':style===1?'duplex':style===2?'gable-house':'walk-up',height=style===0?6.2:style===3?10.2:8.1;
 out.push({...b,poly:poly(.14,.16,.86,Math.min(.72,.16+16/depth)),h:height+rand()*.8,form});
 if(depth>24)out.push({...b,poly:poly(.14,.82,.82,.97),h:4.4+rand(),form:'laneway'});
 }return out;}
function neighbours(around,parent,mats){const T=root.THREE;let index=0;const walls=mats?[mats.wall]:[0xc8c5bb,0xc4c8c5,0xc7bcae,0xbebdb9].map(c=>finish(c)),roofMat=mats?.roof||new T.MeshStandardMaterial({color:0x666a69,roughness:.92,side:T.DoubleSide}),flatMat=mats?.flat||roofMat;for(const b of neighbourhoodForms(around)){const poly=b.poly,height=Math.max(.1,b.h),house=b.form!=='apartment'&&b.form!=='walk-up',gable=house&&b.form!=='duplex'&&poly.length===4,wall=walls[index++%4],eaves=house?height-(b.form==='cottage'?2.5:2):height;
  const centre=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]);
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);quad([[...a,.05],[...b,.05],[...b,eaves],[...a,eaves]],wall,parent,'context-facade');if(house&&!gable){const pts=[[...a,eaves],[...b,eaves],[...centre,height],[...centre,height]];quad(pts,roofMat,parent,'context-roof');}
  }
  if(gable){const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],r0=mid(poly[0],poly[1]),r1=mid(poly[2],poly[3]);
   quad([[...poly[0],eaves],[...poly[3],eaves],[...r1,height],[...r0,height]],roofMat,parent,'context-roof');
   quad([[...poly[1],eaves],[...poly[2],eaves],[...r1,height],[...r0,height]],roofMat,parent,'context-roof');
   for(const [a,b,r]of [[poly[0],poly[1],r0],[poly[2],poly[3],r1]])quad([[...a,eaves],[...b,eaves],[...r,height],[...r,height]],wall,parent,'context-gable');
  }
  if(!house){const shape=new T.Shape();poly.forEach((p,i)=>i?shape.lineTo(...p):shape.moveTo(...p));shape.closePath();const mesh=new T.Mesh(new T.ShapeGeometry(shape),flatMat);mesh.rotation.x=-Math.PI/2;mesh.position.y=height;mesh.receiveShadow=true;mesh.userData.detail='context-flat-roof';parent.add(mesh);}
 }
}
function contextLinework(parent,material){const T=root.THREE,vertices=[];parent.updateMatrixWorld(true);parent.traverse(mesh=>{if(!['context-facade','context-roof','context-gable','context-flat-roof'].includes(mesh.userData.detail))return;const edges=new T.EdgesGeometry(mesh.geometry,25),p=edges.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);vertices.push(v.x,v.y,v.z);}edges.dispose();});const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));const lines=new T.LineSegments(geo,material||new T.LineBasicMaterial({color:0x697c81,transparent:true,opacity:.28}));lines.userData.detail='context-outline';parent.add(lines);}
function environment(renderer,scene,style='overcast'){
 const T=root.THREE,warm=style==='warm',sky=new T.Scene(),material=new T.ShaderMaterial({side:T.BackSide,uniforms:{top:{value:new T.Color(warm?0xb3c7d0:0xc3cdd3)},bottom:{value:new T.Color(warm?0xf0dfc5:0xeeeeeb)}},vertexShader:'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top; uniform vec3 bottom; varying vec3 direction; void main(){float h=clamp(normalize(direction).y,0.0,1.0);gl_FragColor=vec4(mix(bottom,top,pow(h,0.6)),1.0);}' });sky.add(new T.Mesh(new T.SphereGeometry(400,32,16),material));const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromScene(sky,.06,.1,900);scene.environment=target.texture;const backdrop=new T.WebGLCubeRenderTarget(128),capture=new T.CubeCamera(.1,900,backdrop);capture.update(renderer,sky);scene.background=backdrop.texture;scene.fog=new T.Fog(warm?0xe7dfd0:0xe3e8e9,100,300);pmrem.dispose();sky.children[0].geometry.dispose();material.dispose();return {dispose(){target.dispose();backdrop.dispose();}};
}
root.PRESENTATION_DETAIL={contextLinework,neighbourhoodForms,finish,quad,shell,windowDressing,tree,planting,neighbours,environment};
})(typeof window!=='undefined'?window:globalThis);
