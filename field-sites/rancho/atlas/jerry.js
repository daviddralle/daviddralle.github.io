import * as THREE from './vendor/three/three.module.js';
import {createRanchHome} from './jerry-home.js?v=5aae35db2d4d';
import {createRidgeDetector} from './jerry-ridges.js?v=9f01013b7f16';
import {bindJerryCameraGestures} from './jerry-camera.js?v=621cbeee0a7a';
import {createMule,createBottle} from './jerry-model.js?v=63f1b3239458';
import {createMotion,HOME,HOME_NOTE,DESTINATIONS} from './jerry-motion.js?v=a19a0b335342';
import {poems,sources,createDeck} from './jerry-haikus.js?v=ba218621cf2f';

export function createJerry({world,root,camera,controls,surface,ground,position,terrain,renderer,getVertical,catchments,project}){
  const host=document.getElementById('scene'),shell=host.parentElement,canvas=renderer.domElement;
  const overlay=new THREE.Scene();for(const light of world.children.filter(o=>o.isLight))overlay.add(light.clone());
  const mule=createMule(),bottle=createBottle();overlay.add(mule.root,bottle);mule.root.visible=bottle.visible=false;
  const [x0,y0,x1,y1]=terrain.bounds;
  function valid(e,n){
    if(e<x0+15||e>x1-15||n<y0+15||n>y1-15)return false;
    const c=Math.floor((e-x0)/(x1-x0)*(terrain.nx-1)),r=Math.floor((y1-n)/(y1-y0)*(terrain.ny-1));
    return !terrain.valid||[terrain.valid[r][c],terrain.valid[r][c+1],terrain.valid[r+1][c],terrain.valid[r+1][c+1]].every(Boolean);
  }
  const ridgeAt=createRidgeDetector({catchments,project,height:ground,valid});
  const motion=createMotion({height:ground,valid,ridgeAt}),s=motion.state,deck=createDeck();
  const toolbar=document.createElement('section');toolbar.className='jerry-toolbar';toolbar.setAttribute('aria-label','Jerry Mode controls');
  toolbar.innerHTML=`<button id="jerry-toggle" aria-pressed="false"><span aria-hidden="true">↟</span> Jerry Mode</button>
  <div class="jerry-quick" id="jerry-quick" hidden><button id="jerry-quick-wine" aria-label="Drop a lovely Cabernet" title="Choose a wine stop">🍷</button><button id="jerry-quick-library">Haikus</button><button id="jerry-options" aria-expanded="false" aria-controls="jerry-panel">Controls</button></div>
  <div id="jerry-panel" hidden><div class="jerry-heading"><span class="eyebrow">An afternoon at Rancho</span><strong>Jerry & the dogs</strong><span class="jerry-subtitle">Cali, Colusa & a Kawasaki Mule</span></div>
  <div class="jerry-actions"><button id="jerry-pause" aria-pressed="false">Pause</button><button id="jerry-follow" aria-pressed="true">Follow Jerry</button><button id="jerry-home">Start at home</button></div>
  <div class="jerry-destinations"><span>Head to</span>${DESTINATIONS.map(d=>`<button data-jerry-go="${d.id}">${d.label}</button>`).join('')}</div>
  <button id="jerry-wine" class="jerry-wine" title="Drag onto the terrain, or click then select a spot"><span aria-hidden="true">🍷</span> Drop a lovely Cabernet</button>
  <p id="jerry-drop-help">Drag a bottle onto the hills, or click then choose a spot.</p>
  <div id="jerry-drop-actions" hidden><button id="jerry-serve">Serve beside Jerry</button><button id="jerry-cancel">Cancel drop</button></div>
  <div class="jerry-actions"><button id="jerry-library">100 ranch haikus ↗</button><button id="jerry-terrain" aria-expanded="false">Terrain controls</button></div>
  <p class="jerry-fiction">Drag to rotate · Ctrl/⌘-drag to pan<br>Scroll to zoom · rotation & zoom keep tracking</p>
  <p id="jerry-status" role="status"></p><small class="jerry-fiction">Playful fiction · original poems, not Brown quotations. Vehicle enlarged 2.4×.</small></div>`;
  host.append(toolbar);
  const label=document.createElement('div');label.className='jerry-name';label.textContent='Jerry · Cali & Colusa';label.hidden=true;host.append(label);
  const homeLabel=document.createElement('div');homeLabel.className='jerry-name jerry-home-label';homeLabel.textContent='Circle drive · Mule parking';homeLabel.title=HOME_NOTE;homeLabel.hidden=true;host.append(homeLabel);
  const card=document.createElement('section');card.className='jerry-poem';card.hidden=true;card.setAttribute('aria-label','A wine-stop haiku');
  card.innerHTML='<div id="jerry-thought" role="status" aria-live="polite"><span class="jerry-thinking">Jerry is thinking<span class="jerry-dots">…</span></span><div class="jerry-verse"><p id="jerry-poem-lines"></p><small id="jerry-poem-topic"></small></div></div><div class="jerry-poem-footer"><p class="jerry-fiction">Original fictional haiku · not a Brown quote</p><a id="jerry-poem-source" target="_blank" rel="noopener"></a><div class="jerry-actions"><button id="jerry-continue">Back to roaming</button><button id="jerry-another">Another haiku</button></div></div>';
  host.append(card);
  const library=document.createElement('dialog');library.id='jerry-library-dialog';library.setAttribute('aria-labelledby','jerry-library-title');
  library.innerHTML=`<div class="dialog-header"><div><span class="eyebrow">Jerry Mode · the complete collection</span><h2 id="jerry-library-title">A hundred thoughts from the hills.</h2></div><button id="jerry-library-close" aria-label="Close haiku library">×</button></div>
  <p class="small muted">Original fictional 5–7–5 verse inspired by themes in Jerry Brown’s public writing. These poems are neither quotations nor endorsements. Dates below refer to the historical essays, not current conditions.</p>
  <div class="jerry-library-filters"><label>Theme<select id="jerry-theme"><option value="">All ten themes</option>${sources.map(a=>`<option value="${a.id}">${a.topic}</option>`).join('')}</select></label><label>Find a poem<input id="jerry-search" type="search" placeholder="oak, rain, peace…"></label><span id="jerry-count" role="status"></span></div>
  <div id="jerry-library-poems"></div><details class="jerry-reading"><summary>Reading behind the poems · 10 essays</summary>${sources.map(a=>`<p><a href="${a.url}" target="_blank" rel="noopener">${a.title} ↗</a><br><small>${a.authors} · ${a.date}</small></p>`).join('')}</details>`;
  document.body.append(library);
  const $=id=>document.getElementById(id),esc=t=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let enabled=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,follow=true,arming=false,drag=null,dragged=false,lastPhase='',lastStatus='',savedCamera=null,savedTarget=null,savedMin=15,followSnap=true,followZoom=1,savedDamping=controls.enableDamping;
  const followOffset=new THREE.Vector3(14,6,21),followRadius=followOffset.length();
  const shadowGeometry=new THREE.BufferGeometry();shadowGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(33*3),3));
  const shadowIndices=[];for(let i=1;i<=32;i++)shadowIndices.push(0,i,i===32?1:i+1);shadowGeometry.setIndex(shadowIndices);
  const shadow=new THREE.Mesh(shadowGeometry,new THREE.MeshBasicMaterial({color:'#102326',transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false}));shadow.renderOrder=-2;overlay.add(shadow);
  const marker=new THREE.Mesh(new THREE.RingGeometry(2,2.6,32),new THREE.MeshBasicMaterial({color:'#efbf73',side:THREE.DoubleSide,transparent:true,opacity:.9,depthTest:false}));marker.rotation.x=-Math.PI/2;marker.visible=false;overlay.add(marker);
  root.add(createRanchHome({ground,position,home:HOME}));
  function worldPosition(e,n,lift=0){const p=position(e,n,ground(e,n));p.y=p.y*getVertical()+lift;return p;}
  function pick(event){const rect=canvas.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return null;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);surface.updateWorldMatrix(true,false);const hit=ray.intersectObject(surface)[0];if(!hit)return null;const e=hit.point.x+(x0+x1)/2,n=(y0+y1)/2-hit.point.z;return valid(e,n)?[e,n]:null;}
  function setFollow(value){follow=value;controls.enableDamping=enabled&&value?false:savedDamping;$('jerry-follow').setAttribute('aria-pressed',String(value));followSnap=value;}
  function setPaused(value){paused=value;$('jerry-pause').textContent=value?'Resume':'Pause';$('jerry-pause').setAttribute('aria-pressed',String(value));}
  function cancelDrop(){shell.classList.remove('jerry-placing');$('jerry-options').setAttribute('aria-expanded',String(shell.classList.contains('jerry-controls-open')));arming=false;drag=null;marker.visible=false;controls.enabled=true;canvas.style.cursor='';$('jerry-wine').classList.remove('selected');$('jerry-drop-actions').hidden=true;$('jerry-drop-help').textContent='Drag a bottle onto the hills, or click then choose a spot.';}
  function arm(){if(!enabled)return;shell.classList.add('jerry-placing');$('jerry-options').setAttribute('aria-expanded','true');arming=true;controls.enabled=false;canvas.style.cursor='crosshair';$('jerry-wine').classList.add('selected');$('jerry-drop-actions').hidden=false;$('jerry-drop-help').textContent='Choose a terrain spot. Escape cancels; “Serve beside Jerry” works from the keyboard.';}
  function drop(p){if(!p||!motion.drop(...p)){$('jerry-drop-help').textContent='Choose a spot on the LiDAR terrain, away from its edge.';return;}bottle.position.copy(worldPosition(...p));bottle.visible=true;card.hidden=true;shell.classList.remove('jerry-reading-poem');lastPhase='';setPaused(false);cancelDrop();setFollow(true);}
  function showThinking(){card.classList.add('composing');card.hidden=false;shell.classList.add('jerry-reading-poem');}
  function showPoem(){card.classList.remove('composing');const poem=deck.next(),source=sources.find(a=>a.id===poem.source);$('jerry-poem-topic').textContent=poem.topic+' · '+String(poem.id).padStart(3,'0');$('jerry-poem-lines').textContent=poem.lines.join('\n');$('jerry-poem-source').textContent='Inspiration: '+source.title+' ↗';$('jerry-poem-source').href=source.url;card.hidden=false;shell.classList.add('jerry-reading-poem');}
  function reset(){followZoom=1;followOffset.set(14,6,21);cancelDrop();motion.reset();bottle.visible=false;card.hidden=true;shell.classList.remove('jerry-reading-poem');lastPhase='';setFollow(true);}
  function toggle(){
    enabled=!enabled;$('jerry-toggle').setAttribute('aria-pressed',String(enabled));$('jerry-panel').hidden=!enabled;$('jerry-quick').hidden=!enabled;shell.classList.toggle('jerry-on',enabled);mule.root.visible=enabled;label.hidden=homeLabel.hidden=!enabled;
    if(enabled){savedCamera=camera.position.clone();savedTarget=controls.target.clone();savedMin=controls.minDistance;savedDamping=controls.enableDamping;controls.minDistance=8;reset();setPaused(matchMedia('(prefers-reduced-motion: reduce)').matches);}
    else{controls.enableDamping=savedDamping;cancelDrop();bottle.visible=false;card.hidden=true;marker.visible=false;shell.classList.remove('jerry-show-tools','jerry-controls-open','jerry-reading-poem');$('jerry-options').setAttribute('aria-expanded','false');$('jerry-terrain').setAttribute('aria-expanded','false');if(savedCamera){camera.position.copy(savedCamera);controls.target.copy(savedTarget);controls.minDistance=savedMin;controls.update();}}
  }
  function renderLibrary(){const topic=$('jerry-theme').value,q=$('jerry-search').value.toLowerCase();const chosen=poems.filter(p=>(!topic||p.source===topic)&&(!q||p.lines.join(' ').toLowerCase().includes(q)));$('jerry-count').textContent=`${chosen.length} / 100`;$('jerry-library-poems').innerHTML=chosen.map(p=>{const source=sources.find(a=>a.id===p.source);return `<article><span class="eyebrow">${String(p.id).padStart(3,'0')} · ${p.topic}</span><p>${p.lines.map(esc).join('<br>')}</p><a href="${source.url}" target="_blank" rel="noopener">Read the inspiration ↗</a></article>`;}).join('')||'<p>No poems match. Try another word or theme.</p>';}
  $('jerry-toggle').onclick=toggle;$('jerry-pause').onclick=()=>setPaused(!paused);$('jerry-follow').onclick=()=>setFollow(!follow);$('jerry-home').onclick=reset;
  $('jerry-terrain').onclick=()=>{$('jerry-terrain').setAttribute('aria-expanded',String(shell.classList.toggle('jerry-show-tools')));};
  const openLibrary=()=>{cancelDrop();renderLibrary();library.showModal();};
  $('jerry-library').onclick=openLibrary;$('jerry-quick-library').onclick=openLibrary;
  $('jerry-quick-wine').onclick=()=>arming?cancelDrop():arm();
  $('jerry-options').onclick=()=>{if(arming)cancelDrop();$('jerry-options').setAttribute('aria-expanded',String(shell.classList.toggle('jerry-controls-open')));};$('jerry-library-close').onclick=()=>library.close();
  $('jerry-theme').onchange=renderLibrary;$('jerry-search').oninput=renderLibrary;
  $('jerry-continue').onclick=()=>{card.hidden=true;shell.classList.remove('jerry-reading-poem');bottle.visible=false;motion.resume();setPaused(false);};$('jerry-another').onclick=()=>{motion.compose();showThinking();setPaused(false);};
  toolbar.querySelectorAll('[data-jerry-go]').forEach(button=>button.onclick=()=>{cancelDrop();motion.go(button.dataset.jerryGo);bottle.visible=false;card.hidden=true;shell.classList.remove('jerry-reading-poem');lastPhase='';setPaused(false);setFollow(true);});
  $('jerry-serve').onclick=()=>drop([s.e,s.n]);$('jerry-cancel').onclick=cancelDrop;
  $('jerry-wine').onclick=()=>{if(dragged){dragged=false;return;}arming?cancelDrop():arm();};
  $('jerry-wine').onpointerdown=e=>{if(e.button!==0)return;dragged=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('jerry-wine').setPointerCapture(e.pointerId);};
  $('jerry-wine').onpointermove=e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6){dragged=true;if(!arming)arm();const p=pick(e);marker.visible=!!p;if(p)marker.position.copy(worldPosition(...p,.2));}};
  document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const moved=dragged||Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;drag=null;if(moved){dragged=true;e.preventDefault();e.stopImmediatePropagation();drop(pick(e));}},true);
  $('jerry-wine').onpointercancel=()=>{dragged=false;cancelDrop();};
  canvas.addEventListener('pointermove',e=>{if(!arming||drag)return;const p=pick(e);marker.visible=!!p;if(p)marker.position.copy(worldPosition(...p,.2));});
  canvas.addEventListener('pointerdown',e=>{if(arming){e.preventDefault();e.stopImmediatePropagation();}},true);
  canvas.addEventListener('pointerup',e=>{if(arming&&!drag){e.preventDefault();e.stopImmediatePropagation();drop(pick(e));}},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&arming){cancelDrop();e.preventDefault();}});
  bindJerryCameraGestures({canvas,distance:()=>camera.position.distanceTo(controls.target),canInteract:()=>enabled&&follow&&!arming&&controls.enabled,onPan:()=>setFollow(false),onOrbit:()=>{followOffset.copy(camera.position).sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),-mule.root.rotation.y).setLength(followRadius);},onZoom:ratio=>{followZoom=Math.max(.2,Math.min(200,followZoom*ratio));}});
  const dustCount=36,dustData=new Float32Array(dustCount*3),dustAge=new Float32Array(dustCount).fill(2);
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustData,3));
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#d8bd8e',size:1.3,transparent:true,opacity:.25,depthWrite:false}));dust.visible=false;overlay.add(dust);let dustIndex=0,dustTime=0;
  function update(dt){
    if(!enabled)return;
    const running=!paused&&!library.open&&!arming;const elapsed=running?Math.min(dt,.1):0;
    for(let rest=elapsed;rest>0;rest-=.02)motion.step(Math.min(.02,rest));
    mule.root.position.copy(worldPosition(s.e,s.n,s.hop+.08));mule.root.rotation.y=Math.PI-s.heading;mule.animate(s,elapsed);
    const shade=shadowGeometry.attributes.position;worldPosition(s.e,s.n,.05).toArray(shade.array,0);
    for(let i=0;i<32;i++){const a=i/32*Math.PI*2,ex=Math.cos(a)*2.4,nz=Math.sin(a)*4.2,e=s.e+ex*Math.cos(s.heading)+nz*Math.sin(s.heading),n=s.n-ex*Math.sin(s.heading)+nz*Math.cos(s.heading);worldPosition(e,n,.05).toArray(shade.array,(i+1)*3);}shade.needsUpdate=true;shadowGeometry.computeBoundingSphere();shadow.material.opacity=.22/(1+s.hop*.7);
    if(s.phase!==lastPhase){if(s.phase==='sip')bottle.visible=false;if(s.phase==='think')showThinking();if(s.phase==='poem')showPoem();lastPhase=s.phase;}
    if(follow){
      const target=mule.root.position.clone().add(new THREE.Vector3(0,s.phase==='think'||s.phase==='poem'?6:2.9,0));
      const offset=followOffset.clone().multiplyScalar(followZoom*Math.max(1,Math.min(2,.95/camera.aspect))).applyAxisAngle(new THREE.Vector3(0,1,0),mule.root.rotation.y);
      const desired=target.clone().add(offset),e=desired.x+(x0+x1)/2,n=(y0+y1)/2-desired.z;
      if(valid(e,n))desired.y=Math.max(desired.y,worldPosition(e,n).y+5);
      const mix=followSnap?1:1-Math.exp(-dt*3);camera.position.lerp(desired,mix);controls.target.lerp(target,mix);followSnap=false;
    }
    const text=arming?'Choose a wine stop on the terrain':paused?'Paused · the hills can wait':s.phase==='home'?'At the circle drive · ready to roam':s.phase==='sip'?'Engine off · a sip of red, a moment to think':s.phase==='think'?'Thinking · a haiku takes shape':s.phase==='poem'?'A thought from the hills · parked':s.phase==='fetch'?'A fine red? Taking the scenic shortcut':s.hop>0?`Air over ${s.lastJump?.id||'the ridge'}!`:`To ${s.destination} · ${Math.round(s.speed*3.6)} km/h · ${s.jumps} ridge hops`;
    if(text!==lastStatus){$('jerry-status').textContent=text;lastStatus=text;}
    dust.visible=running&&s.speed>5;dustTime+=elapsed;
    if(dust.visible&&dustTime>.05){dustTime=0;dustAge[dustIndex]=0;const p=mule.root.position.clone().add(new THREE.Vector3(Math.sin(s.elapsed*17)*2,.8,0));p.toArray(dustData,dustIndex*3);dustIndex=(dustIndex+1)%dustCount;}
    for(let i=0;i<dustCount;i++){dustAge[i]+=elapsed;if(dustAge[i]<1.5){dustData[i*3+1]+=elapsed*.9;dustData[i*3]+=(i%2?1:-1)*elapsed*.6;}else dustData[i*3+1]=-10000;}
    dustGeo.attributes.position.needsUpdate=true;dustGeo.computeBoundingSphere();
  }
  function layoutThought(){
    if(card.hidden)return;
    const p=mule.root.position.clone().add(new THREE.Vector3(0,7.4,0)).project(camera);
    const visible=p.z>=-1&&p.z<=1&&Math.abs(p.x)<1&&Math.abs(p.y)<1;
    card.style.visibility=visible?'visible':'hidden';if(!visible)return;
    const width=host.clientWidth,height=host.clientHeight,half=card.offsetWidth/2;
    const x=Math.max(half+12,Math.min(width-half-12,(p.x*.5+.5)*width));
    const toolbarBottom=width<=720?toolbar.getBoundingClientRect().bottom-host.getBoundingClientRect().top:12;
    const y=Math.min(height-45,Math.max(card.offsetHeight+toolbarBottom+16,(-p.y*.5+.5)*height-14));
    card.style.left=x+'px';card.style.top=y+'px';
    card.style.setProperty('--thought-tail',Math.max(20,Math.min(card.offsetWidth-20,(p.x*.5+.5)*width-x+half))+'px');
  }
  function draw(){if(!enabled)return;layoutThought();renderer.autoClear=false;renderer.clearDepth();renderer.render(overlay,camera);renderer.autoClear=true;const hp=worldPosition(...HOME,.4).project(camera);homeLabel.hidden=hp.z<0||hp.z>1||Math.abs(hp.x)>1||Math.abs(hp.y)>1||Math.hypot(s.e-HOME[0],s.n-HOME[1])>100;if(!homeLabel.hidden){homeLabel.style.left=(hp.x*.5+.5)*host.clientWidth+'px';homeLabel.style.top=(-hp.y*.5+.5)*host.clientHeight+35+'px';}const p=mule.root.position.clone().add(new THREE.Vector3(0,6.2,0)).project(camera);label.hidden=!card.hidden||p.z<0||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;if(!label.hidden){label.style.left=(p.x*.5+.5)*host.clientWidth+'px';label.style.top=(-p.y*.5+.5)*host.clientHeight+'px';}}
  return {update,draw,get enabled(){return enabled;},get interacting(){return arming;},releaseFollow(){if(enabled)setFollow(false);},suspend(){if(enabled)toggle();else cancelDrop();},homeNote:HOME_NOTE};
}
