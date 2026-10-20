import {bufferDetails,containsBuffer} from './eagle-buffers.js?v=20261020b';
import {soilDetails,geologyDetails} from './soil-details.js?v=20261016-units';
import * as THREE from '../rivendell/atlas/vendor/three/three.module.js';
import {OrbitControls} from '../rivendell/atlas/vendor/three/OrbitControls.js';

// Both terrain patches and every measured return share this UTM origin.
const origin = [600000, 4160000, 100];
const world = ([e,n,z]) => new THREE.Vector3(e-origin[0],z-origin[2],origin[1]-n);
const $ = id => document.getElementById(id);
const checked = id => $(id).checked;
const json = async url => {const r=await fetch(url);if(!r.ok)throw new Error(`${url}: ${r.status}`);return r.json();};
const binary = async url => {const r=await fetch(url);if(!r.ok)throw new Error(`${url}: ${r.status}`);return r.arrayBuffer();};

export async function createScene(api){
  const host=$('scene-canvas'),panel=$('scene3d');
  const packages=await Promise.all(api.manifest.sites.map(async site=>{
    const base=`data/${site.id}/3d/`,meta=await json(base+'scene.json');
    const [terrain,canopy,features]=await Promise.all([binary(base+meta.terrain.url),binary(base+meta.canopy.url),json(base+'features.json')]);
    return {site,meta,heights:new Float32Array(terrain),points:new Uint16Array(canopy),features};
  }));
  const [geologyMeta,soilMeta,soilProperties]=await Promise.all([json('data/geology/metadata.json'),json('data/soils/metadata.json'),json('data/soils/properties.json?v=20261014-context3d')]);
  const textureLoader=new THREE.TextureLoader();
  const eagleData=await json('data/eagle-buffers/scene.json');
  const eagleTextures=await Promise.all(eagleData.features.map(f=>textureLoader.loadAsync('data/eagle-buffers/'+f.texture)));
  eagleTextures.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.NearestFilter;});
  const eagleMeshes=[];
  await Promise.all(packages.map(async p=>{
    const base=`data/${p.site.id}/3d/context/`,meta=await json(base+'manifest.json');
    p.context={meta,ids:{},textures:{}};
    await Promise.all(['geology','soils'].map(async kind=>{const [ids,texture]=await Promise.all([binary(base+meta.layers[kind].ids),textureLoader.loadAsync(base+meta.layers[kind].texture)]);p.context.ids[kind]=new Uint16Array(ids);p.context.textures[kind]=texture;}));
    p.context.textures.faults=await textureLoader.loadAsync(base+'faults.png');
    for(const t of Object.values(p.context.textures)){t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.NearestFilter;}
  }));
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#11262d');host.replaceChildren(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.2,40000);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=7;controls.maxDistance=18000;controls.maxPolarAngle=Math.PI*.495;controls.zoomToCursor=true;controls.autoRotateSpeed=.65;
  scene.add(new THREE.HemisphereLight('#ffffff','#7c8580',2.1));
  const light=new THREE.DirectionalLight('#ffffff',2);light.position.set(-300,600,250);scene.add(light);
  const dotCanvas=document.createElement('canvas');dotCanvas.width=dotCanvas.height=32;const ctx=dotCanvas.getContext('2d');ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(16,16,15,0,Math.PI*2);ctx.fill();const dotTexture=new THREE.CanvasTexture(dotCanvas);
  const crossCanvas=document.createElement('canvas');crossCanvas.width=crossCanvas.height=64;const crossCtx=crossCanvas.getContext('2d');
  for(const [color,width]of [['#11262d',16],['#ffffff',8]]){crossCtx.strokeStyle=color;crossCtx.lineWidth=width;crossCtx.beginPath();crossCtx.moveTo(32,10);crossCtx.lineTo(32,54);crossCtx.moveTo(10,32);crossCtx.lineTo(54,32);crossCtx.stroke();}
  const crossTexture=new THREE.CanvasTexture(crossCanvas);crossTexture.colorSpace=THREE.SRGBColorSpace;
  // PointsMaterial supplies device-pixel scaling; the per-record diameter is
  // the same CSS-pixel diameter used by the 2D inventory symbols.
  function inventoryMaterial(){const material=new THREE.PointsMaterial({map:dotTexture,alphaTest:.2,size:1,sizeAttenuation:false,vertexColors:true,depthTest:false,transparent:true,depthWrite:false});material.onBeforeCompile=shader=>{shader.vertexShader='attribute float markerDiameter;\n'+shader.vertexShader.replace('gl_PointSize = size;','gl_PointSize = size * markerDiameter;');};material.customProgramCacheKey=()=> 'inventory-dbh-size';return material;}
  const terrainMeshes=[],plotMeshes=[],contextMeshes=[],clouds=[],contourGroups=[],fieldGroup=new THREE.Group();scene.add(fieldGroup);
  const coordinates=new Map(),plotLabels=[],treeLabels=[];
  let active=false,focusId=api.currentSite(),frame=0,treePoints,pointFeatures=[];
  const rampHeights=[0,2,7,20,65],ramp=['#c3a675','#c5bb76','#91b34e','#4d973b','#206038'].map(c=>new THREE.Color(c));
  function heightColor(h){let j=1;while(j<4&&h>rampHeights[j])j++;return ramp[j-1].clone().lerp(ramp[j],THREE.MathUtils.clamp((h-rampHeights[j-1])/(rampHeights[j]-rampHeights[j-1]),0,1));}
  function lineGeometry(lines){const a=[];for(const line of lines)for(let i=1;i<line.length;i++){a.push(...world(line[i-1]).toArray(),...world(line[i]).toArray());}return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(a,3));}
  for(const p of packages){
    const {meta,heights,points,features}=p,tm=meta.terrain,w=tm.width,h=tm.height,verts=new Float32Array(w*h*3),indices=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)world([tm.x0+x*tm.step,tm.y0-y*tm.step,heights[y*w+x]]).toArray(verts,(y*w+x)*3);
    for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){const a=y*w+x,b=a+1,c=a+w,d=c+1;indices.push(a,c,b,b,c,d);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(verts,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const uv=new Float32Array(w*h*2);for(let y=0;y<h;y++)for(let x=0;x<w;x++){uv[(y*w+x)*2]=(x+.5)/w;uv[(y*w+x)*2+1]=1-(y+.5)/h;}geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#8b8b8b',roughness:1,metalness:0,side:THREE.DoubleSide}));ground.userData.package=p;scene.add(ground);terrainMeshes.push(ground);
    for(const [kind,order]of [['geology',.1],['faults',.2],['soils',.3]]){
      const material=new THREE.MeshBasicMaterial({map:p.context.textures[kind],transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
      const overlay=new THREE.Mesh(geometry,material);overlay.renderOrder=order;overlay.userData.kind=kind;scene.add(overlay);contextMeshes.push(overlay);
    }
    if(p.site.id===eagleData.site){
      eagleData.features.forEach((f,i)=>{
        const kind=f.properties.id.endsWith('-min')?'min':'max';
        const overlay=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:eagleTextures[i],transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));overlay.renderOrder=.5+i*.01;overlay.userData={eagleKind:kind,fill:true};scene.add(overlay);eagleMeshes.push(overlay);
        const lines=[];
        const height=(x,y)=>{const col=Math.round((x-tm.x0)/tm.step),row=Math.round((tm.y0-y)/tm.step);return col>=0&&col<w&&row>=0&&row<h?heights[row*w+col]+1:null;};
        for(const ring of f.geometry.coordinates){let previous=null;for(let j=1;j<ring.length;j++){const a=ring[j-1],b=ring[j],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,y=a[1]+(b[1]-a[1])*k/n,z=height(x,y),point=z===null?null:[x,y,z];if(point&&previous)lines.push([previous,point]);previous=point;}}}
        const outline=new THREE.LineSegments(lineGeometry(lines),new THREE.LineBasicMaterial({color:f.properties.color,depthTest:false,transparent:true,depthWrite:false}));outline.renderOrder=2;outline.userData={eagleKind:kind,fill:false};scene.add(outline);eagleMeshes.push(outline);
      });
    }
    const pos=new Float32Array(meta.canopy.count*3),col=new Float32Array(meta.canopy.count*3),scale=meta.canopy.scale,offset=meta.canopy.offset;
    for(let i=0;i<meta.canopy.count;i++){world([points[i*4]*scale+offset[0],points[i*4+1]*scale+offset[1],points[i*4+2]*scale+offset[2]]).toArray(pos,i*3);heightColor(points[i*4+3]*scale).toArray(col,i*3);}
    const cloudGeo=new THREE.BufferGeometry();cloudGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));cloudGeo.setAttribute('color',new THREE.BufferAttribute(col,3));
    const cloud=new THREE.Points(cloudGeo,new THREE.PointsMaterial({size:1.5,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));cloud.renderOrder=1;scene.add(cloud);clouds.push(cloud);
    const contour=new THREE.LineSegments(lineGeometry(features.contours.map(f=>f.coordinates.map(c=>[c[0],c[1],c[2]+.3]))),new THREE.LineBasicMaterial({color:'#e6ddc1',transparent:true,opacity:.3}));scene.add(contour);contourGroups.push(contour);
    for(const f of features.trees)coordinates.set(f.id,f.coordinates[0]);
    const bounds=new THREE.LineSegments(lineGeometry(features.boundaries.map(f=>f.coordinates.map(c=>[c[0],c[1],c[2]+.5]))),new THREE.LineBasicMaterial({color:'#63dbea',transparent:true,opacity:.7,depthTest:false,transparent:true,depthWrite:false}));bounds.userData.layer='layer-boundaries';bounds.renderOrder=2;fieldGroup.add(bounds);
    for(const f of features.plots){
      const feature=api.data.plots.features.find(t=>t.properties.id===f.id);
      const label=document.createElement('button');label.className='scene-label';label.textContent=f.properties.plot;label.onclick=()=>api.inspect(feature);$('scene-labels').append(label);
      plotLabels.push({label,point:world([f.coordinates[0][0],f.coordinates[0][1],f.coordinates[0][2]+3])});
    }
    const accuracy=[],regen=[];
    for(const f of features.plots){const c=f.coordinates[0],record=api.data.plots.features.find(t=>t.properties.id===f.id);for(const [collection,radius] of [[accuracy,record.properties.gps_accuracy_m],[regen,4]]){if(collection===regen&&!api.data.regeneration.features.some(t=>t.properties.plot===f.properties.plot))continue;const ring=[];for(let i=0;i<=64;i++){const a=i*Math.PI/32,x=c[0]+radius*Math.cos(a),y=c[1]+radius*Math.sin(a),col=Math.max(0,Math.min(w-1,Math.round((x-tm.x0)/tm.step))),row=Math.max(0,Math.min(h-1,Math.round((tm.y0-y)/tm.step)));ring.push([x,y,heights[row*w+col]+.8]);}collection.push(ring);}}
    for(const [lines,color,layer] of [[accuracy,'#e7ac6a','layer-accuracy'],[regen,'#e9cc8b','layer-regen']]){const obj=new THREE.LineSegments(lineGeometry(lines),new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,depthWrite:false}));obj.renderOrder=5;obj.userData.layer=layer;fieldGroup.add(obj);}
    const corners=[[0,0],[w-1,0],[w-1,h-1],[0,h-1],[0,0]].map(([x,y])=>[tm.x0+x*tm.step,tm.y0-y*tm.step,heights[y*w+x]+.5]);const border=new THREE.LineSegments(lineGeometry([corners]),new THREE.LineBasicMaterial({color:'#dce9e1',transparent:true,opacity:.8}));border.userData.layer='layer-coverage';fieldGroup.add(border);
    const centers=features.plots.map(f=>world([f.coordinates[0][0],f.coordinates[0][1],f.coordinates[0][2]+1]).toArray()).flat();
    const plots=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(centers,3)),new THREE.PointsMaterial({color:'#ffffff',map:crossTexture,alphaTest:.2,size:20,sizeAttenuation:false,depthTest:false,transparent:true,depthWrite:false}));plots.renderOrder=6;plots.userData={layer:'layer-plots',features:features.plots.map(f=>api.data.plots.features.find(t=>t.properties.id===f.id))};fieldGroup.add(plots);plotMeshes.push(plots);
    const cs=features.plots.map(f=>f.coordinates[0]);p.target=world([cs.reduce((s,c)=>s+c[0],0)/cs.length,cs.reduce((s,c)=>s+c[1],0)/cs.length,cs.reduce((s,c)=>s+c[2],0)/cs.length]);
    const siteLabel=document.createElement('button');siteLabel.className='scene-label';siteLabel.textContent=p.site.name;siteLabel.onclick=()=>focus(p.site.id);$('scene-labels').append(siteLabel);plotLabels.push({label:siteLabel,point:p.target,site:true});
    const ex=cs.map(c=>c[0]),ny=cs.map(c=>c[1]);p.span=Math.max(Math.max(...ex)-Math.min(...ex),Math.max(...ny)-Math.min(...ny));
  }
  function refresh(){
    treeLabels.forEach(l=>l.label.remove());treeLabels.length=0;
    if(treePoints){fieldGroup.remove(treePoints);treePoints.geometry.dispose();treePoints.material.dispose();}
    pointFeatures=api.filteredTrees();const pos=[],col=[];
    for(const f of pointFeatures){const c=coordinates.get(f.properties.id);world([c[0],c[1],c[2]+1]).toArray(pos,pos.length);new THREE.Color(api.colors[f.properties.species]||'#ddd').toArray(col,col.length);if(checked('tree-labels')){const label=document.createElement('button');label.className='scene-label';label.textContent=f.properties.plot+' · '+f.properties.tree_tag_number;label.onclick=()=>api.inspect(f);$('scene-labels').append(label);treeLabels.push({label,point:world([c[0],c[1],c[2]+2]),tree:true});}}
    treePoints=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pos,3)).setAttribute('color',new THREE.Float32BufferAttribute(col,3)).setAttribute('markerDiameter',new THREE.Float32BufferAttribute(pointFeatures.map(f=>2*api.treeRadius(f.properties)),1)),inventoryMaterial());treePoints.userData.layer='layer-trees';treePoints.renderOrder=4;fieldGroup.add(treePoints);
    // Separate pink rings identify proposed sampling trees without changing species colors.
    const old=fieldGroup.children.find(o=>o.userData.layer==='layer-plan');if(old){fieldGroup.remove(old);old.geometry.dispose();old.material.dispose();}
    const rings=[];for(const f of pointFeatures.filter(f=>f.properties.in_sampling_plan)){const c=coordinates.get(f.properties.id),ring=[];for(let i=0;i<=24;i++){const a=i*Math.PI/12;ring.push([c[0]+3*Math.cos(a),c[1]+3*Math.sin(a),c[2]+1.2]);}rings.push(ring);}
    const plan=new THREE.LineSegments(lineGeometry(rings),new THREE.LineBasicMaterial({color:'#f5b8ed',depthTest:false,transparent:true,depthWrite:false}));plan.renderOrder=5;plan.userData.layer='layer-plan';fieldGroup.add(plan);
    const oldOutline=fieldGroup.children.find(o=>o.userData.outline);if(oldOutline){fieldGroup.remove(oldOutline);oldOutline.geometry.dispose();oldOutline.material.dispose();}
    const outlineColors=pointFeatures.flatMap(f=>new THREE.Color(f.properties.status==='dead'?'#ec884e':'#253b31').toArray());
    const outline=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pos,3)).setAttribute('color',new THREE.Float32BufferAttribute(outlineColors,3)).setAttribute('markerDiameter',new THREE.Float32BufferAttribute(pointFeatures.map(f=>2*api.treeRadius(f.properties)+(f.properties.status==='dead'?4:2)),1)),inventoryMaterial());outline.renderOrder=3.5;outline.userData={layer:'layer-trees',outline:true};fieldGroup.add(outline);
    fieldGroup.children.forEach(o=>o.visible=checked(o.userData.layer));
  }
  function cameraAt(target,distance,top=false){controls.autoRotate=false;$('spin-3d').setAttribute('aria-pressed','false');controls.target.copy(target);camera.position.copy(target).add(top?new THREE.Vector3(0,distance,.01):new THREE.Vector3(-distance*.2,distance*.72,-distance*.85));controls.update();}
  function contextLegend(id){if(!active){document.dispatchEvent(new CustomEvent('context-view',{detail:null}));return;}const selected=packages.filter(p=>!id||p.site.id===id),detail={};for(const kind of ['geology','soils'])detail[kind]=[...new Set(selected.flatMap(p=>p.context.meta.layers[kind].unit_codes))];document.dispatchEvent(new CustomEvent('context-view',{detail}));}
  function focus(id,landscape=false){focusId=id;contextLegend(packages.some(p=>p.site.id===id)?id:null);const p=packages.find(p=>p.site.id===id);if(p){cameraAt(p.target,landscape?1550:Math.max(440,p.span*1.25));$('scene-title').textContent=p.site.name+' · 3D';}else{const center=packages[0].target.clone().add(packages[1].target).multiplyScalar(.5);cameraAt(center,8000);$('scene-title').textContent='Both sites · 3D';}}
  function focusFeature(f){let c=coordinates.get(f.properties.id);if(!c){const p=packages.flatMap(p=>p.features.plots).find(p=>p.id===f.properties.id);c=p?.coordinates[0];}if(c){const site=api.manifest.sites.find(s=>s.id===f.properties.site||s.code===f.properties.site);if(site){focusId=site.id;contextLegend(site.id);}cameraAt(world(c),100);$('scene-title').textContent=f.properties.plot+' · 3D';}}
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function draw(){if(!active)return;frame=requestAnimationFrame(draw);controls.update();const distance=controls.target.distanceTo(camera.position);fieldGroup.visible=distance<3000;renderer.render(scene,camera);const w=host.clientWidth,h=host.clientHeight,used=[];
    for(const item of [...plotLabels,...treeLabels]){const v=item.point.clone().project(camera),x=(v.x*.5+.5)*w,y=(-v.y*.5+.5)*h;const show=(item.site?distance>=3000:item.tree?checked('layer-trees')&&checked('tree-labels')&&controls.target.distanceTo(camera.position)<220:checked('layer-plots'))&&v.z>=-1&&v.z<=1&&x>20&&x<w-20&&y>70&&y<h-25&&(item.site||distance<3000)&&!used.some(([a,b])=>Math.abs(a-x)<60&&Math.abs(b-y)<22);item.label.hidden=!show;if(show){item.label.style.left=x+'px';item.label.style.top=(y-(!item.site&&!item.tree?12:0))+'px';used.push([x,y]);}}
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||e.button!==0)return;
    const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
    // Pick in screen pixels so hit areas track DBH sizes at any camera angle.
    function pick(points,radius){if(!points.visible||!fieldGroup.visible)return null;let best=null,distance=Infinity;const positions=points.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){const v=new THREE.Vector3().fromBufferAttribute(positions,i).project(camera);if(v.z< -1||v.z>1)continue;const d=Math.hypot((v.x-pointer.x)*r.width/2,(v.y-pointer.y)*r.height/2);if(d<=radius(i)&&d<distance){best=i;distance=d;}}return best;}
    for(const plots of plotMeshes){const i=pick(plots,()=>9);if(i!==null){api.inspect(plots.userData.features[i]);return;}}
    const treeHit=pick(treePoints,i=>api.treeRadius(pointFeatures[i].properties)+2);
    if(treeHit!==null){api.inspect(pointFeatures[treeHit]);return;}
    const hit=ray.intersectObjects(terrainMeshes)[0];if(!hit)return;
    if(checked('layer-eagles')&&eagleData.features.some(f=>checked('eagle-'+(f.properties.id.endsWith('-min')?'min':'max'))&&containsBuffer([hit.point.x+origin[0],origin[1]-hit.point.z],f.geometry.coordinates))){api.showContext('Eagle buffers · 2026 source',bufferDetails());return;}
    const kind=checked('layer-soils')?'soils':checked('layer-geology')?'geology':null;if(!kind)return;
    const p=hit.object.userData.package,tm=p.context.meta,col=Math.round((hit.point.x+origin[0]-tm.x0)/tm.step),row=Math.round((tm.y0-(origin[1]-hit.point.z))/tm.step);
    if(col<0||row<0||col>=tm.width||row>=tm.height)return;
    const code=tm.layers[kind].lookup[p.context.ids[kind][row*tm.width+col]];if(!code)return;
    api.showContext(kind==='soils'?'Mapped soil properties':'Mapped geology',kind==='soils'?soilDetails(soilMeta.units[code],code,soilProperties):geologyDetails(geologyMeta.units[code],code));
  });
  function refreshEagles(){for(const mesh of eagleMeshes){mesh.visible=checked('layer-eagles')&&checked('eagle-'+mesh.userData.eagleKind);mesh.material.opacity=mesh.userData.fill?Number($('eagle-opacity').value)/100:1;}}
  document.addEventListener('eagle-buffers-change',refreshEagles);refreshEagles();
  function refreshContext(){
    for(const mesh of contextMeshes){const kind=mesh.userData.kind;mesh.visible=kind==='faults'?checked('layer-geology')&&checked('geology-faults'):checked('layer-'+kind);mesh.material.opacity=Number($(kind==='soils'?'soils-opacity':'geology-opacity').value)/100;}
  }
  for(const id of ['layer-geology','layer-soils','geology-faults'])$(id).addEventListener('change',refreshContext);
  for(const id of ['geology-opacity','soils-opacity'])$(id).addEventListener('input',refreshContext);
  refreshContext();

  $('close-3d').onclick=()=>{active=false;cancelAnimationFrame(frame);panel.hidden=true;$('map').removeAttribute('aria-hidden');document.body.classList.remove('scene-active');document.dispatchEvent(new CustomEvent('context-view',{detail:null}));};
  $('reset-3d').onclick=()=>focus(focusId);
  $('top-3d').onclick=()=>cameraAt(controls.target.clone(),camera.position.distanceTo(controls.target),true);
  $('spin-3d').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('spin-3d').setAttribute('aria-pressed',String(controls.autoRotate));};
  $('cloud-3d').onchange=()=>clouds.forEach(c=>c.visible=checked('cloud-3d'));
  $('contours-3d').onchange=()=>contourGroups.forEach(c=>c.visible=checked('contours-3d'));
  $('cloud-opacity').oninput=()=>clouds.forEach(c=>c.material.opacity=Number($('cloud-opacity').value)/100);
  $('point-size').oninput=()=>clouds.forEach(c=>c.material.size=Number($('point-size').value));
  new ResizeObserver(resize).observe(host);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('scene-status').textContent='3D graphics interrupted. Return to 2D and reload to restore.';});
  $('scene-count').textContent=packages.reduce((n,p)=>n+p.meta.canopy.count,0).toLocaleString()+' measured returns · both sites';
  $('scene-status').innerHTML='USGS 3DEP · '+window.SFPUCUnits.html(2,'length')+' mesh · geology & soils draped on terrain · click ground for details';
  refresh();
  return {focus,focusFeature,refresh,open(){panel.hidden=false;$('map').setAttribute('aria-hidden','true');document.body.classList.add('scene-active');active=true;resize();focus(api.currentSite());refresh();refreshContext();refreshEagles();cancelAnimationFrame(frame);draw();}};
}
