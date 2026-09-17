import {createHaikuDeck} from './bill-haikus.js';
import * as THREE from './vendor/three/three.module.js';
// A procedural field companion. Never writes to the scientific layers or exports.
export function createBill({scene,pits,pickGround,heightAt,origin,camera,controls,project,host,render,stations,explore}){
 const $=s=>document.querySelector(s),root=new THREE.Group(),overlay=new THREE.Scene();overlay.add(root);root.visible=false;for(const light of scene.children.filter(o=>o.isLight))overlay.add(light.clone());
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:1});
 const blue=mat('#284c85'),red=mat('#ae263c'),skin=mat('#dfb18e'),gray=mat('#bcb9ae'),dark=mat('#242d34'),brown=mat('#655346'),paper=mat('#e5e0c7');
 function part(g,geo,m,x,y,z){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);g.add(o);return o;}
 const box=(g,m,x,y,z,w,h,d)=>part(g,new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const ball=(g,m,x,y,z,r,sx=1,sy=1,sz=1)=>{const o=part(g,new THREE.SphereGeometry(r,14,10),m,x,y,z);o.scale.set(sx,sy,sz);return o;};
 const torso=box(root,blue,0,1.16,0,.45,.64,.24);const sweater=box(root,red,0,1.16,0,.47,.65,.26);sweater.visible=false;
 const legs=[],arms=[];for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.125,.84,0);root.add(leg);box(leg,dark,0,-.36,0,.17,.69,.18);box(leg,brown,0,-.76,.055,.19,.13,.31);legs.push(leg);const arm=new THREE.Group();arm.position.set(side*.29,1.41,0);root.add(arm);const sleeve=box(arm,blue,0,-.23,0,.16,.45,.18);ball(arm,skin,0,-.49,0,.095);arms.push({pivot:arm,sleeve});}
 ball(root,skin,0,1.64,.015,.205,.9,1.08,.95);ball(root,gray,0,1.64,-.06,.21,1,1,.8);ball(root,skin,0,1.66,.085,.18,.92,1, .8);ball(root,skin,0,1.65,.235,.046,1,1,1.3);
 // Dark glasses, silver moustache, and a striped knit cap.
 for(const x of [-.087,.087])box(root,dark,x,1.735,.218,.14,.058,.035);box(root,dark,0,1.735,.215,.045,.018,.03);ball(root,gray,0,1.59,.223,.08,1,.3,.35);
 const knit=new THREE.Group();root.add(knit);const capColors=['#69524c','#b0816a','#546768','#94715a','#66524d'];for(let i=0;i<5;i++){const radius=.21-i*.018;part(knit,new THREE.CylinderGeometry(radius-.014,radius,.052,16),mat(capColors[i]),0,1.82+i*.05,0);}ball(knit,brown,0,2.057,0,.065,1,.65,1);
 const summer=new THREE.Group();root.add(summer);summer.visible=false;const teal=mat('#408d9d'),linen=mat('#dadbd0');ball(summer,teal,0,1.88,-.005,.213,1,.65,1);box(summer,teal,0,1.835,.2,.4,.025,.28);box(summer,dark,0,1.17,-.245,.41,.52,.19);for(const x of [-.18,.18])box(summer,dark,x,1.26,.145,.055,.48,.035);for(const x of [-.115,.115])box(summer,linen,x,1.23,.14,.14,.14,.02);
 const rain=new THREE.Group();root.add(rain);const yellow=mat('#edc52d');box(rain,yellow,0,1.07,0,.5,.86,.3);ball(rain,yellow,0,1.74,-.105,.255,1.06,1.33,.77);box(rain,mat('#e2b327'),0,1.86,.12,.48,.065,.29);for(let i=0;i<4;i++)ball(rain,brown,0,1.3-i*.14,.161,.015);
 const draped=new THREE.Group();root.add(draped);box(draped,red,0,1.38,-.17,.54,.46,.07);box(draped,red,0,1.48,0,.6,.15,.31);for(const side of [-1,1]){const sleeve=box(draped,red,side*.14,1.15,.18,.13,.59,.075);sleeve.rotation.z=side*.12;}ball(draped,red,0,1.41,.22,.075,1.5,.7,.8);
 // A few frayed yarn ends distinguish the old sweater from a pristine uniform.
 for(let i=0;i<5;i++)box(draped,red,(i-2)*.09,1.13-.025*(i%2),-.17,.012,.08,.018);
 const notebook=box(arms[0].pivot,brown,0,-.47,.14,.25,.035,.32);box(notebook,paper,0,.022,0,.23,.008,.29);
 const rod=part(arms[1].pivot,new THREE.CylinderGeometry(.013,.013,1.13,6),mat('#d8b16c'),0,-.38,.12);
 const shovel=new THREE.Group();arms[1].pivot.add(shovel);shovel.visible=false;part(shovel,new THREE.CylinderGeometry(.018,.018,.95,8),brown,0,-.35,.12);box(shovel,mat('#a8b1b2'),0,-.88,.13,.19,.24,.035);box(shovel,brown,0,.15,.12,.15,.035,.035);
 const halo=part(root,new THREE.RingGeometry(.5,.6,32),new THREE.MeshBasicMaterial({color:'#edc889',side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false}),0,.04,0);halo.rotation.x=-Math.PI/2;
 let season='wet';function outfit(){const dry=season==='dry',wet=season==='wet';knit.visible=season==='sweater';summer.visible=dry;rain.visible=wet;sweater.visible=season==='sweater'&&wearing;draped.visible=season==='sweater'&&!wearing;torso.material=dry?linen:blue;arms.forEach(a=>a.sleeve.material=wet?yellow:dry?linen:wearing?red:blue);legs.forEach(l=>l.children[0].material=dry?linen:dark);host.parentElement.dataset.billSeason=season;}
 $('#bill-season').onchange=e=>{season=e.target.value;outfit();render();};
 let digging=null,digElapsed=0,wasPaused=false,notice='',noticeTime=0;
 let enabled=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,follow=true,elapsed=0,station=0,dwell=0,visits=0,pose='Walking',wearing=false;
 const route=stations.length?stations:[{x:15,z:0,label:'the hillslope'}];root.position.set(route[0].x,heightAt(route[0].x+origin[0],origin[1]-route[0].z)-origin[2],route[0].z);station=route.length>1?1:0;
 const label=document.createElement('button');label.type='button';label.id='bill-label';label.title='Click and hold to pick Bill up';label.setAttribute('aria-label','Move Bill: hold Space and use arrow keys');label.hidden=true;label.textContent='Bill';host.parentElement.append(label);
 function status(){const text=placingChocolate?(chocolateHover?'Release to drop '+snackName()+' on the ring':'Drag '+snackName()+' over the hillslope'):carrying?(dropPoint?'Dangling · release to drop':'Move Bill over the hillslope · release to put him back'):noticeTime>0?notice:poemActive?(poemTime<3?'Composing a field haiku':'A little hillside poetry'):eating>0?(snackTarget?.kind==='almond'?'Eating almonds':'Eating chocolate'):digging?(paused?'Dig paused':`Digging a soil pit · ${Math.min(99,Math.floor(digElapsed/4.2*100))}%`):paused?'Field break':pose==='Walking'?snackTarget?(snackTarget.kind==='almond'?'Almonds spotted!':'Chocolate spotted!'):`Walking to ${route[station].label}`:`${pose} · stop ${visits}`;$('#bill-status').textContent=text;const boost=Math.max(0,Math.ceil((boostUntil-performance.now())/1000));$('#bill-energy').hidden=!boost;$('#bill-energy').textContent=boost?`Chocolate boost · ${boost}s`:'';host.parentElement.dataset.billBoostSeconds=String(boost);host.parentElement.dataset.billChocolateCount=String(chocolates.filter(f=>f.kind==='chocolate').length);host.parentElement.dataset.billAlmondCount=String(chocolates.filter(f=>f.kind==='almond').length);host.parentElement.dataset.billPoemPhase=poemActive?(poemTime<3?'composing':'reading'):'working';host.parentElement.dataset.billState=text;host.parentElement.dataset.billPosition=root.position.toArray().map(x=>x.toFixed(2)).join(',');}
 function finishDig(){if(!digging)return;pits.progress(digging,1);digging=null;shovel.visible=false;rod.visible=true;notebook.visible=true;root.rotation.x=0;arms[0].pivot.rotation.x=-.85;arms[1].pivot.rotation.x=0;paused=wasPaused;$('#bill-dig').disabled=false;$('#bill-dig').textContent='Dig a pit';$('#bill-pause').setAttribute('aria-pressed',String(paused));$('#bill-pause').textContent=paused?'Resume':'Pause';status();}
 $('#bill-dig').onclick=()=>{if(digging)return;finishPoem();const x=root.position.x+Math.sin(root.rotation.y)*1.05,z=root.position.z+Math.cos(root.rotation.y)*1.05;digging=pits.begin(x,z);if(!digging){notice='A pit is already here — let Bill walk a little farther.';noticeTime=3;status();return;}noticeTime=0;wasPaused=paused;paused=false;digElapsed=0;shovel.visible=true;rod.visible=false;notebook.visible=false;$('#bill-dig').disabled=true;$('#bill-dig').textContent='Digging…';$('#bill-pause').setAttribute('aria-pressed','false');$('#bill-pause').textContent='Pause';if(matchMedia('(prefers-reduced-motion: reduce)').matches)finishDig();status();render();};
 $('#bill-clear-pits').onclick=()=>{finishDig();pits.clear();render();};
 function clearTerrain(){camera.position.y=Math.max(camera.position.y,heightAt(camera.position.x+origin[0],origin[1]-camera.position.z)-origin[2]+4);}
 function releaseFollow(){follow=false;$('#bill-follow').setAttribute('aria-pressed','false');}
 function focus(){controls.target.copy(root.position).add(new THREE.Vector3(0,1,0));camera.position.copy(controls.target).add(new THREE.Vector3(9,12,11));clearTerrain();controls.update();}
 function toggle(){cancelCarry();outfit();enabled=!enabled;if(!enabled){finishPoem();finishEating(false);finishDig();chocolates.forEach(f=>f.label.hidden=true);}root.visible=enabled;label.hidden=!enabled;$('#bill-toggle').setAttribute('aria-pressed',String(enabled));$('#bill-toggle').setAttribute('aria-expanded',String(enabled));$('#bill-toolbar').classList.toggle('open',enabled);$('#bill-panel').hidden=!enabled;if(enabled){controls.autoRotate=false;$('#scene-spin').setAttribute('aria-pressed','false');$('#bill-pause').setAttribute('aria-pressed',String(paused));$('#bill-pause').textContent=paused?'Resume':'Pause';follow=true;$('#bill-follow').setAttribute('aria-pressed','true');focus();}status();render();}
 $('#bill-toggle').onclick=toggle;$('#bill-pause').onclick=()=>{paused=!paused;$('#bill-pause').setAttribute('aria-pressed',String(paused));$('#bill-pause').textContent=paused?'Resume':'Pause';status();};$('#bill-follow').onclick=()=>{follow=!follow;$('#bill-follow').setAttribute('aria-pressed',String(follow));if(follow)focus();};
 $('#bill-roam').onclick=()=>{releaseFollow();explore();};
 // Dragging uses terrain intersections, with a separate ring marking the true ground.
 const canvas=host.querySelector('canvas'),landing=new THREE.Mesh(new THREE.RingGeometry(.72,.9,48),new THREE.MeshBasicMaterial({color:'#ffe2a0',side:THREE.DoubleSide,transparent:true,opacity:.95,depthTest:false,depthWrite:false}));
 landing.rotation.x=-Math.PI/2;landing.visible=false;overlay.add(landing);
 const billGuide=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#ffe2a0',transparent:true,opacity:.6,depthTest:false,depthWrite:false}));billGuide.visible=false;overlay.add(billGuide);
 let carrying=false,carryOrigin=null,carryPaused=false,carryFollow=false,dropPoint=null,dragPointer=null,dragStart=null,captureTarget=null,pendingPointer=null,carryTime=0,controlsEnabled=true;
 const locked=['#bill-almonds','#bill-chocolate','#bill-dig','#bill-clear-pits','#bill-pause','#bill-follow','#bill-roam','#scene-home','#scene-top','#scene-spin','#scene-vms-detail'];
 function carryUI(){
  host.parentElement.classList.toggle('bill-carrying',carrying);host.parentElement.dataset.billCarrying=String(carrying);
  for(const id of locked)$(id).disabled=carrying;
  label.textContent=carrying?'Wheee!':'Bill ↕';
 }
 function poseCarry(){
  // Keep the picked-up figure legible while the landing ring stays at terrain scale.
  const ground=dropPoint||carryOrigin,worldPerPixel=2*camera.position.distanceTo(ground)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,host.clientHeight);
  const scale=Math.max(1,Math.min(18,worldPerPixel*22));root.scale.setScalar(scale);
  root.position.copy(ground);root.position.y+=scale*1.5;
  root.rotation.x=.03;root.rotation.z=Math.sin(carryTime*3)*.08;legs.forEach((l,i)=>l.rotation.x=.12+Math.sin(carryTime*4+i)*.12);
  arms[0].pivot.rotation.x=-2.7;arms[1].pivot.rotation.x=-2.5;halo.visible=false;
  landing.visible=billGuide.visible=!!dropPoint;landing.position.copy(ground);landing.position.y+=.08;landing.scale.setScalar(Math.max(.6,worldPerPixel*14));
  const guide=billGuide.geometry.attributes.position;guide.setXYZ(0,...landing.position.toArray());guide.setXYZ(1,...root.position.toArray());guide.needsUpdate=true;billGuide.geometry.computeBoundingSphere();
  host.parentElement.dataset.billLanding=ground.toArray().map(x=>x.toFixed(3)).join(',');
  host.parentElement.dataset.billDropValid=String(!!dropPoint);
 }
 function beginCarry(){
  if(!enabled||carrying)return;cancelChocolate();finishPoem();finishEating(false);finishDig();carryOrigin=root.position.clone();carryOrigin.y=heightAt(carryOrigin.x+origin[0],origin[1]-carryOrigin.z)-origin[2];
  carryPaused=paused;carryFollow=follow;controlsEnabled=controls.enabled;controls.autoRotate=false;$('#scene-spin').setAttribute('aria-pressed','false');releaseFollow();controls.enabled=false;
  carrying=true;dropPoint=carryOrigin.clone();carryTime=0;noticeTime=0;rod.visible=false;notebook.visible=false;$('#scene-hover').hidden=true;
  carryUI();poseCarry();status();render();
 }
 function endCarry(commit){
  if(!carrying)return;const destination=commit&&dropPoint?dropPoint:carryOrigin;const dropped=!!(commit&&dropPoint);carrying=false;pendingPointer=null;
  root.position.copy(destination);root.position.y=heightAt(destination.x+origin[0],origin[1]-destination.z)-origin[2];root.scale.setScalar(1);root.rotation.x=root.rotation.z=0;
  arms.forEach(a=>a.pivot.rotation.x=0);legs.forEach(l=>l.rotation.x=0);halo.visible=true;rod.visible=true;notebook.visible=true;landing.visible=billGuide.visible=false;paused=carryPaused;controls.enabled=controlsEnabled;
  if(captureTarget&&dragPointer!==null&&captureTarget.hasPointerCapture(dragPointer))captureTarget.releasePointerCapture(dragPointer);dragPointer=null;captureTarget=null;
  if(dropped){let nearest=0;for(let i=1;i<route.length;i++)if(Math.hypot(route[i].x-root.position.x,route[i].z-root.position.z)<Math.hypot(route[nearest].x-root.position.x,route[nearest].z-root.position.z))nearest=i;station=(nearest+route.length-1)%route.length;visits++;dwell=7;pose='Checking a field measurement';}
  else{follow=carryFollow;$('#bill-follow').setAttribute('aria-pressed',String(follow));}
  carryUI();status();render();
 }
 function cancelCarry(){endCarry(false);cancelChocolate();}
 function canDropAt(x,y){const element=document.elementFromPoint(x,y);return !!element&&(element===canvas||element===label||label.contains(element)||element.classList.contains?.('chocolate-label'));}
 function moveCarry(x,y){dropPoint=canDropAt(x,y)?pickGround(x,y):null;poseCarry();}
 function heldPointer(e,target){dragStart={x:e.clientX,y:e.clientY};dragPointer=e.pointerId;captureTarget=target;target.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();}
 function onDown(e){
  if(!enabled||e.button!==0||host.parentElement.hidden)return;
  if(placingChocolate){e.preventDefault();e.stopImmediatePropagation();return;}
  if(carrying){heldPointer(e,canvas);moveCarry(e.clientX,e.clientY);return;}
  const r=host.getBoundingClientRect(),b=screenBounds(false),x=e.clientX-r.left,y=e.clientY-r.top;
  if(b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h){beginCarry();heldPointer(e,canvas);return;}
  const food=chocolates.find(f=>{if(f===snackTarget&&eating>0)return false;const p=project(f.mesh.position);return p.z>-1&&p.z<1&&Math.hypot(p.x-x,p.y-y)<16;});if(food){beginChocolate(food);holdChocolate(e,canvas);}
 }
 canvas.addEventListener('pointerdown',onDown,true);
 label.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(!carrying)beginCarry();heldPointer(e,label);});
 label.addEventListener('click',e=>e.preventDefault());
 label.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat){e.preventDefault();beginCarry();}});
 label.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();endCarry(true);}});
 document.addEventListener('pointermove',e=>{if(placingChocolate){if(chocolatePointer!==null&&e.pointerId!==chocolatePointer)return;chocolatePending={x:e.clientX,y:e.clientY};e.preventDefault();e.stopImmediatePropagation();return;}if(!carrying)return;if(dragPointer!==null&&e.pointerId!==dragPointer)return;pendingPointer={x:e.clientX,y:e.clientY};if(e.target===canvas||dragPointer!==null){e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('pointerup',e=>{if(placingChocolate&&e.pointerId===chocolatePointer){e.preventDefault();e.stopImmediatePropagation();const p=canDropAt(e.clientX,e.clientY)?pickGround(e.clientX,e.clientY):null;if(p)dropChocolate(p);cancelChocolate();status();render();return;}if(!carrying||dragPointer!==e.pointerId)return;if(dragStart&&Math.hypot(e.clientX-dragStart.x,e.clientY-dragStart.y)<3)dropPoint=carryOrigin.clone();else moveCarry(e.clientX,e.clientY);e.preventDefault();e.stopImmediatePropagation();endCarry(true);},true);
 document.addEventListener('pointercancel',e=>{if(placingChocolate)cancelChocolate();if(carrying&&e.pointerId===dragPointer)cancelCarry();},true);
 document.addEventListener('keydown',e=>{if(placingChocolate){if(e.key==='Escape'){e.preventDefault();cancelChocolate();status();render();}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const p=project(chocolateHover||root.position),r=host.getBoundingClientRect();moveChocolate(r.left+p.x+(e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:0),r.top+p.y+(e.key==='ArrowDown'?10:e.key==='ArrowUp'?-10:0));status();render();}return;}if(!carrying)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancelCarry();}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();const p=project(dropPoint||carryOrigin),r=host.getBoundingClientRect(),step=e.shiftKey?30:10;moveCarry(r.left+p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),r.top+p.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));status();render();}},true);
 for(const target of [canvas,label])target.addEventListener('lostpointercapture',e=>{if(carrying&&e.pointerId===dragPointer)cancelCarry();if(placingChocolate&&e.pointerId===chocolatePointer)cancelChocolate();});
 window.addEventListener('blur',cancelCarry);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelCarry();});
 // Snacks stay outside the field datasets and follows the same LiDAR ground.
 const chocolateMaterial=mat('#442016'),wrapperMaterial=mat('#c79556'),foilMaterial=mat('#e8d8b5');
 function chocolateMesh(){const g=new THREE.Group();box(g,chocolateMaterial,0,.08,0,.7,.14,.38);box(g,wrapperMaterial,-.17,.085,0,.38,.16,.4);box(g,foilMaterial,.04,.17,0,.06,.025,.39);for(const x of [.14,.3])for(const z of [-.1,.1])box(g,chocolateMaterial,x,.175,z,.12,.045,.14);return g;}
 const almondMaterial=mat('#b57d46'),almondSeam=mat('#84522d');
 function almondMesh(){const g=new THREE.Group();for(const [x,z,angle] of [[-.19,-.06,-.35],[.17,.01,.5],[0,.22,-.1]]){const nut=new THREE.Group();nut.position.set(x,.085,z);nut.rotation.y=angle;g.add(nut);ball(nut,almondMaterial,0,0,0,1,.105,.075,.2);const seam=box(nut,almondSeam,0,.073,0,.012,.006,.29);seam.rotation.y=.04;}return g;}
 const chocolates=[];let placingChocolate=false,chocolatePointer=null,chocolateHover=null,chocolatePending=null,chocolateControlsEnabled=true,chocolateCaptureTarget=null,chocolateSource=null,snackTarget=null,eating=0,boostUntil=0,activeSnackKind='chocolate';
 const previewChocolate=new THREE.Group(),previewBar=chocolateMesh(),previewAlmonds=almondMesh();previewChocolate.add(previewBar,previewAlmonds);previewAlmonds.visible=false;const chocolateLanding=new THREE.Mesh(new THREE.RingGeometry(.72,.9,48),new THREE.MeshBasicMaterial({color:'#ffe2a0',side:THREE.DoubleSide,transparent:true,opacity:.95,depthTest:false,depthWrite:false}));chocolateLanding.rotation.x=-Math.PI/2;
 const chocolateGuide=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#ffe2a0',transparent:true,opacity:.6,depthTest:false,depthWrite:false}));
 overlay.add(previewChocolate,chocolateLanding,chocolateGuide);previewChocolate.visible=chocolateLanding.visible=chocolateGuide.visible=false;
 const chocolateButton=$('#bill-chocolate'),almondButton=$('#bill-almonds');
 const snackName=()=>activeSnackKind==='almond'?'almonds':'chocolate';
 function moveChocolate(x,y){
  chocolateHover=canDropAt(x,y)?pickGround(x,y):null;previewChocolate.visible=chocolateLanding.visible=chocolateGuide.visible=!!chocolateHover;host.parentElement.dataset.chocolateDropValid=String(!!chocolateHover);
  if(!chocolateHover)return;
  const unit=2*camera.position.distanceTo(chocolateHover)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,host.clientHeight),scale=Math.max(1,unit*45);
  previewChocolate.scale.setScalar(scale);previewChocolate.position.copy(chocolateHover).add(new THREE.Vector3(0,Math.max(1.3,unit*65),0));previewChocolate.rotation.set(.15,.35,.1);
  chocolateLanding.position.copy(chocolateHover).add(new THREE.Vector3(0,.08,0));chocolateLanding.scale.setScalar(Math.max(.6,unit*14));
  const attr=chocolateGuide.geometry.attributes.position;attr.setXYZ(0,...chocolateLanding.position.toArray());attr.setXYZ(1,...previewChocolate.position.toArray());attr.needsUpdate=true;chocolateGuide.geometry.computeBoundingSphere();
  host.parentElement.dataset.chocolateLanding=chocolateHover.toArray().map(x=>x.toFixed(3)).join(',');
 }
 function beginChocolate(food=null,kind='chocolate'){if(placingChocolate||carrying)return;activeSnackKind=food?.kind||kind;previewBar.visible=activeSnackKind==='chocolate';previewAlmonds.visible=activeSnackKind==='almond';chocolateSource=food;if(food){food.mesh.visible=false;food.label.hidden=true;}placingChocolate=true;chocolateControlsEnabled=controls.enabled;controls.enabled=false;controls.autoRotate=false;$('#scene-spin').setAttribute('aria-pressed','false');host.parentElement.classList.add('chocolate-placing');(activeSnackKind==='almond'?almondButton:chocolateButton).textContent='Release to drop';status();render();}
 function holdChocolate(e,target){chocolatePointer=e.pointerId;chocolateCaptureTarget=target;target.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();}
 for(const [button,kind] of [[chocolateButton,'chocolate'],[almondButton,'almond']]){
  button.addEventListener('pointerdown',e=>{if(e.button!==0)return;beginChocolate(null,kind);holdChocolate(e,button);});
  button.addEventListener('click',e=>e.preventDefault());
  button.addEventListener('lostpointercapture',e=>{if(placingChocolate&&e.pointerId===chocolatePointer)cancelChocolate();});
  button.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat){e.preventDefault();beginChocolate(null,kind);const p=project(root.position),r=host.getBoundingClientRect();moveChocolate(r.left+p.x,r.top+p.y);}});
  button.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();if(chocolateHover)dropChocolate(chocolateHover);cancelChocolate();status();render();}});
 }

 function cancelChocolate(){const wasPlacing=placingChocolate;placingChocolate=false;chocolateHover=null;chocolatePending=null;previewChocolate.visible=chocolateLanding.visible=chocolateGuide.visible=false;const id=chocolatePointer;chocolatePointer=null;if(id!==null&&chocolateCaptureTarget?.hasPointerCapture(id))chocolateCaptureTarget.releasePointerCapture(id);chocolateCaptureTarget=null;if(chocolateSource){chocolateSource.mesh.visible=true;chocolateSource.label.hidden=false;chocolateSource=null;}if(wasPlacing)controls.enabled=chocolateControlsEnabled;chocolateButton.textContent='🍫 Chocolate';almondButton.textContent='Almonds';host.parentElement.classList.remove('chocolate-placing');host.parentElement.dataset.chocolateDropValid='false';}

 function removeChocolate(food){const i=chocolates.indexOf(food);if(i>=0)chocolates.splice(i,1);overlay.remove(food.mesh);food.mesh.traverse(o=>o.geometry?.dispose());food.label.remove();}
 function dropChocolate(p){if(chocolateSource){chocolateSource.mesh.position.copy(p);chocolateSource.mesh.visible=true;chocolateSource.x=p.x;chocolateSource.z=p.z;chocolateSource.label.hidden=false;chocolateSource=null;return;}if(chocolates.length>=8){const oldest=chocolates.find(f=>f!==snackTarget);if(oldest)removeChocolate(oldest);}const mesh=activeSnackKind==='almond'?almondMesh():chocolateMesh();mesh.position.copy(p);mesh.rotation.y=.3;overlay.add(mesh);const tag=document.createElement('button');tag.type='button';tag.className='chocolate-label'+(activeSnackKind==='almond'?' almond-label':'');tag.textContent=activeSnackKind==='almond'?'':'🍫';tag.title='Hold and drag '+snackName();tag.setAttribute('aria-label','Move '+snackName());host.parentElement.append(tag);const food={mesh,label:tag,x:p.x,z:p.z,kind:activeSnackKind};chocolates.push(food);tag.addEventListener('pointerdown',e=>{if(e.button!==0)return;beginChocolate(food);holdChocolate(e,tag);});tag.addEventListener('lostpointercapture',e=>{if(placingChocolate&&e.pointerId===chocolatePointer)cancelChocolate();});tag.addEventListener('click',e=>e.preventDefault());}

 function finishEating(reward=true){if(!eating)return;const kind=snackTarget?.kind;eating=0;if(snackTarget)removeChocolate(snackTarget);snackTarget=null;notebook.visible=true;rod.visible=true;pose='Walking';if(reward){if(kind==='almond')beginPoem();else boostUntil=performance.now()+30000;}}
 const drawHaiku=createHaikuDeck();let poemActive=false,poemTime=0,poemStarted=0,poemShownAt=0,currentPoem=null;
 const haikuBox=document.createElement('div');haikuBox.id='bill-haiku';haikuBox.hidden=true;haikuBox.setAttribute('role','status');haikuBox.setAttribute('aria-live','polite');host.parentElement.append(haikuBox);
 function beginPoem(){poemActive=true;poemTime=0;poemStarted=performance.now();poemShownAt=0;currentPoem=null;dwell=0;haikuBox.textContent='Bill is composing…';haikuBox.classList.add('composing');rod.visible=false;notebook.visible=true;halo.visible=false;}
 function finishPoem(){if(!poemActive)return;poemActive=false;poemTime=0;haikuBox.hidden=true;legs.forEach(l=>l.rotation.x=0);arms.forEach(a=>a.pivot.rotation.x=0);root.rotation.x=root.rotation.z=0;root.position.y=heightAt(root.position.x+origin[0],origin[1]-root.position.z)-origin[2];halo.visible=true;rod.visible=true;pose='Walking';}
 function updatePoem(dt){poemTime=(performance.now()-poemStarted)/1000;pose=poemTime<3?'Composing a field haiku':'A little hillside poetry';root.rotation.x=.08;root.rotation.z=0;legs.forEach(l=>l.rotation.x=-Math.PI/2);arms[0].pivot.rotation.x=-.9;arms[1].pivot.rotation.x=-.9+(poemTime<3?Math.sin(elapsed*7)*.08:0);halo.visible=false;
  if(poemTime>=3&&!currentPoem){currentPoem=drawHaiku();poemShownAt=performance.now();haikuBox.textContent=currentPoem.lines.join('\n');haikuBox.classList.remove('composing');host.parentElement.dataset.billHaikuId=String(currentPoem.id);}
  if(currentPoem&&performance.now()-poemShownAt>=20000)finishPoem();
 }
 function layoutPoem(){if(!poemActive){haikuBox.hidden=true;return;}const p=project(root.position.clone().add(new THREE.Vector3(0,2.6,0)));haikuBox.hidden=p.z< -1||p.z>1||p.x<0||p.x>host.clientWidth||p.y<0||p.y>host.clientHeight;if(haikuBox.hidden)return;const half=haikuBox.offsetWidth/2;haikuBox.style.left=Math.max(half+10,Math.min(host.clientWidth-half-10,p.x))+'px';const barBottom=$('#bill-toolbar').getBoundingClientRect().bottom-host.getBoundingClientRect().top;haikuBox.style.top=Math.max(haikuBox.offsetHeight+barBottom+12,p.y-14)+'px';}

 function updateChocolate(dt){
  if(placingChocolate&&chocolatePending){moveChocolate(chocolatePending.x,chocolatePending.y);chocolatePending=null;}
  for(const food of chocolates){const p=project(food.mesh.position.clone().add(new THREE.Vector3(0,.45,0)));food.label.hidden=!enabled||food===chocolateSource||food===snackTarget&&eating>0||p.z< -1||p.z>1||p.x<0||p.x>host.clientWidth||p.y<0||p.y>host.clientHeight;food.label.style.left=p.x+'px';food.label.style.top=p.y+'px';}
  if(!paused&&!carrying&&!digging&&!eating&&!poemActive&&!placingChocolate){let nearest=null,best=25;for(const food of chocolates){const d=Math.hypot(food.x-root.position.x,food.z-root.position.z);if(d<best){nearest=food;best=d;}}if(nearest){snackTarget=nearest;dwell=0;pose='Walking';}}
 }
 // Manual camera navigation remains available; following can be restored explicitly.
 controls.addEventListener('start',()=>{if(enabled)releaseFollow();});
 function update(dt){if(!enabled)return false;updateChocolate(dt);noticeTime=Math.max(0,noticeTime-dt);const old=root.position.clone();if(carrying){carryTime+=dt;if(pendingPointer){moveCarry(pendingPointer.x,pendingPointer.y);pendingPointer=null;}poseCarry();}else if(!paused&&!placingChocolate){elapsed+=dt;if(poemActive){updatePoem(dt);}else if(eating>0){eating-=dt;pose=snackTarget?.kind==='almond'?'Eating almonds':'Eating chocolate';arms[0].pivot.rotation.x=-1.6+Math.sin(elapsed*6)*.1;arms[1].pivot.rotation.x=-.8;legs.forEach(l=>l.rotation.x=0);if(snackTarget)snackTarget.mesh.position.copy(root.position).add(new THREE.Vector3(Math.sin(root.rotation.y)*.4,1.5,Math.cos(root.rotation.y)*.4));if(eating<=0){eating=.001;finishEating();}}else if(digging){digElapsed+=dt;const t=Math.min(1,digElapsed/4.2),stroke=Math.sin(digElapsed*Math.PI*2.4);pits.progress(digging,t);root.rotation.x=.12+.12*stroke;root.rotation.z=0;arms[0].pivot.rotation.x=-.5-.3*stroke;arms[1].pivot.rotation.x=-.65-.6*stroke;legs.forEach(l=>l.rotation.x=0);if(t>=1)finishDig();}else if(dwell>0){dwell-=dt;pose=dwell>3?'Checking a field measurement':'Writing in the notebook';arms[0].pivot.rotation.x=-.85;arms[1].pivot.rotation.x=dwell>3?-.35:-1.0+Math.sin(elapsed*7)*.06;legs.forEach(l=>l.rotation.x=0);root.rotation.z=Math.sin(elapsed*2)*.012;if(dwell<=0){station=(station+1)%route.length;pose='Walking';}}else{const target=snackTarget||route[station],dx=target.x-root.position.x,dz=target.z-root.position.z,distance=Math.hypot(dx,dz),step=Math.min(distance,dt*1.7*(performance.now()<boostUntil?2:1));if(distance<.2&&snackTarget){eating=2;pose=snackTarget?.kind==='almond'?'Eating almonds':'Eating chocolate';rod.visible=false;notebook.visible=false;}else if(distance<.2){visits++;dwell=7;wearing=visits%2===1;outfit();}else{root.position.x+=dx/distance*step;root.position.z+=dz/distance*step;root.rotation.y=Math.atan2(dx,dz);legs.forEach((l,i)=>l.rotation.x=Math.sin(elapsed*7+i*Math.PI)*.42);arms.forEach((a,i)=>a.pivot.rotation.x=Math.sin(elapsed*7+i*Math.PI+Math.PI)*.24);root.rotation.z=0;}}
 root.position.y=heightAt(root.position.x+origin[0],origin[1]-root.position.z)-origin[2]+(poemActive?-.65:digging||dwell>0||eating>0?0:Math.abs(Math.sin(elapsed*7))*.04);if(follow){const delta=root.position.clone().sub(old);camera.position.add(delta);controls.target.add(delta);clearTerrain();}}
 const p=project(root.position.clone().add(new THREE.Vector3(0,2.3*root.scale.y,0)));label.hidden=p.z< -1||p.z>1||p.x<0||p.x>host.clientWidth||p.y<0||p.y>host.clientHeight;label.style.left=p.x+'px';label.style.top=p.y+'px';layoutPoem();status();return true;}
 function renderOverlay(renderer,camera){if(!enabled)return;const auto=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(overlay,camera);renderer.autoClear=auto;host.parentElement.dataset.billRenderPass='after-field-markers';}
 function screenBounds(includePoem=true){if(!enabled)return null;const pp=[];for(const x of [-.65,.65])for(const y of [0,2.5])for(const z of [-.65,.65])pp.push(project(root.position.clone().add(new THREE.Vector3(x,y,z).multiplyScalar(root.scale.x))));if(pp.every(p=>p.z< -1||p.z>1))return null;const xs=pp.map(p=>p.x),ys=pp.map(p=>p.y);if(includePoem&&poemActive&&!haikuBox.hidden){const h=haikuBox.getBoundingClientRect(),r=host.getBoundingClientRect();xs.push(h.left-r.left,h.right-r.left);ys.push(h.top-r.top,h.bottom-r.top);}return {x:Math.min(...xs)-8,y:Math.min(...ys)-8,w:Math.max(...xs)-Math.min(...xs)+16,h:Math.max(...ys)-Math.min(...ys)+16};}
 return {update,releaseFollow,renderOverlay,screenBounds,cancelCarry,get carrying(){return carrying;},get dragging(){return carrying||placingChocolate;}};
}
