import * as THREE from './vendor/three/three.module.js';
// Session-only illustrative pits. The DEM and exported scientific data stay intact.
export function createPits({scene,terrain,heightAt,origin,container}){
 const palette=['#46382b','#91613e','#ba8b56'];
 const limit=8,pits=[],holes=Array.from({length:limit},()=>new THREE.Vector4(0,0,0,0)),group=new THREE.Group();scene.add(group);
 const ground=(x,z)=>heightAt(x+origin[0],origin[1]-z)-origin[2];
 const uniforms={atlasPits:{value:holes}};
 terrain.material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec2 atlasGroundXZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\natlasGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;');
  shader.fragmentShader='varying vec2 atlasGroundXZ;\nuniform vec4 atlasPits[8];\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfor (int i = 0; i < 8; i++) { vec4 h = atlasPits[i]; if (h.z > 0.0 && abs(atlasGroundXZ.x-h.x) < h.z && abs(atlasGroundXZ.y-h.y) < h.w) discard; }');
 };
 terrain.material.customProgramCacheKey=()=> 'illustrative-soil-pits-v1';terrain.material.needsUpdate=true;
 function sync(){holes.forEach((h,i)=>{const p=pits[i];h.set(p?.x||0,p?.z||0,p?.open ? .65 : 0,p?.open ? .55 : 0);});container.dataset.billPits=String(pits.length);const label=document.querySelector('#bill-pit-count'),text=pits.length?`${pits.length} ${pits.length===1?'pit':'pits'} dug`:'';if(label.textContent!==text)label.textContent=text;}
 function dispose(p){for(const o of [p.mesh,p.spoil]){group.remove(o);o.geometry.dispose();o.material.dispose();}}
 function begin(x,z){
  // Avoid overlapping cutouts; a new click at the same spot reuses its pit.
  if(pits.some(p=>Math.abs(p.x-x)<1.4&&Math.abs(p.z-z)<1.2))return null;
  if(pits.length===limit)dispose(pits.shift());
  const corners=[[-.65,-.55],[.65,-.55],[.65,.55],[-.65,.55]].map(([a,b])=>[x+a,ground(x+a,z+b),z+b]);
  const geometry=new THREE.BufferGeometry();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}));group.add(mesh);
  const spoil=new THREE.Mesh(new THREE.SphereGeometry(.42,12,7),new THREE.MeshStandardMaterial({color:'#896441',roughness:1}));spoil.position.set(x+.99,ground(x+.99,z),z);spoil.scale.set(1,0,1.25);group.add(spoil);
  const p={x,z,corners,mesh,spoil,open:false,bottom:Math.min(...corners.map(c=>c[1]))-.7};pits.push(p);progress(p,0);sync();return p;
 }
 function progress(p,t){
  if(!p)return;p.open=t>0;const v=[],c=[],triangle=(a,b,d,col)=>{v.push(...a,...b,...d);const rgb=new THREE.Color(col);for(let i=0;i<3;i++)c.push(rgb.r,rgb.g,rgb.b);};
  // Three illustrative soil bands down each wall; no inferred local stratigraphy.
  for(let i=0;i<4;i++){const a=p.corners[i],b=p.corners[(i+1)%4];for(let k=0;k<3;k++){const top=k/3*t,bot=(k+1)/3*t,A=[a[0],a[1]+(p.bottom-a[1])*top,a[2]],B=[b[0],b[1]+(p.bottom-b[1])*top,b[2]],C=[a[0],a[1]+(p.bottom-a[1])*bot,a[2]],D=[b[0],b[1]+(p.bottom-b[1])*bot,b[2]];triangle(A,B,C,palette[k]);triangle(B,D,C,palette[k]);}}
  const floor=p.corners.map(a=>[a[0],a[1]+(p.bottom-a[1])*t,a[2]]);triangle(floor[0],floor[2],floor[1],'#3c3025');triangle(floor[0],floor[3],floor[2],'#3c3025');
  for(const [name,values] of [['position',v],['color',c]]){const attr=p.mesh.geometry.getAttribute(name);if(attr){attr.array.set(values);attr.needsUpdate=true;}else p.mesh.geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,3));}p.mesh.geometry.computeVertexNormals();p.mesh.geometry.computeBoundingSphere();p.spoil.scale.y=t*.5;sync();
 }
 function clear(){pits.forEach(dispose);pits.length=0;sync();}
 sync();return {begin,progress,clear};
}
