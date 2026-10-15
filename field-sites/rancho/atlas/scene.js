import * as THREE from './vendor/three/three.module.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';

export async function createScene(atlas) {
  const response=await fetch('data/terrain.json');
  if(!response.ok)throw Error('Terrain data unavailable');
  const terrain=await response.json();
  const container=document.getElementById('scene'), labelLayer=document.getElementById('scene-labels');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setClearColor('#11262d');container.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','3D terrain and boreholes; use Explore buttons and the borehole inventory for keyboard navigation');
  const world=new THREE.Scene(),root=new THREE.Group();world.add(root);
  const camera=new THREE.PerspectiveCamera(42,1,.5,15000);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.minDistance=15;controls.maxDistance=7500;controls.maxPolarAngle=Math.PI*.87;
  const [x0,y0,x1,y1]=terrain.bounds,xc=(x0+x1)/2,yc=(y0+y1)/2,zbase=150;
  const {nx,ny,elevation_m:grid}=terrain;
  const project=ll=>window.proj4('EPSG:4326','+proj=utm +zone=10 +datum=NAD83 +units=m +no_defs',ll);
  function ground(e,n){
    const col=Math.max(0,Math.min(nx-1,(e-x0)/(x1-x0)*(nx-1))),row=Math.max(0,Math.min(ny-1,(y1-n)/(y1-y0)*(ny-1)));
    const c=Math.min(nx-2,Math.floor(col)),r=Math.min(ny-2,Math.floor(row)),dx=col-c,dy=row-r;
    return grid[r][c]*(1-dx)*(1-dy)+grid[r][c+1]*dx*(1-dy)+grid[r+1][c]*(1-dx)*dy+grid[r+1][c+1]*dx*dy;
  }
  function position(e,n,z){return new THREE.Vector3(e-xc,z-zbase,yc-n);}
  const vertices=[],indices=[],vertexColors=[],uv=[];
  for(let r=0;r<ny;r++)for(let c=0;c<nx;c++){
    const e=x0+c*(x1-x0)/(nx-1),n=y1-r*(y1-y0)/(ny-1),z=grid[r][c];
    vertices.push(e-xc,z-zbase,yc-n);
    uv.push(c/(nx-1),1-r/(ny-1));
    const h=THREE.MathUtils.clamp((z-130)/400,0,1),color=new THREE.Color().lerpColors(new THREE.Color('#47695d'),new THREE.Color('#b4bc87'),h);
    vertexColors.push(color.r,color.g,color.b);
    if(r<ny-1&&c<nx-1){const a=r*nx+c,b=a+1,d=a+nx,e2=d+1;indices.push(a,d,b,b,d,e2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const texture=await new THREE.TextureLoader().loadAsync('data/terrain-texture.jpg');texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false});
  const surface=new THREE.Mesh(geometry,material);surface.renderOrder=1;root.add(surface);
  world.add(new THREE.HemisphereLight('#e0efe6','#28433e',2));
  const sunlight=new THREE.DirectionalLight('#ffefd1',2);sunlight.position.set(-500,1200,600);world.add(sunlight);
  const groups={},labels=[],pickables=[],collars=new Map();
  const colors={well:'#63dbea',piezometer:'#efbf73',weather:'#ffffff',outlet:'#ff947a',sapflow:'#c0ec94',soil:'#b69ce9'};
  function group(kind){if(!groups[kind]){groups[kind]=new THREE.Group();root.add(groups[kind]);}return groups[kind];}
  function segment(points,color,dashed=false){const g=new THREE.BufferGeometry().setFromPoints(points),m=dashed?new THREE.LineDashedMaterial({color,dashSize:1,gapSize:.6,depthTest:false}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.8});const l=new THREE.Line(g,m);if(dashed)l.computeLineDistances();return l;}
  function shaft(a,b,color,radius){const g=new THREE.CylinderGeometry(radius,radius,a.distanceTo(b),7),m=new THREE.MeshBasicMaterial({color,depthTest:false});const mesh=new THREE.Mesh(g,m);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.renderOrder=4;return mesh;}
  for(const f of [...atlas.holes,...atlas.instruments]){
    if(!f.geometry)continue;
    const p=f.properties,[e,n]=p.easting_m!=null?[p.easting_m,p.northing_m]:project(f.geometry.coordinates),z=p.ground_m??ground(e,n),start=position(e,n,z),g=group(p.kind),color=colors[p.kind];
    const collar=new THREE.Mesh(new THREE.SphereGeometry(p.kind==='well'?1.8:1.15,10,8),new THREE.MeshBasicMaterial({color,depthTest:false}));
    collar.position.copy(start);collar.renderOrder=5;collar.userData.feature=f;g.add(collar);pickables.push(collar);collars.set(p.id,collar);
    if(p.depth_m!=null){
      const bottom=position(e,n,z-p.depth_m);
      if(p.depth_basis==='drilled'){const line=segment([start,bottom],color,true);line.renderOrder=4;g.add(line);}
      else g.add(shaft(start,bottom,color,.5));
      if(p.screen_m)g.add(shaft(position(e,n,z-p.screen_m[0]),position(e,n,z-p.screen_m[1]),'#f2f7eb',.72));
      for(let d=5;d<p.depth_m;d+=5){const tick=segment([position(e-1.2,n,z-d),position(e+1.2,n,z-d)],color);tick.material.depthTest=false;tick.renderOrder=4;g.add(tick);}
    }
    const button=document.createElement('button');button.textContent=p.id;button.className=p.kind;button.setAttribute('aria-label',`Inspect ${p.id}`);button.onclick=()=>atlas.inspect(f);labelLayer.append(button);labels.push({button,position:start,feature:f});
  }
  function pathLine(coords,kind,color,dashed=false){
    const points=coords.map(ll=>{const [e,n]=project(ll);return position(e,n,ground(e,n)+.7);});
    const l=segment(points,color,dashed);l.material.opacity=kind==='channel'?.5:.8;group(kind).add(l);
  }
  for(const f of atlas.catchments){const p=f.properties;for(const ring of f.geometry.coordinates)pathLine(ring,p.kind,p.kind==='watershed'?'#e0c68c':'#c0ec94');}
  for(const f of atlas.channels){const paths=f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates];for(const path of paths)pathLine(path,'channel','#8dceda');}
  const contourResponse=await fetch('data/contours-3d.geojson');
  if(!contourResponse.ok)throw Error('Contour data unavailable');
  const contourData=await contourResponse.json();
  for(const f of contourData.features){const paths=f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates];for(const path of paths)pathLine(path,'contour','#536052');}
  let active=false,frame=0,vertical=1,selectedId=null,visible=new Set(atlas.enabled),lastFocus='network';
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  new ResizeObserver(()=>{if(active)resize();}).observe(container);
  function setVisible(value){visible=new Set(value);for(const [kind,g] of Object.entries(groups))g.visible=visible.has(kind);}
  setVisible(atlas.enabled);
  function fly(target,span){
    target.y*=vertical;controls.target.copy(target);
    const d=Math.max(span*1.25,100);camera.position.copy(target).add(new THREE.Vector3(-d*.6,d*.7,d*.85));controls.update();
  }
  function focus(name){
    lastFocus=name;
    let points;
    if(name==='watershed')points=[[x0,y0],[x1,y1]];
    else if(name==='network')points=atlas.holes.filter(f=>f.geometry).map(f=>project(f.geometry.coordinates));
    else {const f=atlas.catchments.find(f=>f.properties.id===name);points=f?f.geometry.coordinates[0].map(project):[[x0,y0],[x1,y1]];}
    const minE=Math.min(...points.map(p=>p[0])),maxE=Math.max(...points.map(p=>p[0])),minN=Math.min(...points.map(p=>p[1])),maxN=Math.max(...points.map(p=>p[1]));
    const e=(minE+maxE)/2,n=(minN+maxN)/2;fly(position(e,n,ground(e,n)),Math.max(maxE-minE,maxN-minN));
  }
  function focusHole(f){const [e,n]=project(f.geometry.coordinates);fly(position(e,n,f.properties.ground_m??ground(e,n)),85);}
  function highlight(id){selectedId=id;for(const [key,mesh] of collars)mesh.scale.setScalar(key===id?2:1);}
  function render(){
    if(!active)return;
    controls.update();renderer.render(world,camera);
    const width=container.clientWidth,height=container.clientHeight,occupied=[];
    const sorted=[...labels].sort((a,b)=>(b.feature.properties.id===selectedId)-(a.feature.properties.id===selectedId)||Number(b.feature.properties.kind==='well')-Number(a.feature.properties.kind==='well'));
    for(const item of sorted){
      const p=item.feature.properties,worldPos=item.position.clone();worldPos.y*=vertical;
      const distance=camera.position.distanceTo(worldPos),pos=worldPos.project(camera),x=(pos.x*.5+.5)*width,y=(-pos.y*.5+.5)*height;
      let show=visible.has(p.kind)&&pos.z>-1&&pos.z<1&&x>30&&x<width-30&&y>110&&y<height-40&&(p.id===selectedId||distance<(p.kind==='well'?950:220));
      const rect=[x-30,y-22,x+30,y+2];
      if(show&&p.id!==selectedId&&occupied.some(r=>!(rect[2]<r[0]||rect[0]>r[2]||rect[3]<r[1]||rect[1]>r[3])))show=false;
      item.button.hidden=!show;
      if(show){occupied.push(rect);item.button.style.left=x+'px';item.button.style.top=y+'px';}
    }
    frame=requestAnimationFrame(render);
  }
  const raycaster=new THREE.Raycaster();let pointerStart;
  renderer.domElement.addEventListener('pointerdown',event=>{pointerStart=[event.clientX,event.clientY];});
  renderer.domElement.addEventListener('pointerup',event=>{
    if(!pointerStart||Math.hypot(event.clientX-pointerStart[0],event.clientY-pointerStart[1])>5)return;
    const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    const hits=raycaster.intersectObjects(pickables.filter(m=>m.parent.visible));if(hits.length)atlas.inspect(hits[0].object.userData.feature);
  });
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();document.getElementById('scene-loading').hidden=false;document.getElementById('scene-loading').textContent='3D graphics context lost. Return to the map or reload to reopen 3D.';});
  return {get active(){return active;},open(){active=true;resize();render();},close(){active=false;cancelAnimationFrame(frame);},focus,focusHole,highlight,setVisible,
    opacity(value){material.opacity=value;},verticalScale(value){vertical=value;root.scale.y=value;focus(lastFocus);},
    top(){const d=camera.position.distanceTo(controls.target);camera.position.copy(controls.target).add(new THREE.Vector3(0,d,.01));controls.update();}};
}
