import * as THREE from './vendor/three/three.module.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {PLANETS,globePoint,seededRandom,GAIA_MAP,SOLAR_DISPLAY} from './cosmic-model.js?v=solar-scale-2';

const INFO={
 earth:{title:'Earth',eyebrow:'OUR FIELD SITE, FROM ORBIT',subtitle:'Rivendell · 39.729° N, 123.644° W',scale:'12,756 km · equatorial diameter',note:'NASA Blue Marble · December 2004',source:'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/',next:'solar',nextLabel:'Out to the Solar System ↗',back:'california',backLabel:'↓ California'},
 solar:{title:'Solar System',eyebrow:'OUR PLANETARY NEIGHBORHOOD',subtitle:'Earth is the small blue world, one AU from the Sun.',scale:'1 AU ≈ 150 million km',note:'Mean orbital radii to scale · planet symbols enlarged · illustrative orbital phases',source:'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',next:'galaxy',nextLabel:'Out to the Milky Way ↗',back:'earth',backLabel:'↓ Earth'},
 galaxy:{title:'Milky Way Galaxy',eyebrow:'OUR GALACTIC ADDRESS',subtitle:'The Solar System lies in the Orion Spur, about 26,000 light-years from the center.',scale:'~100,000 light-years across',note:'Gaia-based artist reconstruction · 2025',credit:'ESA/Gaia/DPAC · Stefan Payne-Wardenaar · CC BY-SA 3.0 IGO',source:'https://www.esa.int/ESA_Multimedia/Images/2025/01/The_best_Milky_Way_map_by_Gaia',back:'solar',backLabel:'↓ Solar System'}
};
export function createCosmicView({container,navigate}){
 const $=s=>container.querySelector(s),host=$('.cosmic-canvas'),labelHost=$('.cosmic-labels');
 const scene=new THREE.Scene();scene.background=new THREE.Color('#060e18');
 const camera=new THREE.PerspectiveCamera(40,1,.1,5000);
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Space view: drag to rotate, right-drag to pan, scroll to zoom');renderer.domElement.tabIndex=0;
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.autoRotateSpeed=.3;
 const ambient=new THREE.AmbientLight('#d9edff',2.1),sunlight=new THREE.DirectionalLight('#fff4df',2.5);scene.add(ambient,sunlight);
 let active=false,mode='earth',content=null,labels=[],frame=0,last=0,earthMesh=null;
 const groups=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const texture=new THREE.TextureLoader().load('data/space/earth-blue-marble.jpg',()=>render(),undefined,()=>{container.dataset.texture='unavailable';});texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const spriteCanvas=document.createElement('canvas');spriteCanvas.width=spriteCanvas.height=64;
 const ctx=spriteCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#ffffffff');gradient.addColorStop(.15,'#ffffffe0');gradient.addColorStop(.4,'#ffffff55');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const glowTexture=new THREE.CanvasTexture(spriteCanvas);
 function sphere(radius,color,material={}){return new THREE.Mesh(new THREE.SphereGeometry(radius,64,40),new THREE.MeshStandardMaterial({color,roughness:.95,...material}));}
 function glow(color,size){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));s.scale.setScalar(size);return s;}
 function pointMarker(group,p,color='#c0ec94',size=1){const m=sphere(size,color,{emissive:color,emissiveIntensity:1});m.position.copy(p);group.add(m);const g=glow(color,size*10);g.position.copy(p);group.add(g);return m;}
 function line(group,points,color,opacity=.3,loop=false){const g=new THREE.BufferGeometry().setFromPoints(points);const o=new (loop?THREE.LineLoop:THREE.Line)(g,new THREE.LineBasicMaterial({color,transparent:true,opacity}));group.add(o);return o;}
 function orbit(group,radius,color='#899cab',opacity=.3){return line(group,Array.from({length:256},(_,i)=>new THREE.Vector3(Math.cos(i*Math.PI/128)*radius,0,Math.sin(i*Math.PI/128)*radius)),color,opacity,true);}
 const rand=seededRandom();
 const stars=new Float32Array(1800*3);for(let i=0;i<stars.length;i+=3){const y=rand()*2-1,a=rand()*Math.PI*2,r=900+rand()*900;stars[i]=Math.sqrt(1-y*y)*Math.cos(a)*r;stars[i+1]=y*r;stars[i+2]=Math.sqrt(1-y*y)*Math.sin(a)*r;}
 const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3));scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#aac5db',size:1.3,sizeAttenuation:false,transparent:true,opacity:.6,map:glowTexture,depthWrite:false})));
 function makeEarth(){
  const group=new THREE.Group();earthMesh=sphere(100,'#ffffff',{map:texture});group.add(earthMesh);
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(101.8,64,40),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n; varying vec3 v; void main(){float rim=pow(1.-max(0.,dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.16,.53,.9,rim*.48);}'}));group.add(atmosphere);
  const p=new THREE.Vector3(...globePoint(39.72892,-123.64404,101.5));pointMarker(group,p,'#c0ec94',.8);
  return {group,labels:[{text:'Rivendell',detail:'Angelo Coast Range Reserve',point:p,go:'site',primary:true,globe:true}]};
 }
 function makeSolar(){
  const group=new THREE.Group(),sun=new THREE.Mesh(new THREE.SphereGeometry(SOLAR_DISPLAY.sunRadius,48,32),new THREE.MeshBasicMaterial({color:'#ffe4a0'}));group.add(sun);const corona=glow('#ffbb64',SOLAR_DISPLAY.sunGlowDiameter);corona.material.opacity=.65;group.add(corona);
  const items=[{text:'Sun',point:new THREE.Vector3(),radius:SOLAR_DISPLAY.sunRadius,priority:1}];
  for(const p of PLANETS){const r=p.au*SOLAR_DISPLAY.unitsPerAU;orbit(group,r,p.name==='Earth'?'#9fcfab':'#7e98b4',p.name==='Earth'?.6:.25);const at=new THREE.Vector3(Math.cos(p.phase)*r,0,Math.sin(p.phase)*r),body=sphere(p.radius,p.color,{emissive:p.color,emissiveIntensity:.25});body.position.copy(at);group.add(body);
   if(p.name==='Saturn'){const ring=new THREE.Mesh(new THREE.RingGeometry(p.radius*1.3,p.radius*2,80),new THREE.MeshBasicMaterial({color:'#c6b193',side:THREE.DoubleSide,transparent:true,opacity:.6}));ring.rotation.x=Math.PI*.43;body.add(ring);}
   if(p.name==='Earth'){body.material.map=texture;body.material.color.set('#ffffff');const halo=glow('#8cedcf',SOLAR_DISPLAY.earthGlowDiameter);halo.material.opacity=.5;halo.position.copy(at);group.add(halo);}
   items.push({text:p.name,radius:p.radius,detail:p.name==='Earth'?'Rivendell is here':`${p.au.toFixed(p.au<2?2:1)} AU`,point:at,go:p.name==='Earth'?'earth':null,primary:p.name==='Earth'});
  }
  const belt=new Float32Array(900*3);for(let i=0;i<belt.length;i+=3){const r=(2.15+rand()*.95)*3,a=rand()*Math.PI*2;belt[i]=Math.cos(a)*r;belt[i+1]=(rand()-.5)*.3;belt[i+2]=Math.sin(a)*r;}
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(belt,3));group.add(new THREE.Points(geom,new THREE.PointsMaterial({size:.07,color:'#a6a390',transparent:true,opacity:.5})));
  return {group,labels:items};
 }
 function makeGalaxy(){
  const group=new THREE.Group(),image=new THREE.TextureLoader().load('data/space/milky-way-gaia.jpg',()=>render());image.colorSpace=THREE.SRGBColorSpace;image.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  // Preserve ESA's observed-data reconstruction as a textured map, not invented 3D stars.
  const disk=new THREE.Mesh(new THREE.PlaneGeometry(GAIA_MAP.width,GAIA_MAP.width),new THREE.MeshBasicMaterial({map:image,side:THREE.DoubleSide,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));disk.rotation.x=-Math.PI/2;group.add(disk);
  const solar=new THREE.Vector3((GAIA_MAP.sun[0]-.5)*GAIA_MAP.width,.1,(GAIA_MAP.sun[1]-.5)*GAIA_MAP.width);pointMarker(group,solar,'#c0ec94',.55);
  return {group,labels:[{text:'Our Solar System',detail:'Orion Spur · ~26,000 light-years out',point:solar,go:'solar',primary:true},{text:'Galactic center',point:new THREE.Vector3(0,.1,0)}]};
 }
 function setLabels(items){labelHost.replaceChildren();labels=items.sort((a,b)=>(b.primary?10:b.priority||0)-(a.primary?10:a.priority||0)).map(item=>{const el=document.createElement(item.go?'button':'div');el.className='cosmic-label'+(item.primary?' primary':'');const title=document.createElement('strong');title.textContent=item.text;el.append(title);if(item.detail){const small=document.createElement('small');small.textContent=item.detail;el.append(small);}if(item.go){el.onclick=()=>navigate(item.go);el.setAttribute('aria-label',item.text+' · '+(item.go==='site'?'Return to Rivendell':'Zoom in'));}labelHost.append(el);return {...item,el};});}
 function layout(){
  const w=host.clientWidth,h=host.clientHeight,placed=[],svg=$('.cosmic-leaders');svg.replaceChildren();
  const intersects=(a,b)=>a.x<b.x+b.w+7&&a.x+a.w+7>b.x&&a.y<b.y+b.h+7&&a.y+a.h+7>b.y;
  const base=container.getBoundingClientRect();for(const selector of ['.cosmic-header','.cosmic-footer','.cosmic-navigation']){const r=$(selector).getBoundingClientRect();placed.push({x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height});}
  for(const item of labels){const {el,point}=item,p=point.clone().project(camera),x=(p.x+1)*w/2,y=(1-p.y)*h/2;
   if(p.z< -1||p.z>1||x<0||x>w||y<0||y>h||(item.globe&&point.dot(camera.position.clone().sub(point))<=0)){el.hidden=true;continue;}
   el.hidden=false;const ww=el.offsetWidth,hh=el.offsetHeight;let chosen;
   const edge=point.clone().add(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar(item.radius||0)).project(camera),clearance=Math.max(16,Math.abs(edge.x-p.x)*w/2+9);
   for(const gap of [clearance,clearance+20,clearance+44,clearance+74,clearance+109]){for(const [dx,dy] of [[gap,-hh/2],[-ww-gap,-hh/2],[-ww/2,-hh-gap],[-ww/2,gap]]){const r={x:x+dx,y:y+dy,w:ww,h:hh};if(r.x<8||r.y<8||r.x+ww>w-8||r.y+hh>h-8||placed.some(b=>intersects(r,b)))continue;chosen=r;break;}if(chosen)break;}
   if(!chosen){el.hidden=true;continue;}placed.push(chosen);el.style.left=chosen.x+'px';el.style.top=chosen.y+'px';const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',x);l.setAttribute('y1',y);l.setAttribute('x2',Math.max(chosen.x,Math.min(x,chosen.x+ww)));l.setAttribute('y2',Math.max(chosen.y,Math.min(y,chosen.y+hh)));l.setAttribute('stroke',item.primary?'#c0ec94':'#9aadc1');svg.append(l);
  }
 }
 function render(){if(!active)return;sunlight.position.copy(camera.position).add(new THREE.Vector3(100,100,100));renderer.render(scene,camera);layout();container.dataset.cosmicView=mode;container.dataset.camera=camera.position.toArray().map(x=>x.toFixed(2)).join(',');}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.setViewOffset(w,h,0,22,w,h);camera.updateProjectionMatrix();renderer.setSize(w,h);render();}
 function reset(){controls.target.set(0,0,0);if(mode==='earth')camera.position.set(...globePoint(25,-113,420));else if(mode==='solar')camera.position.set(30,220,225);else camera.position.set(0,480,80);const narrow=Math.max(1,1/camera.aspect);camera.position.multiplyScalar(narrow);controls.update();render();}
 function animate(time){if(!active)return;frame=requestAnimationFrame(animate);const dt=Math.min(.05,(time-last)/1000||.016);last=time;controls.update(dt);}
 controls.addEventListener('change',render);new ResizeObserver(resize).observe(host);
 $('.cosmic-reset').onclick=reset;$('.cosmic-home').onclick=()=>navigate('site');$('.cosmic-spin').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('.cosmic-spin').setAttribute('aria-pressed',String(controls.autoRotate));};
 $('.cosmic-back').onclick=()=>navigate(INFO[mode].back);$('.cosmic-next').onclick=()=>navigate(INFO[mode].next);
 function close(){active=false;cancelAnimationFrame(frame);container.hidden=true;container.closest('.map-shell').classList.remove('is-cosmic');}
 function open(name){
  if(!INFO[name])throw Error('Unknown space view');mode=name;active=true;container.hidden=false;container.closest('.map-shell').classList.add('is-cosmic');
  if(content)scene.remove(content);if(!groups.has(mode))groups.set(mode,({earth:makeEarth,solar:makeSolar,galaxy:makeGalaxy})[mode]());const model=groups.get(mode);content=model.group;scene.add(content);setLabels(model.labels);
  const info=INFO[mode];$('.cosmic-eyebrow').textContent=info.eyebrow;$('.cosmic-title').textContent=info.title;$('.cosmic-subtitle').textContent=info.subtitle;$('.cosmic-scale').textContent=info.scale;$('.cosmic-note').textContent=info.note;$('.cosmic-source').href=info.source;$('.cosmic-source').textContent=info.credit||'NASA · source ↗';
  $('.cosmic-back').textContent=info.backLabel;$('.cosmic-next').hidden=!info.next;$('.cosmic-next').textContent=info.nextLabel||'';
  controls.minDistance=mode==='earth'?112:8;controls.maxDistance=mode==='earth'?850:1100;controls.enablePan=mode!=='earth';controls.maxPolarAngle=mode==='galaxy'?Math.PI*.42:Math.PI;controls.autoRotate=false;$('.cosmic-spin').setAttribute('aria-pressed','false');
  resize();reset();cancelAnimationFrame(frame);last=0;frame=requestAnimationFrame(animate);container.dataset.reducedMotion=String(reduced);
 }
 return {open,close,get active(){return active;}};
}
