import * as THREE from './vendor/three/three.module.js';

// Interpretive photo model, not a surveyed building footprint. Coordinates are
// matched to the user's north-up satellite image; elevations come from the DEM.
export const HOUSE_RIDGE = [[556734,4332696],[556750,4332709],[556750,4332724]];
export function createRanchHome({ground,position,home}) {
  const group=new THREE.Group();group.name='Ranch house & circle drive (approximate)';
  const material=(color)=>new THREE.MeshStandardMaterial({color,roughness:.88,side:THREE.DoubleSide});
  const wall=material('#d7c4a0'),roof=material('#e3e9e7'),stone=material('#8b8674'),glass=material('#263e40'),timber=material('#927756'),gravel=material('#b5aa94');
  function mesh(points,faces,mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>position(...p).toArray()),3));g.setIndex(faces.flat());g.computeVertexNormals();const m=new THREE.Mesh(g,mat);group.add(m);return m;}
  function quad(a,b,c,d,mat){return mesh([a,b,c,d],[[0,1,2],[0,2,3]],mat);}
  function box(e,n,z,w,h,d,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.copy(position(e,n,z+h/2));group.add(m);return m;}
  // Left normal follows the concave garden side; right normal faces the drive.
  const normals=HOUSE_RIDGE.slice(1).map((p,i)=>{const a=HOUSE_RIDGE[i],dx=p[0]-a[0],dy=p[1]-a[1],l=Math.hypot(dx,dy);return [-dy/l,dx/l];});
  const offsets=[normals[0],(()=>{const a=normals[0],b=normals[1],den=1+a[0]*b[0]+a[1]*b[1];return [(a[0]+b[0])/den,(a[1]+b[1])/den];})(),normals[1]];
  const edge=(i,w)=>HOUSE_RIDGE[i].map((v,j)=>v+offsets[i][j]*w);
  const corners=[0,1,2].flatMap(i=>[edge(i,4.5),edge(i,-4.5)]);
  const floor=Math.max(...corners.map(p=>ground(...p)))+.12,eave=floor+3.1,peak=floor+5.7;
  for(let i=0;i<2;i++){
    const a=HOUSE_RIDGE[i],b=HOUSE_RIDGE[i+1];
    for(const side of [-1,1]){
      const p=edge(i,4.5*side),q=edge(i+1,4.5*side),rp=edge(i,5.3*side),rq=edge(i+1,5.3*side);
      // Foundation reaches the actual DEM under each wall corner.
      quad([...p,ground(...p)-.2],[...q,ground(...q)-.2],[...q,floor],[...p,floor],stone);
      quad([...p,floor],[...q,floor],[...q,eave],[...p,eave],wall);
      quad([...rp,eave],[...rq,eave],[...b,peak],[...a,peak],roof);
      for(const f of [.22,.5,.78]){
        const c=p.map((v,j)=>v+(q[j]-v)*f+normals[i][j]*side*.04),u=[(b[0]-a[0])/Math.hypot(b[0]-a[0],b[1]-a[1]),(b[1]-a[1])/Math.hypot(b[0]-a[0],b[1]-a[1])];
        quad([c[0]-u[0]*1.05,c[1]-u[1]*1.05,floor+.5],[c[0]+u[0]*1.05,c[1]+u[1]*1.05,floor+.5],[c[0]+u[0]*1.05,c[1]+u[1]*1.05,eave-.45],[c[0]-u[0]*1.05,c[1]-u[1]*1.05,eave-.45],glass);
      }
    }
    const p=edge(i,4.5),q=edge(i+1,4.5),op=edge(i,7.5),oq=edge(i+1,7.5);
    quad([...p,floor],[...q,floor],[...oq,floor],[...op,floor],stone);
    quad([...p,eave],[...q,eave],[...oq,floor+2.65],[...op,floor+2.65],roof);
    for(const f of [0,.5,1])box(op[0]+(oq[0]-op[0])*f,op[1]+(oq[1]-op[1])*f,floor,.18,2.65,.18,timber);
    // Subtle standing seams across the pale metal roof.
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let f=.6/length;f<1;f+=.65/length){for(const side of [-1,1]){const r=a.map((v,j)=>v+(b[j]-v)*f),p=edge(i,5.3*side),q=edge(i+1,5.3*side);const g=new THREE.BufferGeometry().setFromPoints([position(...r,peak+.015),position(p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f,eave+.015)]);group.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:'#bfcaca',transparent:true,opacity:.45})));}}
  }
  for(const i of [0,2]){const a=edge(i,4.5),b=edge(i,-4.5),c=HOUSE_RIDGE[i];quad([...a,floor],[...b,floor],[...b,eave],[...a,eave],wall);mesh([[...a,eave],[...b,eave],[...c,peak]],[[0,1,2]],timber);const m=box(c[0],c[1],floor+.15,5,2.8,.12,glass);m.rotation.y=Math.atan2(-normals[i===0?0:1][1],normals[i===0?0:1][0]);}
  box(556744,4332706,floor,1.8,6.6,1.5,stone);box(556744,4332706,floor+6.6,.65,1,.65,material('#ac7158'));box(556744,4332706,floor+7.6,.9,.2,.9,glass);
  // Gravel loop on the convex/east side, draped over the unmodified DEM.
  const center=[556775,4332715];
  for(let i=0;i<96;i++){const point=(angle,r)=>{const e=center[0]+Math.cos(angle)*14*r,n=center[1]+Math.sin(angle)*21*r;return [e,n,ground(e,n)+.16];};const a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2;quad(point(a,.58),point(b,.58),point(b,1),point(a,1),gravel);}
  const pad=[[-4,-3],[4,-3],[4,3],[-4,3]].map(([e,n])=>[home[0]+e,home[1]+n,ground(home[0]+e,home[1]+n)+.19]);quad(...pad,gravel);
  // A small timber parking stop makes the start position legible without paint.
  const stop=box(home[0]-4,home[1],ground(home[0]-4,home[1])+.22,.28,.25,5,timber);stop.name='Mule parking spot';
  group.userData={approximate:true,source:'User-supplied house photographs and marked satellite image; DEM elevations',parking:home,roadSide:'east'};
  return group;
}
