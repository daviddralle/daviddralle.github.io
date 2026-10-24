import * as THREE from './vendor/three/three.module.js';
import {POOL} from './jerry-pool-trip.js?v=c700868d6d1d';
import {createRanchHome} from './jerry-home.js?v=e6a4a638ccf9';

// Approximate scene landmarks interpreted from the user's labeled aerial,
// supplied photographs, Nov 2024 Leesville Road Street View, and 2019 LiDAR.
// These are visual context, never survey features or synthetic LiDAR returns.
export const RIDGE_SHACK = Object.freeze([556279.8,4333890.7]);
export const LANDMARKS = [
  {id:'ranch-house',label:'Ranch house',center:[556750,4332710],height:8,span:60},
  {id:'guest-house',label:'Guest house',center:[556685.2,4332703.6],height:4.5,span:45},
  {id:'road-barn',label:'Roadside barn',center:[556765.2,4332550.8],height:8.2,span:55},
  {id:'south-barn',label:'South barn',center:[556727.7,4332510.9],height:7,span:55},
  {id:'ranch-pool',label:'Pool',center:[556736,4332554],height:1,span:40},
  {id:'ranch-solar',label:'Solar arrays',center:[556751.6,4332533.1],height:2,span:45},
  {id:'ridge-shack',label:'MH7 ridge shack',center:RIDGE_SHACK,height:3.2,span:18}
];
// Pixel-to-UTM registration of the labeled overview, checked against LiDAR.
const aerial=([x,y])=>[556648.855767+.184840643*x+.00242762*y,4332742.210141-.002717308*x-.184162356*y];
export function createRanchLandmarks({ground,position,home}){
  const group=new THREE.Group();group.name='Ranch landmarks (approximate photo models)';
  const mats={};
  const mat=(color)=>mats[color]??=(new THREE.MeshStandardMaterial({color,roughness:.84,side:THREE.DoubleSide}));
  const glass=mat('#263e43'),roof=mat('#bdcbd1'),wood=mat('#855638'),redwood=mat('#754838'),trim=mat('#a86e55'),stone=mat('#8d8878'),gravel=mat('#b4a991'),solar=mat('#243b4f');
  function mesh(points,triangles,material){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>position(...p).toArray()),3));g.setIndex(triangles.flat());g.computeVertexNormals();const m=new THREE.Mesh(g,material);group.add(m);return m;}
  function quad(a,b,c,d,m){return mesh([a,b,c,d],[[0,1,2],[0,2,3]],m);}
  function line(points,color='#705844'){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>position(...p)));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color}));group.add(l);return l;}
  function slab(p,w,d,h,material,angle=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.copy(position(p[0],p[1],p[2]+h/2));m.rotation.y=angle;group.add(m);return m;}
  function building({center,width,length,eave,peak,angle=0,material=wood,shed=false,raised=false}){
    const c=Math.cos(angle),s=Math.sin(angle),xy=(x,z)=>[center[0]+c*x+s*z,center[1]-s*x+c*z];
    const ends=[[-width/2,-length/2],[width/2,-length/2],[width/2,length/2],[-width/2,length/2]];
    const base=Math.max(...ends.map(p=>ground(...xy(...p))))+(raised?.45:.12);
    const P=(x,y,z)=>[...xy(x,z),base+y],w=width/2,l=length/2;
    for(let i=0;i<4;i++){const a=ends[i],b=ends[(i+1)%4],pa=xy(...a),pb=xy(...b);quad([...pa,ground(...pa)-.12],[...pb,ground(...pb)-.12],P(b[0],0,b[1]),P(a[0],0,a[1]),stone);quad(P(a[0],0,a[1]),P(b[0],0,b[1]),P(b[0],eave,b[1]),P(a[0],eave,a[1]),material);}
    const roofY=x=>shed?eave+(x+w)/(2*w)*(peak-eave):peak-(peak-eave)*Math.abs(x)/w;
    if(shed){quad(P(-w-.4,roofY(-w-.4),-l-.4),P(w+.4,roofY(w+.4),-l-.4),P(w+.4,roofY(w+.4),l+.4),P(-w-.4,roofY(-w-.4),l+.4),roof);quad(P(w,eave,-l),P(w,eave,l),P(w,peak,l),P(w,peak,-l),material);}
    else for(const side of [-1,1])quad(P(side*(w+.45),roofY(side*(w+.45)),-l-.45),P(side*(w+.45),roofY(side*(w+.45)),l+.45),P(0,peak,l+.45),P(0,peak,-l-.45),roof);
    for(const z of [-l,l]){
      if(shed)mesh([P(-w,eave,z),P(w,eave,z),P(w,peak,z)],[[0,1,2]],material);
      else mesh([P(-w,eave,z),P(w,eave,z),P(0,peak,z)],[[0,1,2]],material);
    }
    // Roof seams and siding stay geometric, keeping the public asset compact.
    for(let z=-l;z<=l;z+=.48){if(shed)line([P(-w-.4,roofY(-w-.4)+.02,z),P(w+.4,roofY(w+.4)+.02,z)],'#899ea5');else for(const side of [-1,1])line([P(0,peak+.025,z),P(side*(w+.45),roofY(side*(w+.45))+.025,z)],'#899ea5');}
    for(const side of [-1,1])for(let z=-l;z<=l;z+=.4)line([P(side*(w+.015),0,z),P(side*(w+.015),roofY(side*w),z)],'#654831');
    const windowSide=(side,z,y=1.15,ww=1.1,hh=1.35)=>{const x=side*(w+.04);quad(P(x,y-.08,z-ww/2-.08),P(x,y-.08,z+ww/2+.08),P(x,y+hh+.08,z+ww/2+.08),P(x,y+hh+.08,z-ww/2-.08),trim);quad(P(x+side*.015,y,z-ww/2),P(x+side*.015,y,z+ww/2),P(x+side*.015,y+hh,z+ww/2),P(x+side*.015,y+hh,z-ww/2),glass);line([P(x+side*.025,y+hh/2,z-ww/2),P(x+side*.025,y+hh/2,z+ww/2)],'#b58469');line([P(x+side*.025,y,z),P(x+side*.025,y+hh,z)],'#b58469');};
    return {P,xy,base,w,l,roofY,windowSide,eave,peak};
  }
  function roofPanels(b,side,rows=2,columns=6){const {P,w,l,roofY}=b;const x0=side*w*.15,x1=side*w*.9,z0=-l*.8,z1=l*.8;for(let r=0;r<rows;r++)for(let k=0;k<columns;k++){const xa=x0+(x1-x0)*r/rows,xb=x0+(x1-x0)*(r+.91)/rows,za=z0+(z1-z0)*k/columns,zb=z0+(z1-z0)*(k+.94)/columns;quad(P(xa,roofY(xa)+.09,za),P(xb,roofY(xb)+.09,za),P(xb,roofY(xb)+.09,zb),P(xa,roofY(xa)+.09,zb),solar);}}
  group.add(createRanchHome({ground,position,home}));
  const guest=building({center:LANDMARKS[1].center,width:7.2,length:18.5,eave:2.9,peak:3.65,angle:-.04,material:redwood,shed:true,raised:true});
  for(const z of [-6,0,6])guest.windowSide(1,z,1,1.4,1.35);
  // Narrow east-facing guest-house porch, on posts rather than a filled plinth.
  const {P:gp,w:gw,l:gl}=guest;
  quad(gp(gw,.1,-gl),gp(gw+1.5,.1,-gl),gp(gw+1.5,.1,gl),gp(gw,.1,gl),wood);
  quad(gp(gw,2.8,-gl),gp(gw+1.7,2.5,-gl),gp(gw+1.7,2.5,gl),gp(gw,2.8,gl),roof);
  for(const z of [-gl,-gl/2,0,gl/2,gl]){slab(gp(gw+1.45,0,z),.14,.14,2.55,wood);line([gp(gw+1.45,.9,-gl),gp(gw+1.45,.9,gl)],'#9b7761');}
  roofPanels(guest,-1,1,3);
  const barn=building({center:LANDMARKS[2].center,width:10.6,length:18.5,eave:4.2,peak:7.8,angle:.07,material:wood});
  const {P:bp,w:bw,l:bl}=barn;
  // East-facing sliding doors and their exposed track, as in Street View.
  quad(bp(bw+.06,0,-3.2),bp(bw+.06,0,3.2),bp(bw+.06,3.8,3.2),bp(bw+.06,3.8,-3.2),mat('#a4734c'));
  line([bp(bw+.08,0,0),bp(bw+.08,3.8,0)],'#433b31');line([bp(bw+.1,4,-6),bp(bw+.1,4,6)],'#6a7673');
  for(let z=-3;z<3;z+=.45)line([bp(bw+.09,0,z),bp(bw+.09,3.65,Math.min(z+2,3.15))],'#6f4c34');
  // Window/skylight strips on the east roof and solar on the west roof.
  for(const z of [-4.5,4.5]){const xa=bw*.25,xb=bw*.68;quad(bp(xa,barn.roofY(xa)+.06,z-.65),bp(xb,barn.roofY(xb)+.06,z-.65),bp(xb,barn.roofY(xb)+.06,z+.65),bp(xa,barn.roofY(xa)+.06,z+.65),glass);}
  roofPanels(barn,-1,2,8);
  quad(bp(-bw,3.3,-bl),bp(-bw-6,2.6,-bl),bp(-bw-6,2.6,bl),bp(-bw,3.3,bl),roof);
  for(const z of [-bl,0,bl])slab(bp(-bw-5.8,0,z),.22,.22,2.6,wood);
  const south=building({center:LANDMARKS[3].center,width:12.2,length:22,eave:4.1,peak:6.5,angle:.08,material:mat('#8b4c3b')});
  for(const side of [-1,1]){const {P,w,l}=south;quad(P(side*w,3.6,-l),P(side*(w+3.4),2.5,-l),P(side*(w+3.4),2.5,l),P(side*w,3.6,l),roof);for(const z of [-l,0,l])slab(P(side*(w+3.15),0,z),.23,.23,2.5,wood);}
  const {P:sp,w:sw,l:sl}=south;quad(sp(-2,0,-sl-.03),sp(2,0,-sl-.03),sp(2,3.5,-sl-.03),sp(-2,3.5,-sl-.03),mat('#473d34'));
  // Pool is shown with a muted cover, matching the aerial reference.
  const pool=POOL.center,pa=POOL.angle,pbase=ground(...pool)+.22;
  slab([...pool,pbase],POOL.deckWidth,POOL.deckLength,.15,mat('#d0c4ad'),pa);slab([...pool,pbase+.15],POOL.width,POOL.length,.04,mat('#738b94'),pa);
  for(const [i,p] of [[0,[556753.2,4332537.2]],[1,[556750,4332529]]]){
    const z=ground(...p);for(const x of [-4.5,4.5])for(const n of [-1.3,1.3])slab([p[0]+x,p[1]+n,ground(p[0]+x,p[1]+n)],.13,.13,Math.max(.1,z+.75+(n+1.65)*.235-ground(p[0]+x,p[1]+n)),stone);
    for(let c=0;c<8;c++)for(let r=0;r<2;r++){const x=p[0]-5.4+c*1.36,n=p[1]-1.65+r*1.7;quad([x,n,z+.75+r*.4],[x+1.28,n,z+.75+r*.4],[x+1.28,n+1.58,z+1.12+r*.4],[x,n+1.58,z+1.12+r*.4],solar);}
  }
  // Drives are traced from the labeled overview, then draped on the DEM.
  function drive(pixels,width,color=gravel){const points=pixels.map(aerial);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(len),dx=-(b[1]-a[1])/len*width/2,dy=(b[0]-a[0])/len*width/2;for(let k=0;k<steps;k++){const p=a.map((v,j)=>v+(b[j]-v)*k/steps),q=a.map((v,j)=>v+(b[j]-v)*(k+1)/steps),P=(p,s)=>[p[0]+dx*s,p[1]+dy*s,ground(p[0]+dx*s,p[1]+dy*s)+.35];for(let j=0;j<Math.ceil(width);j++){const a=-1+2*j/Math.ceil(width),b=-1+2*(j+1)/Math.ceil(width);quad(P(p,a),P(q,a),P(q,b),P(p,b),color);}}}}
  drive([[805,265],[735,271],[677,281],[590,286],[533,300],[512,352],[491,445],[478,550],[464,669],[460,755],[483,800],[562,835],[678,859],[725,864]],4.5);
  drive([[533,300],[430,281],[310,274],[219,261]],3);
  drive([[510,810],[515,910],[503,983],[514,1085],[473,1152],[450,1190]],3.8);
  // Leesville Road context stops at the existing terrain edge.
  drive([[850,0],[822,160],[802,270],[776,440],[749,639],[727,829],[705,1010],[667,1191],[628,1290]],6.5,mat('#797a72'));
  const shack=building({center:RIDGE_SHACK,width:2.3,length:2.6,eave:2.25,peak:3.5,angle:-.3,material:mat('#b27d43')});
  const {P:hp,w:hw,l:hl}=shack;
  shack.windowSide(1,0,1.15,.48,.62);
  // Small divided window in the visible gable, warm trim, stone footing.
  quad(hp(-.32,1.05,-hl-.03),hp(.32,1.05,-hl-.03),hp(.32,1.85,-hl-.03),hp(-.32,1.85,-hl-.03),trim);
  quad(hp(-.24,1.13,-hl-.045),hp(.24,1.13,-hl-.045),hp(.24,1.77,-hl-.045),hp(-.24,1.77,-hl-.045),glass);
  line([hp(0,1.13,-hl-.06),hp(0,1.77,-hl-.06)],'#b07b61');line([hp(-.24,1.45,-hl-.06),hp(.24,1.45,-hl-.06)],'#b07b61');
  for(let x=-hw;x<=hw;x+=.23)line([hp(x,0,-hl-.02),hp(x,shack.roofY(x),-hl-.02)],'#8f602f');
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2,p=shack.xy(Math.cos(a)*1.5,Math.sin(a)*1.7);slab([...p,ground(...p)+.05],.45,.35,.18,stone,a);}
  // Batch static surfaces and linework by material instead of issuing hundreds
  // of separate draw calls for siding, roof seams and draped driveway segments.
  group.updateMatrixWorld(true);
  const batches=new Map();
  group.traverse(object=>{
    if(!object.isMesh&&!object.isLine)return;
    const m=object.material,key=[object.isMesh?'mesh':'line',m.color.getHexString(),m.opacity,m.transparent,m.side].join('/');
    if(!batches.has(key))batches.set(key,{mesh:object.isMesh,material:m,positions:[],normals:[]});
    const batch=batches.get(key),g=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();g.applyMatrix4(object.matrixWorld);
    const p=g.attributes.position;
    if(object.isMesh){batch.positions.push(...p.array);batch.normals.push(...g.attributes.normal.array);}
    else for(let i=1;i<p.count;i++)for(const j of [i-1,i])batch.positions.push(p.getX(j),p.getY(j),p.getZ(j));
    g.dispose();
  });
  const oldGeometry=new Set(),oldMaterial=new Set();group.traverse(o=>{if(o.geometry)oldGeometry.add(o.geometry);if(o.material)oldMaterial.add(o.material);});
  group.clear();
  for(const batch of batches.values()){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
    if(batch.mesh)g.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
    group.add(batch.mesh?new THREE.Mesh(g,batch.material):new THREE.LineSegments(g,batch.material));oldMaterial.delete(batch.material);
  }
  for(const g of oldGeometry)g.dispose();for(const m of oldMaterial)m.dispose();
  group.userData={approximate:true,notes:'Photo-interpreted dimensions and placement; DEM elevations. Shack position registered to MH7 well collars, not surveyed.'};
  return {group,features:LANDMARKS};
}
